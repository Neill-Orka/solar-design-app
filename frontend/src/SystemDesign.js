import React, { useState } from 'react';
import axios from 'axios';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

function SystemDesign({ projectId }) {
  const [systemType, setSystemType] = useState('grid');
  const [panelKw, setPanelKw] = useState('');
  const [batteryKwh, setBatteryKwh] = useState('');
  const [inverterKva, setInverterKva] = useState('');
  const [allowExport, setAllowExport] = useState(false);
  const [simulationData, setSimulationData] = useState(null);
  const [startDate, setStartDate] = useState('2025-01-01');
  const [endDate, setEndDate] = useState('2025-12-31');
  const [loading, setLoading] = useState(false);
  const [tariff, setTariff] = useState(2.2);
  const [feedInTariff, setFeedInTariff] = useState(1.0);

  const handleSimulate = () => {
    setLoading(true);
    axios.post('http://localhost:5000/api/simulate', {
      project_id: projectId,
      system: {
        panel_kw: parseFloat(panelKw),
        battery_kwh: parseFloat(batteryKwh),
        system_type: systemType,
        inverter_kva: parseFloat(inverterKva),
        allow_export: allowExport
      }
    })
    .then(res => {
      console.log('Simulation result:', res.data);
      if (!res.data.timestamps) {
        alert('Simulation did not return expected data');
        return;
      }
      setSimulationData(res.data);
      setLoading(false);
    })
    .catch(err => {
      console.error('Simulation error:', err);
      alert('Simulation failed. See console for details');
      setLoading(false);
    });
  };

  const handleOptimize = () => {
    setLoading(true);
    axios.post('http://localhost:5000/api/optimize', {
      project_id: projectId,
      tariff: tariff,
      export_enabled: allowExport,
      feed_in_tariff: feedInTariff
    })
    .then(res => {
      setLoading(false);
      if (res.data.error) {
        alert("Optimization failed: " + res.data.error);
        return;
      }
      const config = res.data.best_config;
      setPanelKw(config.panel_kw);
      setBatteryKwh(config.battery_kwh);
      setInverterKva(config.inverter_kva);
      alert("Optimal configuration loaded. You can now run a simulation.");
    })
    .catch(err => {
      console.error('Optimizer error:', err);
      alert('Optimizer failed. See console for details');
      setLoading(false);
    });
  };

  const filterData = () => {
    if (!simulationData || !simulationData.timestamps) return null;
    if (!startDate && !endDate) return simulationData;

    const start = new Date(startDate);
    const end = new Date(endDate);
    const filtered = {
      timestamps: [],
      demand: [],
      generation: [],
      battery_soc: [],
      import_from_grid: [],
      export_to_grid: []
    };

    simulationData.timestamps.forEach((ts, i) => {
      const date = new Date(ts);
      if ((!startDate || date >= start) && (!endDate || date <= end)) {
        filtered.timestamps.push(ts);
        filtered.demand.push(simulationData.demand[i]);
        filtered.generation.push(simulationData.generation[i]);
        filtered.battery_soc.push(simulationData.battery_soc[i]);
        filtered.import_from_grid.push(simulationData.import_from_grid[i]);
        filtered.export_to_grid.push(simulationData.export_to_grid[i]);
      }
    });
    return filtered;
  };

  const filtered = filterData();

  return (
    <div className="container">
      <h4>System Design</h4>

      <div className="row g-3 mb-3">
        <div className="col-md-3">
          <label className="form-label">System Type</label>
          <select className="form-select" value={systemType} onChange={e => setSystemType(e.target.value)}>
            <option value="grid">Grid-tied</option>
            <option value="hybrid">Hybrid</option>
            <option value="off-grid">Off-grid</option>
          </select>
        </div>

        <div className="col-md-3">
          <label className="form-label">Panel Size (kWp)</label>
          <input type="number" className="form-control" value={panelKw} onChange={e => setPanelKw(e.target.value)} />
        </div>

        <div className="col-md-3">
          <label className="form-label">Battery Size (kWh)</label>
          <input type="number" className="form-control" value={batteryKwh} onChange={e => setBatteryKwh(e.target.value)} disabled={systemType === 'grid'} />
        </div>

        <div className="col-md-3">
          <label className="form-label">Inverter Size (kVA)</label>
          <input type="number" className="form-control" value={inverterKva} onChange={e => setInverterKva(e.target.value)} />
        </div>

        <div className="col-md-3">
          <label className="form-label">Start Date</label>
          <input type="date" className="form-control" value={startDate} onChange={e => setStartDate(e.target.value)} />
        </div>

        <div className="col-md-3">
          <label className="form-label">End Date</label>
          <input type="date" className="form-control" value={endDate} onChange={e => setEndDate(e.target.value)} />
        </div>

        <div className="col-md-3">
          <label className="form-label">Allow Grid Export?</label>
          <div className="form-check">
            <input className="form-check-input" type="checkbox" checked={allowExport} onChange={() => setAllowExport(!allowExport)} />
            <label className="form-check-label">Yes</label>
          </div>
        </div>

        <div className="col-md-3">
          <label className="form-label">Eskom Tariff (R/kWh)</label>
          <input type="number" className="form-control" value={tariff} onChange={e => setTariff(e.target.value)} step="0.01" />
        </div>

        <div className="col-md-3">
          <label className="form-label">Feed-in Tariff (R/kWh)</label>
          <input type="number" className="form-control" value={feedInTariff} onChange={e => setFeedInTariff(e.target.value)} step="0.01" disabled={!allowExport} />
        </div>

        <div className="col-md-3 d-flex align-items-end gap-2">
          <button className="btn btn-primary" onClick={handleSimulate} disabled={loading}>
            {loading ? 'Simulating...' : 'Simulate'}
          </button>
          <button className="btn btn-success" onClick={handleOptimize} disabled={loading}>
            {loading ? 'Optimizing...' : 'Optimize System'}
          </button>
        </div>
      </div>

      {filtered && (
        <Line
          data={{
            labels: filtered.timestamps,
            datasets: [
              { label: 'Demand (kW)', data: filtered.demand, borderColor: 'red', borderWidth: 2, tension: 0.3, pointRadius: 0 },
              { label: 'Generation (kW)', data: filtered.generation, borderColor: 'green', borderWidth: 2, tension: 0.3, pointRadius: 0 },
              { label: 'Battery SOC (%)', data: filtered.battery_soc, borderColor: 'orange', borderWidth: 2, tension: 0.3, pointRadius: 0 },
              { label: 'Grid Import (kW)', data: filtered.import_from_grid, borderColor: 'blue', borderWidth: 2, tension: 0.3, pointRadius: 0 },
              allowExport && {
                label: 'Grid Export (kW)',
                data: filtered.export_to_grid,
                borderColor: 'purple',
                borderWidth: 2,
                tension: 0.3,
                pointRadius: 0
              }
            ].filter(Boolean)
          }}
          options={{
            responsive: true,
            plugins: {
              title: {
                display: true,
                text: 'System Simulation (filtered)'
              },
              legend: {
                display: true,
                position: 'bottom'
              }
            },
            elements: {
              line: {
                tension: 0.3
              }
            },
            scales: {
              y: {
                beginAtZero: true,
                title: {
                  display: true,
                  text: 'Power (kW) / SOC (%)'
                }
              },
              x: {
                ticks: { maxTicksLimit: 20 },
                title: {
                  display: true,
                  text: 'Timestamp'
                }
              }
            }
          }}
        />
      )}
    </div>
  );
}

export default SystemDesign;
