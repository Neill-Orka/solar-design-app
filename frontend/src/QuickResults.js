// import React, { useState, useEffect }from 'react';
// import { Button, Row, Col, Card, Alert, Spinner, Badge } from 'react-bootstrap'; // Added Row, Col, Card, Alert
// import axios from 'axios';

// // Helper to format currency
// const formatCurrency = (value) => {
//   if (typeof value !== 'number') return 'R0.00';
//   return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(value);
// };

// function QuickResults({ basicInfo, selectedProfile, selectedSystem, onGenerate, onBack }) {
//   const [results, setResults] = useState(null);
//   const [loading, setLoading] = useState(true);
//   const [error, setError] = useState('');

//   useEffect(() => {
//     console.log('--- QuickResults Props Received ---');
//     console.log('Received basicInfo:', basicInfo);
//     console.log('Received selectedProfile:', selectedProfile);
//     console.log('Received selectedSystem:', selectedSystem);

//     // Guard clause to ensure all the data that is needed is available
//     if (!basicInfo || !selectedProfile || !selectedSystem) {
//       setError("Cannot run simulation. Missing input data from previous steps.")
//       setLoading(false);
//       return;
//     }

//     const runSimulation = async () => {
//       setLoading(true);
//       setError('');
//       try {
//         const payload = {
//           basicInfo,
//           selectedProfile,
//           selectedSystem,
//         };

//         // --- ADD THIS LOG ---
//         console.log('--- API Call Payload ---');
//         console.log('Sending this payload to /api/quick_simulate:', JSON.stringify(payload, null, 2));
//         // --- END OF ADDED LOG ---

//         const reponse = await axios.post('http://localhost:5000/api/quick_simulation', payload);
//         setResults(reponse.data);
//       } catch (err) {
//         console.error("Simulation failed: ", err);
//         setError(err.response?.data?.error || "An unknown error occurred during simulation.");
//       } finally {
//         setLoading(false);
//       }
//     };

//     runSimulation();
//   }, [basicInfo, selectedProfile, selectedSystem]); // Rerun if any input changes

//   const renderResultCard = (title, value, unit, icon, colour) => (
//     <Col>
//       <Card className='text-center shadow-md border-0 rounded-lg h-100'>
//         <Card.Body className='p-4 d-flex flex-column align-items-center justify-content-center'>
//           <i className={`bi ${icon} fs-1 text-${colour} mb-3`}></i>
//           <Card.Subtitle className='text-xs text-gray-500 mb-1'>{title}</Card.Subtitle>
//           <Card.Title className={`text-2xl font-bold text-${colour}`}>
//             {value} {unit && <span className='text-lg font-medium'>{unit}</span> }
//           </Card.Title>
//         </Card.Body>
//       </Card>
//     </Col>
//   );

//       return (
//         <div
//             className="p-4 py-md-5 px-md-4 bg-white rounded-xl shadow-xl"
//             style={{ maxWidth: '800px', margin: '2rem auto' }}
//         >
//             <h2 className="text-2xl lg:text-3xl font-semibold text-gray-800 mb-4 text-center">Quick Simulation Results</h2>

//             {/* Input Summary Section */}
//             <Card className="mb-4 bg-light border-0 shadow-sm">
//                 <Card.Header className="bg-gray-200 text-dark font-semibold">
//                     <i className="bi bi-sliders me-2"></i>Simulation Inputs
//                 </Card.Header>
//                 <Card.Body className="p-3">
//                     <ul className="list-unstyled text-sm text-gray-700 mb-0">
//                         {basicInfo && <li><Badge bg="secondary" className="me-2">Client</Badge>Monthly Consumption: {basicInfo.consumption} kWh @ R{basicInfo.tariff}/kWh</li>}
//                         {selectedProfile && <li><Badge bg="secondary" className="me-2">Profile</Badge>{selectedProfile.name} (Scaled by: {selectedProfile.scaler || 1}x)</li>}
//                         {selectedSystem && <li><Badge bg="secondary" className="me-2">System</Badge>{selectedSystem.name} ({selectedSystem.panel_kw} kWp)</li>}
//                     </ul>
//                 </Card.Body>
//             </Card>

//             {/* Loading and Error States */}
//             {loading && (
//                 <div className="text-center py-5">
//                     <Spinner animation="border" variant="primary" style={{ width: '3rem', height: '3rem' }} />
//                     <p className="mt-3 text-muted">Running simulation, please wait...</p>
//                 </div>
//             )}
//             {error && <Alert variant="danger" className="text-center"><i className="bi bi-exclamation-triangle-fill me-2"></i><strong>Simulation Error:</strong> {error}</Alert>}

