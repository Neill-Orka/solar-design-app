import React, {useState, useEffect} from "react";
import axios from "axios";
import { Table, Button, Modal, Form, Row, Col, Alert, InputGroup } from 'react-bootstrap';
import { API_URL } from "./apiConfig";
import { useNotification } from "./NotificationContext";

const CATEGORY_PROPERTIES ={
    'battery': ['capacity', 'voltage', 'type'],
    'fuse': ['amp_rating'],
    'inverter': ['power_rating', 'voltage', 'max_dc_voltage'],
    'cable': ['length', 'gauge'],
    'panel': ['power_rating', 'voltage', 'current'],

}

function RuleEditor() {
    const [rules, setRules] = useState([]);
    const [products, setProducts] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [editingRule, setEditingRule] = useState(null);
    const [error, setError] = useState('');
    const { showNotification } = useNotification();

    useEffect(() => {
        fetchRules();
        fetchProducts();
    }, []);

    const fetchRules = async () => {
        try {
            const res = await axios.get(`${API_URL}/api/rules`);
            setRules(res.data);
        } catch (err) {
            setError('Failed to fetch rules');
        }
    };

    const fetchProducts = async () => {
        try {
            const res = await axios.get(`${API_URL}/api/products`);
            setProducts(res.data);
        } catch (err) {
            setError('Failed to fetch products');
        }
    };

    const handleShowModal = (rule = null) => {
        if (rule) {
            setEditingRule({...rule, constraints: rule.constraints || {} });
        } else {
            setEditingRule({ subject_product_id: '', rule_type: 'REQUIRES_ONE', object_category: '', constraints: {}, quantity_formula: '1', description: '' })
        }
        setShowModal(true);
    };

    const handleCloseModal = () => {
        setShowModal(false);
        setEditingRule(null);
    };

    const handleSave = async () => {
        try {
            if (editingRule.id) {
                await axios.put(`${API_URL}/api/rules/${editingRule.id}`, editingRule);
                showNotification('Rule updated successfully!', 'success');
            } else {
                await axios.post(`${API_URL}/api/rules`, editingRule);
                showNotification('Rule created successfully!', 'success');
            }
            fetchRules();
            handleCloseModal();
        } catch (err) {
            const errorMsg = err.response?.data?.error || 'Failed to save rule.';
            showNotification(errorMsg, 'danger');
        }
    };

    // Main change handler for simple inputs
    const handleChange = (e) => {
        const { name, value } = e.target;
        setEditingRule(prev => ({ ...prev, [name]: value }));
    };
    
    // Special handler for the dynamic constraint fields
    const handleConstraintChange = (key, value) => {
        setEditingRule(prev => {
            const newConstraints = { ...prev.constraints };
            if (value) {
                newConstraints[key] = value;
            } else {
                delete newConstraints[key]; // Remove property if value is cleared
            }
            return { ...prev, constraints: newConstraints };
        });
    };

    const handleDelete = async (ruleId) => {
        if (window.confirm('Are you sure you want to delete this rule?')) {
            try {
                await axios.delete(`${API_URL}/api/rules/${ruleId}`);
                showNotification('Rule deleted successfully!', 'success');
                fetchRules();
            } catch (err) {
                const errorMsg = err.response?.data?.error || 'Failed to delete rule.';
                showNotification(errorMsg, 'danger');
            }
        }
    };
    
    return (
        <div className="container mt-4">
            <div className="d-flex justify-content-between align-items-center mb-3">
                <h3>Component Rule Editor</h3>
                <Button onClick={() => handleShowModal()}>
                    <i className="bi bi-plus-circle me-2"></i>Create New Rule
                </Button>
            </div>

            {error && <Alert variant="danger">{error}</Alert>}

            <Table striped bordered hover responsive>
                <thead>
                    <tr>
                        <th>Subject Product</th>
                        <th>Rule Type</th>
                        <th>Object Category</th>
                        <th>Description</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {rules.map(rule => (
                        <tr key={rule.id}>
                            <td>{rule.subject_product_name}</td>
                            <td><span className="badge bg-secondary">{rule.rule_type}</span></td>
                            <td>{rule.object_category}</td>
                            <td>{rule.description}</td>
                            <td>
                                <Button variant="outline-primary" size="sm" className="me-2" onClick={() => handleShowModal(rule)}>Edit</Button>
                                <Button variant="outline-danger" size="sm" onClick={() => handleDelete(rule.id)}>Delete</Button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </Table>

            {editingRule && (
                <Modal show={showModal} onHide={handleCloseModal} size="lg">
                    <Modal.Header closeButton>
                        <Modal.Title>{editingRule.id ? 'Edit' : 'Create'} Rule</Modal.Title>
                    </Modal.Header>
                    <Modal.Body>
                        <Form>
                            {/* --- Step 1: Subject & Rule Type --- */}
                            <h5 className="mb-3 border-bottom pb-2">1. Define Subject & Rule</h5>
                            <Row>
                                <Col md={6}>
                                    <Form.Group className="mb-3">
                                        <Form.Label>This Product...</Form.Label>
                                        <Form.Select name="subject_product_id" value={editingRule.subject_product_id} onChange={handleChange}>
                                            <option value="">-- Select Product --</option>
                                            {products.map(p => <option key={p.id} value={p.id}>{p.brand} {p.model}</option>)}
                                        </Form.Select>
                                    </Form.Group>
                                </Col>
                                <Col md={6}>
                                    <Form.Group className="mb-3">
                                        <Form.Label>Rule</Form.Label>
                                        <Form.Select name="rule_type" value={editingRule.rule_type} onChange={handleChange}>
                                            <option value="REQUIRES_ONE">Requires one of...</option>
                                            <option value="REQUIRES_ALL">Requires all of...</option>
                                            <option value="EXCLUDES">Excludes...</option>
                                            <option value="RECOMMENDS">Recommends...</option>
                                        </Form.Select>
                                    </Form.Group>
                                </Col>
                            </Row>

                            {/* --- Step 2: Object & Properties --- */}
                            <h5 className="mb-3 mt-4 border-bottom pb-2">2. Define Object & Properties</h5>
                            <Row>
                                <Col md={6}>
                                    <Form.Group className="mb-3">
                                        <Form.Label>Category of Product</Form.Label>
                                        <Form.Select name="object_category" value={editingRule.object_category} onChange={handleChange}>
                                            <option value="">-- Select Category --</option>
                                            {Object.keys(CATEGORY_PROPERTIES).map(cat => <option key={cat} value={cat}>{cat}</option>)}
                                        </Form.Select>
                                    </Form.Group>
                                </Col>
                            </Row>
                            {editingRule.object_category && (
                                <Row>
                                    <p className="text-muted small">...with these specific properties (optional):</p>
                                    {CATEGORY_PROPERTIES[editingRule.object_category].map(prop => (
                                        <Col md={4} key={prop}>
                                            <Form.Group className="mb-3">
                                                <Form.Label>{prop.replace('_', ' ')}</Form.Label>
                                                <Form.Control 
                                                    type="text" 
                                                    value={editingRule.constraints[prop] || ''} 
                                                    onChange={(e) => handleConstraintChange(prop, e.target.value)}
                                                />
                                            </Form.Group>
                                        </Col>
                                    ))}
                                </Row>
                            )}

                            {/* --- Step 3: Quantity & Description --- */}
                            <h5 className="mb-3 mt-4 border-bottom pb-2">3. Define Quantity & Description</h5>
                            <Row>
                                <Col md={6}>
                                    <Form.Group className="mb-3">
                                        <Form.Label>Quantity</Form.Label>
                                        <Form.Control type="text" name="quantity_formula" value={editingRule.quantity_formula} onChange={handleChange} placeholder="e.g., 1 or num_panels" />
                                        <Form.Text>Enter a number (e.g., 1) or a formula (e.g., num_panels).</Form.Text>
                                    </Form.Group>
                                </Col>
                                <Col md={6}>
                                    <Form.Group className="mb-3">
                                        <Form.Label>User-Friendly Description</Form.Label>
                                        <Form.Control type="text" name="description" value={editingRule.description} onChange={handleChange} placeholder="e.g., Requires a compatible 48V battery" />
                                    </Form.Group>
                                </Col>
                            </Row>
                        </Form>
                    </Modal.Body>
                    <Modal.Footer>
                        <Button variant="secondary" onClick={handleCloseModal}>Cancel</Button>
                        <Button variant="primary" onClick={handleSave}>Save Rule</Button>
                    </Modal.Footer>
                </Modal>
            )}
        </div>
    );
}

export default RuleEditor;