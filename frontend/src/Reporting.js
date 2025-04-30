import React from 'react';

function Reporting({ projectId }) {
  return (
    <div>
      <h4>Reporting</h4>
      <p>Project ID: {projectId}</p>
      <p>This section will generate PDF reports and summaries for the current project.</p>
      {/* Future PDF generation and summary components go here */}
    </div>
  );
}

export default Reporting;
