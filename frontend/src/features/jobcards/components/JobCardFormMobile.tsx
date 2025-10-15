// src/features/jobcards/components/JobCardFormMobile.tsx
import React, { useEffect, useMemo, useState, useRef } from "react";
import {
  useForm,
  Controller,
  SubmitHandler,
  SubmitErrorHandler,
} from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  JobCardFormSchema,
  JobCardFormValues,
  jobCardDefaults,
} from "../schemas";
import type {
  JobCard,
  JobCategory,
  JobStatus,
  Vehicle,
  JobCardAttachment,
  Client,
  UserListItem,
} from "../types";
import {
  createClient,
  listCategories,
  listClients,
  listVehicles,
  listClientProjects,
  getAcceptedQuotes,
  getQuoteLineItems,
} from "../api";
import "./jobcard-create.mobile.css";
import ProductPickerModal from "./ProductPickerModal";
import type { Product } from "../types";
import axios from "axios";
import { API_URL } from "../../../apiConfig";
import { useAuth } from "../../../AuthContext";
import { http } from "../api";

/** === utilities for datetime-local <-> ISO === */
const pad = (n: number) => String(n).padStart(2, "0");
const toInputDT = (iso: string | null | undefined) => {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
};
const localToISO = (local: string | null) => {
  if (!local) return null;
  const [d, t] = local.split("T");
  const [y, m, day] = d.split("-").map(Number);
  const [hh, mm] = t.split(":").map(Number);
  return new Date(y, (m ?? 1) - 1, day ?? 1, hh ?? 0, mm ?? 0, 0).toISOString();
};
const normalizeISO = (v: unknown): string | null => {
  if (!v) return null;
  try {
    const d = new Date(String(v));
    return isNaN(d.getTime()) ? null : d.toISOString();
  } catch {
    return null;
  }
};

const statusClass: Record<JobStatus, string> = {
  draft: "secondary",
  scheduled: "info",
  in_progress: "primary",
  paused: "warning",
  completed: "success",
  cancelled: "dark",
  invoiced: "success",
};

type Props = {
  initial?: Partial<JobCard>;
  onSubmit: (values: JobCardFormValues, materialData?: any) => Promise<void>;
  onCancel?: () => void;
  isSubmitting?: boolean;
};

