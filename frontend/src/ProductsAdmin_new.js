import React, { useState, useEffect } from "react";
import axios from "axios";
import { Container, Row, Col, Card, Button, Modal, Form, InputGroup, Badge, Spinner, Alert } from "react-bootstrap";
import { FaTrash, FaEdit, FaPlus } from "react-icons/fa";
import { API_URL } from "./apiConfig";

const EMPTY_PRODUCT = {
    category: 'panel', brand: '', model: '',
    power_w: '', rating_kva: '', capacity_kwh: '',
    cost: '', price: '', warranty_y: '', notes: ''
};

const getCategoryIcon = (category) => {
    switch(category) {
        case 'panel': return 'bi-grid-3x3-gap-fill';
        case 'inverter': return 'bi-box-seam';
        case 'battery': return 'bi-battery-full';
        default: return 'bi-gear-fill';
    }
};

const getCategoryColor = (category) => {
    switch(category) {
        case 'panel': return 'warning';
        case 'inverter': return 'info';
        case 'battery': return 'success';
        default: return 'secondary';
    }
};

export default function ProductsAdmin() {
    const [products, setProducts] = useState([]);
    const [search, setSearch] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editId, setEditId] = useState(null);
    const [form, setForm] = useState(EMPTY_PRODUCT);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // ------ load list -----------------------------------
    const fetchProducts = () => 
        axios.get(`${API_URL}/api/products`)
            .then(r => {
                setProducts(r.data);
                setError('');
            })
            .catch(err => setError('Failed to load products'));

    useEffect(() => {
        fetchProducts();
    }, []);

    // ------ open modal ----------------------------------
    const openAdd = () => { setEditId(null); setForm(EMPTY_PRODUCT); setShowModal(true); };
    const openEdit = (p) => { setEditId(p.id); setForm(p); setShowModal(true); };

    // ------ delete --------------------------------------
    const deleteProduct = (id) => {
        if (!window.confirm('Delete this product?')) return;
        axios.delete(`${API_URL}/api/products/${id}`)
            .then(fetchProducts)
            .catch(err => setError('Failed to delete product'));
    };

    // ------ save (add or update) ---------------------
    const handleSave = () => {
        setLoading(true);
        const req = editId ? axios.put(`${API_URL}/api/products/${editId}`, form) :
            axios.post(`${API_URL}/api/products`, form);
        req.then(() => {
            setShowModal(false);
            fetchProducts();
        })
        .catch(err => setError('Failed to save product'))
        .finally(() => setLoading(false))
    };

    // ------ helpers -------------------------------------
    const handleChange = (k, v) => setForm({ ...form, [k]: v });

    const filtered = products.filter(p =>
        `${p.brand} ${p.model}`.toLowerCase().includes(search.toLowerCase())
    );

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

                            <div className="mb-4">
                                <InputGroup size="lg">
                                    <InputGroup.Text className="bg-light border-end-0">
                                        <i className="bi bi-search"></i>
                                    </InputGroup.Text>
                                    <Form.Control 
                                        value={search} 
                                        onChange={e => setSearch(e.target.value)}
                                        placeholder="Search products by brand or model..."
                                        className="border-start-0 rounded-end-lg"
                                    />
                                </InputGroup>
                            </div>

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
                                                            {product.category}
                                                        </Badge>
                                                    </div>

                                                    <Card.Title className="h5 mb-2">{product.brand}</Card.Title>
                                                    <Card.Subtitle className="text-muted mb-3">{product.model}</Card.Subtitle>

                                                    <div className="mb-3">
                                                        {product.category === 'panel' && product.power_w && (
                                                            <div className="d-flex justify-content-between align-items-center mb-1">
                                                                <small className="text-muted">Power:</small>
                                                                <Badge bg="warning" text="dark">{product.power_w}W</Badge>
                                                            </div>
                                                        )}
                                                        {product.category === 'inverter' && product.rating_kva && (
                                                            <div className="d-flex justify-content-between align-items-center mb-1">
                                                                <small className="text-muted">Rating:</small>
                                                                <Badge bg="info">{product.rating_kva}kVA</Badge>
                                                            </div>
                                                        )}
                                                        {product.category === 'battery' && product.capacity_kwh && (
                                                            <div className="d-flex justify-content-between align-items-center mb-1">
                                                                <small className="text-muted">Capacity:</small>
                                                                <Badge bg="success">{product.capacity_kwh}kWh</Badge>
                                                            </div>
                                                        )}
                                                        {product.price && (
                                                            <div className="d-flex justify-content-between align-items-center">
                                                                <small className="text-muted">Price:</small>
                                                                <span className="fw-bold text-primary">R{product.price?.toLocaleString()}</span>
                                                            </div>
                                                        )}
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
                            )}
                        </Card>
                    </Col>
                </Row>
            </Container>

            {/* ---------- modal ---------- */}
            <Modal show={showModal} onHide={() => setShowModal(false)} size="lg" centered>
                <Modal.Header closeButton className="bg-light">
                    <Modal.Title>
                        <i className={`bi ${editId ? 'bi-pencil-fill' : 'bi-plus-lg'} me-2`}></i>
                        {editId ? 'Edit Product' : 'Add Product'}
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body className="p-4">
                    <Form>
                        <Row className="mb-3">
                            <Col md={4}>
                                <Form.Group>
                                    <Form.Label className="fw-semibold">Category</Form.Label>
                                    <Form.Select 
                                        value={form.category}
                                        onChange={e => handleChange('category', e.target.value)}
                                        size="lg"
                                        className="rounded-lg"
                                    >
                                        <option value="panel">Panel</option>
                                        <option value="inverter">Inverter</option>
                                        <option value="battery">Battery</option>
                                    </Form.Select>
                                </Form.Group>
                            </Col>
                            <Col md={4}>
                                <Form.Group>
                                    <Form.Label className="fw-semibold">Brand</Form.Label>
                                    <Form.Control 
                                        value={form.brand}
                                        onChange={e => handleChange('brand', e.target.value)}
                                        size="lg"
                                        className="rounded-lg"
                                        placeholder="e.g., SunPower"
                                    />
                                </Form.Group>
                            </Col>
                            <Col md={4}>
                                <Form.Group>
                                    <Form.Label className="fw-semibold">Model</Form.Label>
                                    <Form.Control 
                                        value={form.model}
                                        onChange={e => handleChange('model', e.target.value)}
                                        size="lg"
                                        className="rounded-lg"
                                        placeholder="e.g., A-Series"
                                    />
                                </Form.Group>
                            </Col>
                        </Row>

                        <Row className="mb-3">
                            {form.category === 'panel' && (
                                <Col md={4}>
                                    <Form.Group>
                                        <Form.Label className="fw-semibold">Power (W)</Form.Label>
                                        <Form.Control 
                                            type="number" 
                                            value={form.power_w || ''}
                                            onChange={e => handleChange('power_w', e.target.value)}
                                            size="lg"
                                            className="rounded-lg"
                                            placeholder="e.g., 400"
                                        />
                                    </Form.Group>
                                </Col>
                            )}
                            {form.category === 'inverter' && (
                                <Col md={4}>
                                    <Form.Group>
                                        <Form.Label className="fw-semibold">Rating (kVA)</Form.Label>
                                        <Form.Control 
                                            type="number" 
                                            value={form.rating_kva || ''}
                                            onChange={e => handleChange('rating_kva', e.target.value)}
                                            size="lg"
                                            className="rounded-lg"
                                            placeholder="e.g., 5"
                                        />
                                    </Form.Group>
                                </Col>
                            )}
                            {form.category === 'battery' && (
                                <Col md={4}>
                                    <Form.Group>
                                        <Form.Label className="fw-semibold">Capacity (kWh)</Form.Label>
                                        <Form.Control 
                                            type="number" 
                                            value={form.capacity_kwh || ''}
                                            onChange={e => handleChange('capacity_kwh', e.target.value)}
                                            size="lg"
                                            className="rounded-lg"
                                            placeholder="e.g., 10"
                                        />
                                    </Form.Group>
                                </Col>
                            )}

                            <Col md={4}>
                                <Form.Group>
                                    <Form.Label className="fw-semibold">Price (R)</Form.Label>
                                    <Form.Control 
                                        type="number" 
                                        value={form.price || ''}
                                        onChange={e => handleChange('price', e.target.value)}
                                        size="lg"
                                        className="rounded-lg"
                                        placeholder="e.g., 5000"
                                    />
                                </Form.Group>
                            </Col>
                            <Col md={4}>
                                <Form.Group>
                                    <Form.Label className="fw-semibold">Warranty (years)</Form.Label>
                                    <Form.Control 
                                        type="number" 
                                        value={form.warranty_y || ''}
                                        onChange={e => handleChange('warranty_y', e.target.value)}
                                        size="lg"
                                        className="rounded-lg"
                                        placeholder="e.g., 25"
                                    />
                                </Form.Group>
                            </Col>
                        </Row>

                        <Form.Group className="mb-3">
                            <Form.Label className="fw-semibold">Notes</Form.Label>
                            <Form.Control 
                                as="textarea" 
                                rows={3} 
                                value={form.notes || ''}
                                onChange={e => handleChange('notes', e.target.value)}
                                className="rounded-lg"
                                placeholder="Additional product details or specifications..."
                            />
                        </Form.Group>
                    </Form>
                </Modal.Body>
                <Modal.Footer className="bg-light">
                    <Button variant="outline-secondary" onClick={() => setShowModal(false)} size="lg">
                        Cancel
                    </Button>
                    <Button variant="primary" onClick={handleSave} disabled={loading} size="lg">
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
