import React, { useState, useEffect } from 'react';
import CoverPage from './sections/CoverPage';
import ExecutiveSummary from './sections/ExecutiveSummary'; 
import DesignReportMeta from './sections/DesignReportMeta';
// import ClientDetails from './sections/ClientDetails';
// import PerformanceCharts from './sections/PerformanceCharts';
// import BillOfMaterials from './sections/BillOfMaterials';
// import FinancialKPIs from './sections/FinancialKPIs';
// import CustomSection from './sections/CustomSection'; // If needed
import '../ReportBuilder.css';

function ReportBuilder({ projectId }) {
  // Track which sections to show
  const [sections, setSections] = useState({
    cover: true,
    clientDetails: true,
    performance: true,
    bom: true,
    financial: true,
    custom: false,
  });

  // Load all data once (simulation, financials, BOM, etc)
  const [data, setData] = useState(null);
  useEffect(() => {
    // Fetch from API using projectId...
  }, [projectId]);

  // Sidebar toggler
  const handleToggle = (sectionKey) => setSections(s => ({ ...s, [sectionKey]: !s[sectionKey] }));

  return (
    <div className="report-builder">
      <aside className="sidebar">
        <h4>Report Sections</h4>
        {Object.keys(sections).map(key => (
          <label key={key}>
            <input type="checkbox" checked={sections[key]} onChange={() => handleToggle(key)} />
            {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
          </label>
        ))}
        <button className="btn btn-primary" onClick={() => window.print()}>Export as PDF</button>
      </aside>
      <div className='orka-report-printarea'>
      <main className="report-content">
        {sections.cover && <CoverPage data={data} />}
        <ExecutiveSummary data={data} />
        <DesignReportMeta data={data} />
        {/* Uncomment these when implemented */}
        {/* {sections.clientDetails && <ClientDetails data={data} />}
        {sections.performance && <PerformanceCharts data={data} />}
        {sections.bom && <BillOfMaterials data={data} />}
        {sections.financial && <FinancialKPIs data={data} />}
        {sections.custom && <CustomSection data={data} />} */}
      </main>
      </div>
    </div>
  );
}
export default ReportBuilder;
