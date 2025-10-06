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
  const [sidebarOpen, setSidebarOpen] = useState(true);
  useEffect(() => {
    if (window.matchMedia('(max-width: 992px)').matches) {
      setSidebarOpen(false);
    }
  }, []);

  const [products, setProducts] = useState([])

  useEffect(() => {
    axios.get(`${API_URL}/api/products`).then(res => {
      setProducts(res.data);
      console.log("REPORT BUILDER: products loaded = ", res.data);
    });
  }, []);


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

  const [reportSettings, setReportSettings] = useState({
    usedActualConsumption: false,
    threePhase: true,
    bomPriceMode: 'none',
    projectSchedule: [
      { activity: "Deposit received & document compilation", timeline: "Week 1" },
      { activity: "Equipment procurement & delivery", timeline: "Week 2 (provided no major supplier delays)" },
      { activity: "Construction & installation", timeline: "Week 2-4" },
      { activity: "Commissioning", timeline: "Week 5" },
      { activity: "Training", timeline: "Week 5" },
      { activity: "Handover", timeline: "Week 6" }
    ]
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
        const project = projectRes.data;
        console.log('Project data loaded:', project);

        // --- Add inverter and battery brand/model from products ---
        const getBrandModel = (products, ids, category) => {
          if (!Array.isArray(ids) || !products) return "";
          const prod = products.find(p => ids.includes(p.id) && p.category === category);
          return prod ? `${prod.brand}` : "";
        };

        const getNominalRating = (products, ids, category) => {
          if (!Array.isArray(ids) || !products) return '';
          const prod = products.find(p => ids.includes(p.id) && p.category === category);
          return prod ? prod.nominal_rating_kwh : '';
        }

        project.inverter_brand_model = getBrandModel(products, project.inverter_ids, 'Inverter');
        project.battery_brand_model = getBrandModel(products, project.battery_ids, 'Battery');

        project.battery_nominal_rating = Number(getNominalRating(products, project.battery_ids, 'Battery') * project.battery_kwh.quantity).toFixed(2);
     
        
        const reportData = {
          project,
          // Set empty placeholders for the data that would come from other endpoints
          simulation: simulationResults,
          financials: financialResults,
          products: products,
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
  }, [projectId, showNotification, products]);

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
      <div className={`report-builder ${sidebarOpen ? 'sidebar-open' : ''}`}>

        <div className="section-controls no-print">
          <div className='section-toggle'>
            <label>
              <input 
                type="checkbox"
                checked={reportSettings.usedActualConsumption}
                onChange={() => setReportSettings(prev => ({ ...prev, usedActualConsumption: !prev.usedActualConsumption }))}
              />
              Actual data used for sim?
            </label>            
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
            <label>
              <input 
                type="checkbox"
                checked={sections.bom}
                onChange={() => setSections(s => ({ ...s, bom: !s.bom }))}
              />
              Bill of Materials
            </label>
            <label>
              <input 
                type="checkbox"
                checked={reportSettings.threePhase}
                onChange={() => setReportSettings(prev => ({ ...prev, threePhase: !prev.threePhase }))}
              />
              Three Phase?
            </label>  
            
            <div>
              Adjust Project Schedule
              {reportSettings.projectSchedule.map((item, index) => (
                <div key={index}>
                  <label>{item.activity}</label>
                  <input
                    type="text"
                    value={item.timeline}
                    onChange={(e) => {
                      const newSchedule = [...reportSettings.projectSchedule];
                      newSchedule[index].timeline = e.target.value;
                      setReportSettings(prev => ({
                        ...prev,
                        projectSchedule: newSchedule
                      }));
                    }}
                  />
                </div>
              ))}
            </div>
            <label style={{display:'flex',gap:'6px',alignItems:'center',marginTop:8}}>
              <span style={{minWidth:115}}>BOM prices:</span>
              <select
                value={reportSettings.bomPriceMode}
                onChange={(e)=>setReportSettings(prev=>({...prev,bomPriceMode:e.target.value}))}
              >
                <option value="none">Hide all</option>
                <option value="category">Category totals only</option>
                <option value="line">Line-item prices</option>
              </select>
            </label>            
            
          </div>
        </div>
        <button className="orka-sidebar-export-btn" onClick={() => window.print()}>
          <span role="img" aria-label="Export">📄</span> Export as PDF
        </button>  

        {/* <div className='orka-sidebar-scrim' onClick={() => setSidebarOpen(false)} />
        <button className="orka-sidebar-toggle no-print" onClick={() => setSidebarOpen(v => !v)} aria-label="Toggle sidebar">☰</button> */}


        {/* REPORT CONTENT */}
        <main className="orka-report-printarea report-content">
          {loading ? (
            <div className="loading-spinner">Loading report data...</div>
          ) : missingData.length > 0 ? (
            <MissingDataWarning missingItems={missingData} onNavigateToTab={onNavigateToTab} />
          ) : (
            <>
              {sections.cover && <CoverPage data={data} />}
              <ExecutiveSummary data={data} settings={reportSettings} pageNumber={pageNumbers.executiveSummary.start} totalPages={pageNumbers.totalPages} />
              {/* <DesignReportMeta data={data} pageNumber={pageNumbers.designReportMeta.start} totalPages={pageNumbers.totalPages} /> */}
              <MainReportContent 
                data={data}
                settings={reportSettings}
                showSiteLayout={sections.siteLayout} 
                siteLayoutImage={siteLayoutImage}
                startPageNumber={pageNumbers.mainReportContent.start}
                totalPages={pageNumbers.totalPages}
              />
              {sections.bom && <BOMSection data={data} settings={reportSettings} startPageNumber={pageNumbers.bomSection.start} totalPages={pageNumbers.totalPages} />}
            </>
          )}
        </main>
      </div>
  );
}

export default ReportBuilder;
