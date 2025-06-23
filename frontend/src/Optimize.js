// Optimize.js
import React, { useState } from 'react';
import axios from 'axios';
import { API_URL } from './apiConfig'; // Adjust the import based on your project structure

function Optimize({ projectId }) {
  const [systemType, setSystemType] = useState("grid");
  const [roofKw, setRoofKw]         = useState(100);
  const [running, setRunning]       = useState(false);
  const [result, setResult]         = useState(null);
  const [eskomTariff, setEskomTariff] = useState(0);
  const [feedInTariff, setFeedInTariff] = useState(0);
  const [allowExport, setAllowExport] = useState(false);
  const [samples, setSamples] = useState([]);

  const runOptimize = () => {
    setRunning(true);
    axios.post(`${API_URL}/api/optimize`, {
      project_id: projectId,
      system_type: systemType,
      roof_kw_limit: parseFloat(roofKw),
      tariff: eskomTariff,
      feed_in_tariff: feedInTariff,
      export_enabled: allowExport,
      sample_size : 10
    })
    .then(r => {
      setResult(r.data.best);
      setSamples(r.data.samples);
    })
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
        <div className="col-md-3">
          <label className="form-label">Allow Export?</label><br/>
          <input type="checkbox"
            checked={allowExport}
            onChange={e => setAllowExport(e.target.checked)} />
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
            <li><strong>Total System Cost:</strong> R{result.capex.toFixed(0)}</li>
            <li><strong>Annual Savings:</strong> R{result.annual_savings.toFixed(0)}</li>
            <li><strong>Payback:</strong> {result.payback_years.toFixed(1)} years</li>
          </ul>
        </div>
      )}

     {samples.length > 0 && (
       <div className="mt-4">
         <h6>Sample of Designs Tried</h6>
         <table className="table table-sm">
           <thead>
             <tr>
               <th>kWp</th><th>Inverter</th><th>Bat (kWh)</th>
               <th>Capex (R)</th><th>Payback (yr)</th>
             </tr>
           </thead>
           <tbody>
             {samples.map((s,i) => (
               <tr key={i}>
                 <td>{s.kwp}</td>
                 <td>{s.inv_model}</td>
                 <td>{s.bat_kwh}</td>
                 <td>{s.capex.toFixed(0)}</td>
                 <td>{s.payback_years.toFixed(1)}</td>
               </tr>
             ))}
           </tbody>
         </table>
       </div>
     )}      

    </div>
  );
}

export default Optimize;
