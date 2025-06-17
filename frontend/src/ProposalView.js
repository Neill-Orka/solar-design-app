// import React, { useEffect, useMemo } from 'react';
// import { Line, Bar, Pie } from 'react-chartjs-2';
// import { Chart as ChartJS, ArcElement, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend } from 'chart.js';
// import logo from './assets/orka_logo_transparent_background.png'; // Assuming you have your logo

// ChartJS.register(ArcElement, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend);

// // Helper to format currency
// const formatCurrency = (value) => new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR', maximumFractionDigits: 0 }).format(value || 0);

// // The main component for the proposal layout
// function ProposalView({ data, basicInfo, selectedSystem, clientName }) {
//     // This effect changes the new window's title
//     useEffect(() => {
//         document.title = `Solar Proposal for ${clientName || 'Valued Client'}`;
//     }, [clientName]);

//     // Memoize chart data to avoid re-calculating
//     const dailyChartData = useMemo(() => {
//         if (!data?.simulation) return { labels: [], datasets: [] };
//         const sim = data.simulation;
//         const sampleSize = 48; // 24 hours
//         const labels = sim.timestamps.slice(0, sampleSize).map(t => new Date(t));
//         return {
//             labels,
//             datasets: [
//                 { label: 'Home Energy Demand (kW)', data: sim.demand.slice(0, sampleSize), borderColor: '#ef4444', backgroundColor: '#ef444433', fill: true, tension: 0.3, pointRadius: 0 },
//                 { label: 'Solar Production (kW)', data: sim.generation.slice(0, sampleSize), borderColor: '#f59e0b', backgroundColor: '#f59e0b33', fill: true, tension: 0.3, pointRadius: 0 },
//                 { label: 'Battery SOC (%)', data: sim.battery_soc.slice(0, sampleSize), borderColor: '#22c55e', yAxisID: 'y1', pointRadius: 0 }
//             ]
//         };
//     }, [data]);
    
//     const monthlyChartData = useMemo(() => {
//         if (!data?.financials?.cost_comparison) return { labels: [], datasets: [] };
//         const labels = data.financials.cost_comparison.map(item => new Date(item.month).toLocaleString('default', { month: 'short' }));
//         return {
//             labels,
//             datasets: [
//                 { label: 'Current Estimated Bill', data: data.financials.cost_comparison.map(item => item.old_cost), backgroundColor: '#6b7280' },
//                 { label: 'New Bill with Solar', data: data.financials.cost_comparison.map(item => item.new_cost), backgroundColor: '#3b82f6' }
//             ]
//         };
//     }, [data]);

//     const energyMixChartData = useMemo(() => {
//         if (!data?.financials) return { labels: [], datasets: [] };
//         const indRate = data.financials.grid_independence_rate;
//         return {
//             labels: ['From Solar System', 'From Grid'],
//             datasets: [{
//                 data: [indRate, 100 - indRate],
//                 backgroundColor: ['#f59e0b', '#ef4444'],
//                 hoverOffset: 4
//             }]
//         };
//     }, [data]);

//     if (!data || !basicInfo || !selectedSystem) return <div className="p-10">Loading proposal data...</div>;

//     const { financials } = data;

//     return (
//         <>
//             {/* Inject Tailwind CSS and a custom font into the new window */}
//             <script src="https://cdn.tailwindcss.com"></script>
//             <link rel="stylesheet" href="https://rsms.me/inter/inter.css" />
//             <style>{`
//                 body { font-family: 'Inter', sans-serif; }
//                 @media print {
//                     body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
//                     .no-print { display: none; }
//                     .page-break { page-break-before: always; }
//                 }
//             `}</style>
            
//             <main className="max-w-4xl mx-auto bg-white text-gray-800 p-4 sm:p-8 md:p-12">
//                 {/* --- 1. COVER PAGE --- */}
//                 <section className="h-screen flex flex-col text-center justify-between py-12">
//                     <div>
//                         <img src={logo} alt="Orka Solar Logo" className="w-48 mx-auto mb-4" />
//                         <h1 className="text-4xl sm:text-5xl font-bold text-blue-600">Your Path to Energy Independence</h1>
//                         <p className="text-lg text-gray-600 mt-2">A Custom Solar & Battery Solution</p>
//                     </div>
//                     <div>
//                         <p className="text-lg font-semibold">Prepared For:</p>
//                         <p className="text-2xl text-gray-700">{clientName || '[Client Name Placeholder]'}</p>
//                         <p className="text-md text-gray-500 mt-4">For Property at: [Client Address Placeholder]</p>
//                         <p className="text-md text-gray-500">Date: {new Date().toLocaleDateString('en-ZA')}</p>
//                     </div>
//                     <div className="text-xs text-gray-400">
//                         Proposal ID: QD-{selectedSystem.id}-{new Date().getTime()}
//                     </div>
//                 </section>

