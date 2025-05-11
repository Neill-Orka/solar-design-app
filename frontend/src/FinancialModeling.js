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

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

function FinancialModeling({ projectId }) {
  const [eskomTariff, setEskomTariff] = useState(2.2);
  const [feedInTariff, setFeedInTariff] = useState(1.0);
  const [allowExport, setAllowExport] = useState(false);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    console.log("Received projectID: ", projectId);
  }, [projectId]);

  const handleCalculate = () => {
    setLoading(true);
    axios.post('http://localhost:5000/api/financial_model', {
      project_id: projectId,
      tariff: parseFloat(eskomTariff),
      export_enabled: allowExport,
      feed_in_tariff: parseFloat(feedInTariff)
    })
      .then(res => {
        setResult(res.data);
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

  return (
    <div className="container">
      <h4>Financial Modeling</h4>

      <div className="row g-3 mb-3">
        <div className="col-md-4">
          <label className="form-label">Eskom Tariff (R/kWh)</label>
          <input type="number" className="form-control" value={eskomTariff} onChange={(e) => setEskomTariff(e.target.value)} step="0.01" />
        </div>

        <div className="col-md-4">
          <label className="form-label">Allow Export to Grid?</label><br />
          <input type="checkbox" checked={allowExport} onChange={() => setAllowExport(!allowExport)} />
        </div>

        <div className="col-md-4">
          <label className="form-label">Feed-in Tariff (R/kWh)</label>
          <input type="number" className="form-control" value={feedInTariff} onChange={(e) => setFeedInTariff(e.target.value)} step="0.01" disabled={!allowExport} />
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
                labels: result.cost_comparison.map(e => e.period),
                datasets: [
                  {
                    label: 'Cost Without Solar (R)',
                    data: result.cost_comparison.map(e => e.old_cost),
                    backgroundColor: 'rgba(255, 99, 132, 0.5)'
                  },
                  {
                    label: 'Cost With Solar (R)',
                    data: result.cost_comparison.map(e => e.new_cost),
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
        </div>
      )}
    </div>
  );
}

export default FinancialModeling;
