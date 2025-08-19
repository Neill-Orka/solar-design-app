import React, { useState, useEffect, useCallback, useMemo } from 'react';
import axios from "axios";
import { Container, Row, Col, Card, Button, Modal, Form, InputGroup, Badge, Spinner, Alert, ButtonGroup, Table } from "react-bootstrap";
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

const EMPTY_PRODUCT = {
    category: 'Panel', component_type: '', brand: '', model: '',
    power_w: '', rating_kva: '', capacity_kwh: '',
    unit_cost: '', margin: '', price: '', warranty_y: '', notes: '', properties: ''
};

//  Meta for every field we MIGHT display/edit
const FIELD_META = {
  category:        { label: "Category", type: "select", options: [
    'Panel', 'Inverter', 'Battery', 'Solar Geyser', 'Inverter Aux', 'Lights', 
    'Transport & Logistics', 'Contactor', 'Enclosure', 'Cable Management', 
    'Human Resources', 'Conductor', 'VSD', 'Change Over Switch', 'HSEQ & Compliance',
    'Aux Generator', 'DB', 'Monitoring & Control Equipment', 'S&T', 'MPPT',
    'Mounting System', 'Monitoring', 'Auxiliaries', 'Cable', 'Protection',
    'Professional Services'
  ]},
  component_type:  { label: "Component Type", type: "text" },
  brand:           { label: "Brand",          type: "text"   },
  model:           { label: "Model / SKU",    type: "text"   },
  unit_cost:       { label: "Unit Cost (R)",  type: "number" },
  margin:          { label: "Margin (%)",     type: "number" },
  price:           { label: "Price (R)",      type: "number", readonly: true },
  power_w:         { label: "Power (W)",      type: "number", category: "Panel"    },
  rating_kva:      { label: "Rating (kVA)",   type: "number", category: "Inverter" },
  capacity_kwh:    { label: "Capacity (kWh)", type: "number", category: "Battery"  },
  warranty_y:      { label: "Warranty (y)",   type: "number" },
  notes:           { label: "Notes",          type: "textarea" },
};

// Helper that returns fields based on category and editing context
const getVisibleFields = (prod, isEditing = false) => {
    return Object.keys(FIELD_META)
    .filter((k) => {
        const catOK = !FIELD_META[k].category || FIELD_META[k].category === prod.category;
        
        if (isEditing) {
            // In editing mode, show all relevant fields regardless of whether they have values
            return catOK;
        } else {
            // In display mode, only show fields that have values
            const v = prod[k];
            return catOK && v !== null && v !== undefined && v !== '';
        }
    })
    .map((k) => ({ key: k, meta: FIELD_META[k] }));
};


const getCategoryIcon = (category) => {
    return CATEGORY_META[category]?.icon || 'bi-gear-fill';
};

const getCategoryColor = (category) => {
    return CATEGORY_META[category]?.color || 'secondary';
};

const getCategoryName = (category) => {
    return CATEGORY_META[category]?.name || category;
};

