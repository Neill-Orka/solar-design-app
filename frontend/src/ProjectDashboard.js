import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import EnergyDataUpload from './EnergyDataUpload';
import EnergyAnalysis from './EnergyAnalysis';
import SystemDesign from './SystemDesign';
import FinancialModeling from './FinancialModeling';
import Reporting from './Reporting';

function ProjectDashboard() {
  const { id } = useParams();  // project_id from URL
  const [project, setProject] = useState(null);
  const [activeTab, setActiveTab] = useState('upload');

  useEffect(() => {
    axios.get(`http://localhost:5000/api/projects/${id}`)
      .then((res) => setProject(res.data))
      .catch((err) => {
        console.error('Error loading project:', err);
        alert('Failed to load project details');
      });
  }, [id]);

  if (!project) return <div className="container mt-5">Loading project...</div>;

  return (
    <div className="container mt-5">
      <h2>{project.name}</h2>
      <p>
        <strong>Client:</strong> {project.client_name}<br />
        <strong>Location:</strong> {project.location}<br />
        <strong>System Type:</strong> {project.system_type || 'Not set'}<br />
        <strong>Size:</strong> {project.panel_kw || '-'} kWp, {project.inverter_kva || '-'} kVA
        {project.system_type !== 'grid' && project.battery_kwh && (
          <> | Battery: {project.battery_kwh} kWh</>
        )}
      </p>

      <ul className="nav nav-tabs mt-4">
        <li className="nav-item">
          <button className={`nav-link ${activeTab === 'upload' ? 'active' : ''}`} onClick={() => setActiveTab('upload')}>Energy Upload</button>
        </li>
        <li className="nav-item">
          <button className={`nav-link ${activeTab === 'analysis' ? 'active' : ''}`} onClick={() => setActiveTab('analysis')}>Energy Analysis</button>
        </li>
        <li className="nav-item">
          <button className={`nav-link ${activeTab === 'design' ? 'active' : ''}`} onClick={() => setActiveTab('design')}>System Design</button>
        </li>
        <li className="nav-item">
          <button className={`nav-link ${activeTab === 'finance' ? 'active' : ''}`} onClick={() => setActiveTab('finance')}>Financial Modeling</button>
        </li>
        <li className="nav-item">
          <button className={`nav-link ${activeTab === 'report' ? 'active' : ''}`} onClick={() => setActiveTab('report')}>Reporting</button>
        </li>
      </ul>

      <div className="tab-content mt-4">
        {activeTab === 'upload' && <EnergyDataUpload projectId={id} />}
        {activeTab === 'analysis' && <EnergyAnalysis projectId={id} />}
        {activeTab === 'design' && <SystemDesign projectId={id} />}
        {activeTab === 'finance' && <FinancialModeling projectId={id} />}
        {activeTab === 'report' && <Reporting projectId={id} />}
      </div>
    </div>
  );
}

export default ProjectDashboard;