//             {/* Results Display Section */}
//             {results && !loading && !error && (
//                 <>
//                     <Row xs={1} md={3} className="g-4 mb-5">
//                         {renderResultCard("Estimated Annual Savings", formatCurrency(results.annual_savings), null, "bi-cash-coin", "success")}
//                         {renderResultCard("Payback Period", results.payback_period, "years", "bi-calendar-check", "info")}
//                         {renderResultCard("20-Year ROI", `${results.roi}%`, null, "bi-graph-up-arrow", "warning")}
//                     </Row>
//                     <div className="d-grid gap-2 d-md-flex justify-content-md-end">
//                         <Button variant="outline-secondary" onClick={onBack} className="px-5 py-2">
//                             <i className="bi bi-arrow-left me-2"></i>Back
//                         </Button>
//                         <Button variant="primary" onClick={onGenerate} className="px-5 py-2 fw-semibold" style={{backgroundColor: '#16a34a', borderColor: '#15803d'}}>
//                             <i className="bi bi-file-earmark-arrow-down-fill me-2"></i>Generate Proposal
//                         </Button>
//                     </div>
//                 </>
//             )}

//             {/* Back button for error state */}
//             {!loading && error && (
//                  <div className="text-center mt-4">
//                      <Button variant="outline-secondary" onClick={onBack} className="px-5 py-2">
//                          <i className="bi bi-arrow-left me-2"></i>Back
//                      </Button>
//                  </div>
//             )}
//         </div>
//     );
// }

// //   return (
// //     <div 
// //       className="p-4 py-md-5 px-md-4 bg-white rounded-xl shadow-xl" 
// //       style={{maxWidth: '800px', margin: '2rem auto'}} // Centered card
// //     >
// //       <h2 className="text-2xl lg:text-3xl font-semibold text-gray-800 mb-5 text-center">Quick Simulation Results</h2>

// //       {/* Display summary of inputs if available */}
// //       {(basicInfo || selectedProfile || selectedSystem) && (
// //         <Alert variant="light" className="mb-4 p-3 border rounded-lg shadow-sm">
// //           <h5 className="text-md font-semibold text-gray-700 mb-2">Based on your inputs:</h5>
// //           <ul className="list-unstyled text-xs text-gray-600 mb-0">
// //             {basicInfo && <li><i className="bi bi-lightning-fill me-2 text-muted"></i>Monthly Consumption: {basicInfo.consumption} kWh</li>}
// //             {selectedProfile && <li><i className="bi bi-person-lines-fill me-2 text-muted"></i>Selected Profile: {selectedProfile.name} (Scaled by: {selectedProfile.scaler || 1})</li>}
// //             {selectedSystem && <li><i className="bi bi-tools me-2 text-muted"></i>Selected System: {selectedSystem.name} ({selectedSystem.capacity_kw} kW)</li>}
// //           </ul>
// //         </Alert>
// //       )}
      
// //       <Row xs={1} md={3} className="g-4 mb-5">
// //         <Col>
// //           <Card className="text-center shadow-md border-0 rounded-lg h-100">
// //             <Card.Body className="p-4 d-flex flex-column align-items-center justify-content-center">
// //               <i className="bi bi-cash-coin fs-1 text-success mb-3"></i>
// //               <Card.Subtitle className="text-xs text-gray-500 mb-1">Estimated Annual Savings</Card.Subtitle>
// //               <Card.Title className="text-2xl font-bold text-success">
// //                 {formatCurrency(results.annualSavings)}
// //               </Card.Title>
// //             </Card.Body>
// //           </Card>
// //         </Col>
// //         <Col>
// //           <Card className="text-center shadow-md border-0 rounded-lg h-100">
// //             <Card.Body className="p-4 d-flex flex-column align-items-center justify-content-center">
// //               <i className="bi bi-calendar-check fs-1 text-info mb-3"></i>
// //               <Card.Subtitle className="text-xs text-gray-500 mb-1">Payback Period</Card.Subtitle>
// //               <Card.Title className="text-2xl font-bold text-info">
// //                 {results.paybackPeriod} <span className="text-lg font-medium">years</span>
// //               </Card.Title>
// //             </Card.Body>
// //           </Card>
// //         </Col>
// //         <Col>
// //           <Card className="text-center shadow-md border-0 rounded-lg h-100">
// //             <Card.Body className="p-4 d-flex flex-column align-items-center justify-content-center">
// //               <i className="bi bi-graph-up-arrow fs-1 text-warning mb-3"></i> {/* Changed icon for ROI */}
// //               <Card.Subtitle className="text-xs text-gray-500 mb-1">Return on Investment (ROI)</Card.Subtitle>
// //               <Card.Title className="text-2xl font-bold text-warning">
// //                 {results.roi}%
// //               </Card.Title>
// //             </Card.Body>
// //           </Card>
// //         </Col>
// //       </Row>

