import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { Container, Row, Col, Card, Button, Modal, Badge, Spinner, Alert, Dropdown, Table, InputGroup, ButtonGroup, Form } from 'react-bootstrap';
import { API_URL } from './apiConfig';

// A compact styled component for key project metrics
const ProjectStat = ({ icon, label, value, variant = "secondary" }) => (
  <div className="d-flex align-items-center">
    <i className={`bi ${icon} me-2 text-muted`} style={{ fontSize: '0.9rem' }}></i>
    <div>
      <small className="text-muted d-block" style={{ fontSize: '0.75rem', lineHeight: '1' }}>{label}</small>
      <Badge bg={variant} className="mt-1" style={{ fontSize: '0.7rem' }}>{value}</Badge>
    </div>
  </div>
);

function Projects() {
  const [projects, setProjects] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [viewMode, setViewMode] = useState('grid');
  const [activeFilters, setActiveFilters] = useState({
    status: 'all',
    designType: 'all',
    systemType: 'all',
    projectType: 'all'
  });

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = () => {
    setLoading(true);
    axios.get(`${API_URL}/api/projects`)
      .then((response) => {
        setProjects(response.data);
        setError('');
      })
      .catch((err) => {
        console.error('Error fetching projects:', err);
        setError('Failed to load projects. Please ensure the server is running and accessible.');
      })
      .finally(() => {
        setLoading(false);
      });
  };

  const handleDeleteRequest = (id) => {
    setProjectToDelete(id);
    setShowDeleteModal(true);
  };

  const handleConfirmDelete = () => {
    if (!projectToDelete) return;
    axios.delete(`${API_URL}/api/projects/${projectToDelete}`)
      .then(() => {
        setShowDeleteModal(false);
        setProjectToDelete(null);
        loadProjects(); // Reload projects after deletion
      })
      .catch((err) => {
        console.error('Error deleting project:', err);
        setError('Failed to delete project: ' + (err.response?.data?.error || err.message));
        setShowDeleteModal(false);
      });
  };
  // Memoize the filtering logic to prevent re-calculation on every render
  const filteredProjects = useMemo(() => {
    let filtered = projects.filter(p =>
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.client_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.location.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Apply additional filters
    if (activeFilters.status !== 'all') {
      filtered = filtered.filter(p => (p.status || 'active').toLowerCase() === activeFilters.status);
    }
    if (activeFilters.designType !== 'all') {
      filtered = filtered.filter(p => (p.design_type || '').toLowerCase() === activeFilters.designType);
    }
    if (activeFilters.systemType !== 'all') {
      filtered = filtered.filter(p => (p.system_type || '').toLowerCase() === activeFilters.systemType);
    }
    if (activeFilters.projectType !== 'all') {
      filtered = filtered.filter(p => (p.project_type || '').toLowerCase() === activeFilters.projectType);
    }

    return filtered;
  }, [projects, searchTerm, activeFilters]);
  return (
    <div className='min-vh-100' style={{ backgroundColor: '#f8f9fa' }}>
      <Container fluid className="py-4 py-md-5">
        <Row className="justify-content-center">
          <Col lg={12} xl={10}>
            <Card className="shadow-lg border-0 rounded-xl p-4 p-md-5">
              <div className="d-flex justify-content-between align-items-center mb-4">
                <div>
                  <h2 className="text-3xl font-bold text-gray-800 mb-1">
                    <i className="bi bi-folder-fill me-3"></i>Projects
                  </h2>
                  <p className="text-muted mb-0">Manage your solar design projects</p>
                </div>
                <Link
                  to="/projects/add"
                  className="btn btn-primary shadow-sm"
                >
                  <i className="bi bi-plus-lg me-2"></i>New Project
                </Link>
              </div>

              {/* Search and View Controls */}
              <Card className='shadow-sm border-0 rounded-xl p-3 mb-4'>
                <Row className='g-3 align-items-center'>
                  <Col md={8}>
                    <InputGroup>
                      <InputGroup.Text className='bg-light border-end-0'>
                        <i className="bi bi-search" style={{ color: '#6b7280', fontSize: '1.1rem' }}></i>
                      </InputGroup.Text>
                      <Form.Control 
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        placeholder="Search by project or client name.."
                        className='border-start-0 border-light rounded-lg'
                      />
                    </InputGroup>
                  </Col> 
                  <Col md={4} className="d-flex justify-content-end">
                    <ButtonGroup>
                      <Button variant={viewMode === 'card' ? 'primary' : 'outline-secondary'} onClick={() => setViewMode('card')} title='Card View'>
                        <i className="bi bi-grid-3x3-gap-fill"></i>
                      </Button>
                      <Button variant={viewMode === 'list' ? 'primary' : 'outline-secondary'} onClick={() => setViewMode('list')} title='List View'>
                        <i className="bi bi-list-ul"></i>
                      </Button>
                    </ButtonGroup>
                  </Col>
                  {loading && (
                    <div className="text-center py-5">
                      <Spinner animation="border" className="text-primary" />
                    </div>
                  )}
                </Row>
              </Card>

              {/* Filter Controls */}
              <Card className='shadow-sm border-0 rounded-xl p-3 mb-4'>
                <Row className='g-3'>
                  <Col lg={3} md={6}>
                    <div className="mb-2">
                      <small className="text-muted fw-bold">Design Type</small>
                    </div>
                    <ButtonGroup size="sm" className="w-100">
                      <Button 
                        variant={activeFilters.designType === 'all' ? 'primary' : 'outline-secondary'}
                        onClick={() => setActiveFilters(prev => ({...prev, designType: 'all'}))}
                      >
                        All
                      </Button>
                      <Button 
                        variant={activeFilters.designType === 'quick' ? 'primary' : 'outline-secondary'}
                        onClick={() => setActiveFilters(prev => ({...prev, designType: 'quick'}))}
                      >
                        Quick
                      </Button>
                      <Button 
                        variant={activeFilters.designType === 'detailed' ? 'primary' : 'outline-secondary'}
                        onClick={() => setActiveFilters(prev => ({...prev, designType: 'detailed'}))}
                      >
                        Detailed
                      </Button>
                    </ButtonGroup>
                  </Col>
                  
                  <Col lg={3} md={6}>
                    <div className="mb-2">
                      <small className="text-muted fw-bold">System Type</small>
                    </div>
                    <ButtonGroup size="sm" className="w-100">
                      <Button 
                        variant={activeFilters.systemType === 'all' ? 'primary' : 'outline-secondary'}
                        onClick={() => setActiveFilters(prev => ({...prev, systemType: 'all'}))}
                      >
                        All
                      </Button>
                      <Button 
                        variant={activeFilters.systemType === 'grid' ? 'primary' : 'outline-secondary'}
                        onClick={() => setActiveFilters(prev => ({...prev, systemType: 'grid'}))}
                      >
                        Grid-Tied
                      </Button>
                      <Button 
                        variant={activeFilters.systemType === 'hybrid' ? 'primary' : 'outline-secondary'}
                        onClick={() => setActiveFilters(prev => ({...prev, systemType: 'hybrid'}))}
                      >
                        Hybrid
                      </Button>
                    </ButtonGroup>
                  </Col>

                  <Col lg={3} md={6}>
                    <div className="mb-2">
                      <small className="text-muted fw-bold">Project Type</small>
                    </div>
                    <ButtonGroup size="sm" className="w-100">
                      <Button 
                        variant={activeFilters.projectType === 'all' ? 'primary' : 'outline-secondary'}
                        onClick={() => setActiveFilters(prev => ({...prev, projectType: 'all'}))}
                      >
                        All
                      </Button>
                      <Button 
                        variant={activeFilters.projectType === 'residential' ? 'primary' : 'outline-secondary'}
                        onClick={() => setActiveFilters(prev => ({...prev, projectType: 'residential'}))}
                      >
                        Residential
                      </Button>
                      <Button 
                        variant={activeFilters.projectType === 'commercial' ? 'primary' : 'outline-secondary'}
                        onClick={() => setActiveFilters(prev => ({...prev, projectType: 'commercial'}))}
                      >
                        Commercial
                      </Button>
                    </ButtonGroup>
                  </Col>

                  <Col lg={3} md={6}>
                    <div className="mb-2">
                      <small className="text-muted fw-bold">Status</small>
                    </div>
                    <ButtonGroup size="sm" className="w-100">
                      <Button 
                        variant={activeFilters.status === 'all' ? 'primary' : 'outline-secondary'}
                        onClick={() => setActiveFilters(prev => ({...prev, status: 'all'}))}
                      >
                        All
                      </Button>
                      <Button 
                        variant={activeFilters.status === 'active' ? 'primary' : 'outline-secondary'}
                        onClick={() => setActiveFilters(prev => ({...prev, status: 'active'}))}
                      >
                        Active
                      </Button>
                      <Button 
                        variant={activeFilters.status === 'completed' ? 'primary' : 'outline-secondary'}
                        onClick={() => setActiveFilters(prev => ({...prev, status: 'completed'}))}
                      >
                        Completed
                      </Button>
                    </ButtonGroup>
                  </Col>
                </Row>
              </Card>

              {error && (
                <Alert variant="danger" className="mb-4">
                  <i className="bi bi-exclamation-triangle-fill me-2"></i>{error}
                </Alert>
              )}

              {!loading && !error && (
                <>
                  {filteredProjects.length === 0 ? (
                    <div className="text-center py-5">
                      <i className="bi bi-folder-x" style={{fontSize: '4rem', color: '#9ca3af'}}></i>
                      <h4 className="mt-3 text-gray-700">No Projects Found</h4>
                      <p className="text-muted mb-4">
                        {searchTerm ? `No projects match "${searchTerm}"` : 'Start creating your first solar project.'}
                      </p>
                      {!searchTerm && (
                        <Link to="/projects/add" className="btn btn-primary">
                          <i className="bi bi-plus-lg me-2"></i>Create Your First Project
                        </Link>
                      )}
                    </div>
                  ) : viewMode === 'card' ? (
                    <Row xs={1} md={2} lg={3} className="g-4">
                      {filteredProjects.map((project) => (
                        <Col key={project.id}>
                          <Card className="h-100 shadow-sm border-light hover-shadow">
                            <Card.Body className="p-4">                              {/* Header with badges */}
                              <div className="d-flex align-items-start justify-content-between mb-3">
                                <div className="d-flex flex-wrap gap-1">
                                  <Badge bg="primary" className="mb-1">{project.project_type || 'Commercial'}</Badge>
                                  <Badge bg="secondary" className="mb-1">{project.design_type || 'Detailed'}</Badge>
                                  {project.system_type && (
                                    <Badge bg="info" className="mb-1 text-capitalize">{project.system_type}</Badge>
                                  )}
                                </div>
                                <Dropdown align="end">
                                  <Dropdown.Toggle 
                                    variant="link" 
                                    className="p-0 text-muted border-0 shadow-none"
                                    style={{ boxShadow: 'none !important' }}
                                  >
                                    <i className="bi bi-three-dots-vertical"></i>
                                  </Dropdown.Toggle>

                                  <Dropdown.Menu>
                                    <Dropdown.Item as={Link} to={`/projects/${project.id}`}>
                                      <i className="bi bi-eye me-2"></i>View Project
                                    </Dropdown.Item>
                                    <Dropdown.Item as={Link} to={`/projects/edit/${project.id}`}>
                                      <i className="bi bi-pencil me-2"></i>Edit Project
                                    </Dropdown.Item>
                                    <Dropdown.Divider />
                                    <Dropdown.Item 
                                      className="text-danger" 
                                      onClick={() => handleDeleteRequest(project.id)}
                                    >
                                      <i className="bi bi-trash me-2"></i>Delete Project
                                    </Dropdown.Item>
                                  </Dropdown.Menu>
                                </Dropdown>
                              </div>

                              {/* Project name and client */}
                              <Card.Title className="h5 mb-2 text-truncate">{project.name}</Card.Title>
                              <div className="mb-3">
                                <div className="d-flex align-items-center mb-1">
                                  <i className="bi bi-person me-2 text-muted" style={{fontSize: '0.9rem'}}></i>
                                  <small className="text-muted text-truncate">{project.client_name}</small>
                                </div>
                                <div className="d-flex align-items-center">
                                  <i className="bi bi-geo-alt me-2 text-muted" style={{fontSize: '0.9rem'}}></i>
                                  <small className="text-muted text-truncate">{project.location || 'No location'}</small>
                                </div>
                              </div>

                              {/* System specs in compact format */}
                              <div className="mb-3">
                                <Row className="g-2">
                                  <Col xs={6}>
                                    <ProjectStat 
                                      icon="bi-sun" 
                                      label="Solar" 
                                      value={project.panel_kw ? `${project.panel_kw}kWp` : 'N/A'}
                                      variant="warning"
                                    />
                                  </Col>
                                  <Col xs={6}>
                                    <ProjectStat 
                                      icon="bi-lightning" 
                                      label="Inverter" 
                                      value={project.inverter_kva ? `${project.inverter_kva}kVA` : 'N/A'}
                                      variant="info"
                                    />
                                  </Col>
                                  {project.system_type !== 'grid' && project.battery_kwh && (
                                    <Col xs={12}>
                                      <ProjectStat 
                                        icon="bi-battery-half" 
                                        label="Battery" 
                                        value={`${project.battery_kwh}kWh`}
                                        variant="success"
                                      />
                                    </Col>
                                  )}
                                </Row>
                              </div>

                              {/* Action button */}
                              <Link 
                                to={`/projects/${project.id}`} 
                                className="btn btn-outline-primary btn-sm w-100"
                              >
                                <i className="bi bi-arrow-right-circle me-2"></i>
                                Open Project
                              </Link>
                            </Card.Body>
                          </Card>
                        </Col>
                      ))}
                    </Row>
                  ) : (
                    <Card className="shadow-sm border-0 rounded-xl">
                      <Table hover responsive className="mb-0">
                        <thead className="table-light">
                          <tr>
                            <th className="ps-4">Project Name</th>
                            <th>Client</th>
                            <th>Status</th>
                            <th>Design Type</th>
                            <th>Created</th>
                            <th className="text-end pe-4">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredProjects.map(project => (
                            <tr key={project.id} style={{ verticalAlign: 'middle' }}>
                              <td className="ps-4">
                                <span className="fw-bold">{project.name}</span>
                              </td>
                              <td>{project.client_name || 'N/A'}</td>
                              <td><Badge bg="success" pill>{project.status || 'N/A'}</Badge></td>
                              <td><Badge bg="info" pill>{project.design_type || 'N/A'}</Badge></td>
                              <td>
                                {project.created_at ? new Date(project.created_at).toLocaleDateString() : 'N/A'}
                              </td>
                              <td className="text-end pe-3">
                                <Link to={`/projects/${project.id}`} className="btn btn-primary btn-sm me-2">
                                  <i className="bi bi-folder-fill me-1"></i> Open
                                </Link>
                                <Link to={`/projects/edit/${project.id}`} className="btn btn-outline-secondary btn-sm me-2">
                                  <i className="bi bi-pencil-fill me-1"></i> Edit
                                </Link>
                                <Button variant="outline-danger" size="sm" onClick={() => handleDeleteRequest(project.id)}>
                                  <i className="bi bi-trash-fill"></i>
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </Table>
                    </Card>                    
                  )}
                </>
              )}
            </Card>
          </Col>
        </Row>
      </Container>

      {/* Delete Modal */}
      <Modal show={showDeleteModal} onHide={() => setShowDeleteModal(false)} centered>
        <Modal.Header closeButton className="bg-light">
          <Modal.Title>
            <i className="bi bi-exclamation-triangle-fill text-danger me-2"></i>
            Confirm Deletion
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-4">
          <p className="mb-2">Are you sure you want to delete this project?</p>
          <p className="text-muted mb-3">All associated data will be permanently removed.</p>
          <div className="bg-danger bg-opacity-10 border border-danger border-opacity-25 rounded p-3">
            <p className="fw-bold text-danger mb-0">
              <i className="bi bi-exclamation-circle me-2"></i>
              This action cannot be undone.
            </p>
          </div>
        </Modal.Body>
        <Modal.Footer className="bg-light">
          <Button variant="outline-secondary" onClick={() => setShowDeleteModal(false)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleConfirmDelete}>
            <i className="bi bi-trash-fill me-2"></i>
            Delete Project
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}

export default Projects;