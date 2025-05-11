import React, { useState , useEffect} from 'react';
import axios from 'axios';
import { Line } from 'react-chartjs-2';
import Modal from 'react-bootstrap/Modal';
import Button from 'react-bootstrap/Button';
import Select from 'react-select'
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
import Form from 'react-bootstrap/Form';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

function SystemDesign({ projectId }) {
  // ---- state ---------------------------------------------------
  const [systemType, setSystemType] = useState('grid');
  const [panelKw, setPanelKw] = useState('');
  const [batteryKwh, setBatteryKwh] = useState('');
  const [inverterKva, setInverterKva] = useState('');
  const [selectedInvOpt, setSelectedInvOpt] = useState(null);
  const [inverters, setInverters] = useState([]);
  useEffect(() => {
    axios.get('http://localhost:5000/api/products?category=inverter')
      .then(r => {
        setInverters(r.data);
      });
  }, []);
  const [simulationData, setSimulationData] = useState(null);
  const [startDate, setStartDate] = useState('2025-01-01');
  const [endDate, setEndDate] = useState('2025-12-31');
  const [loading, setLoading] = useState(false);
  const [allowExport, setAllowExport] = useState(false);
  const [showDateModal, setShowDateModal] = useState(false);

  // pull saved values when component mounts
  useEffect (() => {
    axios.get(`http://localhost:5000/api/projects/${projectId}`)
    .then(res => {
      const p = res.data;
      if (!p) return;
      setSystemType(p.system_type || 'grid');
      setPanelKw(p.panel_kw ?? '');
      setBatteryKwh(p.battery_kwh ?? '');
      setInverterKva(p.inverter_kva ?? ''); 
    })
    .catch(err => console.error('Load project error:', err));
  }, [projectId]);

  useEffect(() => {
  const today = new Date();
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(today.getDate() - 30);
  setStartDate(thirtyDaysAgo.toISOString().slice(0, 10));
  setEndDate(today.toISOString().slice(0, 10));
  }, []);


  // --- helpers ---------------------------------------------------
  const saveProject = () => {
    axios.put(`http://localhost:5000/api/projects/${projectId}`, {
      system_type: systemType,
      panel_kw : parseFloat(panelKw),
      battery_kwh: systemType === 'grid' ? 0 : parseFloat(batteryKwh),
      inverter_kva: parseFloat(inverterKva)
    })
    .then(() => alert('System saved to project 👍'))
    .catch(err => {
      console.error('Save error:', err.response?.data || err.message);
      alert('Could not save the system.');
    });
  };

  const handleSimulate = () => {
    setLoading(true);
    axios.post('http://localhost:5000/api/simulate', {
      project_id: projectId,
      system: {
        panel_kw: parseFloat(panelKw),
        system_type: systemType,
        battery_kwh: systemType === 'grid' ? 0 : parseFloat(batteryKwh),
        inverter_kva: parseFloat(inverterKva),
        allow_export: allowExport
      }
    })
    .then(res => {
      console.log('RAW simulate response:', res.data);
      if (!res.data.timestamps) {
        alert('Simulation did not return expected data');
        return;
      }
      setSimulationData(res.data);
    })
    .catch(err => {
      console.error('Simulation error: ', err);
      alert('Simulation failed. See console for details');
    })
    .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!inverters.length || !inverterKva) return;
    const opt = inverters
      .map(inv => ({
        value: inv.rating_kva,
        label: `${inv.brand} ${inv.model} (${inv.rating_kva} kVA)`
      }))
      .find(o => o.value === inverterKva);
    setSelectedInvOpt(opt || null);
  }, [inverters, inverterKva]);

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
        {/* system type */}
        <div className="col-md-3">
          <label className="form-label">System Type</label>
          <select className="form-select" value={systemType}
                  onChange={e => setSystemType(e.target.value)}>
            <option value="grid">Grid‑tied</option>
            <option value="hybrid">Hybrid</option>
            <option value="off-grid">Off‑grid</option>
          </select>
          <div className='form-check mt-2'>
            <input
              className="form-check-input"
              type="checkbox"
              checked={allowExport}
              onChange={e => setAllowExport(e.target.checked)}
              id="allow_export"
            />
            <label className="form-check-label" htmlFor="allow_export">
              Allow export to grid
            </label>
          </div>
        </div>
    
        {/* kWp, kVA, kWh */}
        <div className="col-md-3">
          <label className="form-label">Panel Size (kWp)</label>
          <input type="number" className="form-control"
                 value={panelKw} onChange={e => setPanelKw(e.target.value)} />
        </div>
    
        <div className="col-md-3">
          <Form.Label>Inverter</Form.Label>
          <Select
            options={inverters.map(inv => ({
              value: inv.rating_kva,
              label: `${inv.brand} ${inv.model} (${inv.rating_kva} kVA)`
            }))}
            value={selectedInvOpt}
            onChange={opt => {
              setSelectedInvOpt(opt);
              setInverterKva(opt ? opt.value : '');
            }}
            isClearable
          />
        </div>
          
        <div className="col-md-3">
          <label className="form-label">Battery Size (kWh)</label>
          <input type="number" className="form-control"
                 value={batteryKwh} onChange={e => setBatteryKwh(e.target.value)}
                 disabled={systemType === 'grid'} />
        </div>
          
        {/* buttons */}
        <div className="col-md-6 d-flex align-items-end gap-2">
          <button className="btn btn-secondary" onClick={saveProject}>
            Save System
          </button>
          <button className="btn btn-primary" onClick={handleSimulate} disabled={loading}>
            {loading ? 'Simulating…' : 'Simulate'}
          </button>
        </div>
      </div>
          
      {/* -------- Simulation Chart + Zoom Buttons -------- */}
      {filtered && (
        <>
          <div className="d-flex flex-wrap justify-content-between align-items-center mb-3">
            <h5 className="mb-0">Simulation Results</h5>
            <div className="btn-group">
              <button className="btn btn-outline-secondary" onClick={() => {
                const today = new Date();
                const weekAgo = new Date();
                weekAgo.setDate(today.getDate() - 7);
                setStartDate(weekAgo.toISOString().slice(0, 10));
                setEndDate(today.toISOString().slice(0, 10));
              }}>Last 7 Days</button>
  
              <button className="btn btn-outline-secondary" onClick={() => {
                const today = new Date();
                const monthAgo = new Date();
                monthAgo.setDate(today.getDate() - 30);
                setStartDate(monthAgo.toISOString().slice(0, 10));
                setEndDate(today.toISOString().slice(0, 10));
              }}>Last 30 Days</button>
  
              <button className="btn btn-outline-secondary" onClick={() => {
                setStartDate('2025-01-01');
                setEndDate('2025-12-31');
              }}>Full Year</button>
  
              <button className="btn btn-outline-primary" onClick={() => setShowDateModal(true)}>
                Custom Range
              </button>
            </div>
          </div>
            
          <Line
            data={{
              labels: filtered.timestamps,
              datasets: [
                {
                  label: 'Demand (kW)',
                  data: filtered.demand,
                  borderColor: 'red',
                  borderWidth: 2,
                  tension: 0.3,
                  pointRadius: 0
                },
                {
                  label: 'Generation (kW)',
                  data: filtered.generation,
                  borderColor: 'green',
                  borderWidth: 2,
                  tension: 0.3,
                  pointRadius: 0
                },
                {
                  label: 'Battery SOC (%)',
                  data: filtered.battery_soc,
                  borderColor: 'orange',
                  backgroundColor: 'rgba(212, 162, 69, 0.15)',
                  fill: true,
                  borderWidth: 2,
                  tension: 0.3,
                  pointRadius: 0,
                  yAxisID: 'socAxis'
                },
                {
                  label: 'Grid Import (kW)',
                  data: filtered.import_from_grid,
                  borderColor: 'blue',
                  borderWidth: 2,
                  tension: 0.3,
                  pointRadius: 0
                }
              ]
            }}
            options={{
              responsive: true,
              plugins: {
                title: { display: true, text: 'System Simulation' },
                legend: { display: true, position: 'bottom' },
                decimation: {
                  enabled: true,
                  algorithm: 'lttb',
                  samples: Math.min(100, filtered.timestamps.length)
                }
              },
              scales: {
                y: {
                  beginAtZero: true,
                  title: { display: true, text: 'Power (kW)' }
                },
                socAxis: {
                  position: 'right',
                  min: 0,
                  max: 100,
                  ticks: { callback: v => v + ' %' },
                  grid: { drawOnChartArea: false },
                  title: { display: true, text: 'Battery SOC (%)' }
                },
                x: {
                  ticks: { maxTicksLimit: 20 },
                  title: { display: true, text: 'Timestamp' }
                }
              }
            }}
          />
  
          {/* Modal for custom date range */}
          <Modal show={showDateModal} onHide={() => setShowDateModal(false)}>
            <Modal.Header closeButton>
              <Modal.Title>Select Date Range</Modal.Title>
            </Modal.Header>
            <Modal.Body>
              <Form.Group className="mb-3">
                <Form.Label>Start Date</Form.Label>
                <Form.Control type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label>End Date</Form.Label>
                <Form.Control type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
              </Form.Group>
            </Modal.Body>
            <Modal.Footer>
              <Button variant="secondary" onClick={() => setShowDateModal(false)}>Cancel</Button>
              <Button variant="primary" onClick={() => setShowDateModal(false)}>Apply</Button>
            </Modal.Footer>
          </Modal>
        </>
      )}
    </div>
  );
}

export default SystemDesign;
