import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_URL } from './apiConfig';
import { useNotification } from './NotificationContext';

function EnergyDataUpload({ projectId }) {
  const [energyFile, setEnergyFile] = useState(null);
  const { showNotification } = useNotification();
  const [existingData, setExistingData] = useState([]);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    setLoadingData(true);
    axios.get(`${API_URL}/api/projects/${projectId}/energy-data`)
      .then(res => setExistingData(res.data))
      .catch(err => console.error('Fetch existing data error:', err))
      .finally(() => setLoadingData(false));
  }, [projectId]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!energyFile) {
      showNotification('Please upload a file.', 'danger');
      return;
    }

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
        setLoadingData(true);
        axios.get(`${API_URL}/api/projects/${projectId}/energy-data`)
          .then(res => setExistingData(res.data))
          .catch(err => console.error('Fetch existing data error:', err))
          .finally(() => setLoadingData(false));
      })
      .catch((error) => {
        console.error('Upload error:', error);
        showNotification('Failed to upload: ' + (error.response?.data?.error || error.message), 'danger');
      });
  };

  return (
    <div>
      <h4>Upload Energy Data</h4>
      <div className="mb-3">
        <label htmlFor="energyFileInput" className="form-label">Upload Energy File</label>
        <input type="file" id="energyFileInput" className="form-control" accept=".xlsx,.xls,.csv" onChange={(e) => setEnergyFile(e.target.files[0])} />
      </div>
      <button className="btn btn-primary" onClick={handleSubmit}>Upload</button>
      {/* preview existing data */}
      <div className="mt-4">
        <h5>Existing Energy Data Preview</h5>
        {loadingData ? (
          <p>Loading data...</p>
        ) : existingData.length > 0 ? (
          <table className="table table-sm">
            <thead><tr><th>Timestamp</th><th>Demand (kW)</th></tr></thead>
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
            </tbody>
          </table>
        ) : (
          <p>No data uploaded yet.</p>
        )}
      </div>
    </div>
  );
}

export default EnergyDataUpload;
