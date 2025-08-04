import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_URL } from '../apiConfig';
import { useNotification } from '../NotificationContext';
import CoverPage from './sections/CoverPage';
import ExecutiveSummary from './sections/ExecutiveSummary'; 
import DesignReportMeta from './sections/DesignReportMeta';
import MainReportContent from './sections/MainReportContent';
// import TableOfContents from './sections/TableOfContents';
// import ClientDetails from './sections/ClientDetails';
// import PerformanceCharts from './sections/PerformanceCharts';
// import BillOfMaterials from './sections/BillOfMaterials';
// import FinancialKPIs from './sections/FinancialKPIs';
// import CustomSection from './sections/CustomSection'; // If needed
import '../ReportBuilder.css';

function ReportBuilder({ projectId }) {
  const { showNotification } = useNotification();
  // Track which sections to show
  const [sections, setSections] = useState({
    cover: true,
    clientDetails: true,
    performance: true,
    bom: true,
    financial: true,
    custom: false,
    siteLayout: false,
  });

  // Load all data once (simulation, financials, BOM, etc)
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [siteLayoutImage, setSiteLayoutImage] = useState(null);

  useEffect(() => {
    if (!projectId) return;

    setLoading(true);

    const simulationResults = JSON.parse(sessionStorage.getItem(`simulationData_${projectId}`) || '{}');
    const financialResults = JSON.parse(sessionStorage.getItem(`financialResult_${projectId}`) || '{}');

    // Only fetch the project endpoint that exists
    axios.get(`${API_URL}/api/projects/${projectId}`)
      .then((projectRes) => {
        setData({
          project: projectRes.data,
          // Set empty placeholders for the data that would come from other endpoints
          simulation: simulationResults,
          financials: financialResults  
        });
        setLoading(false);
      })
      .catch(err => {
        console.error('Error loading report data:', err);
        showNotification('Error loading report data', 'error');
        setLoading(false);
      });



  }, [projectId, showNotification]);


  // Sidebar toggler
  const handleToggle = (sectionKey) => setSections(s => ({ ...s, [sectionKey]: !s[sectionKey] }));

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

  return (
    <div className="report-builder">

      {/* PRINT CONTROL BUTTON */}
      <div className="print-controls">
        <button className="export-btn" onClick={() => window.print()}>
          <span role="img" aria-label="Export">📄</span> Export as PDF
        </button>
      </div>

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
        ) : (
          <>
            {sections.cover && <CoverPage data={data} />}
            <ExecutiveSummary data={data} />
            <DesignReportMeta data={data} />
            <MainReportContent data={data} showSiteLayout={sections.siteLayout} siteLayoutImage={siteLayoutImage}/>
            {/* ... other sections */}
          </>
        )}
      </main>

    </div>
  );
}

export default ReportBuilder;
