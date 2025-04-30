import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import axios from "axios";

function Clients() {
  const [clients, setClients] = useState([]);

  useEffect(() => {
    loadClients();
  }, []);

  const loadClients = () => {
    axios.get("http://localhost:5000/clients")
      .then((response) => {
        setClients(response.data);
      })
      .catch((error) => {
        console.error("Error fetching clients:", error);
        alert("Failed to fetch clients: " + error.message);
      });
  };

  const handleDelete = (id) => {
    if (window.confirm("Are you sure you want to delete this client? This action cannot be undone.")) {
      axios.delete(`http://localhost:5000/delete_client/${id}`)
        .then((response) => {
          alert("Client deleted successfully!");
          loadClients(); // Reload clients after deletion
        })
        .catch((error) => {
          console.error("Error deleting client:", error);
          alert("Failed to delete client: " + (error.response?.data?.error || error.message));
        });
    }
  };

  return (
    <div className="container mt-5">
      <h2>Clients</h2>
      <div className="mb-3">
        <Link to="/clients/add" className="btn btn-primary">Add Client</Link>
      </div>

      {clients.length === 0 ? (
        <p>No clients available. Please add some!</p>
      ) : (
        <ul className="list-group">
          {clients.map((client) => (
            <li key={client.id} className="list-group-item d-flex justify-content-between align-items-center">
              <div>
                <strong>{client.client_name}</strong><br />
                <small>{client.email} | {client.phone}</small>
              </div>
              <div>
                <Link to={`/clients/edit/${client.id}`} className="btn btn-sm btn-outline-primary me-2">Edit</Link>
                <button
                  className="btn btn-sm btn-outline-danger"
                  onClick={() => handleDelete(client.id)}
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default Clients;
