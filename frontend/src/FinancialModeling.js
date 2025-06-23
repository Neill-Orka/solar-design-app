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
  const [eskomTariff, setEskomTariff] = useState(2.2);
  const [feedInTariff, setFeedInTariff] = useState(1.0);
  const [allowExport, setAllowExport] = useState(false);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    console.log("Received projectID: ", projectId);
  }, [projectId]);

  useEffect(() => {
    axios.get(`${API_URL}/api/projects/${projectId}`)
      .then(res => {
        const p = res.data;
        if (p && p.project_value_excl_vat != null) {
          setProjectValue(p.project_value_excl_vat);
        }
      })
      .catch(err => {
        console.error("Error loading project value:", err);
      });
  }, [projectId]);


  useEffect(() => {
    const cached = sessionStorage.getItem(`financialResult_${projectId}`);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (parsed && parsed.yearly_savings) {
          setResult(parsed);
        }
      } catch (e) {
        console.error("Error parsing cached financial result:", e);
      }
    }
  }, [projectId]);

  useEffect(() => {
    const t = sessionStorage.getItem(`eskomTariff_${projectId}`);
    const f = sessionStorage.getItem(`feedInTariff_${projectId}`);
    const ex = sessionStorage.getItem(`allowExport_${projectId}`);

    if (t) setEskomTariff(t);
    if (f) setFeedInTariff(f);
    if (ex) setAllowExport(ex === 'true');

  }, [projectId]);


  const handleCalculate = () => {
    setLoading(true);
    axios.post(`${API_URL}/api/financial_model`, {
      project_id: projectId,
      tariff: parseFloat(eskomTariff),
      export_enabled: allowExport,
      feed_in_tariff: parseFloat(feedInTariff)
    })
      .then(res => {
        setResult(res.data);
        sessionStorage.setItem(`financialResult_${projectId}`, JSON.stringify(res.data));
        setLoading(false);
      })
      .catch(err => {
        const msg = err.response?.data?.error || err.message;
        console.error('Error calculating financials:', msg);
        alert('Calculation failed: ' + msg + 
              '\n(Hint: did you click "Save System" first?)');
        setLoading(false);
      });      
  };

  // Summation for 2025
  const costComparison = result?.cost_comparison || [];
  const oldCost2025 = costComparison
    .filter(item => item.period.startsWith('2025-'))
    .reduce((acc, val) => acc + val.old_cost, 0);
  const newCost2025 = costComparison
    .filter(item => item.period.startsWith('2025-'))
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
          <label className="form-label">Eskom Tariff (R/kWh)</label>
          <input type="number" className="form-control" value={eskomTariff} onChange={(e) => {setEskomTariff(e.target.value); sessionStorage.setItem(`eskomTariff_${projectId}`, e.target.value);}} step="0.01" />
        </div>

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

      {result && (
        <div className="mt-4">
          <h5>Results</h5>
          <p><strong>Estimated Annual Savings (2025):</strong> R{result.annual_savings.toFixed(0)}</p>
          <p><strong>Payback Period:</strong> {result.payback_years.toFixed(1)} years</p>
          <p><strong>20-Year ROI:</strong> {result.roi_20yr.toFixed(1)}%</p>

          <Bar
            data={{
              labels: result.yearly_savings.map(r => r.year),
              datasets: [{
                label: 'Annual Savings (R)',
                data: result.yearly_savings.map(r => r.savings),
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
                labels: costComparison.map(e => e.period),
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