// //       <div className="d-grid gap-2 d-md-flex justify-content-md-end">
// //         <Button
// //           variant="outline-secondary"
// //           onClick={onBack}
// //           className="px-5 py-2 rounded-md shadow-sm hover:shadow-md transition-shadow order-md-1" // Back button first on mobile
// //         >
// //           <i className="bi bi-arrow-left me-2"></i>Back
// //         </Button>
// //         <Button
// //           variant="primary" // Changed from success to primary for consistency
// //           onClick={onGenerate}
// //           className="px-5 py-2 fw-semibold rounded-md shadow-md hover:shadow-lg transition-shadow order-md-2" // Generate button second on mobile
// //           style={{backgroundColor: '#16a34a', borderColor: '#15803d'}} // A nice green color
// //         >
// //           <i className="bi bi-file-earmark-arrow-down-fill me-2"></i>Generate Proposal
// //         </Button>
// //       </div>
// //     </div>
// //   );
// // }

// export default QuickResults;


import React, { useState, useEffect, useMemo } from 'react';
import { Button, Row, Col, Card, Alert, Spinner, Table, Badge } from 'react-bootstrap';
import axios from 'axios';
import { Line, Bar } from 'react-chartjs-2';
import {
    Chart as ChartJS,
    CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, TimeScale
} from 'chart.js';
import 'chartjs-adapter-date-fns';
import { enZA } from 'date-fns/locale';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, TimeScale);

// Helper to format currency
const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR', maximumFractionDigits: 0 }).format(value || 0);
};

// Main Component
function QuickResults({ basicInfo, selectedSystem, onBack }) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const runSimulation = async () => {
            const selectedProfile = JSON.parse(localStorage.getItem('selectedProfileForQuickDesign'));
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
    
    // Memoize chart data to prevent re-calculation on every render
    const energyChartData = useMemo(() => {
        if (!data?.simulation) return { labels: [], datasets: [] };
        
        const sim = data.simulation;
        // Display a sample week (336 half-hour intervals = 7 days)
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
            x: { type: 'time', time: { unit: 'day', tooltipFormat: 'MMM dd, yyyy' }, adapters: { date: { locale: enZA } } },
            y: { beginAtZero: true, title: { display: true, text: 'Power (kW)'} },
            y1: { type: 'linear', display: true, position: 'right', beginAtZero: true, max: 100, title: { display: true, text: 'Battery SOC (%)'}, grid: { drawOnChartArea: false } }
        }
    };
    
    // UI Rendering
    if (loading) return <div className="text-center p-5"><Spinner animation="border" variant="primary" /><p className="mt-2">Running simulations...</p></div>;
    if (error) return <div className="p-4"><Alert variant="danger"><strong>Error:</strong> {error}</Alert><Button onClick={onBack}>Back</Button></div>;
    if (!data) return <div className="p-4"><Alert variant="warning">No data returned from simulation.</Alert><Button onClick={onBack}>Back</Button></div>;

    const { financials, simulation } = data;

    return (
        <div className="p-lg-4" style={{ backgroundColor: '#f8f9fa' }}>
            <h2 className="text-3xl font-bold text-gray-800 mb-4 text-center">Quick Design Report</h2>
            
            {/* Key Financial KPIs */}
            <Row>
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
                                <tr><td>Solar Used On-Site</td><td className="text-end fw-bold">{financials.pv_used_on_site_kwh.toLocaleString()} kWh</td></tr>
                                <tr><td>Energy Imported from Grid</td><td className="text-end fw-bold text-danger">{financials.total_import_kwh.toLocaleString()} kWh</td></tr>
                                <tr><td>Self-Consumption Rate</td><td className="text-end fw-bold"><Badge bg="primary fs-6">{financials.self_consumption_rate}%</Badge></td></tr>
                                <tr><td>Grid Independence</td><td className="text-end fw-bold"><Badge bg="primary fs-6">{financials.grid_independence_rate}%</Badge></td></tr>
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

            <div className="text-center mt-3">
                 <Button variant="outline-secondary" onClick={onBack}>Back to System Selection</Button>
            </div>
        </div>
    );
}

export default QuickResults;