//                 <div className="page-break"></div>

//                 {/* --- 2. EXECUTIVE SUMMARY --- */}
//                 <section className="py-8">
//                     <h2 className="text-3xl font-bold border-b-2 border-blue-500 pb-2 mb-6">Executive Summary</h2>
//                     <p className="text-lg text-gray-600 mb-8">
//                         We understand that rising electricity costs and unreliable power from the grid are significant challenges. 
//                         This proposal outlines a state-of-the-art solar and battery storage solution, custom-designed to reduce your bills,
//                         provide seamless backup during load shedding, and secure your energy future.
//                     </p>
//                     <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
//                         <div className="bg-blue-50 p-6 rounded-lg shadow-md">
//                             <p className="text-blue-600 text-4xl mb-2"><i className="bi bi-wallet2"></i></p>
//                             <h3 className="text-xl font-bold text-gray-800">Estimated Annual Savings</h3>
//                             <p className="text-4xl font-bold text-blue-600 mt-2">{formatCurrency(financials.annual_savings)}</p>
//                         </div>
//                         <div className="bg-green-50 p-6 rounded-lg shadow-md">
//                             <p className="text-green-600 text-4xl mb-2"><i className="bi bi-calendar-check"></i></p>
//                             <h3 className="text-xl font-bold text-gray-800">Simple Payback Period</h3>
//                             <p className="text-4xl font-bold text-green-600 mt-2">{financials.payback_period} <span className="text-2xl">Years</span></p>
//                         </div>
//                         <div className="bg-amber-50 p-6 rounded-lg shadow-md">
//                              <p className="text-amber-600 text-4xl mb-2"><i className="bi bi-shield-check"></i></p>
//                             <h3 className="text-xl font-bold text-gray-800">Grid Independence</h3>
//                             <p className="text-4xl font-bold text-amber-600 mt-2">{financials.grid_independence_rate}%</p>
//                         </div>
//                     </div>
//                     <div className="bg-gray-800 text-white p-6 rounded-lg shadow-lg mt-8 text-center">
//                         <h3 className="text-xl font-semibold">Total Turnkey Investment</h3>
//                         <p className="text-4xl font-bold mt-2">{formatCurrency(selectedSystem.total_cost)}</p>
//                         <p className="text-sm text-gray-300 mt-1">(Including all hardware, installation, and certifications)</p>
//                     </div>
//                 </section>

//                 <div className="page-break"></div>

//                 {/* --- 3. YOUR CUSTOM SOLUTION --- */}
//                 <section className="py-8">
//                      <h2 className="text-3xl font-bold border-b-2 border-blue-500 pb-2 mb-6">Your Custom Solution</h2>
//                      <div className="space-y-6">
//                         {selectedSystem.components.map(comp => (
//                             <div key={comp.product_id} className="flex items-center bg-gray-50 p-4 rounded-lg shadow-sm">
//                                 <div className="text-3xl text-blue-500 mr-4">
//                                     {comp.category === 'panel' && <i className="bi bi-grid-3x3-gap-fill"></i>}
//                                     {comp.category === 'inverter' && <i className="bi bi-box-seam"></i>}
//                                     {comp.category === 'battery' && <i className="bi bi-battery-full"></i>}
//                                 </div>
//                                 <div>
//                                     <h4 className="font-bold text-lg">{comp.quantity}x {comp.brand} {comp.model}</h4>
//                                     <p className="text-sm text-gray-600">[Detailed product description placeholder. Mention key benefits like warranty, efficiency, or reliability.]</p>
//                                 </div>
//                             </div>
//                         ))}
//                      </div>
//                 </section>

//                 {/* --- 4. PERFORMANCE & FINANCIAL DEEP DIVE --- */}
//                 <section className="py-8">
//                     <h2 className="text-3xl font-bold border-b-2 border-blue-500 pb-2 mb-6">Performance & Financial Analysis</h2>
                    
