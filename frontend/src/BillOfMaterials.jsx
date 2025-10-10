import React, {
  useEffect,
  useMemo,
  useState,
  useRef,
  useImperativeHandle,
  forwardRef,
} from "react";
import Fuse from "fuse.js";
import "./BillOfMaterials.css";
import axios from "axios";
import {
  Container,
  Row,
  Col,
  Card,
  Button,
  Form,
  Spinner,
  Alert,
  InputGroup,
  Badge,
  Table,
  ButtonGroup,
  Modal,
} from "react-bootstrap";
import { API_URL } from "./apiConfig";
import { useNotification } from "./NotificationContext";

/**
 * ---------------------------
 *  SIMPLE BOM – single source of truth
 *
 *  Rules ():
 *  - If project.bom_modified === true ⇒ load saved BOM from DB, then overlay latest core components from SystemDesign.
 *  - Else if a standard template is selected ⇒ load template extras, overlay core components from SystemDesign.
 *  - Else ⇒ build from SystemDesign core only.
 *  - Full System Mode locks core component quantities/removals. Component Quote Mode unlocks them.
 *  - When editing a quote (quoteContext?.docId), core components are locked regardless of mode.
 *  - “Generate Quote” snapshots current BOM into a new quote version (via /api/projects/:id/quotes) and navigates to Printable.
 *  - Prices shown are *live* (cost * (1+margin)). Quote snapshots are handled server-side at versioning.
 * ---------------------------
 */

/* ---------- Category meta (display only) ---------- */
const CATEGORY_META = {
  panel: { name: "Panel", icon: "bi-grid-3x3-gap-fill", color: "warning" },
  inverter: { name: "Inverter", icon: "bi-box-seam", color: "info" },
  battery: { name: "Battery", icon: "bi-battery-full", color: "success" },
  mppt: { name: "MPPT", icon: "bi-arrow-down-up", color: "info" },
  protection: {
    name: "Protection",
    icon: "bi-shield-slash-fill",
    color: "danger",
  },
  inverter_aux: {
    name: "Inverter Aux",
    icon: "bi-hdd-stack-fill",
    color: "secondary",
  },
  contactor: {
    name: "Contactor",
    icon: "bi-lightning-charge-fill",
    color: "danger",
  },
  enclosure: { name: "Enclosure", icon: "bi-box", color: "secondary" },
  change_over_switch: {
    name: "Change Over Switch",
    icon: "bi-toggle-on",
    color: "secondary",
  },
  db: { name: "DB", icon: "bi-hdd-network", color: "secondary" },
  cable: { name: "Cable", icon: "bi-lightning", color: "dark" },
  cable_management: {
    name: "Cable Management",
    icon: "bi-bezier2",
    color: "dark",
  },
  conductor: { name: "Conductor", icon: "bi-plug-fill", color: "dark" },
  mounting_system: {
    name: "Mounting System",
    icon: "bi-bricks",
    color: "secondary",
  },
  monitoring: { name: "Monitoring", icon: "bi-graph-up", color: "primary" },
  monitoring_control: {
    name: "Monitoring & Control Equipment",
    icon: "bi-display",
    color: "primary",
  },
  auxiliaries: { name: "Auxiliaries", icon: "bi-tools", color: "secondary" },
  solar_geyser: { name: "Solar Geyser", icon: "bi-water", color: "info" },
  lights: { name: "Lights", icon: "bi-lightbulb", color: "warning" },
  aux_generator: {
    name: "Aux Generator",
    icon: "bi-lightning-charge",
    color: "warning",
  },
  vsd: { name: "VSD", icon: "bi-speedometer2", color: "info" },
  professional_services: {
    name: "Professional Services",
    icon: "bi-person-badge",
    color: "primary",
  },
  transport_logistics: {
    name: "Transport & Logistics",
    icon: "bi-truck",
    color: "dark",
  },
  human_resources: {
    name: "Human Resources",
    icon: "bi-people",
    color: "primary",
  },
  hseq_compliance: {
    name: "HSEQ & Compliance",
    icon: "bi-check-circle",
    color: "success",
  },
  st: { name: "S&T", icon: "bi-clipboard-check", color: "secondary" },
  0: { name: "Uncategorized", icon: "bi-question-circle", color: "secondary" },
  other: { name: "Other", icon: "bi-box", color: "secondary" },
};

const PRIORITY = ["panel", "inverter", "battery"];

/* ---------- Utils ---------- */
const slugify = (s) =>
  (s || "")
    .toString()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^\w\s]/g, "")
    .trim()
    .replace(/\s+/g, "_");
const fmt = (v) =>
  new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
    minimumFractionDigits: 2,
  })
    .format(v || 0)
    .replace("R", "R") // optional if you want to keep 'R'
    .replace(/,/g, " "); // replace comma with space

const toNum = (v) => (v === "" || v == null ? 0 : Number(v));
const DEFAULT_MARGIN = 0.25;
const isCore = (cat) => ["panel", "inverter", "battery"].includes(cat);

const rowCost = (row) => toNum(row.unit_cost_at_time ?? row.product?.unit_cost);
const rowMargin = (row) => {
  if (row.override_margin != null && row.override_margin !== "")
    return Number(row.override_margin);
  const m = Number(row.product?.margin);
  return Number.isFinite(m) && m >= 0 ? (m <= 1 ? m : m / 100) : DEFAULT_MARGIN;
};
const rowUnitPrice = (row) => {
  const c = rowCost(row);
  const m = rowMargin(row);
  return Number.isFinite(c) ? c * (1 + m) : Number(row.product?.price || 0);
};

