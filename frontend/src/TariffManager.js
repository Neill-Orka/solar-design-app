import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Button, Modal, Form, InputGroup, Badge, Accordion, Table, Alert, Spinner } from 'react-bootstrap';
import { FaTrash, FaEdit, FaPlus, FaFileAlt } from 'react-icons/fa';
import './TariffManager.css';

// --- Placeholder Data ---
// This mimics the data structure we'll get from the API later.
const PLACEHOLDER_TARIFFS = [
    {
        id: 1,
        name: 'Homepower 4',
        power_user_type: 'SPU',
        tariff_category: 'Residential',
        code: 'HP4',
        matrix_code: 'ESK-HP4-R',
        structure: 'tiered',
        rates: [
            { id: 101, charge_name: 'Service and administration charge', charge_category: 'fixed', season: 'all', time_of_use: 'all', rate_unit: 'R/POD/day', rate_value: 8.22 },
            { id: 102, charge_name: 'Energy Charge', charge_category: 'energy', season: 'all', time_of_use: 'all', rate_unit: 'c/kWh', rate_value: 258.57, block_threshold_kwh: 600 },
            { id: 103, charge_name: 'Energy Charge', charge_category: 'energy', season: 'all', time_of_use: 'all', rate_unit: 'c/kWh', rate_value: 301.21, block_threshold_kwh: null }
        ]
    },
    {
        id: 2,
        name: 'Megaflex',
        power_user_type: 'LPU',
        tariff_category: 'Commercial',
        transmission_zone: 'Urban',
        supply_voltage: '> 1kV < 22kV',
        code: 'MFX-U-1',
        matrix_code: 'ESK-MFX-C-U1',
        structure: 'time_of_use',
        rates: [
            { id: 201, charge_name: 'Network Access Charges', charge_category: 'demand', season: 'all', time_of_use: 'all', rate_unit: 'R/kVA/m', rate_value: 150.00 },
            { id: 202, charge_name: 'Energy Charge', charge_category: 'energy', season: 'high', time_of_use: 'peak', rate_unit: 'c/kWh', rate_value: 410.30 },
            { id: 203, charge_name: 'Energy Charge', charge_category: 'energy', season: 'high', time_of_use: 'standard', rate_unit: 'c/kWh', rate_value: 167.00 },
            { id: 204, charge_name: 'Energy Charge', charge_category: 'energy', season: 'low', time_of_use: 'peak', rate_unit: 'c/kWh', rate_value: 134.11 },
        ]
    }
];

const EMPTY_TARIFF = {
    name: '', power_user_type: 'SPU', tariff_category: '', code: '',
    matrix_code: '', structure: 'flat_rate', rates: [
        { charge_name: 'Energy Charge', charge_category: 'energy', season: 'all', time_of_use: 'all', rate_unit: 'c/kWh', rate_value: '' }
    ]
};

