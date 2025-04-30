import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";

function EditClient() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [clientName, setClientName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  useEffect(() => {
    axios.get(`http://localhost:5000/api/clients/${id}`)
      .then((response) => {
        setClientName(response.data.client_name);
        setEmail(response.data.email);
        setPhone(response.data.phone);
      })
      .catch((error) => {
        console.error('Error loading client:', error);
        alert('Failed to load client information.');
      });
  }, [id]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const payload = {
      client_name: clientName,
      email: email,
      phone: phone
    };

    axios.put(`http://localhost:5000/api/clients/${id}`, payload)
      .then(() => {
        alert('Client updated successfully!');
        navigate('/clients');
      })
      .catch((error) => {
        console.error('Error updating client:', error);
        alert('Failed to update client: ' + (error.response?.data?.error || error.message));
      });
  };

  return (
    <div className="container mt-5">
      <h2>Edit Client</h2>
      <form onSubmit={handleSubmit} className="row g-3">
        <div className="col-md-6">
          <label htmlFor="clientName" className="form-label">Client Name</label>
          <input
            type="text"
            id="clientName"
            className="form-control"
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            required
          />
        </div>

        <div className="col-md-6">
          <label htmlFor="email" className="form-label">Email</label>
          <input
            type="email"
            id="email"
            className="form-control"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <div className="col-md-6">
          <label htmlFor="phone" className="form-label">Phone</label>
          <input
            type="text"
            id="phone"
            className="form-control"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
          />
        </div>

        <div className="col-12">
          <button type="submit" className="btn btn-primary">Save Changes</button>
          <button type="button" className="btn btn-secondary ms-2" onClick={() => navigate('/clients')}>Cancel</button>
        </div>
      </form>
    </div>
  );
}

export default EditClient;
