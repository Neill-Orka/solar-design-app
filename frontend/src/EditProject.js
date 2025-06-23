import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { API_URL } from "./apiConfig";

function EditProject() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);

  useEffect(() => {
    axios.get(`${API_URL}/api/projects/${id}`)
      .then((res) => setProject(res.data))
      .catch((err) => {
        console.error('Error loading project:', err);
        alert('Failed to load project');
      });
  }, [id]);

  const handleChange = (e) => {
    setProject({
      ...project,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    axios.put(`${API_URL}/api/projects/${id}`, project)
      .then(() => {
        alert('Project updated successfully!');
        navigate('/projects');
      })
      .catch((err) => {
        console.error('Error updating project:', err);
        alert('Failed to update project');
      });
  };

  if (!project) return <div className="container mt-5">Loading...</div>;

  return (
    <div className="container mt-5">
      <h2>Edit Project</h2>
      <form onSubmit={handleSubmit} className="row g-3">
        <div className="col-md-6">
          <label className="form-label">Project Name</label>
          <input type="text" className="form-control" name="name" value={project.name} onChange={handleChange} required />
        </div>
        <div className="col-md-6">
          <label className="form-label">Description</label>
          <input type="text" className="form-control" name="description" value={project.description || ''} onChange={handleChange} />
        </div>
        <div className="col-md-4">
          <label className="form-label">System Type</label>
          <select className="form-select" name="system_type" value={project.system_type || ''} onChange={handleChange}>
            <option value="">Select</option>
            <option value="grid">Grid-Tied</option>
            <option value="hybrid">Hybrid</option>
            <option value="off-grid">Off-Grid</option>
          </select>
        </div>
        <div className="col-md-4">
          <label className="form-label">Panel Size (kWp)</label>
          <input type="number" className="form-control" name="panel_kw" value={project.panel_kw || ''} onChange={handleChange} />
        </div>
        <div className="col-md-4">
          <label className="form-label">Inverter Size (kVA)</label>
          <input type="number" className="form-control" name="inverter_kva" value={project.inverter_kva || ''} onChange={handleChange} />
        </div>
        {project.system_type !== 'grid' && (
          <div className="col-md-4">
            <label className="form-label">Battery Size (kWh)</label>
            <input type="number" className="form-control" name="battery_kwh" value={project.battery_kwh || ''} onChange={handleChange} />
          </div>
        )}
        <div className="col-md-6">
          <label className="form-label">Location</label>
          <input type="text" className="form-control" name="location" value={project.location || ''} onChange={handleChange} />
        </div>
        <div className="col-md-6">
          <label className="form-label">Project Value (excl. VAT)</label>
          <input type="number" className="form-control" name="project_value_excl_vat" value={project.project_value_excl_vat || ''} onChange={handleChange} />
        </div>
        <div className="col-md-6">
          <label className="form-label">Site Contact Person</label>
          <input type="text" className="form-control" name="site_contact_person" value={project.site_contact_person || ''} onChange={handleChange} />
        </div>
        <div className="col-md-6">
          <label className="form-label">Site Phone</label>
          <input type="text" className="form-control" name="site_phone" value={project.site_phone || ''} onChange={handleChange} />
        </div>
        <div className="col-12">
          <button className="btn btn-primary">Save Changes</button>
        </div>
      </form>
    </div>
  );
}

export default EditProject;
