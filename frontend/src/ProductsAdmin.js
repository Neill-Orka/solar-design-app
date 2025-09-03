import React, { useState, useEffect, useCallback, useMemo } from 'react';
import axios from "axios";
import { Container, Row, Col, Card, Button, Modal, Form, InputGroup, Badge, Spinner, Alert, ButtonGroup, Table, Accordion } from "react-bootstrap";
import { FaTrash, FaEdit, FaPlus } from "react-icons/fa";
import Fuse from 'fuse.js';
import { API_URL } from "./apiConfig";

// Category metadata consistent with SystemBuilder
const CATEGORY_META = {
  'Panel':                          { name: 'Panel',                          icon: 'bi-grid-3x3-gap-fill',     color: 'warning'  },
  'panel':                          { name: 'Panel',                          icon: 'bi-grid-3x3-gap-fill',     color: 'warning'  },
  'Inverter':                       { name: 'Inverter',                       icon: 'bi-box-seam',              color: 'info'     },
  'inverter':                       { name: 'Inverter',                       icon: 'bi-box-seam',              color: 'info'     },
  'Battery':                        { name: 'Battery',                        icon: 'bi-battery-full',          color: 'success'  },
  'Solar Geyser':                   { name: 'Solar Geyser',                   icon: 'bi-thermometer-sun',       color: 'warning'  },
  'Inverter Aux':                   { name: 'Inverter Aux',                   icon: 'bi-hdd-stack-fill',        color: 'secondary'},
  'Lights':                         { name: 'Lights',                         icon: 'bi-lightbulb-fill',        color: 'warning'  },
  'Transport & Logistics':          { name: 'Transport & Logistics',          icon: 'bi-truck',                 color: 'secondary'},
  'Contactor':                      { name: 'Contactor',                      icon: 'bi-toggle-on',             color: 'primary'  },
  'Enclosure':                      { name: 'Enclosure',                      icon: 'bi-box',                   color: 'secondary'},
  'Cable Management':               { name: 'Cable Management',               icon: 'bi-diagram-3-fill',        color: 'dark'     },
  'Human Resources':                { name: 'Human Resources',                icon: 'bi-people-fill',           color: 'secondary'},
  'Conductor':                      { name: 'Conductor',                      icon: 'bi-plug-fill',             color: 'dark'     },
  'VSD':                            { name: 'VSD',                            icon: 'bi-cpu-fill',              color: 'primary'  },
  'Change Over Switch':             { name: 'Change Over Switch',             icon: 'bi-toggle2-off',           color: 'primary'  },
  'HSEQ & Compliance':              { name: 'HSEQ & Compliance',              icon: 'bi-shield-check',          color: 'success'  },
  'Aux Generator':                  { name: 'Aux Generator',                  icon: 'bi-lightning-charge-fill', color: 'warning'  },
  'DB':                             { name: 'DB',                             icon: 'bi-collection-fill',       color: 'secondary'},
  'Monitoring & Control Equipment': { name: 'Monitoring & Control Equipment', icon: 'bi-speedometer2',          color: 'info'     },
  'S&T':                            { name: 'S&T',                            icon: 'bi-tools',                 color: 'secondary'},
  'MPPT':                           { name: 'MPPT',                           icon: 'bi-cpu',                   color: 'primary'  },
  'Mounting System':                { name: 'Mounting System',                icon: 'bi-grid-1x2-fill',         color: 'secondary'},
  'Monitoring':                     { name: 'Monitoring',                     icon: 'bi-display-fill',          color: 'info'     },
  'Auxiliaries':                    { name: 'Auxiliaries',                    icon: 'bi-gear-fill',             color: 'secondary'},
  'Cable':                          { name: 'Cable',                          icon: 'bi-plug-fill',             color: 'dark'     },
  'Protection':                     { name: 'Protection',                     icon: 'bi-shield-slash-fill',     color: 'danger'   },
  'Professional Services':          { name: 'Professional Services',          icon: 'bi-briefcase-fill',        color: 'secondary'},
  // Legacy lowercase entries for backward compatibility
  'fuse':                           { name: 'Fuses',                          icon: 'bi-shield-slash-fill',     color: 'danger'   },
  'breaker':                        { name: 'Circuit Breakers',               icon: 'bi-lightning-charge-fill', color: 'danger'   },
  'isolator':                       { name: 'Isolators',                      icon: 'bi-plugin-fill',           color: 'secondary'},
  'dc_cable':                       { name: 'DC Cables',                      icon: 'bi-plug-fill',             color: 'dark'     },
  'accessory':                      { name: 'Accessories',                    icon: 'bi-gear-fill',             color: 'secondary'},
};

// Default empty product
const EMPTY_PRODUCT = {
  category: 'Panel',
  component_type: '',
  brand: '',
  model: '',
  unit_cost: '',
  margin: '25',
  price: '',
  warranty_y: '',
  notes: ''
};

// Map API field names <-> UI form names
const FIELD_MAP_DB2UI = {
  brand_name: 'brand',
  description: 'model',
  power_rating_w: 'power_w',
  power_rating_kva: 'rating_kva',
  usable_rating_kwh: 'capacity_kwh'
};
const FIELD_MAP_UI2DB = {
  brand: 'brand_name',
  model: 'description',
  power_w: 'power_rating_w',
  rating_kva: 'power_rating_kva',
  capacity_kwh: 'usable_rating_kwh'
};

