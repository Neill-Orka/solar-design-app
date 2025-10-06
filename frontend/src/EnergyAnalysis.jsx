import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Line, Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend } from 'chart.js';
import { Modal, Button, Form } from 'react-bootstrap';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css'
import { API_URL } from './apiConfig';
import { useNotification } from './NotificationContext';
import ChartDataLabels from 'chartjs-plugin-datalabels';


ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);
ChartJS.unregister(ChartDataLabels);

// helper to format numbers with spaces as thousand separators
const formatWithSpaces = num => num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

const toEndOfDay = (d) => {
  if (!d) return d;
  const clone = new Date(d);
  clone.setHours(23, 59, 59, 999);
  return clone;
};

function EnergyAnalysis({ projectId }) {
  const { showNotification } = useNotification();
  const [consumptionData, setConsumptionData] = useState([]);
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [scaleFactorInput, setScaleFactorInput] = useState('');
  const [actualScaleFactor, setActualScaleFactor] = useState(1);
  const [isScaleFactorValid, setIsScaleFactorValid] = useState(true);
  const [profileInfo, setProfileInfo] = useState(null);

  // Set default to last 30 days
  useEffect(() => {
    const savedStart = sessionStorage.getItem('energyAnalysis_startDate');
    const savedEnd = sessionStorage.getItem('energyAnalysis_endDate');
  
    if (savedStart && savedEnd) {
      setStartDate(new Date(savedStart));
      setEndDate(new Date(savedEnd));
    } else {
      const today = new Date();
      const monthAgo = new Date();
      monthAgo.setDate(today.getDate() - 30);
      setStartDate(monthAgo);
      setEndDate(toEndOfDay(today));
    }
  }, []);

  // Save date range to session storage
  useEffect(() => {
    if (startDate && endDate) {
      sessionStorage.setItem('energyAnalysis_startDate', startDate.toISOString());
      sessionStorage.setItem('energyAnalysis_endDate', endDate.toISOString());
    }
  }, [startDate, endDate]);

  // Load scale factor from project on mount
  useEffect(() => {
    if (!projectId) return;
    
    axios.get(`${API_URL}/api/projects/${projectId}`)
      .then(res => {
        const scaleFactor = res.data.energy_scale_factor || 1;
        setActualScaleFactor(scaleFactor);
        setScaleFactorInput(scaleFactor.toString());
      })
      .catch(err => {
        console.error('Error loading project data:', err);
        setActualScaleFactor(1);
        setScaleFactorInput('1');
      });
  }, [projectId]);

  useEffect(() => {
    if (!projectId || !startDate || !endDate) return;

    // Format dates for API request - include the time component for end date
    const formattedStartDate = startDate.toISOString().split('T')[0];

    // Instead of sending ISO string, send the date with explicit local time
    const endYear = endDate.getFullYear();
    const endMonth = String(endDate.getMonth() + 1).padStart(2, '0');
    const endDay = String(endDate.getDate()).padStart(2, '0');
    const formattedEndDate = `${endYear}-${endMonth}-${endDay}T23:59:59.999`;

    axios.get(`${API_URL}/api/consumption_data/${projectId}`, {
      params: {
        start_date: formattedStartDate,
        end_date: formattedEndDate,
        scale_factor: actualScaleFactor,
        include_full_end_day: true,
        local_timezone: true
      }
    })
    .then(res => {
      if (res.data.data && Array.isArray(res.data.data)) {
        setConsumptionData(res.data.data);
        setProfileInfo(res.data.profile_info);
      } else if (Array.isArray(res.data)) {
        // Handle old format for backward compatibility
        setConsumptionData(res.data);
      }
    })
    .catch(err => {
      console.error('Error loading data:', err);
      showNotification('Failed to fetch consumption data', 'danger');
    });
  }, [projectId, startDate, endDate, actualScaleFactor, showNotification]);

  // Handle scale factor input changes
  const handleScaleFactorChange = (e) => {
    const value = e.target.value;
    setScaleFactorInput(value);
    
    // Validate and update actual scale factor
    if (value === '') {
      setIsScaleFactorValid(false);
      return;
    }
    
    const numValue = parseFloat(value);
    if (isNaN(numValue) || numValue <= 0) {
      setIsScaleFactorValid(false);
      return;
    }
    
    setIsScaleFactorValid(true);
    setActualScaleFactor(numValue);
  };

  // Handle scale factor input blur (when user clicks out)
  const handleScaleFactorBlur = async () => {
    if (scaleFactorInput === '') {
      showNotification('Scale factor cannot be empty. Please enter a positive number.', 'warning');
      setScaleFactorInput(actualScaleFactor.toString());
      setIsScaleFactorValid(true);
      return;
    }

    const numValue = parseFloat(scaleFactorInput);
    if (isNaN(numValue) || numValue <= 0) {
      showNotification('Scale factor must be a positive number.', 'warning');
      setScaleFactorInput(actualScaleFactor.toString());
      setIsScaleFactorValid(true);
      return;
    }

    // Save to backend
    try {
      await axios.put(`${API_URL}/api/projects/${projectId}`, {
        energy_scale_factor: numValue
      });
      setActualScaleFactor(numValue);
      setIsScaleFactorValid(true);
    } catch (err) {
      console.error('Error saving scale factor:', err);
      showNotification('Failed to save scale factor', 'danger');
      setScaleFactorInput(actualScaleFactor.toString());
      setIsScaleFactorValid(true);
    }
  };

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
    interaction: {
      mode: 'index',
      intersect: false
    },
    plugins: {
      tooltip: {
        mode: 'index',
        intersect: false
      },
      legend: { position: 'top' },
      title: { display: true, text: 'Energy Consumption (kW)' },
      decimation: {
        enabled: true,
        algorithm: 'lttb',
        samples: Math.min(2000, consumptionData.length)
      },
      datalabels: {display: false}
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
  const avgDemand = (consumptionData.reduce((sum, row) => sum + row.demand_kw, 0) / consumptionData.length).toFixed(1);
  const loadFactor = (avgDemand / peakDemand).toFixed(2);
  const totalNocturnalLoad = consumptionData.reduce((sum, row) => {
    const hour = new Date(row.timestamp).getHours();
    if (hour >= 17 || hour < 7) {
      return sum + row.demand_kw;
    }
    return sum
  }, 0) * 0.5;
  const avgDailyNocturnalLoad = (dates.size > 0 ? (totalNocturnalLoad / dates.size): 0).toFixed(0);

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
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      intersect: false
    },
    plugins: {
      tooltip: { mode: 'index', intersect: false },
      title: { display: true, text: 'Average Daily Load Profle (Hourly)' },
      legend: { display: false },
      datalabels: { display: false }
    },
    scales: {
      x: {
        title: { display: true, text: 'Hour of Day' },
      },
      y: {
        beginAtZero: true,
        title: { display: true, text: 'Avg Demand (kW)' },
      },
      
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
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      intersect: false
    },
    plugins: {
      tooltip: { mode: 'index', intersect: false },
      title: { display: true, text: 'Daily Energy Use (kWh/day)' },
      legend: { display: false },
      decimation: {
        enabled: true,
        algorithm: 'lttb',
        samples: 200
      },
      datalabels: { display: false }
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
            <div>
              <h5 className="mb-0">Consumption Overview</h5>
              {/* Compact profile info display */}
              {profileInfo && (
                <div className="small mt-1 d-flex align-items-center flex-wrap">
                  <span className="badge bg-secondary me-2">
                    <i className="bi bi-lightning-fill me-1"></i>
                    {profileInfo.name}
                  </span>
                  
                  {profileInfo.monthly_avg_kwh_original && (
                    <span className="badge bg-primary me-2">
                      <i className="bi bi-lightning-charge me-1"></i>
                      {Math.round(profileInfo.monthly_avg_kwh_original * 12).toLocaleString('en-ZA')} kWh/yr
                    </span>
                  )}
                  
                  {profileInfo.max_peak_demand_kw && (
                    <span className="badge bg-danger me-2">
                      <i className="bi bi-arrow-up-right me-1"></i>
                      Peak: {profileInfo.max_peak_demand_kw.toFixed(2)} kW
                    </span>
                  )}
                  
                  {profileInfo.scaler && profileInfo.scaler !== 1 && (
                    <span className="badge bg-warning text-dark me-2">
                      <i className="bi bi-rulers me-1"></i>
                      Scaled {profileInfo.scaler.toFixed(2)}x
                    </span>
                  )}
                  
                  {profileInfo.profile_type && (
                    <span className="badge bg-info text-dark me-2">
                      <i className="bi bi-tag me-1"></i>
                      {profileInfo.profile_type}
                    </span>
                  )}
                </div>
              )}
            </div>
            <div className="d-flex gap-3 align-items-center">
              {/* Scale Factor Input */}
              <div className="d-flex align-items-center">
                <label className="form-label mb-0 me-2 small text-muted">Scale Factor:</label>
                <input
                  type="number"
                  className={`form-control form-control-sm ${!isScaleFactorValid ? 'is-invalid' : ''}`}
                  style={{ width: '80px' }}
                  value={scaleFactorInput}
                  onChange={handleScaleFactorChange}
                  onBlur={handleScaleFactorBlur}
                  step="0.01"
                  placeholder="1.0"
                />
              </div>
              
              {/* Date Range Buttons */}
              <div className="btn-group">
                <button className="btn btn-outline-secondary" onClick={() => {
                  const today = new Date();
                  const weekAgo = new Date();
                  weekAgo.setDate(today.getDate() - 7);
                  setStartDate(weekAgo);
                  setEndDate(toEndOfDay(today));
                }}>Last 7 Days</button>

                <button className="btn btn-outline-secondary" onClick={() => {
                  const today = new Date();
                  const monthAgo = new Date();
                  monthAgo.setDate(today.getDate() - 30);
                  setStartDate(monthAgo);
                  setEndDate(toEndOfDay(today));
                }}>Last 30 Days</button>

                <button className="btn btn-outline-secondary" onClick={() => {
                  setStartDate(new Date('2025-01-01'));
                  setEndDate(toEndOfDay(new Date('2025-12-31')));
                }}>Full Year</button>

                <DatePicker
                  selected={startDate}
                  onChange={(dates) => {
                    const [start, end] = dates;
                    setStartDate(start);
                    setEndDate(end ? toEndOfDay(new Date(end)) : null);
                    console.log('Date range set:', {
                      startDate: start,
                      endDate: end,
                      endDateWithTime: end ? toEndOfDay(new Date(end)).toISOString() : null
                    });
                  }}
                  startDate={startDate}
                  endDate={endDate}
                  selectsRange
                  isClearable={false}
                  dateFormat={"dd/MM/yyyy"}
                  className='form-control form-control-sm shadow-sm'
                  popperPlacement='bottom-end'
                />
              </div>
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
              <div className="fs-4 fw-bold">{formatWithSpaces(totalKwh)} kWh</div>
            </div>
          </div>
          <div className="col-md-4">
            <div className="border-start border-4 border-success bg-white shadow-sm rounded p-3 h-100">
              <div className="text-muted small">Average Daily Usage</div>
              <div className="fs-4 fw-bold">{formatWithSpaces(avgDailyKwh)} kWh/day</div>
            </div>
          </div>
          <div className="col-md-4">
            <div className="border-start border-4 border-danger bg-white shadow-sm rounded p-3 h-100">
              <div className="text-muted small">Peak Demand</div>
              <div className="fs-4 fw-bold">{formatWithSpaces(peakDemand)} kW</div>
            </div>
          </div>
        </div>

        <div className="row mb-4 g-3">
          <div className="col-md-4">
            <div className="border-start border-4 border-warning bg-white shadow-sm rounded p-3 h-100">
              <div className="text-muted small">Avg. Daily Nocturnal Load</div>
              <div className="fs-4 fw-bold">{formatWithSpaces(avgDailyNocturnalLoad)} kWh</div>
            </div>
          </div>
          <div className="col-md-4">
            <div className="border-start border-4 border-info bg-white shadow-sm rounded p-3 h-100">
              <div className="text-muted small">Average Demand</div>
              <div className="fs-4 fw-bold">{formatWithSpaces(avgDemand)} kW</div>
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

        {consumptionData.length > 0 && (
          <div className='mb-5 chart-container'>
            <Line data={avgHourlyChart} options={avgHourlyOptions} />
          </div>
        )}
        {consumptionData.length > 0 && (
          <div className='mb-5 chart-container'>
            <Bar data={dailyBarChart} options={dailyBarOptions} />
          </div>
        )}

      {consumptionData.length === 0 && (
        <p>No data available for the selected period.</p>
      )}
    </div>
  );
}

export default EnergyAnalysis;