export default function TariffManager() {
    const [tariffs, setTariffs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [formState, setFormState] = useState(EMPTY_TARIFF);
    
    // Simulate fetching data on component mount
    useEffect(() => {
        setTimeout(() => {
            setTariffs(PLACEHOLDER_TARIFFS);
            setLoading(false);
        }, 1000); // Simulate network delay
    }, []);

    const handleOpenAddModal = () => {
        setIsEditing(false);
        setFormState(EMPTY_TARIFF);
        setShowModal(true);
    };

    const handleOpenEditModal = (tariff) => {
        setIsEditing(true);
        setFormState(JSON.parse(JSON.stringify(tariff))); // Deep copy
        setShowModal(true);
    };

    const handleCloseModal = () => setShowModal(false);

    const handleSave = () => {
        // This is where the API call to save the data will go.
        // For now, we just update the local state.
        console.log("Saving tariff:", formState);
        handleCloseModal();
        // Here you would refetch the tariffs list from the API.
    };
    
    const handleDelete = (tariffId) => {
        if (window.confirm('Are you sure you want to delete this tariff?')) {
            console.log("Deleting tariff:", tariffId);
            // API call to delete, then refetch.
        }
    };
    
    // --- Form State Handlers ---
    const handleFormChange = (e) => {
        const { name, value } = e.target;
        setFormState(prev => ({ ...prev, [name]: value }));
    };

    const handleRateChange = (index, e) => {
        const { name, value } = e.target;
        const newRates = [...formState.rates];
        newRates[index] = { ...newRates[index], [name]: value };
        setFormState(prev => ({ ...prev, rates: newRates }));
    };

    const addRate = () => {
        const newRate = { charge_name: '', charge_category: 'energy', season: 'all', time_of_use: 'all', rate_unit: 'c/kWh', rate_value: '' };
        setFormState(prev => ({ ...prev, rates: [...prev.rates, newRate] }));
    };

    const removeRate = (index) => {
        if (formState.rates.length <= 1) return; // Must have at least one rate
        const newRates = formState.rates.filter((_, i) => i !== index);
        setFormState(prev => ({ ...prev, rates: newRates }));
    };

    return (
        <div className="tariff-manager-page">
            <Container fluid className="py-4 py-md-5">
                <Card className="shadow-lg border-0 rounded-xl p-4 p-md-5">
                    <div className="d-flex justify-content-between align-items-center mb-4">
                        <div>
                            <h2 className="text-3xl font-bold text-gray-800 mb-1 d-flex align-items-center">
                                <FaFileAlt className="me-3 text-primary" />Tariff Catalogue
                            </h2>
                            <p className="text-muted mb-0">View, add, and manage electricity tariff structures.</p>
                        </div>
                        <Button onClick={handleOpenAddModal} className="btn-primary shadow-sm">
                            <FaPlus className="me-2" />Add New Tariff
                        </Button>
                    </div>

                    {loading && <div className="text-center p-5"><Spinner animation="border" variant="primary" /></div>}
                    {error && <Alert variant="danger">{error}</Alert>}

                    {!loading && (
                        <Accordion defaultActiveKey="0">
                            {tariffs.map((tariff, index) => (
                                <Accordion.Item eventKey={String(index)} key={tariff.id} className="mb-2 tariff-accordion-item">
                                    <Accordion.Header>
                                        <div className="d-flex w-100 justify-content-between align-items-center pe-2">
                                            <div className="tariff-header-info">
                                                <span className="fw-bold fs-5">{tariff.name}</span>
                                                <div className="d-flex gap-2 mt-1">
                                                    <Badge pill bg="primary">{tariff.power_user_type}</Badge>
                                                    <Badge pill bg="secondary">{tariff.tariff_category}</Badge>
                                                    <Badge pill bg="info" text="dark">{tariff.structure}</Badge>
                                                </div>
                                            </div>
                                            <div className="tariff-actions">
                                                <Button variant="outline-primary" size="sm" onClick={(e) => { e.stopPropagation(); handleOpenEditModal(tariff); }}><FaEdit /></Button>
                                                <Button variant="outline-danger" size="sm" className="ms-2" onClick={(e) => { e.stopPropagation(); handleDelete(tariff.id); }}><FaTrash /></Button>
                                            </div>
                                        </div>
                                    </Accordion.Header>
                                    <Accordion.Body>
                                        <Table striped bordered hover responsive size="sm">
                                            <thead>
                                                <tr>
                                                    <th>Charge Name</th>
                                                    <th>Category</th>
                                                    <th>Season</th>
                                                    <th>Time of Use</th>
                                                    <th>Rate</th>
                                                    <th>Unit</th>
                                                    <th>Block Limit (kWh)</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {tariff.rates.map(rate => (
                                                    <tr key={rate.id}>
                                                        <td>{rate.charge_name}</td>
                                                        <td><Badge bg="dark">{rate.charge_category}</Badge></td>
                                                        <td>{rate.season}</td>
                                                        <td>{rate.time_of_use}</td>
                                                        <td className="fw-bold">{rate.rate_value}</td>
                                                        <td>{rate.rate_unit}</td>
                                                        <td>{rate.block_threshold_kwh || 'N/A'}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </Table>
                                    </Accordion.Body>
                                </Accordion.Item>
                            ))}
                        </Accordion>
                    )}
                </Card>
            </Container>

            {/* --- Add/Edit Modal --- */}
            <Modal show={showModal} onHide={handleCloseModal} size="xl" centered>
                <Modal.Header closeButton className="bg-light">
                    <Modal.Title>{isEditing ? 'Edit Tariff' : 'Add New Tariff'}</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <Form>
                        <h5>Tariff Details</h5>
                        <Row>
                            <Col md={4}><Form.Group className="mb-3"><Form.Label>Tariff Name</Form.Label><Form.Control name="name" value={formState.name} onChange={handleFormChange} /></Form.Group></Col>
                            <Col md={4}><Form.Group className="mb-3"><Form.Label>Power User Type</Form.Label><Form.Select name="power_user_type" value={formState.power_user_type} onChange={handleFormChange}><option value="SPU">SPU</option><option value="LPU">LPU</option></Form.Select></Form.Group></Col>
                            <Col md={4}><Form.Group className="mb-3"><Form.Label>Category</Form.Label><Form.Control name="tariff_category" value={formState.tariff_category} onChange={handleFormChange} /></Form.Group></Col>
                            <Col md={4}><Form.Group className="mb-3"><Form.Label>Code</Form.Label><Form.Control name="code" value={formState.code} onChange={handleFormChange} /></Form.Group></Col>
                            <Col md={4}><Form.Group className="mb-3"><Form.Label>Matrix Code</Form.Label><Form.Control name="matrix_code" value={formState.matrix_code} onChange={handleFormChange} /></Form.Group></Col>
                            <Col md={4}><Form.Group className="mb-3"><Form.Label>Structure</Form.Label><Form.Select name="structure" value={formState.structure} onChange={handleFormChange}><option value="flat_rate">Flat Rate</option><option value="tiered">Tiered</option><option value="time_of_use">Time of Use</option></Form.Select></Form.Group></Col>
                        </Row>
                        <hr className="my-4"/>
                        <h5>Tariff Rates</h5>
                        {formState.rates.map((rate, index) => (
                            <Card key={index} className="mb-3 bg-light border-dashed">
                                <Card.Body>
                                    <Row>
                                        <Col md={3}><Form.Group><Form.Label>Charge Name</Form.Label><Form.Control size="sm" name="charge_name" value={rate.charge_name} onChange={(e) => handleRateChange(index, e)}/></Form.Group></Col>
                                        <Col md={2}><Form.Group><Form.Label>Category</Form.Label><Form.Select size="sm" name="charge_category" value={rate.charge_category} onChange={(e) => handleRateChange(index, e)}><option value="energy">Energy</option><option value="demand">Demand</option><option value="fixed">Fixed</option></Form.Select></Form.Group></Col>
                                        <Col md={2}><Form.Group><Form.Label>Season</Form.Label><Form.Select size="sm" name="season" value={rate.season} onChange={(e) => handleRateChange(index, e)}><option value="all">All</option><option value="high">High</option><option value="low">Low</option></Form.Select></Form.Group></Col>
                                        <Col md={2}><Form.Group><Form.Label>Time of Use</Form.Label><Form.Select size="sm" name="time_of_use" value={rate.time_of_use} onChange={(e) => handleRateChange(index, e)}><option value="all">All</option><option value="peak">Peak</option><option value="standard">Standard</option><option value="off_peak">Off-Peak</option></Form.Select></Form.Group></Col>
                                        <Col md={3}><Form.Group><Form.Label>Rate Unit</Form.Label><Form.Control size="sm" name="rate_unit" value={rate.rate_unit} onChange={(e) => handleRateChange(index, e)}/></Form.Group></Col>
                                        <Col md={3}><Form.Group><Form.Label>Rate Value</Form.Label><Form.Control size="sm" type="number" name="rate_value" value={rate.rate_value} onChange={(e) => handleRateChange(index, e)}/></Form.Group></Col>
                                        <Col md={3}><Form.Group><Form.Label>Block Limit (kWh)</Form.Label><Form.Control size="sm" type="number" name="block_threshold_kwh" value={rate.block_threshold_kwh || ''} onChange={(e) => handleRateChange(index, e)} placeholder="N/A"/></Form.Group></Col>
                                        <Col md={3} className="d-flex align-items-end">
                                            <Button variant="danger" size="sm" onClick={() => removeRate(index)}>
                                                <FaTrash />
                                            </Button>
                                        </Col>
                                    </Row>
                                </Card.Body>
                            </Card>
                        ))}
                        <Button variant="outline-primary" onClick={addRate}><FaPlus className="me-2"/>Add Rate</Button>
                    </Form>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={handleCloseModal}>Cancel</Button>
                    <Button variant="primary" onClick={handleSave}>Save Changes</Button>
                </Modal.Footer>
            </Modal>
        </div>
    );
}