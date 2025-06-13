import React, { useState, useEffect }from 'react';
import { Card, Button, Row, Col, Spinner, Alert } from 'react-bootstrap'; 
import axios from 'axios';

function SystemSelection({ projectId, onSelect, onBack }) {

  const [systems, setSystems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    axios.get('http://localhost:5000/api/system_templates')
      .then(res => {
        setSystems(res.data);
        setLoading(false);
      })
      .catch(err => {
        console.error("Error fetching system templates:", err);
        setError('Failed to load system configurations. Please try again later.');
        setLoading(false);
      });
  }, []);

  if (loading) return <div className="text-center p-5"><Spinner animation="border" /></div>;
  if (error) return <Alert variant="danger">{error}</Alert>;

  return (
    <div 
      className="p-4 py-md-5 px-md-4 bg-white rounded-xl shadow-xl" 
      style={{maxWidth: '900px', margin: '2rem auto'}} // Centered card
    >
      <h2 className="text-2xl lg:text-3xl font-semibold text-gray-800 mb-5 text-center">Select System Configuration</h2>
      
      <Row xs={1} md={2} lg={3} className="g-4">
        {systems.map((system) => (
          <Col key={system.id}>
            <Card className="h-100 shadow-lg border-0 rounded-xl overflow-hidden transition-all duration-300 ease-in-out hover:scale-105">
              <Card.Body className="d-flex flex-column p-4">
                {system.icon && <i className={`${system.icon} fs-2 text-primary mb-3`}></i>}
                <Card.Title className="text-xl font-semibold text-gray-800 mb-2">{system.name}</Card.Title>
                <Card.Text className="text-xs text-gray-600 mb-1 flex-grow-0">
                  {system.description}
                </Card.Text>
                <div className="mt-2 mb-3 pt-2 border-top border-gray-200">
                  <p className="text-sm text-gray-700 mb-1">
                    <strong>Type:</strong> {system.system_type}
                  </p>
                  <p className="text-sm text-gray-700 mb-1">
                    <strong>Capacity:</strong> {system.panel_kw} kWp
                  </p>
                  {system.battery_kwh > 0 && (
                    <p className="text-sm text-gray-700 mb-1">
                      <strong>Battery:</strong> {system.battery_kwh} kWh
                    </p>
                  )}
                  <p className="text-lg font-bold text-primary mt-2">
                    Est. Cost: R{system.total_cost.toLocaleString()}
                  </p>
                </div>
                <Button
                  variant="primary"
                  onClick={() => onSelect(system)}
                  className="w-100 mt-auto py-2 fw-semibold rounded-md shadow-sm hover:shadow-lg transition-shadow"
                  style={{backgroundColor: '#2563eb', borderColor: '#1d4ed8'}}
                >
                  Select System <i className="bi bi-check-lg ms-2"></i>
                </Button>
              </Card.Body>
            </Card>
          </Col>
        ))}
      </Row>

      <div className="mt-5 pt-3 text-center">
        <Button
          variant="outline-secondary"
          onClick={onBack}
          className="px-5 py-2 rounded-md shadow-sm hover:shadow-md transition-shadow"
        >
          <i className="bi bi-arrow-left me-2"></i>Back
        </Button>
      </div>
    </div>
  );
}

export default SystemSelection;