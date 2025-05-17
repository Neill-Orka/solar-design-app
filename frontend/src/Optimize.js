// Optimize.js
import React, { useState } from 'react';
import axios from 'axios';

function Optimize({ projectId }) {
  const [systemType, setSystemType] = useState("grid");
  const [roofKw, setRoofKw]         = useState(100);
  const [running, setRunning]       = useState(false);
  const [result, setResult]         = useState(null);

  const runOptimize = () => {
    setRunning(true);
    axios.post("http://localhost:5000/api/optimize", {
      project_id: projectId,
      system_type: systemType,
      roof_kw_limit: parseFloat(roofKw)
    })
    .then(r => setResult(r.data))
    .finally(() => setRunning(false));
  };

  return (
    <div className="container">
      <h4>Automatic System Optimizer</h4>

      <div className="row g-3 mb-3">
        <div className="col-md-3">
          <label className="form-label">System Type</label>
          <select className="form-select"
                  value={systemType}
                  onChange={e => setSystemType(e.target.value)}>
            <option value="grid">Grid-tied</option>
            <option value="hybrid">Hybrid</option>
            <option value="off-grid">Off-grid</option>
          </select>
        </div>
        <div className="col-md-3">
          <label className="form-label">Roof Limit (kWp)</label>
          <input type="number" className="form-control"
                 value={roofKw}
                 onChange={e => setRoofKw(e.target.value)} />
        </div>
        <div className="col-md-12">
          <button className="btn btn-primary" onClick={runOptimize}
                  disabled={running}>
            {running ? "Running…" : "Run Optimizer"}
          </button>
        </div>
      </div>

      {result && (
        <div className="alert alert-success">
          <h5 className="mb-1">Suggested Design</h5>
          <ul className="mb-0">
            <li><strong>Panels:</strong> {result.kwp} kWp</li>
            <li><strong>Inverter:</strong> {result.inv_model || '-'}</li>
            <li><strong>Battery:</strong> {result.bat_kwh} kWh</li>
            <li><strong>Capex:</strong> R{result.capex.toFixed(0)}</li>
            <li><strong>Total System Cost:</strong> R{result.capex.toFixed(0)}</li>
            <li><strong>Payback:</strong> {result.payback_years?.toFixed(1)} years</li>
          </ul>
        </div>
      )}
    </div>
  );
}

export default Optimize;
