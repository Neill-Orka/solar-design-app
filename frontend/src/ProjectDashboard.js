import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import EnergyDataUpload from './EnergyDataUpload';
import EnergyAnalysis from './EnergyAnalysis';
import SystemDesign from './SystemDesign';
import BillOfMaterials from './BillOfMaterials';
import PrintableBOM from './PrintableBOM';
import FinancialModeling from './FinancialModeling';
import ReportBuilder from './components/ReportBuilder';
import Optimize from './Optimize';
import BasicInfoForm from './BasicInfoForm';
import ProfileSelection from './ProfileSelection';
import SystemSelection from './SystemSelection';
import QuickResults from './QuickResults';
import TariffSelector from './TariffSelector';
import TariffSummary from './TariffSummary';
import ProjectQuotes from './ProjectQuotes';
import { API_URL } from './apiConfig'; // Adjust the import based on your project structure
import { Spinner, Alert } from 'react-bootstrap'; // Import Spinner and Alert for loading/error states
import { useNotification } from './NotificationContext'; // Import notification context for user feedback

function ProjectDashboard() {
  const navigate = useNavigate();
  const { id: projectId } = useParams();  // project_id from URL
  const { showNotification } = useNotification();
  const [project, setProject] = useState(null);
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Initialize activeTab from URL or default to 'upload'
  const [activeTab, setActiveTab] = useState(() => {
    return searchParams.get('tab') || 'upload';
  });
  
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

  // Function to handle tab changes with URL updates
  const handleTabChange = (newTab) => {
    setActiveTab(newTab);
    // Update URL with new tab parameter
    const newSearchParams = new URLSearchParams(searchParams);
    newSearchParams.set('tab', newTab);
    setSearchParams(newSearchParams);
  };

  const openQuote = (docId) => {
    navigate(`/projects/${projectId}/quotes/${docId}?from=quotes`);
  };

  const fetchProject = useCallback(async () => {
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
  }, [projectId]);

  useEffect(() => {
    fetchProject();
  }, [fetchProject]);

  // Update activeTab when URL changes (e.g., back/forward browser navigation)
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab && tab !== activeTab) {
      setActiveTab(tab);
    }
  }, [searchParams, activeTab]);

  const handleTariffSave = async (tariffData) => {
      try {
          // Use the generic project update endpoint
          await axios.put(`${API_URL}/api/projects/${projectId}`, {
              tariff_id: tariffData.tariff_id,
              custom_flat_rate: tariffData.custom_flat_rate,
          });
          // Refresh the project data to get the latest state
          fetchProject();
          showNotification('Tariff updated successfully!', 'success');
      } catch (err) {
          showNotification('Failed to save tariff selection.', 'danger');
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


  // Quick Design: Wizard Flow
  if (project.design_type === 'Quick')
  {
    return(
      // MODIFIED: Apply page background and padding here
      <div className='min-vh-100 py-4 py-md-5' style={{ backgroundColor: '#f8f9fa' }}> 
        <div className="project-dashboard-container"> {/* Custom responsive container */}
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
    <div className="project-dashboard-container mt-5">
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
          <button className={`nav-link ${activeTab === 'upload' ? 'active' : ''}`} onClick={() => handleTabChange('upload')}>Energy Upload</button>
        </li>
        <li className="nav-item">
          <button className={`nav-link ${activeTab === 'analysis' ? 'active' : ''}`} onClick={() => handleTabChange('analysis')}>Energy Analysis</button>
        </li>
        <li className="nav-item">
          <button className={`nav-link ${activeTab === 'design' ? 'active' : ''}`} onClick={() => handleTabChange('design')}>System Design</button>
        </li>
        {/* <li className="nav-item">
          <button className={`nav-link ${activeTab === 'optimize' ? 'active' : ''}`} onClick={() => handleTabChange('optimize')}>Optimize System</button>
        </li> */}
        <li className="nav-item">
          <button className={`nav-link ${activeTab === 'bom' ? 'active' : ''}`} onClick={() => handleTabChange('bom')}>Bill of Materials</button>
        </li>        
        <li className="nav-item">
          <button 
            className="nav-link text-muted" 
            style={{ cursor: 'not-allowed', opacity: 0.6 }}
            disabled
            title="Use 'Export to PDF' button in Bill of Materials tab instead"
          >
            Print BOM
          </button>
        </li>
        <li className="nav-item">
          <button className={`nav-link ${activeTab === 'quotes' ? 'active' : ''}`} onClick={() => handleTabChange('quotes')}>Quotes</button>
        </li>        
        <li className="nav-item">
          <button className={`nav-link ${activeTab === 'tariff' ? 'active' : ''}`} onClick={() => handleTabChange('tariff')}>Tariff</button>
        </li>
        <li className="nav-item">
          <button className={`nav-link ${activeTab === 'finance' ? 'active' : ''}`} onClick={() => handleTabChange('finance')}>Financial Modeling</button>
        </li>
        <li className="nav-item">
          <button className={`nav-link ${activeTab === 'report' ? 'active' : ''}`} onClick={() => handleTabChange('report')}>Reporting</button>
        </li>
      </ul>

      <div className="tab-content mt-4">
        {activeTab === 'upload' && <EnergyDataUpload projectId={projectId} />}
        {activeTab === 'analysis' && <EnergyAnalysis projectId={projectId} />}
        {activeTab === 'design' && <SystemDesign projectId={projectId} />}
        {activeTab === 'bom' && (
          <BillOfMaterials 
            projectId={projectId} 
            onNavigateToPrintBom={() => handleTabChange('printbom')} 
            quoteContext={{
              docId: searchParams.get('quoteDoc'),
              number: searchParams.get('quoteNo'),
              fromVersion: searchParams.get('fromVersion'),
            }}  
          />
        )}
        {activeTab === 'printbom' && <PrintableBOM projectId={projectId} />}
        {activeTab === 'quotes' && <ProjectQuotes projectId={projectId} onOpenQuote={openQuote} />}
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
        {activeTab === 'report' && <ReportBuilder projectId={projectId} onNavigateToTab={handleTabChange} />}
      </div>
    </div>
  );
}

export default ProjectDashboard;
