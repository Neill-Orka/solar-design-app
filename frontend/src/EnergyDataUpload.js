import React, { useState } from 'react';
import axios from 'axios';
import { API_URL } from './apiConfig';
import { useNotification } from './NotificationContext';

function EnergyDataUpload({ projectId }) {
  const [energyFile, setEnergyFile] = useState(null);
  const { showNotification } = useNotification();

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
    </div>
  );
}

export default EnergyDataUpload;
