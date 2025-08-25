import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { Container, Row, Col, Card, Button, Form, Spinner, Table, Alert, Badge } from 'react-bootstrap';
import { API_URL } from "./apiConfig";
import TariffSelector from "./TariffSelector";

function EditProject() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    axios.get(`${API_URL}/api/projects/${id}`)
      .then((res) => {
        setProject(res.data);
        setError('');
      })
      .catch((err) => {
        console.error('Error loading project:', err);
        setError('Failed to load project: ' + (err.response?.data?.error || err.message));
      })
      .finally(() => setLoading(false));
  }, [id]);

  const handleChange = (e) => {
    setProject({
      ...project,
      [e.target.name]: e.target.value
    });
  };

  const handleTariffUpdate = (tariffData) => {
    setProject(prevProject => ({
      ...prevProject,
      tariff_id: tariffData.tariff_id,
      custom_flat_rate: tariffData.custom_flat_rate
    }));
  }

  const handleSubmit = (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    axios.put(`${API_URL}/api/projects/${id}`, project)
      .then(() => {
        setSuccess('Project updated successfully!');
        setTimeout(() => navigate('/projects'), 1500);
      })
      .catch((err) => {
        console.error('Error updating project:', err);
        setError('Failed to update project: ' + (err.response?.data?.error || err.message));
      })
      .finally(() => setSaving(false));
  };

  if (loading) {
    return (
      <div className='min-vh-100 d-flex align-items-center justify-content-center' style={{ backgroundColor: '#f8f9fa' }}>
        <Spinner animation="border" className="text-primary" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className='min-vh-100 d-flex align-items-center justify-content-center' style={{ backgroundColor: '#f8f9fa' }}>
        <Alert variant="danger">Project not found</Alert>
      </div>
    );
  }

  return (
    <div className='min-vh-100' style={{ backgroundColor: '#f8f9fa' }}>
      <Container fluid className="py-4 py-md-5">
        <Row className="justify-content-center">
          <Col lg={10} xl={8}>
            <Card className="shadow-lg border-0 rounded-xl p-4 p-md-5">
              <div className="text-center mb-5">
                <div className="bg-primary bg-opacity-10 rounded-circle p-3 d-inline-flex mb-3">
                  <i className="bi bi-pencil-square text-primary" style={{fontSize: '2rem'}}></i>
                </div>
                <h2 className="text-3xl font-bold text-gray-800 mb-1">Edit Project</h2>
                <p className="text-muted">Update project details and configuration</p>
              </div>

              {error && <Alert variant="danger" className="mb-4">{error}</Alert>}
              {success && <Alert variant="success" className="mb-4">{success}</Alert>}

              <Form onSubmit={handleSubmit}>
                {/* Basic Project Information */}
                <Card className="border-light mb-4">
                  <Card.Header className="bg-light border-0">
                    <h5 className="mb-0 fw-semibold">
                      <i className="bi bi-clipboard-data me-2"></i>Project Information
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
                            value={project.name || ''} 
                            onChange={handleChange} 
                            required 
                            size="lg"
                            className="rounded-lg"
                          />
                        </Form.Group>
                      </Col>
                      
                      {/* MODIFIED: Put Location and Coordinates in one row */}
                      <Row>
                        <Col md={12}>
                          <Form.Group className="mb-3">
                          <Form.Label className="fw-semibold">Location</Form.Label>
                          <Form.Control 
                              type="text" 
                              name="location" 
                              value={project.location || ''} 
                              onChange={handleChange} 
                              size="lg"
                              className="rounded-lg"
                          />
                          </Form.Group>
                        </Col>
                      </Row>

                      {/* NEW: Latitude input */}
                      <Col md={6}>
                          <Form.Group className="mb-3">
                          <Form.Label className="fw-semibold">Latitude</Form.Label>
                          <Form.Control
                              type="number"
                              name="latitude"
                              value={project.latitude || ''}
                              onChange={handleChange}
                              step="any"
                              size="lg"
                              className="rounded-lg"
                          />
                          </Form.Group>
                      </Col>

                      {/* NEW: Longitude input */}
                      <Col md={6}>
                          <Form.Group className="mb-3">
                          <Form.Label className="fw-semibold">Longitude</Form.Label>
                          <Form.Control
                              type="number"
                              name="longitude"
                              value={project.longitude || ''}
                              onChange={handleChange}
                              step="any"
                              size="lg"
                              className="rounded-lg"
                          />
                          </Form.Group>
                      </Col>
                      <Col md={6}>
                        <Form.Group className="mb-3">
                          <Form.Label className="fw-semibold">Design Type</Form.Label>
                          <Form.Select 
                            name="design_type" 
                            value={project.design_type || ''} 
                            onChange={handleChange}
                            size="lg"
                            className="rounded-lg"
                          >
                            <option value="">-- Choose Type --</option>
                            <option value="Quick">Quick Design</option>
                            <option value="Detailed">Detailed Design</option>
                          </Form.Select>
                        </Form.Group>
                      </Col>
                      <Col md={6}>
                        <Form.Group className="mb-3">
                          <Form.Label className="fw-semibold">Project Type</Form.Label>
                          <Form.Select 
                            name="project_type" 
                            value={project.project_type || ''} 
                            onChange={handleChange}
                            size="lg"
                            className="rounded-lg"
                          >
                            <option value="">-- Choose Type --</option>
                            <option value="Residential">Residential</option>
                            <option value="Commercial">Commercial</option>
                          </Form.Select>
                        </Form.Group>
                      </Col>
                      <Col md={12}>
                        <Form.Group className="mb-3">
                          <Form.Label className="fw-semibold">Description</Form.Label>
                          <Form.Control 
                            as="textarea"
                            rows={2}
                            name="description" 
                            value={project.description || ''} 
                            onChange={handleChange} 
                            className="rounded-lg"
                          />
                        </Form.Group>
                      </Col>
                    </Row>
                    <hr />
                    <Form.Group>
                      <Form.Label className="fw-semibold">Current Tariff</Form.Label>
                      <Card bg='light' text='dark' className="p-3 border">
                          {project.tariff_details ? (
                              // --- UPDATED: Richer summary view ---
                              <div>
                                  <h5 className="mb-1">{project.tariff_details.name} <span className="text-muted">({project.tariff_details.matrix_code})</span></h5>
                                  <div className="mb-2">
                                      <Badge pill bg="primary" className="me-1">{project.tariff_details.power_user_type}</Badge>
                                      <Badge pill bg="info" text="dark">{project.tariff_details.structure}</Badge>
                                  </div>
                                  <Table striped bordered size="sm" className="mb-0">
                                      <thead>
                                          <tr>
                                              <th>Charge Name</th>
                                              <th>Rate</th>
                                          </tr>
                                      </thead>
                                      <tbody>
                                          {project.tariff_details.rates.slice(0, 3).map((rate, index) => (
                                              <tr key={index}>
                                                  <td>{rate.charge_name}</td>
                                                  <td><strong>{rate.rate_value}</strong> {rate.rate_unit}</td>
                                              </tr>
                                          ))}
                                      </tbody>
                                  </Table>
                                  {project.tariff_details.rates.length > 3 && (
                                      <small className="text-muted">...and {project.tariff_details.rates.length - 3} more rates.</small>
                                  )}
                              </div>
                          ) : project.custom_flat_rate ? (
                              // Display custom flat rate (no change here)
                              <div>
                                  <h5 className="mb-1">Custom Flat Rate</h5>
                                  <Badge pill bg="success">{project.custom_flat_rate} c/kWh</Badge>
                              </div>
                          ) : (
                              // Display if no tariff is set (no change here)
                              <p className="mb-0 text-muted">No tariff selected for this project.</p> 
                          )}
                      </Card>
                    </Form.Group>
                  </Card.Body>
                </Card>

                {/* System Configuration */}
                {/* <Card className="border-light mb-4">
                  <Card.Header className="bg-light border-0">
                    <h5 className="mb-0 fw-semibold">
                      <i className="bi bi-tools me-2"></i>System Configuration
                    </h5>
                  </Card.Header>
                  <Card.Body className="p-4">
                    <Row>
                      <Col md={4}>
                        <Form.Group className="mb-3">
                          <Form.Label className="fw-semibold">System Type</Form.Label>
                          <Form.Select 
                            name="system_type" 
                            value={project.system_type || ''} 
                            onChange={handleChange}
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
                          <Form.Label className="fw-semibold">Panel Size (kWp)</Form.Label>
                          <Form.Control 
                            type="number" 
                            name="panel_kw" 
                            value={project.panel_kw || ''} 
                            onChange={handleChange} 
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
                            value={project.inverter_kva || ''} 
                            onChange={handleChange} 
                            step="0.1"
                            size="lg"
                            className="rounded-lg"
                          />
                        </Form.Group>
                      </Col>
                      {project.system_type !== 'grid' && (
                        <Col md={4}>
                          <Form.Group className="mb-3">
                            <Form.Label className="fw-semibold">Battery Size (kWh)</Form.Label>
                            <Form.Control 
                              type="number" 
                              name="battery_kwh" 
                              value={project.battery_kwh || ''} 
                              onChange={handleChange} 
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
                            value={project.project_value_excl_vat || ''} 
                            onChange={handleChange} 
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
                            value={project.site_contact_person || ''} 
                            onChange={handleChange} 
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
                            value={project.site_phone || ''} 
                            onChange={handleChange} 
                            size="lg"
                            className="rounded-lg"
                          />
                        </Form.Group>
                      </Col>
                    </Row>
                  </Card.Body>
                </Card> */}

                <Card className="border-light mb-4">
                  <Card.Header>
                    <h5 className="mb-0 fw-semibold">
                      <i className="bi bi-receipt-cutoff me-2"></i>Tariff Configuration
                    </h5>
                  </Card.Header>
                  <Card.Body className="p-4">
                    <TariffSelector 
                      onChange={handleTariffUpdate} 
                      currentTariffId={project.tariff_id}
                      currentCustomRate={project.custom_flat_rate}
                    />
                  </Card.Body>
                </Card>

                {/* Action Buttons */}
                <div className="d-flex gap-3 mt-4">
                  <Button 
                    type="submit" 
                    variant="primary" 
                    size="lg" 
                    disabled={saving}
                    className="flex-fill rounded-lg"
                  >
                    {saving ? (
                      <>
                        <Spinner as="span" animation="border" size="sm" className="me-2" />
                        Updating...
                      </>
                    ) : (
                      <>
                        <i className="bi bi-check-lg me-2"></i>
                        Save Changes
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
    </div>
  );
}

export default EditProject;
