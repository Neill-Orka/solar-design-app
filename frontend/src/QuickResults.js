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
import ProposalView from './ProposalView'; // Import the new proposal component

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

// A new utility component to handle rendering content in a new browser window
function NewWindow({ children, closeWindow }) {
    const [container, setContainer] = useState(null);
    const newWindow = React.useRef(null);

    useEffect(() => {
        // Open a new window and set its basic structure
        newWindow.current = window.open('', '', 'width=1024,height=768');
        
        // This is the HTML structure for the new window's head
        const headContent = `
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Solar Proposal</title>
            <script src="https://cdn.tailwindcss.com"></script>
            <link rel="stylesheet" href="https://rsms.me/inter/inter.css" />
            <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.10.5/font/bootstrap-icons.css">
            <style>
                body { font-family: 'Inter', sans-serif; background-color: #f3f4f6; }
                @media print {
                    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                    .no-print { display: none; }
                    .page-break { page-break-before: always; }
                }
            </style>
        `;
        
        newWindow.current.document.head.innerHTML = headContent;
        
        // Create a root div for our React app to mount to
        const root = newWindow.current.document.createElement('div');
        newWindow.current.document.body.appendChild(root);
        
        // Set the container state to this new root div
        setContainer(root);
        
        // Add an event listener to call the closeWindow prop when the new window is closed by the user
        const interval = setInterval(() => {
            if (newWindow.current.closed) {
                closeWindow();
                clearInterval(interval);
            }
        }, 500);

        // Cleanup function to close the window when this component unmounts
        return () => {
            clearInterval(interval);
            if (newWindow.current && !newWindow.current.closed) {
                newWindow.current.close();
            }
        };
    }, []); // Empty dependency array means this runs once

    return container && ReactDOM.createPortal(children, container);
}

// Helper to format currency
const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR', maximumFractionDigits: 0 }).format(value || 0);
};

// Main Component
function QuickResults({ projectId, basicInfo, selectedSystem, onBack, clientName }) { // Added clientName prop
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showProposal, setShowProposal] = useState(false); // State to control the proposal window

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
                const payload = { basicInfo, selectedProfile, selectedSystem };
                const response = await axios.post('http://localhost:5000/api/quick_simulate', payload);
                setData(response.data);
            } catch (err) {
                setError(err.response?.data?.error || 'An API error occurred.');
            } finally {
                setLoading(false);
            }
        };
        runSimulation();
    }, [basicInfo, selectedSystem]);
    
    // Memoized chart data to prevent re-calculation on every render
    const energyChartData = useMemo(() => {
        if (!data?.simulation) return { labels: [], datasets: [] };
        const sim = data.simulation;
        const sampleSize = 336;
        const labels = sim.timestamps.slice(0, sampleSize).map(t => new Date(t));
        return {
            labels,
            datasets: [
                { label: 'Demand (kW)', data: sim.demand.slice(0, sampleSize), borderColor: '#ff6384', backgroundColor: '#ff638420', tension: 0.3, pointRadius: 0, borderWidth: 2 },
                { label: 'Solar Generation (kW)', data: sim.generation.slice(0, sampleSize), borderColor: '#ffce56', backgroundColor: '#ffce5620', tension: 0.3, pointRadius: 0, borderWidth: 2 },
                { label: 'Grid Import (kW)', data: sim.import_from_grid.slice(0, sampleSize), borderColor: '#cc65fe', backgroundColor: '#cc65fe20', tension: 0.3, pointRadius: 0, borderWidth: 1.5, borderDash: [5, 5] },
                { label: 'Battery SOC (%)', data: sim.battery_soc.slice(0, sampleSize), borderColor: '#4bc0c0', backgroundColor: '#4bc0c020', yAxisID: 'y1', tension: 0.3, pointRadius: 0, borderWidth: 2 }
            ]
        };
    }, [data]);

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
            {/* This is the new window that will open when we click the button
            {showProposal && (
                <NewWindow>
                    <ProposalView 
                        data={data} 
                        basicInfo={basicInfo} 
                        selectedSystem={selectedSystem} 
                        clientName={clientName} 
                    />
                </NewWindow>
            )} */}

            <h2 className="text-3xl font-bold text-gray-800 mb-4 text-center">Quick Design Report</h2>
            
            <Row> {/* KPI Cards */}
                <Col md={4} className="mb-3"><Card className="text-center shadow-sm h-100"><Card.Body><div className="fs-1 text-success"><i className="bi bi-wallet2"></i></div><h5>Annual Savings</h5><h3 className="fw-bold">{formatCurrency(financials.annual_savings)}</h3></Card.Body></Card></Col>
                <Col md={4} className="mb-3"><Card className="text-center shadow-sm h-100"><Card.Body><div className="fs-1 text-info"><i className="bi bi-calendar-check"></i></div><h5>Payback Period</h5><h3 className="fw-bold">{financials.payback_period} Years</h3></Card.Body></Card></Col>
                <Col md={4} className="mb-3"><Card className="text-center shadow-sm h-100"><Card.Body><div className="fs-1 text-warning"><i className="bi bi-graph-up-arrow"></i></div><h5>20-Year ROI</h5><h3 className="fw-bold">{financials.roi}%</h3></Card.Body></Card></Col>
            </Row>

            {/* Energy Flow Chart */}
            <Card className="shadow-sm my-4">
                <Card.Header as="h5"><i className="bi bi-bar-chart-line-fill me-2"></i>Weekly Energy Flow (Sample)</Card.Header>
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
                                <tr><td>Yield (incl. throttling losses)</td><td className='text-end fw-bold'><Badge bg="secondary" className="fs-6">{financials.yield_incl_losses} kWp/kWh/day</Badge></td></tr>
                                <tr><td>Yield (excl. throttling losses)</td><td className='text-end fw-bold'><Badge bg="secondary" className="fs-6">{financials.yield_excl_losses} kWp/kWh/day</Badge></td></tr>
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
                  <Link to={`/proposal/${projectId}`} target="_blank" className="btn btn-primary btn-lg">
                     <i className="bi bi-file-earmark-arrow-down-fill me-2"></i>Generate Client Proposal
                  </Link>
            </div>
        </div>
    );
}

export default QuickResults;