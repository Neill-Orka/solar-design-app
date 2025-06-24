import React, { useState, useEffect } from "react";
import axios from "axios";
import { Table, Button, Modal, Form, Row, Col, InputGroup } from "react-bootstrap";
import { FaTrash, FaEdit, FaPlus } from "react-icons/fa";
import { API_URL } from "./apiConfig"; // Adjust the import based on your project structure

const EMPTY_PRODUCT = {
    category: 'panel', brand: '', model: '',
    power_w: '', rating_kva: '', capacity_kwh: '',
    cost: '', price: '', warranty_y: '', notes: ''
};

export default function ProductsAdmin() {
    const [products, setProducts] = useState([]);
    const [search, setSearch] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editId, setEditId] = useState(null);
    const [form, setForm] = useState(EMPTY_PRODUCT);
    const [loading, setLoading] = useState(false);

    // ------ load list -----------------------------------
    const fetchProducts = () => 
        axios.get(`${API_URL}/api/products`)
            .then(r => setProducts(r.data));

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
            .then(fetchProducts);
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
        .finally(() => setLoading(false))
    };

    // ------ helpers -------------------------------------
    const handleChange = (k, v) => setForm({ ...form, [k]: v });

    const filtered = products.filter(p =>
        `${p.brand} ${p.model}`.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="container py-4">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <h3 className="m-0">Products Catalogue</h3>
            <Button onClick={openAdd}><FaPlus /> Add Product</Button>
          </div>
    
          <InputGroup className="mb-3">
            <InputGroup.Text>Search</InputGroup.Text>
            <Form.Control value={search} onChange={e => setSearch(e.target.value)} />
          </InputGroup>
    
          <Table bordered hover responsive>
            <thead className="table-light">
              <tr>
                <th>Category</th><th>Brand</th><th>Model</th>
                <th>Power W</th><th>kVA</th><th>kWh</th>
                <th>Price (R)</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => (
                <tr key={p.id}>
                  <td>{p.category}</td>
                  <td>{p.brand}</td>
                  <td>{p.model}</td>
                  <td>{p.power_w || '-'}</td>
                  <td>{p.rating_kva || '-'}</td>
                  <td>{p.capacity_kwh || '-'}</td>
                  <td>{p.price || '-'}</td>
                  <td className="text-nowrap">
                    <Button size="sm" variant="outline-secondary" onClick={() => openEdit(p)}>
                      <FaEdit />
                    </Button>{' '}
                    <Button size="sm" variant="outline-danger" onClick={() => deleteProduct(p.id)}>
                      <FaTrash />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
    
          {/* ---------- modal ---------- */}
          <Modal show={showModal} onHide={() => setShowModal(false)} size="lg">
            <Modal.Header closeButton>
              <Modal.Title>{editId ? 'Edit Product' : 'Add Product'}</Modal.Title>
            </Modal.Header>
            <Modal.Body>
              <Form>
                <Row className="mb-2">
                  <Col md={4}>
                    <Form.Group>
                      <Form.Label>Category</Form.Label>
                      <Form.Select value={form.category}
                                   onChange={e => handleChange('category', e.target.value)}>
                        <option value="panel">Panel</option>
                        <option value="inverter">Inverter</option>
                        <option value="battery">Battery</option>
                      </Form.Select>
                    </Form.Group>
                  </Col>
                  <Col md={4}>
                    <Form.Group>
                      <Form.Label>Brand</Form.Label>
                      <Form.Control value={form.brand}
                                    onChange={e => handleChange('brand', e.target.value)} />
                    </Form.Group>
                  </Col>
                  <Col md={4}>
                    <Form.Group>
                      <Form.Label>Model</Form.Label>
                      <Form.Control value={form.model}
                                    onChange={e => handleChange('model', e.target.value)} />
                    </Form.Group>
                  </Col>
                </Row>
    
                {/* numbers row */}
                <Row className="mb-2">
                  {form.category === 'panel' && (
                    <Col md={4}>
                      <Form.Group>
                        <Form.Label>Power (W)</Form.Label>
                        <Form.Control type="number" value={form.power_w || ''}
                                      onChange={e => handleChange('power_w', e.target.value)} />
                      </Form.Group>
                    </Col>
                  )}
                  {form.category === 'inverter' && (
                    <Col md={4}>
                      <Form.Group>
                        <Form.Label>Rating (kVA)</Form.Label>
                        <Form.Control type="number" value={form.rating_kva || ''}
                                      onChange={e => handleChange('rating_kva', e.target.value)} />
                      </Form.Group>
                    </Col>
                  )}
                  {form.category === 'battery' && (
                    <Col md={4}>
                      <Form.Group>
                        <Form.Label>Capacity (kWh)</Form.Label>
                        <Form.Control type="number" value={form.capacity_kwh || ''}
                                      onChange={e => handleChange('capacity_kwh', e.target.value)} />
                      </Form.Group>
                    </Col>
                  )}
    
                  <Col md={4}>
                    <Form.Group>
                      <Form.Label>Price (R)</Form.Label>
                      <Form.Control type="number" value={form.price || ''}
                                    onChange={e => handleChange('price', e.target.value)} />
                    </Form.Group>
                  </Col>
                  <Col md={4}>
                    <Form.Group>
                      <Form.Label>Warranty (yrs)</Form.Label>
                      <Form.Control type="number" value={form.warranty_y || ''}
                                    onChange={e => handleChange('warranty_y', e.target.value)} />
                    </Form.Group>
                  </Col>
                </Row>
    
                <Form.Group className="mb-2">
                  <Form.Label>Notes</Form.Label>
                  <Form.Control as="textarea" rows={2} value={form.notes || ''}
                                onChange={e => handleChange('notes', e.target.value)} />
                </Form.Group>
              </Form>
            </Modal.Body>
            <Modal.Footer>
              <Button variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button>
              <Button variant="primary" onClick={handleSave} disabled={loading}>
                {loading ? 'Saving…' : 'Save'}
              </Button>
            </Modal.Footer>
          </Modal>
        </div>
    );
}  
