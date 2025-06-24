import React, { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { Container, Row, Col, Card, Button, Form, Spinner, Alert } from 'react-bootstrap';
import { API_URL } from "./apiConfig";

function AddProject() {
  const [showToast, setShowToast] = useState(false);
  const [clients, setClients] = useState([]);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [newClientName, setNewClientName] = useState('');
  const [newClientEmail, setNewClientEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [projectData, setProjectData] = useState({
    name: '',
    description: '',
    system_type: '',
    panel_kw: '0',
    inverter_kva: '0',
    battery_kwh: '0',
    location: '',
    project_value_excl_vat: '0',
    site_contact_person: '',
    site_phone: '0',
    design_type: '',
    project_type: ''
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

    if (!projectData.design_type) {
      setError('Please select a design type.');
      setLoading(false);
      return;
    }

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
          phone: '' // Optional: user can edit phone later
        });
        // Reload clients and set the new one
        clientId = res.data.client_id;
        setSelectedClientId(clientId); 
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
              <div className="mb-5">
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
              </div>

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
                            className="rounded-lg"
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
                          <Col md={6}>
                            <Form.Group className="mb-3">
                              <Form.Label className="fw-semibold">New Client Name</Form.Label>
                              <Form.Control 
                                type="text" 
                                value={newClientName} 
                                onChange={(e) => setNewClientName(e.target.value)} 
                                required 
                                size="lg"
                                className="rounded-lg"
                                placeholder="Enter client full name"
                              />
                            </Form.Group>
                          </Col>
                          <Col md={6}>
                            <Form.Group className="mb-3">
                              <Form.Label className="fw-semibold">New Client Email</Form.Label>
                              <Form.Control 
                                type="email" 
                                value={newClientEmail} 
                                onChange={(e) => setNewClientEmail(e.target.value)} 
                                required 
                                size="lg"
                                className="rounded-lg"
                                placeholder="client@email.com"
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
                      <Col md={6}>
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

                      <Col md={6}>
                        <Form.Group className="mb-3">
                          <Form.Label className="fw-semibold">Location</Form.Label>
                          <Form.Control 
                            type="text" 
                            name="location" 
                            value={projectData.location} 
                            onChange={handleInputChange} 
                            size="lg"
                            className="rounded-lg"
                            placeholder="City, Province"
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
                  </Card.Body>
                </Card>

                {/* Detailed Design Section */}
                {projectData.design_type === 'Detailed' && (
                  <Card className="border-light mb-4">
                    <Card.Header className="bg-light border-0">
                      <h5 className="mb-0 fw-semibold">
                        <i className="bi bi-tools me-2"></i>System Configuration
                      </h5>
                    </Card.Header>
                    <Card.Body className="p-4">
                      <Row>
                        <Col md={4}>
                          <Form.Group className="mb-3">
                            <Form.Label className="fw-semibold">Panel Size (kWp)</Form.Label>
                            <Form.Control 
                              type="number" 
                              name="panel_kw" 
                              value={projectData.panel_kw} 
                              onChange={handleInputChange} 
                              step="0.1" 
                              size="lg"
                              className="rounded-lg"
                            />
                          </Form.Group>
                        </Col>
                        
                        <Col md={4}>
                          <Form.Group className="mb-3">
                            <Form.Label className="fw-semibold">Inverter Size (kVA)</Form.Label>
                            <Form.Control 
                              type="number" 
                              name="inverter_kva" 
                              value={projectData.inverter_kva} 
                              onChange={handleInputChange} 
                              step="0.1" 
                              size="lg"
                              className="rounded-lg"
                            />
                          </Form.Group>
                        </Col>
                        
                        {projectData.system_type !== 'grid' && (
                          <Col md={4}>
                            <Form.Group className="mb-3">
                              <Form.Label className="fw-semibold">Battery Size (kWh)</Form.Label>
                              <Form.Control 
                                type="number" 
                                name="battery_kwh" 
                                value={projectData.battery_kwh} 
                                onChange={handleInputChange} 
                                step="0.1" 
                                size="lg"
                                className="rounded-lg"
                              />
                            </Form.Group>
                          </Col>
                        )}     
                        
                        <Col md={4}>
                          <Form.Group className="mb-3">
                            <Form.Label className="fw-semibold">Project Value (excl. VAT)</Form.Label>
                            <Form.Control 
                              type="number" 
                              name="project_value_excl_vat" 
                              value={projectData.project_value_excl_vat} 
                              onChange={handleInputChange} 
                              step="0.01" 
                              size="lg"
                              className="rounded-lg"
                            />
                          </Form.Group>
                        </Col>

                        <Col md={4}>
                          <Form.Group className="mb-3">
                            <Form.Label className="fw-semibold">Site Contact Person</Form.Label>
                            <Form.Control 
                              type="text" 
                              name="site_contact_person" 
                              value={projectData.site_contact_person} 
                              onChange={handleInputChange} 
                              size="lg"
                              className="rounded-lg"
                            />
                          </Form.Group>
                        </Col>

                        <Col md={4}>
                          <Form.Group className="mb-3">
                            <Form.Label className="fw-semibold">Site Phone</Form.Label>
                            <Form.Control 
                              type="text" 
                              name="site_phone" 
                              value={projectData.site_phone} 
                              onChange={handleInputChange} 
                              size="lg"
                              className="rounded-lg"
                            />
                          </Form.Group>
                        </Col>                 
                      </Row>
                    </Card.Body>
                  </Card>
                )}

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
