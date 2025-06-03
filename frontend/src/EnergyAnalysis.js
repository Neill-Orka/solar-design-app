import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Line, Bar} from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend } from 'chart.js';
import Modal from 'react-bootstrap/Modal';
import Button from 'react-bootstrap/Button';
import Form from 'react-bootstrap/Form';
import HeatMap from '@uiw/react-heat-map';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

function EnergyAnalysis({ projectId }) {
  const [consumptionData, setConsumptionData] = useState([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showDateModal, setShowDateModal] = useState(false);

  // Set default to last 30 days
  useEffect(() => {
    const savedStart = sessionStorage.getItem('energyAnalysis_startDate');
    const savedEnd = sessionStorage.getItem('energyAnalysis_endDate');
  
    if (savedStart && savedEnd) {
      setStartDate(savedStart);
      setEndDate(savedEnd);
    } else {
      const today = new Date();
      const monthAgo = new Date();
      monthAgo.setDate(today.getDate() - 30);
      setStartDate(monthAgo.toISOString().slice(0, 10));
      setEndDate(today.toISOString().slice(0, 10));
    }
  }, []);

  // Save date range to session storage
  useEffect(() => {
    if (startDate && endDate) {
      sessionStorage.setItem('energyAnalysis_startDate', startDate);
      sessionStorage.setItem('energyAnalysis_endDate', endDate);
    }
  }, [startDate, endDate]);

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

  // For summary metrics
  const totalKwh = (consumptionData.reduce((sum, row) => sum + row.demand_kw, 0) * 0.5).toFixed(0);
  const dates = new Set(consumptionData.map(row => row.timestamp.split('T')[0]));
  const avgDailyKwh = (totalKwh / dates.size).toFixed(0);
  const peakDemand = Math.max(...consumptionData.map(row => row.demand_kw)).toFixed(1);
  const minDemand = Math.min(...consumptionData.map(row => row.demand_kw)).toFixed(1);
  const avgDemand = (consumptionData.reduce((sum, row) => sum + row.demand_kw, 0) / consumptionData.length).toFixed(1);
  const loadFactor = (avgDemand / peakDemand).toFixed(2);

  const hourlySums = Array(24).fill(0);
  const hourlyCounts = Array(24).fill(0);

  consumptionData.forEach(row => {
    const hour = new Date(row.timestamp).getHours();
    hourlySums[hour] += row.demand_kw;
    hourlyCounts[hour] += 1;
  });

  const avgHourlyProfile = hourlySums.map((sum, index) => (sum / (hourlyCounts[index] || 1)).toFixed(2));

  const avgHourlyChart = {
    labels: Array.from ({ length: 24 }, (_, i) => `${i}:00`),
    datasets: [{
      label: 'Avg Demand (kW)',
      data: avgHourlyProfile,
      borderColor: 'purple',
      backgroundColor: 'rgba(128, 0, 128, 0.2)',
      fill: true,
      tension: 0.3,
      pointRadius: 0
    }]
  };

  const avgHourlyOptions = {
    responsive: true,
    plugins: {
      title: { display: true, text: 'Average Daily Load Profle (Hourly)' },
      legend: { display: false },
    },
    scales: {
      x: {
        title: { display: true, text: 'Hour of Day' },
      },
      y: {
        beginAtZero: true,
        title: { display: true, text: 'Avg Demand (kW)' },
      }
    }
  };

  const dailyEnergyMap = {};
  consumptionData.forEach(row => {
    const date = row.timestamp.split('T')[0];
    if (!dailyEnergyMap[date]) {
      dailyEnergyMap[date] = 0;
    }
    dailyEnergyMap[date] += row.demand_kw * 0.5; // Convert to kWh
  })

  const dailyDates = Object.keys(dailyEnergyMap).sort();
  const dailyEnergy = dailyDates.map(date => dailyEnergyMap[date].toFixed(1));

  const dailyBarChart = {
    labels: dailyDates,
    datasets: [{
      label: 'Daily Energy Use (kWh)',
      data: dailyEnergy,
      backgroundColor: 'rgba(0, 123, 255, 0.6)',
      borderRadius: 5,
      barPercentage: 1,
      categoryPercentage: 0.5,
    }]
  }

  const dailyBarOptions = {
    responsive: true,
    plugins: {
      title: { display: true, text: 'Daily Energy Use (kWh/day)' },
      legend: { display: false },
      decimation: {
        enabled: true,
        algorithm: 'lttb',
        samples: 200
      }
    },
    scales: {
      x: {
        title: { display: true, text: 'Date' },
        ticks: { maxTicksLimit: 15 },
      },
      y: {
        beginAtZero: true,
        title: { display: true, text: 'kWh' },
      }
    }
  };

  const heatmapData = Object.entries(dailyEnergyMap).map(([date, value]) => ({
    date,
    count: Math.round(value),
  }))

  const heatmapMatrix = Array.from({ length: 24 }, () => Array(365).fill(0));
  const heatmapCounts = Array.from({ length: 24 }, () => Array(365).fill(0));
  const dayIndexMap = {};

  let baseDate = new Date('2025-01-01');

  consumptionData.forEach(row => {
    const dt = new Date(row.timestamp);
    const hour = dt.getHours();
    const dateStr = dt.toISOString().split('T')[0];

    // map date string to day index
    if (!(dateStr in dayIndexMap)) {
      const idx = Math.floor((dt - baseDate) / (1000 * 60 * 60 * 24));
      dayIndexMap[dateStr] = idx;
    }

    const dayIdx = dayIndexMap[dateStr];
    if (dayIdx >= 0 && dayIdx <= 365)
    {
      heatmapMatrix[hour][dayIdx] += row.demand_kw;
      heatmapCounts[hour][dayIdx] += 1;
    }
  });

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

      {consumptionData.length > 0 && (
        <>
        <div className="row mb-4 g-3">
          <div className="col-md-4">
            <div className="border-start border-4 border-primary bg-white shadow-sm rounded p-3 h-100">
              <div className="text-muted small">Total Consumption</div>
              <div className="fs-4 fw-bold">{totalKwh} kWh</div>
            </div>
          </div>
          <div className="col-md-4">
            <div className="border-start border-4 border-success bg-white shadow-sm rounded p-3 h-100">
              <div className="text-muted small">Average Daily Usage</div>
              <div className="fs-4 fw-bold">{avgDailyKwh} kWh/day</div>
            </div>
          </div>
          <div className="col-md-4">
            <div className="border-start border-4 border-danger bg-white shadow-sm rounded p-3 h-100">
              <div className="text-muted small">Peak Demand</div>
              <div className="fs-4 fw-bold">{peakDemand} kW</div>
            </div>
          </div>
        </div>

        <div className="row mb-4 g-3">
          <div className="col-md-4">
            <div className="border-start border-4 border-warning bg-white shadow-sm rounded p-3 h-100">
              <div className="text-muted small">Maak die average nocturnal load (7-5 is dag)</div>
              <div className="fs-4 fw-bold">{minDemand} kW</div>
            </div>
          </div>
          <div className="col-md-4">
            <div className="border-start border-4 border-info bg-white shadow-sm rounded p-3 h-100">
              <div className="text-muted small">Average Demand</div>
              <div className="fs-4 fw-bold">{avgDemand} kW</div>
            </div>
          </div>
          <div className="col-md-4">
            <div className="border-start border-4 border-dark bg-white shadow-sm rounded p-3 h-100">
              <div className="text-muted small">Load Factor</div>
              <div className="fs-4 fw-bold">{loadFactor}</div>
            </div>
          </div>
        </div>
        </>
      )} 

      <h5>
        {consumptionData.length > 0 && (
          <div className='mb-5'>
            <Line data={avgHourlyChart} options={avgHourlyOptions} />
          </div>
        )}
        {consumptionData.length > 0 && (
          <div className='mb-5'>
            <Bar data={dailyBarChart} options={dailyBarOptions} />
          </div>
        )}
      {consumptionData.length > 0 && (
        <div className="mb-5">
          <h5>Calendar Heatmap of Daily Usage</h5>
          <HeatMap
            startDate={new Date('2025-01-01')}
            endDate={new Date('2025-12-31')}
            value={[]}
            data={heatmapData}
            rectSize={20}
            rectProps={{rx: 2}}
            weekLabels={['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']}
            monthLabels={[
              'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
              'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
            ]}
            cellStyle={(_background, value) => {
              const numeric = parseFloat(value);
              if (!numeric) return { background: '#f0f0f0', color: '#000' };

              const sorted = [...heatmapData.map(d => d.count)].sort((a, b) => a - b);
              const p90 = sorted[Math.floor(sorted.length * 0.9)] || 1;
              const intensity = Math.min(numeric / p90, 1);

              return {
                background: `hsl(207, 100%, ${100 - intensity * 50}%)`,
                color: intensity > 0.6 ? '#fff' : '#000',
                fontSize: '0.7rem',
              };
            }}
            cellRender = {(value, x, y) => {
              const date = new Date('2025-01-01');
              date.setDate(date.getDate() + x);
              const formattedDate = date.toISOString().split('T')[0];
              return (
                <div title={`${formattedDate}: ${value.count || 0} kWh`}>
                  {value}
                </div>
              );
            }}
          />
        </div>
      )}
      </h5>     

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
