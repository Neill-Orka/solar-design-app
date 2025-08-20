import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import {
  Container, Row, Col, Card, Button, Form, Spinner,
  Alert, InputGroup, Badge, Table, ButtonGroup, Modal
} from 'react-bootstrap';
import { API_URL } from './apiConfig';
import { useNotification } from './NotificationContext';
import Fuse from 'fuse.js';

/* ---------- Category meta (display only) ---------- */
const CATEGORY_META = {
  // Main system components
  panel:                 { name: 'Panel',                        icon: 'bi-grid-3x3-gap-fill',     color: 'warning'  },
  inverter:              { name: 'Inverter',                     icon: 'bi-box-seam',              color: 'info'     },
  battery:               { name: 'Battery',                      icon: 'bi-battery-full',          color: 'success'  },
  mppt:                  { name: 'MPPT',                         icon: 'bi-arrow-down-up',         color: 'info'     },
  
  // Components & protection
  protection:            { name: 'Protection',                   icon: 'bi-shield-slash-fill',     color: 'danger'   },
  inverter_aux:          { name: 'Inverter Aux',                 icon: 'bi-hdd-stack-fill',        color: 'secondary'},
  contactor:             { name: 'Contactor',                    icon: 'bi-lightning-charge-fill', color: 'danger'   },
  enclosure:             { name: 'Enclosure',                    icon: 'bi-box',                   color: 'secondary'},
  change_over_switch:    { name: 'Change Over Switch',           icon: 'bi-toggle-on',             color: 'secondary'},
  db:                    { name: 'DB',                           icon: 'bi-hdd-network',           color: 'secondary'},
  
  // Cables & management
  cable:                 { name: 'Cable',                        icon: 'bi-lightning',             color: 'dark'     },
  cable_management:      { name: 'Cable Management',             icon: 'bi-bezier2',               color: 'dark'     },
  conductor:             { name: 'Conductor',                    icon: 'bi-plug-fill',             color: 'dark'     },
  
  // Installation & mounting
  mounting_system:       { name: 'Mounting System',              icon: 'bi-bricks',                color: 'secondary'},
  
  // Monitoring & accessories
  monitoring:            { name: 'Monitoring',                   icon: 'bi-graph-up',              color: 'primary'  },
  monitoring_control:    { name: 'Monitoring & Control Equipment', icon: 'bi-display',             color: 'primary'  },
  auxiliaries:           { name: 'Auxiliaries',                  icon: 'bi-tools',                 color: 'secondary'},
  
  // Other equipment
  solar_geyser:          { name: 'Solar Geyser',                 icon: 'bi-water',                 color: 'info'     },
  lights:                { name: 'Lights',                       icon: 'bi-lightbulb',             color: 'warning'  },
  aux_generator:         { name: 'Aux Generator',                icon: 'bi-lightning-charge',      color: 'warning'  },
  vsd:                   { name: 'VSD',                          icon: 'bi-speedometer2',          color: 'info'     },
  
  // Services & logistics
  professional_services: { name: 'Professional Services',        icon: 'bi-person-badge',          color: 'primary'  },
  transport_logistics:   { name: 'Transport & Logistics',        icon: 'bi-truck',                 color: 'dark'     },
  human_resources:       { name: 'Human Resources',              icon: 'bi-people',                color: 'primary'  },
  hseq_compliance:       { name: 'HSEQ & Compliance',            icon: 'bi-check-circle',          color: 'success'  },
  st:                    { name: 'S&T',                          icon: 'bi-clipboard-check',       color: 'secondary'},
  
  // Fallbacks
  0:                     { name: 'Uncategorized',                icon: 'bi-question-circle',       color: 'secondary'},
  other:                 { name: 'Other',                        icon: 'bi-box',                   color: 'secondary'}
};

// Add this constant near the top of your file, after CATEGORY_META
const CATEGORY_PRIORITY = ['panel', 'inverter', 'battery'];


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

// Helper function to check if a component is a core component that can only have margin edited
const isCoreComponent = (category) => {
  return ['panel', 'inverter', 'battery'].includes(category);
};

const normalizeMarginToDecimal = (m) => {
  const v = toNumber(m);
  if (!Number.isFinite(v) || v < 0) return DEFAULT_MARGIN_DEC;
  
  // If value is small (likely 1%), use default margin instead
  if (v < 0.1) return DEFAULT_MARGIN_DEC;
  
  // Otherwise handle as before
  return v <= 1 ? v : v / 100;
}

