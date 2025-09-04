import React, { useState, useEffect, useMemo } from "react";
import { useAuth } from './AuthContext';
import { Link } from "react-router-dom";
import axios from "axios";
import { Container, Row, Col, Card, Button, Spinner, Alert, Badge, Stack, Table, Form, InputGroup, ButtonGroup } from 'react-bootstrap';
import { API_URL } from "./apiConfig";
import { FaSave, FaUndo, FaPlus, FaTrash, FaEdit, FaSearch } from 'react-icons/fa';

// South African provinces for dropdown
const PROVINCES = [
  'Eastern Cape', 'Free State', 'Gauteng', 'KwaZulu-Natal', 'Limpopo',
  'Mpumalanga', 'Northern Cape', 'North West', 'Western Cape'
];

function Clients() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [viewMode, setViewMode] = useState('list'); // default to list view
  const [drafts, setDrafts] = useState({}); // id -> partial edits
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [addingInline, setAddingInline] = useState(false);
  const [newClient, setNewClient] = useState({ client_name: '', email: '', phone: '', street: '', town: '', province: '' });

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
  const filteredClients = useMemo(() => {
    if (!search.trim()) return clients;
    const q = search.toLowerCase();
    return clients.filter(c =>
      (c.client_name || '').toLowerCase().includes(q) ||
      (c.email || '').toLowerCase().includes(q) ||
      (c.phone || '').toLowerCase().includes(q) ||
      (c.address?.street || '').toLowerCase().includes(q) ||
      (c.address?.town || '').toLowerCase().includes(q) ||
      (c.address?.province || '').toLowerCase().includes(q)
    );
  }, [clients, search]);

  const startEdit = (id) => {
    if (!drafts[id]) setDrafts(d => ({ ...d, [id]: {} }));
  };

  const cancelEdit = (id) => {
    setDrafts(d => {
      const copy = { ...d };
      delete copy[id];
      return copy;
    });
  };

  const updateDraftField = (id, field, value) => {
    setDrafts(d => ({ ...d, [id]: { ...(d[id] || {}), [field]: value } }));
  };

  const saveRow = async (client) => {
    if (!drafts[client.id] || Object.keys(drafts[client.id]).length === 0) { cancelEdit(client.id); return; }
    setSaving(true);
    try {
      const payload = { ...drafts[client.id] };
      // Flatten address fields back into address object if edited
      if ('street' in payload || 'town' in payload || 'province' in payload) {
        payload.address = {
          street: payload.street !== undefined ? payload.street : (client.address?.street || ''),
          town: payload.town !== undefined ? payload.town : (client.address?.town || ''),
          province: payload.province !== undefined ? payload.province : (client.address?.province || ''),
        };
        delete payload.street; delete payload.town; delete payload.province;
      }
      await axios.patch(`${API_URL}/api/clients/${client.id}`, payload, { headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` } });
      await loadClients();
      cancelEdit(client.id);
    } catch (e) {
      console.error('Failed to save client', e);
      setError('Failed to save client: ' + (e.response?.data?.message || e.message));
    } finally {
      setSaving(false);
    }
  };

  const handleAddInline = async () => {
    if (!newClient.client_name || !newClient.email) {
      setError('Name and email required');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        client_name: newClient.client_name,
        email: newClient.email,
        phone: newClient.phone || '',
  address: { street: newClient.street || '', town: newClient.town || '', province: newClient.province || '' }
      };
      await axios.post(`${API_URL}/api/clients`, payload, { headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` } });
      await loadClients();
  setNewClient({ client_name: '', email: '', phone: '', street: '', town: '', province: '' });
      setAddingInline(false);
    } catch (e) {
      setError('Failed to add client: ' + (e.response?.data?.message || e.message));
    } finally {
      setSaving(false);
    }
  };

  const isEditing = (id) => !!drafts[id];
  const draftValue = (id, field, original) => (drafts[id] && drafts[id][field] !== undefined) ? drafts[id][field] : original;

  const renderListView = () => (
    <div className="mt-3">
      <div className="d-flex justify-content-between align-items-center mb-2">
        <div className="d-flex align-items-center gap-2">
          <InputGroup size="sm">
            <InputGroup.Text><FaSearch /></InputGroup.Text>
            <Form.Control placeholder="Search" value={search} onChange={e => setSearch(e.target.value)} />
          </InputGroup>
        </div>
        <div className="d-flex gap-2">
          {!addingInline && <Button size="sm" variant="success" onClick={()=>setAddingInline(true)}><FaPlus className='me-1'/>New</Button>}
          {addingInline && <Button size="sm" variant="outline-secondary" onClick={()=>{setAddingInline(false); setNewClient({ client_name:'', email:'', phone:'', street:'', town:'', province:''});}}>Cancel</Button>}
        </div>
      </div>
      <div className="table-responsive" style={{maxHeight:'70vh', overflow:'auto'}}>
        <Table striped bordered hover size="sm" className="align-middle">
          <thead className="table-light sticky-top" style={{top:0,zIndex:1}}>
            <tr>
              <th style={{width:28}}>#</th>
              <th>Name</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Street</th>
              <th>Town</th>
              <th>Province</th>
              <th style={{width:100}}>Actions</th>
            </tr>
            {addingInline && (
              <tr className="table-success">
                <td>+</td>
                <td><Form.Control size="sm" value={newClient.client_name} onChange={e=>setNewClient(c=>({...c, client_name:e.target.value}))} placeholder="Client name" /></td>
                <td><Form.Control size="sm" value={newClient.email} onChange={e=>setNewClient(c=>({...c, email:e.target.value}))} placeholder="Email" /></td>
                <td><Form.Control size="sm" value={newClient.phone} onChange={e=>setNewClient(c=>({...c, phone:e.target.value}))} placeholder="Phone" /></td>
                <td><Form.Control size="sm" value={newClient.street} onChange={e=>setNewClient(c=>({...c, street:e.target.value}))} placeholder="Street" /></td>
                <td><Form.Control size="sm" value={newClient.town} onChange={e=>setNewClient(c=>({...c, town:e.target.value}))} placeholder="Town" /></td>
                <td>
                  <Form.Select size="sm" value={newClient.province} onChange={e=>setNewClient(c=>({...c, province:e.target.value}))}>
                    <option value="">Province</option>
                    {PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
                  </Form.Select>
                </td>
                <td className="text-center">
                  <Button size="sm" variant="success" className="me-1" disabled={saving} onClick={handleAddInline}><FaSave /></Button>
                  <Button size="sm" variant="outline-secondary" disabled={saving} onClick={()=>{setAddingInline(false);}}><FaUndo /></Button>
                </td>
              </tr>
            )}
          </thead>
          <tbody>
            {filteredClients.map((c, idx) => {
              const editing = isEditing(c.id);
              return (
                <tr key={c.id} className={editing ? 'table-warning' : ''}>
                  <td>{idx + 1}</td>
                  <td>
                    {editing ? <Form.Control size="sm" value={draftValue(c.id, 'client_name', c.client_name || '')} onChange={e=>updateDraftField(c.id,'client_name',e.target.value)} /> : <span>{c.client_name}</span>}
                  </td>
                  <td>
                    {editing ? <Form.Control size="sm" value={draftValue(c.id, 'email', c.email || '')} onChange={e=>updateDraftField(c.id,'email',e.target.value)} /> : <span>{c.email}</span>}
                  </td>
                  <td>
                    {editing ? <Form.Control size="sm" value={draftValue(c.id, 'phone', c.phone || '')} onChange={e=>updateDraftField(c.id,'phone',e.target.value)} /> : <span>{c.phone}</span>}
                  </td>
                  <td>
                    {editing ? <Form.Control size="sm" value={draftValue(c.id, 'street', c.address?.street || '')} onChange={e=>updateDraftField(c.id,'street',e.target.value)} /> : <span>{c.address?.street}</span>}
                  </td>
                  <td>
                    {editing ? <Form.Control size="sm" value={draftValue(c.id, 'town', c.address?.town || '')} onChange={e=>updateDraftField(c.id,'town',e.target.value)} /> : <span>{c.address?.town}</span>}
                  </td>
                  <td>
                    {editing ? (
                      <Form.Select size="sm" value={draftValue(c.id, 'province', c.address?.province || '')} onChange={e=>updateDraftField(c.id,'province',e.target.value)}>
                        <option value="">Province</option>
                        {PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
                      </Form.Select>
                    ) : <span>{c.address?.province}</span>}
                  </td>
                  <td className="text-center">
                    {!editing && (
                      <ButtonGroup size="sm">
                        <Button variant="outline-primary" onClick={()=>startEdit(c.id)} title="Edit"><FaEdit /></Button>
                        <Button variant="outline-danger" disabled={!isAdmin} onClick={()=>handleDelete(c.id)} title={!isAdmin? 'Admin only' : 'Delete'}><FaTrash /></Button>
                      </ButtonGroup>
                    )}
                    {editing && (
                      <ButtonGroup size="sm">
                        <Button variant="success" disabled={saving} onClick={()=>saveRow(c)} title="Save"><FaSave /></Button>
                        <Button variant="outline-secondary" disabled={saving} onClick={()=>cancelEdit(c.id)} title="Cancel"><FaUndo /></Button>
                      </ButtonGroup>
                    )}
                  </td>
                </tr>
              );
            })}
            {!filteredClients.length && !addingInline && (
              <tr>
                <td colSpan={7} className="text-center text-muted py-3">No matching clients</td>
              </tr>
            )}
          </tbody>
        </Table>
      </div>
      <div className="small text-muted mt-2">{filteredClients.length} client(s)</div>
    </div>
  );

  const renderCardView = () => (
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
                <div className="d-flex align-items-center">
                  <i className="bi bi-geo-alt me-2 text-muted"></i>
                  <small className="text-muted">{client.address?.town}, {client.address?.province}</small>
                </div>
              </div>
              <Stack direction="horizontal" gap={2} className="mt-auto">
                <Link to={`/clients/edit/${client.id}`} className="btn btn-outline-primary btn-sm flex-fill">
                  <i className="bi bi-pencil-fill me-1"></i>Edit
                </Link>
                <Button variant="outline-danger" size="sm" className="flex-fill" disabled={!isAdmin} title={!isAdmin ? 'Admin only' : 'Delete client'} onClick={() => handleDelete(client.id)}>
                  <i className="bi bi-trash-fill me-1"></i>Delete
                </Button>
              </Stack>
            </Card.Body>
          </Card>
        </Col>
      ))}
    </Row>
  );
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
          <Col lg={12} xl={12}>
            <Card className="shadow-lg border-0 rounded-xl p-4 p-md-5">
              <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
                <div>
                  <h2 className="text-3xl font-bold text-gray-800 mb-1">
                    <i className="bi bi-people-fill me-3"></i>Clients
                  </h2>
                  <p className="text-muted mb-0">Manage your client database</p>
                </div>
                <div className="d-flex align-items-center gap-3">
                  <Form.Check
                    type="switch"
                    id="clients-view-switch"
                    label={viewMode === 'list' ? 'List View' : 'Card View'}
                    checked={viewMode === 'list'}
                    onChange={e => setViewMode(e.target.checked ? 'list' : 'cards')}
                  />
                  {viewMode === 'cards' && (
                    <Link to="/clients/add" className="btn btn-primary shadow-sm">
                      <i className="bi bi-plus-lg me-2"></i>Add Client
                    </Link>
                  )}
                </div>
              </div>

              {error && <Alert variant="danger" className="mb-4">{error}</Alert>}

              {/* View mode toggle + content */}
              {clients.length === 0 && viewMode === 'cards' && !search ? (
                <div className="text-center py-5">
                  <i className="bi bi-people" style={{fontSize: '4rem', color: '#9ca3af'}}></i>
                  <h4 className="mt-3 text-gray-700">No Clients Found</h4>
                  <p className="text-muted mb-4">Start building your client database by adding your first client.</p>
                  <Link to="/clients/add" className="btn btn-primary">
                    <i className="bi bi-plus-lg me-2"></i>Add Your First Client
                  </Link>
                </div>
              ) : (
                <>
                  {viewMode === 'cards' ? renderCardView() : renderListView()}
                </>
              )}
            </Card>
          </Col>
        </Row>
      </Container>
    </div>
  );
}

export default Clients;
