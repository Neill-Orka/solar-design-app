import React, { useState, useEffect } from 'react';
import './index.css';
import { Card, Button, Spinner, Alert, Form, Row, Col } from 'react-bootstrap'; // Added Row, Col
import axios from 'axios';
import { Line } from 'react-chartjs-2';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    TimeScale,
} from 'chart.js';
import 'chartjs-adapter-date-fns';
import { API_URL } from './apiConfig'; // Adjust the import based on your project structure

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    TimeScale
);

// MODIFIED: generateChartData now accepts a scaler
const generateChartData = (profileDataArray, scaler = 1) => {
  if (!profileDataArray || profileDataArray.length === 0) {
    return { labels: [], datasets: [] };
  }

  const sortedData = [...profileDataArray].sort((a, b) => new Date(a.Timestamp || a.timestamp) - new Date(b.Timestamp || b.timestamp));
  
  let startIndex = 0;
  const targetMonth = 6; // July

  if (sortedData.length > 0) {
    const firstYear = new Date(sortedData[0].Timestamp || sortedData[0].timestamp).getFullYear();
    const potentialStartIndex = sortedData.findIndex(dp => {
      const dpDate = new Date(dp.Timestamp || dp.timestamp);
      return dpDate.getFullYear() === firstYear && dpDate.getMonth() >= targetMonth;
    });
    if (potentialStartIndex !== -1) {
      startIndex = potentialStartIndex;
    }
  }

  let oneWeekData = [];
  if (sortedData.length > 0 && startIndex < sortedData.length) { // Ensure startIndex is valid
    const effectiveFirstTimestamp = new Date(sortedData[startIndex].Timestamp || sortedData[startIndex].timestamp).getTime();
    const oneWeekInMillis = 7 * 24 * 60 * 60 * 1000;
    const endTime = effectiveFirstTimestamp + oneWeekInMillis;

    for (let i = startIndex; i < sortedData.length; i++) {
      const dp = sortedData[i];
      const dpTime = new Date(dp.Timestamp || dp.timestamp).getTime();
      if (dpTime <= endTime) {
        oneWeekData.push(dp);
      } else {
        break;
      }
    }
  }
  
  if (oneWeekData.length === 0 && sortedData.length > 0) {
    const initialSlice = sortedData.slice(0, Math.min(sortedData.length, 48 * 7));
    if (initialSlice.length > 0) {
        const firstTs = new Date(initialSlice[0].Timestamp || initialSlice[0].timestamp).getTime();
        const weekInMillis = 7 * 24 * 60 * 60 * 1000;
        const endTs = firstTs + weekInMillis;
        oneWeekData = initialSlice.filter(dp => new Date(dp.Timestamp || dp.timestamp).getTime() <= endTs);
    }
  }

  const labels = oneWeekData.map(dp => new Date(dp.Timestamp || dp.timestamp));
  // MODIFIED: Apply scaler to demand data
  const data = oneWeekData.map(dp => (dp.Demand_kW || dp.demand_kw) * scaler);

  return {
    labels,
    datasets: [
      {
        label: `Scaled Demand (kW)`, // Updated label
        data,
        borderColor: 'rgb(75, 192, 192)',
        backgroundColor: 'rgba(75, 192, 192, 0.1)',
        tension: 0.2,
        pointRadius: 0,
        borderWidth: 1.5,
      },
    ],
  };
};

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    title: { display: false },
    tooltip: {
      enabled: true,
      mode: 'index',
      intersect: false,
      backgroundColor: 'rgba(0,0,0,0.7)',
      titleFont: { size: 14, weight: 'bold' },
      bodyFont: { size: 12 },
      padding: 10,
      cornerRadius: 4,
    },
    datalabels: { display: false } // Hide data labels
  },
  scales: {
    x: {
      type: 'time', // Crucial for time-based data
      time: {
        unit: 'day', // Changed unit to day for a 7-day view
        tooltipFormat: 'MMM d, HH:mm', // Format for tooltips
        displayFormats: {
          day: 'MMM d' // Display format for x-axis labels
        }
      },
      ticks: { 
        maxTicksLimit: 7, // Show a tick for each day in a week
        autoSkip: true,
        font: {size: 10, family: 'Inter, sans-serif'}, // Modern font
        color: '#6b7280', // gray-500
      },
      grid: { display: false }
    },
    y: {
      beginAtZero: true,
      ticks: { 
        maxTicksLimit: 5,
        font: {size: 10, family: 'Inter, sans-serif'},
        color: '#6b7280', // gray-500
        padding: 5,
       },
      grid: { 
        color: 'rgba(229, 231, 235, 0.8)', // gray-200 with opacity
        drawBorder: false,
      }
    },
  },
};

