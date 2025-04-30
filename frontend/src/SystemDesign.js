import React, { useState } from 'react';
import axios from 'axios';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
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
  const [panelKW, setPanelKW] = useState('');
  const [batteryKWh, setBatteryKWh] = useState('');
  const [systemType, setSystemType] = useState('grid');
  const [simulationData, setSimulationData] = useState(null);
  const [startDate, setStartDate] = useState(new Date('2025-01-01'));
  const [endDate, setEndDate] = useState(new Date('2025-01-07'));

  const handleSimulate = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post('http://localhost:5000/api/simulate', {
        project_id: parseInt(projectId),
        system: {
          panel_kw: parseFloat(panelKW),
          battery_kwh: systemType === 'grid' ? 0 : parseFloat(batteryKWh || 0),
          system_type: systemType
        }
      });
      setSimulationData(response.data);
    } catch (error) {
      console.error('Simulation error:', error);
      alert('Simulation failed. See console for details.');
    }
  };

  const filterByDateRange = (timestamps, values) => {
    return timestamps.map((t, i) => {
      const time = new Date(t);
      return (time >= startDate && time <= endDate) ? values[i] : null;
    }).filter((v) => v !== null);
  };

  const filterTimestamps = (timestamps) => {
    return timestamps.map(t => new Date(t))
      .filter(t => t >= startDate && t <= endDate)
      .map(t => t.toLocaleString());
  };

  const showFullYear = () => {
    setStartDate(new Date('2025-01-01'));
    setEndDate(new Date('2025-12-31'));
  };

  return (
    <div className="container">
      <h4>System Design</h4>
      <form onSubmit={handleSimulate} className="row g-3">
        <div className="col-md-4">
          <label className="form-label">Panel Size (kWp)</label>
          <input type="number" className="form-control" value={panelKW} onChange={(e) => setPanelKW(e.target.value)} step="0.1" required />
        </div>
        <div className="col-md-4">
          <label className="form-label">Battery Size (kWh)</label>
          <input type="number" className="form-control" value={batteryKWh} onChange={(e) => setBatteryKWh(e.target.value)} step="0.1" disabled={systemType === 'grid'} />
        </div>
        <div className="col-md-4">
          <label className="form-label">System Type</label>
          <select className="form-select" value={systemType} onChange={(e) => setSystemType(e.target.value)}>
            <option value="grid">Grid-Tied</option>
            <option value="hybrid">Hybrid</option>
            <option value="off-grid">Off-Grid</option>
          </select>
        </div>
        <div className="col-12">
          <button className="btn btn-success">Simulate</button>
        </div>
      </form>

      {simulationData && (
        <div className="mt-4">
          <div className="row mb-3">
            <div className="col-md-4">
              <label>Start Date</label>
              <DatePicker selected={startDate} onChange={setStartDate} className="form-control" dateFormat="yyyy-MM-dd" />
            </div>
            <div className="col-md-4">
              <label>End Date</label>
              <DatePicker selected={endDate} onChange={setEndDate} className="form-control" dateFormat="yyyy-MM-dd" />
            </div>
            <div className="col-md-4 d-flex align-items-end">
              <button className="btn btn-outline-secondary w-100" onClick={showFullYear}>Full Year</button>
            </div>
          </div>

          <Line
            data={{
              labels: filterTimestamps(simulationData.timestamps),
              datasets: [
                {
                  label: 'Demand (kW)',
                  data: filterByDateRange(simulationData.timestamps, simulationData.demand),
                  borderColor: 'red',
                  tension: 0.2,
                },
                {
                  label: 'Generation (kW)',
                  data: filterByDateRange(simulationData.timestamps, simulationData.generation),
                  borderColor: 'green',
                  tension: 0.2,
                },
                {
                  label: 'Battery SOC (%)',
                  data: filterByDateRange(simulationData.timestamps, simulationData.battery_soc),
                  borderColor: 'blue',
                  tension: 0.2,
                  yAxisID: 'y1'
                }
              ]
            }}
            options={{
              responsive: true,
              plugins: {
                legend: { position: 'top' },
                title: { display: true, text: 'System Simulation Results' }
              },
              scales: {
                y: {
                  title: { display: true, text: 'Power (kW)' },
                },
                y1: {
                  position: 'right',
                  title: { display: true, text: 'Battery SOC (%)' },
                  grid: { drawOnChartArea: false },
                  min: 0,
                  max: 100
                }
              }
            }}
          />
        </div>
      )}
    </div>
  );
}

export default SystemDesign;