export default function ProductsAdmin() {
  // Standard state hooks from original implementation
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(EMPTY_PRODUCT);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [viewMode, setViewMode] = useState('list');

  // Dynamic metadata
  const [categories, setCategories] = useState([]);
  const [componentTypes, setComponentTypes] = useState([]);
  const [fieldMetadata, setFieldMetadata] = useState({});
  const [loadingMetadata, setLoadingMetadata] = useState(true);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [initialLoad, setInitialLoad] = useState(true);

  // Excel mode
  const [excelMode, setExcelMode] = useState(false);
  // Draft edits keyed by product.id -> partial changes in UI field names
  const [drafts, setDrafts] = useState({});
  const [saveInfo, setSaveInfo] = useState({ saving: false, savedCount: null });
  const [saveError, setSaveError] = useState('');

  const handleExcelToggle = () => {
    const newMode = !excelMode;
    setExcelMode(newMode);
    // Reset transient UI when leaving Excel Mode
    if (!newMode) {
      setDrafts({});
      setSaveInfo({ saving: false, savedCount: null });
      setSaveError('');
    }
  };

  // ----- pricing & margin helpers -----
  const calculatePrice = useCallback((unitCost, marginDecimal) => {
    const cost = parseFloat(unitCost) || 0;
    const m = parseFloat(marginDecimal) || 0; // decimal (0.25 = 25%)
    return cost * (1 + m);
  }, []);

  const formatMarginForDisplay = useCallback((marginDecimal) => {
    return ((parseFloat(marginDecimal) || 0) * 100).toFixed(1);
  }, []);

  const formatMarginForBackend = useCallback((displayPercent) => {
    return (parseFloat(displayPercent) || 0) / 100;
  }, []);

  const formatValueForDisplay = useCallback((key, value, product) => {
    if (key === "margin") {
      return formatMarginForDisplay(value) + "%";
    } else if (key === "price") {
      if (product.unit_cost !== undefined && product.margin !== undefined) {
        return "R " + calculatePrice(product.unit_cost, product.margin).toFixed(2);
      } else if (value) {
        return "R " + parseFloat(value).toFixed(2);
      }
      return "";
    } else if (key === "unit_cost") {
      return value ? "R " + parseFloat(value).toFixed(2) : "";
    }
    return value;
  }, [calculatePrice, formatMarginForDisplay]);

  // Load metadata (categories, component types, field metadata)
  useEffect(() => {
    setLoadingMetadata(true);
    Promise.all([
      axios.get(`${API_URL}/api/products/categories`),
      axios.get(`${API_URL}/api/products/component-types`),
      axios.get(`${API_URL}/api/products/field-metadata`)
    ])
      .then(([categoriesRes, componentTypesRes, metadataRes]) => {
        setCategories(categoriesRes.data || []);
        setComponentTypes(componentTypesRes.data || []);
        setFieldMetadata(metadataRes.data || {});
        setLoadingMetadata(false);
      })
      .catch(err => {
        console.error("Failed to load product metadata", err);
        setError('Failed to load product metadata: ' + (err.message || 'Unknown error'));
        setLoadingMetadata(false);
      });
  }, []);

  // form change (modal)
  const handleChange = useCallback((k, v) => {
    setForm(prevForm => {
      const next = { ...prevForm, [k]: v };
      if (k === 'unit_cost' || k === 'margin') {
        const unitCost = k === 'unit_cost' ? v : prevForm.unit_cost;
        const marginDec = k === 'margin' ? formatMarginForBackend(v) : formatMarginForBackend(prevForm.margin);
        next.price = calculatePrice(unitCost, marginDec).toFixed(2);
      }
      return next;
    });
  }, [calculatePrice, formatMarginForBackend]);

  // Load products
  const fetchProducts = useCallback((showSpinner = false) => {
    if (showSpinner) setLoadingProducts(true);
    const token = localStorage.getItem('access_token');
    return axios.get(`${API_URL}/api/products`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => {
        setProducts(r.data || []);
        setError('');
        if (initialLoad) setInitialLoad(false);
      })
      .catch(() => setError('Failed to load products'))
      .finally(() => { if (showSpinner) setLoadingProducts(false); });
  }, [initialLoad]);

  useEffect(() => { fetchProducts(true); }, [fetchProducts]);

  // Modal openers
  const openAdd = useCallback(() => {
    setEditId(null);
    setForm(EMPTY_PRODUCT);
    setShowModal(true);
  }, []);

  const openEdit = useCallback((p) => {
    setEditId(p.id);
    const formData = {
      ...p,
      brand: p.brand || p.brand_name,
      model: p.model || p.description,
      power_w: p.power_w || p.power_rating_w,
      rating_kva: p.rating_kva || p.power_rating_kva,
      capacity_kwh: p.capacity_kwh || p.usable_rating_kwh,
      margin: p.margin ? formatMarginForDisplay(p.margin) : ''
    };
    setForm(formData);
    setShowModal(true);
  }, [formatMarginForDisplay]);

  // Delete
  const deleteProduct = useCallback((id) => {
    if (!window.confirm('Delete this product?')) return;
    const token = localStorage.getItem('access_token');

    axios.delete(`${API_URL}/api/products/${id}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(fetchProducts)
      .catch(() => setError('Failed to delete product'));
  }, [fetchProducts]);

  // Save (modal)
  const handleSave = () => {
    setLoading(true);
    const token = localStorage.getItem('access_token');

    const payload = {
      ...form,
      [FIELD_MAP_UI2DB.brand]: form.brand,
      [FIELD_MAP_UI2DB.model]: form.model,
      [FIELD_MAP_UI2DB.power_w]: form.power_w,
      [FIELD_MAP_UI2DB.rating_kva]: form.rating_kva,
      [FIELD_MAP_UI2DB.capacity_kwh]: form.capacity_kwh
    };

    if (payload.margin !== null && payload.margin !== undefined && payload.margin !== '') {
      payload.margin = formatMarginForBackend(payload.margin);
    }

    if (typeof payload.properties === 'string' && payload.properties.trim()) {
      try { payload.properties = JSON.parse(payload.properties); }
      catch {
        setError('The format of the Properties field is not valid JSON');
        setLoading(false);
        return;
      }
    } else if (!payload.properties) {
      payload.properties = null;
    }

    const req = editId
      ? axios.put(`${API_URL}/api/products/${editId}`, payload, { headers: { Authorization: `Bearer ${token}` } })
      : axios.post(`${API_URL}/api/products`, payload, { headers: { Authorization: `Bearer ${token}` } });

    req.then(() => {
      setShowModal(false);
      fetchProducts();
    })
      .catch(err => setError('Failed to save product: ' + (err.response?.data?.details || err.message)))
      .finally(() => setLoading(false));
  };

  // Applicable field categories
  const getApplicableFieldCategories = useCallback((product) => {
    if (!fieldMetadata || !product.category) return ['general'];
    const applicable = ['general'];
    Object.entries(fieldMetadata).forEach(([key, category]) => {
      if (key !== 'general' && category.applies_to &&
        category.applies_to.some(cat => cat.toLowerCase() === product.category.toLowerCase())) {
        applicable.push(key);
      }
    });
    return applicable;
  }, [fieldMetadata]);

  // Fuzzy search
  const fuse = useMemo(() => {
    if (!products.length) return null;
    const options = { keys: ['brand', 'model', 'category', 'component_type'], threshold: 0.3, ignoreLocation: true, includeScore: false, minMatchCharLength: 2 };
    const records = products.map(p => ({
      ...p,
      categoryName: CATEGORY_META[p.category]?.name || p.category,
      search_blob: [
        p.brand, p.model, p.category, p.component_type, p.power_w || '', p.rating_kva || '', p.capacity_kwh || '', p.description || '', p.notes || ''
      ].join(' ').toLowerCase()
    }));
    return new Fuse(records, options);
  }, [products]);

  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => { const t = setTimeout(() => setDebouncedSearch(search), 300); return () => clearTimeout(t); }, [search]);

  const filtered = useMemo(() => {
    if (!debouncedSearch.trim() || !fuse) return products;
    return fuse.search(debouncedSearch.toLowerCase()).map(r => r.item);
  }, [products, debouncedSearch, fuse]);

  // ---------- Excel Mode helpers ----------
  //? This is for general field ordering (dynamic) hier is die unit cost na selling price
//   const generalFieldOrder = useMemo(() => {
//     const g = fieldMetadata?.general?.fields || {};
//     const keys = Object.keys(g);
//     // Prefer category & component_type first, notes last for table
//     const ordered = [];
//     if (g.category) ordered.push('category');
//     if (g.component_type) ordered.push('component_type');
//     for (const k of keys) if (!['category', 'component_type', 'notes'].includes(k)) ordered.push(k);
//     if (g.notes) ordered.push('notes');
//     return ordered;
//   }, [fieldMetadata]);

  const columnWidths = {
      'category': 160,
      'component_type': 200,
      'brand_name': 200,
      'description': 450,
      'unit_cost': 180,
      'margin': 120,
      'price': 160,
      'warranty_y': 100,
      'last_updated': 150,
      'notes': 150
  };

  const generalFieldOrder = useMemo(() => {
    const orderedFields = [
        'category',
        'component_type',
        'brand_name',
        'description',
        'unit_cost',
        'margin',
        'price',
        'warranty_y',
        'notes',
        'last_updated'
    ];

    return orderedFields.filter(field => 
        field === 'last_updated' || 
        (fieldMetadata?.general?.fields && fieldMetadata.general.fields[field] !== undefined)
    );
  }, [fieldMetadata]);

  const getUIFieldName = (field) => FIELD_MAP_DB2UI[field] || field;

  const mergeWithDraft = (p) => ({ ...p, ...(drafts[p.id] || {}) });

  const updateDraft = (id, field, value) => {
    setDrafts(prev => {
      const prevRow = prev[id] || {};
      const nextRow = { ...prevRow, [field]: value };

      // price auto calc if unit_cost or margin changes
      if (field === 'unit_cost' || field === 'margin') {
        const unitCost = field === 'unit_cost' ? value : (nextRow.unit_cost ?? prevRow.unit_cost ?? products.find(x => x.id === id)?.unit_cost ?? '');
        const marginDec = field === 'margin'
          ? (typeof value === 'string' ? formatMarginForBackend(value) : value)
          : (nextRow.margin ?? prevRow.margin ?? products.find(x => x.id === id)?.margin ?? '');
        const price = calculatePrice(unitCost, marginDec);
        nextRow.price = price.toFixed(2);
      }
      return { ...prev, [id]: nextRow };
    });
  };

  // Compare UI fields we actually show/edit in Excel Mode
  const editableUIFields = useMemo(() => {
    const g = fieldMetadata?.general?.fields || {};
    return generalFieldOrder.map(f => getUIFieldName(f));
  }, [fieldMetadata, generalFieldOrder]);

  const rowHasChanges = (p) => {
    const d = drafts[p.id];
    if (!d) return false;
    // Compare only editable fields
    for (const f of editableUIFields) {
      const orig = (f in p) ? p[f] : p[Object.keys(FIELD_MAP_UI2DB).find(k => FIELD_MAP_UI2DB[k] === f)];
      let o = orig;
      // Also map DB->UI fallback fields for brand/model etc
      if (o === undefined) {
        // fallback known mirrors
        if (f === 'brand') o = p.brand_name;
        if (f === 'model') o = p.description;
      }
      let nv = d[f];
      // margin can be edited as percent string; normalize for compare
      if (f === 'margin') {
        const origDec = parseFloat(p.margin ?? 0);
        const newDec = typeof nv === 'string' ? formatMarginForBackend(nv) : parseFloat(nv ?? 0);
        if (Math.abs((newDec || 0) - (origDec || 0)) > 1e-6) return true;
        continue;
      }
      if (`${nv ?? ''}` !== `${o ?? ''}`) return true;
    }
    return false;
  };

  const editedCount = useMemo(() => filtered.filter(rowHasChanges).length, [filtered, drafts]);

  const discardAll = () => {
    if (Object.keys(drafts).length === 0) return;
    if (!window.confirm('Discard all changes?')) return;
    setDrafts({});
    setSaveInfo({ saving: false, savedCount: null });
    setSaveError('');
  };

  const saveAll = async () => {
    setSaveError('');
    const token = localStorage.getItem('access_token');
    const toSave = filtered.filter(rowHasChanges);

    if (!toSave.length) {
      setSaveInfo({ saving: false, savedCount: 0 });
      return;
    }

    setSaveInfo({ saving: true, savedCount: null });
    try {
      await Promise.all(
        toSave.map((orig) => {
          const d = drafts[orig.id] || {};
          // Build UI-level merged row first
          const merged = { ...orig, ...d };

          // Construct payload in backend field names
          const payload = {};
          for (const f of editableUIFields) {
            let val = merged[f];

            // margin: ensure decimal for backend
            if (f === 'margin') {
              if (typeof val === 'string') val = formatMarginForBackend(val);
              if (typeof val === 'number' && val > 1) val = val / 100; // just in case
            }

            // Map UI -> DB field names when needed
            const dbName = FIELD_MAP_UI2DB[f] || f;
            payload[dbName] = val;
          }

          // price: prefer auto-calculated if unit_cost/margin provided
          if ((merged.unit_cost ?? '') !== '' && (merged.margin ?? '') !== '') {
            const marginDec = typeof merged.margin === 'string'
              ? formatMarginForBackend(merged.margin)
              : (merged.margin ?? 0);
            payload.price = calculatePrice(merged.unit_cost, marginDec).toFixed(2);
          } else if (merged.price !== undefined) {
            payload.price = merged.price;
          }

          // properties normalization if present in drafts
          if (typeof payload.properties === 'string' && payload.properties.trim()) {
            try { payload.properties = JSON.parse(payload.properties); }
            catch { /* ignore here; backend will complain if invalid */ }
          }

          return axios.put(`${API_URL}/api/products/${orig.id}`, payload, {
            headers: { Authorization: `Bearer ${token}` }
          });
        })
      );

      setSaveInfo({ saving: false, savedCount: toSave.length });
      setDrafts({});
      await fetchProducts();
    } catch (e) {
      setSaveInfo({ saving: false, savedCount: null });
      setSaveError(e?.response?.data?.details || e?.message || 'Failed to save changes');
    }
  };

  // ---------- UI field renderers ----------
  const renderExcelCell = (row, dbFieldKey) => {
    // Special handling for last_updated field
    if (dbFieldKey === 'last_updated') {
        return (
            <div className='d-flex flex-column'>
                <small className='text-muted'>
                    {row.updated_at ? new Date(row.updated_at).toLocaleDateString('en-GB'): '-'}
                </small>
                {row.updated_by && (
                    <small className='text-muted' style={{ fontSize: '0.7rem'}}>
                        by {row.updated_by}
                    </small>
                )}
            </div>
        )
    }
    const meta = fieldMetadata?.general?.fields?.[dbFieldKey];
    const uiField = getUIFieldName(dbFieldKey);
    const p = mergeWithDraft(row);

    const commonProps = {
      size: "sm",
      style: { fontSize: '0.85rem', paddingTop: 4, paddingBottom: 4 }
    };

    if (!meta) {
      return <span style={{ fontSize: '0.85rem' }}>{p[uiField] ?? ''}</span>;
    }

    if (meta.readonly) {
      // Show formatted price / margin if needed
      if (uiField === 'price') return <span>{formatValueForDisplay('price', p.price, p)}</span>;
      if (uiField === 'margin') return <span>{formatValueForDisplay('margin', p.margin, p)}</span>;
      if (uiField === 'unit_cost') return <span>{formatValueForDisplay('unit_cost', p.unit_cost, p)}</span>;
      return <span style={{ fontSize: '0.85rem', color: '#6c757d' }}>{p[uiField] ?? ''}</span>;
    }

    switch (meta.type) {
      case 'select': {
        if (meta.source === 'categories') {
          return (
            <Form.Select
              {...commonProps}
              value={p[uiField] ?? ''}
              onChange={(e) => updateDraft(row.id, uiField, e.target.value)}
            >
              <option value="">Select...</option>
              {categories.map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </Form.Select>
          );
        }
        if (meta.source === 'component-types') {
          return (
            <Form.Select
              {...commonProps}
              value={p[uiField] ?? ''}
              onChange={(e) => updateDraft(row.id, uiField, e.target.value)}
            >
              <option value="">Select...</option>
              {componentTypes.map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </Form.Select>
          );
        }
        return (
          <Form.Select
            {...commonProps}
            value={p[uiField] ?? ''}
            onChange={(e) => updateDraft(row.id, uiField, e.target.value)}
          >
            <option value="">Select...</option>
            {meta.options?.map(opt => <option key={opt} value={opt}>{opt}</option>)}
          </Form.Select>
        );
      }
      case 'textarea':
        return (
          <Form.Control
            as="textarea"
            rows={1}
            {...commonProps}
            value={p[uiField] ?? ''}
            onChange={(e) => updateDraft(row.id, uiField, e.target.value)}
          />
        );
      case 'checkbox':
        return (
          <div className="text-center">
            <Form.Check
              type="checkbox"
              checked={!!p[uiField]}
              onChange={(e) => updateDraft(row.id, uiField, e.target.checked)}
            />
          </div>
        );
      default: {
        // Handle margin/display and price formatting
        if (uiField === 'margin') {
          const display = drafts[row.id]?.margin !== undefined
            ? drafts[row.id].margin
            : (p.margin !== undefined ? formatMarginForDisplay(p.margin) : '');
          return (
            <InputGroup size="sm">
              <Form.Control
                type="number"
                step="0.1"
                min="0"
                {...commonProps}
                value={display}
                onChange={(e) => updateDraft(row.id, 'margin', e.target.value)}
              />
              <InputGroup.Text>%</InputGroup.Text>
            </InputGroup>
          );
        }
        if (uiField === 'unit_cost') {
          return (
            <InputGroup size="sm">
              <InputGroup.Text>R</InputGroup.Text>
              <Form.Control
                type="number"
                step="0.01"
                min="0"
                {...commonProps}
                value={p.unit_cost ?? ''}
                onChange={(e) => updateDraft(row.id, 'unit_cost', e.target.value)}
              />
            </InputGroup>
          );
        }
        if (uiField === 'price') {
          // Display-only, auto-calculated (still show current computed)
          const disp = "R " + (
            (p.unit_cost !== undefined && p.margin !== undefined)
              ? calculatePrice(p.unit_cost, (typeof p.margin === 'string' ? formatMarginForBackend(p.margin) : p.margin || 0)).toFixed(2)
              : (parseFloat(p.price || 0).toFixed(2))
          );
          return <span style={{ fontWeight: 600 }}>{disp}</span>;
        }

        return (
          <Form.Control
            type={meta.type || 'text'}
            {...commonProps}
            value={p[uiField] ?? ''}
            onChange={(e) => updateDraft(row.id, uiField, e.target.value)}
          />
        );
      }
    }
  };

  // Modal field renderer (unchanged)
  const renderFormField = (field, meta) => {
    const formField = FIELD_MAP_DB2UI[field] || field;

    switch (meta.type) {
      case 'select':
        return (
          <Form.Select
            value={form[formField] || ''}
            onChange={(e) => handleChange(formField, e.target.value)}
            size="lg"
            className="rounded-lg"
          >
            <option value="">Select {meta.label}</option>
            {meta.source === 'categories'
              ? categories.map(opt => <option key={opt} value={opt}>{opt}</option>)
              : meta.source === 'component-types'
                ? componentTypes.map(opt => <option key={opt} value={opt}>{opt}</option>)
                : meta.options?.map(opt => <option key={opt} value={opt}>{opt}</option>)
            }
          </Form.Select>
        );
      case 'textarea':
        return (
          <Form.Control
            as="textarea"
            rows={3}
            value={form[formField] || ''}
            onChange={(e) => handleChange(formField, e.target.value)}
            className="rounded-lg"
            readOnly={meta.readonly}
          />
        );
      case 'checkbox':
        return (
          <Form.Check
            type="checkbox"
            checked={!!form[formField]}
            onChange={(e) => handleChange(formField, e.target.checked)}
          />
        );
      default:
        return (
          <Form.Control
            type={meta.type}
            value={form[formField] || ''}
            onChange={(e) => handleChange(formField, e.target.value)}
            size="lg"
            className="rounded-lg"
            readOnly={meta.readonly}
            style={meta.readonly ? { backgroundColor: '#f8f9fa' } : {}}
          />
        );
    }
  };

  const getRatingBadge = (product) => {
    if (product.category === 'Panel' || product.category === 'panel') {
      const powerValue = product.power_w || product.power_rating_w;
      if (powerValue && parseFloat(powerValue) > 0) {
        return <Badge bg="warning" text="dark" className="ms-2">{powerValue}W</Badge>;
      }
    } else if (product.category === 'Inverter' || product.category === 'inverter') {
      const ratingValue = product.rating_kva || product.power_rating_kva;
      if (ratingValue && parseFloat(ratingValue) > 0) {
        return <Badge bg="info" className="ms-2">{ratingValue}kVA</Badge>;
      }
    } else if (product.category === 'Battery' || product.category === 'battery') {
      const capacityValue = product.capacity_kwh || product.usable_rating_kwh;
      if (capacityValue && parseFloat(capacityValue) > 0) {
        return <Badge bg="success" className="ms-2">{capacityValue}kWh</Badge>;
      }
    }
    return null;
  };

  // ---------- RENDER ----------
  return (
    <div className='min-vh-100' style={{ backgroundColor: '#f8f9fa' }}>
      <Container fluid className="py-4 py-md-5">
        <Row>
          <Col lg={12}>
            <Card className="shadow-lg border-0 rounded-xl p-4 p-md-5">
              <div className="d-flex justify-content-between align-items-center mb-4">
                <div>
                  <h2 className="text-3xl font-bold text-gray-800 mb-1">
                    <i className="bi bi-box-seam me-3"></i>Products Catalogue
                  </h2>
                  <p className="text-muted mb-0">Manage solar panels, inverters, and batteries</p>
                </div>

                <div className="d-flex align-items-center gap-3">
                  {excelMode && (
                    <div className="d-flex align-items-center gap-2">
                      <Button
                        variant="outline-secondary"
                        size="sm"
                        onClick={discardAll}
                        disabled={!editedCount}
                        title="Discard all changes"
                      >
                        Discard
                      </Button>
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={saveAll}
                        disabled={!editedCount || saveInfo.saving}
                        title="Save all changes"
                      >
                        {saveInfo.saving ? 'Saving…' : `Save All (${editedCount})`}
                      </Button>
                    </div>
                  )}

                  <div className="mode-switch card shadow-sm border-0 px-3 py-2 d-flex align-items-center">
                    <Form.Check
                      type="switch"
                      id="excel-mode-switch"
                      label={excelMode ? 'Excel Mode' : 'Normal Mode'}
                      checked={excelMode}
                      onChange={handleExcelToggle}
                    />
                  </div>

                  <Button onClick={openAdd} className="btn btn-primary shadow-sm">
                    <FaPlus className="me-2" />Add Product
                  </Button>
                </div>
              </div>

              {/* Search */}
              <Card className='shadow-sm border-0 rounded-xl p-3 mb-4'>
                <Row className='g-3 align-items-center'>
                  <Col md={8}>
                    <InputGroup>
                      <InputGroup.Text className="bg-light border-end-0">
                        <i className="bi bi-search"></i>
                      </InputGroup.Text>
                      <Form.Control
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Search products by brand, model, category, or specs..."
                        className="border-start-0 rounded-end-lg"
                      />
                    </InputGroup>
                  </Col>
                  {!excelMode && (
                    <Col md={4} className="d-flex justify-content-end">
                      <ButtonGroup>
                        <Button
                          variant={viewMode === 'card' ? 'primary' : 'outline-secondary'}
                          onClick={() => setViewMode('card')}
                          title='Card View'
                        >
                          <i className="bi bi-grid-3x3-gap-fill"></i>
                        </Button>
                        <Button
                          variant={viewMode === 'list' ? 'primary' : 'outline-secondary'}
                          onClick={() => setViewMode('list')}
                          title='List View'
                        >
                          <i className="bi bi-list-ul"></i>
                        </Button>
                      </ButtonGroup>
                    </Col>
                  )}
                </Row>
              </Card>

              {error && <Alert variant="danger" className="mb-3">{error}</Alert>}
              {saveError && <Alert variant="danger" className="mb-3">{saveError}</Alert>}
              {saveInfo.savedCount !== null && (
                <Alert variant="success" className="mb-3">
                  Updated {saveInfo.savedCount} product{saveInfo.savedCount === 1 ? '' : 's'}.
                </Alert>
              )}

              {(loadingMetadata || (loadingProducts && initialLoad)) ? (
                <Card className="shadow-sm border-0 rounded-xl">
                  <Table hover responsive className="mb-0" size="sm">
                    <thead className="table-light">
                      <tr style={{ fontSize: '0.9rem' }}>
                        <th className="ps-3">Category</th>
                        <th>Component Type</th>
                        <th>Brand</th>
                        <th>Model</th>
                        <th>Price</th>
                        <th>Last Updated</th>
                        <th className="text-end pe-3">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td colSpan="7" className="text-center py-5">
                          <div className="loading-container">
                            <div className="loading-spinner"></div>
                            <p className="mt-3">Loading products...</p>
                          </div>
                        </td>
                      </tr>
                    </tbody>
                  </Table>
                </Card>
              ) : filtered.length === 0 ? (
                <div className="text-center py-5">
                  <i className="bi bi-box" style={{ fontSize: '4rem', color: '#9ca3af' }}></i>
                  <h4 className="mt-3 text-gray-700">No Products Found</h4>
                  <p className="text-muted mb-4">
                    {search ? `No products match "${search}"` : 'Add your first product to get started'}
                  </p>
                  {!search && (
                    <Button onClick={openAdd} variant="primary">
                      <FaPlus className="me-2" />Add First Product
                    </Button>
                  )}
                </div>
              ) : excelMode ? (
                // ---------- Excel Mode Table ----------
                <Card className="shadow-sm border-0 rounded-xl">
                  <Table hover responsive className="mb-0" size="sm">
                    <thead className="table-light">
                      <tr style={{ fontSize: '0.85rem' }}>
                        {generalFieldOrder.map((dbField) => (
                          <th key={dbField} className="py-2" style={{ 
                            width: columnWidths[dbField] || 'auto',
                            maxWidth: columnWidths[dbField] || 'none',
                            whiteSpace: 'normal',
                            wordBreak: 'break-word'
                          }}>
                            {dbField === 'last_updated'
                             ? "Last Updated"
                             : fieldMetadata?.general?.fields?.[dbField]?.label || dbField}
                          </th>
                        ))}
                        <th className="text-center py-2" title="Changed?">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map(row => (
                        <tr key={row.id} style={{ verticalAlign: 'middle', fontSize: '0.85rem' }}>
                          {generalFieldOrder.map(dbField => (
                            <td key={`${row.id}-${dbField}`} style={{ 
                                width: columnWidths[dbField] || 100,
                                maxWidth: columnWidths[dbField] || 'none',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis'
                            }}>
                              {renderExcelCell(row, dbField)}
                            </td>
                          ))}
                          <td className="text-center">
                            {rowHasChanges(row) ? <Badge bg="warning" text="dark">Edited</Badge> : <span className="text-muted">—</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </Card>
              ) : viewMode === 'card' ? (
                // ---------- Card View ----------
                (loadingMetadata || (loadingProducts && initialLoad)) ? (
                  <div className="text-center py-5">
                    <div className="loading-container">
                      <div className="loading-spinner"></div>
                      <p className="mt-3">Loading products...</p>
                    </div>
                  </div>
                ) : (
                  <Row xs={1} md={2} lg={3} xl={4} className="g-4">
                    {filtered.map(product => (
                      <Col key={product.id}>
                        <Card className="h-100 shadow-sm border-light hover-shadow">
                          <Card.Body className="p-4">
                            <div className="d-flex align-items-center mb-3">
                              <div className={`bg-${getCategoryColor(product.category)} bg-opacity-10 rounded-circle p-2 me-3`}>
                                <i className={`bi ${getCategoryIcon(product.category)} text-${getCategoryColor(product.category)}`}></i>
                              </div>
                              <Badge bg={getCategoryColor(product.category)} className="text-capitalize">
                                {getCategoryName(product.category)}
                              </Badge>
                            </div>

                            <Card.Title className="h5 mb-2">{product.brand}</Card.Title>
                            <Card.Subtitle className="text-muted mb-3">
                              {product.model}
                              {getRatingBadge(product)}
                            </Card.Subtitle>

                            <div className="mb-3">
                              <div className="d-flex justify-content-between align-items-center mb-1">
                                <small className="text-muted">Component Type:</small>
                                <span>{product.component_type || '—'}</span>
                              </div>

                              {product.unit_cost && (
                                <div className="d-flex justify-content-between align-items-center mb-1">
                                  <small className="text-muted">Unit Cost:</small>
                                  <Badge bg="secondary">
                                    {formatValueForDisplay('unit_cost', product.unit_cost, product)}
                                  </Badge>
                                </div>
                              )}

                              {product.margin && (
                                <div className="d-flex justify-content-between align-items-center mb-1">
                                  <small className="text-muted">Margin:</small>
                                  <Badge bg="info">
                                    {formatValueForDisplay('margin', product.margin, product)}
                                  </Badge>
                                </div>
                              )}

                              <div className="d-flex justify-content-between align-items-center mb-1">
                                <small className="text-muted">Price:</small>
                                <Badge bg="primary">
                                  {formatValueForDisplay('price', product.price, product)}
                                </Badge>
                              </div>
                            </div>

                            <div className="d-flex gap-2 mt-auto">
                              <Button
                                variant="outline-primary"
                                size="sm"
                                className="flex-fill"
                                onClick={() => openEdit(product)}
                              >
                                <FaEdit className="me-1" />Edit
                              </Button>
                              <Button
                                variant="outline-danger"
                                size="sm"
                                className="flex-fill"
                                onClick={() => deleteProduct(product.id)}
                              >
                                <FaTrash className="me-1" />Delete
                              </Button>
                            </div>
                          </Card.Body>
                        </Card>
                      </Col>
                    ))}
                  </Row>
                )
              ) : (
                // ---------- List View ----------
                <Card className="shadow-sm border-0 rounded-xl">
                  <Table hover responsive className="mb-0" size="sm">
                    <thead className="table-light">
                      <tr style={{ fontSize: '0.9rem' }}>
                        <th className="ps-3" style={{ width: "10%" }}>Category</th>
                        <th style={{ width: "12%" }}>Component Type</th>
                        <th style={{ width: "10%" }}>Brand</th>
                        <th style={{ width: "25%" }}>Model</th>
                        <th style={{ width: "15%" }}>Price</th>
                        <th style={{ width: "15%" }}>Last Updated</th>
                        <th className="text-end pe-3" style={{ width: "13%" }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map(product => (
                        <tr key={product.id} style={{ verticalAlign: 'middle', fontSize: '0.85rem' }}>
                          <td className="ps-3 py-2">
                            <div className="d-flex align-items-center">
                              <div className={`bg-${getCategoryColor(product.category)} bg-opacity-10 rounded-circle p-1 me-2`} style={{ width: "24px", height: "24px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                <i className={`bi ${getCategoryIcon(product.category)} text-${getCategoryColor(product.category)}`} style={{ fontSize: '0.7rem' }}></i>
                              </div>
                              <Badge bg={getCategoryColor(product.category)} className="text-capitalize" style={{ fontSize: '0.7rem' }}>
                                {getCategoryName(product.category)}
                              </Badge>
                            </div>
                          </td>
                          <td className="py-2">
                            <span className="text-muted" style={{ fontSize: '0.8rem' }}>{product.component_type || '—'}</span>
                          </td>
                          <td className="fw-semibold py-2" style={{ fontSize: '0.85rem' }}>{product.brand}</td>
                          <td className="py-2">
                            <div>
                              <span style={{ fontSize: '0.9rem' }}>{product.model}</span>
                              {getRatingBadge(product)}
                            </div>
                          </td>
                          <td className="py-2">
                            <div className="d-flex flex-column gap-1">
                              {(product.unit_cost && product.margin) ? (
                                <>
                                  <Badge bg="primary">
                                    {formatValueForDisplay('price', null, product)}
                                  </Badge>
                                  <small className="text-muted">
                                    Cost: {formatValueForDisplay('unit_cost', product.unit_cost, product)} |
                                    Margin: {formatValueForDisplay('margin', product.margin, product)}
                                  </small>
                                </>
                              ) : product.price ? (
                                <Badge bg="primary">{formatValueForDisplay('price', product.price, product)}</Badge>
                              ) : (
                                <span className="text-muted">No price set</span>
                              )}
                            </div>
                          </td>
                          <td>
                            <div className="d-flex flex-column">
                              <small className="text-muted">
                                {product.updated_at ? new Date(product.updated_at).toLocaleDateString('en-GB') : '—'}
                              </small>
                              {product.updated_by && (
                                <small className="text-muted" style={{ fontSize: '0.7rem' }}>
                                  by {product.updated_by}
                                </small>
                              )}
                            </div>
                          </td>
                          <td className="text-end pe-3 py-2">
                            <Button
                              variant="outline-primary"
                              size="sm"
                              className="me-1"
                              style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
                              onClick={() => openEdit(product)}
                            >
                              <FaEdit className="me-1" />Edit
                            </Button>
                            <Button
                              variant="outline-danger"
                              size="sm"
                              style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
                              onClick={() => deleteProduct(product.id)}
                            >
                              <FaTrash />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </Card>
              )}
            </Card>
          </Col>
        </Row>
      </Container>

      {/* Dynamic Product Form Modal (Normal Mode) */}
      <Modal show={showModal} onHide={() => setShowModal(false)} size="lg" centered>
        <Modal.Header closeButton className="bg-light">
          <Modal.Title>
            <i className={`bi ${editId ? 'bi-pencil-fill' : 'bi-plus-lg'} me-2`}></i>
            {editId ? 'Edit Product' : 'Add Product'}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ maxHeight: '70vh', overflowY: 'auto' }} className="p-4">
          {loadingMetadata ? (
            <div className="text-center py-5">
              <Spinner animation="border" variant="primary" />
              <p className="mt-3">Loading product fields...</p>
            </div>
          ) : (
            <Form>
              <Accordion defaultActiveKey="general">
                {/* General Information */}
                {fieldMetadata.general && (
                  <Accordion.Item eventKey="general">
                    <Accordion.Header>General Information</Accordion.Header>
                    <Accordion.Body>
                      <Row className="g-3">
                        {['category', 'component_type'].map(field => {
                          const meta = fieldMetadata.general.fields[field];
                          if (!meta) return null;
                          return (
                            <Col md={6} key={field}>
                              <Form.Group>
                                <Form.Label className="fw-semibold">
                                  {meta.label}
                                  {meta.readonly && <small className="text-muted ms-2">(Auto-calculated)</small>}
                                </Form.Label>
                                {renderFormField(field, meta)}
                              </Form.Group>
                            </Col>
                          );
                        })}

                        {Object.entries(fieldMetadata.general.fields)
                          .filter(([field]) => !['category', 'component_type', 'notes'].includes(field))
                          .map(([field, meta]) => (
                            <Col md={6} key={field}>
                              <Form.Group>
                                <Form.Label className="fw-semibold">
                                  {meta.label}
                                  {meta.readonly && <small className="text-muted ms-2">(Auto-calculated)</small>}
                                </Form.Label>
                                {renderFormField(field, meta)}
                              </Form.Group>
                            </Col>
                          ))}

                        {fieldMetadata.general.fields.notes && (
                          <Col md={12}>
                            <Form.Group>
                              <Form.Label className="fw-semibold">
                                {fieldMetadata.general.fields.notes.label}
                              </Form.Label>
                              {renderFormField('notes', fieldMetadata.general.fields.notes)}
                            </Form.Group>
                          </Col>
                        )}
                      </Row>
                    </Accordion.Body>
                  </Accordion.Item>
                )}

                {/* Other applicable categories */}
                {getApplicableFieldCategories(form)
                  .filter(key => key !== 'general')
                  .sort()
                  .map(categoryKey => {
                    const category = fieldMetadata[categoryKey];
                    return (
                    <Accordion.Item eventKey={categoryKey} key={categoryKey}>
                        <Accordion.Header>{category.title}</Accordion.Header>
                        <Accordion.Body>
                        <Row className="g-3">
                            {categoryKey === 'specs' && form.category === 'Panel' && (
                              <Col md={6}>
                                <Form.Group>
                                  <Form.Label className="fw-semibold">Power (W)</Form.Label>
                                  <Form.Control
                                    type="number"
                                    value={form.power_w || ''}
                                    onChange={e => handleChange('power_w', e.target.value)}
                                    className="rounded"
                                    placeholder="e.g., 400"
                                  />
                                </Form.Group>
                              </Col>
                            )}
                                                        
                            {categoryKey === 'specs' && form.category === 'Inverter' && (
                                <Col md={6}>
                                    <Form.Group>
                                        <Form.Label className="fw-semibold">Rating (kVA)</Form.Label>
                                        <Form.Control
                                            type="number"
                                            value={form.rating_kva || ''}
                                            onChange={e => handleChange('rating_kva', e.target.value)}
                                            className="rounded"
                                            placeholder="e.g., 5"
                                        />
                                    </Form.Group>
                                </Col>
                            )}
                                                        
                            {categoryKey === 'specs' && form.category === 'Battery' && (
                                <Col md={6}>
                                    <Form.Group>
                                        <Form.Label className="fw-semibold">Capacity (kWh)</Form.Label>
                                        <Form.Control
                                            type="number"
                                            value={form.capacity_kwh || ''}
                                            onChange={e => handleChange('capacity_kwh', e.target.value)}
                                            className="rounded"
                                            placeholder="e.g., 10"
                                        />
                                    </Form.Group>
                                </Col>
                            )}
                                                        
                            {/* Render other category fields */}
                            {Object.entries(category.fields).map(([field, meta]) => (
                                <Col md={6} key={field}>
                                    <Form.Group>
                                        <Form.Label className="fw-semibold">
                                            {meta.label}
                                            {meta.readonly && <small className="text-muted ms-2">(Auto-calculated)</small>}
                                        </Form.Label>
                                        {renderFormField(field, meta)}
                                    </Form.Group>
                                </Col>
                            ))}
                        </Row>
                        </Accordion.Body>
                    </Accordion.Item>
                    );
                })}
                </Accordion>
            </Form>
        )}
            </Modal.Body>
                <Modal.Footer className="bg-light border-top sticky-bottom">
                    <Button variant="outline-secondary" onClick={() => setShowModal(false)} size="lg">
                        Cancel
                    </Button>
                    <Button variant="primary" onClick={handleSave} disabled={loading || loadingMetadata} size="lg">
                        {loading ? (
                            <>
                                <Spinner as="span" animation="border" size="sm" className="me-2" />
                                Saving...
                            </>
                        ) : (
                            <>
                                <i className="bi bi-check-lg me-2"></i>
                                Save Product
                            </>
                        )}
                    </Button>
                </Modal.Footer>
            </Modal>
        </div>
    );
}

// Helper functions for category display
const getCategoryIcon = (category) => {
    return CATEGORY_META[category]?.icon || 'bi-gear-fill';
};

const getCategoryColor = (category) => {
    return CATEGORY_META[category]?.color || 'secondary';
};

const getCategoryName = (category) => {
    return CATEGORY_META[category]?.name || category;
};