// MODIFIED: Added basicInfo to props to get client's consumption
function ProfileSelection({ projectId, consumerType, basicInfo, savedData, onSelect, onBack }) {
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // NEW STATE: To store scaler for each profile
  const [scalers, setScalers] = useState({});

  // --- MODIFICATION 1: This hook now ONLY fetches the profiles ---
  useEffect(() => {
    const fetchProfiles = async () => {
      setLoading(true);
      setError('');
      try {
        const response = await axios.get(`${API_URL}/api/load_profiles`);
        setProfiles(response.data);
      } catch (err) {
        console.error("Error fetching profiles:", err);
        setError(err.response?.data?.error || 'Failed to load profiles. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    fetchProfiles();
  }, []); // This dependency array is empty, so it only runs once on mount.

  // --- MODIFICATION 2: This NEW hook intelligently sets all scalers ---
  useEffect(() => {
    // Don't run this logic until the list of profiles has been loaded.
    if (profiles.length === 0) return;

    const initialScalers = {};
    profiles.forEach(p => {
      // Check if the current profile in the list matches the saved profile ID
      if (savedData?.selectedProfileId === p.id) {
        // If it matches, use the scaler value from the saved data.
        initialScalers[p.id] = savedData.profileScaler || 1;
      } else {
        // Otherwise, set the default scaler value of 1.
        initialScalers[p.id] = 1;
      }
    });
    setScalers(initialScalers);

  }, [profiles, savedData]); 

  const handleProfileSelect = async (profile) => {
    setError('');
    try {
      const currentScaler = scalers[profile.id] || 1;
      const profileToSave = { ...profile, scaler: currentScaler };
      localStorage.setItem('selectedProfileForQuickDesign', JSON.stringify(profileToSave));
      // Save the selected profile with its scaler to the backend
      await axios.post(`${API_URL}/api/projects/${projectId}/quick_design`, {
        selectedProfileId: profile.id,
        profileScaler: currentScaler
      });
      
      onSelect(profileToSave); // Pass the profile

    } catch (err) {
      console.error("Error saving profile selection:", err);
      setError(err.response?.data?.error || 'Failed to save selection. Please try again.');
    }
  };

  // NEW FUNCTION: Handle scaler input change
  const handleScalerChange = (profileId, value) => {
    const newScaler = parseFloat(value);
    if (!isNaN(newScaler) && newScaler > 0) {
      setScalers(prevScalers => ({
        ...prevScalers,
        [profileId]: newScaler,
      }));
    } else if (value === '') { // Allow clearing the input
        setScalers(prevScalers => ({
            ...prevScalers,
            [profileId]: '', // Store empty string or a default like 1
        }));
    }
  };
  
  const clientMonthlyConsumption = basicInfo?.consumption;

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '300px' }}>
        <Spinner animation="border" role="status" variant="primary">
          <span className="visually-hidden">Loading profiles...</span>
        </Spinner>
        <p className="ms-3 mb-0 fs-5 text-secondary">Loading Profiles...</p>
      </div>
    );
  }

  // Error handling for API fetch or no consumerType
  if (error && !profiles.length) {
     return (
      <div className="p-4 p-md-5 bg-light rounded-3 text-center">
        <Alert variant="danger" className="shadow-sm">{error}</Alert>
        <Button variant="outline-secondary" onClick={onBack} className="mt-4 px-4 py-2">
          <i className="bi bi-arrow-left me-2"></i>Back
        </Button>
      </div>
     );
  }
  
  // If API call was successful but no profiles match the filter
  if (!loading && profiles.length === 0) {
    return (
      <div className="p-4 p-md-5 bg-light rounded-3 text-center">
        <Alert variant="info" className="shadow-sm">
          No load profiles found. Please ensure profiles are imported.
        </Alert>
        <Button variant="outline-secondary" onClick={onBack} className="mt-4 px-4 py-2">
         <i className="bi bi-arrow-left me-2"></i>Back
        </Button>
      </div>
    );
  }

  return (
    <div className="container-fluid py-4 px-md-4" style={{ backgroundColor: '#f8f9fa' /* Light gray background */ }}>
      <div className="mb-4 p-3 bg-white rounded-3 shadow-sm">
        <h2 className="text-2xl font-semibold text-gray-800 mb-2">Select & Scale Load Profile</h2>
        {consumerType && <p className="text-sm text-gray-500 mb-0">For consumer type: {consumerType}</p>}
      </div>
      
      {clientMonthlyConsumption && (
        <Alert variant="primary" className="mb-4 shadow-sm d-flex align-items-center" style={{backgroundColor: '#e0f2fe', borderColor: '#7dd3fc'}}>
          <i className="bi bi-info-circle-fill me-3 fs-4 text-primary"></i> {/* Bootstrap Icon */}
          <div>
            <strong className="d-block">Client's Target Monthly Consumption:</strong>
            <span className="fs-5 fw-bold">{clientMonthlyConsumption.toFixed(0)} kWh</span>
          </div>
        </Alert>
      )}

      {error && <Alert variant="danger" className="mb-3 shadow-sm">{error}</Alert>}
      
      <Row xs={1} md={2} lg={3} className="g-4 justify-content-center"> {/* Using React Bootstrap Row/Col for grid */}
        {profiles.map((profile) => {
          const originalProfileMonthlyKWh = profile.annual_kwh ? profile.annual_kwh / 12 : 0;
          const currentScaler = scalers[profile.id] === '' ? 1 : (scalers[profile.id] || 1);
          const scaledProfileMonthlyKWh = originalProfileMonthlyKWh * currentScaler;
          
          const isSelected = profile.id === savedData?.selectedProfileId;

          return (
            <Col key={profile.id}>
              <Card className={`h-100 shadow-lg rounded-xl transition-all duration-300 ease-in-out ${isSelected ? 'selected-card' : ''}`}>
                <Card.Body className="d-flex flex-column p-4">
                  <Card.Title className="text-xl font-semibold text-gray-800 mb-1">{profile.name}</Card.Title>
                  <Card.Text className="text-xs text-gray-500 mb-2">{profile.description} ({profile.profile_type})</Card.Text>
                  
                  <div className="mb-3 p-3 bg-light rounded-lg" style={{backgroundColor: '#f1f5f9' /* slate-100 */}}>
                    <Row>
                      <Col xs={6}>
                        <p className="text-xs text-gray-600 mb-0">Original Avg.</p>
                        <p className="text-sm font-semibold text-gray-700">{originalProfileMonthlyKWh.toFixed(0)} kWh/month</p>
                      </Col>
                      <Col xs={6}>
                        <p className="text-xs text-blue-600 mb-0">Scaled Avg.</p>
                        <p className="text-sm font-bold text-blue-700">{scaledProfileMonthlyKWh.toFixed(0)} kWh/month</p>
                      </Col>
                    </Row>
                  </div>

                  <Form.Group className="mb-3">
                    <Form.Label htmlFor={`scaler-${profile.id}`} className="text-xs font-medium text-gray-600 mb-1">Scale Factor:</Form.Label>
                    <Form.Control
                      type="number"
                      id={`scaler-${profile.id}`}
                      value={scalers[profile.id] || ''}
                      onChange={(e) => handleScalerChange(profile.id, e.target.value)}
                      step="0.01"
                      min="0.01"
                      size="sm"
                      className="rounded-md shadow-sm border-gray-300 focus:border-indigo-500 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
                    />
                  </Form.Group>
                  
                  <div className="mb-3" style={{ height: '160px' }}> {/* Increased height slightly */}
                    {profile.profile_data && profile.profile_data.length > 0 ? (
                      <Line 
                        data={generateChartData(profile.profile_data, currentScaler)} 
                        options={chartOptions} 
                      />
                    ) : (
                      <div className="d-flex align-items-center justify-content-center h-100 text-muted">
                        <small>No preview data</small>
                      </div>
                    )}
                  </div>
                  <Button
                    variant="primary" // Using primary variant
                    onClick={() => handleProfileSelect(profile)}
                    className="w-100 mt-auto py-2 fw-semibold rounded-md shadow-sm hover:bg-blue-700" // Tailwind-like classes for button
                    style={{backgroundColor: '#2563eb', borderColor: '#1d4ed8'}} // indigo-600
                  >
                    Select This Profile
                  </Button>
                </Card.Body>
              </Card>
            </Col>
          );
        })}
      </Row>
      <div className="mt-5 text-center">
        <Button
          variant="outline-secondary" // More subtle back button
          onClick={onBack}
          className="px-5 py-2 rounded-md"
        >
          <i className="bi bi-arrow-left me-2"></i>Back
        </Button>
      </div>
    </div>
  );
}

export default ProfileSelection;