/* ---------- Component ---------- */
export default function BillOfMaterials({
  projectId,
  onNavigateToPrintBom,
  quoteContext,
}) {
  const { showNotification } = useNotification();

  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState([]);
  const [project, setProject] = useState(null);
  const [bom, setBom] = useState([]); // [{ product, quantity, override_margin?, unit_cost_at_time? }]

  const [lastSavedBom, setLastSavedBom] = useState([]);
  const [showUnsavedModal, setShowUnsavedModal] = useState(false);
  const [nextRoute, setNextRoute] = useState(null);

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [bomSearch, setBomSearch] = useState("");

  const [fullSystemMode, setFullSystemMode] = useState(true);
  const [newTemplateType, setNewTemplateType] = useState("hybrid");

  const latestValues = useRef({
    hasUnsavedChanges: false,
    bom: [],
    lastSavedBom: [],
  });

  useEffect(() => {
    // Only set when loading completes - not on every bom change
    if (loading === false) {
      // Create a deep copy to avoid reference issues
      setLastSavedBom(JSON.parse(JSON.stringify(bom)));
    }
  }, [loading]); // <-- Only depends on loading, not bom

  const hasUnsavedChanges = useMemo(() => {
    // First check lengths as a quick test
    if (lastSavedBom.length !== bom.length) return true;

    // Then do a more precise item-by-item comparison
    return bom.some((item, index) => {
      const savedItem = lastSavedBom[index];
      if (!savedItem) return true;

      // Check key properties that matter for saving
      return (
        item.product.id !== savedItem.product.id ||
        item.quantity !== savedItem.quantity ||
        item.override_margin !== savedItem.override_margin ||
        item.unit_cost_at_time !== savedItem.unit_cost_at_time
      );
    });
  }, [bom, lastSavedBom]);

  useEffect(() => {
    const handleAttemptTabChange = (e) => {
      if (hasUnsavedChanges) {
        // Prevent default tab change
        e.preventDefault();

        // Save routing data for later use after user decision
        setNextRoute(e.detail);

        // Show the modal
        setShowUnsavedModal(true);
      } else {
        e.detail.actuallyChangeTab(e.detail.newTab);
      }
    };

    // Add event listener
    window.addEventListener("attempt-tab-change", handleAttemptTabChange);

    // Cleanup function
    return () => {
      window.removeEventListener("attempt-tab-change", handleAttemptTabChange);
    };
  }, [hasUnsavedChanges]); // Include hasUnsavedChanges in dependencies

  // Soft refresh: refetch products and patch product objects into existing BOM rows
  const softRefreshProducts = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/products`);
      const prods = (res.data || []).map((p) => ({
        ...p,
        originalCategory: p.category,
        category: slugify(p.category), // ← use same transform as initial load
      }));
      setProducts(prods);

      setBom((prev) =>
        prev.map((r) => {
          const updated = prods.find((p) => p.id === r.product.id);
          if (!updated) return r;
          // keep manual override if present; otherwise use live product pricing
          const keepManual =
            r.unit_cost_at_time != null ? r.unit_cost_at_time : null;
          return { ...r, product: updated, unit_cost_at_time: keepManual };
        })
      );
    } catch (e) {
      console.error("softRefreshProducts failed", e);
    }
  };

  // Persist only for this project
  useEffect(() => {
    if (!projectId) return;
    try {
      localStorage.setItem(
        `bomFullSystemMode_project_${projectId}`,
        fullSystemMode
      );
    } catch {}
  }, [fullSystemMode, projectId]);

  const coreLocked = (cat) =>
    quoteContext?.docId ? true : fullSystemMode && isCore(cat);

  // ---- Load project + products + BOM (simple flow) ----
  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const [prodRes, projRes] = await Promise.all([
          axios.get(`${API_URL}/api/products`),
          axios.get(`${API_URL}/api/projects/${projectId}`),
        ]);
        const prods = (prodRes.data || []).map((p) => ({
          ...p,
          originalCategory: p.category,
          category: slugify(p.category),
        }));
        const proj = projRes.data;
        if (!mounted) return;
        setProducts(prods);
        setProject(proj);

        // decide source
        const hasSaved = proj?.bom_modified === true;
        const hasTemplate = !!(
          proj?.template_id ||
          proj?.template_name ||
          proj?.from_standard_template
        );

        let rows = [];
        if (hasSaved) {
          // load saved rows
          const saved =
            (await axios.get(`${API_URL}/api/projects/${projectId}/bom`))
              .data || [];
          rows = saved
            .map((s) => {
              const prod = prods.find((p) => p.id === s.product_id);
              return prod
                ? {
                    product: prod,
                    quantity: Number(s.quantity) || 1,
                    override_margin: s.override_margin ?? null,
                    unit_cost_at_time: s.unit_cost_at_time ?? null,
                  }
                : null;
            })
            .filter(Boolean);
          // overlay latest core from SystemDesign
          rows = overlayCore(rows, proj, prods);
        } else if (hasTemplate) {
          // fetch template (by id or name), map extras, overlay core
          let tmpl = null;
          if (proj.template_id) {
            try {
              tmpl = (
                await axios.get(
                  `${API_URL}/api/system_templates/${proj.template_id}`
                )
              ).data;
            } catch {}
          }
          if (!tmpl && proj.template_name) {
            try {
              const list =
                (await axios.get(`${API_URL}/api/system_templates`)).data || [];
              const match = list.find(
                (t) =>
                  (t.name || "").toLowerCase().trim() ===
                  proj.template_name?.toLowerCase().trim()
              );
              if (match)
                tmpl = (
                  await axios.get(`${API_URL}/api/system_templates/${match.id}`)
                ).data;
            } catch {}
          }
          rows = mapTemplate(tmpl, prods);
          rows = overlayCore(rows, proj, prods);
        } else {
          // core only
          rows = overlayCore([], proj, prods);
        }
        if (!mounted) return;
        setBom(rows);
      } catch (e) {
        console.error(e);
        showNotification("Failed to load Bill of Materials", "danger");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [projectId, showNotification, quoteContext?.docId]);

  // Softly apply SystemDesign changes without nuking unsaved BOM edits
  const softRefreshProject = async () => {
    try {
      const projRes = await axios.get(`${API_URL}/api/projects/${projectId}`);
      const proj = projRes.data;
      setProject(proj);

      // we already have up-to-date products in state most of the time; if empty, fetch
      let prods = products;
      if (!Array.isArray(prods) || !prods.length) {
        const res = await axios.get(`${API_URL}/api/products`);
        prods = (res.data || []).map((p) => ({
          ...p,
          originalCategory: p.category,
          category: slugify(p.category),
        }));
        setProducts(prods);
      }

      setBom((prev) => {
        // start from existing rows but strip ONLY the three core categories
        let out = prev.filter(
          (x) => !["panel", "inverter", "battery"].includes(x.product?.category)
        );

        // Panels
        if (proj?.panel_id) {
          const prod = prods.find((p) => p.id === proj.panel_id);
          if (prod) {
            const was = prev.find((x) => x.product?.id === prod.id);
            const qty = Number(proj.num_panels) || 1;
            out.push({
              product: prod,
              quantity: qty,
              override_margin: was?.override_margin ?? null,
              unit_cost_at_time: was?.unit_cost_at_time ?? null,
            });
          }
        }

        // Inverters
        if (Array.isArray(proj?.inverter_ids) && proj.inverter_ids.length) {
          const qtyFirst = Number(proj?.inverter_kva?.quantity) || 1;
          proj.inverter_ids.forEach((id, idx) => {
            const prod = prods.find((p) => p.id === id);
            if (prod) {
              const was = prev.find((x) => x.product?.id === id);
              out.push({
                product: prod,
                quantity: idx === 0 ? qtyFirst : 1,
                override_margin: was?.override_margin ?? null,
                unit_cost_at_time: was?.unit_cost_at_time ?? null,
              });
            }
          });
        }

        // Batteries
        if (Array.isArray(proj?.battery_ids) && proj.battery_ids.length) {
          const qtyFirst = Number(proj?.battery_kwh?.quantity) || 1;
          proj.battery_ids.forEach((id, idx) => {
            const prod = prods.find((p) => p.id === id);
            if (prod) {
              const was = prev.find((x) => x.product?.id === id);
              out.push({
                product: prod,
                quantity: idx === 0 ? qtyFirst : 1,
                override_margin: was?.override_margin ?? null,
                unit_cost_at_time: was?.unit_cost_at_time ?? null,
              });
            }
          });
        }

        return out;
      });
    } catch (e) {
      console.error("softRefreshProject failed", e);
    }
  };

  // listener block websocket
  useEffect(() => {
    const onProject = () => softRefreshProject(); // ← no liveTick bump
    const onProducts = () => softRefreshProducts(); // ← keep prices/products fresh
    window.addEventListener("refresh-project", onProject);
    window.addEventListener("refresh-products", onProducts);
    return () => {
      window.removeEventListener("refresh-project", onProject);
      window.removeEventListener("refresh-products", onProducts);
    };
  }, [projectId, products]); // products in deps is fine; handlers are stable closures

  /* ---------- Overlay core (panels / inverters / batteries) ---------- */
  const overlayCore = (items, proj, prods) => {
    let out = [...items];

    // PANELS
    if (proj?.panel_id) {
      const prod = prods.find((p) => p.id === proj.panel_id);
      if (prod) {
        const keepMargin =
          out.find((x) => x.product?.id === prod.id)?.override_margin ?? null;
        out = out.filter((x) => x.product?.category !== "panel");
        const qty = Number(proj.num_panels) || 1;
        out.push({
          product: prod,
          quantity: qty,
          override_margin: keepMargin,
          unit_cost_at_time:
            out.find((x) => x.product?.id === prod.id)?.unit_cost_at_time ??
            null,
        });
      }
    }

    // INVERTERS
    if (Array.isArray(proj?.inverter_ids) && proj.inverter_ids.length) {
      const qtyFirst = Number(proj?.inverter_kva?.quantity) || 1;
      const existing = out.filter((x) => x.product?.category === "inverter");
      out = out.filter((x) => x.product?.category !== "inverter");
      proj.inverter_ids.forEach((id, idx) => {
        const prod = prods.find((p) => p.id === id);
        if (prod) {
          const keep =
            existing.find((e) => e.product?.id === id)?.override_margin ?? null;
          out.push({
            product: prod,
            quantity: idx === 0 ? qtyFirst : 1,
            override_margin: keep,
            unit_cost_at_time:
              existing.find((e) => e.product?.id === id)?.unit_cost_at_time ??
              null,
          });
        }
      });
    }

    // BATTERIES
    if (Array.isArray(proj?.battery_ids) && proj.battery_ids.length) {
      const qtyFirst = Number(proj?.battery_kwh?.quantity) || 1;
      const existing = out.filter((x) => x.product?.category === "battery");
      out = out.filter((x) => x.product?.category !== "battery");
      proj.battery_ids.forEach((id, idx) => {
        const prod = prods.find((p) => p.id === id);
        if (prod) {
          const keep =
            existing.find((e) => e.product?.id === id)?.override_margin ?? null;
          out.push({
            product: prod,
            quantity: idx === 0 ? qtyFirst : 1,
            override_margin: keep,
            unit_cost_at_time:
              existing.find((e) => e.product?.id === id)?.unit_cost_at_time ??
              null,
          });
        }
      });
    }

    return out;
  };

  const mapTemplate = (template, prods) => {
    if (!template) return [];
    return (template.components || [])
      .map((c) => {
        const prod = prods.find((p) => p.id === c.product_id);
        return prod
          ? {
              product: prod,
              quantity: Number(c.quantity) || 1,
              override_margin: null,
              unit_cost_at_time: null,
            }
          : null;
      })
      .filter(Boolean);
  };

  /* ---------- Item operations ---------- */
  const addItem = (product) => {
    const existing = bom.find((r) => r.product.id === product.id);
    if (existing)
      return updateQty(product.id, Number(existing.quantity || 1) + 1);
    const next = [
      ...bom,
      { product, quantity: 1, override_margin: null, unit_cost_at_time: null },
    ];
    setBom(next);
  };
  const removeItem = (pid) => {
    const target = bom.find((r) => r.product.id === pid);
    if (target && coreLocked(target.product.category))
      return showNotification(
        "Core components are managed in System Design",
        "warning"
      );
    setBom(bom.filter((r) => r.product.id !== pid));
  };
  const updateQty = (pid, q) => {
    const target = bom.find((r) => r.product.id === pid);
    if (target && coreLocked(target.product.category))
      return showNotification(
        "Core quantities are managed in System Design",
        "warning"
      );
    const qty = Math.max(1, parseInt(q || 1, 10));
    setBom(
      bom.map((r) => (r.product.id === pid ? { ...r, quantity: qty } : r))
    );
  };
  const updateMarginPct = (pid, pctStr) => {
    const pct = pctStr === "" ? "" : Math.max(0, Number(pctStr) || 0);
    setBom(
      bom.map((r) =>
        r.product.id === pid
          ? { ...r, override_margin: pct === "" ? "" : pct / 100 }
          : r
      )
    );
  };
  const normalizeMargin = (pid) => {
    setBom(
      bom.map((r) =>
        r.product.id === pid
          ? {
              ...r,
              override_margin:
                r.override_margin === "" || r.override_margin == null
                  ? null
                  : Math.max(0, Number(r.override_margin)),
            }
          : r
      )
    );
  };

  /* ---------- Unit cost editing (Component Quote Mode) ---------- */
  const updateUnitCostInput = (pid, val) => {
    setEditingCosts((prev) => ({ ...prev, [pid]: val }));
  };
  const commitUnitCost = (pid) => {
    const val = editingCosts[pid];
    const next = bom.map((r) =>
      r.product.id === pid
        ? {
            ...r,
            unit_cost_at_time:
              val === "" || val == null ? null : Math.max(0, Number(val)),
            // Invalidate locked price if user manually changed cost
            price_at_time: r.price_at_time,
          }
        : r
    );
    setBom(next);
    setEditingCosts((prev) => {
      const n = { ...prev };
      delete n[pid];
      return n;
    });
  };

  /* ---------- Save / Quote ---------- */
  const saveBOM = async () => {
    try {
      // Merge any in-progress unit cost edits before saving
      const merged = bom.map((r) =>
        editingCosts[r.product.id] !== undefined
          ? {
              ...r,
              unit_cost_at_time:
                editingCosts[r.product.id] === "" ||
                editingCosts[r.product.id] == null
                  ? null
                  : Math.max(0, Number(editingCosts[r.product.id])),
            }
          : r
      );
      if (Object.keys(editingCosts).length) setBom(merged);

      const components = merged.map((r) => ({
        product_id: r.product.id,
        quantity: Math.max(1, Number(r.quantity) || 1),
        override_margin: r.override_margin ?? null,
        unit_cost_at_time: r.unit_cost_at_time ?? null, // keep any manual edits later if you add UI
      }));
      await axios.post(`${API_URL}/api/projects/${projectId}/bom`, {
        project_id: projectId,
        components,
      });

      await axios.put(`${API_URL}/api/projects/${projectId}`, {
        project_value_excl_vat: totals.subtotal,
      });

      const savedCopy = JSON.parse(JSON.stringify(merged));
      setLastSavedBom(savedCopy);

      showNotification("BOM saved", "success");
      return true;
    } catch (e) {
      console.error(e);
      showNotification("Failed to save BOM", "danger");
      return false;
    }
  };

  const [creatingQuote, setCreatingQuote] = useState(false);
  // Save-as-template UI state
  const [showSaveTemplateModal, setShowSaveTemplateModal] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState("");
  const [newTemplateDesc, setNewTemplateDesc] = useState("");
  const [savingTemplate, setSavingTemplate] = useState(false);
  // Per-row unit cost inline edits (component quote mode)
  const [editingCosts, setEditingCosts] = useState({});
  const createQuote = async () => {
    if (!bom.length)
      return showNotification("Add items to the BOM first", "warning");
    setCreatingQuote(true);
    try {
      await saveBOM();
      const res = await axios.post(
        `${API_URL}/api/projects/${projectId}/quotes`,
        { tz: "Africa/Johannesburg" }
      );
      const docId = res.data?.document?.id;
      showNotification("Quote created", "success");
      if (docId)
        window.location.href = `/projects/${projectId}/quotes/${docId}`;
    } catch (e) {
      console.error(e);
      showNotification("Failed to create quote", "danger");
    } finally {
      setCreatingQuote(false);
    }
  };

  // Save as Template
  const saveAsTemplate = async () => {
    if (!newTemplateName.trim())
      return showNotification("Give the template a name", "warning");
    setSavingTemplate(true);
    try {
      const payload = {
        name: newTemplateName.trim(),
        description: newTemplateDesc.trim(),
        system_type: newTemplateType,
        components: bom.map((r) => ({
          product_id: r.product.id,
          quantity: Math.max(1, Number(r.quantity) || 1),
        })),
      };
      console.log("Saving template", payload);
      await axios.post(`${API_URL}/api/system_templates`, payload);
      setShowSaveTemplateModal(false);
      setNewTemplateName("");
      setNewTemplateDesc("");
      setNewTemplateType("hybrid");
      showNotification("Template saved", "success");
    } catch (e) {
      console.error(e);
      showNotification("Failed to save template", "danger");
    } finally {
      setSavingTemplate(false);
    }
  };

  const openSaveTemplateModal = () => {
    let guessedType = "hybrid";

    if (project?.system_type) {
      guessedType = project.system_type;
    } else if (bom.some((item) => item.product?.category === "battery")) {
      guessedType = "hybrid";
    } else {
      guessedType = "grid";
    }

    setNewTemplateType(guessedType);
    setShowSaveTemplateModal(true);
  };

  /* ---------- Derived ---------- */
  const systemSpecs = useMemo(() => {
    let panelW = 0,
      inverterKva = 0,
      batteryKwh = 0;
    const list = Array.isArray(bom) ? bom : [];
    list.forEach((c) => {
      const cat = c.product.category;
      if (cat === "panel" && c.product.power_w) {
        panelW += (Number(c.product.power_w) || 0) * (Number(c.quantity) || 0);
      } else if (cat === "inverter" && c.product.rating_kva) {
        inverterKva +=
          (Number(c.product.rating_kva) || 0) * (Number(c.quantity) || 0);
      } else if (cat === "battery" && c.product.capacity_kwh) {
        batteryKwh +=
          (Number(c.product.capacity_kwh) || 0) * (Number(c.quantity) || 0);
      }
    });
    return {
      panelKw: (panelW / 1000).toFixed(2),
      inverterKva: inverterKva.toFixed(2),
      batteryKwh: batteryKwh.toFixed(2),
    };
  }, [bom]);

  const totals = useMemo(() => {
    const subtotal = bom.reduce(
      (s, r) => s + rowUnitPrice(r) * (Number(r.quantity) || 0),
      0
    );
    const vat_perc = 15;
    const vat_price = (subtotal * vat_perc) / 100;
    const total = subtotal + vat_price;

    const total_cost = bom.reduce(
      (s, r) => s + rowCost(r) * (Number(r.quantity) || 0),
      0
    );
    const total_markup = subtotal - total_cost;

    return { subtotal, total_cost, vat_perc, vat_price, total, total_markup };
  }, [bom]);

  // Fuzzy search index for BOM items (memoized)
  const bomFuse = useMemo(() => {
    if (!bom?.length) return null;
    return new Fuse(bom, {
      includeScore: true,
      threshold: 0.45,
      ignoreLocation: true,
      useExtendedSearch: true,
      keys: [
        { name: "product.brand", weight: 2 },
        { name: "product.model", weight: 2 },
        { name: "product.brand_name", weight: 1.5 },
        { name: "product.description", weight: 1 },
        { name: "product.notes", weight: 0.5 },
        { name: "product.originalCategory", weight: 0.5 },
        { name: "product.category", weight: 0.5 },
        { name: "product.component_type", weight: 0.5 },
        { name: "product.power_w", weight: 0.3 },
        { name: "product.rating_kva", weight: 0.3 },
        { name: "product.capacity_kwh", weight: 0.3 },
      ].filter(Boolean),
    });
  }, [bom]);

  const bomFiltered = useMemo(() => {
    const term = bomSearch.trim();
    if (!term) return bom;

    const words = term.split(/\s+/).filter(Boolean);
    let result = [];
    if (bomFuse && words.length) {
      try {
        let current = bom;
        for (const w of words) {
          const pattern = w.length <= 2 ? `=${w}` : w;
          const localFuse = new Fuse(current, bomFuse.options);
          const partial = localFuse.search(pattern);
          current = partial.map((r) => r.item);
          if (!current.length) break;
        }
        result = current;
        if (!result.length) {
          const broad = bomFuse.search(term).map((r) => r.item);
          result = broad;
        }
      } catch (e) {
        const q = term.toLowerCase();
        result = bom.filter((r) =>
          `${r.product.brand} ${r.product.model} ${r.product.description || ""}`
            .toLowerCase()
            .includes(q)
        );
      }
    }
    return result.length ? result : bom;
  }, [bom, bomSearch, bomFuse]);

  const groupedFiltered = useMemo(() => {
    const g = {};
    bomFiltered.forEach((r) => {
      const cat = r.product.category || "other";
      if (!g[cat]) g[cat] = [];
      g[cat].push(r);
    });
    return g;
  }, [bomFiltered]);

  const sortedCatsFiltered = useMemo(() => {
    const all = Object.keys(groupedFiltered);
    return all.sort((a, b) => {
      const ia = PRIORITY.indexOf(a),
        ib = PRIORITY.indexOf(b);
      if (ia !== -1 && ib !== -1) return ia - ib;
      if (ia !== -1) return -1;
      if (ib !== -1) return 1;
      const an = CATEGORY_META[a]?.name || a;
      const bn = CATEGORY_META[b]?.name || b;
      return an.localeCompare(bn);
    });
  }, [groupedFiltered]);

  // Fuzzy search index (memoized)
  const fuse = useMemo(() => {
    if (!products?.length) return null;
    return new Fuse(products, {
      includeScore: true,
      threshold: 0.45, // balance between strict & forgiving
      ignoreLocation: true,
      useExtendedSearch: true,
      keys: [
        { name: "brand", weight: 2 },
        { name: "model", weight: 2 },
        { name: "brand_name", weight: 1.5 },
        { name: "description", weight: 1 },
        { name: "notes", weight: 0.5 },
        { name: "originalCategory", weight: 0.5 },
        { name: "category", weight: 0.5 },
        { name: "component_type", weight: 0.5 },
        // numeric-ish fields converted to string matching
        { name: "power_w", weight: 0.3 },
        { name: "rating_kva", weight: 0.3 },
        { name: "capacity_kwh", weight: 0.3 },
        "properties.manufacturer",
        "properties.series",
        "properties.type",
        "properties.variant",
      ].filter(Boolean),
    });
  }, [products]);

  const productsFiltered = useMemo(() => {
    let base = products;
    if (category !== "all") base = base.filter((p) => p.category === category);

    const term = search.trim();
    if (!term) return base;

    // Allow users to type messy combos like "victron 5kva multiplus battery".
    // Strategy: split on spaces, require all words appear (AND) using extended search, fallback to broad fuzz if that yields nothing.
    const words = term.split(/\s+/).filter(Boolean);
    let result = [];
    if (fuse && words.length) {
      try {
        // Build extended search pattern: all words must match somewhere: `'word1 | word2` is OR, we want AND semantics -> chain separate searches intersection.
        // We'll run sequential filtering to approximate AND.
        let current = base;
        for (const w of words) {
          const pattern = w.length <= 2 ? `=${w}` : w; // short tokens: exact match mode
          const localFuse = new Fuse(current, fuse.options);
          const partial = localFuse.search(pattern);
          current = partial.map((r) => r.item);
          if (!current.length) break;
        }
        result = current;
        // If AND chain produced nothing, fallback to single fuzzy search on full phrase
        if (!result.length) {
          const broad = fuse.search(term).map((r) => r.item);
          result = broad;
        }
      } catch (e) {
        // On any error, fallback simple contains filter
        const q = term.toLowerCase();
        result = base.filter((p) =>
          `${p.brand} ${p.model} ${p.description || ""}`
            .toLowerCase()
            .includes(q)
        );
      }
    }
    // Maintain original ordering preference: prioritized score then original index
    if (result.length) return result;
    return base;
  }, [products, category, search, fuse]);

  /* ---------- UI ---------- */
  if (loading) {
    return (
      <div className="text-center py-5">
        <Spinner animation="border" />
        <div className="mt-2">Loading bill of materials…</div>
      </div>
    );
  }

  return (
    <div>
      <Container fluid>
        <Row className="mb-3">
          <Col>
            <div className="bom-toolbar-wrapper d-flex flex-column flex-xl-row gap-3 align-items-stretch align-items-xl-center justify-content-between">
              <div className="bom-heading flex-grow-1">
                <h4 className="mb-1 d-flex align-items-center fw-semibold">
                  <i className="bi bi-basket3 me-2 text-primary" />
                  Bill of Materials
                </h4>
                <div className="small text-muted d-flex flex-wrap align-items-center gap-2">
                  <span>
                    Project: <strong>{project?.name}</strong>
                  </span>
                  {project?.template_id || project?.template_name ? (
                    <Badge bg="secondary" className="rounded-pill px-2 py-1">
                      Standard: {project?.template_name || "Template"}
                    </Badge>
                  ) : null}
                </div>
              </div>

              <div className="bom-toolbar d-flex flex-wrap align-items-center gap-2">
                <div className="mode-switch card shadow-sm border-0 px-3 py-2 d-flex align-items-center">
                  <Form.Check
                    type="switch"
                    id="bom-mode-switch"
                    label={
                      coreLocked("panel")
                        ? "Input from System Design"
                        : "Single Quote"
                    }
                    checked={fullSystemMode}
                    onChange={() => setFullSystemMode((v) => !v)}
                    disabled={!!quoteContext?.docId}
                  />
                </div>

                <Button
                  variant="success"
                  className="bom-btn shadow-sm"
                  onClick={saveBOM}
                >
                  <i className="bi bi-check2-circle me-1" /> Save BOM
                </Button>

                <Button
                  variant="outline-secondary"
                  className="bom-btn shadow-sm"
                  onClick={openSaveTemplateModal}
                  disabled={!bom.length || savingTemplate}
                >
                  <i className="bi bi-save me-1" /> Save Template
                </Button>

                {!quoteContext?.docId && (
                  <Button
                    variant="primary"
                    className="bom-btn shadow-sm bom-generate-btn"
                    onClick={createQuote}
                    disabled={!bom.length || creatingQuote}
                  >
                    <i className="bi bi-file-earmark-plus me-1" />{" "}
                    {creatingQuote ? "Generating…" : "Generate Quote"}
                  </Button>
                )}
              </div>
            </div>
          </Col>
        </Row>

        {quoteContext?.docId && (
          <Row>
            <Col>
              <Alert
                variant="info"
                className="d-flex justify-content-between align-items-center"
              >
                <div>
                  Editing{" "}
                  <b>{quoteContext.number || `quote #${quoteContext.docId}`}</b>
                  . Core components are locked.
                </div>
                {/* Keep the "Save as New Version" button handled elsewhere in your app if needed */}
              </Alert>
            </Col>
          </Row>
        )}

        <Row>
          {/* Left: Product browser */}
          <Col lg={6}>
            <div
              style={{
                position: "sticky",
                top: "max(20px, calc(50vh - 40vh))",
                zIndex: 1000,
                maxHeight: "95vh",
                overflow: "visible",
              }}
            >
              <Card className="shadow-sm mb-4">
                <Card.Header as="h5" className="py-2">
                  <i className="bi bi-list-ul me-2" /> Add Components
                </Card.Header>
                <Card.Body className="p-2">
                  <Row className="mb-2">
                    <Col md={6}>
                      <InputGroup size="sm">
                        <InputGroup.Text className="py-0">
                          <i className="bi bi-search" />
                        </InputGroup.Text>
                        <Form.Control
                          size="sm"
                          placeholder="Search products…"
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                        />
                      </InputGroup>
                    </Col>
                    <Col md={6}>
                      <Form.Select
                        size="sm"
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                      >
                        <option value="all">All categories</option>
                        {Object.keys(CATEGORY_META).map((k) => (
                          <option key={k} value={k}>
                            {CATEGORY_META[k].name}
                          </option>
                        ))}
                      </Form.Select>
                    </Col>
                  </Row>

                  <div
                    className="table-responsive"
                    style={{ maxHeight: 400, overflowY: "auto" }}
                  >
                    <Table hover size="sm" className="align-middle small">
                      <thead className="table-light">
                        <tr>
                          <th>Product</th>
                          <th>Updated</th>
                          <th>Specs</th>
                          <th className="text-end">Price</th>
                          <th className="text-center" style={{ width: 100 }}>
                            Add
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {productsFiltered.map((product) => {
                          const existing = bom.find(
                            (r) => r.product.id === product.id
                          );
                          const spec =
                            (product.category === "panel" &&
                              product.power_w && (
                                <Badge
                                  bg="warning"
                                  text="dark"
                                  className="small"
                                >
                                  {Number(product.power_w).toFixed(0)}W
                                </Badge>
                              )) ||
                            (product.category === "inverter" &&
                              product.rating_kva && (
                                <Badge bg="info" className="small">
                                  {product.rating_kva}kVA
                                </Badge>
                              )) ||
                            (product.category === "battery" &&
                              product.capacity_kwh && (
                                <Badge bg="success" className="small">
                                  {product.capacity_kwh}kWh
                                </Badge>
                              )) ||
                            null;
                          return (
                            <tr key={product.id}>
                              <td>
                                <div className="fw-medium small">
                                  {product.brand} {product.model}
                                </div>
                                <div
                                  className="text-muted"
                                  style={{ fontSize: "0.75rem" }}
                                >
                                  {CATEGORY_META[product.category]?.name ||
                                    product.originalCategory ||
                                    product.category}
                                </div>
                              </td>
                              <td>
                                <div className="d-flex flex-column">
                                  <small className="text-muted">
                                    {product.updated_at
                                      ? new Date(
                                          product.updated_at
                                        ).toLocaleDateString("en-GB")
                                      : "—"}
                                  </small>
                                  {product.updated_by && (
                                    <small
                                      className="text-muted"
                                      style={{ fontSize: "0.6rem" }}
                                    >
                                      {product.updated_by}
                                    </small>
                                  )}
                                </div>
                              </td>
                              <td>{spec}</td>
                              <td className="text-end small">
                                {fmt(rowUnitPrice({ product }))}
                              </td>
                              <td className="text-center">
                                {existing ? (
                                  <ButtonGroup size="sm">
                                    <Button
                                      variant="outline-secondary"
                                      size="sm"
                                      className="py-0 px-1"
                                      onClick={() =>
                                        updateQty(
                                          product.id,
                                          Math.max(
                                            1,
                                            Number(existing.quantity) - 1
                                          )
                                        )
                                      }
                                      disabled={coreLocked(product.category)}
                                    >
                                      -
                                    </Button>
                                    <Button
                                      variant="outline-secondary"
                                      size="sm"
                                      className="py-0 px-1"
                                      disabled
                                    >
                                      {Number(existing.quantity) || 1}
                                    </Button>
                                    <Button
                                      variant="outline-secondary"
                                      size="sm"
                                      className="py-0 px-1"
                                      onClick={() =>
                                        updateQty(
                                          product.id,
                                          Number(existing.quantity) + 1
                                        )
                                      }
                                      disabled={coreLocked(product.category)}
                                    >
                                      +
                                    </Button>
                                  </ButtonGroup>
                                ) : (
                                  <Button
                                    variant="outline-primary"
                                    size="sm"
                                    className="py-0"
                                    onClick={() => addItem(product)}
                                  >
                                    <i className="bi bi-plus-lg" /> Add
                                  </Button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                        {productsFiltered.length === 0 && (
                          <tr>
                            <td colSpan="4" className="text-center text-muted">
                              No products match your search.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </Table>
                  </div>
                </Card.Body>
              </Card>
            </div>
          </Col>

          {/* Right: BOM */}
          <Col lg={6}>
            <Card className="shadow-sm mb-4">
              <Card.Header
                as="h5"
                className="d-flex justify-content-between align-items-center"
              >
                <div>
                  <i className="bi bi-clipboard-check me-2" /> Your BOM (
                  {bomFiltered.length} of {bom.length} items)
                </div>
                {bom.length > 0 && (
                  <div style={{ width: "200px" }}>
                    <InputGroup size="sm">
                      <InputGroup.Text className="py-0">
                        <i className="bi bi-search" />
                      </InputGroup.Text>
                      <Form.Control
                        size="sm"
                        placeholder="Search BOM..."
                        value={bomSearch}
                        onChange={(e) => setBomSearch(e.target.value)}
                      />
                    </InputGroup>
                  </div>
                )}
              </Card.Header>
              <Card.Body>
                {!bom.length ? (
                  <div className="text-muted">
                    Add components on the left to build your BOM.
                  </div>
                ) : !bomFiltered.length ? (
                  <div className="text-muted text-center py-3">
                    <i className="bi bi-search me-2"></i>
                    No items match your search "{bomSearch}".
                  </div>
                ) : (
                  <div className="table-responsive">
                    <Table hover size="sm" className="align-middle">
                      <thead className="table-light">
                        <tr>
                          <th>Product</th>
                          <th className="text-end" style={{ width: 90 }}>
                            Unit Cost
                          </th>
                          <th style={{ width: 100 }}>Margin</th>
                          <th style={{ width: 90 }}>Qty</th>
                          <th className="text-end" style={{ width: 100 }}>
                            Total
                          </th>
                          <th style={{ width: 40 }} />
                        </tr>
                      </thead>
                      <tbody>
                        {sortedCatsFiltered.map((cat) => (
                          <React.Fragment key={cat}>
                            <tr className="table-light">
                              <td colSpan={4} className="py-1">
                                <div className="fw-semibold">
                                  <i
                                    className={`bi ${CATEGORY_META[cat]?.icon || "bi-box"} me-1`}
                                  />
                                  {CATEGORY_META[cat]?.name ||
                                    groupedFiltered[cat][0]?.product
                                      ?.originalCategory ||
                                    cat}
                                </div>
                              </td>
                              <td className="py-1 text-end fw-semibold">
                                {fmt(
                                  groupedFiltered[cat].reduce(
                                    (s, r) =>
                                      s +
                                      rowUnitPrice(r) *
                                        (Number(r.quantity) || 0),
                                    0
                                  )
                                )}
                              </td>
                              <td />
                            </tr>
                            {groupedFiltered[cat].map((r) => {
                              const unit = rowUnitPrice(r);
                              const unitCost = rowCost(r);
                              const line = unit * (Number(r.quantity) || 0);
                              const marginPct =
                                r.override_margin == null ||
                                r.override_margin === ""
                                  ? Math.round(
                                      ((Number(r.product?.margin) ||
                                        DEFAULT_MARGIN) <= 1
                                        ? Number(r.product?.margin) ||
                                          DEFAULT_MARGIN
                                        : Number(r.product?.margin) / 100) * 100
                                    )
                                  : Math.round(Number(r.override_margin) * 100);
                              return (
                                <tr key={r.product.id}>
                                  <td>
                                    <div className="d-flex align-items-center justify-content-between">
                                      <div className="small fw-small">
                                        {r.product.brand} {r.product.model}
                                      </div>
                                      {coreLocked(r.product.category) && (
                                        <Badge
                                          bg="info"
                                          className="ms-2"
                                          title="Core component - quantities managed in System Design"
                                        >
                                          <i
                                            className="bi bi-gear-fill"
                                            style={{ fontSize: "0.75em" }}
                                          ></i>
                                        </Badge>
                                      )}
                                    </div>
                                  </td>
                                  <td className="text-end small">
                                    {fullSystemMode ? (
                                      fmt(unitCost)
                                    ) : (
                                      <Form.Control
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        style={{
                                          minWidth: 90,
                                          maxWidth: 110,
                                          fontSize: "0.85rem",
                                        }}
                                        className="py-0 text-end"
                                        value={
                                          editingCosts[r.product.id] ??
                                          r.unit_cost_at_time ??
                                          r.product.unit_cost ??
                                          0
                                        }
                                        onChange={(e) =>
                                          updateUnitCostInput(
                                            r.product.id,
                                            e.target.value
                                          )
                                        }
                                        onBlur={() =>
                                          commitUnitCost(r.product.id)
                                        }
                                      />
                                    )}
                                  </td>
                                  <td>
                                    <InputGroup size="sm">
                                      <InputGroup.Text className="py-0 px-1">
                                        %
                                      </InputGroup.Text>
                                      <Form.Control
                                        type="number"
                                        min="0"
                                        step="1"
                                        value={
                                          r.override_margin === ""
                                            ? ""
                                            : marginPct
                                        }
                                        onChange={(e) =>
                                          updateMarginPct(
                                            r.product.id,
                                            e.target.value
                                          )
                                        }
                                        onBlur={() =>
                                          normalizeMargin(r.product.id)
                                        }
                                        className="py-0"
                                      />
                                    </InputGroup>
                                  </td>
                                  <td>
                                    <InputGroup size="sm">
                                      <Form.Control
                                        type="number"
                                        min="1"
                                        value={r.quantity}
                                        onChange={(e) =>
                                          updateQty(
                                            r.product.id,
                                            e.target.value
                                          )
                                        }
                                        className="py-0"
                                        disabled={coreLocked(
                                          r.product.category
                                        )}
                                      />
                                    </InputGroup>
                                  </td>
                                  <td className="text-end small">
                                    {fmt(line)}
                                  </td>
                                  <td className="text-end">
                                    <Button
                                      variant="outline-danger"
                                      size="sm"
                                      className="py-0 px-1"
                                      onClick={() => removeItem(r.product.id)}
                                      disabled={coreLocked(r.product.category)}
                                    >
                                      <i className="bi bi-trash" />
                                    </Button>
                                  </td>
                                </tr>
                              );
                            })}
                          </React.Fragment>
                        ))}

                        {/* Totals */}
                        <tr className="border-top border-dark">
                          <td
                            className="fw-semibold"
                            style={{ whiteSpace: "nowrap" }}
                          >
                            Cost: {fmt(totals.total_cost)}
                          </td>
                          <td
                            colSpan={3}
                            className="text-end fw-semibold"
                            style={{ whiteSpace: "nowrap" }}
                          >
                            Subtotal (excl. VAT):
                          </td>
                          <td
                            className="text-end fw-semibold"
                            style={{ whiteSpace: "nowrap" }}
                          >
                            {fmt(totals.subtotal)}
                          </td>
                          <td />
                        </tr>
                        <tr>
                          <td></td>
                          <td
                            colSpan={3}
                            className="text-end fw-semibold"
                            style={{ whiteSpace: "nowrap" }}
                          >
                            {totals.vat_perc}% VAT:
                          </td>
                          <td
                            className="text-end fw-semibold"
                            style={{ whiteSpace: "nowrap" }}
                          >
                            {fmt(totals.vat_price)}
                          </td>
                          <td />
                        </tr>
                        <tr className="border-top border-dark">
                          <td
                            className="fw-semibold"
                            style={{ whiteSpace: "nowrap" }}
                          >
                            Markup: {fmt(totals.total_markup)}
                          </td>
                          <td
                            colSpan={3}
                            className="text-end fw-bold"
                            style={{ whiteSpace: "nowrap" }}
                          >
                            Total (incl. VAT):
                          </td>
                          <td
                            className="text-end fw-bold"
                            style={{ whiteSpace: "nowrap" }}
                          >
                            {fmt(totals.total)}
                          </td>
                          <td />
                        </tr>
                      </tbody>
                    </Table>
                  </div>
                )}
              </Card.Body>
            </Card>
            <Card className="shadow-sm">
              <Card.Header as="h5">
                <i className="bi bi-info-circle me-2" />
                System Specifications
              </Card.Header>
              <Card.Body>
                <Row>
                  <Col sm={3} className="mb-3 text-center">
                    <div className="small text-muted">PV Size</div>
                    <div className="fs-6 fw-bold text-warning">
                      {systemSpecs.panelKw} <small>kWp</small>
                    </div>
                  </Col>
                  <Col sm={3} className="mb-3 text-center">
                    <div className="small text-muted">Inverter</div>
                    <div className="fs-6 fw-bold text-info">
                      {systemSpecs.inverterKva} <small>kVA</small>
                    </div>
                  </Col>
                  <Col sm={3} className="mb-3 text-center">
                    <div className="small text-muted">Battery</div>
                    <div className="fs-6 fw-bold text-success">
                      {systemSpecs.batteryKwh} <small>kWh</small>
                    </div>
                  </Col>
                  <Col sm={3} className="mb-3 text-center">
                    <div className="small text-muted">Cost per kWp</div>
                    <div className="fs-6 fw-bold text-success">
                      {systemSpecs.panelKw > 0
                        ? fmt(totals.subtotal / systemSpecs.panelKw)
                        : 10}
                      <small>/kWp</small>
                    </div>
                  </Col>
                </Row>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      </Container>

      {/* Placeholder modal kept for future (e.g., save as template) */}
      <Modal
        show={showSaveTemplateModal}
        onHide={() => setShowSaveTemplateModal(false)}
      >
        <Modal.Header closeButton>
          <Modal.Title>Save as System Template</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form.Group className="mb-3">
            <Form.Label>Template Name</Form.Label>
            <Form.Control
              type="text"
              value={newTemplateName}
              onChange={(e) => setNewTemplateName(e.target.value)}
              placeholder="e.g., 30kWp Victron 40kWh"
            />
          </Form.Group>

          {/* Add this Form.Group for system type selection */}
          <Form.Group className="mb-3">
            <Form.Label>System Type</Form.Label>
            <Form.Select
              value={newTemplateType}
              onChange={(e) => setNewTemplateType(e.target.value)}
            >
              <option value="hybrid">Hybrid</option>
              <option value="grid">Grid-Tied</option>
              <option value="off-grid">Off-Grid</option>
            </Form.Select>
          </Form.Group>

          <Form.Group>
            <Form.Label>Description</Form.Label>
            <Form.Control
              as="textarea"
              rows={3}
              value={newTemplateDesc}
              onChange={(e) => setNewTemplateDesc(e.target.value)}
              placeholder="Describe this system template…"
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="secondary"
            onClick={() => setShowSaveTemplateModal(false)}
            disabled={savingTemplate}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={saveAsTemplate}
            disabled={savingTemplate || !newTemplateName.trim()}
          >
            {savingTemplate ? (
              <>
                <Spinner
                  as="span"
                  animation="border"
                  size="sm"
                  className="me-2"
                />
                Saving…
              </>
            ) : (
              "Save Template"
            )}
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal
        show={showUnsavedModal}
        onHide={() => setShowUnsavedModal(false)}
        backdrop="static"
        centered
      >
        <Modal.Header closeButton>
          <Modal.Title>Unsaved Changes</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          You have unsaved changes in your Bill of Materials. Would you like to
          save before leaving this page?
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="secondary"
            onClick={() => {
              console.log(
                "Discarding changes and navigating to",
                nextRoute?.newTab
              );
              setShowUnsavedModal(false);
              if (nextRoute) {
                nextRoute.actuallyChangeTab(nextRoute.newTab);
              }
            }}
          >
            Discard Changes
          </Button>
          <Button
            variant="primary"
            onClick={async () => {
              console.log("Saving changes before navigation");
              const success = await saveBOM();
              console.log("Save result:", success);

              setShowUnsavedModal(false);
              if (success && nextRoute) {
                console.log("Navigating after save to", nextRoute.newTab);
                nextRoute.actuallyChangeTab(nextRoute.newTab);
              }
            }}
          >
            Save and Continue
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
