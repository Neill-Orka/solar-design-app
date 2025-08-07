import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_URL } from './apiConfig';
import { useNotification } from './NotificationContext';
import { Card, Button, Form, Row, Col, Spinner, Tab, Tabs, Alert } from 'react-bootstrap';
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

function EnergyDataUpload({ projectId }) {
  const [energyFile, setEnergyFile] = useState(null);
  const { showNotification } = useNotification();
  const [existingData, setExistingData] = useState([]);
  const [loadingData, setLoadingData] = useState(true);
  const [profiles, setProfiles] = useState([]);
  const [loadingProfiles, setLoadingProfiles] = useState(true);
  const [selectedProfileId, setSelectedProfileId] = useState(null);
  const [profileScaler, setProfileScaler] = useState(1.0);
  const [activeTab, setActiveTab] = useState('upload');
  const [submitting, setSubmitting] = useState(false);

  // Fetch existing energy data
  useEffect(() => {
    setLoadingData(true);
    axios.get(`${API_URL}/api/projects/${projectId}/energy-data`)
      .then(res => setExistingData(res.data))
      .catch(err => console.error('Fetch existing data error:', err))
      .finally(() => setLoadingData(false));
  }, [projectId]);

  // Fetch available profiles
  useEffect(() => {
    setLoadingProfiles(true);
    axios.get(`${API_URL}/api/load_profiles`)
      .then(res => setProfiles(res.data))
      .catch(err => console.error('Fetch profiles error:', err))
      .finally(() => setLoadingProfiles(false));
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!energyFile) {
      showNotification('Please upload a file.', 'danger');
      return;
    }

    setSubmitting(true);
    const formData = new FormData();
    formData.append('file', energyFile);
    formData.append('project_id', projectId);

    axios.post(`${API_URL}/api/projects/${projectId}/energy-data`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
      .then((response) => {
        showNotification(response.data.message, 'success');
        setEnergyFile(null);
        document.getElementById('energyFileInput').value = null;
        // refresh existing data
        refreshEnergyData();
      })
      .catch((error) => {
        console.error('Upload error:', error);
        showNotification('Failed to upload: ' + (error.response?.data?.error || error.message), 'danger');
      })
      .finally(() => setSubmitting(false));
  };

  const handleSelectProfile = () => {
    if (!selectedProfileId) {
      showNotification('Please select a profile first.', 'danger');
      return;
    }

    setSubmitting(true);
    axios.post(`${API_URL}/api/projects/${projectId}/use-profile`, {
      profile_id: selectedProfileId,
      scaler: profileScaler
    })
      .then((response) => {
        showNotification('Profile data applied successfully!', 'success');
        refreshEnergyData();
      })
      .catch((error) => {
        console.error('Profile selection error:', error);
        showNotification('Failed to apply profile: ' + (error.response?.data?.error || error.message), 'danger');
      })
      .finally(() => setSubmitting(false));
  };

  const refreshEnergyData = () => {
    setLoadingData(true);
    axios.get(`${API_URL}/api/projects/${projectId}/energy-data`)
      .then(res => setExistingData(res.data))
      .catch(err => console.error('Fetch existing data error:', err))
      .finally(() => setLoadingData(false));
  };

  const generateChartData = (profileData, scaler = 1) => {
    if (!profileData || profileData.length === 0) {
      return { labels: [], datasets: [] };
    }

    const sortedData = [...profileData].sort((a, b) => 
      new Date(a.timestamp || a.Timestamp) - new Date(b.timestamp || b.Timestamp)
    );
    
    // Get a week's worth of data for preview
    const oneWeekData = sortedData.slice(0, Math.min(336, sortedData.length));
    
    const labels = oneWeekData.map(dp => new Date(dp.timestamp || dp.Timestamp));
    const data = oneWeekData.map(dp => (dp.demand_kw || dp.Demand_kW) * scaler);

    return {
      labels,
      datasets: [
        {
          label: 'Scaled Demand (kW)',
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
      },
      datalabels: { display: false }
    },
    scales: {
      x: {
        type: 'time',
        time: {
          unit: 'day',
          tooltipFormat: 'MMM d, HH:mm',
          displayFormats: { day: 'MMM d' }
        },
        ticks: { maxTicksLimit: 7, autoSkip: true },
        grid: { display: false }
      },
      y: {
        beginAtZero: true,
        ticks: { maxTicksLimit: 5 },
      },
    },
  };

  const selectedProfile = profiles.find(p => p.id === selectedProfileId) || null;

  return (
    <div>
      <h4 className="mb-4">Energy Data Management</h4>
      
      <Tabs
        activeKey={activeTab}
        onSelect={k => setActiveTab(k)}
        className="mb-4"
      >
        <Tab eventKey="upload" title="Upload File">
          <Card className="shadow-sm mb-4">
            <Card.Body>
              <h5 className="mb-3">Upload Energy Data File</h5>
              <p className="text-muted mb-3">
                Upload a CSV or Excel file with energy consumption data. The file should contain two columns:
                "Timestamp" and "Demand_kW".
              </p>
              <Form.Group className="mb-3">
                <Form.Label htmlFor="energyFileInput">Select Energy Data File</Form.Label>
                <Form.Control 
                  type="file" 
                  id="energyFileInput" 
                  accept=".xlsx,.xls,.csv" 
                  onChange={(e) => setEnergyFile(e.target.files[0])} 
                />
                <Form.Text className="text-muted">
                  Accepts CSV, XLS, and XLSX files.
                </Form.Text>
              </Form.Group>
              <Button 
                variant="primary" 
                onClick={handleSubmit} 
                disabled={!energyFile || submitting}
              >
                {submitting ? (
                  <>
                    <Spinner size="sm" className="me-2" /> Uploading...
                  </>
                ) : (
                  <>Upload File</>
                )}
              </Button>
            </Card.Body>
          </Card>
        </Tab>

        <Tab eventKey="profiles" title="Use Existing Profile">
          <Card className="shadow-sm mb-4">
            <Card.Body>
              <h5 className="mb-3">Select Existing Load Profile</h5>
              <p className="text-muted mb-3">
                Choose from available load profiles and scale them to match your project's consumption.
              </p>

              {loadingProfiles ? (
                <div className="text-center py-4">
                  <Spinner animation="border" variant="primary" />
                  <p className="mt-2">Loading profiles...</p>
                </div>
              ) : profiles.length === 0 ? (
                <Alert variant="info">No profiles available. Please add profiles in the Profile Manager.</Alert>
              ) : (
                <>
                  <Form.Group className="mb-3">
                    <Form.Label>Select Profile</Form.Label>
                    <Form.Select 
                      value={selectedProfileId || ''} 
                      onChange={(e) => setSelectedProfileId(e.target.value ? parseInt(e.target.value) : null)}
                    >
                      <option value="">-- Select a profile --</option>
                      {profiles.map(profile => (
                        <option key={profile.id} value={profile.id}>
                          {profile.name} - {profile.description || profile.profile_type}
                        </option>
                      ))}
                    </Form.Select>
                  </Form.Group>

                  {selectedProfileId && (
                    <>
                      <Row className="mb-3 align-items-center">
                        <Col md={6}>
                          <Form.Group>
                            <Form.Label>Scale Factor</Form.Label>
                            <Form.Control
                              type="number"
                              value={profileScaler}
                              onChange={(e) => setProfileScaler(Math.max(0.01, parseFloat(e.target.value) || 1))}
                              step="0.01"
                              min="0.01"
                            />
                            <Form.Text className="text-muted">
                              Adjust to match your target consumption
                            </Form.Text>
                          </Form.Group>
                        </Col>
                        <Col md={6}>
                          <div className="d-flex flex-column align-items-center p-2 bg-light rounded">
                            <div className="text-center mb-1">
                              <small>Monthly Consumption:</small>
                            </div>
                            <div className="fs-5 fw-bold text-primary">
                              {Math.round((selectedProfile?.annual_kwh || 12) * profileScaler / 12)} kWh/month
                            </div>
                          </div>
                        </Col>
                      </Row>

                      {/* Preview Chart */}
                      {selectedProfile?.profile_data && (
                        <div className="mb-3" style={{ height: "200px" }}>
                          <p className="mb-2 small">Profile Preview (1 week):</p>
                          <Line 
                            data={generateChartData(selectedProfile.profile_data, profileScaler)} 
                            options={chartOptions} 
                          />
                        </div>
                      )}
                    </>
                  )}
                  
                  <Button 
                    variant="primary" 
                    onClick={handleSelectProfile} 
                    disabled={!selectedProfileId || submitting}
                    className="mt-2"
                  >
                    {submitting ? (
                      <>
                        <Spinner size="sm" className="me-2" /> Applying...
                      </>
                    ) : (
                      <>Apply Profile</>
                    )}
                  </Button>
                </>
              )}
            </Card.Body>
          </Card>
        </Tab>
      </Tabs>

      {/* Existing data preview section */}
      <Card className="shadow-sm">
        <Card.Header>
          <h5 className="mb-0">Current Energy Data</h5>
        </Card.Header>
        <Card.Body>
          {loadingData ? (
            <div className="text-center py-3">
              <Spinner animation="border" size="sm" />
              <p className="mt-2">Loading data...</p>
            </div>
          ) : existingData.length > 0 ? (
            <>
              <p className="mb-3">
                <strong>{existingData.length}</strong> data points available
              </p>
              <div style={{ height: "200px" }} className="mb-3">
                <Line 
                  data={generateChartData(existingData)} 
                  options={chartOptions} 
                />
              </div>
              <table className="table table-sm table-striped">
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Demand (kW)</th>
                  </tr>
                </thead>
                <tbody>
                  {existingData.slice(0, 5).map((row, idx) => {
                    const dateObj = new Date(row.timestamp);
                    const displayTime = isNaN(dateObj.getTime()) ? row.timestamp : dateObj.toLocaleString();
                    return (
                      <tr key={idx}>
                        <td>{displayTime}</td>
                        <td>{row.demand_kw}</td>
                      </tr>
                    );
                  })}
                  {existingData.length > 5 && (
                    <tr>
                      <td colSpan="2" className="text-center text-muted">
                        <em>+ {existingData.length - 5} more data points</em>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
              <div className="text-end mt-3">
                <Button 
                  variant="outline-danger" 
                  size="sm"
                  onClick={() => {
                    if (window.confirm("Are you sure you want to delete all energy data for this project?")) {
                      axios.delete(`${API_URL}/api/projects/${projectId}/energy-data`)
                        .then(() => {
                          showNotification("Energy data deleted successfully", "success");
                          refreshEnergyData();
                        })
                        .catch(err => {
                          console.error("Delete error:", err);
                          showNotification("Failed to delete energy data", "danger");
                        });
                    }
                  }}
                >
                  <i className="bi bi-trash me-1"></i> Delete All Data
                </Button>
              </div>
            </>
          ) : (
            <div className="text-center py-4">
              <i className="bi bi-exclamation-circle fs-1 text-muted"></i>
              <p className="mt-3">No energy data available for this project yet.</p>
              <p className="text-muted">Upload a file or select a profile to get started.</p>
            </div>
          )}
        </Card.Body>
      </Card>
    </div>
  );
}

export default EnergyDataUpload;
