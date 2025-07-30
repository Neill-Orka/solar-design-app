import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Tooltip,
  Legend
} from 'chart.js';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { API_URL } from './apiConfig';
import './DetailedReport.css';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Tooltip, Legend);

function DetailedReport({ projectId }) {
  const [project, setProject] = useState(null);
  const [simulation, setSimulation] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [sections, setSections] = useState({
    executiveSummary: true,
    simulationCharts: true,
    roofImages: true,
    billOfMaterials: true,
  });

  useEffect(() => {
    axios.get(`${API_URL}/api/projects/${projectId}`)
      .then(res => setProject(res.data))
      .catch(() => {});

    const cached = sessionStorage.getItem(`simulationData_${projectId}`);
    if (cached) {
      try { setSimulation(JSON.parse(cached)); } catch(e) {}
    }
  }, [projectId]);

  useEffect(() => {
    if (simulation?.timestamps?.length && !selectedDate) {
      setSelectedDate(new Date(simulation.timestamps[0]));
    }
  }, [simulation, selectedDate]);

  const dailyChartData = useMemo(() => {
    if (!simulation || !selectedDate) return { labels: [], datasets: [] };
    const dayStr = selectedDate.toDateString();
    const start = simulation.timestamps.findIndex(t => new Date(t).toDateString() === dayStr);
    if (start === -1) return { labels: [], datasets: [] };
    const end = start + 48;
    const labels = simulation.timestamps.slice(start, end).map(t => new Date(t));
    return {
      labels,
      datasets: [
        {
          label: 'Load (kW)',
          data: simulation.demand.slice(start, end),
          borderColor: 'red',
          pointRadius: 0,
          tension: 0.3
        },
        {
          label: 'PV Generation (kW)',
          data: simulation.generation.slice(start, end),
          borderColor: 'green',
          pointRadius: 0,
          tension: 0.3
        }
      ]
    };
  }, [simulation, selectedDate]);

  const toggleSection = name => setSections(prev => ({ ...prev, [name]: !prev[name] }));

  const minDate = simulation?.timestamps?.length ? new Date(simulation.timestamps[0]) : null;
  const maxDate = simulation?.timestamps?.length ? new Date(simulation.timestamps[simulation.timestamps.length - 1]) : null;

  return (
    <div className="detailed-report container">
      <h2>Detailed Design Report</h2>

      <div className="no-print mb-3">
        {Object.keys(sections).map(key => (
          <div key={key} className="form-check form-check-inline">
            <input
              className="form-check-input"
              type="checkbox"
              id={key}
              checked={sections[key]}
              onChange={() => toggleSection(key)}
            />
            <label className="form-check-label" htmlFor={key}>
              {key.replace(/([A-Z])/g, ' $1')}
            </label>
          </div>
        ))}
      </div>

      {project && (
        <div className="project-info mb-4">
          <h5>{project.name}</h5>
          <p>
            <strong>Client:</strong> {project.client_name}<br />
            <strong>Location:</strong> {project.location}
          </p>
        </div>
      )}

      {sections.executiveSummary && project && (
        <div className="executive-summary mb-4">
          <h3>Executive Summary</h3>
          <p>Project value: R {project.project_value_excl_vat?.toLocaleString()}</p>
        </div>
      )}

      {sections.simulationCharts && simulation && (
        <div className="simulation-section mb-4">
          <div className="d-flex justify-content-between align-items-center">
            <h3>Simulation Charts</h3>
            <DatePicker
              selected={selectedDate}
              onChange={setSelectedDate}
              minDate={minDate}
              maxDate={maxDate}
              className="form-control form-control-sm no-print"
            />
          </div>
          <div style={{ height: '300px' }}>
            <Line data={dailyChartData} options={{ responsive: true, maintainAspectRatio: false }} />
          </div>
        </div>
      )}

      {sections.billOfMaterials && project && (
        <div className="bom-section mb-4">
          <h3>Bill of Materials</h3>
          <ul>
            <li>PV Modules: {project.panel_kw} kWp</li>
            <li>
              Inverter: {typeof project.inverter_kva === 'object'
                ? `${project.inverter_kva.capacity} kVA x${project.inverter_kva.quantity}`
                : `${project.inverter_kva} kVA`}
            </li>
            {project.battery_kwh && project.system_type !== 'grid' && (
              <li>
                Battery: {typeof project.battery_kwh === 'object'
                  ? `${project.battery_kwh.capacity} kWh x${project.battery_kwh.quantity}`
                  : `${project.battery_kwh} kWh`}
              </li>
            )}
          </ul>
        </div>
      )}

      <div className="no-print text-center mb-5">
        <button className="btn btn-primary" onClick={() => window.print()}>
          Print / Save PDF
        </button>
      </div>
    </div>
  );
}

export default DetailedReport;
