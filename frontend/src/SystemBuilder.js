import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { Container, Row, Col, Card, Button, Form, Spinner, Alert, InputGroup, Badge, ListGroup, Stack, Table, ButtonGroup } from 'react-bootstrap';
import { API_URL } from './apiConfig';

const CATEGORY_META = {
  panel:        { name: 'Panels',           icon: 'bi-grid-3x3-gap-fill',     color: 'warning'  },
  inverter:     { name: 'Inverters',        icon: 'bi-box-seam',              color: 'info'     },
  battery:      { name: 'Batteries',        icon: 'bi-battery-full',          color: 'success'  },
  fuse:         { name: 'Fuses',            icon: 'bi-shield-slash-fill',     color: 'danger'   },
  breaker:      { name: 'Circuit Breakers', icon: 'bi-lightning-charge-fill', color: 'danger'   },
  isolator:     { name: 'Isolators',        icon: 'bi-plugin-fill',           color: 'secondary'},
  inverter_aux: { name: 'Inverter Aux',     icon: 'bi-hdd-stack-fill',        color: 'secondary'},
  dc_cable:     { name: 'DC Cables',        icon: 'bi-plug-fill',             color: 'dark'     },
  accessory:    { name: 'Accessories',      icon: 'bi-gear-fill',             color: 'secondary'},
};

