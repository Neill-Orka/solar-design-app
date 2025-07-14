import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { API_URL } from './apiConfig';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

function FinancialModeling({ projectId }) {
  const [projectValue, setProjectValue] = useState('');
  const [feedInTariff, setFeedInTariff] = useState(1.0);
  const [allowExport, setAllowExport] = useState(false);
  const [financialResult, setFinancialResult] = useState(null);
  const [simulationData, setSimulationData] = useState(null);
  const [loading, setLoading] = useState(false);

  // Load project value and financial settings from previous sessions
  useEffect(() => {
    axios.get(`${API_URL}/api/projects/${projectId}`)
      .then(res => {
        const p = res.data;
        if (p && p.project_value_excl_vat != null) {
          setProjectValue(p.project_value_excl_vat);
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
            console.log("Successfully loaded simulation data from session storage.");
          }
        } catch (e) {
          alert("Failed to parse cached simulation data.", e);
        }
      } else {
        alert("No simulation data found in session storage. Please run a simulation first.");
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
  
  }, [projectId]);

  const handleCalculate = () => {
    if (!simulationData) {
      alert("Please run a simulation first to generate the required data.");
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
      alert(`Error calculating financial model: ${msg}`);
      setLoading(false);
    });
  };

  // Summation for 2025
  const costComparison = financialResult?.cost_comparison || [];
  const oldCost2025 = costComparison
    .filter(item => item.month.startsWith('2025-'))
    .reduce((acc, val) => acc + val.old_cost, 0);
  const newCost2025 = costComparison
    .filter(item => item.month.startsWith('2025-'))
    .reduce((acc, val) => acc + val.new_cost, 0);

  const savings2025 = oldCost2025 - newCost2025;

  return (
    <div className="container">
      <h4>Financial Modeling</h4>

      <div className="mb-3">
        <label className="form-label">
          Project Value (excl. VAT)
          <span className="text-muted" style={{ fontSize: '0.85em' }}>
            {' '}
            (Prefer editing in Project tab)
          </span>
        </label>
        <input
          type="number"
          className="form-control border-warning"
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
              alert("Could not save project value.");
            });
          }}
        />
      </div>

      <div className="row g-3 mb-3">

        <div className="col-md-4">
          <label className="form-label">Allow Export to Grid?</label><br />
          <input type="checkbox" checked={allowExport} onChange={() => {const newVal = !allowExport; setAllowExport(newVal); sessionStorage.setItem(`allowExport_${projectId}`, newVal);}} />
        </div>

        <div className="col-md-4">
          <label className="form-label">Feed-in Tariff (R/kWh)</label>
          <input type="number" className="form-control" value={feedInTariff} onChange={(e) => {setFeedInTariff(e.target.value); sessionStorage.setItem(`feedInTariff_${projectId}`, e.target.value);}} step="0.01" disabled={!allowExport} />
        </div>

        <div className="col-12">
          <button className="btn btn-primary" onClick={handleCalculate} disabled={loading}>
            {loading ? 'Calculating...' : 'Calculate'}
          </button>
        </div>
      </div>

      {financialResult && (
        <div className="mt-4">
          <h5>Results</h5>
          <p><strong>Estimated Annual Savings (2025):</strong> R{financialResult.annual_savings.toFixed(0)}</p>
          <p><strong>Payback Period:</strong> {typeof financialResult.payback_period === 'number' ? financialResult.payback_period.toFixed(1) : financialResult.payback_period} years</p>
          <p><strong>20-Year ROI:</strong> {typeof financialResult.roi === 'number' ? financialResult.roi.toFixed(1) : financialResult.roi}%</p>

          <Bar
            data={{
              labels: financialResult.yearly_savings.map(r => r.year),
              datasets: [{
                label: 'Annual Savings (R)',
                data: financialResult.yearly_savings.map(r => r.savings),
                backgroundColor: 'rgba(75, 192, 192, 0.6)'
              }]
            }}
            options={{
              plugins: {
                title: {
                  display: true,
                  text: 'Projected Savings Over 20 Years'
                }
              },
              responsive: true,
              scales: {
                y: { beginAtZero: true, title: { display: true, text: 'Rand' } },
                x: { title: { display: true, text: 'Year' } }
              }
            }}
          />

          <div className="mt-5">
            <Bar
              data={{
                labels: costComparison.map(e => e.month),
                datasets: [
                  {
                    label: 'Cost Without Solar (R)',
                    data: costComparison.map(e => e.old_cost),
                    backgroundColor: 'rgba(255, 99, 132, 0.5)'
                  },
                  {
                    label: 'Cost With Solar (R)',
                    data: costComparison.map(e => e.new_cost),
                    backgroundColor: 'rgba(54, 162, 235, 0.5)'
                  }
                ]
              }}
              options={{
                plugins: {
                  title: {
                    display: true,
                    text: 'Electricity Cost Before vs After Solar (Monthly)'  
                  }
                },
                responsive: true,
                scales: {
                  y: { beginAtZero: true, title: { display: true, text: 'Rand' } },
                  x: { title: { display: true, text: 'Month' } }
                }
              }}
            />
          </div>
              
          <div className="mt-5">
            {costComparison.length > 0 && (
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
                plugins: {
                  title: { display: true, text: '2025 Annual Cost Comparison' },

                },
                responsive: true,
                scales: {
                  y: { beginAtZero: true, title: { display: true, text: 'Rand' }, stacked: true },
                  x: { stacked: true }
                }
              }}
            />
            )}
          </div>

        </div>
      )}
    </div>
  );
}

export default FinancialModeling;
