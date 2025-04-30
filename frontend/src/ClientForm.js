import React, { useState } from 'react';
import axios from 'axios';

function ClientForm() {
  const [clientName, setClientName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();

    const payload = {
      client_name: clientName,
      email: email,
      phone: phone
    };

    axios.post('http://localhost:5000/add_client', payload)
      .then((response) => {
        console.log('Client added:', response.data);
        alert('Client added successfully!');
        setClientName('');
        setEmail('');
        setPhone('');
      })
      .catch((error) => {
        console.error('Error adding client:', error.response ? error.response.data : error.message);
        alert('Failed to add client: ' + (error.response?.data?.error || error.message));
      });
  };

  return (
    <div className="container mt-5">
      <h2>Add New Client</h2>
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
          <button type="submit" className="btn btn-primary">Add Client</button>
        </div>
      </form>
    </div>
  );
}

export default ClientForm;
