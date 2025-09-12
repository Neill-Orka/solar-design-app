import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { Container, Row, Col, Card, Button, Form, Spinner, Alert } from 'react-bootstrap';
import { API_URL } from './apiConfig'; 

function EditClient() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [clientName, setClientName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState({
    street: '',
    town: '',
    province: '',
    country: 'South Africa'
  });
  const [company, setCompany] = useState('');
  const [vatNumber, setVatNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    axios.get(`${API_URL}/api/clients/${id}`)
      .then((response) => {
        setClientName(response.data.client_name);
        setEmail(response.data.email);
        setPhone(response.data.phone);
        setAddress(response.data.address);
        setCompany(response.data.company || '');
        setVatNumber(response.data.vat_number || '');
      })
      .catch((error) => {
        console.error('Error loading client:', error);
        setError('Failed to load client information.');
      });
  }, [id]);

  const handleSubmit = (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    const payload = {
      client_name: clientName,
      email: email,
      phone: phone,
      address: address,
      company: company,
      vat_number: vatNumber
    };

    axios.put(`${API_URL}/api/clients/${id}`, payload)
      .then(() => {
        setSuccess('Client updated successfully!');
        setTimeout(() => navigate('/clients'), 1500);
      })
      .catch((error) => {
        console.error('Error updating client:', error);
        setError('Failed to update client: ' + (error.response?.data?.error || error.message));
      })
      .finally(() => setLoading(false));
  };

  return (
    <div className='min-vh-100' style={{ backgroundColor: '#f8f9fa' }}>
      <Container fluid className="py-4 py-md-5">
        <Row className="justify-content-center">
          <Col lg={8} xl={6}>
            <Card className="shadow-lg border-0 rounded-xl p-4 p-md-5">
              <div className="text-center mb-4">
                <div className="bg-primary bg-opacity-10 rounded-circle p-3 d-inline-flex mb-3">
                  <i className="bi bi-person-gear text-primary" style={{fontSize: '2rem'}}></i>
                </div>
                <h2 className="text-3xl font-bold text-gray-800 mb-1">Edit Client</h2>
                <p className="text-muted">Update client information</p>
              </div>

              {error && <Alert variant="danger" className="mb-4">{error}</Alert>}
              {success && <Alert variant="success" className="mb-4">{success}</Alert>}

              <Form onSubmit={handleSubmit}>
                <Row>
                  <Col md={12}>
                    <Form.Group className="mb-4">
                      <Form.Label className="fw-semibold">
                        <i className="bi bi-person me-2"></i>Client Name
                      </Form.Label>
                      <Form.Control
                        type="text"
                        value={clientName}
                        onChange={(e) => setClientName(e.target.value)}
                        placeholder="Enter full client name"
                        size="lg"
                        required
                        className="rounded-lg"
                      />
                    </Form.Group>
                  </Col>
                </Row>

                <Row>
                  <Col md={6}>
                    <Form.Group className="mb-4">
                      <Form.Label className="fw-semibold">
                        <i className="bi bi-envelope me-2"></i>Email Address
                      </Form.Label>
                      <Form.Control
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="client@email.com"
                        size="lg"
                        required
                        className="rounded-lg"
                      />
                    </Form.Group>
                  </Col>

                  <Col md={6}>
                    <Form.Group className="mb-4">
                      <Form.Label className="fw-semibold">
                        <i className="bi bi-telephone me-2"></i>Phone Number
                      </Form.Label>
                      <Form.Control
                        type="text"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="+27 12 345 6789"
                        size="lg"
                        required
                        className="rounded-lg"
                      />
                    </Form.Group>
                  </Col>
                </Row>
                <Row>
                  <Col md={4}>
                    <Form.Group className="mb-4">
                      <Form.Label className="fw-semibold">
                        <i className="bi bi-geo-alt me-2"></i>Street
                      </Form.Label>
                      <Form.Control
                        type="text"
                        value={address?.street}
                        onChange={(e) => setAddress({ ...address, street: e.target.value })}
                        placeholder="Enter street address"
                        size="md"
                        className="rounded-lg"
                      />
                    </Form.Group>
                  </Col>
                  <Col md={4}>
                    <Form.Group className="mb-4">
                      <Form.Label className="fw-semibold">
                        <i className="bi bi-geo-alt me-2"></i>Town
                      </Form.Label>
                      <Form.Control
                        type="text"
                        value={address?.town}
                        onChange={(e) => setAddress({ ...address, town: e.target.value })}
                        placeholder="Enter town"
                        size="md"
                        className="rounded-lg"
                      />
                    </Form.Group>
                  </Col>
                  <Col md={4}>
                    <Form.Group className="mb-4">
                      <Form.Label className="fw-semibold">
                        <i className="bi bi-geo-alt me-2"></i>Province
                      </Form.Label>
                      <Form.Select
                        value={address?.province}
                        onChange={e => setAddress({ ...address, province: e.target.value })}
                        size="md"
                        className="rounded-lg"
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
                </Row>
                <Row>
                  <Col md={6}>
                    <Form.Group className="mb-4">
                      <Form.Label className="fw-semibold">
                        <i className="bi bi-building me-2"></i>Company
                      </Form.Label>
                      <Form.Control
                        type="text"
                        value={company}
                        onChange={(e) => setCompany(e.target.value)}
                        placeholder="Enter company name"
                        size="md"
                        className="rounded-lg"
                      />
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group className="mb-4">
                      <Form.Label className="fw-semibold">
                        <i className="bi bi-file-earmark-text me-2"></i>VAT Number
                      </Form.Label>
                      <Form.Control
                        type="text"
                        value={vatNumber}
                        onChange={(e) => setVatNumber(e.target.value)}
                        placeholder="Enter VAT number"
                        size="md"
                        className="rounded-lg"
                      />
                    </Form.Group>
                  </Col>
                </Row>

                <div className="d-grid gap-2 mt-4">
                  <Button 
                    type="submit" 
                    variant="primary" 
                    size="lg" 
                    disabled={loading}
                    className="rounded-lg"
                  >
                    {loading ? (
                      <>
                        <Spinner as="span" animation="border" size="sm" className="me-2" />
                        Updating Client...
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
                    onClick={() => navigate('/clients')}
                    className="rounded-lg"
                  >
                    <i className="bi bi-arrow-left me-2"></i>
                    Back to Clients
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

export default EditClient;
