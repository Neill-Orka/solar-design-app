import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { Container, Row, Col, Card, Button, Form, Spinner, Alert, InputGroup, Badge, ListGroup, Stack } from 'react-bootstrap';

const ProductList = ({ category, products, searchFilter, onSearchChange, onAddComponent }) => {
    const searchTerm = searchFilter.toLowerCase();
    const filteredProducts = products.filter(p => 
        p.category === category &&
        `${p.brand} ${p.mode} ${p.power_w || ''} ${p.rating_kva || ''} ${p.capacity_kwh || ''}`.toLowerCase().includes(searchTerm)
    );

    return (
        <>
            <h4 className="text-xl font-semibold text-gray-700 mt-4 mb-2 ps-1 d-flex justify-content-between align-items-center">
                <span>
                    <i className={`bi ${category === 'panel' ? 'bi-grid-3x3-gap-fill' : category === 'inverter' ? 'bi-box-seam' : 'bi-battery-full'} me-2`}></i>
                    {category.charAt(0).toUpperCase() + category.slice(1)}s
                </span>
                <Form.Control
                    size="sm"
                    style={{ width: '200px' }}
                    placeholder={`Search ${category}s...`}
                    value={searchFilter}
                    onChange={e => onSearchChange(category, e.target.value)} // Use prop for change handler
                />
            </h4>
            <div style={{ maxHeight: '300px', overflowY: 'auto', padding: '0.5rem' }}>
                {filteredProducts.length > 0 ? (
                    <Row xs={1} lg={2} xl={3} className="g-3">
                        {filteredProducts.map(product => (
                            <Col key={product.id}>
                                <Card className="h-100 shadow-sm border-light">
                                    <Card.Body className="p-3">
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

    // --- NEW: State for search filters ---
    const [searchFilters, setSearchFilters] = useState({ panel: '', inverter: '', battery: '' });

    // Fetch all initial data on component mount
    useEffect(() => {
        fetchProducts();
        fetchTemplates();
    }, []);

    const fetchProducts = () => {
        axios.get('http://localhost:5000/api/products')
            .then(res => setProducts(res.data))
            .catch(err => {
                console.error("Error fetching products:", err);
                setError('Failed to load products. The builder cannot be used.');
            })
            .finally(() => setLoading(false));
    };

    const fetchTemplates = () => {
        setLoadingTemplates(true);
        axios.get('http://localhost:5000/api/system_templates')
            .then(res => setSavedTemplates(res.data))
            .catch(err => console.error("Error fetching templates:", err))
            .finally(() => setLoadingTemplates(false));
    };

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
            ? axios.put(`http://localhost:5000/api/system_templates/${editingTemplate.id}`, payload)
            : axios.post('http://localhost:5000/api/system_templates', payload);

        request.then(res => {
            setSaveSuccess(`System "${templateName}" ${editingTemplate ? 'updated' : 'saved'} successfully!`);
            handleClear();
            fetchTemplates(); // Refresh the list
        }).catch(err => {
            setSaveError(err.response?.data?.error || "An error occurred.");
        }).finally(() => setIsSaving(false));
    };

    // --- NEW: Handlers for Edit and Delete ---
    const handleEditClick = (template) => {
        setEditingTemplate(template);
        setTemplateName(template.name);
        setTemplateDesc(template.description);
        setTemplateType(template.system_type);
        setExtrasCost(template.extras_cost || '');
        
        // Reconstruct the components list with full product details
        const reconstructedComponents = template.components.map(comp => {
            const fullProduct = products.find(p => p.id === comp.product_id);
            return { product: fullProduct, quantity: comp.quantity };
        }).filter(c => c.product); // Filter out any components if product not found
        setComponents(reconstructedComponents);
    };

    const handleDelete = (templateId) => {
        if (window.confirm("Are you sure you want to delete this system template?")) {
            axios.delete(`http://localhost:5000/api/system_templates/${templateId}`)
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

                            <ProductList 
                                category="panel"
                                products={products}
                                searchFilter={searchFilters.panel}
                                onSearchChange={handleSearchChange}
                                onAddComponent={addComponent}
                            />
                            <ProductList
                                category="inverter"
                                products={products}
                                searchFilter={searchFilters.inverter}
                                onSearchChange={handleSearchChange}
                                onAddComponent={addComponent}
                            />
                            <ProductList
                                category="battery"
                                products={products}
                                searchFilter={searchFilters.battery}
                                onSearchChange={handleSearchChange}
                                onAddComponent={addComponent}
                            />
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
                                                        {/* --- NEW: Existing Templates List --- */}
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
