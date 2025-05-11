import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend } from 'chart.js';
import Modal from 'react-bootstrap/Modal';
import Button from 'react-bootstrap/Button';
import Form from 'react-bootstrap/Form';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

function EnergyAnalysis({ projectId }) {
  const [consumptionData, setConsumptionData] = useState([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showDateModal, setShowDateModal] = useState(false);

  // Set default to last 30 days
  useEffect(() => {
    const today = new Date();
    const monthAgo = new Date();
    monthAgo.setDate(today.getDate() - 30);
    setStartDate(monthAgo.toISOString().slice(0, 10));
    setEndDate(today.toISOString().slice(0, 10));
  }, []);

  useEffect(() => {
    if (!projectId || !startDate || !endDate) return;

    axios.get(`http://localhost:5000/api/consumption_data/${projectId}`, {
      params: {
        start_date: startDate,
        end_date: endDate
      }
    })
    .then(res => setConsumptionData(res.data))
    .catch(err => {
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
      pointRadius: 0
    }]
  };

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: { position: 'top' },
      title: { display: true, text: 'Energy Consumption (kW)' },
      decimation: {
        enabled: true,
        algorithm: 'lttb',
        samples: Math.min(2000, consumptionData.length)
      }
    },
    scales: {
      x: { title: { display: true, text: 'Timestamp' }, ticks: { autoSkip: true } },
      y: { title: { display: true, text: 'Demand (kW)' }, beginAtZero: true }
    }
  };

  return (
    <div className="container">
      <h4>Energy Analysis</h4>

      {consumptionData.length > 0 && (
        <>
          <div className="d-flex flex-wrap justify-content-between align-items-center mb-3">
            <h5 className="mb-0">Consumption Overview</h5>
            <div className="btn-group">
              <button className="btn btn-outline-secondary" onClick={() => {
                const today = new Date();
                const weekAgo = new Date();
                weekAgo.setDate(today.getDate() - 7);
                setStartDate(weekAgo.toISOString().slice(0, 10));
                setEndDate(today.toISOString().slice(0, 10));
              }}>Last 7 Days</button>

              <button className="btn btn-outline-secondary" onClick={() => {
                const today = new Date();
                const monthAgo = new Date();
                monthAgo.setDate(today.getDate() - 30);
                setStartDate(monthAgo.toISOString().slice(0, 10));
                setEndDate(today.toISOString().slice(0, 10));
              }}>Last 30 Days</button>

              <button className="btn btn-outline-secondary" onClick={() => {
                setStartDate('2025-01-01');
                setEndDate('2025-12-31');
              }}>Full Year</button>

              <button className="btn btn-outline-primary" onClick={() => setShowDateModal(true)}>
                Custom Range
              </button>
            </div>
          </div>

          <Line data={chartData} options={chartOptions} />
        </>
      )}

      {consumptionData.length === 0 && (
        <p>No data available for the selected period.</p>
      )}

      {/* Modal for custom date selection */}
      <Modal show={showDateModal} onHide={() => setShowDateModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Select Custom Date Range</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form.Group className="mb-3">
            <Form.Label>Start Date</Form.Label>
            <Form.Control
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
            />
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label>End Date</Form.Label>
            <Form.Control
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowDateModal(false)}>Cancel</Button>
          <Button variant="primary" onClick={() => setShowDateModal(false)}>Apply</Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}

export default EnergyAnalysis;
