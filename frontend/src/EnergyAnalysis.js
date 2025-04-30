import React, { useState, useEffect } from 'react';
import axios from 'axios';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend } from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

function EnergyAnalysis({ projectId }) {
  const [consumptionData, setConsumptionData] = useState([]);
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);

  useEffect(() => {
    if (!projectId) return;

    const params = {};
    if (startDate) params.start_date = startDate.toISOString().split('T')[0];
    if (endDate) params.end_date = endDate.toISOString().split('T')[0];

    axios.get(`http://localhost:5000/consumption_data/${projectId}`, { params })
      .then((res) => setConsumptionData(res.data))
      .catch((err) => {
        console.error('Error loading data:', err);
        alert('Failed to fetch consumption data');
      });
  }, [projectId, startDate, endDate]);

  const chartData = {
    labels: consumptionData.map(d => new Date(d.timestamp).toLocaleString()),
    datasets: [{
      label: 'Demand (kW)',
      data: consumptionData.map(d => d.demand_kw),
      borderColor: 'rgb(75, 192, 192)',
      backgroundColor: 'rgba(75, 192, 192, 0.2)',
      fill: true,
      tension: 0.1,
    }],
  };

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: { position: 'top' },
      title: { display: true, text: 'Energy Consumption (kW)' }
    },
    scales: {
      x: { title: { display: true, text: 'Timestamp' }, ticks: { autoSkip: true } },
      y: { title: { display: true, text: 'Demand (kW)' }, beginAtZero: true }
    }
  };

  const showFullYear = () => {
    setStartDate(new Date('2025-01-01'));
    setEndDate(new Date('2025-12-31'));
  };

  return (
    <div>
      <h4>Energy Analysis</h4>
      <div className="row mb-3">
        <div className="col-md-5">
          <label>Start Date</label>
          <DatePicker selected={startDate} onChange={setStartDate} className="form-control" dateFormat="yyyy-MM-dd" />
        </div>
        <div className="col-md-5">
          <label>End Date</label>
          <DatePicker selected={endDate} onChange={setEndDate} className="form-control" dateFormat="yyyy-MM-dd" />
        </div>
        <div className="col-md-2 d-flex align-items-end">
          <button className="btn btn-secondary w-100" onClick={showFullYear}>Full Year</button>
        </div>
      </div>
      {consumptionData.length > 0
        ? <Line data={chartData} options={chartOptions} />
        : <p>No data available.</p>}
    </div>
  );
}

export default EnergyAnalysis;
