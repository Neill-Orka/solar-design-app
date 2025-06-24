import React, { useState } from 'react';
import axios from 'axios';
import { Container, Row, Col, Card, Button, Form, Spinner, Alert } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { API_URL } from './apiConfig';

function ClientForm() {
  const [clientName, setClientName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  const navigate = useNavigate();

  const handleSubmit = (e) => {
    e.preventDefault();
    setIsSaving(true);
    setError('');
    setSuccess('');

    const payload = {
      client_name: clientName,
      email: email,
      phone: phone
    };

    axios.post(`${API_URL}/api/clients`, payload)
      .then((response) => {
        console.log('Client added:', response.data);
        setSuccess('Client added successfully!');
        setClientName('');
        setEmail('');
        setPhone('');
        // Navigate back after a short delay
        setTimeout(() => navigate('/clients'), 1500);
      })
      .catch((error) => {
        console.error('Error adding client:', error.response ? error.response.data : error.message);
        setError('Failed to add client: ' + (error.response?.data?.error || error.message));
      })
      .finally(() => setIsSaving(false));
  };

  return (
    <div className='min-vh-100' style={{ backgroundColor: '#f8f9fa' }}>
      <Container fluid className="py-4 py-md-5">
        <Row className="justify-content-center">
          <Col lg={8} xl={6}>
            <Card className="shadow-lg border-0 rounded-xl p-4 p-md-5">
              <div className="text-center mb-4">
                <div className="bg-primary bg-opacity-10 rounded-circle p-3 d-inline-flex mb-3">
                  <i className="bi bi-person-plus-fill text-primary" style={{fontSize: '2rem'}}></i>
                </div>
                <h2 className="text-3xl font-bold text-gray-800 mb-1">Add New Client</h2>
                <p className="text-muted">Create a new client profile for your projects</p>
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

                <div className="d-grid gap-2 mt-4">
                  <Button 
                    type="submit" 
                    variant="primary" 
                    size="lg" 
                    disabled={isSaving}
                    className="rounded-lg"
                  >
                    {isSaving ? (
                      <>
                        <Spinner as="span" animation="border" size="sm" className="me-2" />
                        Adding Client...
                      </>
                    ) : (
                      <>
                        <i className="bi bi-plus-lg me-2"></i>
                        Add Client
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

export default ClientForm;