export default function ProductsAdmin() {
    const [products, setProducts] = useState([]);
    const [search, setSearch] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editId, setEditId] = useState(null);
    const [form, setForm] = useState(EMPTY_PRODUCT);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [viewMode, setViewMode] = useState('list'); // Default to list view

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

    // ------ load list -----------------------------------
    const fetchProducts = useCallback(() => 
        axios.get(`${API_URL}/api/products`)
            .then(r => {
                setProducts(r.data);
                setError('');
            })
            .catch(err => setError('Failed to load products')), []);

    useEffect(() => {
        fetchProducts();
    }, [fetchProducts]);

    // ------ open modal ----------------------------------
    const openAdd = useCallback(() => { 
        setEditId(null); 
        setForm(EMPTY_PRODUCT); 
        setShowModal(true); 
    }, []);
    
    const openEdit = useCallback((p) => { 
        setEditId(p.id); 
        // Format margin for display (convert from decimal to percentage)
        const formData = { 
            ...p, 
            margin: p.margin ? formatMarginForDisplay(p.margin) : ''
        };
        setForm(formData); 
        setShowModal(true); 
    }, [formatMarginForDisplay]);

    // ------ delete --------------------------------------
    const deleteProduct = useCallback((id) => {
        if (!window.confirm('Delete this product?')) return;
        axios.delete(`${API_URL}/api/products/${id}`)
            .then(fetchProducts)
            .catch(err => setError('Failed to delete product'));
    }, [fetchProducts]);

    // ------ save (add or update) ---------------------
    const handleSave = () => {
        setLoading(true);

        const payload = { ...form };

        // Convert margin from percentage display back to decimal for backend
        if (payload.margin !== null && payload.margin !== undefined && payload.margin !== '') {
            payload.margin = formatMarginForBackend(payload.margin);
        }

        try {
            if (typeof payload.properties === 'string' && payload.properties.trim()) {
                payload.properties = JSON.parse(payload.properties);
            } else if (!payload.properties) {
                payload.properties = [];
            }
        } catch (e) {
            setError('The format of the Properties field is not valid JSON');
            setLoading(false);
            return;
        }
        const req = editId ? axios.put(`${API_URL}/api/products/${editId}`, payload) :
            axios.post(`${API_URL}/api/products`, payload);
        req.then(() => {
            setShowModal(false);
            fetchProducts();
        })
        .catch(err => setError('Failed to save product'))
        .finally(() => setLoading(false))
    };

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
                                // Card View (your existing implementation)
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
                                                    <Card.Subtitle className="text-muted mb-3">{product.model}</Card.Subtitle>

                                                    <div className="mb-3">
                                                        {getVisibleFields(product).map(({ key, meta }) => (
                                        ["power_w","rating_kva","capacity_kwh","unit_cost","margin","price","warranty_y"].includes(key) && (
                                                            <div
                                                              key={key}
                                                              className="d-flex justify-content-between align-items-center mb-1"
                                                            >
                                                              <small className="text-muted">{meta.label.replace(/ \(.+/, "")}:</small>
                                                              <Badge bg={
                                                                key === "power_w" ? "warning"
                                                                : key === "rating_kva" ? "info"
                                                                : key === "capacity_kwh" ? "success"
                                                                : key === "unit_cost" ? "secondary"
                                                                : key === "margin" ? "info"
                                            : key === "warranty_y" ? "dark"
                                                                : "primary"
                                                              } text={key === "power_w" ? "dark" : undefined}>
                                                                {formatValueForDisplay(key, product[key], product)}
                                            {key === "power_w" ? "W" :
                                                                 key === "rating_kva" ? "kVA" :
                                             key === "capacity_kwh" ? "kWh" :
                                             key === "warranty_y" ? "y" : ""}
                                                              </Badge>
                                                            </div>
                                                          )
                                                        ))}
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
                                // New List View
                                <Card className="shadow-sm border-0 rounded-xl">
                                    <Table hover responsive className="mb-0">
                                        <thead className="table-light">
                                            <tr>
                                                <th className="ps-4" style={{width: "12%"}}>Category</th>
                                                <th style={{width: "15%"}}>Component Type</th>
                                                <th style={{width: "18%"}}>Brand</th>
                                                <th style={{width: "18%"}}>Model</th>
                                                <th style={{width: "12%"}}>Specifications</th>
                                                <th style={{width: "12%"}}>Price</th>
                                                <th className="text-end pe-4" style={{width: "13%"}}>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filtered.map(product => (
                                                <tr key={product.id} style={{ verticalAlign: 'middle' }}>
                                                    <td className="ps-4">
                                                        <div className="d-flex align-items-center">
                                                            <div className={`bg-${getCategoryColor(product.category)} bg-opacity-10 rounded-circle p-2 me-2`} style={{width: "32px", height: "32px", display: "flex", alignItems: "center", justifyContent: "center"}}>
                                                                <i className={`bi ${getCategoryIcon(product.category)} text-${getCategoryColor(product.category)}`}></i>
                                                            </div>
                                                            <Badge bg={getCategoryColor(product.category)} className="text-capitalize">
                                                                {getCategoryName(product.category)}
                                                            </Badge>
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <span className="text-muted">{product.component_type || '-'}</span>
                                                    </td>
                                                    <td className="fw-semibold">{product.brand}</td>
                                                    <td>{product.model}</td>
                                                    <td>
                                                        {(product.category === 'Panel' || product.category === 'panel') && product.power_w && (
                                                            <Badge bg="warning" text="dark">{product.power_w}W</Badge>
                                                        )}
                                                        {(product.category === 'Inverter' || product.category === 'inverter') && product.rating_kva && (
                                                            <Badge bg="info">{product.rating_kva}kVA</Badge>
                                                        )}
                                                        {product.category === 'Battery' && product.capacity_kwh && (
                                                            <Badge bg="success">{product.capacity_kwh}kWh</Badge>
                                                        )}
                                                    </td>
                                                    <td>
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
                                                    <td className="text-end pe-4">
                                                        <Button 
                                                            variant="outline-primary" 
                                                            size="sm" 
                                                            className="me-2"
                                                            onClick={() => openEdit(product)}
                                                        >
                                                            <FaEdit className="me-1" />Edit
                                                        </Button>
                                                        <Button 
                                                            variant="outline-danger" 
                                                            size="sm"
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

            {/* ---------- modal ---------- */}
            <Modal show={showModal} onHide={() => setShowModal(false)} size="lg" centered>
                <Modal.Header closeButton className="bg-light py-3">
                    <Modal.Title className="h5 mb-0 d-flex align-items-center">
                        <i className={`bi ${editId ? 'bi-pencil-fill' : 'bi-plus-lg'} me-2`}></i>
                        {editId ? 'Edit Product' : 'Add Product'}
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body className="pt-4 pb-2 px-4">
                    <Form>
                        {/* General Section */}
                        <div className="mb-3">
                            <small className="text-uppercase text-muted fw-semibold d-block mb-2" style={{letterSpacing: '0.05em'}}>General</small>
                            <Row className="g-3">
                                {['category','component_type','brand','model','warranty_y'].map(key => {
                                    const meta = FIELD_META[key];
                                    return (
                                        <Col md={6} key={key}>
                                            <Form.Group>
                                                <Form.Label className="small fw-semibold mb-1">
                                                    {meta.label}
                                                </Form.Label>
                                                {meta.type === 'select' ? (
                                                    <Form.Select
                                                        value={form[key] || ''}
                                                        onChange={(e) => handleChange(key, e.target.value)}
                                                        size="sm"
                                                        className="rounded-lg"
                                                    >
                                                        <option value="">Select {meta.label}</option>
                                                        {meta.options.map(o => <option key={o} value={o}>{o}</option>)}
                                                    </Form.Select>
                                                ) : (
                                                    <Form.Control
                                                        type={meta.type}
                                                        value={form[key] || ''}
                                                        onChange={(e) => handleChange(key, e.target.value)}
                                                        size="sm"
                                                        className="rounded-lg"
                                                    />
                                                )}
                                            </Form.Group>
                                        </Col>
                                    );
                                })}
                            </Row>
                        </div>

                        {/* Specification Section (conditional fields) */}
                        <div className="mb-3">
                            <small className="text-uppercase text-muted fw-semibold d-block mb-2" style={{letterSpacing: '0.05em'}}>Specifications</small>
                            <Row className="g-3">
                                {['power_w','rating_kva','capacity_kwh'].filter(k => !FIELD_META[k].category || FIELD_META[k].category === form.category).map(key => {
                                    const meta = FIELD_META[key];
                                    return (
                                        <Col md={4} key={key}>
                                            <Form.Group>
                                                <Form.Label className="small fw-semibold mb-1">{meta.label}</Form.Label>
                                                <Form.Control
                                                    type={meta.type}
                                                    value={form[key] || ''}
                                                    onChange={(e) => handleChange(key, e.target.value)}
                                                    size="sm"
                                                    className="rounded-lg"
                                                />
                                            </Form.Group>
                                        </Col>
                                    );
                                })}
                                {(['power_w','rating_kva','capacity_kwh'].filter(k => !FIELD_META[k].category || FIELD_META[k].category === form.category).length === 0) && (
                                    <Col>
                                        <div className="text-muted small fst-italic">No specific metrics for this category.</div>
                                    </Col>
                                )}
                            </Row>
                        </div>

                        {/* Pricing Section */}
                        <div className="mb-3">
                            <small className="text-uppercase text-muted fw-semibold d-block mb-2" style={{letterSpacing: '0.05em'}}>Pricing</small>
                            <Row className="g-3">
                                {['unit_cost','margin','price'].map(key => {
                                    const meta = FIELD_META[key];
                                    return (
                                        <Col md={4} key={key}>
                                            <Form.Group>
                                                <Form.Label className="small fw-semibold mb-1">
                                                    {meta.label}
                                                    {meta.readonly && <span className="text-muted ms-1" style={{fontSize: '0.7rem'}}>(auto)</span>}
                                                </Form.Label>
                                                <InputGroup size="sm">
                                                    {['unit_cost','price'].includes(key) && (
                                                        <InputGroup.Text className="bg-light px-2 py-1">R</InputGroup.Text>
                                                    )}
                                                    <Form.Control
                                                        type="number"
                                                        value={form[key] || ''}
                                                        onChange={(e) => handleChange(key, e.target.value)}
                                                        readOnly={meta.readonly}
                                                        className="rounded-lg"
                                                        style={meta.readonly ? { backgroundColor: '#f8f9fa' } : {}}
                                                    />
                                                    {key === 'margin' && <InputGroup.Text className="bg-light px-2 py-1">%</InputGroup.Text>}
                                                </InputGroup>
                                                {key === 'margin' && <div className="form-text">Enter markup percentage (e.g. 25)</div>}
                                            </Form.Group>
                                        </Col>
                                    );
                                })}
                            </Row>
                        </div>

                        {/* Notes Section */}
                        <div className="mb-2">
                            <small className="text-uppercase text-muted fw-semibold d-block mb-2" style={{letterSpacing: '0.05em'}}>Notes</small>
                            <Form.Group>
                                <Form.Control
                                    as="textarea"
                                    rows={2}
                                    value={form.notes || ''}
                                    onChange={(e) => handleChange('notes', e.target.value)}
                                    size="sm"
                                    className="rounded-lg"
                                    placeholder="Additional details, remarks, etc."
                                />
                            </Form.Group>
                        </div>
                    </Form>
                </Modal.Body>
                <Modal.Footer className="bg-light py-3">
                    <Button variant="outline-secondary" onClick={() => setShowModal(false)} size="sm">
                        Cancel
                    </Button>
                    <Button variant="primary" onClick={handleSave} disabled={loading} size="sm" className="px-4">
                        {loading ? (
                            <>
                                <Spinner as="span" animation="border" size="sm" className="me-2" /> Saving...
                            </>
                        ) : (
                            <>
                                <i className="bi bi-check-lg me-2"></i>Save
                            </>
                        )}
                    </Button>
                </Modal.Footer>
            </Modal>
        </div>
    );
}
