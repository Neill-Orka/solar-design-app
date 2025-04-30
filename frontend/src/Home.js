import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";

function Home() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    axios.get('http://localhost:5000/api/stats')
      .then((res) => setStats(res.data))
      .catch((err) => {
        console.error('Failed to load stats:', err);
        setStats(null);
      });
  }, []);

  return (
    <div className="container mt-5">
      <h1 className="text-center mb-5">Welcome to the Solar Design Platform</h1>

      {stats && (
        <div className="row justify-content-center mb-5">
          <div className="col-md-6">
            <div className="card text-center shadow-sm">
              <div className="card-body">
                <h5 className="card-title">Dashboard Statistics</h5>
                <p className="card-text">
                  <strong>Total Clients:</strong> {stats.total_clients}<br />
                  <strong>Total Projects:</strong> {stats.total_projects}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="row justify-content-center">
        <div className="col-md-5 mb-4">
          <div className="card text-center shadow-sm">
            <div className="card-body">
              <h5 className="card-title">Projects</h5>
              <p className="card-text">View, manage, and analyze your solar projects.</p>
              <Link to="/projects" className="btn btn-primary">Go to Projects</Link>
            </div>
          </div>
        </div>
        <div className="col-md-5 mb-4">
          <div className="card text-center shadow-sm">
            <div className="card-body">
              <h5 className="card-title">Clients</h5>
              <p className="card-text">Manage client information and contacts.</p>
              <Link to="/clients" className="btn btn-secondary">Go to Clients</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Home;
