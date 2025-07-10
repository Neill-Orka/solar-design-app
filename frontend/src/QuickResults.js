import React, { useState, useEffect, useMemo } from 'react';
import ReactDOM from 'react-dom';
import { Button, Row, Col, Card, Alert, Spinner, Table, Badge } from 'react-bootstrap';
import axios from 'axios';
import { Line, Bar } from 'react-chartjs-2';
import { Link } from 'react-router-dom';
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
    TimeScale
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
    
    // Memorized chart data to prevent re-calculation on every render
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
                { label: 'Battery SOC (%)', data: sim.battery_soc.slice(startIndex, endIndex), borderColor: '#4bc0c0', backgroundColor: '#4bc0c020', yAxisID: 'y1', tension: 0.3, pointRadius: 0, borderWidth: 2 }
        ];

        if (showLosses) {
            datasets.push({
                label: 'PV Generation (kW)',
                data: sim.generation.slice(startIndex, endIndex),
                borderColor: '#ffce56',
                backgroundColor: '#ffce5620',
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
                borderColor: '#ffce56',
                backgroundColor: '#ffce5620',
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

    const chartOptions = {
        responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
        scales: { 
            x: { type: 'time', time: { unit: 'day', tooltipFormat: 'MMM dd, HH:mm' }, adapters: { date: { locale: enZA } } },
            y: { beginAtZero: true, title: { display: true, text: 'Power (kW)'} },
            y1: { type: 'linear', display: true, position: 'right', beginAtZero: true, max: 100, title: { display: true, text: 'Battery SOC (%)'}, grid: { drawOnChartArea: false } }
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
                <Col md={4} className="mb-3"><Card className="text-center shadow-sm h-100"><Card.Body><div className="fs-1 text-success"><i className="bi bi-wallet2"></i></div><h5>Annual Savings</h5><h3 className="fw-bold">{formatCurrency(financials.annual_savings)}</h3></Card.Body></Card></Col>
                <Col md={4} className="mb-3"><Card className="text-center shadow-sm h-100"><Card.Body><div className="fs-1 text-info"><i className="bi bi-calendar-check"></i></div><h5>Payback Period</h5><h3 className="fw-bold">{financials.payback_period} Years</h3></Card.Body></Card></Col>
                <Col md={4} className="mb-3"><Card className="text-center shadow-sm h-100"><Card.Body><div className="fs-1 text-warning"><i className="bi bi-graph-up-arrow"></i></div><h5>20-Year ROI</h5><h3 className="fw-bold">{financials.roi}%</h3></Card.Body></Card></Col>
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
                           <Bar options={{ responsive: true, maintainAspectRatio: false, scales: { x: { stacked: false }, y: { stacked: false, title: {display: true, text: 'Cost (R)'} } } }} data={financialChartData} />
                        </Card.Body>
                    </Card>
                </Col>
            </Row>

            <div className="text-center mt-5">
                 <Button variant="outline-secondary" onClick={onBack} className="me-3">Back to System Selection</Button>
                 {/* This is the new button to generate the proposal */}
                  <Link to={`/proposal/${projectId}`} state={{ proposalData: data, clientName: clientName }} target="_blank" className="btn btn-primary btn-lg">
                     <i className="bi bi-file-earmark-arrow-down-fill me-2"></i>Generate Client Proposal
                  </Link>
            </div>
        </div>
    );
}

export default QuickResults;