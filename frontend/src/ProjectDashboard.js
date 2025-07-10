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
import TariffSelector from './TariffSelector';
import TariffSummary from './TariffSummary';
import { API_URL } from './apiConfig'; // Adjust the import based on your project structure
import { Spinner, Alert } from 'react-bootstrap'; // Import Spinner and Alert for loading/error states

function ProjectDashboard() {
  const { id: projectId } = useParams();  // project_id from URL
  const [project, setProject] = useState(null);
  const [activeTab, setActiveTab] = useState('upload');
  const [currentStep, setCurrentStep] = useState(1); // Tracks quick design step
  const [quickDesignData, setQuickDesignData] = useState({
    consumption: '',
    tariff: '',
    consumerType: 'Residential', // Default to Residential, will be overridden by project data
    transformerSize: '',
    selectedProfileId: null,
    profileScaler: 1, // Default scaler
    selectedSystem: null,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchProject = async () => {
    setLoading(true);
    try {
      const projectRes = await axios.get(`${API_URL}/api/projects/${projectId}`);
      setProject(projectRes.data);
      // Set the consumerType based on project_type from the project
      setQuickDesignData(prevData => ({
          ...prevData,
          consumerType: projectRes.data.project_type || 'Residential'
      }));
      
      // Fetch existing quick design data
      const quickDesignRes = await axios.get(`${API_URL}/api/projects/${projectId}/quick_design`);
      if (quickDesignRes.data) {
          // If data exists, update our state with it
          setQuickDesignData(prevData => ({
              ...prevData,
              ...quickDesignRes.data,
              selectedSystem: quickDesignRes.data.selectedSystemConfigJson // map backend name to frontend name
          }));
      }
    } catch (err) {
      setError('Failed to load project data. Please try again.');
      console.error("Data loading error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProject();
  }, [projectId]);

  const handleTariffSave = async (tariffData) => {
      try {
          // Use the generic project update endpoint
          await axios.put(`${API_URL}/api/projects/${projectId}`, {
              tariff_id: tariffData.tariff_id,
              custom_flat_rate: tariffData.custom_flat_rate,
          });
          // Refresh the project data to get the latest state
          fetchProject();
          alert('Tariff updated successfully!');
      } catch (err) {
          alert('Failed to save tariff selection.');
          console.error(err);
      }
  };

  const handleQuickDesignTariffUpdate = (tariffData) => {
    setProject(prevProject => ({
      ...prevProject,
      tariff_id: tariffData.tariff_id,
      custom_flat_rate: tariffData.custom_flat_rate
    }));
  }


  const handleSaveAndNext = async (dataToSave, nextStep) => {
    try {
      const updatedData = { ...quickDesignData, ...dataToSave };
      setQuickDesignData(updatedData);

      // Call API to save the data to database
      await axios.post(`${API_URL}/api/projects/${projectId}/quick_design`, dataToSave);

      // Next step
      setCurrentStep(nextStep);
    } catch (err) {
      setError("Failed to save data. " + (err.response?.data?.error || err.message));
      console.error("Error saving data:", err);
    }
  };

  const handleBasicInfoSubmit = async (data) => {
    try {
      await axios.put(`${API_URL}/api/projects/${projectId}`, project);
      handleSaveAndNext(data, 2); // Move to next step after saving basic info
    } catch (err) {
      setError("Failed to save basic info. " + (err.response?.data?.error || err.message));
      console.error("Error saving basic info:", err);
    }
  }

  const handleProfileSelect = (profileWithScaler) => {
    const dataToSave = {
      selectedProfileId: profileWithScaler.id,
      profileScaler: profileWithScaler.scaler // Save the scaler
    };
    handleSaveAndNext(dataToSave, 3);
  };

  const handleSystemSelect = (system) => {
    const dataToSave = { 
      selectedSystem: system,
      selectedSystemConfigJson: system
    };
    handleSaveAndNext(dataToSave, 4);
  };

  const handleBack = (step) => {
    setCurrentStep(step);
  };

  if (loading) return <div className="text-center p-5"><Spinner animation="border" /></div>;
  if (error) return <div className="text-center p-5"><Alert variant="danger">{error}</Alert></div>;

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
            projectId={projectId} // Pass projectId
            savedData={quickDesignData} // Pass saved data
            onSubmit={handleBasicInfoSubmit}

            currentTariffId={project.tariff_id}
            currentCustomRate={project.custom_flat_rate}
            onTariffChange={handleQuickDesignTariffUpdate}
            tariffDetails={project.tariff_details}
            />
        )}
        {currentStep === 2 && (
          <ProfileSelection 
            projectId={projectId} // Pass projectId
            consumerType={quickDesignData.consumerType} // Pass consumer type
            basicInfo={quickDesignData} // Pass basic info
            savedData={quickDesignData} // Pass saved data
            onSelect={handleProfileSelect}
            onBack={() => handleBack(1)} // Back to Basic Info
          />
        )}
        {currentStep === 3 && (
          <SystemSelection 
            projectId={projectId} // Pass projectId
            savedData={quickDesignData} // Pass saved data
            onSelect={handleSystemSelect}
            onBack={() => handleBack(2)} // Back to Profile Selection
          />
        )}
        {currentStep === 4 && (
          <QuickResults
            projectId={projectId}
            basicInfo={quickDesignData}
            selectedSystem={quickDesignData.selectedSystem}
            clientName={project?.client_name}
            onBack={() => handleBack(3)} // Back to System Selection
          />
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
          <button className={`nav-link ${activeTab === 'tariff' ? 'active' : ''}`} onClick={() => setActiveTab('tariff')}>Tariff</button>
        </li>
        <li className="nav-item">
          <button className={`nav-link ${activeTab === 'report' ? 'active' : ''}`} onClick={() => setActiveTab('report')}>Reporting</button>
        </li>
      </ul>

      <div className="tab-content mt-4">
        {activeTab === 'upload' && <EnergyDataUpload projectId={projectId} />}
        {activeTab === 'analysis' && <EnergyAnalysis projectId={projectId} />}
        {activeTab === 'design' && <SystemDesign projectId={projectId} />}
        {activeTab === 'finance' && <FinancialModeling projectId={projectId} />}
        {activeTab === 'tariff' && (
          <div>
            <TariffSummary
              tariff={project.tariff_details}
              customRate={project.custom_flat_rate}
            />
            
            <TariffSelector 
              currentTariffId={project.tarrif_id}
              currentCustomRate={project.custom_flat_rate}
              onChange={handleTariffSave} // Pass the save handler
            />
          </div>
        )}
        {activeTab === 'optimize' && <Optimize projectId={projectId} />}
        {activeTab === 'report' && <Reporting projectId={projectId} />}
      </div>
    </div>
  );
}

export default ProjectDashboard;
