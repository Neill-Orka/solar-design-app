import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import {
  Container, Row, Col, Card, Button, Form, Spinner,
  Alert, InputGroup, Badge, Table, ButtonGroup, Modal
} from 'react-bootstrap';
import { API_URL } from './apiConfig';
import { useNotification } from './NotificationContext';
import { useNavigate } from 'react-router-dom';

/* ---------- Category meta (display only) ---------- */
const CATEGORY_META = {
  panel:        { name: 'Panels',           icon: 'bi-grid-3x3-gap-fill',     color: 'warning'  },
  inverter:     { name: 'Inverters',        icon: 'bi-box-seam',              color: 'info'     },
  battery:      { name: 'Batteries',        icon: 'bi-battery-full',          color: 'success'  },
  fuse:         { name: 'Fuses',            icon: 'bi-shield-slash-fill',     color: 'danger'   },
  breaker:      { name: 'Circuit Breakers', icon: 'bi-lightning-charge-fill', color: 'danger'   },
  isolator:     { name: 'Isolators',        icon: 'bi-plugin-fill',           color: 'secondary'},
  inverter_aux: { name: 'Inverter Aux',     icon: 'bi-hdd-stack-fill',        color: 'secondary'},
  dc_cable:     { name: 'DC Cables',        icon: 'bi-plug-fill',             color: 'dark'     },
  ac_cable:     { name: 'AC Cables',        icon: 'bi-lightning',             color: 'dark'     },
  enclosure:    { name: 'Enclosures',       icon: 'bi-box',                   color: 'secondary'},
  combiner:     { name: 'Combiners',        icon: 'bi-diagram-3',            color: 'secondary'},
  db:           { name: 'Distribution',     icon: 'bi-hdd-network',           color: 'secondary'},
  accessory:    { name: 'Accessories',      icon: 'bi-gear-fill',             color: 'secondary'},
  other:        { name: 'Other',            icon: 'bi-box',                   color: 'secondary'},
};


/* ---------- Helpers ---------- */
const slugify = (s) =>
  (s || '')
    .toString()
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^\w\s]/g, '')
    .trim()
    .replace(/\s+/g, '_');

const formatCurrency = (value) =>
  new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value || 0);

const formatNumber0 = (value) =>
  new Intl.NumberFormat('en-ZA', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value || 0);

const toNumber = v => (v === null || v === undefined || v === '') ? 0 : Number(v);
const DEFAULT_MARGIN_DEC = 0.25;

const normalizeMarginToDecimal = (m) => {
  const v = toNumber(m);
  if (!Number.isFinite(v) || v < 0) return DEFAULT_MARGIN_DEC;
  // tolerate DBs where margin is stored as 1 => 1% or 25 => 25%
  return v <= 1 ? v : v / 100;
}

const computeUnitCost = (product) => toNumber(product?.unit_cost);

const computeMarginPct = (product) => normalizeMarginToDecimal(product?.margin);

const computeDerivedUnitFromProduct = (product) => {
  const cost = computeUnitCost(product);
  const m = computeMarginPct(product);
  return Number.isFinite(cost) ? cost * (1 + m) : toNumber(product?.price);
}

// effective margin for a BOM row: override -> product -> default (25%)
const getRowMarginDecimal = (row) => {
  if (row?.override_margin != null) return toNumber(row.override_margin);
  const prodM = computeMarginPct(row?.product);
  return Number.isFinite(prodM) && prodM >= 0 ? prodM : DEFAULT_MARGIN_DEC;
};

const computeDerivedUnitFromRow = (row) => {
  const cost = computeUnitCost(row?.product);
  const m = getRowMarginDecimal(row);
  if (Number.isFinite(cost) && Number.isFinite(m)) return cost * (1+m);
  return toNumber(row?.product?.price);
};

// Draft = live; Locked = snapshot if present, else live
const getUnitPriceForRow = (row, isDraft) => 
  isDraft ? computeDerivedUnitFromRow(row) : (row.price_at_time ?? computeDerivedUnitFromRow(row));