//                     <div className="mb-12">
//                         <h3 className="text-xl font-semibold text-center mb-4">A Day in the Life of Your New System</h3>
//                         <div className="h-96"><Line options={{ responsive: true, maintainAspectRatio: false, scales: { y: { title: { display: true, text: 'Power (kW)'}}, y1: { position: 'right', title: {display: true, text: 'Battery SOC (%)'}, grid: { drawOnChartArea: false }, min: 0, max: 100 } } }} data={dailyChartData} /></div>
//                         <p className="text-sm text-center text-gray-500 mt-2">This chart shows how your solar panels generate power during the day to meet your home's demand, with excess energy stored in the battery for use overnight and during outages.</p>
//                     </div>

//                     <div className="grid grid-cols-1 md:grid-cols-5 gap-6 items-center">
//                         <div className="md:col-span-3">
//                             <h3 className="text-xl font-semibold text-center mb-4">Monthly Bill: Before vs. After</h3>
//                              <div className="h-80"><Bar options={{ responsive: true, maintainAspectRatio: false, scales: { y: { title: { display: true, text: 'Estimated Monthly Cost (R)'}}} }} data={monthlyChartData} /></div>
//                         </div>
//                         <div className="md:col-span-2 text-center">
//                             <h3 className="text-xl font-semibold mb-4">Your New Energy Mix</h3>
//                             <div className="h-64 w-64 mx-auto"><Pie data={energyMixChartData} /></div>
//                         </div>
//                     </div>

//                     <div className="mt-12">
//                         <h3 className="text-xl font-semibold mb-4">Annual Performance Summary</h3>
//                         <div className="bg-gray-50 p-4 rounded-lg shadow-sm">
//                             <ul className="divide-y divide-gray-200">
//                                 <li className="flex justify-between py-2"><span className="font-semibold">Total Annual Consumption:</span><span className="font-mono">{financials.total_demand_kwh.toLocaleString()} kWh</span></li>
//                                 <li className="flex justify-between py-2"><span className="font-semibold">Total Solar Production:</span><span className="font-mono">{financials.total_generation_kwh.toLocaleString()} kWh</span></li>
//                                 <li className="flex justify-between py-2"><span className="font-semibold">Solar Used On-Site:</span><span className="font-mono">{financials.pv_used_on_site_kwh.toLocaleString()} kWh</span></li>
//                                 <li className="flex justify-between py-2 text-red-600"><span className="font-semibold">Energy Imported from Grid:</span><span className="font-mono">{financials.total_import_kwh.toLocaleString()} kWh</span></li>
//                                 <li className="flex justify-between py-2"><span className="font-semibold">Self-Consumption Rate:</span><span className="font-mono">{financials.self_consumption_rate}%</span></li>
//                                 <li className="flex justify-between py-2"><span className="font-semibold">Grid Independence Rate:</span><span className="font-mono">{financials.grid_independence_rate}%</span></li>
//                             </ul>
//                         </div>
//                     </div>
//                 </section>
                
//                 {/* --- 5. NEXT STEPS --- */}
//                 <section className="py-8 border-t-2 mt-8">
//                     <h2 className="text-3xl font-bold mb-6">Next Steps</h2>
//                     <p className="text-lg text-gray-600 mb-6">Ready to secure your energy future? Here's how simple it is to get started:</p>
//                     <ol className="list-decimal list-inside space-y-4 text-lg">
//                         <li><strong>Acceptance:</strong> Sign this proposal to lock in your price and components.</li>
//                         <li><strong>Site Inspection:</strong> Our engineers will conduct a final technical site visit to confirm all measurements.</li>
//                         <li><strong>Installation:</strong> Our certified in-house team will install your system with minimal disruption.</li>
//                         <li><strong>Handover:</strong> We'll commission the system and show you how to use your new energy monitoring app.</li>
//                     </ol>
//                     <div className="mt-10 border-t pt-6">
//                         <p className="font-semibold">Proposal valid until: [Date 30 days from now]</p>
//                         <div className="flex flex-col md:flex-row mt-8 gap-8">
//                             <div className="flex-1">
//                                 <div className="border-b-2 border-gray-400 h-12"></div>
//                                 <p className="mt-2">Signature: {clientName || '[Client Name Placeholder]'}</p>
//                             </div>
//                              <div className="flex-1">
//                                 <div className="border-b-2 border-gray-400 h-12"></div>
//                                 <p className="mt-2">Date</p>
//                             </div>
//                         </div>
//                     </div>
//                 </section>
//             </main>
//         </>
//     );
// }

// export default ProposalView;