export default function JobCardFormMobile({
  initial,
  onSubmit,
  onCancel,
}: Props) {
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    control,
    getValues,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<JobCardFormValues>({
    resolver: zodResolver(JobCardFormSchema),
    defaultValues: jobCardDefaults,
    mode: "onSubmit",
  });

  const navigate = useNavigate();

  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [clientQuery, setClientQuery] = useState("");
  const [clientOpen, setClientOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [isQuotedJC, setIsQuotedJC] = useState(false);
  const [clientProjects, setClientProjects] = useState<any[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(
    null
  );
  const { user: currentUser } = useAuth();
  const [isCurrentUserBum, setIsCurrentUserBum] = useState<boolean>(false);
  const [bumOptions, setBumOptions] = useState<UserListItem[]>([]);
  const [techOptions, setTechOptions] = useState<UserListItem[]>([]);
  const [acceptedQuotes, setAcceptedQuotes] = useState<any[]>([]);
  const [selectedQuoteId, setSelectedQuoteId] = useState<number | null>(null);
  const [materialFileUploads, setMaterialFileUploads] = useState<
    Record<number, File | null>
  >({});
  const [usedMaterials, setUsedMaterials] = useState<Record<number, boolean>>(
    {}
  );

  type MatLine = {
    product_id: number;
    name: string;
    unit_price: number;
    unit_cost: number;
    qty: number;
    fromQuote?: boolean;
    receiptRequired?: boolean;
    used?: boolean;
  };

  const [sitePhotos, setSitePhotos] = useState<SitePhotoDraft[]>([]);
  const siteFileInputRef = useRef<HTMLInputElement | null>(null);

  type SitePhotoDraft = {
    id?: string;
    file: File;
    preview: string;
    caption: string;
  };

  // hanlde file choose
  const handleSelectSitePhotos = () => siteFileInputRef.current?.click();

  const handleSiteFilesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setSitePhotos((prev) => [
      ...prev,
      ...files.map((f) => ({
        id: crypto.randomUUID(),
        file: f,
        preview: URL.createObjectURL(f),
        caption: "",
      })),
    ]);
    e.target.value = "";
  };

  const updateSiteCaption = (id: string, caption: string) => {
    setSitePhotos((prev) =>
      prev.map((p) => (p.id === id ? { ...p, caption } : p))
    );
  };

  const removeSitePhoto = (id: string) => {
    setSitePhotos((prev) => {
      const ph = prev.find((p) => p.id === id);
      if (ph) URL.revokeObjectURL(ph.preview);
      return prev.filter((p) => p.id !== id);
    });
  };

  // cleanup previews on unmount
  useEffect(
    () => () => {
      sitePhotos.forEach((photo) => URL.revokeObjectURL(photo.preview));
    },
    [sitePhotos]
  );

  // fetch BUMs once
  useEffect(() => {
    (async () => {
      try {
        // Use the pre-configured http client that includes auth headers
        const { data: bumData } = await http.get(
          "/auth/users?is_bum=1&active=1"
        );
        console.log("BUM data:", bumData);
        setBumOptions(bumData);

        // Load technicians
        const { data: techData } = await http.get("/auth/technicians");
        setTechOptions(techData);

        // Check if current user is a BUM
        if (currentUser) {
          const isBum = bumData.some(
            (bumUser: any) => bumUser.id === currentUser.id
          );
          setIsCurrentUserBum(isBum);

          // Set default values based on user role
          if (isBum) {
            setValue("bum_id", currentUser.id, { shouldDirty: true });
          } else {
            setValue("owner_id", currentUser.id, { shouldDirty: true });
          }
        }
      } catch (err) {
        console.error("Failed to load BUMs and Techs:", err);
      }
    })();
  }, [currentUser, setValue]);

  // Effect to detect if current user is bum
  useEffect(() => {
    if (!currentUser) return;

    // Don't override tech selection if it was already done by a BUM
    const technicianAlreadySelected =
      sessionStorage.getItem("technician_selected_by_bum") === "true";

    // Method 1: check if user has is_bum property
    if (currentUser.is_bum) {
      setIsCurrentUserBum(true);
      setValue("bum_id", currentUser.id, { shouldDirty: true });
    } else {
      setValue("owner_id", currentUser.id, { shouldDirty: true });
    }

    // Method 2: Check if user's ID is in the bum options
    if (bumOptions.length > 0) {
      const isBum = bumOptions.some((bumUser) => bumUser.id === currentUser.id);
      setIsCurrentUserBum(isBum);

      // Auto select current user as BUM if they are one
      if (isBum) {
        setValue("bum_id", currentUser.id, { shouldDirty: true });

        // Only set owner_id if no technician was manually selected
        if (!technicianAlreadySelected) {
          // Default owner to current BUM user until they select a technician
          setValue("owner_id", currentUser.id, { shouldDirty: true });
        }
      } else {
        // If not a BUM, set current user as job owner (technician)
        setValue("owner_id", currentUser.id, { shouldDirty: true });
      }
    }
  }, [currentUser, bumOptions, setValue]);

  // Effect to automatically set materials used if isQuoted
  useEffect(() => {
    if (isQuotedJC) {
      setValue("materials_used", true, { shouldDirty: true });
    } else {
      setValue("materials_used", false, { shouldDirty: true });
    }
  }, [isQuotedJC, setValue]);

  useEffect(() => {
    // ensure owner_id in form state for Zod
    if (initial?.owner_id && initial.owner_id > 0) {
      setValue("owner_id", initial.owner_id, { shouldValidate: false });
    }
  }, [initial?.owner_id, setValue]);

  // API CALLS
  useEffect(() => {
    const ac = new AbortController();
    (async () => {
      try {
        const data = await listClients(ac.signal);
        setClients(data);
      } catch (err: any) {
        setError(
          err?.response?.data?.error || err.message || "Failed to load clients"
        );
      } finally {
        setLoading(false);
      }
    })();
    return () => ac.abort();
  }, []);

  // UseEffect to load projects when client changes and isQuoted is selected
  useEffect(() => {
    if (isQuotedJC && selectedClient?.id) {
      const fetchClientProjects = async () => {
        try {
          const projects = await listClientProjects(selectedClient.id);
          setClientProjects(projects);

          // Auto Select if thers only one project
          if (projects.length === 1) {
            setSelectedProjectId(projects[0].id);
          } else {
            setSelectedProjectId(null);
          }
        } catch (err) {
          console.error("Failed to load client projects", err);
        }
      };
      fetchClientProjects();
    } else {
      setClientProjects([]);
      setSelectedProjectId(null);
    }
  }, [selectedClient?.id, isQuotedJC]);

  // UseEffect to update form state when a quote is selected
  useEffect(() => {
    if (selectedQuoteId) {
      setValue("quote_id", selectedQuoteId, { shouldDirty: true });
    }
  }, [selectedQuoteId, setValue]);

  // --------------------------- Functions to fill data ---------------------------------

  // Load accepted quotes when a project is selected
  useEffect(() => {
    if (isQuotedJC && selectedProjectId) {
      const fetchAcceptedQuotes = async () => {
        try {
          const quotes = await getAcceptedQuotes(selectedProjectId);
          setAcceptedQuotes(quotes);

          // Auto-select if only one accepted quote
          if (quotes.length === 1) {
            setSelectedQuoteId(quotes[0].id);
          } else {
            setSelectedQuoteId(null);
          }
        } catch (err) {
          console.error("Failed to load accepted quotes: ", err);
        }
      };

      fetchAcceptedQuotes();
    } else {
      setAcceptedQuotes([]);
      setSelectedQuoteId(null);
    }
  }, [selectedProjectId, isQuotedJC]);

  // Load line items when a quote is selected
  useEffect(() => {
    if (selectedQuoteId) {
      const fetchQuoteItems = async () => {
        try {
          const data = await getQuoteLineItems(selectedQuoteId);

          // Convert to material lines format
          const quoteItems = data.items.map((item: any) => ({
            product_id: item.product_id,
            name: item.name,
            unit_price: item.unit_price,
            unit_cost: item.unit_cost,
            qty: item.qty,
            fromQuote: true,
            used: true, // Default to used
          }));

          // Initialize used state for all items
          const initialUsedState: Record<number, boolean> = {};
          quoteItems.forEach((item: any, index: number) => {
            initialUsedState[index] = true;
          });
          setUsedMaterials(initialUsedState);

          setMaterialLines(quoteItems);
          setValue("materials_used", true, { shouldDirty: true });
        } catch (err) {
          console.error("Failed to load quote items: ", err);
        }
      };

      fetchQuoteItems();
    }
  }, [selectedQuoteId, setValue]);

  // function to handle file uploads
  const handleFileUpload = (index: number, file: File | null) => {
    setMaterialFileUploads((prev) => ({
      ...prev,
      [index]: file,
    }));
  };

  // Function to toggle used status
  const toggleUsed = (index: number) => {
    setUsedMaterials((prev) => ({
      ...prev,
      [index]: !prev[index],
    }));
  };

  // Simple local client filter
  const filteredClients = clients.filter((c) => {
    const q = clientQuery.trim().toLowerCase();
    if (!q) return false;
    const hay =
      `${c.client_name ?? ""} ${c.email ?? ""} ${c.phone ?? ""}`.toLowerCase();
    return hay.includes(q);
  });

  function fillFromClient(c: Client) {
    setSelectedClient(c);
    setValue("client_id", c.id, { shouldDirty: true, shouldValidate: false });

    setValue("client_name" as any, c.client_name ?? "");
    setValue("client_email" as any, c.email ?? "");
    setValue("client_phone" as any, c.phone ?? "");
    setValue("client_street" as any, c.address?.street ?? "");
    setValue("client_town" as any, c.address?.town ?? "");
    setClientQuery(c.client_name);
    setClientOpen(false);
  }

  const onInvalid: SubmitErrorHandler<JobCardFormValues> = (errs) => {
    console.log("Form errors:", errs);
    const firstKey = Object.keys(errs)[0] as keyof JobCardFormValues;
    const msg = (errs[firstKey]?.message as string) || "Validation error";
    alert(`${firstKey}: ${msg}`);
  };

  // ensure client exists before validation
  const onSave = async () => {
    // Save the current values first to use later
    const currentValues = getValues();
    const currentBumId = currentValues.bum_id;
    const currentOwnerId = currentValues.owner_id;

    // guarantee owner_id is present for Zod
    if (!getValues().owner_id && initial?.owner_id) {
      setValue("owner_id", initial.owner_id, { shouldValidate: false });
    }

    let { client_id } = getValues();

    if (!client_id || Number(client_id) <= 0) {
      // build payload from the "visual" client fields
      const vals = getValues();

      const payload = {
        client_name: (vals as any).client_name || "",
        email: (vals as any).client_email || "",
        phone: (vals as any).client_phone || "",
        address: {
          street: (vals as any).client_street || "",
          town: (vals as any).client_town || "",
          province: "",
          country: "South Africa",
        },
        company: (vals as any).client_company || "",
        vat_number: (vals as any).client_vat_number || "",
      };

      // Only create if the user actually typed "something"
      const userTypedSomething =
        payload.client_name || payload.email || payload.phone;
      if (userTypedSomething) {
        try {
          const res = await createClient(payload);
          setValue("client_id", res.client_id, {
            shouldDirty: true,
            shouldValidate: true,
          });
        } catch (e: any) {
          alert(e?.response?.data?.error || "Failed to create client");
          return;
        }
      } else {
        alert("Please select a client or enter details to create one.");
        return;
      }
    }

    // Validate receipts for manually added materials
    if (
      watch("materials_used") &&
      materialLines.some(
        (line, index) => !line.fromQuote && usedMaterials[index]
      )
    ) {
      if (!validateMaterialReceipts()) {
        return;
      }
    }

    setValue("is_quoted", isQuotedJC, { shouldDirty: true });
    if (isQuotedJC && selectedProjectId) {
      setValue("project_id" as any, selectedProjectId, { shouldDirty: true });
    }

    console.log("Owner ID:", currentOwnerId);
    console.log("BUM ID:", currentBumId);

    // Create an enhanced version of onSubmit that includes material data and ensures values
    const enhancedSubmit = (values: JobCardFormValues) => {
      const time_entries = Object.entries(techHoursById)
        .filter(([, h]) => Number(h) > 0)
        .map(([uid, hours]) => ({
          user_id: Number(uid),
          hours: Number(hours),
        }));
      return onSubmit(values, {
        materialLines,
        usedMaterials,
        materialFileUploads,
        sitePhotos,
        time_entries,
      });
    };

    await Promise.resolve();
    await handleSubmit(enhancedSubmit, onInvalid)();
  };

  // lookups
  const [categories, setCategories] = useState<JobCategory[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  useEffect(() => {
    Promise.allSettled([listCategories(), listVehicles()]).then(
      ([cats, vehs]) => {
        if (cats.status === "fulfilled")
          setCategories(cats.value.filter((c) => c.active));
        if (vehs.status === "fulfilled")
          setVehicles(vehs.value.filter((v) => v.active));
      }
    );
  }, []);

  const [techHoursById, setTechHoursById] = useState<Record<number, number>>(
    {}
  );

  // When techOptions load, ensure map has keys
  useEffect(() => {
    setTechHoursById((prev) => {
      const next = { ...prev };
      techOptions.forEach((t) => {
        if (next[t.id] == null) next[t.id] = 0;
      });
      return next;
    });
  }, [techOptions]);

  const setTechHours = (id: number, hours: number) => {
    setTechHoursById((prev) => ({
      ...prev,
      [id]: prev[id] === hours ? 0 : hours,
    }));
  };

  const [materialsOpen, setMaterialsOpen] = useState(false);

  const [materialLines, setMaterialLines] = useState<MatLine[]>([]);

  const materialTotal = materialLines.reduce(
    (s, l) => s + l.unit_price * l.qty,
    0
  );

  // when the user clicks "add products"
  const handleAddProducts = (items: { product: Product; qty: number }[]) => {
    setMaterialLines((prev) => {
      const newLines = [...prev];

      for (const { product, qty } of items) {
        if (!qty) continue;
        const price = Number(product.price ?? product.unit_cost ?? 0);
        const cost = Number(product.unit_cost ?? 0);
        const name =
          [product.brand, product.model].filter(Boolean).join(" • ") ||
          `#${product.id}`;

        // Check if product already exists in line
        const existingIndex = newLines.findIndex(
          (line) => line.product_id === product.id
        );

        if (existingIndex >= 0) {
          newLines[existingIndex].qty += qty;
        } else {
          const newIndex = newLines.length;
          newLines.push({
            product_id: product.id,
            name,
            unit_price: price,
            unit_cost: cost,
            qty,
            fromQuote: false,
            receiptRequired: true,
            used: true,
          });

          // Update used state for the new item
          setUsedMaterials((prev) => ({
            ...prev,
            [newIndex]: true,
          }));
        }
      }

      return newLines;
    });
  };

  // Add validation for materials with required receipts
  const validateMaterialReceipts = () => {
    const nonQuoteMaterialsWithoutReceipt = materialLines
      .filter(
        (line, index) =>
          !line.fromQuote && usedMaterials[index] && !materialFileUploads[index]
      )
      .map((line) => line.name);

    if (nonQuoteMaterialsWithoutReceipt.length > 0) {
      alert(
        `Please upload receipts for the following materials:\n- ${nonQuoteMaterialsWithoutReceipt.join("\n- ")}`
      );
      return false;
    }

    return true;
  };

  // hydrate from initial (edit mode)
  useEffect(() => {
    if (!initial) return;
    reset({
      ...jobCardDefaults,
      client_id: Number(initial.client_id ?? 0),
      owner_id: Number(initial.owner_id ?? 1),
      category_id: initial.category_id ?? null,
      title: initial.title ?? "",
      description: initial.description ?? "",
      is_quoted: initial.is_quoted ?? false,
      start_at: normalizeISO(initial.start_at),
      complete_at: normalizeISO(initial.complete_at),
      labourers_count: initial.labourers_count ?? 0,
      labour_hours: initial.labour_hours ?? 0,
      labour_rate_per_hour: initial.labour_rate_per_hour ?? 0,
      materials_used: !!initial.materials_used,
      did_travel: !!initial.did_travel,
      vehicle_id: initial.vehicle_id ?? null,
      travel_distance_km: initial.travel_distance_km ?? 0,
      coc_required: !!initial.coc_required,
      status: (initial.status as JobCardFormValues["status"]) ?? "draft",
    });
  }, [initial, reset]);

  // computed (badges)
  const didTravel = watch("did_travel");
  const status = watch("status");
  const selVehicleId = watch("vehicle_id");
  const selVehicle = vehicles.find(
    (v) => v.id === (selVehicleId ? Number(selVehicleId) : -1)
  );
  const labourersCount = Number(watch("labourers_count") || 0);
  const labourHours = Number(watch("labour_hours") || 0);
  const labourRate = Number(watch("labour_rate_per_hour") || 0);
  const labourTotal = labourHours * labourRate * labourersCount;
  const travelKm = Number(watch("travel_distance_km") || 0);
  const travelRate = Number(selVehicle?.rate_per_km || 0);
  const travelTotal = didTravel ? travelKm * travelRate : 0;
  const grandTotal = labourTotal + travelTotal;

  return (
    <>
      <div className="jcM-appbar">
        <button
          className="jcM-back"
          onClick={() => navigate("/jobcards")}
          aria-label="Back to job cards"
        >
          <i className="bi bi-chevron-left"></i>
          <span>Back</span>
        </button>
        <h1 className="jcM-title">Job Cards</h1>
        <div className="jcM-deviceslot" />
      </div>

      <form onSubmit={handleSubmit(onSubmit, onInvalid)} className="jcM-wrap">
        {/* header summary */}
        {/* <div className="jcM-summary">
        <span className={`badge bg-${statusClass[status]}`}>{status.replace("_", " ")}</span>
        <span className="badge text-bg-light">Labour: R {labourTotal.toFixed(2)}</span>
        {didTravel && <span className="badge text-bg-light">Travel: R {travelTotal.toFixed(2)}</span>}
        <span className="badge text-bg-dark">Est. R {grandTotal.toFixed(2)}</span>
      </div> */}

        {/* <section>
        <div className="d-flex justify-content-center align-items-center gap-5 mb-2">
          <button className={`btn btn-lg ${!isQuotedJC ? 'active btn-outline-success' : 'btn-outline-secondary'}`} type="button" onClick={() => setIsQuotedJC(false)}>Out of Scope</button>
          <button className={`btn btn-lg ${isQuotedJC ? 'active btn-outline-success' : 'btn-outline-secondary'}`} type="button" onClick={() => setIsQuotedJC(true)}>Quoted</button>
        </div>
      </section> */}

        {/* BUM SELECTION */}
        <section className="bum-selection">
          <div className="d-flex justify-content-between align-items-center mb-2">
            <label htmlFor="bum_id">BUSINESS UNIT MANAGER</label>
            {isCurrentUserBum && (
              <div className="bum-badge">
                <i className="bi bi-person-check-fill"></i>
                You are a BUM
              </div>
            )}
          </div>

          <div className="bum-selection-dropdown">
            <select
              id="bum_id"
              className="form-select"
              {...register("bum_id", { valueAsNumber: true })}
              defaultValue=""
            >
              <option value="">Select BUM...</option>
              {bumOptions.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.full_name}
                </option>
              ))}
            </select>
          </div>
          {errors.bum_id && (
            <div className="text-danger mt-1 small">
              {errors.bum_id.message as string}
            </div>
          )}
        </section>

        {/* Technician SELECTION */}
        {isCurrentUserBum && (
          <section className="bum-selection">
            <div className="d-flex justify-content-between align-items-center mb-2">
              <label htmlFor="tech_id">TECHNICIAN (JOB OWNER)</label>
            </div>

            <div className="bum-selection-dropdown">
              <select
                id="owner_id"
                className="form-select"
                {...register("owner_id", { valueAsNumber: true })}
                defaultValue=""
              >
                <option value="">Select Technician...</option>
                {techOptions.map((tech) => (
                  <option key={tech.id} value={tech.id}>
                    {tech.full_name}
                  </option>
                ))}
              </select>
            </div>
            {errors.owner_id && (
              <div className="text-danger mt-1 small">
                {String(errors.owner_id.message)}
              </div>
            )}
          </section>
        )}

        <section className="mb-3">
          <div className="toggle-button-group">
            <button
              type="button"
              className={`toggle-button ${!isQuotedJC ? "active" : ""}`}
              onClick={() => setIsQuotedJC(false)}
            >
              <i className="bi bi-lightning me-1"></i> Out of Scope
            </button>
            <button
              type="button"
              className={`toggle-button ${isQuotedJC ? "active" : ""}`}
              onClick={() => setIsQuotedJC(true)}
            >
              <i className="bi bi-check-circle me-1"></i> Quoted
            </button>
          </div>
        </section>

        {/* CLIENT */}
        <section className="jcM-card">
          <h6 className="jcM-section">CLIENT</h6>

          {/* hidden field so Zod can validate client_id */}
          <input
            type="hidden"
            {...register("client_id", { valueAsNumber: true })}
          />

          <div className="jcM-autoComplete">
            <input
              className="form-control form-control-sm mt-2"
              placeholder="Full Name"
              value={clientQuery}
              onChange={(e) => {
                setClientQuery(e.target.value);
                setClientOpen(true);
                setSelectedClient(null);
                setValue("client_id", 0);
                setValue("client_name" as any, e.target.value);
              }}
              onFocus={() => setClientOpen(!!clientQuery)}
              onBlur={() => setTimeout(() => setClientOpen(false), 120)}
            />
            {clientOpen && filteredClients.length > 0 && (
              <ul className="jcM-aclist list-group" role="listbox">
                {filteredClients.map((c) => (
                  <li
                    key={c.id}
                    className="list-group-item list-group-item-action"
                    role="option"
                    onMouseDown={(e) => e.preventDefault()} // keep focus for click
                    onClick={() => fillFromClient(c)}
                  >
                    <div className="fw-semibold">{c.client_name}</div>
                    <div className="small text-muted">
                      {c.email || "—"} · {c.phone || "—"}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Email */}
          <input
            className="form-control form-control-sm mt-2"
            placeholder="Email Address"
            type="email"
            {...register("client_email" as any)}
            onChange={(e) => setSelectedClient(null)}
          />

          {/* Phone */}
          <input
            className="form-control form-control-sm mt-2"
            placeholder="Phone Number"
            {...register("client_phone" as any)}
            onChange={(e) => setSelectedClient(null)}
          />

          <div className="jcM-grid2 mt-2">
            <input
              className="form-control form-control-sm"
              placeholder="Street"
              {...register("client_street" as any)}
              onChange={(e) => setSelectedClient(null)}
            />
            <input
              className="form-control form-control-sm"
              placeholder="City"
              {...register("client_town" as any)}
              onChange={(e) => setSelectedClient(null)}
            />
          </div>

          {selectedClient && (
            <div className="d-flex align-items-center gap-2 mt-2">
              <span className="badge text-bg-success">
                Selected: {selectedClient.client_name}
              </span>
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary"
                onClick={() => {
                  setSelectedClient(null);
                  setClientQuery("");
                  setValue("client_id", 0);
                }}
              >
                Clear
              </button>
            </div>
          )}
        </section>

        {/* Project Details if isQuotedJC */}
        {isQuotedJC && (
          <section className="jcM-card">
            <h6 className="jcM-section">PROJECT DETAILS</h6>

            {!selectedClient && (
              <div className="alert alert-info py-2">
                Please select a client to view their projects.
              </div>
            )}

            {selectedClient && clientProjects.length === 0 && (
              <div className="alert alert-warning py-2">
                No projects found for this client.
              </div>
            )}

            {clientProjects.length > 0 && (
              <div className="project-list">
                {clientProjects.map((project) => (
                  <div
                    key={project.id}
                    className={`project-item ${selectedProjectId === project.id ? "selected" : ""}`}
                    onClick={() => setSelectedProjectId(project.id)}
                  >
                    <div className="project-name">{project.name}</div>
                    <div className="project-details">
                      {project.system_type && (
                        <span className="badge bg-info me-1">
                          {project.system_type}
                        </span>
                      )}
                      {project.panel_kw && (
                        <span className="badge bg-warning me-1">
                          {project.panel_kw} kWp
                        </span>
                      )}
                      {project.battery_kwh && (
                        <span className="badge bg-success">
                          {typeof project.battery_kwh === "object"
                            ? `${project.battery_kwh.capacity || 0} kWh${project.battery_kwh.quantity > 1 ? ` × ${project.battery_kwh.quantity}` : ""}`
                            : `${project.battery_kwh} kWh`}
                        </span>
                      )}
                      {project.inverter_kva && (
                        <span className="badge bg-primary">
                          {typeof project.inverter_kva === "object"
                            ? `${project.inverter_kva.capacity || 0} kVA${project.inverter_kva.quantity > 1 ? ` × ${project.inverter_kva.quantity}` : ""}`
                            : `${project.inverter_kva} kVA`}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* JOB DETAILS */}
        <section className="jcM-card">
          <h6 className="jcM-section">JOB DETAILS</h6>

          <input
            className="form-control form-control-sm mb-2"
            placeholder="Job title (e.g., Replace DB isolator)"
            {...register("title", { required: "Title is required" })}
          />
          {errors.title && (
            <small className="text-danger">
              {String(errors.title.message)}
            </small>
          )}

          <div className="jcM-grid2">
            <Controller
              name="start_at"
              control={control}
              defaultValue={null}
              render={({ field: { value, onChange } }) => (
                <input
                  type="datetime-local"
                  className="form-control form-control-sm"
                  value={toInputDT(value)}
                  onChange={(e) => onChange(localToISO(e.target.value))}
                  placeholder="Start Date"
                />
              )}
            />
            <Controller
              name="complete_at"
              control={control}
              defaultValue={null}
              render={({ field: { value, onChange } }) => (
                <input
                  type="datetime-local"
                  className="form-control form-control-sm"
                  value={toInputDT(value)}
                  onChange={(e) => onChange(localToISO(e.target.value))}
                  placeholder="End Date"
                />
              )}
            />
          </div>

          <textarea
            rows={3}
            className="form-control form-control-sm mt-2"
            placeholder="Job Description"
            {...register("description")}
          />

          {/* Category as radio list (like mock) */}
          <div className="jcM-radioList mt-2">
            {categories.length ? (
              categories.map((c) => (
                <label key={c.id} className="jcM-radioItem">
                  <input
                    type="radio"
                    value={c.id}
                    {...register("category_id", { valueAsNumber: true })}
                  />
                  <span>{c.name}</span>
                </label>
              ))
            ) : (
              <small className="text-muted">
                No categories loaded. Make sure you're signed in and have
                categories configured.
              </small>
            )}
          </div>
        </section>

        {/* HOURS quick dots (visual like screenshot) */}
        <section className="jcM-card">
          <h6 className="jcM-section">TECHNICIAN HOURS</h6>
          {techOptions.length === 0 && (
            <div className="small text-muted">No technicians loaded.</div>
          )}
          {/* Hour labels row */}
          {techOptions.length > 0 && (
            <div className="jcM-hoursRow">
              <span className="jcM-tech"></span>
              <div className="jcM-dotbar">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                  <div key={n} className="jcM-hourLabel">
                    {n}
                  </div>
                ))}
              </div>
              <div className="jcM-hourSuffix"></div>
            </div>
          )}

          {techOptions.map((t) => (
            <div key={t.id} className="jcM-hoursRow">
              <span className="jcM-tech">{t.full_name}</span>
              <div className="jcM-dotbar">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                  // Use custom element instead of native radio button for better control
                  <span
                    key={n}
                    className={`jcM-dot ${techHoursById[t.id] === n ? "jcM-dot-selected" : ""}`}
                    onClick={() => setTechHours(t.id, n)}
                    role="radio"
                    aria-checked={techHoursById[t.id] === n}
                    aria-label={`${t.full_name} ${n}h`}
                    tabIndex={0}
                  ></span>
                ))}
              </div>
              <div className="jcM-hourSuffix">
                {techHoursById[t.id] ? `${techHoursById[t.id]}h` : ""}
              </div>
            </div>
          ))}
        </section>

        {/* LABOUR */}
        {/*<section className="jcM-card">*/}
        {/*  <h6 className="jcM-section">ASSISTANTS</h6>*/}
        {/*  <div className="jcM-grid3">*/}
        {/*    <div>*/}
        {/*      <label className="jcM-label">People</label>*/}
        {/*      <input*/}
        {/*        type="number"*/}
        {/*        min={0}*/}
        {/*        className="form-control form-control-sm"*/}
        {/*        {...register("labourers_count", { valueAsNumber: true })}*/}
        {/*      />*/}
        {/*    </div>*/}
        {/*    <div>*/}
        {/*      <label className="jcM-label">Hours</label>*/}
        {/*      <input*/}
        {/*        type="number"*/}
        {/*        min={0}*/}
        {/*        step="0.25"*/}
        {/*        className="form-control form-control-sm"*/}
        {/*        {...register("labour_hours", { valueAsNumber: true })}*/}
        {/*      />*/}
        {/*    </div>*/}
        {/*    <div>*/}
        {/*      <label className="jcM-label">Rate / Hour</label>*/}
        {/*      <input*/}
        {/*        type="number"*/}
        {/*        min={0}*/}
        {/*        step="0.01"*/}
        {/*        className="form-control form-control-sm"*/}
        {/*        {...register("labour_rate_per_hour", { valueAsNumber: true })}*/}
        {/*      />*/}
        {/*    </div>*/}
        {/*  </div>*/}
        {/*</section>*/}

        {/* TRAVEL */}
        <section className="jcM-card">
          <h6 className="jcM-section">TRAVEL</h6>
          <div className="form-check form-switch mb-2">
            <input
              className="form-check-input"
              type="checkbox"
              id="did_travel"
              {...register("did_travel")}
            />
            <label className="form-check-label" htmlFor="did_travel">
              Enable travel
            </label>
          </div>

          {didTravel && (
            <div className="jcM-grid2">
              <div>
                <label className="jcM-label">Vehicle</label>
                <select
                  className="form-select form-select-sm"
                  {...register("vehicle_id", { valueAsNumber: true })}
                >
                  <option value="">— select —</option>
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name} {v.registration ? `• ${v.registration}` : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="jcM-label">Distance (km)</label>
                <input
                  type="number"
                  min={0}
                  step="0.1"
                  className="form-control form-control-sm"
                  {...register("travel_distance_km", { valueAsNumber: true })}
                />
              </div>
              {/*<div>*/}
              {/*  <label className="jcM-label">Rate / km</label>*/}
              {/*  <input*/}
              {/*    type="number"*/}
              {/*    min={0}*/}
              {/*    step="0.01"*/}
              {/*    className="form-control form-control-sm"*/}
              {/*    value={selVehicle?.rate_per_km ?? ""}*/}
              {/*    readOnly*/}
              {/*  />*/}
              {/*</div>*/}
            </div>
          )}
        </section>

        {/* MATERIALS & COC */}
        <section className="jcM-card">
          <div className="card shadow-sm mb-3">
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <h5 className="card-title mb-0">Materials</h5>
                <span className="badge text-bg-secondary">
                  R {materialTotal.toFixed(2)}
                </span>
              </div>

              <div className="form-check form-switch mb-2">
                <input
                  className="form-check-input"
                  type="checkbox"
                  id="materials_used"
                  {...register("materials_used")}
                />
                <label className="form-check-label" htmlFor="materials_used">
                  Materials used
                </label>
              </div>

              {watch("materials_used") && (
                <>
                  {selectedQuoteId && (
                    <div className="alert alert-info py-2">
                      <i className="bi bi-info-circle me-2"></i>
                      Materials loaded from selected quote
                    </div>
                  )}

                  {/* Quote selection if multiple accepted quotes exist */}
                  {isQuotedJC &&
                    selectedProjectId &&
                    acceptedQuotes.length > 0 && (
                      <div className="mb-3">
                        <label className="form-label">Select Quote:</label>
                        <div className="list-group">
                          {acceptedQuotes.map((quote) => (
                            <button
                              key={quote.id}
                              type="button"
                              className={`list-group-item list-group-item-action ${selectedQuoteId === quote.id ? "active" : ""}`}
                              onClick={() => setSelectedQuoteId(quote.id)}
                            >
                              <div className="d-flex justify-content-between align-items-center">
                                <div>
                                  <div className="fw-bold">{quote.number}</div>
                                  <small>
                                    {new Date(
                                      quote.created_at
                                    ).toLocaleDateString()}
                                  </small>
                                </div>
                                <div className="text-end">
                                  <div className="fw-bold">
                                    R{" "}
                                    {quote.totals?.total_incl_vat?.toFixed(2) ||
                                      "0.00"}
                                  </div>
                                  <span className="badge bg-success">
                                    Accepted
                                  </span>
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                  <button
                    type="button"
                    className="btn btn-sm btn-outline-primary mb-2"
                    onClick={() => setMaterialsOpen(true)}
                  >
                    + Add products
                  </button>

                  {materialLines.length > 0 ? (
                    <ul className="list-group mb-3">
                      {materialLines.map((line, index) => (
                        <li key={index} className="list-group-item">
                          <div className="form-check mb-2">
                            <input
                              className="form-check-input"
                              type="checkbox"
                              id={`material-used-${index}`}
                              checked={usedMaterials[index] ?? true}
                              onChange={() => toggleUsed(index)}
                            />
                            <label
                              className="form-check-label d-flex justify-content-between w-100"
                              htmlFor={`material-used-${index}`}
                            >
                              <div>
                                <span className="fw-semibold">{line.name}</span>
                                {line.fromQuote && (
                                  <span className="badge bg-info ms-2">
                                    From Quote
                                  </span>
                                )}
                              </div>
                              <span className="text-nowrap">
                                R {line.unit_price.toFixed(2)} × {line.qty}
                              </span>
                            </label>
                          </div>

                          {usedMaterials[index] && (
                            <div className="ms-4">
                              {!line.fromQuote && (
                                <div className="mb-2">
                                  <div className="row g-2 align-items-center">
                                    <div className="col-6">
                                      <div className="input-group input-group-sm">
                                        <span className="input-group-text">
                                          Actual Cost
                                        </span>
                                        <input
                                          type="number"
                                          className="form-control"
                                          value={line.unit_cost}
                                          onChange={(e) => {
                                            const newCost =
                                              parseFloat(e.target.value) || 0;
                                            setMaterialLines((prev) =>
                                              prev.map((item, i) =>
                                                i === index
                                                  ? {
                                                      ...item,
                                                      unit_cost: newCost,
                                                    }
                                                  : item
                                              )
                                            );
                                          }}
                                          min="0"
                                          step="0.01"
                                        />
                                      </div>
                                    </div>
                                    <div className="col-6">
                                      <div className="input-group input-group-sm">
                                        <span className="input-group-text">
                                          Price
                                        </span>
                                        <input
                                          type="number"
                                          className="form-control"
                                          value={line.unit_price}
                                          onChange={(e) => {
                                            const newPrice =
                                              parseFloat(e.target.value) || 0;
                                            setMaterialLines((prev) =>
                                              prev.map((item, i) =>
                                                i === index
                                                  ? {
                                                      ...item,
                                                      unit_price: newPrice,
                                                    }
                                                  : item
                                              )
                                            );
                                          }}
                                          min="0"
                                          step="0.01"
                                        />
                                      </div>
                                    </div>
                                  </div>

                                  <div className="mt-2">
                                    <input
                                      type="file"
                                      id={`material-receipt-${index}`}
                                      className="d-none"
                                      accept="image/*"
                                      onChange={(e) =>
                                        handleFileUpload(
                                          index,
                                          e.target.files?.[0] || null
                                        )
                                      }
                                    />
                                    <label
                                      htmlFor={`material-receipt-${index}`}
                                      className={`btn btn-sm ${materialFileUploads[index] ? "btn-success" : "btn-outline-secondary"}`}
                                    >
                                      {materialFileUploads[index] ? (
                                        <>
                                          <i className="bi bi-check-circle"></i>{" "}
                                          Receipt Uploaded
                                        </>
                                      ) : (
                                        <>
                                          <i className="bi bi-receipt"></i>{" "}
                                          Upload Receipt (Required)
                                        </>
                                      )}
                                    </label>

                                    {materialFileUploads[index] && (
                                      <span className="ms-2 text-muted small">
                                        {materialFileUploads[index]?.name}(
                                        {Math.round(
                                          (materialFileUploads[index]
                                            ?.size as number) / 1024
                                        )}{" "}
                                        KB)
                                      </span>
                                    )}
                                  </div>
                                </div>
                              )}

                              <div className="d-flex justify-content-between align-items-center mt-1">
                                <div
                                  className="input-group input-group-sm"
                                  style={{ maxWidth: "180px" }}
                                >
                                  <span className="input-group-text">Qty</span>
                                  <input
                                    type="number"
                                    className="form-control"
                                    min="0"
                                    step="1"
                                    value={line.qty}
                                    onChange={(e) => {
                                      const newQty = Math.max(
                                        0,
                                        parseInt(e.target.value) || 0
                                      );
                                      setMaterialLines((prev) =>
                                        prev.map((item, i) =>
                                          i === index
                                            ? { ...item, qty: newQty }
                                            : item
                                        )
                                      );
                                    }}
                                  />
                                </div>

                                <div>
                                  <span className="fw-bold me-2">
                                    Total: R{" "}
                                    {(line.unit_price * line.qty).toFixed(2)}
                                  </span>
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-outline-danger"
                                    onClick={() => {
                                      setMaterialLines((prev) =>
                                        prev.filter((_, i) => i !== index)
                                      );
                                      setUsedMaterials((prev) => {
                                        const newUsed = { ...prev };
                                        delete newUsed[index];
                                        return newUsed;
                                      });
                                      setMaterialFileUploads((prev) => {
                                        const newUploads = { ...prev };
                                        delete newUploads[index];
                                        return newUploads;
                                      });
                                    }}
                                  >
                                    <i className="bi bi-trash"></i>
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="alert alert-warning">
                      No materials added yet.
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
          <div className="d-flex align-items-center justify-content-between mt-2">
            <h6 className="jcM-section mb-0">COC</h6>
            <div className="form-check form-switch m-0">
              <input
                className="form-check-input"
                type="checkbox"
                id="coc_required"
                {...register("coc_required")}
              />
            </div>
          </div>
        </section>

        <section className="jcM-card">
          <h6 className="jcM-section d-flex justify-content-between align-items-center">
            <span>SITE PHOTOS</span>
            <button
              type="button"
              className="btn btn-sm btn-outline-primary"
              onClick={handleSelectSitePhotos}
            >
              + Add
            </button>
          </h6>

          <input
            ref={siteFileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="d-none"
            onChange={handleSiteFilesChange}
          />

          {sitePhotos.length === 0 && (
            <div className="alert alert-warning py-2 mb-2">
              No photos selected. You can add photos now; they will upload after
              save.
            </div>
          )}

          {sitePhotos.length > 0 && (
            <div className="row g-3">
              {sitePhotos.map((p) => (
                <div key={p.id} className="col-6 col-md-4">
                  <div className="border rounded position-relative">
                    <img
                      src={p.preview}
                      alt="preview"
                      style={{
                        width: "100%",
                        aspectRatio: "4/3",
                        objectFit: "cover",
                        borderRadius: "4px 4px 0 0",
                      }}
                    />
                    <button
                      type="button"
                      className="btn btn-sm btn-danger position-absolute"
                      style={{ top: 4, right: 4 }}
                      onClick={() => removeSitePhoto(p.id!)}
                      title="Remove"
                    >
                      <i className="bi bi-x" />
                    </button>
                    <textarea
                      className="form-control form-control-sm"
                      placeholder="Caption (optional)"
                      style={{
                        fontSize: "12px",
                        borderTopLeftRadius: 0,
                        borderTopRightRadius: 0,
                      }}
                      rows={2}
                      value={p.caption}
                      onChange={(e) => updateSiteCaption(p.id!, e.target.value)}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Sticky actions */}
        <div className="jcM-stickyBar">
          {onCancel && (
            <button
              type="button"
              className="btn btn-outline-secondary flex-fill"
              onClick={onCancel}
              disabled={isSubmitting}
            >
              Cancel
            </button>
          )}
          <button
            type="button"
            className="btn btn-primary flex-fill"
            onClick={onSave}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <span
                  className="spinner-border spinner-border-sm me-2"
                  role="status"
                  aria-hidden="true"
                ></span>
                "Saving…"
              </>
            ) : (
              "Save"
            )}
          </button>
        </div>

        <ProductPickerModal
          open={materialsOpen}
          onClose={() => setMaterialsOpen(false)}
          onAdd={handleAddProducts}
        />
      </form>
    </>
  );
}
