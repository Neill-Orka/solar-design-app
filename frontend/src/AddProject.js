import React, { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { API_URL } from "./apiConfig";

function AddProject() {
  const [showToast, setShowToast] = useState(false);
  const [clients, setClients] = useState([]);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [newClientName, setNewClientName] = useState('');
  const [newClientEmail, setNewClientEmail] = useState('');
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
        alert('Failed to load clients.');
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

    let clientId = selectedClientId;

    if (clientId === 'new') {
      // Create new client first
      if (!newClientName || !newClientEmail) {
        alert('Please enter new client name and email.');
        return;
      }
      try {
        const res = await axios.post(`${API_URL}/api/clients`, {
          client_name: newClientName,
          email: newClientEmail,
          phone: '' // Optional: user can edit phone later
        });
        alert('New client created successfully!');
        // Reload clients and set the new one
        clientId = res.data.client_id;
        setSelectedClientId(clientId); 
      } catch (err) {
        console.error('Error creating client:', err);
        alert('Failed to create new client: ' + (err.response?.data?.error || err.message));
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
      alert('Failed to add project: ' + (err.response?.data?.error || err.message));
    }
  };

  return (
    <div className="container mt-5">
      <h2>Add New Project</h2>

      {/* Design Type Selection */}
      <div className="mb-4">
        <button
          className={`btn btn-lg me-3 ${projectData.design_type === 'Quick' ? 'btn-primary' : 'btn-outline-primary'}`}
          onClick={() => setProjectData({ ...projectData, design_type: 'Quick'})}
          type="button"
        >
          Quick Design
        </button>
        <button
          className={`btn btn-lg ${projectData.design_type === 'Detailed' ? 'btn-primary' : 'btn-outline-primary'}`}
          onClick={() => setProjectData({ ...projectData, design_type: 'Detailed'})}
          type="button"
        >
          Detailed Design
        </button>
      </div>

      <form onSubmit={handleSubmit} className="row g-3">

        {/* Client Selection */}
        <div className="col-md-6">
          <label className="form-label">Select Client</label>
          <select className="form-select" value={selectedClientId} onChange={(e) => setSelectedClientId(e.target.value)} required>
            <option value="">-- Choose Client --</option>
            {clients.map(client => (
              <option key={client.id} value={client.id}>
                {client.client_name} ({client.email})
              </option>
            ))}
            <option value="new">+ Add New Client</option>
          </select>
        </div>

        {/* If adding a new client */}
        {selectedClientId === 'new' && (
          <>
            <div className="col-md-6">
              <label className="form-label">New Client Name</label>
              <input type="text" className="form-control" value={newClientName} onChange={(e) => setNewClientName(e.target.value)} required />
            </div>
            <div className="col-md-6">
              <label className="form-label">New Client Email</label>
              <input type="email" className="form-control" value={newClientEmail} onChange={(e) => setNewClientEmail(e.target.value)} required />
            </div>
          </>
        )}

        {/* Project Details */}
        <div className="col-md-6">
          <label className="form-label">Project Name</label>
          <input type="text" className="form-control" name="name" value={projectData.name} onChange={handleInputChange} required />
        </div>

        <div className="col-md-6">
          <label className="form-label">Description</label>
          <input type="text" className="form-control" name="description" value={projectData.description} onChange={handleInputChange} />
        </div>

        <div className="col-md-4">
          <label className="form-label">System Type</label>
          <select className="form-select" name="system_type" value={projectData.system_type} onChange={handleInputChange} required>
            <option value="">-- Choose Type --</option>
            <option value="grid">Grid-Tied</option>
            <option value="hybrid">Hybrid</option>
            <option value="off-grid">Off-Grid</option>
          </select>
        </div>

        <div className="col-md-4">
          <label className="form-label">Project Type</label>
          <select className="form-select" name="project_type" value={projectData.project_type} onChange={handleInputChange} required>
            <option value="">-- Choose Type --</option>
            <option value="Residential">Residential</option>
            <option value="Commercial">Commercial</option>
          </select>
        </div>

        {projectData.design_type === 'Detailed' && (
          <>
            <div className="col-md-4">
              <label className="form-label">Panel Size (kWp)</label>
              <input type="number" className="form-control" name="panel_kw" value={projectData.panel_kw} onChange={handleInputChange} step="0.1" />
            </div>
            
            <div className="col-md-4">
              <label className="form-label">Inverter Size (kVA)</label>
              <input type="number" className="form-control" name="inverter_kva" value={projectData.inverter_kva} onChange={handleInputChange} step="0.1" />
            </div>
            
            {projectData.system_type !== 'grid' && (
              <div className="col-md-4">
                <label className="form-label">Battery Size (kWh)</label>
                <input type="number" className="form-control" name="battery_kwh" value={projectData.battery_kwh} onChange={handleInputChange} step="0.1" />
              </div>
            )}     
            
            <div className="col-md-4">
              <label className="form-label">Project Value (excl. VAT)</label>
              <input type="number" className="form-control" name="project_value_excl_vat" value={projectData.project_value_excl_vat} onChange={handleInputChange} step="0.01" />
            </div>

            <div className="col-md-6">
              <label className="form-label">Site Contact Person</label>
              <input type="text" className="form-control" name="site_contact_person" value={projectData.site_contact_person} onChange={handleInputChange} />
            </div>

            <div className="col-md-6">
              <label className="form-label">Site Phone</label>
              <input type="text" className="form-control" name="site_phone" value={projectData.site_phone} onChange={handleInputChange} />
            </div>                 
              </>
            )}

        <div className="col-md-6">
          <label className="form-label">Location</label>
          <input type="text" className="form-control" name="location" value={projectData.location} onChange={handleInputChange} />
        </div>



        {/* Submit */}
        <div className="col-12">
          <button className="btn btn-success" type="submit">Save Project</button>
          <button className="btn btn-secondary ms-2" type="button" onClick={() => navigate('/projects')}>Cancel</button>
        </div>

      </form>
      {showToast && (
      <div className="toast-container position-fixed bottom-0 end-0 p-3">
        <div className="toast show text-bg-success">
          <div className="toast-body">
            Project added successfully!
          </div>
        </div>
      </div>
      )}   
    </div>
  );

}


export default AddProject;
