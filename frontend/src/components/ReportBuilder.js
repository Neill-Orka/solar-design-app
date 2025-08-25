import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_URL } from '../apiConfig';
import { useNotification } from '../NotificationContext';
import CoverPage from './sections/CoverPage';
import ExecutiveSummary from './sections/ExecutiveSummary'; 
import DesignReportMeta from './sections/DesignReportMeta';
import MainReportContent from './sections/MainReportContent';
import BOMSection from './sections/BOMSection';
import '../ReportBuilder.css';

function ReportBuilder({ projectId, onNavigateToTab }) {
  const { showNotification } = useNotification();
  // Track which sections to show
  const [sections, setSections] = useState({
    cover: true,
    clientDetails: true,
    performance: true,
    bom: true,
    financial: true,
    custom: false,
    siteLayout: true,
  });

  // Load all data once (simulation, financials, BOM, etc)
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [siteLayoutImage, setSiteLayoutImage] = useState(null);
  const [missingData, setMissingData] = useState([]);

  // Check if required data is available
  const checkRequiredData = (data) => {
    const missing = [];
    
    // Check for simulation data
    if (!data?.simulation?.timestamps || data.simulation.timestamps.length === 0) {
      missing.push({
        type: 'simulation',
        title: 'System Simulation',
        tab: 'design',
        action: 'Go to System Design'
      });
    }
    
    // Check for financial data
    if (!data?.financials?.annual_savings && !data?.financials?.original_annual_cost && !data?.financials?.cost_comparison) {
      missing.push({
        type: 'financial',
        title: 'Financial Modeling',
        tab: 'finance',
        action: 'Go to Financial Modeling'
      });
    }
    
    return missing;
  };

  // Calculate dynamic page numbers
  const calculatePageCounts = () => {
    const pageCounts = {
      cover: 0, // Cover page doesn't count
      executiveSummary: 1,
      designReportMeta: 1,
      mainReportContent: 13, // Based on the StandardPage components I saw (pages 3-15)
      bomSection: sections.bom ? 1 : 0, // BOM can be multiple pages but starts with 1
    };
    
    let totalPages = Object.values(pageCounts).reduce((sum, count) => sum + count, 0);
    let currentPage = 1;
    
    return {
      totalPages,
      executiveSummary: { start: currentPage, count: pageCounts.executiveSummary },
      designReportMeta: { start: currentPage += pageCounts.executiveSummary, count: pageCounts.designReportMeta },
      mainReportContent: { start: currentPage += pageCounts.designReportMeta, count: pageCounts.mainReportContent },
      bomSection: { start: currentPage += pageCounts.mainReportContent, count: pageCounts.bomSection },
    };
  };

  const pageNumbers = calculatePageCounts();

  // Recalculate when sections change
  useEffect(() => {
    // This will trigger a re-render when sections change
  }, [sections]);

  // Component for displaying missing data warning
  const MissingDataWarning = ({ missingItems, onNavigateToTab }) => (
    <div className="missing-data-warning p-4 m-4">
      <div className="alert alert-info">
        <h5 className="alert-heading">
          <i className="bi bi-info-circle me-2"></i>
          Simulations Required
        </h5>
        <p className="mb-3">
          Please run the required simulations to generate the report:
        </p>
        
        <div className="missing-items">
          {missingItems.map((item, index) => (
            <div key={index} className="d-flex justify-content-between align-items-center mb-2 p-2 border rounded">
              <span>{item.title}</span>
              <button 
                className="btn btn-primary btn-sm"
                onClick={() => onNavigateToTab && onNavigateToTab(item.tab)}
              >
                {item.action}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  

  useEffect(() => {
    if (!projectId) return;

    setLoading(true);

    const simulationResults = JSON.parse(sessionStorage.getItem(`simulationData_${projectId}`) || '{}');
    const financialResults = JSON.parse(sessionStorage.getItem(`financialResult_${projectId}`) || '{}');

    // Only fetch the project endpoint that exists
    axios.get(`${API_URL}/api/projects/${projectId}`)
      .then((projectRes) => {
        const reportData = {
          project: projectRes.data,
          // Set empty placeholders for the data that would come from other endpoints
          simulation: simulationResults,
          financials: financialResults  
        };
        
        setData(reportData);
        
        // Check for missing required data
        const missing = checkRequiredData(reportData);
        setMissingData(missing);
        
        setLoading(false);
      })
      .catch(err => {
        console.error('Error loading report data:', err);
        showNotification('Error loading report data', 'error');
        setLoading(false);
      });
  }, [projectId, showNotification]);

  const handleImageUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setSiteLayoutImage(e.target.result);
        sessionStorage.setItem(`siteLayoutImage_${projectId}`, e.target.result);
      };
      reader.readAsDataURL(file);
    }
  };

  // Check if site layout image exists in sessionStorage
  useEffect(() => {
    if (projectId) {
      const savedImage = sessionStorage.getItem(`siteLayoutImage_${projectId}`);
      if (savedImage) {
        setSiteLayoutImage(savedImage);
      }
    }
  }, [projectId]);

  useEffect(() => {
    const saved = localStorage.getItem('report_sections');
    if (saved) {
      setSections((s) => ({ ...s, ...JSON.parse(saved) }));
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('report_sections', JSON.stringify(sections));
  }, [sections]);

  return (
      <div className="report-builder">

        <div className="section-controls no-print">
          <div className='section-toggle'>
            <label>
              <input 
                type="checkbox"
                checked={sections.siteLayout}
                onChange={() => setSections(s => ({ ...s, siteLayout: !s.siteLayout }))}
              />
              Show Site Layout
            </label>
            <label>
              <input 
                type="checkbox"
                checked={sections.bom}
                onChange={() => setSections(s => ({ ...s, bom: !s.bom }))}
              />
              Bill of Materials
            </label>
            <button className="export-btn" onClick={() => window.print()}>
              <span role="img" aria-label="Export">📄</span> Export as PDF
            </button>
            {sections.siteLayout && (
              <div className='image-upload mt-2'>
                <label htmlFor='site-layout-image' className='btn btn-sm btn-outline-secondary'>
                  {siteLayoutImage ? 'Change Layout Image' : 'Upload Layout Image'}
                </label>
                <input 
                  id='site-layout-image'
                  type='file'
                  accept='image/*'
                  style={{ display: 'none' }}
                  onChange={handleImageUpload}
                />
              </div>
            )}
          </div>
        </div>

        {/* REPORT CONTENT */}
        <main className="orka-report-printarea report-content">
          {loading ? (
            <div className="loading-spinner">Loading report data...</div>
          ) : missingData.length > 0 ? (
            <MissingDataWarning missingItems={missingData} onNavigateToTab={onNavigateToTab} />
          ) : (
            <>
              {sections.cover && <CoverPage data={data} />}
              <ExecutiveSummary data={data} pageNumber={pageNumbers.executiveSummary.start} totalPages={pageNumbers.totalPages} />
              {/* <DesignReportMeta data={data} pageNumber={pageNumbers.designReportMeta.start} totalPages={pageNumbers.totalPages} /> */}
              <MainReportContent 
                data={data} 
                showSiteLayout={sections.siteLayout} 
                siteLayoutImage={siteLayoutImage}
                startPageNumber={pageNumbers.mainReportContent.start}
                totalPages={pageNumbers.totalPages}
              />
              {sections.bom && <BOMSection data={data} startPageNumber={pageNumbers.bomSection.start} totalPages={pageNumbers.totalPages} />}
            </>
          )}
        </main>
      </div>
  );
}

export default ReportBuilder;
