import React, { useState, useEffect } from "react";
import { useAuth } from './AuthContext';
import { Link } from "react-router-dom";
import axios from "axios";
import { Container, Row, Col, Card, Button, Spinner, Alert, Badge, Stack } from 'react-bootstrap';
import { API_URL } from "./apiConfig";

function Clients() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadClients();
  }, []);

  const loadClients = () => {
    setLoading(true);
    axios.get(`${API_URL}/api/clients`)
      .then((response) => {
        setClients(response.data);
        setError('');
      })
      .catch((error) => {
        console.error("Error fetching clients:", error);
        setError("Failed to fetch clients: " + error.message);
      })
      .finally(() => setLoading(false));
  };
  const handleDelete = (id) => {
    if (!isAdmin) {
      setError('Access Denied: Only administrators can delete clients.');
      return;
    }
    if (window.confirm("Are you sure you want to delete this client? This action cannot be undone.")) {
      axios.delete(`${API_URL}/api/clients/${id}`, { headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` } })
        .then(() => {
          loadClients();
          setError('');
        })
        .catch((error) => {
          console.error("Error deleting client:", error);
          const errorResponse = error.response?.data;
          setError(errorResponse?.message || 'Failed to delete client');
        });
    }
  };

  if (loading) return <div className="d-flex justify-content-center mt-5"><Spinner animation="border" /></div>;

  return (
    <div className='min-vh-100' style={{ backgroundColor: '#f8f9fa' }}>
      <Container fluid className="py-4 py-md-5">
        <Row className="justify-content-center">
          <Col lg={10} xl={8}>
            <Card className="shadow-lg border-0 rounded-xl p-4 p-md-5">
              <div className="d-flex justify-content-between align-items-center mb-4">
                <div>
                  <h2 className="text-3xl font-bold text-gray-800 mb-1">
                    <i className="bi bi-people-fill me-3"></i>Clients
                  </h2>
                  <p className="text-muted mb-0">Manage your client database</p>
                </div>
                <Link to="/clients/add" className="btn btn-primary shadow-sm">
                  <i className="bi bi-plus-lg me-2"></i>Add Client
                </Link>
              </div>

              {error && <Alert variant="danger" className="mb-4">{error}</Alert>}

              {clients.length === 0 ? (
                <div className="text-center py-5">
                  <i className="bi bi-people" style={{fontSize: '4rem', color: '#9ca3af'}}></i>
                  <h4 className="mt-3 text-gray-700">No Clients Found</h4>
                  <p className="text-muted mb-4">Start building your client database by adding your first client.</p>
                  <Link to="/clients/add" className="btn btn-primary">
                    <i className="bi bi-plus-lg me-2"></i>Add Your First Client
                  </Link>
                </div>
              ) : (
                <Row xs={1} md={2} lg={3} className="g-4">
                  {clients.map((client) => (
                    <Col key={client.id}>
                      <Card className="h-100 shadow-sm border-light hover-shadow">
                        <Card.Body className="p-4">
                          <div className="d-flex align-items-center mb-3">
                            <div className="bg-primary bg-opacity-10 rounded-circle p-2 me-3">
                              <i className="bi bi-person-fill text-primary"></i>
                            </div>
                            <div className="flex-grow-1">
                              <Card.Title className="mb-0 h5">{client.client_name}</Card.Title>
                              <Badge bg="light" text="dark" className="mt-1">Client</Badge>
                            </div>
                          </div>

                          <div className="mb-3">
                            <div className="d-flex align-items-center mb-2">
                              <i className="bi bi-envelope me-2 text-muted"></i>
                              <small className="text-muted">{client.email}</small>
                            </div>
                            <div className="d-flex align-items-center">
                              <i className="bi bi-telephone me-2 text-muted"></i>
                              <small className="text-muted">{client.phone}</small>
                            </div>
                          </div>

                          <Stack direction="horizontal" gap={2} className="mt-auto">
                            <Link 
                              to={`/clients/edit/${client.id}`} 
                              className="btn btn-outline-primary btn-sm flex-fill"
                            >
                              <i className="bi bi-pencil-fill me-1"></i>Edit
                            </Link>
                            <Button
                              variant="outline-danger"
                              size="sm"
                              className="flex-fill"
                              disabled={!isAdmin}
                              title={!isAdmin ? 'Admin only' : 'Delete client'}
                              onClick={() => handleDelete(client.id)}
                            >
                              <i className="bi bi-trash-fill me-1"></i>Delete
                            </Button>
                          </Stack>
                        </Card.Body>
                      </Card>
                    </Col>
                  ))}
                </Row>
              )}
            </Card>
          </Col>
        </Row>
      </Container>
    </div>
  );
}

export default Clients;
