import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { Modal, Button } from 'react-bootstrap';
import { API_URL } from './apiConfig'; // Adjust the import based on your project structure

// A styled component for key project metrics
const ProjectStat = ({ icon, label, value }) => (
  <div className="d-flex flex-column">
    <small className="text-muted d-flex align-items-center" style={{ fontSize: '0.8rem' }}>
      <i className={`bi ${icon} me-2`}></i>
      {label}
    </small>
    <span className="fw-bold text-gray-800 mt-1">{value}</span>
  </div>
);

function Projects() {
  const [projects, setProjects] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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
    return projects.filter(p =>
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.client_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.location.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [projects, searchTerm]);

  const renderSystemSize = (project) => {
    const panel = project.panel_kw ? `${project.panel_kw} kWp` : 'N/A';
    let inverter = 'N/A';
    if (project.inverter_kva) {
      inverter = typeof project.inverter_kva === 'object' && 'capacity' in project.inverter_kva
        ? `${project.inverter_kva.capacity} kVA (x${project.inverter_kva.quantity})`
        : `${project.inverter_kva} kVA`;
    }
    return `${panel} / ${inverter}`;
  };

  const renderBatterySize = (project) => {
      if (project.system_type === 'grid' || !project.battery_kwh) return 'None';
      return typeof project.battery_kwh === 'object' && 'capacity' in project.battery_kwh
        ? `${project.battery_kwh.capacity} kWh (x${project.battery_kwh.quantity})`
        : `${project.battery_kwh} kWh`;
  };

  return (
    <>
      <div className="min-vh-100" style={{ backgroundColor: '#f3f4f6' }}>
        <div className="container-fluid" style={{ maxWidth: '1000px', padding: '2rem 1rem' }}>
          
          {/* --- HEADER SECTION --- */}
          {/* <div className="d-flex flex-column flex-md-row justify-content-between align-items-center mb-5"> */}
          <div className="bg-white p-4 p-md-5 rounded-xl shadow-sm mb-5">  
            <div className="d-flex justify-content-between align-items-start mb-4">
              <div>
                <h1 className="text-3xl font-bold text-gray-800">Projects</h1>
                <p className="text-muted d-none d-md-block">
                  Search, view, and manage all your client projects.
                </p>
              </div>
              <Link
                to="/projects/add"
                className="btn btn-primary fw-semibold d-flex align-items-center shadow-sm flex-shrink-0"
                style={{ backgroundColor: '#2563eb', borderColor: '#1d4ed8', padding: '0.6rem 1rem' }}
              >
                <i className="bi bi-plus-lg me-2"></i>
                <span className="d-none d-sm-inline">New Project</span>
              </Link>
            </div>

            {/* Bottom Row: Search Bar */}
            <div className="position-relative">
              <i className="bi bi-search position-absolute" style={{ top: '50%', transform: 'translateY(-50%)', left: '16px', color: '#6b7280', fontSize: '1.1rem' }}></i>
              <input
                type="text"
                placeholder="Search projects by name, client, or location..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="form-control form-control-lg ps-5" // Use form-control-lg for a better feel
                style={{ borderRadius: '0.75rem', borderColor: '#d1d5db' }}
              />
            </div>
          </div>

          {/* --- ALERTS & LOADING --- */}
          {loading && <div className="text-center p-5"><div className="spinner-border text-primary" role="status"><span className="visually-hidden">Loading...</span></div></div>}
          {error && <div className="alert alert-danger shadow-sm"><i className="bi bi-exclamation-triangle-fill me-2"></i>{error}</div>}

          {/* --- PROJECTS LIST --- */}
          {!loading && !error && (
            <div className="d-grid gap-4">
              {filteredProjects.length > 0 ? (
                filteredProjects.map((project) => (
                  <div key={project.id} className="bg-white rounded-xl shadow-sm border border-gray-200 transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
                    <div className="p-4 p-md-5 d-flex flex-column flex-md-row align-items-start">
                      
                      <div className="flex-grow-1">
                        <div className="d-flex justify-content-between align-items-start mb-3">
                          <div>
                            <span className="badge bg-primary-subtle text-primary-emphasis rounded-pill mb-2 me-2">{project.project_type || 'Commercial'}</span>
                            <span className="badge bg-secondary-subtle text-secondary-emphasis rounded-pill mb-2">{project.design_type || 'Detailed'}</span>
                            <h4 className="card-title text-xl font-semibold text-gray-900 mb-1">{project.name}</h4>
                            <p className="card-subtitle text-muted">
                              <i className="bi bi-person-circle me-1"></i> {project.client_name}
                              <span className="mx-2 text-gray-300">|</span>
                              <i className="bi bi-geo-alt-fill me-1"></i> {project.location}
                            </p>
                          </div>
                          {/* --- ACTION BUTTONS (DESKTOP) --- */}
                          <div className="d-none d-md-flex align-items-center ms-4">
                            <Link to={`/projects/edit/${project.id}`} className="btn btn-sm btn-outline-secondary me-2"><i className="bi bi-pencil-square"></i></Link>
                            <Button variant="outline-danger" size="sm" onClick={() => handleDeleteRequest(project.id)}><i className="bi bi-trash-fill"></i></Button>
                            <Link to={`/projects/${project.id}`} className="btn btn-dark btn-sm ms-3 fw-semibold">
                                Open <i className="bi bi-arrow-right ms-1"></i>
                            </Link>
                          </div>
                        </div>

                        <div className="border-top my-4"></div>

                        <div className="d-grid gap-4" style={{gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))'}}>
                           <ProjectStat icon="bi-sun" label="System Size" value={renderSystemSize(project)} />
                           <ProjectStat icon="bi-battery-half" label="Battery Storage" value={renderBatterySize(project)} />
                           <ProjectStat icon="bi-building" label="System Type" value={project.system_type || 'Not Set'} />
                        </div>
                      </div>
                    </div>
                    {/* --- ACTION BUTTONS (MOBILE) --- */}
                    <div className="d-md-none border-top bg-light p-3 d-flex justify-content-end rounded-bottom-xl">
                        <Link to={`/projects/edit/${project.id}`} className="btn btn-sm btn-outline-secondary me-2">Edit</Link>
                        <Button variant="outline-danger" size="sm" onClick={() => handleDeleteRequest(project.id)}>Delete</Button>
                        <Link to={`/projects/${project.id}`} className="btn btn-dark btn-sm ms-2 fw-semibold">
                            Open Project <i className="bi bi-arrow-right ms-1"></i>
                        </Link>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-5 bg-white rounded-xl shadow-sm">
                  <i className="bi bi-search" style={{fontSize: '3rem', color: '#9ca3af'}}></i>
                  <h4 className="mt-3 text-gray-700">No Projects Found</h4>
                  <p className="text-gray-500">
                    {searchTerm ? `Your search for "${searchTerm}" did not return any results.` : 'Click "New" to create your first project.'}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* --- DELETE MODAL --- */}
      <Modal show={showDeleteModal} onHide={() => setShowDeleteModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Confirm Deletion</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>Are you sure you want to delete this project? All associated data will be permanently removed.</p>
          <p className="fw-bold text-danger">This action cannot be undone.</p>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowDeleteModal(false)}>Cancel</Button>
          <Button variant="danger" onClick={handleConfirmDelete}>Delete Project</Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}

export default Projects;