import React, { useState, useEffect } from "react";
import axios from "axios";
import { Container, Row, Col, Card, Button, Modal, Form, InputGroup, Badge, Spinner, Alert, ButtonGroup, Table } from "react-bootstrap";
import { FaTrash, FaEdit, FaPlus } from "react-icons/fa";
import { API_URL } from "./apiConfig";

const EMPTY_PRODUCT = {
    category: 'panel', brand: '', model: '',
    power_w: '', rating_kva: '', capacity_kwh: '',
    cost: '', price: '', warranty_y: '', notes: '', properties: ''
};

//  Meta for every field we MIGHT display/edit
const FIELD_META = {
  brand:        { label: "Brand",          type: "text"   },
  model:        { label: "Model / SKU",    type: "text"   },
  price:        { label: "Price (R)",      type: "number" },
  power_w:      { label: "Power (W)",      type: "number", category: "Panel"    },
  rating_kva:   { label: "Rating (kVA)",   type: "number", category: "Inverter" },
  capacity_kwh: { label: "Capacity (kWh)", type: "number", category: "Battery"  },
  unit_cost:    { label: "Unit Cost (R)",  type: "number" },
  margin:       { label: "Margin (%)",     type: "number" },
  warranty_y:   { label: "Warranty (y)",   type: "number" },
  notes:        { label: "Notes",          type: "textarea" },
};

// Helper that only returns the keys that are not null
const getVisibleFields = (prod) => {
    return Object.keys(FIELD_META)
    .filter((k) => {
        const catOK = !FIELD_META[k].category || FIELD_META[k].category === prod.category;
        const v = prod[k];
        return catOK && v !== null && v !== undefined && v !== '';
    })
    .map((k) => ({ key: k, meta: FIELD_META[k] }));
};


const getCategoryIcon = (category) => {
    switch(category) {
        case 'Panel': return 'bi-grid-3x3-gap-fill';
        case 'Inverter': return 'bi-box-seam';
        case 'Battery': return 'bi-battery-full';
        default: return 'bi-gear-fill';
    }
};

const getCategoryColor = (category) => {
    switch(category) {
        case 'Panel': return 'warning';
        case 'Inverter': return 'info';
        case 'Battery': return 'success';
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
    const [viewMode, setViewMode] = useState('list'); // Default to list view

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

        const payload = { ...form };

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
                                                placeholder="Search products by brand or model..."
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
                                                            {product.category}
                                                        </Badge>
                                                    </div>

                                                    <Card.Title className="h5 mb-2">{product.brand}</Card.Title>
                                                    <Card.Subtitle className="text-muted mb-3">{product.model}</Card.Subtitle>

                                                    <div className="mb-3">
                                                        {getVisibleFields(product).map(({ key, meta }) => (
                                                          ["power_w","rating_kva","capacity_kwh","price"].includes(key) && (
                                                            <div
                                                              key={key}
                                                              className="d-flex justify-content-between align-items-center mb-1"
                                                            >
                                                              <small className="text-muted">{meta.label.replace(/ \(.+/, "")}:</small>
                                                              <Badge bg={
                                                                key === "power_w" ? "warning"
                                                                : key === "rating_kva" ? "info"
                                                                : key === "capacity_kwh" ? "success"
                                                                : "primary"
                                                              } text={key === "power_w" ? "dark" : undefined}>
                                                                {key === "price" ? "R " : ""}{product[key]}
                                                                {key === "power_w" ? "W" :
                                                                 key === "rating_kva" ? "kVA" :
                                                                 key === "capacity_kwh" ? "kWh" : ""}
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
                                                <th className="ps-4" style={{width: "15%"}}>Category</th>
                                                <th style={{width: "20%"}}>Brand</th>
                                                <th style={{width: "20%"}}>Model</th>
                                                <th style={{width: "15%"}}>Specifications</th>
                                                <th style={{width: "15%"}}>Price</th>
                                                <th className="text-end pe-4" style={{width: "15%"}}>Actions</th>
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
                                                                {product.category}
                                                            </Badge>
                                                        </div>
                                                    </td>
                                                    <td className="fw-semibold">{product.brand}</td>
                                                    <td>{product.model}</td>
                                                    <td>
                                                        {product.category === 'Panel' && product.power_w && (
                                                            <Badge bg="warning" text="dark">{product.power_w}W</Badge>
                                                        )}
                                                        {product.category === 'Inverter' && product.rating_kva && (
                                                            <Badge bg="info">{product.rating_kva}kVA</Badge>
                                                        )}
                                                        {product.category === 'Battery' && product.capacity_kwh && (
                                                            <Badge bg="success">{product.capacity_kwh}kWh</Badge>
                                                        )}
                                                    </td>
                                                    <td>
                                                        {product.price && (
                                                            <Badge bg="primary">R {product.price}</Badge>
                                                        )}
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
                <Modal.Header closeButton className="bg-light">
                    <Modal.Title>
                        <i className={`bi ${editId ? 'bi-pencil-fill' : 'bi-plus-lg'} me-2`}></i>
                        {editId ? 'Edit Product' : 'Add Product'}
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body className="p-4">
                    <Form>
                        {getVisibleFields(form).map(({ key, meta }) => (
                          <Row className="mb-3" key={key}>
                            <Col md={6}>
                              <Form.Group>
                                <Form.Label className="fw-semibold">{meta.label}</Form.Label>
                                {meta.type === "textarea" ? (
                                  <Form.Control
                                    as="textarea"
                                    rows={3}
                                    value={form[key] || ""}
                                    onChange={(e) => handleChange(key, e.target.value)}
                                    className="rounded-lg"
                                  />
                                ) : (
                                  <Form.Control
                                    type={meta.type}
                                    value={form[key] || ""}
                                    onChange={(e) => handleChange(key, e.target.value)}
                                    size="lg"
                                    className="rounded-lg"
                                  />
                                )}
                              </Form.Group>
                            </Col>
                          </Row>
                        ))}
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
