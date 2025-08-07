import React, { useEffect, useState, useMemo } from 'react';
import axios from 'axios';
import { Card, Button, Form, Row, Col, Spinner, Table, Badge } from 'react-bootstrap';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { Line, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  TimeScale
} from 'chart.js';
import annotationPlugin from 'chartjs-plugin-annotation';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { API_URL } from './apiConfig';
import { useNotification } from './NotificationContext';
import { enZA } from 'date-fns/locale';
import 'chartjs-adapter-date-fns';

ChartJS.register(
  CategoryScale, 
  LinearScale, 
  BarElement, 
  PointElement,
  LineElement,
  Title, 
  Tooltip, 
  Legend,
  TimeScale,
  annotationPlugin,
  ChartDataLabels
);

// Helper to format currency
const formatCurrency = (value) => {
  return new Intl.NumberFormat('en-ZA', { 
    style: 'currency', 
    currency: 'ZAR', 
    maximumFractionDigits: 0 
  }).format(value || 0);
};

function FinancialModeling({ projectId }) {
  const { showNotification } = useNotification();
  const [projectValue, setProjectValue] = useState('');
  const [feedInTariff, setFeedInTariff] = useState(1.0);
  const [allowExport, setAllowExport] = useState(false);
  const [financialResult, setFinancialResult] = useState(null);
  const [simulationData, setSimulationData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [showLosses, setShowLosses] = useState(false);
  const [standardTemplateUsed, setStandardTemplateUsed] = useState(false);
  const [templateInfo, setTemplateInfo] = useState(null);

  // Load project value, simulation data, and financial settings
  useEffect(() => {
    // Load project data
    axios.get(`${API_URL}/api/projects/${projectId}`)
      .then(res => {
        const p = res.data;
        if (p && p.project_value_excl_vat != null) {
          setProjectValue(p.project_value_excl_vat);
          
          // Check if this was from a standard template
          if (p.from_standard_template) {
            setStandardTemplateUsed(true);
            setTemplateInfo({
              name: p.template_name || 'Standard Design'
            });
          }
        }
      })
      .catch(err => console.error("Error loading project value:", err));

    // Load simulation data from session storage
    const cachedSimData = sessionStorage.getItem(`simulationData_${projectId}`);
    if (cachedSimData) {
      try {
        const parsedData = JSON.parse(cachedSimData);
        if (parsedData && parsedData.timestamps) {
          setSimulationData(parsedData);
          
          // Set default date range when simulation data loads
          if (parsedData.timestamps && parsedData.timestamps.length > 0) {
            // Default to showing first week of data
            const firstDate = new Date(parsedData.timestamps[0]);
            const weekLater = new Date(firstDate);
            weekLater.setDate(weekLater.getDate() + 7);
            
            setStartDate(firstDate);
            setEndDate(weekLater);
          }
        }
      } catch (e) {
        showNotification("Failed to parse cached simulation data.", 'danger');
      }
    } else {
      showNotification("No simulation data found in session storage. Please run a simulation first.", 'danger');
    }

    // Load previously cached financial results and settings
    const cachedFinResults = sessionStorage.getItem(`financialResult_${projectId}`);
    if (cachedFinResults) {
      setFinancialResult(JSON.parse(cachedFinResults));
    }
    const f = sessionStorage.getItem(`feedInTariff_${projectId}`);
    const ex = sessionStorage.getItem(`allowExport_${projectId}`);
    if (f) setFeedInTariff(f);
    if (ex) setAllowExport(ex === 'true');
  }, [projectId, showNotification]);

  const handleCalculate = () => {
    if (!simulationData) {
      showNotification("Please run a simulation first to generate the required data.", 'danger');
      return;
    }

    setLoading(true);
    axios.post(`${API_URL}/api/financial_model`, {
      project_id: projectId,
      export_enabled: allowExport,
      feed_in_tariff: parseFloat(feedInTariff),
      simulation_data: simulationData
    })
    .then(res => {
      setFinancialResult(res.data);
      sessionStorage.setItem(`financialResult_${projectId}`, JSON.stringify(res.data));
      setLoading(false);
    })
    .catch(err => {
      const msg = err.response?.data?.error || err.message;
      console.error("Error calculating financial model:", msg);
      showNotification(`Error calculating financial model: ${msg}`, 'danger');
      setLoading(false);
    });
  };

  // Energy chart data based on simulation results
  const energyChartData = useMemo(() => {
    if (!simulationData || !startDate || !endDate) {
      return { labels: [], datasets: [] };
    }

    const sim = simulationData;
    
    const startIndex = sim.timestamps.findIndex(t => new Date(t) >= startDate);
    let endIndex = sim.timestamps.findIndex(t => new Date(t) > endDate);
    
    if (endIndex === -1) endIndex = sim.timestamps.length;
    if (startIndex === -1) return { labels: [], datasets: [] };

    const labels = sim.timestamps.slice(startIndex, endIndex).map(t => new Date(t));

    const datasets = [
      { 
        label: 'Demand (kW)', 
        data: sim.demand.slice(startIndex, endIndex), 
        borderColor: '#ff6384', 
        backgroundColor: '#ff638420', 
        tension: 0.3, 
        pointRadius: 0, 
        borderWidth: 2 
      },
      { 
        label: 'Grid Import (kW)', 
        data: sim.import_from_grid.slice(startIndex, endIndex), 
        borderColor: '#cc65fe', 
        backgroundColor: '#cc65fe20', 
        tension: 0.3, 
        pointRadius: 0, 
        borderWidth: 1.5, 
        borderDash: [5, 5] 
      },
      { 
        label: 'Battery SOC (%)', 
        data: sim.battery_soc.slice(startIndex, endIndex), 
        borderColor: '#ffce56', 
        backgroundColor: '#ffce5620', 
        yAxisID: 'y1', 
        tension: 0.3, 
        pointRadius: 0, 
        borderWidth: 2 
      }
    ];

    if (showLosses) {
      datasets.push({ 
        label: 'PV Generation (kW)', 
        data: sim.generation.slice(startIndex, endIndex), 
        borderColor: '#36a2eb', 
        backgroundColor: '#36a2eb20', 
        tension: 0.3, 
        pointRadius: 0, 
        borderWidth: 1.5 
      });

      datasets.push({ 
        label: 'Potential PV (kW)', 
        data: sim.potential_generation.slice(startIndex, endIndex), 
        borderColor: 'rgba(75, 192, 192, 0.7)', 
        backgroundColor: 'rgba(75, 192, 192, 0.1)', 
        tension: 0.3, 
        pointRadius: 0, 
        borderWidth: 1.5, 
        borderDash: [3, 3] 
      });
    } else {
      datasets.push({ 
        label: 'PV Generation (kW)', 
        data: sim.generation.slice(startIndex, endIndex), 
        borderColor: '#36a2eb', 
        backgroundColor: '#36a2eb20', 
        tension: 0.3, 
        pointRadius: 0, 
        borderWidth: 2 
      });
    }

    return { labels, datasets };
  }, [simulationData, startDate, endDate, showLosses]);

  // Financial chart data for monthly cost comparison
  const financialChartData = useMemo(() => {
    if (!financialResult?.cost_comparison) {
      return { labels: [], datasets: [] };
    }
    
    const fin = financialResult;
    const labels = fin.cost_comparison.map(item => 
      new Date(item.month).toLocaleString('default', { month: 'short', year: '2-digit' })
    );
    
    return {
      labels,
      datasets: [
        { 
          label: 'Old Bill', 
          data: fin.cost_comparison.map(item => item.old_cost), 
          backgroundColor: '#ff6384' 
        },
        { 
          label: 'New Bill (with Solar)', 
          data: fin.cost_comparison.map(item => item.new_cost), 
          backgroundColor: '#36a2eb' 
        }
      ]
    };
  }, [financialResult]);

  // Cost breakdown chart (detailed bill components)
  const costBreakdownChartData = useMemo(() => {
    if (!financialResult?.cost_comparison) {
      return { labels: [], datasets: [] };
    }
    
    const fin = financialResult;
    const labels = fin.cost_comparison.map(item => 
      new Date(item.month).toLocaleString('default', { month: 'short', year: '2-digit' })
    );

    const allDatasets = [
      {
        label: 'Old Bill - Energy',
        data: fin.cost_comparison.map(item => item.old_bill_breakdown?.energy || 0),
        backgroundColor: '#f87171',
        stack: 'Stack 0',
      },
      {
        label: 'Old Bill - Fixed',
        data: fin.cost_comparison.map(item => item.old_bill_breakdown?.fixed || 0),
        backgroundColor: '#9ca3af',
        stack: 'Stack 0',
      },
      {
        label: 'Old Bill - Demand',
        data: fin.cost_comparison.map(item => item.old_bill_breakdown?.demand || 0),
        backgroundColor: '#b91c1c',
        stack: 'Stack 0',
      },
      {
        label: 'New Bill - Energy',
        data: fin.cost_comparison.map(item => item.new_bill_breakdown?.energy || 0),
        backgroundColor: '#60a5fa',
        stack: 'Stack 1',
      },
      {
        label: 'New Bill - Fixed',
        data: fin.cost_comparison.map(item => item.new_bill_breakdown?.fixed || 0),
        backgroundColor: '#6b7280',
        stack: 'Stack 1',
      },
      {
        label: 'New Bill - Demand',
        data: fin.cost_comparison.map(item => item.new_bill_breakdown?.demand || 0),
        backgroundColor: '#1d4ed8',
        stack: 'Stack 1',
      }
    ];

    return {
      labels,
      datasets: allDatasets.filter(ds => ds.data.some(val => val !== 0 && val !== null))
    };
  }, [financialResult]);

  // Lifetime cashflow chart for payback visualization
  const lifetimeCashflowChartData = useMemo(() => {
    if (!financialResult?.lifetime_cashflow || financialResult.lifetime_cashflow.length === 0) {
      return { labels: [], datasets: [] };
    }
    
    return {
      labels: financialResult.lifetime_cashflow.map(item => `Year ${item.year}`),
      datasets: [{
        label: 'Cumulative Cashflow (R)',
        data: financialResult.lifetime_cashflow.map(item => item.cashflow),
        borderColor: '#27ae60',
        backgroundColor: 'rgba(39, 174, 96, 0.1)',
        fill: true,
        tension: 0.3,
      }]
    };
  }, [financialResult]);

  // Determine the payback point for annotation
  const paybackPoint = useMemo(() => {
    if (!financialResult?.lifetime_cashflow || financialResult.lifetime_cashflow.length === 0) {
      return null;
    }

    const idx = financialResult.lifetime_cashflow.findIndex(item => item.cashflow >= 0);
    if (idx === -1) return null;
    if (idx === 0) return 0;

    const cumPrev = financialResult.lifetime_cashflow[idx - 1].cashflow;
    const cumCurrent = financialResult.lifetime_cashflow[idx].cashflow;
    
    // Calculate the fractional year where cashflow becomes positive
    if (cumCurrent - cumPrev === 0) return idx;
    const fraction = -cumPrev / (cumCurrent - cumPrev);
    return idx - 1 + fraction;
  }, [financialResult]);

  // Chart options
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    scales: {
      x: { 
        type: 'time',
        time: { unit: 'day', tooltipFormat: 'MMM dd, HH:mm' },
        adapters: { date: { locale: enZA } }
      },
      y: { 
        beginAtZero: true,
        title: { display: true, text: 'Power (kW)' }
      },
      y1: {
        type: 'linear',
        display: true,
        position: 'right',
        beginAtZero: true,
        max: 100,
        title: { display: true, text: 'Battery SOC (%)' },
        grid: { drawOnChartArea: false }
      }
    },
    plugins: {
      datalabels: { display: false },
    }
  };

  // Show loading spinner if no financial results yet
  if (loading) {
    return (
      <div className="text-center py-5">
        <Spinner animation="border" variant="primary" />
        <p className="mt-3">Calculating financial projections...</p>
      </div>
    );
  }

  // Summation for 2025 annual comparison
  const costComparison = financialResult?.cost_comparison || [];
  const oldCost2025 = costComparison
    .filter(item => item.month.startsWith('2025-'))
    .reduce((acc, val) => acc + val.old_cost, 0);
  const newCost2025 = costComparison
    .filter(item => item.month.startsWith('2025-'))
    .reduce((acc, val) => acc + val.new_cost, 0);
  const savings2025 = oldCost2025 - newCost2025;

  return (
    <div className="p-lg-4" style={{ backgroundColor: '#f8f9fa' }}>
      <h2 className="text-3xl font-bold text-gray-800 mb-4 text-center">Financial Analysis</h2>

      {/* Financial parameters form */}
      <Card className="shadow-sm mb-4">
        <Card.Body>
          <h5 className="mb-3">Financial Parameters</h5>
          <Row>
            <Col md={4}>
              <Form.Group className="mb-3">
                <Form.Label>
                  Project Value (excl. VAT)
                  <span className="text-muted ms-2" style={{ fontSize: '0.85em' }}>
                    {standardTemplateUsed ? 
                      'Set from standard design' : 
                      ''}
                  </span>
                </Form.Label>
                <Form.Control
                  type="number"
                  className={`${standardTemplateUsed ? 'border-success' : 'border-light'}`}
                  value={projectValue}
                  onChange={(e) => {
                    setProjectValue(e.target.value);
                    sessionStorage.setItem(`projectValue_${projectId}`, e.target.value);
                  }}
                  onBlur={() => {
                    // Auto-save to DB on blur
                    axios.put(`${API_URL}/api/projects/${projectId}`, {
                      project_value_excl_vat: parseFloat(projectValue)
                    })
                    .then(() => console.log('Project value updated'))
                    .catch(err => {
                      console.error("Error saving project value:", err);
                      showNotification("Could not save project value.", 'danger');
                    });
                  }}
                />
              </Form.Group>
            </Col>

            <Col md={4}>
              <Form.Group className="mb-3">
                <Form.Label>Allow Export to Grid?</Form.Label>
                <Form.Check
                  type="switch"
                  id="export-switch"
                  checked={allowExport}
                  onChange={() => {
                    const newVal = !allowExport;
                    setAllowExport(newVal);
                    sessionStorage.setItem(`allowExport_${projectId}`, newVal);
                  }}
                  label={allowExport ? "Enabled" : "Disabled"}
                />
              </Form.Group>
            </Col>

            <Col md={4}>
              <Form.Group className="mb-3">
                <Form.Label>Feed-in Tariff (R/kWh)</Form.Label>
                <Form.Control
                  type="number"
                  value={feedInTariff}
                  onChange={(e) => {
                    setFeedInTariff(e.target.value);
                    sessionStorage.setItem(`feedInTariff_${projectId}`, e.target.value);
                  }}
                  step="0.01"
                  min="0"
                  disabled={!allowExport}
                />
              </Form.Group>
            </Col>
          </Row>
          
          <Button 
            variant="primary" 
            onClick={handleCalculate} 
            disabled={loading || !simulationData}
            className="mt-2"
          >
            {loading ? (
              <>
                <Spinner size="sm" animation="border" className="me-2" />
                Calculating...
              </>
            ) : (
              <>
                <i className="bi bi-calculator me-2"></i>
                Calculate Financial Model
              </>
            )}
          </Button>
        </Card.Body>
      </Card>

      {/* System Specifications Cards */}
      <Row className='mb-2 g-2'>
        <Col md={3} className='mb-1'>
          <Card className='text-center shadow-sm h-100'>
            <Card.Body className='py-2'>
              <div className='fs-1 text-secondary'>
                <i className='bi bi-cash-stack'></i>
              </div>
              <h5>Total System Cost</h5>
              <h3 className='fw-bold'>{formatCurrency(projectValue)}</h3>
            </Card.Body>
          </Card>
        </Col>

        <Col md={3} className="mb-1">
          <Card className="text-center shadow-sm h-100">
            <Card.Body className='py-2'>
              <div className="fs-1 text-warning">
                <i className="bi bi-sun-fill"></i>
              </div>
              <h5>PV Size</h5>
              <h3 className="fw-bold">
                {simulationData?.panel_kw ? `${simulationData.panel_kw} kWp` : 'N/A'}
              </h3>
            </Card.Body>
          </Card>
        </Col>

        <Col md={3} className="mb-1">
          <Card className="text-center shadow-sm h-100">
            <Card.Body className='py-2'>
              <div className="fs-1 text-danger">
                <i className="bi bi-cpu-fill"></i>
              </div>
              <h5>Inverter Size</h5>
              <h3 className="fw-bold">
                {simulationData?.inverter_kva ? `${simulationData.inverter_kva} kVA` : 'N/A'}
              </h3>
            </Card.Body>
          </Card>
        </Col>

        <Col md={3} className="mb-1">
          <Card className="text-center shadow-sm h-100">
            <Card.Body className='py-2'>
              <div className="fs-1 text-success">
                <i className="bi bi-battery-charging"></i>
              </div>
              <h5>Battery Size</h5>
              <h3 className="fw-bold">
                {simulationData?.battery_kwh && simulationData.battery_kwh > 0 
                  ? `${simulationData.battery_kwh} kWh` 
                  : '0 kWh'}
              </h3>
            </Card.Body>
          </Card>
        </Col>

      </Row>

      {/* Results section - only show if financial results exist */}
      {financialResult && (
        <>
          {/* Key metrics cards */}
          <Row className="mb-4 g-2">
            <Col md={3} className="mb-1">
              <Card className="text-center shadow-sm h-100">
                <Card.Body className='py-2'>
                  <div className="fs-1 text-success">
                    <i className="bi bi-wallet2"></i>
                  </div>
                  <h5>Annual Savings</h5>
                  <h3 className="fw-bold">{formatCurrency(financialResult.annual_savings)}</h3>
                </Card.Body>
              </Card>
            </Col>
            <Col md={3} className="mb-1">
              <Card className="text-center shadow-sm h-100">
                <Card.Body className='py-2'>
                  <div className="fs-1 text-primary">
                    <i className="bi bi-lightning-charge-fill"></i>
                  </div>
                  <h5>LCOE</h5>
                  <h3 className="fw-bold">R {financialResult.lcoe?.toFixed(2) || 'N/A'}/kWh</h3>
                </Card.Body>
              </Card>
            </Col>
            <Col md={3} className="mb-1">
              <Card className="text-center shadow-sm h-100">
                <Card.Body className='py-2'>
                  <div className="fs-1 text-info">
                    <i className="bi bi-calendar-check"></i>
                  </div>
                  <h5>Payback Period</h5>
                  <h3 className="fw-bold">
                    {paybackPoint !== null ? paybackPoint.toFixed(1) : financialResult.payback_period} Years
                  </h3>
                </Card.Body>
              </Card>
            </Col>
            <Col md={3} className="mb-1">
              <Card className="text-center shadow-sm h-100">
                <Card.Body className='py-2'>
                  <div className="fs-1 text-warning">
                    <i className="bi bi-graph-up-arrow"></i>
                  </div>
                  <h5>20-Year ROI</h5>
                  <h3 className="fw-bold">{financialResult.roi}%</h3>
                </Card.Body>
              </Card>
            </Col>
          </Row>

          {/* Energy flow chart */}
          <Card className="shadow-sm my-4">
            <Card.Header as="h5" className='d-flex justify-content-between align-items-center flex-wrap'>
              <span>
                <i className="bi bi-bar-chart-line-fill me-2"></i>
                Weekly Energy Flow (Sample)
              </span>
              <div className='d-flex align-items-center'>
                <Button
                  variant={showLosses ? "primary" : "outline-secondary"}
                  size="sm"
                  className='me-3'
                  onClick={() => setShowLosses(!showLosses)}
                >
                  <i className={`bi ${showLosses ? "bi-eye-slash-fill" : "bi-eye-fill"} me-2`}></i>
                  {showLosses ? "Hide Losses" : "Show Losses"}
                </Button>
              </div>
              <div className='date-picker-container'>
                <DatePicker
                  selected={startDate}
                  onChange={(dates) => {
                    const [start, end] = dates;
                    setStartDate(start);
                    setEndDate(end);
                  }}
                  startDate={startDate}
                  endDate={endDate}
                  selectsRange
                  isClearable={false}
                  dateFormat={"dd/MM/yyyy"}
                  className='form-control form-control-sm shadow-sm'
                  popperPlacement='bottom-end'
                  minDate={simulationData?.timestamps && new Date(simulationData.timestamps[0])}
                  maxDate={simulationData?.timestamps && new Date(simulationData.timestamps[simulationData.timestamps.length - 1])}
                />
              </div>
            </Card.Header>
            <Card.Body style={{ height: '400px' }}>
              <Line options={chartOptions} data={energyChartData} />
            </Card.Body>
          </Card>

          {/* Annual performance and bill comparison */}
          <Row>
            <Col lg={6} className="mb-4">
              <Card className="shadow-sm h-100">
                <Card.Header as="h5">
                  <i className="bi bi-piggy-bank-fill me-2"></i>Annual Performance
                </Card.Header>
                <Table striped hover responsive className="mb-0">
                  <tbody>
                    <tr>
                      <td>Total Consumption</td>
                      <td className="text-end fw-bold">
                        {financialResult.total_demand_kwh?.toLocaleString()} kWh
                      </td>
                    </tr>
                    <tr>
                      <td>Direct Solar Consumption</td>
                      <td className="text-end fw-bold">
                        {financialResult.total_generation_kwh?.toLocaleString()} kWh
                      </td>
                    </tr>
                    <tr>
                      <td>Potential Generation</td>
                      <td className='text-end fw-bold'>
                        {financialResult.potential_generation_kwh?.toLocaleString()} kWh
                      </td>
                    </tr>
                    <tr>
                      <td>Energy Imported from Grid</td>
                      <td className="text-end fw-bold text-danger">
                        {financialResult.total_import_kwh?.toLocaleString()} kWh
                      </td>
                    </tr>
                    <tr>
                      <td>Self-Consumption Rate</td>
                      <td className="text-end fw-bold">
                        <Badge bg="primary" className="fs-6">
                          {financialResult.self_consumption_rate}%
                        </Badge>
                      </td>
                    </tr>
                    <tr>
                      <td>Grid Independence</td>
                      <td className="text-end fw-bold">
                        <Badge bg="primary" className="fs-6">
                          {financialResult.grid_independence_rate}%
                        </Badge>
                      </td>
                    </tr>
                    <tr>
                      <td>Throttling Losses</td>
                      <td className='text-end fw-bold'>
                        <Badge bg="warning" text='dark' className='fs-6'>
                          {financialResult.throttling_loss_percent}%
                        </Badge>
                      </td>
                    </tr>
                    <tr>
                      <td>Specific Yield (incl. throttling losses)</td>
                      <td className='text-end fw-bold'>
                        <Badge bg="secondary" className="fs-6">
                          {financialResult.yield_incl_losses} kWh/kWp/day
                        </Badge>
                      </td>
                    </tr>
                    <tr>
                      <td>Specific Yield (excl. throttling losses)</td>
                      <td className='text-end fw-bold'>
                        <Badge bg="secondary" className="fs-6">
                          {financialResult.yield_excl_losses} kWh/kWp/day
                        </Badge>
                      </td>
                    </tr>
                  </tbody>
                </Table>
              </Card>
            </Col>

            <Col lg={6} className="mb-4">
              <Card className="shadow-sm h-100">
                <Card.Header as="h5">
                  <i className="bi bi-calendar-month-fill me-2"></i>Monthly Bill Comparison
                </Card.Header>
                <Card.Body style={{ height: '350px' }}>
                  <Bar 
                    options={{ 
                      responsive: true, 
                      maintainAspectRatio: false, 
                      plugins: { datalabels: { display: false } }, 
                      scales: { 
                        x: { stacked: false }, 
                        y: { 
                          stacked: false, 
                          title: {display: true, text: 'Cost (R)'} 
                        } 
                      } 
                    }} 
                    data={financialChartData} 
                  />
                </Card.Body>
              </Card>
            </Col>
          </Row>

          {/* Tariff & cost analysis section */}
          <hr className="my-5" />
          <h2 className="text-2xl font-bold text-gray-700 mb-4 text-center">
            Tariff & Cost Analysis
          </h2>
          <Row>
            <Col lg={4} className="mb-4">
              <Card className="shadow-sm h-100">
                <Card.Header as="h5">
                  <i className="bi bi-clock-history me-2"></i>Tariff Rate Sample (First Week)
                </Card.Header>
                <Card.Body style={{ height: '450px', overflowY: 'auto' }}>
                  <Table striped hover size="sm">
                    <thead>
                      <tr>
                        <th>Timestamp</th>
                        <th className="text-end">Rate (R/kWh)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {financialResult.tariff_sample?.map((item, index) => (
                        <tr key={index}>
                          <td>
                            {new Date(item.timestamp).toLocaleString('en-ZA', { 
                              month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' 
                            })}
                          </td>
                          <td className="text-end fw-bold">{item.rate.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </Card.Body>
              </Card>
            </Col>

            <Col lg={8} className="mb-4">
              <Card className="shadow-sm h-100">
                <Card.Header as="h5">
                  <i className="bi bi-pie-chart-fill me-2"></i>Monthly Bill Composition (New Bill)
                </Card.Header>
                <Card.Body style={{ height: '450px' }}>
                  <Bar 
                    options={{ 
                      responsive: true, 
                      maintainAspectRatio: false, 
                      plugins: {
                        datalabels: { display: false },
                      },
                      scales: { 
                        x: { stacked: true }, 
                        y: { stacked: true, title: {display: true, text: 'Cost (R)'} } 
                      } 
                    }} 
                    data={costBreakdownChartData} 
                  />
                </Card.Body>
              </Card>
            </Col>
          </Row>

          {/* Advanced financial analysis */}
          <hr className="my-5" />
          <h2 className="text-2xl font-bold text-gray-700 mb-4 text-center">
            Advanced Financial Analysis
          </h2>
          <Row>
            <Col lg={5} className="mb-4">
              <Card className="shadow-sm h-100">
                <Card.Header as="h5">
                  <i className="bi bi-calendar-range-fill me-2"></i>Bill Fluctuation Analysis
                </Card.Header>
                <Card.Body className="d-flex flex-column justify-content-center">
                  <p className="text-muted">
                    An estimate of the highest and lowest monthly bills you can expect after installing solar.
                  </p>
                  <Table borderless className="text-center mt-3">
                    <thead>
                      <tr>
                        <th>
                          <Badge bg="danger" className="fs-6 px-3 py-2">Highest Bill</Badge>
                        </th>
                        <th>
                          <Badge bg="success" className="fs-6 px-3 py-2">Lowest Bill</Badge>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="align-middle">
                        <td className="py-3">
                          <h4 className="fw-bold mb-0">
                            {formatCurrency(financialResult.bill_fluctuation?.worst?.cost)}
                          </h4>
                          <span className="text-muted small">
                            ({financialResult.bill_fluctuation?.worst?.month && 
                              new Date(financialResult.bill_fluctuation.worst.month + '-01').toLocaleString('default', { month: 'long' })})
                          </span>
                        </td>
                        <td className="py-3">
                          <h4 className="fw-bold mb-0">
                            {formatCurrency(financialResult.bill_fluctuation?.best?.cost)}
                          </h4>
                          <span className="text-muted small">
                            ({financialResult.bill_fluctuation?.best?.month &&
                              new Date(financialResult.bill_fluctuation.best.month + '-01').toLocaleString('default', { month: 'long' })})
                          </span>
                        </td>
                      </tr>
                    </tbody>
                  </Table>
                </Card.Body>
              </Card>
            </Col>

            <Col lg={7} className="mb-4">
              <Card className="shadow-sm h-100">
                <Card.Header as="h5">
                  <i className="bi bi-cash-stack me-2"></i>Lifetime Financial Performance (20 Years)
                </Card.Header>
                <Card.Body style={{ height: '350px' }}>
                  <Line 
                    options={{ 
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                        annotation: paybackPoint !== null ? {
                          annotations: {
                            paybackLine: {
                              type: 'line',
                              xMin: paybackPoint,
                              xMax: paybackPoint,
                              borderColor: 'red',
                              borderWidth: 2,
                              label: {
                                content: `Payback: Year ${paybackPoint?.toFixed(1)}`,
                                enabled: true,
                                position: 'start',
                                backgroundColor: 'red',
                                color: 'white',
                              }
                            }
                          }
                        } : {},
                        datalabels: { display: false }
                      },
                      scales: {
                        y: { title: { display: true, text: 'Cumulative Savings (R)' } }
                      } 
                    }} 
                    data={lifetimeCashflowChartData} 
                  />
                </Card.Body>
              </Card>
            </Col>
          </Row>

          {/* 2025 annual cost comparison */}
          <Card className="shadow-sm my-4">
            <Card.Header as="h5">
              <i className="bi bi-bar-chart-fill me-2"></i>2025 Annual Cost Comparison
            </Card.Header>
            <Card.Body>
              <div style={{ height: '350px' }}>
                <Bar
                  data={{
                    labels: ['2025 Costs'],
                    datasets: [
                      {
                        label: 'Current Cost (R)',
                        data: [oldCost2025],
                        backgroundColor: 'rgba(255, 99, 132, 0.5)'
                      },
                      {
                        label: 'New Cost (R)',
                        data: [newCost2025],
                        backgroundColor: 'rgba(54, 162, 235, 0.5)',
                        stack: 'combined'
                      },
                      {
                        label: 'Savings (R)',
                        data: [savings2025],
                        backgroundColor: 'rgba(75, 192, 192, 0.5)',
                        stack: 'combined'
                      }
                    ]
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      title: { display: true, text: '2025 Annual Cost Comparison' },
                      datalabels: { 
                        display: true, 
                        formatter: (value) => `R${value.toFixed(0)}`,
                        font: { weight: 'bold' },
                        color: 'white'
                      }
                    },
                    scales: {
                      y: { 
                        beginAtZero: true, 
                        title: { display: true, text: 'Rand' }, 
                        stacked: true 
                      },
                      x: { stacked: true }
                    }
                  }}
                />
              </div>
            </Card.Body>
          </Card>

          {/* 20 year savings */}
          <Card className="shadow-sm my-4">
            <Card.Header as="h5">
              <i className="bi bi-graph-up me-2"></i>Projected Savings Over 20 Years
            </Card.Header>
            <Card.Body>
              <div style={{ height: '350px' }}>
                <Bar
                  data={{
                    labels: financialResult.yearly_savings.map(r => r.year),
                    datasets: [{
                      label: 'Annual Savings (R)',
                      data: financialResult.yearly_savings.map(r => r.savings),
                      backgroundColor: 'rgba(75, 192, 192, 0.6)',
                      borderColor: 'rgba(75, 192, 192, 1)',
                      borderWidth: 1
                    }]
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      title: { display: true, text: 'Projected Savings Over 20 Years' },
                      datalabels: { display: false }
                    },
                    scales: {
                      y: { 
                        beginAtZero: true, 
                        title: { display: true, text: 'Rand' } 
                      },
                      x: { title: { display: true, text: 'Year' } }
                    }
                  }}
                />
              </div>
            </Card.Body>
          </Card>
        </>
      )}

      {/* Show notification if no simulation data */}
      {!simulationData && !loading && (
        <div className="text-center py-5">
          <i className="bi bi-exclamation-circle fs-1 text-warning"></i>
          <h4 className="mt-3">No Simulation Data Available</h4>
          <p className="text-muted mb-4">
            Please run a simulation in the System Design tab first before calculating financial metrics.
          </p>
        </div>
      )}
    </div>
  );
}

export default FinancialModeling;
