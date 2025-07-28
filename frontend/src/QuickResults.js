import React, { useState, useEffect, useMemo, useContext } from 'react';
import ReactDOM from 'react-dom';
import { Button, Row, Col, Card, Alert, Spinner, Table, Badge } from 'react-bootstrap';
import axios from 'axios';
import { Line, Bar } from 'react-chartjs-2';
import { Link } from 'react-router-dom';
import annotationPlugin from 'chartjs-plugin-annotation';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    Title,
    Tooltip,
    Legend,
    TimeScale
} from 'chart.js';
import 'chartjs-adapter-date-fns';
import { enZA } from 'date-fns/locale';
import { API_URL } from './apiConfig';
import { EscalationContext } from './TariffEscalationContext';

import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    Title,
    Tooltip,
    Legend,
    TimeScale,
    annotationPlugin
);

// Helper to format currency
const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR', maximumFractionDigits: 0 }).format(value || 0);
};

// Main Component
function QuickResults({ projectId, basicInfo, selectedSystem, onBack, clientName }) { // Added clientName prop
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [startDate, setStartDate] = useState(null);
    const [endDate, setEndDate] = useState(null);
    const [showLosses, setShowLosses] = useState(false)

    const { schedule } = useContext(EscalationContext);

    useEffect(() => {
        const runSimulation = async () => {
            const selectedProfile = JSON.parse(localStorage.getItem('selectedProfileForQuickDesign'));

            console.log("Selected Profile:", selectedProfile);
            console.log("Scaler value:", selectedProfile?.scaler);
            const unscaledAnnualkWh = selectedProfile.profile_data.reduce((acc, dp) => acc + (dp.demand_kw || dp.Demand_kW || 0) *0.5, 0);
            console.log("Unscaled Annual kWh:", unscaledAnnualkWh);

            if (!basicInfo || !selectedProfile || !selectedSystem) {
                setError("Cannot run simulation because data from a previous step is missing.");
                setLoading(false);
                return;
            }
            try {
                const payload = { projectId: projectId, basicInfo, selectedProfile, selectedSystem };
                const response = await axios.post(`${API_URL}/api/quick_simulate`, payload);
                setData(response.data);

                if (response.data?.simulation?.timestamps?.length > 0)
                {
                    const timestamps = response.data.simulation.timestamps;
                    const firstDate = new Date(timestamps[0]);
                    const lastDate = new Date(timestamps[timestamps.length - 1]);

                    const defaultEndDate = new Date(firstDate);
                    defaultEndDate.setDate(firstDate.getDate() + 7); // Default to 7 days later

                    setStartDate(firstDate);
                    setEndDate(defaultEndDate > lastDate ? lastDate : defaultEndDate);
                }

            } catch (err) {
                setError(err.response?.data?.error || 'An API error occurred.');
            } finally {
                setLoading(false);
            }
        };
        runSimulation();
    }, [basicInfo, selectedSystem]);
    
    // Recompute lifetime cashflow series using escalation schedule and degradation
    const recomputedLifetime = useMemo(() => {
        if (!data?.financials?.lifetime_cashflow) return [];
        const orig = data.financials.lifetime_cashflow;
        const systemCost = Math.abs(orig[0].cashflow);
        const annualSavings = data.financials.annual_savings;
        const degradationRate = 0.005;
        let cumulative = -systemCost;
        const rows = [{ year: orig[0].year, cashflow: -systemCost, cumulative }];
        for (let i = 1; i < orig.length; i++) {
            const esc = schedule[i - 1] ?? schedule[schedule.length - 1] ?? 0.09;
            const escalated = annualSavings * Math.pow(1 + esc, i - 1);
            const net = escalated * Math.pow(1 - degradationRate, i - 1);
            cumulative += net;
            rows.push({ year: orig[i].year, cashflow: net, cumulative });
        }
        return rows;
    }, [data, schedule]);
    const energyChartData = useMemo(() => {
        if (!data?.simulation || !startDate || !endDate) 
        {
            return { labels: [], datasets: [] }
        };

        const sim = data.simulation;
        
        const startIndex = sim.timestamps.findIndex(t => new Date(t) >= startDate);
        let endIndex = sim.timestamps.findIndex(t => new Date(t) > endDate);    
        if (endIndex === -1) endIndex = sim.timestamps.length; // If no end date found, use full length

        if (startIndex === -1) return { labels: [], datasets: [] }; // If no start date found, return empty

        const labels = sim.timestamps.slice(startIndex, endIndex).map(t => new Date(t));

        const datasets = [
                { label: 'Demand (kW)', data: sim.demand.slice(startIndex, endIndex), borderColor: '#ff6384', backgroundColor: '#ff638420', tension: 0.3, pointRadius: 0, borderWidth: 2 },
                // { label: 'Solar Generation (kW)', data: sim.generation.slice(startIndex, endIndex), borderColor: '#ffce56', backgroundColor: '#ffce5620', tension: 0.3, pointRadius: 0, borderWidth: 2 },
                { label: 'Grid Import (kW)', data: sim.import_from_grid.slice(startIndex, endIndex), borderColor: '#cc65fe', backgroundColor: '#cc65fe20', tension: 0.3, pointRadius: 0, borderWidth: 1.5, borderDash: [5, 5] },
                { label: 'Battery SOC (%)', data: sim.battery_soc.slice(startIndex, endIndex), borderColor: '#ffce56', backgroundColor: '#ffce5620', yAxisID: 'y1', tension: 0.3, pointRadius: 0, borderWidth: 2 }
        ];

        if (showLosses) {
            datasets.push({
                label: 'PV Generation (kW)',
                data: sim.generation.slice(startIndex, endIndex),
                borderColor: '#4bc0c0',
                backgroundColor: '#4bc0c020',
                tension: 0.3,
                pointRadius: 0,
                borderWidth: 2,
                fill: true,              
            },
            {
                label: 'Throttling Losses',
                data: sim.potential_generation.slice(startIndex, endIndex),
                borderColor: 'transparent',
                backgroundColor: 'rgba(108, 117, 125, 0.3)',
                pointRadius: 0,
                fill: 3,
            }
        );
        } 
        else
        {
            datasets.push({
                label: 'PV Generation (kW)',
                data: sim.generation.slice(startIndex, endIndex),
                borderColor: '#4bc0c0',
                backgroundColor: '#4bc0c020',
                tension: 0.3,
                pointRadius: 0,
                borderWidth: 2
            });            
        }

        return { labels, datasets };
    }, [data, startDate, endDate, showLosses]);

    const financialChartData = useMemo(() => {
        if (!data?.financials?.cost_comparison) return { labels: [], datasets: [] };
        const fin = data.financials;
        const labels = fin.cost_comparison.map(item => new Date(item.month).toLocaleString('default', { month: 'short', year: '2-digit' }));
        return {
            labels,
            datasets: [
                { label: 'Old Bill', data: fin.cost_comparison.map(item => item.old_cost), backgroundColor: '#ff6384' },
                { label: 'New Bill (with Solar)', data: fin.cost_comparison.map(item => item.new_cost), backgroundColor: '#36a2eb' }
            ]
        };
    }, [data]);

    const costBreakdownChartData = useMemo(() => {
        if (!data?.financials?.cost_comparison) return { labels: [], datasets: [] };
        const fin = data.financials;
        const labels = fin.cost_comparison.map(item => new Date(item.month).toLocaleString('default', { month: 'short', year: '2-digit' }));

        const allDatasets = [
            {
                label: 'Old Bill - Energy',
                data: fin.cost_comparison.map(item => item.old_bill_breakdown.energy),
                backgroundColor: '#f87171',
                stack: 'Stack 0',
            },
            {
                label: 'Old Bill - Fixed',
                data: fin.cost_comparison.map(item => item.old_bill_breakdown.fixed),
                backgroundColor: '#9ca3af',
                stack: 'Stack 0',
            },
            {
                label: 'Old Bill - Demand',
                data: fin.cost_comparison.map(item => item.old_bill_breakdown.demand),
                backgroundColor: '#b91c1c',
                stack: 'Stack 0',
            },
            {
                label: 'New Bill - Energy',
                data: fin.cost_comparison.map(item => item.new_bill_breakdown.energy),
                backgroundColor: '#60a5fa',
                stack: 'Stack 1',
            },
            {
                label: 'New Bill - Fixed',
                data: fin.cost_comparison.map(item => item.new_bill_breakdown.fixed),
                backgroundColor: '#6b7280',
                stack: 'Stack 1',
            },
            {
                label: 'New Bill - Demand',
                data: fin.cost_comparison.map(item => item.new_bill_breakdown.demand),
                backgroundColor: '#1d4ed8',
                stack: 'Stack 1',
            }
        ];

        return {
            labels,
            datasets: allDatasets.filter(ds => ds.data.some(val => val !== 0 && val !== null))
        }; 
    }, [data]); 

    const lifetimeCashflowChartData = useMemo(() => {
        if (!recomputedLifetime.length) return { labels: [], datasets: [] };
        return {
            labels: recomputedLifetime.map(item => `Year ${item.year}`),
            datasets: [{
                label: 'Cumulative Cashflow (R)',
                data: recomputedLifetime.map(item => item.cumulative),
                borderColor: '#27ae60',
                backgroundColor: 'rgba(39, 174, 96, 0.1)',
                fill: true,
                tension: 0.3,
            }]
        };
    }, [recomputedLifetime]);

    // Determine the fractional payback index and label for payback period
    const paybackPoint = useMemo(() => {
        if (!recomputedLifetime.length) return null;
        const idx = recomputedLifetime.findIndex(item => item.cumulative >= 0);
        if (idx === -1) return null;
        if (idx === 0) return 0;
        const cumPrev = recomputedLifetime[idx - 1].cumulative;
        const cumCurr = recomputedLifetime[idx].cumulative;
        if (cumCurr === cumPrev) return idx;
        const fraction = -cumPrev / (cumCurr - cumPrev);
        return idx - 1 + fraction;
    }, [recomputedLifetime]);
    const paybackLabel = paybackPoint !== null
        ? `Year ${paybackPoint.toFixed(1)}`
        : null;

    const avgTariffSchedule = useMemo(() => {
        if (!data?.financials?.tariff_sample) return [];
        const baseAvg = data.financials.tariff_sample.reduce((sum, item) => sum + item.rate, 0) / data.financials.tariff_sample.length;
        let growth = 1;
        return Array.from({ length: 20 }, (_, i) => {
            const esc = schedule[i] ?? schedule[schedule.length - 1] ?? 0;
            growth *= (1 + esc);
            return { year: i + 1, tariff: baseAvg * growth };
        });
    }, [data, schedule]);

    const chartOptions = {
        responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
        scales: { 
            x: { type: 'time', time: { unit: 'day', tooltipFormat: 'MMM dd, HH:mm' }, adapters: { date: { locale: enZA } } },
            y: { beginAtZero: true, title: { display: true, text: 'Power (kW)'} },
            y1: { type: 'linear', display: true, position: 'right', beginAtZero: true, max: 100, title: { display: true, text: 'Battery SOC (%)'}, grid: { drawOnChartArea: false } }
        },
        plugins: {
            datalabels: { display: false },
        }
    };
    
    // UI Rendering
    if (loading) return <div className="text-center p-5"><Spinner animation="border" variant="primary" /><p className="mt-2">Running simulations...</p></div>;
    if (error) return <div className="p-4"><Alert variant="danger"><strong>Error:</strong> {error}</Alert><Button onClick={onBack}>Back</Button></div>;
    if (!data) return <div className="p-4"><Alert variant="warning">No data returned from simulation.</Alert><Button onClick={onBack}>Back</Button></div>;

    const { financials } = data;

    return (
        <div className="p-lg-4" style={{ backgroundColor: '#f8f9fa' }}>  
            <h2 className="text-3xl font-bold text-gray-800 mb-4 text-center">Quick Design Report</h2>
            
            <Row> {/* KPI Cards */}
                <Col md={3} className="mb-3"><Card className="text-center shadow-sm h-100"><Card.Body><div className="fs-1 text-success"><i className="bi bi-wallet2"></i></div><h5>Annual Savings</h5><h3 className="fw-bold">{formatCurrency(financials.annual_savings)}</h3></Card.Body></Card></Col>
                <Col md={3} className="mb-3"><Card className="text-center shadow-sm h-100"><Card.Body><div className="fs-1 text-primary"><i className="bi bi-lightning-charge-fill"></i></div><h5>LCOE</h5><h3 className="fw-bold">R {(() => {
                            const systemCost = Math.abs((data.financials.lifetime_cashflow || [])[0]?.cashflow || 0);
                            const annualGen = data.financials?.total_generation_kwh || 0;
                            const degradationRate = 0.005;
                            const maintenanceRate = 0.01;
                            const totalCost = systemCost * (1 + maintenanceRate * 20);
                            const genSum = Array.from({ length: 20 }, (_, i) => Math.pow(1 - degradationRate, i)).reduce((a, b) => a + b, 0) * annualGen;
                            return genSum > 0 ? (totalCost / genSum).toFixed(2) : '0.00';
                        })()}/kWh</h3></Card.Body></Card></Col>
                <Col md={3} className="mb-3"><Card className="text-center shadow-sm h-100"><Card.Body><div className="fs-1 text-info"><i className="bi bi-calendar-check"></i></div><h5>Payback Period</h5>
<h3 className="fw-bold">{paybackPoint !== null ? paybackPoint.toFixed(1) : financials.payback_period} Years</h3>
        </Card.Body></Card></Col>
                <Col md={3} className="mb-3"><Card className="text-center shadow-sm h-100"><Card.Body><div className="fs-1 text-warning"><i className="bi bi-graph-up-arrow"></i></div><h5>20-Year ROI</h5><h3 className="fw-bold">{financials.roi}%</h3></Card.Body></Card></Col>
            </Row>

            {/* Energy Flow Chart */}
            <Card className="shadow-sm my-4">
                <Card.Header as="h5" className='d-flex justify-content-between align-items-center flex-wrap'>
                    <span><i className="bi bi-bar-chart-line-fill me-2"></i>Weekly Energy Flow (Sample)</span>
                    <div className='d-flex align-items-center'>
                        {/* {Button to toggle losses view} */}
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
                            popperPlacement='bottem-end'
                            minDate={data?.simulation?.timestamps && new Date(data.simulation.timestamps[0])}
                            maxDate={data?.simulation?.timestamps && new Date(data.simulation.timestamps[data.simulation.timestamps.length - 1])}
                        />
                    </div>
                </Card.Header>
                <Card.Body style={{ height: '400px' }}>
                    <Line options={chartOptions} data={energyChartData} />
                </Card.Body>
            </Card>

            <Row>
                {/* Financial Summary Table */}
                <Col lg={6} className="mb-4">
                    <Card className="shadow-sm h-100">
                        <Card.Header as="h5"><i className="bi bi-piggy-bank-fill me-2"></i>Annual Performance</Card.Header>
                        <Table striped hover responsive className="mb-0">
                            <tbody>
                                <tr><td>Total Consumption</td><td className="text-end fw-bold">{financials.total_demand_kwh.toLocaleString()} kWh</td></tr>
                                <tr><td>Total Solar Production</td><td className="text-end fw-bold">{financials.total_generation_kwh.toLocaleString()} kWh</td></tr>
                                <tr><td>Potential Generation</td><td className='text-end fw-bold'>{financials.potential_generation_kwh.toLocaleString()} kWh</td></tr>
                                <tr><td>Energy Imported from Grid</td><td className="text-end fw-bold text-danger">{financials.total_import_kwh.toLocaleString()} kWh</td></tr>
                                <tr><td>Self-Consumption Rate</td><td className="text-end fw-bold"><Badge bg="primary" className="fs-6">{financials.self_consumption_rate}%</Badge></td></tr>
                                <tr><td>Grid Independence</td><td className="text-end fw-bold"><Badge bg="primary" className="fs-6">{financials.grid_independence_rate}%</Badge></td></tr>
                                <tr><td>Throttling Losses</td><td className='text-end fw-bold'><Badge bg="warning" text='dark' className='fs-6'>{financials.throttling_loss_percent}%</Badge></td></tr>
                                <tr><td>Yield (incl. throttling losses)</td><td className='text-end fw-bold'><Badge bg="secondary" className="fs-6">{financials.yield_incl_losses} kWh/kWp/day</Badge></td></tr>
                                <tr><td>Yield (excl. throttling losses)</td><td className='text-end fw-bold'><Badge bg="secondary" className="fs-6">{financials.yield_excl_losses} kWh/kWp/day</Badge></td></tr>
                            </tbody>
                        </Table>
                    </Card>
                </Col>

                {/* Monthly Cost Chart */}
                <Col lg={6} className="mb-4">
                    <Card className="shadow-sm h-100">
                        <Card.Header as="h5"><i className="bi bi-calendar-month-fill me-2"></i>Monthly Bill Comparison</Card.Header>
                        <Card.Body style={{ height: '350px' }}>
                           <Bar options={{ responsive: true, maintainAspectRatio: false, plugins: { datalabels: { display: false } }, scales: { x: { stacked: false }, y: { stacked: false, title: {display: true, text: 'Cost (R)'} } } }} data={financialChartData} />
                        </Card.Body>
                    </Card>
                </Col>
            </Row>

            <hr className="my-5" />
            <h2 className="text-2xl font-bold text-gray-700 mb-4 text-center">Tariff & Cost Analysis</h2>
            <Row>
                {/* Tariff Verification Table */}
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
                                    {financials.tariff_sample?.map((item, index) => (
                                        <tr key={index}>
                                            <td>{new Date(item.timestamp).toLocaleString('en-ZA', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                                            <td className="text-end fw-bold">{item.rate.toFixed(2)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </Table>
                        </Card.Body>
                    </Card>
                </Col>

                {/* Cost Breakdown Chart */}
                <Col lg={8} className="mb-4">
                    <Card className="shadow-sm h-100">
                        <Card.Header as="h5"><i className="bi bi-pie-chart-fill me-2"></i>Monthly Bill Composition (New Bill)</Card.Header>
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

            <hr className="my-5" />
            <h2 className="text-2xl font-bold text-gray-700 mb-4 text-center">Advanced Financial Analysis</h2>
            <Row>
                {/* Bill Fluctuation Analysis */}
                <Col lg={5} className="mb-4">
                    <Card className="shadow-sm h-100">
                        <Card.Header as="h5"><i className="bi bi-calendar-range-fill me-2"></i>Bill Fluctuation Analysis</Card.Header>
                        <Card.Body className="d-flex flex-column justify-content-center">
                            <p className="text-muted">An estimate of the highest and lowest monthly bills you can expect after installing solar.</p>
                            <Table borderless className="text-center mt-3">
                                <thead>
                                    <tr>
                                        <th><Badge bg="danger" className="fs-6 px-3 py-2">Highest Bill</Badge></th>
                                        <th><Badge bg="success" className="fs-6 px-3 py-2">Lowest Bill</Badge></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr className="align-middle">
                                        <td className="py-3"><h4 className="fw-bold mb-0">{formatCurrency(financials.bill_fluctuation.worst.cost)}</h4><span className="text-muted small">({new Date(financials.bill_fluctuation.worst.month).toLocaleString('default', { month: 'long' })})</span></td>
                                        <td className="py-3"><h4 className="fw-bold mb-0">{formatCurrency(financials.bill_fluctuation.best.cost)}</h4><span className="text-muted small">({new Date(financials.bill_fluctuation.best.month).toLocaleString('default', { month: 'long' })})</span></td>
                                    </tr>
                                </tbody>
                            </Table>
                        </Card.Body>
                    </Card>
                </Col>
                {/* Lifetime Cashflow Chart */}
                <Col lg={7} className="mb-4">
                     <Card className="shadow-sm h-100">
                        <Card.Header as="h5"><i className="bi bi-cash-stack me-2"></i>Lifetime Financial Performance (20 Years)</Card.Header>
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
                                                        content: paybackLabel || 'Payback',
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

            
            <div className="text-center mt-5">
                 <Button variant="outline-secondary" onClick={onBack} className="me-3">Back to System Selection</Button>
                  <Link to={`/proposal/${projectId}`} target="_blank" className="btn btn-primary btn-lg">
                     <i className="bi bi-file-earmark-arrow-down-fill me-2"></i>Generate Client Proposal
                  </Link>
                {/* Debug: Average tariff escalation schedule table */}
                <Table striped bordered size="sm" className="mt-4 mx-auto" style={{ maxWidth: '400px' }}>
                    <thead>
                        <tr><th>Year</th><th>Avg Tariff (R/kWh)</th></tr>
                    </thead>
                    <tbody>
                        {avgTariffSchedule.map(item => (
                            <tr key={item.year}>
                                <td>{item.year}</td>
                                <td className="text-end">{item.tariff.toFixed(2)}</td>
                            </tr>
                        ))}
                    </tbody>
                </Table>
            </div>
        </div>
    );
}

export default QuickResults;