const computeUnitCost = (product) => toNumber(product?.unit_cost);

const computeMarginPct = (product) => normalizeMarginToDecimal(product?.margin);

// effective margin for a BOM row: override -> product -> default (25%)
const getRowMarginDecimal = (row) => {
  if (row?.override_margin != null) return Number(row.override_margin);
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
function BillOfMaterials({ projectId, onNavigateToPrintBom }) {
  const { showNotification } = useNotification();

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
  
  // State for margin editing (allows blank values during editing)
  const [editingMargins, setEditingMargins] = useState({});

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

  // Clear editing margins when BOM components change (e.g., on load)
  useEffect(() => {
    setEditingMargins({});
  }, [bomComponents.length]); // Only trigger when the number of components changes

  // Auto-save BOM when design modifications are detected for standard designs
  useEffect(() => {
    const autoSaveBOM = async () => {
      if (!isStandardDesign || !bomComponents.length) return;
      
      const designModified = sessionStorage.getItem(`systemDesignModified_${projectId}`) === 'true';
      if (designModified) {
        try {
          // Auto-save the current BOM state to preserve design changes
          const parsedExtras = parseFloat(extrasCost || '0') || 0;
          const isDraft = (quoteStatus === 'draft');

          const components = bomComponents.map(c => {
            const liveUnit = computeDerivedUnitFromRow(c);
            const liveCost = computeUnitCost(c.product);
            return {
              product_id: c.product.id,
              quantity: Math.max(1, Number(c.quantity) || 1),
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

          console.log('Auto-saved BOM with design modifications');
        } catch (err) {
          console.warn('Auto-save BOM failed:', err);
        }
      }
    };

    // Only auto-save after initial load is complete
    if (!loading && bomComponents.length > 0) {
      autoSaveBOM();
    }
  }, [bomComponents, isStandardDesign, projectId, extrasCost, quoteStatus, templateInfo, loading]);

  // Fuse instance for fuzzy search
  const fuse = useMemo(() => {
    const options = {
      keys: [
        'brand',
        'model',
        'category',
        {
          name: 'categoryName',
          getFn: (product) => CATEGORY_META[product.category]?.name || product.category
        },
        'power_w',
        'rating_kva',
        'capacity_kwh'
      ],
      threshold: 0.4, // Lower means more strict matching
      ignoreLocation: true,
      useExtendedSearch: true
    };

    const records = products.map(p => ({
      ...p,
      categoryName: CATEGORY_META[p.category]?.name || p.category
    }));

    return new Fuse(records, options);
  }, [products]);  


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
        current_price: computeDerivedUnitFromRow({ product: prod }),
        override_margin: null  // Templates start with no margin override
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
      // Find existing panel component to preserve margin override
      const existingPanel = result.find(x => x.product?.category === 'panel' && x.product?.id === projectData.panel_id);
      result = result.filter(x => x.product?.category !== 'panel');
      // Use stored num_panels directly instead of calculating to avoid rounding issues
      const qty = projectData.num_panels || 1;
      result.push({ 
        product: prod, 
        quantity: qty, 
        price_at_time: null, 
        current_price: computeDerivedUnitFromRow({ product: prod }),
        override_margin: existingPanel?.override_margin || null  // Preserve margin override
      });
    }
  }

  // Inverters
  if (projectData.inverter_ids?.length) {
    // Collect existing inverter margins before filtering
    const existingInverters = result.filter(x => x.product?.category === 'inverter');
    result = result.filter(x => x.product?.category !== 'inverter');
    const qty = Number(projectData.inverter_kva?.quantity) || 1;
    projectData.inverter_ids.forEach((id, idx) => {
      const prod = productsData.find(p => p.id === id);
      if (prod) {
        // Find existing margin for this specific inverter
        const existingInverter = existingInverters.find(x => x.product?.id === id);
        result.push({
          product: prod,
          quantity: idx === 0 ? qty : 1,
          price_at_time: null,
          current_price: computeDerivedUnitFromRow({ product: prod }),
          override_margin: existingInverter?.override_margin || null  // Preserve margin override
        });
      }
    });
  }

  // Batteries
  if (projectData.battery_ids?.length) {
    // Collect existing battery margins before filtering
    const existingBatteries = result.filter(x => x.product?.category === 'battery');
    result = result.filter(x => x.product?.category !== 'battery');
    const qty = Number(projectData.battery_kwh?.quantity) || 1;
    projectData.battery_ids.forEach((id, idx) => {
      const prod = productsData.find(p => p.id === id);
      if (prod) {
        // Find existing margin for this specific battery
        const existingBattery = existingBatteries.find(x => x.product?.id === id);
        result.push({
          product: prod,
          quantity: idx === 0 ? qty : 1,
          price_at_time: null,
          current_price: computeDerivedUnitFromRow({ product: prod }),
          override_margin: existingBattery?.override_margin || null  // Preserve margin override
        });
      }
    });
  }

  return result;
};

  /* ---------- NEW HYBRID BOM LOADER ---------- */
const loadProjectBOM = async (pid, productsData, projectData) => {
  console.log('Loading BOM with hybrid approach. Project data:', {
    bom_modified: projectData?.bom_modified,
    template_id: projectData?.template_id,
    template_name: projectData?.template_name
  });

  let finalComponents = [];

  try {
    // Step 1: Determine BOM source strategy
    const hasBOMInDatabase = projectData?.bom_modified === true;
    const hasTemplate = projectData?.template_id || projectData?.template_name;

    if (hasBOMInDatabase) {
      // USER HAS MODIFIED BOM: Load from database + overlay core components
      console.log('Loading from database (user has modified BOM)');
      
      try {
        const bomRes = await axios.get(`${API_URL}/api/projects/${pid}/bom`);
        const savedComponents = bomRes.data || [];
        
        if (savedComponents.length > 0) {
          // Load saved BOM components
          finalComponents = savedComponents.map(saved => {
            const product = productsData.find(p => p.id === saved.product_id);
            return {
              product,
              quantity: saved.quantity,
              price_at_time: saved.price_at_time,
              current_price: saved.current_price,
              override_margin: saved.override_margin
            };
          }).filter(item => item.product); // Remove any with missing products

          // Set metadata
          const meta = savedComponents.find(x => x.quote_status || x.extras_cost);
          if (meta?.quote_status) setQuoteStatus(meta.quote_status);
          if (meta?.extras_cost !== undefined) setExtrasCost(String(meta.extras_cost));
        }
      } catch (e) {
        console.warn('Failed to load saved BOM:', e);
      }

      // Overlay core components from SystemDesign
      finalComponents = overlayFromProject(finalComponents, projectData, productsData);

    } else if (hasTemplate) {
      // FRESH TEMPLATE: Load template + overlay core components
      console.log('Loading from template (fresh/unmodified)');
      
      try {
        let tmpl = null;
        if (projectData.template_id) tmpl = await fetchTemplateById(projectData.template_id);
        if (!tmpl && projectData.template_name) tmpl = await fetchTemplateByName(projectData.template_name);
        
        if (tmpl) {
          // Load template components
          finalComponents = mapTemplateToItems(tmpl, productsData);
          
          // Set template metadata
          if (tmpl.extras_cost !== undefined && tmpl.extras_cost !== null) {
            setExtrasCost(String(tmpl.extras_cost));
          }
          
          // Overlay core components from SystemDesign
          finalComponents = overlayFromProject(finalComponents, projectData, productsData);
        }
      } catch (e) {
        console.warn('Template fetch failed:', e);
      }
    } else {
      // NO TEMPLATE: Only core components from SystemDesign
      console.log('Loading core components only (no template)');
      finalComponents = overlayFromProject([], projectData, productsData);
    }

    // Set the final components
    setBomComponents(finalComponents);
    console.log('Final BOM components:', finalComponents.length, 'items');

  } catch (err) {
    console.error('BOM loading failed:', err);
    showNotification('Failed to load Bill of Materials', 'danger');
  }
};

  /* ---------- Overlay helpers ---------- */
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
        current_price: computeDerivedUnitFromRow({ product }),
        override_margin: null  // New components start with no margin override
      }
    ]);
  };

  const removeComponent = (productId) => {
    // Check if this is a core component that shouldn't be removed
    const componentToRemove = bomComponents.find(c => c.product.id === productId);
    if (componentToRemove && isCoreComponent(componentToRemove.product.category)) {
      showNotification('Core components (Panels, Inverters, Batteries) can only be modified in System Design', 'warning');
      return;
    }
    setBomComponents(bomComponents.filter(c => c.product.id !== productId));
  };

  const updateQuantity = (productId, quantity) => {
    // Check if this is a core component that shouldn't have quantity changed
    const componentToUpdate = bomComponents.find(c => c.product.id === productId);
    if (componentToUpdate && isCoreComponent(componentToUpdate.product.category)) {
      showNotification('Core component quantities can only be modified in System Design', 'warning');
      return;
    }
    // Allow empty string for better UX, but store the actual value
    setBomComponents(bomComponents.map(c =>
      c.product.id === productId ? { ...c, quantity: quantity } : c
    ));
  };

  const handleQuantityBlur = (productId, quantity) => {
    // Check if this is a core component that shouldn't have quantity changed
    const componentToUpdate = bomComponents.find(c => c.product.id === productId);
    if (componentToUpdate && isCoreComponent(componentToUpdate.product.category)) {
      return; // Don't process blur for core components
    }
    // When field loses focus, ensure we have a valid number
    const q = Math.max(1, parseInt(quantity || 1, 10));
    setBomComponents(bomComponents.map(c =>
      c.product.id === productId ? { ...c, quantity: q } : c
    ));
  };

  // Helper function to get the display value for margin input
  const getMarginDisplayValue = (comp) => {
    const productId = comp.product.id;
    // If we're editing this margin, show the editing value
    if (editingMargins.hasOwnProperty(productId)) {
      return editingMargins[productId];
    }
    // Otherwise show the actual margin converted to percentage
    return Math.round(getRowMarginDecimal(comp) * 100);
  };

  const updateMargin = (productId, marginPct) => {
    // Store the raw input value to allow empty strings during editing
    setEditingMargins(prev => ({
      ...prev,
      [productId]: marginPct
    }));
  };

  const handleMarginBlur = (productId, marginPct) => {
    // When field loses focus, ensure we have a valid margin or use default
    const numValue = Number(marginPct);
    let finalMargin = null; // null means use default 25%
    
    if (marginPct !== '' && !isNaN(numValue) && numValue >= 0) {
      // Valid number entered, convert to decimal
      finalMargin = Math.max(0, numValue / 100);
    }
    
    // Update the component with the final margin value
    setBomComponents(bomComponents.map(c => 
      c.product.id === productId ? { ...c, override_margin: finalMargin } : c
    ));
    
    // Clear the editing state
    setEditingMargins(prev => {
      const newState = { ...prev };
      delete newState[productId];
      return newState;
    });
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
          quantity: Math.max(1, Number(c.quantity) || 1),
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
        return sum + unit * (Number(c.quantity) || 0);
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
    // First filter by category if needed
    let results = products;
    if (selectedCategory !== 'all') {
      results = products.filter(p => p.category === selectedCategory);
    }
    
    // If there's no search text, return category-filtered results
    if (!searchFilter.trim()) {
      return results;
    }
    
    // Otherwise, perform fuzzy search
    // If category filter applied, search within that subset
    const searchOn = selectedCategory !== 'all' ? 
      new Fuse(results, fuse.options) : fuse;
      
    return searchOn.search(searchFilter)
      .map(result => result.item);
      
  }, [products, searchFilter, selectedCategory, fuse]);

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

  // Add this new useMemo to create a sorted categories array
  const sortedCategories = useMemo(() => {
    // Get all categories from grouped
    const allCategories = Object.keys(grouped);
    
    // Sort categories with priority items first, then alphabetically by display name
    return allCategories.sort((a, b) => {
      // Priority items at the top in specified order
      const aIndex = CATEGORY_PRIORITY.indexOf(a);
      const bIndex = CATEGORY_PRIORITY.indexOf(b);
      
      // If both are priority items, sort by priority order
      if (aIndex >= 0 && bIndex >= 0) {
        return aIndex - bIndex;
      }
      
      // If only a is priority, it comes first
      if (aIndex >= 0) return -1;
      
      // If only b is priority, it comes first
      if (bIndex >= 0) return 1;
      
      // For non-priority items, sort alphabetically by display name
      const aName = CATEGORY_META[a]?.name || a;
      const bName = CATEGORY_META[b]?.name || b;
      return aName.localeCompare(bName);
    });
  }, [grouped]);

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
        panelW += (Number(c.product.power_w) || 0) * (Number(c.quantity) || 0);
      } else if (cat === 'inverter' && c.product.rating_kva) {
        inverterKva += (Number(c.product.rating_kva) || 0) * (Number(c.quantity) || 0);
      } else if (cat === 'battery' && c.product.capacity_kwh) {
        batteryKwh += (Number(c.product.capacity_kwh) || 0) * (Number(c.quantity) || 0);
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
    
    // Calculate selling price total
    const total_ex_vat = list.reduce((sum, c) => {
      const unit = getUnitPriceForRow(c, isDraft);
      return sum + unit * (Number(c.quantity) || 0);
    }, 0);
    
    // Calculate cost price total
    const total_cost = list.reduce((sum, c) => {
      const costPrice = computeUnitCost(c.product);
      return sum + costPrice * (Number(c.quantity) || 0);
    }, 0);
    
    // Calculate total markup
    const total_markup = total_ex_vat - total_cost;
    
    const vat_perc = 15;
    const vat_price = total_ex_vat * (vat_perc / 100);
    const total_in_vat = total_ex_vat * (1 + vat_perc / 100);
    
    return { 
      total_excl_vat: total_ex_vat, 
      total_cost: total_cost,
      total_markup: total_markup,
      vat_perc: vat_perc, 
      vat_price: vat_price, 
      total_incl_vat: total_in_vat 
    };
  }, [bomComponents, quoteStatus]);

  // Calculate total selling price per category
  const categoryTotals = useMemo(() => {
    const isDraft = (quoteStatus === 'draft');
    const totals = {};
    
    Object.keys(grouped).forEach(cat => {
      totals[cat] = grouped[cat].reduce((sum, c) => {
        const unit = getUnitPriceForRow(c, isDraft);
        return sum + unit * (Number(c.quantity) || 0);
      }, 0);
    });
    
    return totals;
  }, [grouped, quoteStatus]);


  /* ---------- UI ---------- */
  if (loading) {
    return (
      <div className="text-center py-5">
        <Spinner animation="border" />
        <div className="mt-2">Loading bill of materials…</div>
      </div>
    );
  }

  
  // Helper function to calculate totals for any component list
  const calculateTotalsForComponents = (components) => {
    const isDraft = (quoteStatus === 'draft');
    const list = Array.isArray(components) ? components : [];
    
    // Calculate selling price total
    const total_ex_vat = list.reduce((sum, c) => {
      const unit = getUnitPriceForRow(c, isDraft);
      return sum + unit * (Number(c.quantity) || 0);
    }, 0);
    
    // Calculate cost price total
    const total_cost = list.reduce((sum, c) => {
      const costPrice = computeUnitCost(c.product);
      return sum + costPrice * (Number(c.quantity) || 0);
    }, 0);
    
    // Calculate total markup
    const total_markup = total_ex_vat - total_cost;
    
    const vat_perc = 15;
    const vat_price = total_ex_vat * (vat_perc / 100);
    const total_in_vat = total_ex_vat * (1 + vat_perc / 100);
    
    return { 
      total_excl_vat: total_ex_vat, 
      total_cost: total_cost,
      total_markup: total_markup,
      vat_perc: vat_perc, 
      vat_price: vat_price, 
      total_incl_vat: total_in_vat 
    };
  };

  // Add this function to prepare BOM data and navigate to print view
  const handleExportToPdf = async () => {
    // AUTO-SAVE: Save BOM to database before exporting
    try {
      await saveBOM(); // This will mark bom_modified = true
      showNotification('BOM saved and exported to PDF', 'success');
    } catch (error) {
      console.error('Failed to save BOM before export:', error);
      showNotification('Warning: Failed to save BOM before export', 'warning');
      // Continue with export even if save fails
    }

    // CRITICAL FIX: Ensure we have the latest BOM data before printing
    // This prevents stale data from being printed when coming from SystemDesign
    
    // If we have no components or this is a standard design that might have been modified,
    // reload the BOM to ensure we have the latest data
    const needsRefresh = bomComponents.length === 0 || 
                        (isStandardDesign && sessionStorage.getItem(`systemDesignModified_${projectId}`) === 'true');
    
    let currentBomComponents = bomComponents;
    
    if (needsRefresh) {
      try {
        // Force reload the BOM with latest data
        await loadProjectBOM(projectId, products, project);
        // Use the freshly loaded components
        // Note: We need to wait for the state update, so we'll re-calculate the grouped data
      } catch (error) {
        console.error('Failed to refresh BOM data:', error);
        showNotification('Failed to load latest BOM data', 'danger');
        return;
      }
    }
    
    // Re-calculate grouped data using either current or freshly loaded components
    const componentsToUse = needsRefresh ? bomComponents : currentBomComponents;
    
    // Group components by category for the print view
    const freshGrouped = {};
    componentsToUse.forEach(comp => {
      const cat = comp.product?.category || 'other';
      if (!freshGrouped[cat]) freshGrouped[cat] = [];
      freshGrouped[cat].push(comp);
    });
    
    const freshSortedCategories = Object.keys(freshGrouped).sort((a, b) => {
      const priorityA = CATEGORY_PRIORITY.indexOf(a);
      const priorityB = CATEGORY_PRIORITY.indexOf(b);
      if (priorityA !== -1 && priorityB !== -1) return priorityA - priorityB;
      if (priorityA !== -1) return -1;
      if (priorityB !== -1) return 1;
      return a.localeCompare(b);
    });

    // Calculate fresh totals
    const freshTotals = calculateTotalsForComponents(componentsToUse);
    
    // Prepare data structure for the printable view using fresh sorted categories
    const categoriesForPrint = freshSortedCategories.map(cat => ({
      name: CATEGORY_META[cat]?.name || cat,
      items: freshGrouped[cat].map(comp => ({
        product: comp.product,
        quantity: comp.quantity,
        price: getUnitPriceForRow(comp, quoteStatus === 'draft')
      }))
    }));

    // Store the FRESH data in localStorage for the print view to access
    localStorage.setItem(`printBomData_${projectId}`, JSON.stringify({
      project,
      systemSpecs,
      totals: freshTotals,
      categories: categoriesForPrint
    }));

    // DON'T clear the design modified flag here - keep it so design changes persist
    // sessionStorage.removeItem(`systemDesignModified_${projectId}`);

    // Navigate to the print view within the project dashboard if possible, otherwise open in new window
    if (onNavigateToPrintBom) {
      onNavigateToPrintBom();
    } else {
      // Fallback for standalone use - open in new window
      window.open(`/printable-bom/${projectId}`, '_blank');
    }
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
                            <td className="text-end small">{formatCurrency(computeUnitCost(product))}</td>
                            <td className="text-center">
                              {existing ? (
                                <ButtonGroup size="sm">
                                  <Button 
                                    variant="outline-secondary" 
                                    size="sm" 
                                    className="py-0 px-1" 
                                    onClick={() => updateQuantity(product.id, Math.max(1, Number(existing.quantity) - 1))}
                                    disabled={isCoreComponent(product.category)}
                                    title={isCoreComponent(product.category) ? "Core component quantities can only be changed in System Design" : "Decrease quantity"}
                                  >-</Button>
                                  <Button variant="outline-secondary" size="sm" className="py-0 px-1" disabled>{Number(existing.quantity) || 1}</Button>
                                  <Button 
                                    variant="outline-secondary" 
                                    size="sm" 
                                    className="py-0 px-1" 
                                    onClick={() => updateQuantity(product.id, Number(existing.quantity) + 1)}
                                    disabled={isCoreComponent(product.category)}
                                    title={isCoreComponent(product.category) ? "Core component quantities can only be changed in System Design" : "Increase quantity"}
                                  >+</Button>
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
                        {sortedCategories.map(cat => (
                          <React.Fragment key={cat}>
                            <tr className="table-light">
                              <td colSpan={5} className="py-1">
                                <div className="fw-semibold">
                                  <i className={`bi ${CATEGORY_META[cat]?.icon || 'bi-box'} me-1`} />
                                  {CATEGORY_META[cat]?.name || cat}
                                </div>
                              </td>
                              <td className="py-1 text-end fw-semibold">
                                {formatCurrency(categoryTotals[cat] || 0)}
                              </td>
                              <td className="py-1"></td>
                            </tr>
                            {grouped[cat].map(comp => {
                              const isDraft = (quoteStatus === 'draft');
                              const unitCost = computeUnitCost(comp.product);
                              const unitPrice = getUnitPriceForRow(comp, isDraft);
                              const line = unitPrice * (Number(comp.quantity) || 0);
                              const priceChanged = !isDraft && comp.price_at_time != null && 
                                computeDerivedUnitFromRow(comp) !== comp.price_at_time;

                              return (
                                <tr key={comp.product.id}>
                                  <td>
                                    <div className="d-flex align-items-center justify-content-between">
                                      <div>
                                        <div className="small fw-small">{comp.product.brand} {comp.product.model}</div>
                                        {priceChanged && (
                                          <small className="text-danger">
                                            Price changed: {formatCurrency(comp.price_at_time)} → {formatCurrency(computeDerivedUnitFromRow(comp))}
                                          </small>
                                        )}
                                      </div>
                                      {isCoreComponent(comp.product.category) && (
                                        <Badge bg="info" className="ms-2" title="Core component - quantities managed in System Design">
                                          <i className="bi bi-gear-fill" style={{ fontSize: '0.75em' }}></i>
                                        </Badge>
                                      )}
                                    </div>
                                  </td>
                                  <td className='text-end small'>{formatCurrency(unitCost)}</td>
                                  <td>
                                    <InputGroup size='sm'>
                                      <InputGroup.Text className="py-0 px-1">%</InputGroup.Text>
                                      <Form.Control
                                        type="number"
                                        min="0"
                                        step="1"
                                        value={getMarginDisplayValue(comp)}
                                        onChange={e => updateMargin(comp.product.id, e.target.value)}
                                        onBlur={e => handleMarginBlur(comp.product.id, e.target.value)}
                                        disabled={quoteStatus !== 'draft'}
                                        className="py-0"
                                      />
                                    </InputGroup>
                                  </td>
                                  <td className='text-end small'>{formatCurrency(unitPrice)}</td>
                                  <td>
                                    <InputGroup size='sm'>
                                      <Form.Control 
                                        type="number"
                                        min="0"
                                        value={comp.quantity}
                                        onChange={e => updateQuantity(comp.product.id, e.target.value)}
                                        onBlur={e => handleQuantityBlur(comp.product.id, e.target.value)}
                                        className="py-0"
                                        disabled={isCoreComponent(comp.product.category)}
                                        title={isCoreComponent(comp.product.category) ? "Core component quantities can only be changed in System Design" : ""}
                                      />
                                    </InputGroup>
                                  </td>
                                  <td className='text-end small'>{formatCurrency(line)}</td>
                                  <td className='text-end'>
                                    <Button 
                                      variant="outline-danger" 
                                      size='sm' 
                                      className="py-0 px-1" 
                                      onClick={() => removeComponent(comp.product.id)}
                                      disabled={isCoreComponent(comp.product.category)}
                                      title={isCoreComponent(comp.product.category) ? "Core components cannot be removed - manage in System Design" : "Remove component"}
                                    >
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
                          <td className="fw-semibold">Cost Price: {formatCurrency(totals.total_cost)}</td>
                          <td colSpan={4} className="text-end fw-semibold">Total (excl. VAT):</td>
                          <td className="text-end fw-semibold">{formatCurrency(totals.total_excl_vat)}</td>
                          <td></td>
                        </tr>
                        <tr>
                          <td className="fw-semibold">Total Markup: {formatCurrency(totals.total_markup)}</td>
                          <td colSpan={4} className="text-end fw-semibold">{ totals.vat_perc ? `${totals.vat_perc}% VAT` : 'VAT:'}</td>
                          <td className="text-end fw-semibold">{formatCurrency(totals.vat_price)}</td>
                          <td></td>
                        </tr>
                        <tr className="border-top border-dark">
                          <td className="fw-semibold"></td>
                          <td colSpan={4} className="text-end fw-bold">Total (incl. VAT):</td>
                          <td className="text-end fw-bold">{formatCurrency(totals.total_incl_vat)}</td>
                          <td></td>
                        </tr>
                      </tbody>
                    </Table>
                  </div>
                )}

                <Row className="align-items-center mt-3">
                  {/* <Col md={6}>
                    <Form.Group>
                      <Form.Label>Extras / Labour (R)</Form.Label>
                      <Form.Control
                        value={extrasCost}
                        onChange={e => setExtrasCost(e.target.value)}
                        type="number"
                        min="0"
                        step="0.01"
                      />
                    </Form.Group> */}
                  {/* </Col> */}
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