/* ---------- Component ---------- */
function BillOfMaterials({ projectId }) {
  const { showNotification } = useNotification();
  const navigate = useNavigate();

  // State
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState([]); // normalized categories
  const [project, setProject] = useState(null);

  // BomItem: { product, quantity, price_at_time, current_price? }
  const [bomComponents, setBomComponents] = useState([]);
  const [isStandardDesign, setIsStandardDesign] = useState(false);
  const [templateInfo, setTemplateInfo] = useState(null);

  const [searchFilter, setSearchFilter] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  const [savingComponents, setSavingComponents] = useState(false);
  const [showSaveTemplateModal, setShowSaveTemplateModal] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [newTemplateDesc, setNewTemplateDesc] = useState('');

  const [extrasCost, setExtrasCost] = useState('0');
  const [quoteStatus, setQuoteStatus] = useState('draft'); // draft | sent | accepted | complete

  /* ---------- Initial load ---------- */
  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      try {
        // products
        const productsRes = await axios.get(`${API_URL}/api/products`);
        const normalized = (productsRes.data || []).map(p => ({
          ...p,
          category: slugify(p.category)
        }));
        setProducts(normalized);

        // project
        const projectRes = await axios.get(`${API_URL}/api/projects/${projectId}`);
        const proj = projectRes.data;
        setProject(proj);

        const std = !!proj?.template_id || !!proj?.from_standard_template || !!proj?.template_name;
        setIsStandardDesign(std);
        if (std) {
          setTemplateInfo({
            id: proj.template_id || null,
            name: proj.template_name || null
          });
        }

        // dispatch load in correct order
        await loadProjectBOM(projectId, normalized, proj);
      } catch (err) {
        console.error('Init load error:', err);
        showNotification('Failed to load project or products', 'danger');
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  /* ---------- Template fetch helpers (by id OR by name) ------------ */
  const fetchTemplateById = async (id) => {
    if (!id) return null;
    try {
      const res = await axios.get(`${API_URL}/api/system_templates/${id}`);
      return res.data || null;
    } catch (e) {
      console.warn('fetchTemplateById failed:', e);
      return null;
    }
  };

  const fetchTemplateByName = async (name) => {
    if (!name) return null;
    try {
      const res = await axios.get(`${API_URL}/api/system_templates`);
      const list = res.data || [];
      const match = list.find(t => (t.name || '').toLowerCase().trim() === name.toLowerCase().trim());
      if (!match) return null;
      return await fetchTemplateById(match.id);
    } catch (e) {
      console.warn('fetchTemplateByName failed:', e);
      return null;
    }
  };

  const mapTemplateToItems = (template, productsData) => {
    const comps = (template?.components || []).map(c => {
      const prod = productsData.find(p => p.id === c.product_id);
      if (!prod) return null;
      return {
        product: prod,
        quantity: Number(c.quantity) || 1,
        price_at_time: null,
        current_price: computeDerivedUnitFromRow({ product: prod })
      };
    }).filter(Boolean);
    return comps;
  };

// Overlay panel/inverter/battery changes from systemDesign onto a full template
const overlayFromProject = (items, projectData, productsData) => {
  let result = [...items];

  // Panels
  if (projectData.panel_id) {
    const prod = productsData.find(p => p.id === projectData.panel_id);
    if (prod) {
      result = result.filter(x => x.product?.category !== 'panel');
      const qty = (projectData.panel_kw && prod.power_w)
        ? Math.max(1, Math.ceil((Number(projectData.panel_kw) * 1000) / Number(prod.power_w)))
        : 1;
      result.push({ product: prod, quantity: qty, price_at_time: null, current_price: computeDerivedUnitFromRow({ product: prod }) });
    }
  }

  // Inverters
  if (projectData.inverter_ids?.length) {
    result = result.filter(x => x.product?.category !== 'inverter');
    const qty = Number(projectData.inverter_kva?.quantity) || 1;
    projectData.inverter_ids.forEach((id, idx) => {
      const prod = productsData.find(p => p.id === id);
      if (prod) {
        result.push({
          product: prod,
          quantity: idx === 0 ? qty : 1,
          price_at_time: null,
          current_price: computeDerivedUnitFromRow({ product: prod })
        });
      }
    });
  }

  // Batteries
  if (projectData.battery_ids?.length) {
    result = result.filter(x => x.product?.category !== 'battery');
    const qty = Number(projectData.battery_kwh?.quantity) || 1;
    projectData.battery_ids.forEach((id, idx) => {
      const prod = productsData.find(p => p.id === id);
      if (prod) {
        result.push({
          product: prod,
          quantity: idx === 0 ? qty : 1,
          price_at_time: null,
          current_price: computeDerivedUnitFromRow({ product: prod })
        });
      }
    });
  }

  return result;
};

  /* ---------- Loader with single source-of-truth priority ---------- */
const loadProjectBOM = async (pid, productsData, projectData) => {
  let loaded = false;
  const designModified = sessionStorage.getItem(`systemDesignModified_${pid}`) === 'true';

  // Try to get the full template first (by id or name)
  let templateItems = null;
  if (projectData?.template_id || projectData?.template_name) {
    try {
      let tmpl = null;
      if (projectData.template_id) tmpl = await fetchTemplateById(projectData.template_id);
      if (!tmpl && projectData.template_name) tmpl = await fetchTemplateByName(projectData.template_name);
      if (tmpl) {
        templateItems = mapTemplateToItems(tmpl, productsData);
        if (tmpl.extras_cost !== undefined && tmpl.extras_cost !== null) {
          setExtrasCost(String(tmpl.extras_cost));
        }
      }
    } catch (e) {
      console.warn('Template fetch failed:', e);
    }
  }

  if (templateItems) {
    const items = designModified
      ? overlayFromProject(templateItems, projectData, productsData)
      : templateItems;
    setBomComponents(items);
    loaded = true;
  }

  // Fallback: saved BOM rows (if any)
  if (!loaded) {
    try {
      const bomRes = await axios.get(`${API_URL}/api/projects/${pid}/bom`);
      const list = bomRes.data || [];
      if (list.length) {
        const meta = list.find(x => x.quote_status || x.extras_cost);
        if (meta?.quote_status) setQuoteStatus(meta.quote_status);
        if (meta?.extras_cost !== undefined && meta?.extras_cost !== null) {
          setExtrasCost(String(meta.extras_cost));
        }
        const items = list.map(row => {
          const prod = productsData.find(p => p.id === row.product_id);
          if (!prod) return null;
          return {
            product: prod,
            quantity: Number(row.quantity) || 1,
            override_margin: row.override_margin ?? null,
            price_at_time: (row.price_at_time ?? null),
            current_price: computeDerivedUnitFromRow({ product: prod })
          };
        }).filter(Boolean);
        if (items.length) {
          setBomComponents(items);
          loaded = true;
        }
      }
    } catch (e) {
      console.warn('Saved BOM load failed:', e);
    }
  }

  // Last resort: init from SystemDesign (core only)
  if (!loaded && projectData) {
    const init = initializeFromSystemDesign(projectData, productsData);
    setBomComponents(init);
  }
};


  /* ---------- Overlay helpers ---------- */
  const overlayCoreFromSystemDesign = (templateItems, projectData, productsData) => {
    const result = [...templateItems];

    // Replace inverter lines if provided
    if (projectData.inverter_ids?.length) {
      // Remove all inverter items
      for (let i = result.length - 1; i >= 0; i--) {
        if (result[i].product?.category === 'inverter') result.splice(i, 1);
      }
      // Add selected inverters (1 each by default)
      projectData.inverter_ids.forEach(id => {
        const prod = productsData.find(p => p.id === id);
        if (prod) {
          result.push({ product: prod, quantity: 1, price_at_time: null, current_price: computeDerivedUnitFromRow({ product: prod }) });
        }
      });
    }

    // Replace battery lines if provided
    if (projectData.battery_ids?.length) {
      for (let i = result.length - 1; i >= 0; i--) {
        if (result[i].product?.category === 'battery') result.splice(i, 1);
      }
      projectData.battery_ids.forEach(id => {
        const prod = productsData.find(p => p.id === id);
        if (prod) {
          result.push({ product: prod, quantity: 1, price_at_time: null, current_price: computeDerivedUnitFromRow({ product: prod }) });
        }
      });
    }

    return result;
  };

  const initializeFromSystemDesign = (projectData, productsData) => {
    const items = [];

    // Inverters
    if (projectData.inverter_ids?.length) {
      projectData.inverter_ids.forEach(id => {
        const prod = productsData.find(p => p.id === id);
        if (prod) items.push({ product: prod, quantity: 1, price_at_time: null, current_price: computeDerivedUnitFromRow({ product: prod }) });
      });
    }

    // Batteries
    if (projectData.battery_ids?.length) {
      projectData.battery_ids.forEach(id => {
        const prod = productsData.find(p => p.id === id);
        if (prod) items.push({ product: prod, quantity: 1, price_at_time: null, current_price: computeDerivedUnitFromRow({ product: prod }) });
      });
    }

    // Panels: only possible if you store panel product id — project currently doesn’t.
    // User can add panels from the left list.

    return items;
  };

  /* ---------- Item ops ---------- */
  const addComponent = (product) => {
    const existing = bomComponents.find(c => c.product.id === product.id);
    if (existing) {
      updateQuantity(product.id, existing.quantity + 1);
      return;
    }
    setBomComponents([
      ...bomComponents,
      {
        product,
        quantity: 1,
        price_at_time: null,
        current_price: computeDerivedUnitFromRow({ product })
      }
    ]);
  };

  const removeComponent = (productId) => {
    setBomComponents(bomComponents.filter(c => c.product.id !== productId));
  };

  const updateQuantity = (productId, quantity) => {
    const q = Math.max(1, parseInt(quantity || 1, 10));
    setBomComponents(bomComponents.map(c =>
      c.product.id === productId ? { ...c, quantity: q } : c
    ));
  };

  const updateMargin = (productId, marginPct) => {
    const dec = Math.max(0, Number(marginPct) / 100 || 0);
    setBomComponents(bomComponents.map(c => 
      c.product.id === productId ? { ...c, override_margin: dec } : c
    ));
  };

  /* ---------- Save BOM ---------- */
  const saveBOM = async () => {
    try {
      setSavingComponents(true);

      const parsedExtras = parseFloat(extrasCost || '0') || 0;
      const isDraft = (quoteStatus === 'draft');

      const components = (Array.isArray(bomComponents) ? bomComponents : []).map(c => {
        const liveUnit = computeDerivedUnitFromRow(c);
        const liveCost = computeUnitCost(c.product);
        return {
          product_id: c.product.id,
          quantity: c.quantity,
          override_margin: c.override_margin ?? null,
          price_at_time: isDraft ? null : (c.price_at_time ?? liveUnit),
          unit_cost_at_time: isDraft ? null : (c.unit_cost_at_time ?? liveCost)
        };
      });

      await axios.post(`${API_URL}/api/projects/${projectId}/bom`, {
        project_id: projectId,
        components,
        extras_cost: parsedExtras,
        quote_status: quoteStatus,
        from_standard_template: !!isStandardDesign,
        template_id: templateInfo?.id || null,
        template_name: templateInfo?.name || null
      });

      // Totals reflect what user sees: draft => live, locked => snapshot
      const total = (Array.isArray(bomComponents) ? bomComponents: []).reduce((sum, c) => {
        const unit = getUnitPriceForRow(c, isDraft);
        return sum + unit * (c.quantity || 0);
      }, parsedExtras);

      await axios.put(`${API_URL}/api/projects/${projectId}`, {
        project_value_excl_vat: total
      });

      // Clear modified flag
      sessionStorage.removeItem(`systemDesignModified_${projectId}`);
      showNotification('Bill of Materials saved', 'success');

    } catch (err) {
      console.error('Save BOM error:', err);
      showNotification('Failed to save Bill of Materials', 'danger');
    } finally {
      setSavingComponents(false);
    }
  };

  /* ---------- Save as Template ---------- */
  const saveAsTemplate = async () => {
    try {
      setSavingComponents(true);
      const payload = {
        name: newTemplateName.trim(),
        description: newTemplateDesc.trim(),
        extras_cost: parseFloat(extrasCost || '0') || 0,
        components: bomComponents.map(c => ({
          product_id: c.product.id,
          quantity: c.quantity
        }))
      };
      await axios.post(`${API_URL}/api/system_templates`, payload);

      setShowSaveTemplateModal(false);
      setNewTemplateName('');
      setNewTemplateDesc('');
      showNotification('Template saved', 'success');
    } catch (err) {
      console.error('Save template error:', err);
      showNotification('Failed to save template', 'danger');
    } finally {
      setSavingComponents(false);
    }
  };

  /* ---------- Derived ---------- */
  const filteredProducts = useMemo(() => {
    const txt = searchFilter.toLowerCase().trim();
    return products.filter(p => {
      if (selectedCategory !== 'all' && p.category !== selectedCategory) return false;
      if (!txt) return true;
      const blob = `${p.brand || ''} ${p.model || ''} ${p.category || ''} ${p.power_w || ''} ${p.rating_kva || ''} ${p.capacity_kwh || ''}`.toLowerCase();
      return txt.split(/\s+/).every(f => blob.includes(f));
    });
  }, [products, searchFilter, selectedCategory]);

  const grouped = useMemo(() => {
    const g = {};
    const list = Array.isArray(bomComponents) ? bomComponents : [];
    list.forEach(c => {
      const cat = c.product.category || 'other';
      if (!g[cat]) g[cat] = [];
      g[cat].push(c);
    });
    return g;
  }, [bomComponents]);

  const hasPriceChanges = useMemo(() => {
    if (quoteStatus === 'draft') return false;
    return (Array.isArray(bomComponents) ? bomComponents : []).some(c => 
      c.price_at_time !== undefined &&
      c.price_at_time !== null &&
      computeDerivedUnitFromRow(c) !== c.price_at_time
    );
  }, [bomComponents, quoteStatus]);

  const systemSpecs = useMemo(() => {
    let panelW = 0, inverterKva = 0, batteryKwh = 0;
    const list = Array.isArray(bomComponents) ? bomComponents : [];
    list.forEach(c => {
      const cat = c.product.category;
      if (cat === 'panel' && c.product.power_w) {
        panelW += (Number(c.product.power_w) || 0) * (c.quantity || 0);
      } else if (cat === 'inverter' && c.product.rating_kva) {
        inverterKva += (Number(c.product.rating_kva) || 0) * (c.quantity || 0);
      } else if (cat === 'battery' && c.product.capacity_kwh) {
        batteryKwh += (Number(c.product.capacity_kwh) || 0) * (c.quantity || 0);
      }
    });
    return {
      panelKw: (panelW / 1000).toFixed(2),
      inverterKva: inverterKva.toFixed(2),
      batteryKwh: batteryKwh.toFixed(2)
    };
  }, [bomComponents]);

  const totals = useMemo(() => {
    const isDraft = (quoteStatus === 'draft');
    const list = Array.isArray(bomComponents) ? bomComponents : [];
    const sub = list.reduce((sum, c) => {
      const unit = getUnitPriceForRow(c, isDraft);
      return sum + unit * (c.quantity || 0);
    }, 0);
    const extras = parseFloat(extrasCost || '0') || 0;
    return { subtotal: sub, extras, grand: sub + extras };
  }, [bomComponents, extrasCost, quoteStatus]);


  /* ---------- UI ---------- */
  if (loading) {
    return (
      <div className="text-center py-5">
        <Spinner animation="border" />
        <div className="mt-2">Loading bill of materials…</div>
      </div>
    );
  }

  // Add this function to prepare BOM data and navigate to print view
  const handleExportToPdf = () => {
    // Prepare data structure for the printable view
    const categoriesForPrint = Object.keys(grouped).map(cat => ({
      name: CATEGORY_META[cat]?.name || cat,
      items: grouped[cat].map(comp => ({
        product: comp.product,
        quantity: comp.quantity,
        price: getUnitPriceForRow(comp, quoteStatus === 'draft')
      }))
    }));

    // Store the data in localStorage for the print view to access
    localStorage.setItem('printBomData', JSON.stringify({
      project,
      systemSpecs,
      totals,
      categories: categoriesForPrint
    }));

    // Navigate to the print view
    navigate('/print-bom');
  };

  return (
    <div>
      <Container fluid>
        <Row className="mb-3">
          <Col>
            <h4 className="mb-0">
              <i className="bi bi-basket3 me-2" />
              Bill of Materials
            </h4>
            <div className="text-muted">
              Project: <strong>{project?.name}</strong>
              {isStandardDesign && (
                <Badge bg="secondary" className="ms-2">
                  Standard: {templateInfo?.name || 'Template'}
                </Badge>
              )}
            </div>
          </Col>
          <Col className="text-end">
            {/* Add the Export to PDF button */}
            <Button
              variant="outline-secondary"
              className="me-2"
              onClick={handleExportToPdf}
            >
              <i className="bi bi-file-earmark-pdf me-1" />
              Export to PDF
            </Button>
            <Button
              variant="primary"
              className="me-2"
              onClick={() => setShowSaveTemplateModal(true)}
              disabled={!bomComponents.length || savingComponents}
            >
              <i className="bi bi-save me-1" />
              Save as Template
            </Button>
            <Button
              variant="success"
              onClick={saveBOM}
              disabled={savingComponents}
            >
              {savingComponents ? (
                <>
                  <Spinner size="sm" as="span" animation="border" className="me-2" />
                  Saving…
                </>
              ) : (
                <>
                  <i className="bi bi-check2-circle me-1" />
                  Save BOM
                </>
              )}
            </Button>
          </Col>
        </Row>

        {hasPriceChanges && (
          <Alert variant="warning" className="py-2">
            <i className="bi bi-exclamation-triangle me-2" />
            Some items have price changes since the BOM was last saved. The saved “unit price” will be respected on export unless you update it.
          </Alert>
        )}

        <Row>
          {/* Left: Product browser - Changed from lg={7} to lg={6} */}
          <Col lg={6}>
            <Card className="shadow-sm mb-4">
              <Card.Header as="h5" className="py-2">
                <i className="bi bi-list-ul me-2" />
                Add Components
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
                        value={searchFilter}
                        onChange={e => setSearchFilter(e.target.value)}
                      />
                    </InputGroup>
                  </Col>
                  <Col md={6}>
                    <Form.Select
                      size="sm"
                      value={selectedCategory}
                      onChange={e => setSelectedCategory(e.target.value)}
                    >
                      <option value="all">All categories</option>
                      {Object.keys(CATEGORY_META).map(k => (
                        <option key={k} value={k}>{CATEGORY_META[k].name}</option>
                      ))}
                    </Form.Select>
                  </Col>
                </Row>

                <div className="table-responsive" style={{ maxHeight: 400, overflowY: 'auto' }}>
                  <Table hover size="sm" className="align-middle small">
                    <thead className="table-light">
                      <tr>
                        <th>Product</th>
                        <th>Specs</th>
                        <th className="text-end">Price</th>
                        <th className="text-center" style={{ width: 100 }}>Add</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredProducts.map(product => {
                        const existing = bomComponents.find(c => c.product.id === product.id);
                        return (
                          <tr key={product.id}>
                            <td>
                              <div className="fw-medium small">{product.brand} {product.model}</div>
                              <div className="text-muted" style={{fontSize: '0.75rem'}}>{CATEGORY_META[product.category]?.name || product.category}</div>
                            </td>
                            <td>
                              {product.category === 'panel' && product.power_w && (
                                <Badge bg="warning" text="dark" className="small">{formatNumber0(product.power_w)}W</Badge>
                              )}{' '}
                              {product.category === 'inverter' && product.rating_kva && (
                                <Badge bg="info" className="small">{product.rating_kva}kVA</Badge>
                              )}{' '}
                              {product.category === 'battery' && product.capacity_kwh && (
                                <Badge bg="success" className="small">{product.capacity_kwh}kWh</Badge>
                              )}
                            </td>
                            <td className="text-end small">{formatCurrency(computeDerivedUnitFromProduct(product))}</td>
                            <td className="text-center">
                              {existing ? (
                                <ButtonGroup size="sm">
                                  <Button variant="outline-secondary" size="sm" className="py-0 px-1" onClick={() => updateQuantity(product.id, existing.quantity - 1)}>-</Button>
                                  <Button variant="outline-secondary" size="sm" className="py-0 px-1" disabled>{existing.quantity}</Button>
                                  <Button variant="outline-secondary" size="sm" className="py-0 px-1" onClick={() => updateQuantity(product.id, existing.quantity + 1)}>+</Button>
                                </ButtonGroup>
                              ) : (
                                <Button variant="outline-primary" size="sm" className="py-0" onClick={() => addComponent(product)}>
                                  <i className="bi bi-plus-lg" /> Add
                                </Button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                      {filteredProducts.length === 0 && (
                        <tr>
                          <td colSpan="4" className="text-center text-muted">No products match your search.</td>
                        </tr>
                      )}
                    </tbody>
                  </Table>
                </div>
              </Card.Body>
            </Card>
          </Col>

          {/* Right: BOM + specs - Changed from lg={5} to lg={6} */}
          <Col lg={6}>
            <Card className="shadow-sm mb-4">
              <Card.Header as="h5">
                <i className="bi bi-clipboard-check me-2" />
                Your BOM ({bomComponents.length} items)
              </Card.Header>
              <Card.Body>
                {bomComponents.length === 0 ? (
                  <div className="text-muted">Add components on the left to build your BOM.</div>
                ) : (
                  <div className="table-responsive">
                    <Table hover size="sm" className="align-middle">
                      <thead className="table-light">
                        <tr>
                          <th>Product</th>
                          <th className='text-end' style={{ width: 80 }}>Cost</th>
                          <th style={{ width: 100 }}>Margin</th>
                          <th className='text-end' style={{ width: 80 }}>Price</th>
                          <th style={{ width: 90 }}>Qty</th>
                          <th className='text-end' style={{ width: 80 }}>Total</th>
                          <th style={{ width: 40 }} />
                        </tr>
                      </thead>
                      <tbody>
                        {Object.keys(grouped).map(cat => (
                          <React.Fragment key={cat}>
                            <tr className="table-light">
                              <td colSpan={7} className="py-1">
                                <div className="fw-semibold">
                                  <i className={`bi ${CATEGORY_META[cat]?.icon || 'bi-box'} me-1`} />
                                  {CATEGORY_META[cat]?.name || cat}
                                </div>
                              </td>
                            </tr>
                            {grouped[cat].map(comp => {
                              const isDraft = (quoteStatus === 'draft');
                              const unitCost = computeUnitCost(comp.product);
                              const unitPrice = getUnitPriceForRow(comp, isDraft);
                              const line = unitPrice * (comp.quantity || 0);
                              const priceChanged = !isDraft && comp.price_at_time != null && 
                                computeDerivedUnitFromRow(comp) !== comp.price_at_time;

                              return (
                                <tr key={comp.product.id}>
                                  <td>
                                    <div className="small fw-medium">{comp.product.brand} {comp.product.model}</div>
                                    {priceChanged && (
                                      <small className="text-danger">
                                        Price changed: {formatCurrency(comp.price_at_time)} → {formatCurrency(computeDerivedUnitFromRow(comp))}
                                      </small>
                                    )}
                                  </td>
                                  <td className='text-end'>{formatCurrency(unitCost)}</td>
                                  <td>
                                    <InputGroup size='sm'>
                                      <InputGroup.Text className="py-0 px-1">%</InputGroup.Text>
                                      <Form.Control
                                        type="number"
                                        min="0"
                                        step="1"
                                        value={Math.round(getRowMarginDecimal(comp) * 100)}
                                        onChange={e => updateMargin(comp.product.id, e.target.value)}
                                        disabled={quoteStatus !== 'draft'}
                                        className="py-0"
                                      />
                                    </InputGroup>
                                  </td>
                                  <td className='text-end'>{formatCurrency(unitPrice)}</td>
                                  <td>
                                    <InputGroup size='sm'>
                                      <Form.Control 
                                        type="number"
                                        min="0"
                                        value={comp.quantity}
                                        onChange={e => updateQuantity(comp.product.id, e.target.value)}
                                        className="py-0"
                                      />
                                    </InputGroup>
                                  </td>
                                  <td className='text-end'>{formatCurrency(line)}</td>
                                  <td className='text-end'>
                                    <Button variant="outline-danger" size='sm' className="py-0 px-1" onClick={() => removeComponent(comp.product.id)}>
                                      <i className='bi bi-trash' />
                                    </Button>
                                  </td>
                                </tr>
                              );
                            })}
                          </React.Fragment>
                        ))}
                        
                        {/* Totals rows */}
                        <tr className="border-top border-dark">
                          <td colSpan={5} className="text-end fw-semibold">Subtotal:</td>
                          <td className="text-end fw-semibold">{formatCurrency(totals.subtotal)}</td>
                          <td></td>
                        </tr>
                        <tr>
                          <td colSpan={5} className="text-end fw-semibold">Extras:</td>
                          <td className="text-end fw-semibold">{formatCurrency(totals.extras)}</td>
                          <td></td>
                        </tr>
                        <tr className="border-top border-dark">
                          <td colSpan={5} className="text-end fw-bold">Total (excl. VAT):</td>
                          <td className="text-end fw-bold">{formatCurrency(totals.grand)}</td>
                          <td></td>
                        </tr>
                      </tbody>
                    </Table>
                  </div>
                )}

                <Row className="align-items-center mt-3">
                  <Col md={6}>
                    <Form.Group>
                      <Form.Label>Extras / Labour (R)</Form.Label>
                      <Form.Control
                        value={extrasCost}
                        onChange={e => setExtrasCost(e.target.value)}
                        type="number"
                        min="0"
                        step="0.01"
                      />
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group>
                      <Form.Label>Quote Status</Form.Label>
                      <Form.Select value={quoteStatus} onChange={e => setQuoteStatus(e.target.value)}>
                        <option value="draft">Draft</option>
                        <option value="sent">Sent</option>
                        <option value="accepted">Accepted</option>
                        <option value="complete">Complete</option>
                      </Form.Select>
                    </Form.Group>
                  </Col>
                </Row>
              </Card.Body>
            </Card>
            
            <Card className="shadow-sm">
              <Card.Header as="h5">
                <i className="bi bi-info-circle me-2" />
                System Specifications
              </Card.Header>
              <Card.Body>
                <Row>
                  <Col sm={4} className="mb-3 text-center">
                    <div className="small text-muted">PV Size</div>
                    <div className="fs-4 fw-bold text-warning">{systemSpecs.panelKw} <small>kWp</small></div>
                  </Col>
                  <Col sm={4} className="mb-3 text-center">
                    <div className="small text-muted">Inverter</div>
                    <div className="fs-4 fw-bold text-info">{systemSpecs.inverterKva} <small>kVA</small></div>
                  </Col>
                  <Col sm={4} className="mb-3 text-center">
                    <div className="small text-muted">Battery</div>
                    <div className="fs-4 fw-bold text-success">{systemSpecs.batteryKwh} <small>kWh</small></div>
                  </Col>
                </Row>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      </Container>

      {/* Save Template Modal */}
      <Modal show={showSaveTemplateModal} onHide={() => setShowSaveTemplateModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Save as System Template</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form.Group className="mb-3">
            <Form.Label>Template Name</Form.Label>
            <Form.Control
              type="text"
              value={newTemplateName}
              onChange={e => setNewTemplateName(e.target.value)}
              placeholder="e.g., 10kW Hybrid System"
            />
          </Form.Group>
          <Form.Group>
            <Form.Label>Description</Form.Label>
            <Form.Control
              as="textarea"
              rows={3}
              value={newTemplateDesc}
              onChange={e => setNewTemplateDesc(e.target.value)}
              placeholder="Describe this system template…"
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowSaveTemplateModal(false)} disabled={savingComponents}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={saveAsTemplate}
            disabled={savingComponents || !newTemplateName.trim()}
          >
            {savingComponents ? (
              <>
                <Spinner as="span" animation="border" size="sm" className="me-2" />
                Saving…
              </>
            ) : 'Save Template'}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}

export default BillOfMaterials;