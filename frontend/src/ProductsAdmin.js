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

    // New state hooks for dynamic data
    const [categories, setCategories] = useState([]);
    const [componentTypes, setComponentTypes] = useState([]);
    const [fieldMetadata, setFieldMetadata] = useState({});
    const [loadingMetadata, setLoadingMetadata] = useState(true);

    // Memoized helper functions for price calculation and margin conversion
    const calculatePrice = useCallback((unitCost, margin) => {
        const cost = parseFloat(unitCost) || 0;
        const marginValue = parseFloat(margin) || 0;
        return cost * (1 + marginValue);
    }, []);

    const formatMarginForDisplay = useCallback((margin) => {
        return ((parseFloat(margin) || 0) * 100).toFixed(1);
    }, []);

    const formatMarginForBackend = useCallback((displayMargin) => {
        return (parseFloat(displayMargin) || 0) / 100;
    }, []);

    // Memoized helper function to format values for display
    const formatValueForDisplay = useCallback((key, value, product) => {
        if (key === "margin") {
            return formatMarginForDisplay(value) + "%";
        } else if (key === "price") {
            // Calculate price dynamically if we have unit_cost and margin
            if (product.unit_cost && product.margin) {
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
        
        // Fetch all metadata in parallel
        Promise.all([
            axios.get(`${API_URL}/api/products/categories`),
            axios.get(`${API_URL}/api/products/component-types`),
            axios.get(`${API_URL}/api/products/field-metadata`)
        ])
        .then(([categoriesRes, componentTypesRes, metadataRes]) => {
            setCategories(categoriesRes.data);
            setComponentTypes(componentTypesRes.data);
            setFieldMetadata(metadataRes.data);
            setLoadingMetadata(false);
        })
        .catch(err => {
            console.error("Failed to load product metadata", err);
            setError('Failed to load product metadata: ' + (err.message || 'Unknown error'));
            setLoadingMetadata(false);
        });
    }, []);

    // Optimized handleChange with debouncing for price calculation
    const handleChange = useCallback((k, v) => {
        setForm(prevForm => {
            const newForm = { ...prevForm, [k]: v };
            
            // Auto-calculate price when unit_cost or margin changes
            if (k === 'unit_cost' || k === 'margin') {
                const unitCost = k === 'unit_cost' ? v : prevForm.unit_cost;
                // Convert margin to decimal format for calculation
                const margin = k === 'margin' ? formatMarginForBackend(v) : formatMarginForBackend(prevForm.margin);
                newForm.price = calculatePrice(unitCost, margin).toFixed(2);
            }
            
            return newForm;
        });
    }, [calculatePrice, formatMarginForBackend]);

    // ------ load products list -------------------------------
    const fetchProducts = useCallback(() => {
        const token = localStorage.getItem('access_token');
        return axios.get(`${API_URL}/api/products`, {
          headers: { Authorization: `Bearer ${token}` }
        })
        .then(r => {
            setProducts(r.data);
            setError('');
        })
        .catch(err => setError('Failed to load products'));
    }, []);

    useEffect(() => {
        fetchProducts();
    }, [fetchProducts]);

    // ------ open modal --------------------------------------
    const openAdd = useCallback(() => { 
        setEditId(null); 
        setForm(EMPTY_PRODUCT); 
        setShowModal(true); 
    }, []);
    
    // In openEdit function, map fields correctly
    const openEdit = useCallback((p) => { 
      setEditId(p.id);
      
      // Map from API field names to form field names
      const formData = { 
        ...p,
        // Ensure form uses the right field names
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

    // ------ delete -----------------------------------------
    const deleteProduct = useCallback((id) => {
        if (!window.confirm('Delete this product?')) return;
        const token = localStorage.getItem('access_token');
        
        axios.delete(`${API_URL}/api/products/${id}`, {
          headers: { Authorization: `Bearer ${token}` }
        })
        .then(fetchProducts)
        .catch(err => setError('Failed to delete product'));
    }, [fetchProducts]);

    // ------ save (add or update) ---------------------------
    const handleSave = () => {
        setLoading(true);
        const token = localStorage.getItem('access_token');
        
        // Prepare payload, mapping form fields back to API field names
        const payload = { 
          ...form,
          // These mappings ensure the backend gets the field names it expects
          brand_name: form.brand,
          description: form.model,
          power_rating_w: form.power_w,
          power_rating_kva: form.rating_kva,
          usable_rating_kwh: form.capacity_kwh
        };

        // Convert margin from percentage display back to decimal for backend
        if (payload.margin !== null && payload.margin !== undefined && payload.margin !== '') {
            payload.margin = formatMarginForBackend(payload.margin);
        }

        // Handle properties field if it exists
        if (typeof payload.properties === 'string' && payload.properties.trim()) {
            try {
                payload.properties = JSON.parse(payload.properties);
            } catch (e) {
                setError('The format of the Properties field is not valid JSON');
                setLoading(false);
                return;
            }
        } else if (!payload.properties) {
            payload.properties = null;
        }

        // Include auth token with request
        const req = editId 
            ? axios.put(`${API_URL}/api/products/${editId}`, payload, {
                headers: { Authorization: `Bearer ${token}` }
              })
            : axios.post(`${API_URL}/api/products`, payload, {
                headers: { Authorization: `Bearer ${token}` }
              });

        req.then(() => {
            setShowModal(false);
            fetchProducts();
        })
        .catch(err => setError('Failed to save product: ' + (err.response?.data?.details || err.message)))
        .finally(() => setLoading(false));
    };

    // Get applicable field categories based on product category
    const getApplicableFieldCategories = useCallback((product) => {
        if (!fieldMetadata || !product.category) return ['general'];
        
        const applicable = ['general']; // General fields always apply
        
        // Add category-specific field groups
        Object.entries(fieldMetadata).forEach(([key, category]) => {
            if (key !== 'general' && category.applies_to && 
                category.applies_to.some(cat => cat.toLowerCase() === product.category.toLowerCase())) {
                applicable.push(key);
            }
        });
        
        return applicable;
    }, [fieldMetadata]);

    // Optimized Fuse instance for fuzzy search with memoization
    const fuse = useMemo(() => {
        if (products.length === 0) return null;
        
        const options = {
            keys: ['brand', 'model', 'category', 'component_type'],
            threshold: 0.3,
            ignoreLocation: true,
            includeScore: false,
            minMatchCharLength: 2
        };

        // Pre-process records once
        const records = products.map(p => ({
            ...p,
            categoryName: CATEGORY_META[p.category]?.name || p.category
        }));

        return new Fuse(records, options);
    }, [products]);

    // Debounced search state
    const [debouncedSearch, setDebouncedSearch] = useState('');
    
    // Debounce search input
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(search);
        }, 300);
        
        return () => clearTimeout(timer);
    }, [search]);

    // Enhanced filtering with optimized fuzzy search
    const filtered = useMemo(() => {
        if (!debouncedSearch.trim() || !fuse) {
            return products;
        }
        
        // Simple string matching for very short queries
        if (debouncedSearch.length < 2) {
            return products.filter(p => 
                p.brand?.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
                p.model?.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
                p.component_type?.toLowerCase().includes(debouncedSearch.toLowerCase())
            );
        }
        
        // Use fuzzy search for longer queries
        const searchResults = fuse.search(debouncedSearch);
        return searchResults.map(result => result.item);
    }, [products, debouncedSearch, fuse]);

    // Render the appropriate form field based on type
    // In renderFormField function, add mapping for field names
    const renderFormField = (field, meta) => {
        // Map database field names to API field names for display
        const fieldMapping = {
            'brand_name': 'brand',
            'description': 'model',
            'power_rating_w': 'power_w',
            'power_rating_kva': 'rating_kva',
            'usable_rating_kwh': 'capacity_kwh'
        };
        
        // Use the mapped field name if it exists, otherwise use the original field
        const formField = fieldMapping[field] || field;
        
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
                        {meta.source === 'categories' ? 
                            categories.map(opt => <option key={opt} value={opt}>{opt}</option>) :
                            meta.source === 'component-types' ?
                            componentTypes.map(opt => <option key={opt} value={opt}>{opt}</option>) :
                            meta.options?.map(opt => <option key={opt} value={opt}>{opt}</option>)
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

    // Helper function to get the rating badge for panels, inverters, and batteries
    const getRatingBadge = (product) => {
        if (product.category === 'Panel' || product.category === 'panel') {
            const powerValue = product.power_w || product.power_rating_w;
            if (powerValue && parseFloat(powerValue) > 0) {
                return <Badge bg="warning" text="dark" className="ms-2">{powerValue}W</Badge>;
            }
        } 
        else if (product.category === 'Inverter' || product.category === 'inverter') {
            const ratingValue = product.rating_kva || product.power_rating_kva;
            if (ratingValue && parseFloat(ratingValue) > 0) {
                return <Badge bg="info" className="ms-2">{ratingValue}kVA</Badge>;
            }
        }
        else if (product.category === 'Battery' || product.category === 'battery') {
            const capacityValue = product.capacity_kwh || product.usable_rating_kwh;
            if (capacityValue && parseFloat(capacityValue) > 0) {
                return <Badge bg="success" className="ms-2">{capacityValue}kWh</Badge>;
            }
        }
        return null;
    };

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
                                <Button onClick={openAdd} className="btn btn-primary shadow-sm">
                                    <FaPlus className="me-2" />Add Product
                                </Button>
                            </div>

                            {/* Search and View Controls */}
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
                                </Row>
                            </Card>

                            {error && <Alert variant="danger" className="mb-4">{error}</Alert>}

                            {filtered.length === 0 ? (
                                <div className="text-center py-5">
                                    <i className="bi bi-box" style={{fontSize: '4rem', color: '#9ca3af'}}></i>
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
                            ) : viewMode === 'card' ? (
                                // Card View
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
                            ) : (
                                // List View
                                <Card className="shadow-sm border-0 rounded-xl">
                                    <Table hover responsive className="mb-0" size="sm">
                                        <thead className="table-light">
                                            <tr style={{fontSize: '0.9rem'}}>
                                                <th className="ps-3" style={{width: "10%"}}>Category</th>
                                                <th style={{width: "12%"}}>Component Type</th>
                                                <th style={{width: "10%"}}>Brand</th>
                                                <th style={{width: "25%"}}>Model</th>
                                                <th style={{width: "15%"}}>Price</th>
                                                <th style={{width: "15%"}}>Last Updated</th>
                                                <th className="text-end pe-3" style={{width: "13%"}}>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filtered.map(product => (
                                                <tr key={product.id} style={{ verticalAlign: 'middle', fontSize: '0.85rem' }}>
                                                    <td className="ps-3 py-2">
                                                        <div className="d-flex align-items-center">
                                                            <div className={`bg-${getCategoryColor(product.category)} bg-opacity-10 rounded-circle p-1 me-2`} style={{width: "24px", height: "24px", display: "flex", alignItems: "center", justifyContent: "center"}}>
                                                                <i className={`bi ${getCategoryIcon(product.category)} text-${getCategoryColor(product.category)}`} style={{fontSize: '0.7rem'}}></i>
                                                            </div>
                                                            <Badge bg={getCategoryColor(product.category)} className="text-capitalize" style={{fontSize: '0.7rem'}}>
                                                                {getCategoryName(product.category)}
                                                            </Badge>
                                                        </div>
                                                    </td>
                                                    <td className="py-2">
                                                        <span className="text-muted" style={{fontSize: '0.8rem'}}>{product.component_type || '—'}</span>
                                                    </td>
                                                    <td className="fw-semibold py-2" style={{fontSize: '0.85rem'}}>{product.brand}</td>
                                                    <td className="py-2">
                                                        <div>
                                                            <span style={{fontSize: '0.9rem'}}>{product.model}</span>
                                                            {getRatingBadge(product)}
                                                        </div>
                                                        {/* {product.notes && <small className="text-muted d-block">{product.notes}</small>} */}
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
                                                                {product.updated_at ? new Date(product.updated_at).toLocaleDateString() : '—'}
                                                            </small>
                                                            {product.updated_by && (
                                                                <small className="text-muted" style={{fontSize: '0.7rem'}}>
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
                                                            style={{fontSize: '0.75rem', padding: '0.25rem 0.5rem'}}
                                                            onClick={() => openEdit(product)}
                                                        >
                                                            <FaEdit className="me-1" />Edit
                                                        </Button>
                                                        <Button 
                                                            variant="outline-danger" 
                                                            size="sm"
                                                            style={{fontSize: '0.75rem', padding: '0.25rem 0.5rem'}}
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

            {/* Dynamic Product Form Modal */}
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
                                {/* Always render General Information first */}
                                {fieldMetadata.general && (
                                    <Accordion.Item eventKey="general">
                                        <Accordion.Header>General Information</Accordion.Header>
                                        <Accordion.Body>
                                            <Row className="g-3">
                                                {/* Render fields in specific order: category and component_type first, notes last */}
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
                                                
                                                {/* Render all other fields except notes */}
                                                {Object.entries(fieldMetadata.general.fields)
                                                    .filter(([field, meta]) => !['category', 'component_type', 'notes'].includes(field))
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
                                                
                                                {/* Render notes last, full width */}
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
                                
                                {/* Render all other applicable categories alphabetically */}
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
                                                        {/* Add rating fields to specs tab for specific categories */}
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
