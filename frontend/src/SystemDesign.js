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
  const [inverterKva, setInverterKva] = useState('');
  const [selectedInvOpt, setSelectedInvOpt] = useState(null);
  const [inverters, setInverters] = useState([]);
  const [inverterQuantity, setInverterQuantity] = useState(1);
  const [batteryQuantity, setBatteryQuantity] = useState(1);

  useEffect(() => {
    axios.get('http://localhost:5000/api/products?category=inverter')
      .then(r => {
        setInverters(r.data);
      });
  }, []);
  const [batteryKwh, setBatteryKwh] = useState('');
  const [selectedBatteryOpt, setSelectedBatteryOpt] = useState(null);
  const [batteries, setBatteries] = useState([]);
  useEffect(() => {
    axios.get('http://localhost:5000/api/products?category=battery')
      .then(r => {
        setBatteries(r.data);
      });
  }, []);

  const [simulationData, setSimulationData] = useState(null);
  const [startDate, setStartDate] = useState('2025-01-01');
  const [endDate, setEndDate] = useState('2025-12-31');
  const [loading, setLoading] = useState(false);
  const [allowExport, setAllowExport] = useState(false);
  const [showDateModal, setShowDateModal] = useState(false);

  // New state variables for metrics
  const [totalPVGeneration, setTotalPVGeneration] = useState(0);
  const [utilizedPVGeneration, setUtilizedPVGeneration] = useState(0);
  const [gridImport, setGridImport] = useState(0);
  const [gridExport, setGridExport] = useState(0);
  const [batteryChargeDischarge, setBatteryChargeDischarge] = useState(0);

  // Additional metrics state variables
  const [daytimeConsumption, setDaytimeConsumption] = useState('0');
  const [pvUtilization, setPvUtilization] = useState('0');
  const [consumptionFromPV, setConsumptionFromPV] = useState('0');
  const [potentialGenerationDaily, setPotentialGenerationDaily] = useState('0');
  const [utilizedGenerationDaily, setUtilizedGenerationDaily] = useState('0');
  const [throttlingLossesDaily, setThrottlingLossesDaily] = useState('0');
  const [specificYieldWithThrottling, setSpecificYieldWithThrottling] = useState('0');
  const [potentialGenerationAnnual, setPotentialGenerationAnnual] = useState('0');
  const [utilizedGenerationAnnual, setUtilizedGenerationAnnual] = useState('0');
  const [throttlingLossesAnnual, setThrottlingLossesAnnual] = useState('0');
  const [specificYieldExclThrottling, setSpecificYieldExclThrottling] = useState('0');
  const [batteryCyclesAnnual, setBatteryCyclesAnnual] = useState('0');
  

  // pull saved values when component mounts
  useEffect (() => {
    axios.get(`http://localhost:5000/api/projects/${projectId}`)
    .then(res => {
      const p = res.data;
      if (!p) return;

      setSystemType(p.system_type || 'grid');
      setPanelKw(p.panel_kw ?? '');

      // Handle inverter data (old and new formats)

      if (p.inverter_kva && typeof p.inverter_kva === 'object') {
        setInverterKva(p.inverter_kva.capacity ?? '');
        setInverterQuantity(p.inverter_kva.quantity || 1);       
      } else {
        setInverterKva(p.inverter_kva ?? '');
        setInverterQuantity(1);
      }

      // Handle battery data (old and new formats)
      if (p.battery_kwh && typeof p.battery_kwh === 'object') {
        setBatteryKwh(p.battery_kwh.capacity ?? '');
        setBatteryQuantity(p.battery_kwh.quantity || 1);
      } else {
        setBatteryKwh(p.battery_kwh ?? '');
        setBatteryQuantity(1);
      }
    })
    .catch(err => console.error('Load project error:', err));

    // load simulation data from sessionStorage
    const cached = sessionStorage.getItem(`simulationData_${projectId}`);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (parsed.timestamps) {
          setSimulationData(parsed);
        }
      } catch (e) {
        console.error('Failed to parse cached simulation data:', e);
      }
    }

  }, [projectId]);

  // Set default date range to last 30 days
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
      battery_kwh: systemType === 'grid' ? null : {
        capacity: parseFloat(batteryKwh),
        quantity: batteryQuantity
      },
      inverter_kva: {
        capacity: parseFloat(inverterKva),
        quantity: inverterQuantity
      }
    })
    .then(() => alert('System saved to project 👍'))
    .catch(err => {
      console.error('Save error:', err.response?.data || err.message);
      alert('Could not save the system.');
    });
  };

  const handleSimulate = () => {
    setLoading(true);

    // Calculate total capacities
    const totalInverterKva = parseFloat(inverterKva) * inverterQuantity;
    const totalBatteryKwh = systemType === 'grid' ? 0 :
      safeParseFloat(batteryKwh) * batteryQuantity;

    axios.post('http://localhost:5000/api/simulate', {
      project_id: projectId,
      system: {
        panel_kw: parseFloat(panelKw),
        system_type: systemType,
        battery_kwh: totalBatteryKwh,
        inverter_kva: totalInverterKva,
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
      sessionStorage.setItem(`simulationData_${projectId}`, JSON.stringify(res.data));
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

  useEffect(() => {
  if (!batteries.length || !batteryKwh) return;
  const opt = batteries
    .map(bat => ({
      value: bat.capacity_kwh,
      label: `${bat.brand} ${bat.model} (${bat.capacity_kwh} kWh)`
    }))
    .find(o => o.value === batteryKwh);
  setSelectedBatteryOpt(opt || null);
}, [batteries, batteryKwh]);


  const filterData = () => {
    if (!simulationData || !simulationData.timestamps) return null;
    if (!startDate && !endDate) return simulationData;

    const start = new Date(startDate);
    const end = new Date(endDate);
    const filtered = {
      timestamps: [],
      demand: [],
      generation: [],
      potential_generation: [],
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
        filtered.potential_generation.push(simulationData.potential_generation ? simulationData.potential_generation[i] : simulationData.generation[i]);
        filtered.battery_soc.push(simulationData.battery_soc[i]);
        filtered.import_from_grid.push(simulationData.import_from_grid[i]);
        filtered.export_to_grid.push(simulationData.export_to_grid[i]);
      }
    });
    return filtered;
  };

  const filtered = filterData();

  // Calculate metrics from filtered data
  useEffect(() => {
    if (!filtered || !filtered.timestamps.length) return;

    // Determine day vs night
    const dayData = filtered.timestamps.map((ts, i) => {
      const hour = new Date(ts).getHours();
      return { isDaytime: hour >= 6 && hour < 18, index: i };
    });

    // Total demand
    const totalDemand = filtered.demand.reduce((sum, val) => sum + val, 0) * 0.5;

    // Daytime demand
    const daytimeDemand = dayData
      .filter(d => d.isDaytime)
      .reduce((sum, d) => sum + filtered.demand[d.index], 0) * 0.5;

    // 1. Daytime Consumption (%)
    const daytimeConsumptionPct = totalDemand > 0 ? (daytimeDemand / totalDemand) * 100 : 0;
    setDaytimeConsumption(daytimeConsumptionPct.toFixed(0));

    // Total PV Generation
    const totalPotentialGen = filtered.potential_generation ? filtered.potential_generation.reduce((sum, val) => sum + val, 0) * 0.5 : 
    filtered.generation.reduce((sum, val) => sum + val, 0) * 0.5;
    setTotalPVGeneration(totalPotentialGen.toFixed(0));

    // Grid metrics
    const totalImport = filtered.import_from_grid.reduce((sum, val) => sum + val, 0) * 0.5;
    setGridImport(totalImport.toFixed(0));

    const totalExport = filtered.export_to_grid.reduce((sum, val) => sum + val, 0) * 0.5;
    setGridExport(totalExport.toFixed(0));

    // Utilized PV Generation
    const utilizedGen = filtered.generation.map((gen, i) => {
      const exportGrid = filtered.export_to_grid[i];
      return Math.max(0, gen - exportGrid);
    }).reduce((sum, val) => sum + val, 0) * 0.5;
    setUtilizedPVGeneration(utilizedGen.toFixed(0));

    // 2. PV Utilization (%)
    const pvUtilizationPct = totalPotentialGen > 0 ? (utilizedGen / totalPotentialGen) * 100 : 0;
    setPvUtilization(pvUtilizationPct.toFixed(0));

    // 3. Consumption from PV (%)
    const consumptionFromPVPct = totalDemand > 0 ? (utilizedGen / totalDemand) * 100 : 0;
    setConsumptionFromPV(consumptionFromPVPct.toFixed(0));

    // Calculate days in data
    const startDate = new Date(filtered.timestamps[0]);
    const endDate = new Date(filtered.timestamps[filtered.timestamps.length - 1]);
    const daysDiff = Math.max(1, (endDate - startDate) / (1000 * 60 * 60 * 24));

    // Daily metrics
    const potentialGenDaily = totalPotentialGen / daysDiff;
    setPotentialGenerationDaily(potentialGenDaily.toFixed(0));
    
    const utilizedGenDaily = utilizedGen / daysDiff;
    setUtilizedGenerationDaily(utilizedGenDaily.toFixed(0));
    
    const throttlingLosses = totalPotentialGen - utilizedGen;
    const throttlingLossesDaily = throttlingLosses / daysDiff;
    setThrottlingLossesDaily(throttlingLossesDaily.toFixed(0));
    
    // Specific yield with throttling
    const specificYield = safeParseFloat(panelKw) > 0 ? potentialGenDaily / safeParseFloat(panelKw) : 0;
    setSpecificYieldWithThrottling(specificYield.toFixed(2));
    
    // Annual projections
    const daysInYear = 365;
    const potentialGenAnnual = potentialGenDaily * daysInYear;
    setPotentialGenerationAnnual(potentialGenAnnual.toFixed(0));
    
    const utilizedGenAnnual = utilizedGenDaily * daysInYear;
    setUtilizedGenerationAnnual(utilizedGenAnnual.toFixed(0));
    
    const throttlingLossesAnnual = throttlingLossesDaily * daysInYear;
    setThrottlingLossesAnnual(throttlingLossesAnnual.toFixed(0));
    
    // Specific yield excluding throttling
    const specificYieldExcl = safeParseFloat(panelKw) > 0 ? utilizedGenAnnual / safeParseFloat(panelKw) : 0;
    setSpecificYieldExclThrottling(specificYieldExcl.toFixed(0));
    
    // Battery cycles calculation
    if (filtered.battery_soc?.length > 1 && safeParseFloat(batteryKwh) > 0) {
      const totalBatteryCapacity = safeParseFloat(batteryKwh) * batteryQuantity;
      let totalChargeEnergy = 0;
      
      for (let i = 1; i < filtered.battery_soc.length; i++) {
        const socDiff = filtered.battery_soc[i] - filtered.battery_soc[i-1];
        if (socDiff > 0) { // Only count charging
          totalChargeEnergy += (socDiff / 100) * totalBatteryCapacity;
        }
      }
      
      // Daily cycles
      const dailyCycles = totalBatteryCapacity > 0 ? totalChargeEnergy / totalBatteryCapacity : 0;
      // Annual projection
      const cyclesAnnual = (dailyCycles / daysDiff) * 365;
      setBatteryCyclesAnnual(cyclesAnnual.toFixed(1));
    } else {
      setBatteryCyclesAnnual('-');
    }

    // Battery net change calculation (existing)
    if (filtered.battery_soc.length > 1 && batteryKwh > 0) {
      const totalBatteryKwh = safeParseFloat(batteryKwh) * batteryQuantity * 1000; // Wh
      let netBatteryChange = 0;
      for (let i = 1; i < filtered.battery_soc.length; i++) {
        const socDiff = (filtered.battery_soc[i] - filtered.battery_soc[i - 1]) / 100 * totalBatteryKwh;
        netBatteryChange += socDiff;
      }
      setBatteryChargeDischarge((netBatteryChange / 1000).toFixed(0)); // Convert to kWh
    } else {
      setBatteryChargeDischarge(0);
    }
    
  }, [filtered, batteryKwh, batteryQuantity, panelKw]);

  // Helper function so safely parse values
  const safeParseFloat = (value) => {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') return parseFloat(value) || 0;
    if (value && typeof value === 'object') {
      return parseFloat(value.capacity) || 0;
    }
    return 0;
  }

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
          <div className='mt-2'>
            <label className='form-label'>Quantity</label>
            <input
              type="number"
              min="1"
              className="form-control"
              value={inverterQuantity}
              onChange={e => setInverterQuantity(Math.max(1, parseInt(e.target.value) || 1))}
              />
          </div>
        </div>

        <div className="col-md-3">
          <label className="form-label">Battery (kWh)</label>
            <Select
              isDisabled={systemType === 'grid'}
              options={batteries.map(bat => ({
                value: bat.capacity_kwh,
                label: `${bat.brand} ${bat.model} (${bat.capacity_kwh} kWh)`
              }))}
              value={selectedBatteryOpt}
              onChange={opt => {
                setSelectedBatteryOpt(opt);
                setBatteryKwh(opt ? opt.value : '');
              }}
              isClearable
            />
            <div className="mt-2">
              <label className="form-label">Quantity</label>
              <input 
                type="number"
                min="1"
                className="form-control"
                value={batteryQuantity}
                onChange={e => setBatteryQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                disabled={systemType === 'grid'}
              /> 
            </div>
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
                ...(safeParseFloat(batteryKwh)) > 0 ? [{
                  label: 'Battery SOC (%)',
                  data: filtered.battery_soc,
                  borderColor: 'orange',
                  backgroundColor: 'rgba(212, 162, 69, 0.15)',
                  fill: true,
                  borderWidth: 2,
                  tension: 0.3,
                  pointRadius: 0,
                  yAxisID: 'socAxis'
                }] : [],
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
          
          {/* New Metrics Cards */}
          <div className="row mb-4 g-3 mt-4">
            <div className="col-md-4">
              <div className="border-start border-4 border-primary bg-white shadow-sm rounded p-3 h-100">
                <div className="text-muted small">Total PV Generation</div>
                <div className="fs-4 fw-bold">{totalPVGeneration} kWh</div>
              </div>
            </div>
            <div className="col-md-4">
              <div className="border-start border-4 border-success bg-white shadow-sm rounded p-3 h-100">
                <div className="text-muted small">Utilized PV Generation</div>
                <div className="fs-4 fw-bold">{utilizedPVGeneration} kWh</div>
              </div>
            </div>
            <div className="col-md-4">
              <div className="border-start border-4 border-danger bg-white shadow-sm rounded p-3 h-100">
                <div className="text-muted small">Grid Import</div>
                <div className="fs-4 fw-bold">{gridImport} kWh</div>
              </div>
            </div>
            <div className="col-md-4">
              <div className="border-start border-4 border-warning bg-white shadow-sm rounded p-3 h-100">
                <div className="text-muted small">Grid Export</div>
                <div className="fs-4 fw-bold">{gridExport} kWh</div>
              </div>
            </div>
            <div className="col-md-4">
              <div className="border-start border-4 border-info bg-white shadow-sm rounded p-3 h-100">
                <div className="text-muted small">Battery Charge/Discharge</div>
                <div className="fs-4 fw-bold">{batteryChargeDischarge} kWh</div>
              </div>
            </div>
          </div>

          {/* Advanced System Metrics */}
          {filtered && (
  <div className="mt-5">
    <h5 className="mb-3">Plant Output Specifications</h5>
    <div className="table-responsive">
      <table className="table table-bordered table-striped">
        <thead className="table-light">
          <tr>
            <th>Metric</th>
            <th>Value</th>
            <th>Units</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Daytime Consumption</td>
            <td>{daytimeConsumption}</td>
            <td>%</td>
          </tr>
          <tr>
            <td>PV Utilization</td>
            <td>{pvUtilization}</td>
            <td>%</td>
          </tr>
          <tr>
            <td>Overall Consumption from PV</td>
            <td>{consumptionFromPV}</td>
            <td>%</td>
          </tr>
          <tr>
            <td>Potential Generation (daily)</td>
            <td>{potentialGenerationDaily}</td>
            <td>kWh</td>
          </tr>
          <tr>
            <td>Utilized Generation (daily)</td>
            <td>{utilizedGenerationDaily}</td>
            <td>kWh</td>
          </tr>
          <tr>
            <td>Throttling Losses (daily)</td>
            <td>{throttlingLossesDaily}</td>
            <td>kWh</td>
          </tr>
          <tr>
            <td>Specific Yield Including Throttling Losses</td>
            <td>{specificYieldWithThrottling}</td>
            <td>kWh/kWp/day</td>
          </tr>
          <tr>
            <td>Potential Generation p.a.</td>
            <td>{potentialGenerationAnnual}</td>
            <td>kWh</td>
          </tr>
          <tr>
            <td>Utilized Generation p.a.</td>
            <td>{utilizedGenerationAnnual}</td>
            <td>kWh</td>
          </tr>
          <tr>
            <td>Throttling Losses p.a.</td>
            <td>{throttlingLossesAnnual}</td>
            <td>kWh</td>
          </tr>
          <tr>
            <td>Specific Yield Excl. Throttling Losses</td>
            <td>{specificYieldExclThrottling}</td>
            <td>kWh/kWp/y</td>
          </tr>
          <tr>
            <td>Battery cycles in 1 year</td>
            <td>{batteryCyclesAnnual}</td>
            <td>cycles/y</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
)}

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