const ProductList = ({ category, products, searchFilter, onSearchChange, onAddComponent, categoryMeta, viewMode }) => {
    const categoryInfo = categoryMeta;

    // Enhanced smart search functionality
    const filteredProducts = products.filter(p => {
        if (p.category !== category) return false;
        
        if (!searchFilter) return true;
        
        // Basic product data string for searching
        const productText = `${p.brand || ''} ${p.model || ''} ${p.power_w || ''} ${p.rating_kva || ''} ${p.capacity_kwh || ''}`.toLowerCase();
        
        // Split search into fragments and check if all fragments exist in the product text
        const fragments = searchFilter.toLowerCase().split(/\s+/).filter(f => f.trim());
        
        return fragments.every(fragment => productText.includes(fragment));
    });
    
    return (
        <>
            <h4 className="text-xl font-semibold text-gray-700 mt-4 mb-2 ps-1 d-flex justify-content-between align-items-center">
                <span>
                    <i className={`bi ${categoryInfo.icon} me-2`}></i>
                    {categoryInfo.name || category}
                </span>
                <Form.Control
                    size="sm"
                    style={{ width: '200px' }}
                    placeholder={`Search ${categoryInfo.name}...`}
                    value={searchFilter}
                    onChange={e => onSearchChange(category, e.target.value)}
                />
            </h4>
            <div style={{ maxHeight: '300px', overflowY: 'auto', padding: '0.5rem' }}>
                {filteredProducts.length > 0 ? (
                    viewMode === 'card' ? (
                        // Card View
                        <Row xs={1} lg={2} xl={3} className="g-3">
                            {filteredProducts.map(product => (
                                <Col key={product.id}>
                                    <Card className="h-100 shadow-sm border-light">
                                        <Card.Body className="p-3">
                                            <Badge bg={categoryInfo.color} className='text-capitalize mb-2'>{product.category.replace('_', ' ')}</Badge>
                                            <Card.Title className="text-md font-bold text-gray-800">{product.brand} {product.model}</Card.Title>
                                            <Card.Text className="text-xs text-muted mb-2">
                                                {category === 'panel' && `${product.power_w}W`}
                                                {category === 'inverter' && `${product.rating_kva}kVA`}
                                                {category === 'battery' && `${product.capacity_kwh}kWh`}
                                            </Card.Text>
                                            <div className="d-flex justify-content-between align-items-center">
                                                <span className="text-sm font-semibold text-primary">R{product.price?.toLocaleString()}</span>
                                                <Button variant="outline-primary" size="sm" onClick={() => onAddComponent(product)}>
                                                    <i className="bi bi-plus-lg me-1"></i> Add
                                                </Button>
                                            </div>
                                        </Card.Body>
                                    </Card>
                                </Col>
                            ))}
                        </Row>
                    ) : (
                        // List View
                        <Table hover responsive className="mb-2 table-sm">
                            <thead className="table-light">
                                <tr>
                                    <th>Brand</th>
                                    <th>Model</th>
                                    <th className="text-center">Specifications</th>
                                    <th className="text-end">Price</th>
                                    <th className="text-end">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredProducts.map(product => (
                                    <tr key={product.id} style={{ verticalAlign: 'middle' }}>
                                        <td className="fw-semibold">{product.brand}</td>
                                        <td>{product.model}</td>
                                        <td className="text-center">
                                            {category === 'panel' && product.power_w && (
                                                <Badge bg="warning" text="dark">{product.power_w}W</Badge>
                                            )}
                                            {category === 'inverter' && product.rating_kva && (
                                                <Badge bg="info">{product.rating_kva}kVA</Badge>
                                            )}
                                            {category === 'battery' && product.capacity_kwh && (
                                                <Badge bg="success">{product.capacity_kwh}kWh</Badge>
                                            )}
                                        </td>
                                        <td className="text-end">
                                            <span className="text-sm font-semibold text-primary">R{product.price?.toLocaleString()}</span>
                                        </td>
                                        <td className="text-end">
                                            <Button variant="outline-primary" size="sm" onClick={() => onAddComponent(product)}>
                                                <i className="bi bi-plus-lg me-1"></i> Add
                                            </Button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </Table>
                    )
                ) : <p className="text-muted small">No {category} products found matching your search.</p>}
            </div>
        </>
    );
};

function SystemBuilder() {
    // State for all available products fetched from the API
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // State for the new system template being built
    const [templateName, setTemplateName] = useState('');
    const [templateDesc, setTemplateDesc] = useState('');
    const [templateType, setTemplateType] = useState('Hybrid');
    const [extrasCost, setExtrasCost] = useState('');
    const [components, setComponents] = useState([]);

    // State for saving/updating
    const [isSaving, setIsSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState('');
    const [saveError, setSaveError] = useState('');

    // --- NEW: State for managing the list of existing templates ---
    const [savedTemplates, setSavedTemplates] = useState([]);
    const [loadingTemplates, setLoadingTemplates] = useState(true);
    const [editingTemplate, setEditingTemplate] = useState(null); // Holds the template being edited

    // --- State for search filters ---
    const [searchFilters, setSearchFilters] = useState({});
    
    // --- NEW: Main search and view mode state ---
    const [mainSearch, setMainSearch] = useState('');
    const [viewMode, setViewMode] = useState('list'); // Default to list view

    // Fetch all initial data on component mount
    useEffect(() => {
        fetchProducts();
        fetchTemplates();
    }, []);

    const slugify = (raw = '') => 
        raw.toString()
            .toLowerCase()
            .replace(/&/g, ' and ')
            .replace(/[^\w\s]/g, '')
            .trim()
            .replace(/\s+/g, '_');

    const getMeta = (slug) => ({
        name: CATEGORY_META[slug]?.name || slug.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        icon: CATEGORY_META[slug]?.icon || 'bi-box',
        color: CATEGORY_META[slug]?.color || 'secondary',
    });

    const fetchProducts = () => {
        axios.get(`${API_URL}/api/products`)
            .then(res => {
                const normalised = res.data.map(p => ({
                    ...p,
                    category: slugify(p.category)
                }));
                setProducts(normalised);
            })
            .catch(err => {
                console.error("Error fetching products:", err);
                setError('Failed to load products. The builder cannot be used.');
            })
            .finally(() => setLoading(false));
    };

    const fetchTemplates = () => {
        setLoadingTemplates(true);
        axios.get(`${API_URL}/api/system_templates`)
            .then(res => setSavedTemplates(res.data))
            .catch(err => console.error("Error fetching templates:", err))
            .finally(() => setLoadingTemplates(false));
    };

    // Smart search function
    const applySmartSearch = (product) => {
        if (!mainSearch) return true;
        
        // Create a combined string of all product info for searching
        const searchableText = `${product.brand || ''} ${product.model || ''} ${product.category || ''} ${product.power_w || ''} ${product.rating_kva || ''} ${product.capacity_kwh || ''}`.toLowerCase();
        
        // Split search into fragments and check if all exist in searchable text
        const fragments = mainSearch.toLowerCase().split(/\s+/).filter(f => f.trim());
        
        return fragments.every(fragment => searchableText.includes(fragment));
    };

    // Filter products based on main search
    const filteredProducts = useMemo(() => {
        if (!mainSearch) return products;
        return products.filter(applySmartSearch);
    }, [products, mainSearch]);

    // Memoized calculations for totals (no changes needed here)
    const { totalCost, totalPanelKw, totalInverterKva, totalBatteryKwh } = useMemo(() => {
        let cost = parseFloat(extrasCost) || 0;
        let pKw = 0, iKva = 0, bKwh = 0;
        components.forEach(comp => {
            cost += (comp.product.price || 0) * comp.quantity;
            if (comp.product.category === 'panel') pKw += (comp.product.power_w || 0) * comp.quantity / 1000;
            if (comp.product.category === 'inverter') iKva += (comp.product.rating_kva || 0) * comp.quantity;
            if (comp.product.category === 'battery') bKwh += (comp.product.capacity_kwh || 0) * comp.quantity;
        });
        return { totalCost: cost, totalPanelKw: pKw.toFixed(2), totalInverterKva: iKva.toFixed(2), totalBatteryKwh: bKwh.toFixed(2) };
    }, [components, extrasCost]);

    // Component and quantity handlers (no changes needed here)
    const addComponent = (product) => {
        if (components.find(c => c.product.id === product.id)) return;
        setComponents([...components, { product, quantity: 1 }]);
    };
    const removeComponent = (productId) => setComponents(components.filter(c => c.product.id !== productId));
    const updateQuantity = (productId, quantity) => {
        const numQuantity = parseInt(quantity, 10);
        if (numQuantity > 0) setComponents(components.map(c => c.product.id === productId ? { ...c, quantity: numQuantity } : c));
    };

    const handleClear = () => {
        setTemplateName(''); setTemplateDesc(''); setTemplateType('Hybrid');
        setExtrasCost(''); setComponents([]); setSaveSuccess(''); setSaveError('');
        setEditingTemplate(null); // Also cancel editing mode
    };

    // Main save/update handler
    const handleSaveOrUpdate = () => {
        if (!templateName.trim() || components.length === 0) {
            setSaveError('System Name and at least one component are required.');
            return;
        }
        setIsSaving(true); setSaveError(''); setSaveSuccess('');

        const payload = {
            name: templateName, description: templateDesc, system_type: templateType,
            extras_cost: parseFloat(extrasCost) || 0,
            components: components.map(c => ({ product_id: c.product.id, quantity: c.quantity })),
        };

        const request = editingTemplate
            ? axios.put(`${API_URL}/api/system_templates/${editingTemplate.id}`, payload)
            : axios.post(`${API_URL}/api/system_templates`, payload);

        request.then(res => {
            setSaveSuccess(`System "${templateName}" ${editingTemplate ? 'updated' : 'saved'} successfully!`);
            handleClear();
            fetchTemplates(); // Refresh the list
        }).catch(err => {
            setSaveError(err.response?.data?.error || "An error occurred.");
        }).finally(() => setIsSaving(false));
    };

    // --- Handlers for Edit and Delete ---
    const handleEditClick = (template) => {
        setEditingTemplate(template);
        setTemplateName(template.name);
        setTemplateDesc(template.description);
        setTemplateType(template.system_type);
        
        // Make sure we're using the dedicated extras_cost field and providing a fallback
        // Convert to string because the form control expects a string value
        setExtrasCost(template.extras_cost !== undefined ? template.extras_cost.toString() : '');
        
        // Reconstruct the components list with full product details
        const reconstructedComponents = template.components.map(comp => {
            const fullProduct = products.find(p => p.id === comp.product_id);
            return { product: fullProduct, quantity: comp.quantity };
        }).filter(c => c.product); // Filter out any components if product not found
        setComponents(reconstructedComponents);
    };

    const handleDelete = (templateId) => {
        if (window.confirm("Are you sure you want to delete this system template?")) {
            axios.delete(`${API_URL}/api/system_templates/${templateId}`)
                .then(() => {
                    alert('Template deleted successfully!');
                    fetchTemplates(); // Refresh list
                })
                .catch(err => alert('Failed to delete template: ' + err.response?.data?.error));
        }
    };

    const handleSearchChange = (category, value) => {
        setSearchFilters(prevFilters => ({
            ...prevFilters,
            [category]: value
        }));
    };

    // Main render
    if (loading) return <div className="d-flex justify-content-center mt-5"><Spinner animation="border" /></div>;
    if (error) return <Container className="mt-4"><Alert variant="danger">{error}</Alert></Container>;

    // Get unique categories from filtered products
    const uniqueCategories = Array.from(new Set(filteredProducts.map(p => p.category))).sort();

    return (
        <div className='min-vh-100' style={{ backgroundColor: '#f8f9fa' }}>
            <Container fluid className="py-4 py-md-5">
                <Row>
                    {/* Left Column: Builder & Product Selection */}
                    <Col lg={7} xl={8}>
                        <Card className="shadow-lg border-0 rounded-xl p-4 p-md-5">
                            <h2 className="text-3xl font-bold text-gray-800 mb-1">System Template Builder</h2>
                            <p className="text-muted mb-4">Create new system kits for the Quick Design tool.</p>
                            <Form>
                                <Row>
                                    <Col md={6}><Form.Group className="mb-3"><Form.Label>System Name</Form.Label><Form.Control type="text" value={templateName} onChange={e => setTemplateName(e.target.value)} placeholder="e.g., Commercial 50kW Hybrid" /></Form.Group></Col>
                                    <Col md={6}><Form.Group className="mb-3"><Form.Label>System Type</Form.Label><Form.Select value={templateType} onChange={e => setTemplateType(e.target.value)}><option>Hybrid</option><option>Grid-Tied</option><option>Off-Grid</option></Form.Select></Form.Group></Col>
                                </Row>
                                <Form.Group className="mb-3"><Form.Label>Description</Form.Label><Form.Control as="textarea" rows={2} value={templateDesc} onChange={e => setTemplateDesc(e.target.value)} placeholder="A brief description of the system's purpose or ideal use case." /></Form.Group>
                            </Form>

                            <hr className="my-4" />

                            {/* NEW: Main Search and View Controls */}
                            <Card className='shadow-sm border-0 rounded-xl p-3 mb-4'>
                                <Row className='g-3 align-items-center'>
                                    <Col md={8}>
                                        <InputGroup>
                                            <InputGroup.Text className="bg-light border-end-0">
                                                <i className="bi bi-search"></i>
                                            </InputGroup.Text>
                                            <Form.Control 
                                                value={mainSearch} 
                                                onChange={e => setMainSearch(e.target.value)}
                                                placeholder="Search all products across categories..."
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

                            {uniqueCategories.map(slug => (
                                <ProductList 
                                    key={slug}
                                    category={slug}
                                    products={filteredProducts}
                                    categoryMeta={getMeta(slug)}
                                    searchFilter={searchFilters[slug] || ''}
                                    onSearchChange={handleSearchChange}
                                    onAddComponent={addComponent}
                                    viewMode={viewMode}
                                />
                            ))}
                        </Card>
                    </Col>

                    {/* Right Column: Summary & Save */}
                    <Col lg={5} xl={4}>
                        <div className="sticky-top" style={{ top: '88px' }}>
                            <Card className="shadow-lg border-0 rounded-xl mb-4">
                                <Card.Header className="bg-dark text-white rounded-top-xl py-3">
                                    <h3 className="text-xl font-semibold mb-0"><i className="bi bi-card-checklist me-2"></i>System Summary</h3>
                                </Card.Header>
                                <Card.Body className="p-4">
                                    {components.length === 0 ? (
                                        <p className="text-muted text-center py-4">Add products from the left to build your system.</p>
                                    ) : (
                                        components.map(comp => (
                                            <div key={comp.product.id} className="d-flex align-items-center mb-3">
                                                <div className="flex-grow-1">
                                                    <p className="mb-0 fw-bold text-sm text-gray-800">{comp.product.brand} {comp.product.model}</p>
                                                    <p className="mb-0 text-xs text-muted">R{comp.product.price?.toLocaleString()} ea.</p>
                                                </div>
                                                <InputGroup style={{width: '120px'}} className="ms-2">
                                                    <InputGroup.Text className="small">Qty</InputGroup.Text>
                                                    <Form.Control type="number" size="sm" value={comp.quantity} onChange={e => updateQuantity(comp.product.id, e.target.value)} min="1" />
                                                </InputGroup>
                                                <Button variant="link" className="text-danger p-0 ms-2" onClick={() => removeComponent(comp.product.id)}><i className="bi bi-trash fs-5"></i></Button>
                                            </div>
                                        ))
                                    )}
                                    
                                    <hr />
                                    <Form.Group>
                                        <Form.Label className="text-sm font-medium">Extras & Labor Cost</Form.Label>
                                        <InputGroup>
                                            <InputGroup.Text>R</InputGroup.Text>
                                            <Form.Control type="number" value={extrasCost} onChange={e => setExtrasCost(e.target.value)} placeholder="e.g., 50000" />
                                        </InputGroup>
                                    </Form.Group>
                                    
                                    <div className="mt-4 p-3 bg-light rounded-lg">
                                        <h5 className="font-semibold text-md mb-3">Totals</h5>
                                        <div className="d-flex justify-content-between text-sm mb-2"><span>PV Power:</span> <Badge pill bg="warning" text="dark">{totalPanelKw} kWp</Badge></div>
                                        <div className="d-flex justify-content-between text-sm mb-2"><span>Inverter Power:</span> <Badge pill bg="info">{totalInverterKva} kVA</Badge></div>
                                        <div className="d-flex justify-content-between text-sm mb-3"><span>Battery Capacity:</span> <Badge pill bg="success">{totalBatteryKwh} kWh</Badge></div>
                                        <div className="d-flex justify-content-between font-bold text-lg border-top pt-3">
                                            <span>Total Cost:</span>
                                            <span className="text-primary">R{totalCost.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                                        </div>
                                    </div>
                                    
                                    <div className="d-grid gap-2 mt-4">
                                        <Button variant="primary" size="lg" onClick={handleSaveOrUpdate} disabled={isSaving}>
                                            {isSaving ? <><Spinner as="span" animation="border" size="sm" /> Saving...</> : <><i className="bi bi-save-fill me-2"></i>Save System</>}
                                        </Button>
                                        <Button variant="outline-secondary" onClick={handleClear}>Clear</Button>
                                    </div>

                                    {saveSuccess && <Alert variant="success" className="mt-3">{saveSuccess}</Alert>}
                                    {saveError && <Alert variant="danger" className="mt-3">{saveError}</Alert>}
                                </Card.Body>
                            </Card>
                            
                            {/* Existing Templates List */}
                            <Card className="shadow-lg border-0 rounded-xl">
                                <Card.Header className="bg-secondary text-white rounded-top-xl py-3">
                                    <h3 className="text-xl font-semibold mb-0"><i className="bi bi-collection-fill me-2"></i>Existing Systems</h3>
                                </Card.Header>
                                <ListGroup variant="flush" style={{maxHeight: '400px', overflowY: 'auto'}}>
                                    {loadingTemplates ? <ListGroup.Item className="text-center p-3"><Spinner size="sm" /></ListGroup.Item> :
                                    savedTemplates.map(template => (
                                        <ListGroup.Item key={template.id} className="d-flex justify-content-between align-items-center">
                                            <div>
                                                <p className="fw-bold mb-0">{template.name}</p>
                                                <small className="text-muted">{template.panel_kw}kWp | {template.inverter_kva}kVA | {template.battery_kwh}kWh</small>
                                            </div>
                                            <Stack direction="horizontal" gap={2}>
                                                <Button variant="outline-primary" size="sm" onClick={() => handleEditClick(template)}><i className="bi bi-pencil-fill"></i></Button>
                                                <Button variant="outline-danger" size="sm" onClick={() => handleDelete(template.id)}><i className="bi bi-trash-fill"></i></Button>
                                            </Stack>
                                        </ListGroup.Item>
                                    ))}
                                </ListGroup>
                            </Card>
                        </div>
                    </Col>
                </Row>
            </Container>
        </div>
    );
}

export default SystemBuilder;
