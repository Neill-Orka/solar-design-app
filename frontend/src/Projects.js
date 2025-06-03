import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';

function Projects() {
  const [projects, setProjects] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = () => {
    axios.get('http://localhost:5000/api/projects')
      .then((response) => setProjects(response.data))
      .catch((error) => {
        console.error('Error fetching projects:', error);
        alert('Failed to load projects');
      });
  };

  const handleDelete = (id) => {
    if (window.confirm('Are you sure you want to delete this project? This action cannot be undone.')) {
      axios.delete(`http://localhost:5000/api/projects/${id}`)
        .then((response) => {
          alert('Project deleted successfully!');
          loadProjects(); // Reload the list after deleting
        })
        .catch((error) => {
          console.error('Error deleting project:', error);
          alert('Failed to delete project: ' + (error.response?.data?.error || error.message));
        });
    }
  };

  return (
    <div className="container mt-5">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2 className="mb-0">Projects</h2>
        <Link to="/projects/add" className="btn btn-success">+ Add New Project</Link>
      </div>

      {projects.length === 0 ? (
        <p>No projects found. Add some projects first!</p>
      ) : (
        <div className="row">
          {projects.map((project) => (
            <div className="col-md-6 col-lg-4 mb-4" key={project.id}>
              <div className="card shadow-sm h-100">
                <div className="card-body">
                  <h5 className="card-title">{project.name}</h5>
                    <p className="card-text">
                      <strong>Client:</strong> {project.client_name}<br />
                      <strong>Location:</strong> {project.location}<br />
                      <strong>Type:</strong> {project.system_type || 'Not set'}<br />
                      <strong>Size:</strong> {project.panel_kw || '-'} kWp, 
                      {project.inverter_kva 
                        ? (typeof project.inverter_kva === 'object' && 'capacity' in project.inverter_kva && 'quantity' in project.inverter_kva
                          ? `${project.inverter_kva.capacity} kVA (x${project.inverter_kva.quantity})`
                          : project.inverter_kva)
                        : '-'} kVA<br />
                      {project.system_type !== 'grid' && project.battery_kwh && (
                        <>
                          <strong>Battery:</strong> 
                          {project.battery_kwh 
                            ? (typeof project.battery_kwh === 'object' && 'capacity' in project.battery_kwh && 'quantity' in project.battery_kwh
                              ? `${project.battery_kwh.capacity} kWh (x${project.battery_kwh.quantity})`
                              : project.battery_kwh)
                            : '-'} kWh<br />
                        </>
                      )}
                    </p>
                    <div className="d-flex justify-content-between">
                    <Link to={`/projects/${project.id}`} className="btn btn-primary btn-sm">Open</Link>
                    <Link to={`/projects/edit/${project.id}`} className="btn btn-outline-primary btn-sm">Edit</Link>
                    <button className="btn btn-outline-danger btn-sm" onClick={() => handleDelete(project.id)}>Delete</button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default Projects;
