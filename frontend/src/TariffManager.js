import React, { useState, useEffect, useMemo } from 'react';
import { Container, Row, Col, Card, Button, Modal, Form, InputGroup, Badge, Accordion, Table, Alert, Spinner, FormControl, Pagination } from 'react-bootstrap';
import { FaTrash, FaEdit, FaPlus, FaFileAlt, FaSearch } from 'react-icons/fa';
import axios from 'axios';
import { API_URL } from './apiConfig';
import './TariffManager.css';

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
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage] = useState(10)

    const [filters, setFilters] = useState({
        power_user_type: 'all',
        tariff_category: 'all',
        structure: 'all',
        supply_voltage: 'all',
        transmission_zone: 'all',
    });

    const fetchTariffs = async () => {
        setLoading(true);
        try {
            const response = await axios.get(`${API_URL}/api/tariffs`);
            setTariffs(response.data);
            setError('');
        } catch (err) {
            setError('Failed to load tariffs. Please ensure the backend is running.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };    

    // --- UPDATED: useEffect to call fetchTariffs on component mount ---
    useEffect(() => {
        fetchTariffs();
    }, []);

    const availableOptions = useMemo(() => {
        let optionsFiltered = tariffs;
        if (filters.power_user_type !== 'all') {
            optionsFiltered = optionsFiltered.filter(t => t.power_user_type === filters.power_user_type);
        }
        const powerUserTypes = [...new Set(tariffs.map(t => t.power_user_type))];
        const categories = [...new Set(optionsFiltered.map(t => t.tariff_category))];
        const structures = [...new Set(optionsFiltered.map(t => t.structure))];
        const voltages = [...new Set(optionsFiltered.filter(t => t.supply_voltage).map(t => t.supply_voltage))];
        const zones = [...new Set(optionsFiltered.filter(t => t.transmission_zone).map(t => t.transmission_zone))];
        return { powerUserTypes, categories, structures, voltages, zones };
    }, [tariffs, filters.power_user_type]);

    const filteredTariffs = useMemo(() => {
        const lowercasedSearchTerm = searchTerm.toLowerCase().trim();
        return tariffs
            .filter(t => filters.power_user_type === 'all' || t.power_user_type === filters.power_user_type)
            .filter(t => filters.tariff_category === 'all' || t.tariff_category === filters.tariff_category)
            .filter(t => filters.structure === 'all' || t.structure === filters.structure)
            .filter(t => filters.supply_voltage === 'all' || t.supply_voltage === filters.supply_voltage)
            .filter(t => filters.transmission_zone === 'all' || t.transmission_zone === filters.transmission_zone)
            .filter(t => !lowercasedSearchTerm || t.name.toLowerCase().includes(lowercasedSearchTerm));
    }, [tariffs, searchTerm, filters]);
    
    // --- NEW: Handler for filter changes ---
    const handleFilterChange = (e) => {
        const { name, value } = e.target;
        setFilters(prev => {
            const newFilters = { ...prev, [name]: value };
            if (name === 'power_user_type') { // Reset dependent filters
                newFilters.tariff_category = 'all';
                newFilters.structure = 'all';
                newFilters.supply_voltage = 'all';
                newFilters.transmission_zone = 'all';
            }
            return newFilters;
        });
        setCurrentPage(1); // Reset to first page on any filter change
    };

    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentTariffs = filteredTariffs.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = Math.ceil(filteredTariffs.length / itemsPerPage);

    const paginate = (pageNumber) => setCurrentPage(pageNumber);

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

    // --- UPDATED: handleSave to use axios.post/put ---
    const handleSave = async () => {
        const url = isEditing ? `${API_URL}/api/tariffs/${formState.id}` : `${API_URL}/api/tariffs`;
        const method = isEditing ? 'put' : 'post';

        try {
            await axios[method](url, formState);
            handleCloseModal();
            fetchTariffs(); // Refresh the list after saving
        } catch (err) {
            setError('Failed to save tariff.');
            console.error(err);
        }
    };
    
    // --- UPDATED: handleDelete to use axios.delete ---
    const handleDelete = async (tariffId) => {
        if (window.confirm('Are you sure you want to delete this tariff?')) {
            try {
                await axios.delete(`${API_URL}/api/tariffs/${tariffId}`);
                fetchTariffs(); // Refresh the list
            } catch (err) {
                setError('Failed to delete tariff.');
                console.error(err);
            }
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
                    <Card className='border-light bg-light mb-4'>
                        <Card.Body>
                            <Row className="g-2">
                                <Col md={4}><Form.Select size="sm" name="power_user_type" value={filters.power_user_type} onChange={handleFilterChange}><option value="all">All Power User Types</option>{availableOptions.powerUserTypes.map(opt => <option key={opt} value={opt}>{opt}</option>)}</Form.Select></Col>
                                <Col md={4}><Form.Select size="sm" name="tariff_category" value={filters.tariff_category} onChange={handleFilterChange}><option value="all">All Categories</option>{availableOptions.categories.map(opt => <option key={opt} value={opt}>{opt}</option>)}</Form.Select></Col>
                                <Col md={4}><Form.Select size="sm" name="structure" value={filters.structure} onChange={handleFilterChange}><option value="all">All Structures</option>{availableOptions.structures.map(opt => <option key={opt} value={opt}>{opt}</option>)}</Form.Select></Col>
                                {filters.power_user_type === 'LPU' && (
                                    <>
                                        <Col md={6} className="mt-2"><Form.Select size="sm" name="supply_voltage" value={filters.supply_voltage} onChange={handleFilterChange}><option value="all">All Voltages</option>{availableOptions.voltages.map(opt => <option key={opt} value={opt}>{opt}</option>)}</Form.Select></Col>
                                        <Col md={6} className="mt-2"><Form.Select size="sm" name="transmission_zone" value={filters.transmission_zone} onChange={handleFilterChange}><option value="all">All Zones</option>{availableOptions.zones.map(opt => <option key={opt} value={opt}>{opt}</option>)}</Form.Select></Col>
                                    </>
                                )}
                            </Row>
                        </Card.Body>                        
                    </Card>

                    {/* Search bar */}
                    <div className='mb-4'>
                        <InputGroup>
                            <InputGroup.Text><FaSearch /></InputGroup.Text>
                            <FormControl
                                placeholder='Search by name, category or type..'
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </InputGroup>
                    </div>

                    {loading && <div className="text-center p-5"><Spinner animation="border" variant="primary" /></div>}
                    {error && <Alert variant="danger">{error}</Alert>}

                    {!loading && (
                    <>
                        <Accordion>
                            {currentTariffs.map((tariff) => (
                                <Accordion.Item eventKey={String(tariff.id)} key={tariff.id} className="mb-2 tariff-accordion-item">
                                    <Accordion.Header>
                                        <div className="d-flex w-100 justify-content-between align-items-center pe-2">
                                            <div className="tariff-header-info">
                                                <span className="fw-bold fs-5">{tariff.name} ({tariff.matrix_code})</span>
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
                                            {/* --- NEW: Conditionally display LPU-specific details --- */}
                                            {tariff.power_user_type === 'LPU' && (
                                                <div className="lpu-details mb-3">
                                                    <Badge bg="light" text="dark" className="me-2">Zone: {tariff.transmission_zone}</Badge>
                                                    <Badge bg="light" text="dark">Voltage: {tariff.supply_voltage}</Badge>
                                                </div>
                                            )}

                                            <Table striped bordered hover responsive size="sm">
                                                <thead>
                                                    <tr>
                                                        <th>Charge Name</th>
                                                        <th>Category</th>
                                                        <th>Rate</th>
                                                        <th>Unit</th>
                                                        {/* --- NEW: Conditionally render table headers --- */}
                                                        {tariff.structure === 'time_of_use' && (
                                                            <>
                                                                <th>Season</th>
                                                                <th>Time of Use</th>
                                                            </>
                                                        )}
                                                        {tariff.structure === 'tiered' && (
                                                            <th>Block Limit (kWh)</th>
                                                        )}
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {tariff.rates.map(rate => (
                                                        <tr key={rate.id}>
                                                            <td>{rate.charge_name}</td>
                                                            <td><Badge bg="dark">{rate.charge_category}</Badge></td>
                                                            <td className="fw-bold">{rate.rate_value}</td>
                                                            <td>{rate.rate_unit}</td>
                                                            {/* --- NEW: Conditionally render table cells --- */}
                                                            {tariff.structure === 'time_of_use' && (
                                                                <>
                                                                    <td>{rate.season}</td>
                                                                    <td>{rate.time_of_use}</td>
                                                                </>
                                                            )}
                                                            {tariff.structure === 'tiered' && (
                                                                <td>{rate.block_threshold_kwh || 'N/A'}</td>
                                                            )}
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </Table>
                                        </Accordion.Body>
                                </Accordion.Item>
                            ))}
                        </Accordion>

                        {/* New pagination component */}
                        {totalPages > 1 && (
                            <div className='d-flex justify-content-center mt-4'>
                                <Pagination>
                                    <Pagination.Prev onClick={() => paginate(currentPage - 1)} disabled={currentPage === 1} />
                                    {[...Array(totalPages).keys()].map(number => (
                                        <Pagination.Item key={number + 1} active={number + 1 === currentPage} onClick={() => paginate(number + 1)}>
                                            {number + 1}
                                        </Pagination.Item>
                                    ))}
                                    <Pagination.Next onClick={() => paginate(currentPage + 1)} disabled={currentPage === totalPages} />
                                </Pagination>
                            </div>
                        )}
                    </>
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