import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import EnergyDataUpload from './EnergyDataUpload';
import EnergyAnalysis from './EnergyAnalysis';
import SystemDesign from './SystemDesign';
import FinancialModeling from './FinancialModeling';
import Reporting from './Reporting';
import Optimize from './Optimize';
import BasicInfoForm from './BasicInfoForm';
import ProfileSelection from './ProfileSelection';
import SystemSelection from './SystemSelection';
import QuickResults from './QuickResults';

function ProjectDashboard() {
  const { id } = useParams();  // project_id from URL
  const [project, setProject] = useState(null);
  const [activeTab, setActiveTab] = useState('upload');
  const [currentStep, setCurrentStep] = useState(1); // Tracks quick design step
  const [basicInfo, setBasicInfo] = useState(null);
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [selectedSystem, setSelectedSystem] = useState(null);

  useEffect(() => {
    axios.get(`http://localhost:5000/api/projects/${id}`)
      .then((res) => setProject(res.data))
      .catch((err) => {
        console.error('Error loading project:', err);
        alert('Failed to load project details');
      });
  }, [id]);

  if (!project) return <div className="container mt-5">Loading project...</div>;

  console.log('Project design type:', project.design_type);

  // Quick Design: Wizard Flow
  if (project.design_type === 'Quick')
  {
    return(
      // MODIFIED: Apply page background and padding here
      <div className='min-vh-100 py-4 py-md-5 px-md-3' style={{ backgroundColor: '#f8f9fa' }}> 
        <div className="container"> {/* Optional: to constrain the width of the header content below */}
          <div className="mb-4 p-3 bg-white rounded-lg shadow-sm text-center"> {/* Header card */}
            <h1 className="text-3xl font-bold text-gray-800 mb-1">{project.name} - Quick Design</h1>
            <p className="text-sm text-gray-600">
              <strong>Client:</strong> {project.client_name} | <strong>Location:</strong> {project.location}
            </p>
          </div>

          <div className='progress mb-4 mx-auto' style={{height: '10px', maxWidth: '700px'}}> {/* Styled progress bar */}
            <div
              className="progress-bar bg-primary" // Use a primary color
              role="progressbar"
              style={{width: `${(currentStep/4)*100}%`}}
              aria-valuenow={currentStep}
              aria-valuemin={1}
              aria-valuemax={4}
            >
              {/* Step {currentStep} of 4 */} {/* Text can be removed for cleaner look */}
            </div>
          </div>
        </div>
        {currentStep === 1 && (
          <BasicInfoForm 
            projectId={id} // Pass projectId
            onSubmit={(data) => {
              // It's good practice to save to backend here as well
              axios.post(`http://localhost:5000/api/projects/${id}/quick_design`, data)
                .then(() => {
                  setBasicInfo(data);
                  setCurrentStep(2);
                })
                .catch(err => {
                  console.error("Error saving basic info:", err);
                  alert("Failed to save basic info. " + (err.response?.data?.error || err.message));
                });
            }} />
        )}
        {currentStep === 2 && (
          <ProfileSelection 
            projectId={id} // Pass projectId
            consumerType={basicInfo?.consumerType} 
            basicInfo={basicInfo}
            onSelect={(profile) => { // profile object is passed from ProfileSelection
              setSelectedProfile(profile); // Contains the full profile data including profile_data
              localStorage.setItem('selectedProfileForQuickDesign', JSON.stringify(profile)); // Save to localStorage
              setCurrentStep(3);
              // Backend save for selectedProfileId is handled within ProfileSelection's handleProfileSelect
            }} 
            onBack={() => setCurrentStep(1)}
          />
        )}
        {currentStep === 3 && (
          <SystemSelection 
            projectId={id} // Pass projectId
            onSelect={(system) => {
              // Save selected system to backend
               axios.post(`http://localhost:5000/api/projects/${id}/quick_design`, { selectedSystem: system })
                .then(() => {
                  setSelectedSystem(system);
                  setCurrentStep(4);
                })
                .catch(err => {
                  console.error("Error saving system selection:", err);
                  alert("Failed to save system selection. " + (err.response?.data?.error || err.message));
                });
            }} 
            onBack={() => setCurrentStep(2)}
          />
        )}
        {currentStep === 4 && (
          <>
            {console.log('--- ProjectDashboard State ---')}
            {console.log('Passing to QuickResults - basicInfo:', basicInfo)}
            {console.log('Passing to QuickResults - selectedProfile:', selectedProfile)}
            {console.log('Passing to QuickResults - selectedSystem:', selectedSystem)}          

          <QuickResults 
            basicInfo={basicInfo}
            selectedProfile={selectedProfile}
            selectedSystem={selectedSystem} 
            onGenerate={() => alert('Proposal generated!')} // Implement real functionality nog hier
            onBack={() => setCurrentStep(3)}
          />
          </>
          )}
      </div>
    );
  }

  return (
    <div className="container mt-5">
      <h2>{project.name}</h2>
      <p>
        <strong>Client:</strong> {project.client_name}<br />
        <strong>Location:</strong> {project.location}<br />
        <strong>System Type:</strong> {project.system_type || 'Not set'}<br />
        <strong>Size:</strong> {project.panel_kw || '-'} kWp,{' '}
        {typeof project.inverter_kva === 'object'
          ? `${project.inverter_kva.capacity} kVA (x${project.inverter_kva.quantity})`
          : (project.inverter_kva || '-')} kVA
        {project.system_type !== 'grid' && project.battery_kwh && (
          <> | Battery:{' '}
            {typeof project.battery_kwh === 'object'
              ? `${project.battery_kwh.capacity} kWh (x${project.battery_kwh.quantity})`
              : project.battery_kwh} kWh
          </>
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
          <button className={`nav-link ${activeTab === 'optimize' ? 'active' : ''}`} onClick={() => setActiveTab('optimize')}>Optimize System</button>
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
        {activeTab === 'optimize' && <Optimize projectId={id} />}
        {activeTab === 'report' && <Reporting projectId={id} />}
      </div>
    </div>
  );
}

export default ProjectDashboard;
