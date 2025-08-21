import React, { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { Container, Row, Col, Card, Button, Form, Spinner, Alert } from 'react-bootstrap';
import { API_URL } from "./apiConfig";
import TariffSelector from "./TariffSelector";

function AddProject() {
  const [showToast, setShowToast] = useState(false);
  const [clients, setClients] = useState([]);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [newClientName, setNewClientName] = useState('');
  const [newClientPhone, setNewClientPhone] = useState('');
  const [newClientEmail, setNewClientEmail] = useState('');
  const [newClientAddress, setNewClientAddress] = useState({
    street: '',
    town: '',
    province: '',
    country: 'South Africa'
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [projectData, setProjectData] = useState({
    name: '',
    description: '',
    system_type: 'grid',
    panel_kw: '0',
    inverter_kva: '0',
    battery_kwh: '0',
    location: '',
    latitude: '',
    longitude: '',
    project_value_excl_vat: '0',
    site_contact_person: '',
    site_phone: '0',
    design_type: 'Detailed',
    project_type: 'Commercial',
    tariff_id: null,
    custom_flat_rate: null
  });

  const navigate = useNavigate();

  useEffect(() => {
    loadClients();
  }, []);

  const loadClients = () => {
    axios.get(`${API_URL}/api/clients`)
      .then((res) => setClients(res.data))
      .catch((err) => {
        console.error('Error loading clients:', err);
        setError('Failed to load clients.');
      });
  };

  const handleInputChange = (e) => {
    setProjectData({
      ...projectData,
      [e.target.name]: e.target.value
    });
  };

  const handleTariffUpdate = (tariffData) => {
    setProjectData(prevData => ({
      ...prevData,
      tariff_id: tariffData.tariff_id,
      custom_flat_rate: tariffData.custom_flat_rate
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Validation
    if (!selectedClientId) {
      setError('Please select a client.');
      setLoading(false);
      return;
    }

    if (!projectData.name.trim()) {
      setError('Please enter a project name.');
      setLoading(false);
      return;
    }

    // if (!projectData.design_type) {
    //   setError('Please select a design type.');
    //   setLoading(false);
    //   return;
    // }

    if (!projectData.system_type) {
      setError('Please select a system type.');
      setLoading(false);
      return;
    }

    if (!projectData.project_type) {
      setError('Please select a project type.');
      setLoading(false);
      return;
    }

    let clientId = selectedClientId;

    if (clientId === 'new') {
      // Create new client first
      if (!newClientName || !newClientEmail) {
        setError('Please enter new client name and email.');
        setLoading(false);
        return;
      }
      try {
        const res = await axios.post(`${API_URL}/api/clients`, {
          client_name: newClientName,
          email: newClientEmail,
          phone: newClientPhone,
          address: newClientAddress
        });
        // Reload clients and set the new one
        clientId = res.data.client_id;
        setSelectedClientId(clientId); 

        if (!projectData.location && newClientAddress.town && newClientAddress.province) {
          setProjectData(prev => ({
            ...prev,
            location: `${newClientAddress.street ?  newClientAddress.street + ', ' : ''}${newClientAddress.town}, ${newClientAddress.province}`
          }));
        }

      } catch (err) {
        console.error('Error creating client:', err);
        setError('Failed to create new client: ' + (err.response?.data?.error || err.message));
        setLoading(false);
        return;
      }
    }

    try {
      await axios.post(`${API_URL}/api/projects`, {
        ...projectData,
        latitude: parseFloat(projectData.latitude) || -25.9895,
        longitude: parseFloat(projectData.longitude) || 28.1284,
        client_id: clientId
      });
      setShowToast(true);
      setTimeout(() => {
        setShowToast(false);
        navigate('/projects');
      }, 2000);
      
    } catch (err) {
      console.error('Error adding project:', err);
      setError('Failed to add project: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className='min-vh-100' style={{ backgroundColor: '#f8f9fa' }}>
      <Container fluid className="py-4 py-md-5">
        <Row className="justify-content-center">
          <Col lg={10} xl={8}>
            <Card className="shadow-lg border-0 rounded-xl p-4 p-md-5">
              <div className="text-center mb-5">
                <div className="bg-primary bg-opacity-10 rounded-circle p-3 d-inline-flex mb-3">
                  <i className="bi bi-plus-circle-fill text-primary" style={{fontSize: '2rem'}}></i>
                </div>
                <h2 className="text-3xl font-bold text-gray-800 mb-1">Create New Project</h2>
                <p className="text-muted">Set up a new solar project for your client</p>
              </div>

              {error && <Alert variant="danger" className="mb-4">{error}</Alert>}

              {/* Design Type Selection */}
              {/* <div className="mb-5">
                <h5 className="fw-semibold mb-3">
                  <i className="bi bi-gear-fill me-2"></i>Design Type
                </h5>
                <div className="d-flex gap-3">
                  <Button
                    variant={projectData.design_type === 'Quick' ? 'primary' : 'outline-primary'}
                    size="lg"
                    onClick={() => setProjectData({ ...projectData, design_type: 'Quick'})}
                    className="flex-fill rounded-lg shadow-sm"
                  >
                    <i className="bi bi-lightning-fill me-2"></i>Quick Design
                  </Button>
                  <Button
                    variant={projectData.design_type === 'Detailed' ? 'primary' : 'outline-primary'}
                    size="lg"
                    onClick={() => setProjectData({ ...projectData, design_type: 'Detailed'})}
                    className="flex-fill rounded-lg shadow-sm"
                  >
                    <i className="bi bi-tools me-2"></i>Detailed Design
                  </Button>
                </div>
              </div> */}

              <Form onSubmit={handleSubmit}>
                {/* Client Selection Section */}
                <Card className="border-light mb-4">
                  <Card.Header className="bg-light border-0">
                    <h5 className="mb-0 fw-semibold">
                      <i className="bi bi-person-fill me-2"></i>Client Information
                    </h5>
                  </Card.Header>
                  <Card.Body className="p-4">
                    <Row>
                      <Col md={selectedClientId === 'new' ? 12 : 12}>
                        <Form.Group className="mb-3">
                          <Form.Label className="fw-semibold">Select Client</Form.Label>
                          <Form.Select 
                            value={selectedClientId} 
                            onChange={(e) => setSelectedClientId(e.target.value)} 
                            required
                            size="lg"
                            className="rounded-md"
                          >
                            <option value="">-- Choose Client --</option>
                            {clients.map(client => (
                              <option key={client.id} value={client.id}>
                                {client.client_name} ({client.email})
                              </option>
                            ))}
                            <option value="new">+ Add New Client</option>
                          </Form.Select>
                        </Form.Group>
                      </Col>

                      {selectedClientId === 'new' && (
                        <>
                          <Col md={12}>
                            <Form.Group className="mb-3">
                              <Form.Label className="fw-semibold">Client Name</Form.Label>
                              <Form.Control 
                                type="text" 
                                value={newClientName} 
                                onChange={(e) => setNewClientName(e.target.value)} 
                                required 
                                size="lg"
                                className="rounded-md"
                                placeholder="Enter client full name"
                              />
                            </Form.Group>
                          </Col>
                          <Col md={6}>
                            <Form.Group className="mb-3">
                              <Form.Label className="fw-semibold">Client Phone</Form.Label>
                              <Form.Control
                                type="text"
                                value={newClientPhone}
                                onChange={e => setNewClientPhone(e.target.value)}
                                size="md"
                                className="rounded-md"
                                placeholder="Enter client phone number"
                                />
                            </Form.Group>
                          </Col>
                          <Col md={6}>
                            <Form.Group className="mb-3">
                              <Form.Label className="fw-semibold">Client Email</Form.Label>
                              <Form.Control 
                                type="email" 
                                value={newClientEmail} 
                                onChange={(e) => setNewClientEmail(e.target.value)} 
                                required 
                                size="md"
                                className="rounded-md"
                                placeholder="client@email.com"
                              />
                            </Form.Group>
                          </Col>
                          <Col md={3}>
                            <Form.Group className="mb-3">
                              <Form.Label className="fw-semibold">Client Street</Form.Label>
                              <Form.Control
                                type="text"
                                value={newClientAddress.street}
                                onChange={e => setNewClientAddress({ ...newClientAddress, street: e.target.value })}
                                size="md"
                                className="rounded-md"
                                placeholder="11 Van Riebeeck Street"
                                />
                            </Form.Group>
                          </Col>
                          <Col md={3}>
                            <Form.Group className="mb-3">
                              <Form.Label className="fw-semibold">Client Town</Form.Label>
                              <Form.Control
                                type="text"
                                value={newClientAddress.town}
                                onChange={e => setNewClientAddress({ ...newClientAddress, town: e.target.value })}
                                size="md"
                                className="rounded-md"
                                placeholder="Potchefstroom"
                                />
                            </Form.Group>
                          </Col>
                          <Col md={3}>
                            <Form.Group className="mb-3">
                              <Form.Label className="fw-semibold">Client Province</Form.Label>
                              <Form.Select
                                value={newClientAddress.province}
                                onChange={e => setNewClientAddress({ ...newClientAddress, province: e.target.value })}
                                size="md"
                                className="rounded-md"
                              >
                                <option value="">Select Province</option>
                                <option value="Gauteng">Gauteng</option>
                                <option value="North West">North West</option>
                                <option value="Northern Cape">Northern Cape</option>
                                <option value="Western Cape">Western Cape</option>
                                <option value="Eastern Cape">Eastern Cape</option>
                                <option value="Free State">Free State</option>
                                <option value="KwaZulu-Natal">KwaZulu-Natal</option>
                                <option value="Mpumalanga">Mpumalanga</option>
                                <option value="Limpopo">Limpopo</option>
                              </Form.Select>
                            </Form.Group>
                          </Col>
                          <Col md={3}>
                            <Form.Group className="mb-3">
                              <Form.Label className="fw-semibold">Client Country</Form.Label>
                              <Form.Control
                                type="text"
                                value={newClientAddress.country}
                                onChange={e => setNewClientAddress({ ...newClientAddress, country: e.target.value })}
                                size="md"
                                className="rounded-md"
                                placeholder="South Africa"
                                />
                            </Form.Group>
                          </Col>                                                
                        </>
                      )}
                    </Row>
                  </Card.Body>
                </Card>

                {/* Project Details Section */}
                <Card className="border-light mb-4">
                  <Card.Header className="bg-light border-0">
                    <h5 className="mb-0 fw-semibold">
                      <i className="bi bi-clipboard-data me-2"></i>Project Details
                    </h5>
                  </Card.Header>
                  <Card.Body className="p-4">
                    <Row>
                      <Col md={12}>
                        <Form.Group className="mb-3">
                          <Form.Label className="fw-semibold">Project Name</Form.Label>
                          <Form.Control 
                            type="text" 
                            name="name" 
                            value={projectData.name} 
                            onChange={handleInputChange} 
                            required 
                            size="lg"
                            className="rounded-lg"
                            placeholder="Enter project name"
                          />
                        </Form.Group>
                      </Col>

                      {/* MODIFIED: Put Location and Coordinates in one row */}
                      <Col md={4}>
                        <Form.Group className="mb-3">
                          <Form.Label className="fw-semibold">Location</Form.Label>
                          <Form.Control 
                            type="text" 
                            name="location" 
                            value={projectData.location}
                            onChange={handleInputChange} 
                            size="lg"
                            className="rounded-lg"
                            placeholder="e.g., City, Province"
                          />
                        </Form.Group>
                      </Col>
                          
                      {/* NEW: Latitude input */}
                      <Col md={4}>
                          <Form.Group className="mb-3">
                          <Form.Label className="fw-semibold">Latitude</Form.Label>
                          <Form.Control
                              type="number"
                              name="latitude"
                              value={projectData.latitude}
                              onChange={handleInputChange}
                              step="any"
                              size="lg"
                              className="rounded-lg"
                              placeholder="-25.9895"
                          />
                          </Form.Group>
                      </Col>
                          
                      {/* NEW: Longitude input */}
                      <Col md={4}>
                          <Form.Group className="mb-3">
                          <Form.Label className="fw-semibold">Longitude</Form.Label>
                          <Form.Control
                              type="number"
                              name="longitude"
                              value={projectData.longitude}
                              onChange={handleInputChange}
                              step="any"
                              size="lg"
                              className="rounded-lg"
                              placeholder="28.1284"
                          />
                          </Form.Group>
                      </Col>

                      <Col md={12}>
                        <Form.Group className="mb-3">
                          <Form.Label className="fw-semibold">Description</Form.Label>
                          <Form.Control 
                            as="textarea"
                            rows={2}
                            name="description" 
                            value={projectData.description} 
                            onChange={handleInputChange} 
                            className="rounded-lg"
                            placeholder="Brief project description"
                          />
                        </Form.Group>
                      </Col>

                      <Col md={4}>
                        <Form.Group className="mb-3">
                          <Form.Label className="fw-semibold">System Type</Form.Label>
                          <Form.Select 
                            name="system_type" 
                            value={projectData.system_type} 
                            onChange={handleInputChange} 
                            required
                            size="lg"
                            className="rounded-lg"
                          >
                            <option value="">-- Choose Type --</option>
                            <option value="grid">Grid-Tied</option>
                            <option value="hybrid">Hybrid</option>
                            <option value="off-grid">Off-Grid</option>
                          </Form.Select>
                        </Form.Group>
                      </Col>

                      <Col md={4}>
                        <Form.Group className="mb-3">
                          <Form.Label className="fw-semibold">Project Type</Form.Label>
                          <Form.Select 
                            name="project_type" 
                            value={projectData.project_type} 
                            onChange={handleInputChange} 
                            required
                            size="lg"
                            className="rounded-lg"
                          >
                            <option value="">-- Choose Type --</option>
                            <option value="Residential">Residential</option>
                            <option value="Commercial">Commercial</option>
                          </Form.Select>
                        </Form.Group>
                      </Col>
                    </Row>

                    {/* Tariff Selector */}
                    <hr className="my-4"/>
                    <Form.Group>
                      <Form.Label as='h5' className="fw-semibold mb-3">
                        <i className="bi bi-receipt-cutoff me-2"></i>Tariff Configuration
                      </Form.Label>
                      <TariffSelector onChange={handleTariffUpdate} />
                    </Form.Group>
                  </Card.Body>
                </Card>

                {/* Submit Buttons */}
                <div className="d-flex gap-3 mt-5">
                  <Button 
                    type="submit" 
                    variant="primary" 
                    size="lg" 
                    disabled={loading}
                    className="flex-fill rounded-lg"
                  >
                    {loading ? (
                      <>
                        <Spinner as="span" animation="border" size="sm" className="me-2" />
                        Creating Project...
                      </>
                    ) : (
                      <>
                        <i className="bi bi-check-lg me-2"></i>
                        Create Project
                      </>
                    )}
                  </Button>
                  <Button 
                    variant="outline-secondary" 
                    size="lg" 
                    onClick={() => navigate('/projects')}
                    className="flex-fill rounded-lg"
                  >
                    <i className="bi bi-arrow-left me-2"></i>
                    Cancel
                  </Button>
                </div>
              </Form>
            </Card>
          </Col>
        </Row>
      </Container>

      {showToast && (
        <div className="toast-container position-fixed bottom-0 end-0 p-3">
          <div className="toast show text-bg-success rounded-lg shadow-lg">
            <div className="toast-body d-flex align-items-center">
              <i className="bi bi-check-circle-fill me-2"></i>
              Project created successfully!
            </div>
          </div>
        </div>
      )}   
    </div>
  );
}


export default AddProject;
