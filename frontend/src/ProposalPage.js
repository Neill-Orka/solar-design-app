import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Spinner, Alert, Button } from 'react-bootstrap';
import axios from 'axios';
import { Line, Bar, Pie } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, TimeScale } from 'chart.js';
import 'chartjs-adapter-date-fns';
import { enZA } from 'date-fns/locale';
import logo from './assets/orka_logo_transparent_background.png';
import './ProposalPage.css';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { API_URL } from './apiConfig';

// Register all necessary Chart.js components
ChartJS.register(ArcElement, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, TimeScale);

const formatCurrency = (value) => new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR', maximumFractionDigits: 0 }).format(value || 0);

// Helper for date picker
const ChartHeaderWithDatePicker = ({ title, selectedDate, setSelectedDate, minDate, maxDate }) => (
    <div className="chart-header">
        <h3>{title}</h3>
        <div className="no-print date-picker-wrapper">
            <DatePicker
                selected={selectedDate}
                onChange={(date) => setSelectedDate(date)}
                dateFormat="MMM d, yyyy"
                className="form-control form-control-sm"
                popperPlacement="bottom-end"
                minDate={minDate}
                maxDate={maxDate}
            />
        </div>
    </div>
);

function ProposalPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [selectedDay, setSelectedDay] = useState(null);
    const [selectedWeekStart, setSelectedWeekStart] = useState(null);


    useEffect(() => {
        document.body.classList.add('proposal-body');
        axios.get(`${API_URL}/api/proposal_data/${id}`)
            .then(response => {
                setData(response.data);
                document.title = `Proposal for ${response.data.client_name}`;

                if (response.data?.simulation?.timestamps?.length > 0) {
                    const firstDate = new Date(response.data.simulation.timestamps[0]);
                    setSelectedDay(firstDate);
                    setSelectedWeekStart(firstDate);
                }
            })
            .catch(err => setError(err.response?.data?.error || 'Failed to load proposal data.'))
            .finally(() => setLoading(false));
        
        return () => {
            document.body.classList.remove('proposal-body');
        };
    }, [id]);

    const dailyChartData = useMemo(() => {
        if (!data?.simulation || !selectedDay) return { labels: [], datasets: [] };

        const sim = data.simulation;
        const targetDateStr = selectedDay.toDateString();

        const startIndex = sim.timestamps.findIndex(t => new Date(t).toDateString() === targetDateStr);
        if (startIndex === -1) return { labels: [], datasets: [] };

        const endIndex = startIndex + 48;
        const labels = sim.timestamps.slice(startIndex, endIndex).map(t => new Date(t));
        
        return {
            labels,
            datasets: [
                { label: 'Home Energy Demand (kW)', data: sim.demand.slice(startIndex, endIndex), borderColor: '#ef4444', backgroundColor: '#fee2e2', fill: false, tension: 0.3, pointRadius: 0 },
                { label: 'Solar Production (kW)', data: sim.generation.slice(startIndex, endIndex), borderColor: '#f59e0b', backgroundColor: '#fef3c7', fill: false, tension: 0.3, pointRadius: 0 },
                { label: 'Grid Import (kW)', data: sim.import_from_grid.slice(startIndex, endIndex), borderColor: '#8b5cf6', fill: false, borderWidth: 1.5, borderDash: [5, 5], pointRadius: 0 },
                { label: 'Battery SOC (%)', data: sim.battery_soc.slice(startIndex, endIndex), borderColor: '#22c55e', yAxisID: 'y1', pointRadius: 0, borderWidth: 2.5 }
            ]
        };
    }, [data, selectedDay]);
    
    const weeklyChartData = useMemo(() => {
        if (!data?.simulation || !selectedWeekStart) return { labels: [], datasets: [] };

        const sim = data.simulation;
        const weekStart = new Date(selectedWeekStart);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 7);
        
        const startIndex = sim.timestamps.findIndex(t => new Date(t) >= weekStart);
        if (startIndex === -1) return { labels: [], datasets: [] };

        let endIndex = sim.timestamps.findIndex(t => new Date(t) >= weekEnd);
        if (endIndex === -1) endIndex = sim.timestamps.length;

        const labels = sim.timestamps.slice(startIndex, endIndex).map(t => new Date(t));

        return {
            labels,
            datasets: [
                { label: 'Home Energy Demand (kW)', data: sim.demand.slice(startIndex, endIndex), borderColor: '#ef4444', fill: false, tension: 0.3, pointRadius: 0 },
                { label: 'Solar Production (kW)', data: sim.generation.slice(startIndex, endIndex), borderColor: '#f59e0b', fill: false, tension: 0.3, pointRadius: 0 },
                { label: 'Grid Import (kW)', data: sim.import_from_grid.slice(startIndex, endIndex), borderColor: '#8b5cf6', fill: false, borderWidth: 1.5, borderDash: [5, 5], pointRadius: 0 },
                { label: 'Battery SOC (%)', data: sim.battery_soc.slice(startIndex, endIndex), borderColor: '#22c55e', yAxisID: 'y1', pointRadius: 0, borderWidth: 2.5 }
            ]
        };
    }, [data, selectedWeekStart]);

    const monthlyChartData = useMemo(() => {
        if (!data?.financials?.cost_comparison) return { labels: [], datasets: [] };
        const labels = data.financials.cost_comparison.map(item => new Date(item.month).toLocaleString('en-US', { month: 'short' }));
        return {
            labels,
            datasets: [
                { label: 'Current Estimated Bill', data: data.financials.cost_comparison.map(item => item.old_cost), backgroundColor: '#6b7280', borderRadius: 4 },
                { label: 'New Bill with Solar', data: data.financials.cost_comparison.map(item => item.new_cost), backgroundColor: '#3b82f6', borderRadius: 4 }
            ]
        };
    }, [data]);

    const energyMixChartData = useMemo(() => {
        if (!data?.financials) return { labels: [], datasets: [] };
        const indRate = data.financials.grid_independence_rate;
        return {
            labels: ['From Your Solar System', 'From The Grid'],
            datasets: [{
                data: [indRate, 100 - indRate],
                backgroundColor: ['#f59e0b', '#ef4444'],
                borderColor: ['#fff'],
                borderWidth: 2,
                hoverOffset: 4
            }]
        };
    }, [data]);

    const dailyChartOptions = {
        responsive: true, maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        scales: {
            x: { type: 'time', time: { unit: 'hour', tooltipFormat: 'HH:mm' }, adapters: { date: { locale: enZA } }, grid: { display: false } },
            y: { beginAtZero: true, title: { display: true, text: 'Power (kW)'} },
            y1: { type: 'linear', display: true, position: 'right', beginAtZero: true, max: 100, title: { display: true, text: 'Battery SOC (%)'}, grid: { drawOnChartArea: false } }
        },
        plugins: { legend: { position: 'bottom' } }
    };
    
    if (loading) return <div className="loading-container"><Spinner animation="border" variant="primary" /></div>;
    if (error) return <div className="loading-container"><Alert variant="danger">{error}</Alert></div>;
    if (!data) return <div className="loading-container"><Alert variant="info">No data found for this proposal.</Alert></div>;

    const { client_name, location, selected_system, financials } = data;
    const minDate = data?.simulation?.timestamps ? new Date(data.simulation.timestamps[0]) : new Date();
    const maxDate = data?.simulation?.timestamps ? new Date(data.simulation.timestamps[data.simulation.timestamps.length - 1]) : new Date();

    return (
        <>
            <div className="print-controls no-print">
                <Button variant="light" onClick={() => navigate(-1)}><i className="bi bi-arrow-left"></i> Back</Button>
                <Button variant="primary" onClick={() => window.print()}><i className="bi bi-printer-fill"></i> Print or Save as PDF</Button>
            </div>
            
            <main className="proposal-container">
                <section className="page cover-page">
                     <img src={logo} alt="Orka Solar Logo" className="logo" />
                     <h1 className="main-title">Orka Solar Proposal</h1>
                     <p className="subtitle">A Custom Solar & Battery Solution</p>
                     <div className="client-info">
                         <p>Prepared For:</p>
                         <h2>{client_name}</h2>
                         <p className="location-info">{location || '[Client Address Placeholder]'}</p>
                     </div>
                     <div className="footer-info">
                        <p>Date: {new Date().toLocaleDateString('en-ZA', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                        <p>Proposal ID: QD-{id}</p>
                    </div>
                </section>
                
                <section className="page">
                    <h2 className="section-title">Executive Summary</h2>
                    <p className="intro-text">
                        {/* We understand that rising electricity costs and unreliable power from the grid are significant challenges. This proposal outlines a state-of-the-art solar and battery storage solution, custom-designed to reduce your bills, provide seamless backup during load shedding, and secure your energy future. */}
                        Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum."
                    </p>
                    <div className="kpi-grid">
                        <div className="kpi-card">
                            <p className="kpi-icon savings"><i className="bi bi-wallet2"></i></p>
                            <h3>Estimated Annual Savings</h3>
                            <p className="kpi-value savings-value">{formatCurrency(financials.annual_savings)}</p>
                        </div>
                        <div className="kpi-card">
                             <p className="kpi-icon payback"><i className="bi bi-calendar-check"></i></p>
                            <h3>Simple Payback Period</h3>
                            <p className="kpi-value payback-value">{financials.payback_period} <span className="kpi-unit">Years</span></p>
                        </div>
                        <div className="kpi-card">
                             <p className="kpi-icon independence"><i className="bi bi-shield-check"></i></p>
                            <h3>Grid Independence</h3>
                            <p className="kpi-value independence-value">{financials.grid_independence_rate}%</p>
                        </div>
                    </div>
                     <div className="investment-card">
                        <h3>Total Turnkey Investment</h3>
                        <p>{formatCurrency(selected_system.total_cost)}</p>
                        <span>(Including all hardware, installation, and certifications)</span>
                    </div>
                </section>

                 <section className="page">
                    <h2 className="section-title">Your Custom Solution</h2>
                    {/* <p className="intro-text" style={{ textAlign: 'center', marginTop: '-1rem', marginBottom: '2rem' }}>
                        Based on your energy needs, we have designed the following high-performance solar solution.
                    </p> */}
                    <div className="summary-grid">
                        <div className="summary-card">
                            <p className="summary-icon solar"><i className="bi bi-grid-3x3-gap-fill"></i></p>
                            <h3>PV Capacity</h3>
                            <p className="summary-value">{selected_system.panel_kw} <span className="summary-unit">kWp</span></p>
                        </div>
                        <div className="summary-card">
                            <p className="summary-icon inverter"><i className="bi bi-box-seam"></i></p>
                            <h3>Inverter Power</h3>
                            <p className="summary-value">{selected_system.inverter_kva} <span className="summary-unit">kVA</span></p>
                        </div>
                        {selected_system.battery_kwh > 0 && (
                            <div className="summary-card">
                                <p className="summary-icon battery"><i className="bi bi-battery-full"></i></p>
                                <h3>Battery Storage</h3>
                                <p className="summary-value">{selected_system.battery_kwh} <span className="summary-unit">kWh</span></p>
                            </div>
                        )}
                    </div>
                    <h3 className='component-list-title'>System Components</h3>                    
                    <div className="system-grid">
                        {selected_system.components.map(comp => (
                            <div key={comp.product_id} className="component-card">
                                <div className="component-icon">
                                    {comp.category === 'panel' && <i className="bi bi-grid-3x3-gap-fill"></i>}
                                    {comp.category === 'inverter' && <i className="bi bi-box-seam"></i>}
                                    {comp.category === 'battery' && <i className="bi bi-battery-full"></i>}
                                </div>
                                <div className="component-details">
                                    <h4>{comp.quantity}x {comp.brand} {comp.model}</h4>
                                    <p>A high-performance {comp.category} chosen for its reliability and industry-leading warranty.</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                <section className="page">
                     <h2 className="section-title">Performance & Financials</h2>
                     <div className="chart-container half-page">
                        <ChartHeaderWithDatePicker
                            title="Daily Performance Overview"
                            selectedDate={selectedDay}
                            setSelectedDate={setSelectedDay}
                            minDate={minDate}
                            maxDate={maxDate}
                        />
                        <div className='chart-wrapper' style={{height: '350px'}}><Line options={dailyChartOptions} data={dailyChartData}/></div>
                     </div>
                      <div className="chart-container half-page">
                        <ChartHeaderWithDatePicker
                            title="Weekly Performance Overview"
                            selectedDate={selectedWeekStart}
                            setSelectedDate={setSelectedWeekStart}
                            minDate={minDate}
                            maxDate={maxDate}
                        />
                        <div className="chart-wrapper" style={{height: '350px'}}><Line options={dailyChartOptions} data={weeklyChartData} /></div>
                     </div>
                </section>

                <section className='page'>
                    <h3 className='section-title'>Monthly Bill: Before vs. After</h3>
                    <div className='chart-wrapper' style={{ height: '350px' }}><Bar options={{ responsive: true, maintainAspectRatio:false, scales: {y: { title: { display: true, text: 'Estimated Monthly Cost (R)'}}} }} data={monthlyChartData}/></div>
                </section>
                
                <section className="page">
                     <h2 className="section-title">In-Depth Analysis</h2>
                     <div className="analysis-grid">
                        <div className="chart-container third-page">
                             <h3>Your New Energy Mix</h3>
                             <div className="chart-wrapper" style={{height: '250px'}}><Pie data={energyMixChartData} options={{responsive: true, maintainAspectRatio: false, plugins: {legend: {position: 'bottom'}}}} /></div>
                        </div>
                        <div className="table-container two-thirds-page">
                            <h3>Annual Performance Summary</h3>
                            <table>
                                <tbody>
                                    <tr><td>Total Annual Consumption</td><td>{financials.total_demand_kwh.toLocaleString()} kWh</td></tr>
                                    <tr><td>Total Solar Production</td><td>{financials.total_generation_kwh.toLocaleString()} kWh</td></tr>
                                    <tr><td>Bill Before Solar</td><td>{financials.original_annual_cost ? formatCurrency(financials.original_annual_cost) : 'N/A'}</td></tr>
                                    <tr><td>Bill After Solar</td><td>{financials.new_annual_cost ? formatCurrency(financials.new_annual_cost) : 'N/A'}</td></tr>
                                    {/* <tr><td>Solar Used On-Site</td><td>{financials.pv_used_on_site_kwh.toLocaleString()} kWh</td></tr> */}
                                    <tr className="import-row"><td>Energy Imported from Grid</td><td>{financials.total_import_kwh.toLocaleString()} kWh</td></tr>
                                    {/* <tr className="highlight-row"><td>Self-Consumption Rate</td><td>{financials.self_consumption_rate}%</td></tr> */}
                                    <tr className="highlight-row"><td>Grid Independence</td><td>{financials.grid_independence_rate}%</td></tr>
                                </tbody>
                            </table>
                        </div>
                     </div>
                </section>

                 <section className="page">
                     <h2 className="section-title">Next Steps</h2>
                     <p className="intro-text">Ready to secure your energy future? Here's how simple it is to get started:</p>
                        <ol className="timeline">
                            <li><strong>Acceptance:</strong> Sign this proposal to lock in your price and components.</li>
                            <li><strong>Site Inspection:</strong> Our engineers will conduct a final technical site visit to confirm all measurements.</li>
                            <li><strong>Installation:</strong> Our certified in-house team will install your system with minimal disruption.</li>
                            <li><strong>Handover:</strong> We'll commission the system and show you how to use your new energy monitoring app.</li>
                        </ol>
                     <div className="signature-area">
                        <p>Proposal valid until: {new Date(new Date().setDate(new Date().getDate() + 30)).toLocaleDateString('en-ZA')}</p>
                        <div className="signature-boxes">
                            <div className="box">
                                <div className="line"></div>
                                <p>Signature: {client_name}</p>
                            </div>
                             <div className="box">
                                <div className="line"></div>
                                <p>Date</p>
                            </div>
                        </div>
                    </div>
                 </section>
            </main>
        </>
    );
}
export default ProposalPage;