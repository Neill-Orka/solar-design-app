import React from 'react';
import { Card, Button, Row, Col } from 'react-bootstrap'; // Added Row, Col

function SystemSelection({ projectId, onSelect, onBack }) { // Added projectId prop
  // Placeholder systems - In a real app, these might come from an API or config
  const systems = [
    { 
      id: 'system_gt_50', 
      name: 'Standard 50kW Grid-Tied', 
      description: 'Ideal for businesses that want to save on their  Maximizes solar energy usage during daylight hours.',
      cost: 850000, 
      capacity_kw: 50,
      type: 'Grid-Tied',
      icon: 'bi-sun' // Example icon
    },
    { 
      id: 'system_hyb_100', 
      name: 'Advanced 100kW Hybrid', 
      description: '',
      cost: 1800000, 
      capacity_kw: 100, 
      battery_kwh: 50,
      type: 'Hybrid',
      icon: 'bi-lightning-charge' // Example icon
    },
    { 
      id: 'system_gt_200', 
      name: 'Large Scale 200kW Grid-Tied', 
      description: '',
      cost: 3200000, 
      capacity_kw: 200,
      type: 'Grid-Tied',
      icon: 'bi-building' // Example icon
    },
    // Add more predefined systems as needed
  ];

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
                    <strong>Type:</strong> {system.type}
                  </p>
                  <p className="text-sm text-gray-700 mb-1">
                    <strong>Capacity:</strong> {system.capacity_kw} kW
                  </p>
                  {system.battery_kwh && (
                    <p className="text-sm text-gray-700 mb-1">
                      <strong>Battery:</strong> {system.battery_kwh} kWh
                    </p>
                  )}
                  <p className="text-lg font-bold text-primary mt-2">
                    Est. Cost: R{system.cost.toLocaleString()}
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