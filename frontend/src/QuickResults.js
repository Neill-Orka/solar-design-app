import React from 'react';
import { Button, Row, Col, Card, Alert } from 'react-bootstrap'; // Added Row, Col, Card, Alert

function QuickResults({ basicInfo, selectedProfile, selectedSystem, onGenerate, onBack }) {
  // Placeholder results - In a real app, these would be calculated or fetched
  const results = {
    annualSavings: 5000,
    paybackPeriod: 5.2,
    roi: 15,
    // You could add more results here, e.g.,
    // annualProduction: 75000, // kWh
    // co2Avoided: 30, // tons
  };

  // Helper to format currency
  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(value);
  };

  return (
    <div 
      className="p-4 py-md-5 px-md-4 bg-white rounded-xl shadow-xl" 
      style={{maxWidth: '800px', margin: '2rem auto'}} // Centered card
    >
      <h2 className="text-2xl lg:text-3xl font-semibold text-gray-800 mb-5 text-center">Quick Simulation Results</h2>

      {/* Display summary of inputs if available */}
      {(basicInfo || selectedProfile || selectedSystem) && (
        <Alert variant="light" className="mb-4 p-3 border rounded-lg shadow-sm">
          <h5 className="text-md font-semibold text-gray-700 mb-2">Based on your inputs:</h5>
          <ul className="list-unstyled text-xs text-gray-600 mb-0">
            {basicInfo && <li><i className="bi bi-lightning-fill me-2 text-muted"></i>Monthly Consumption: {basicInfo.consumption} kWh</li>}
            {selectedProfile && <li><i className="bi bi-person-lines-fill me-2 text-muted"></i>Selected Profile: {selectedProfile.name} (Scaled by: {selectedProfile.scaler || 1})</li>}
            {selectedSystem && <li><i className="bi bi-tools me-2 text-muted"></i>Selected System: {selectedSystem.name} ({selectedSystem.capacity_kw} kW)</li>}
          </ul>
        </Alert>
      )}
      
      <Row xs={1} md={3} className="g-4 mb-5">
        <Col>
          <Card className="text-center shadow-md border-0 rounded-lg h-100">
            <Card.Body className="p-4 d-flex flex-column align-items-center justify-content-center">
              <i className="bi bi-cash-coin fs-1 text-success mb-3"></i>
              <Card.Subtitle className="text-xs text-gray-500 mb-1">Estimated Annual Savings</Card.Subtitle>
              <Card.Title className="text-2xl font-bold text-success">
                {formatCurrency(results.annualSavings)}
              </Card.Title>
            </Card.Body>
          </Card>
        </Col>
        <Col>
          <Card className="text-center shadow-md border-0 rounded-lg h-100">
            <Card.Body className="p-4 d-flex flex-column align-items-center justify-content-center">
              <i className="bi bi-calendar-check fs-1 text-info mb-3"></i>
              <Card.Subtitle className="text-xs text-gray-500 mb-1">Payback Period</Card.Subtitle>
              <Card.Title className="text-2xl font-bold text-info">
                {results.paybackPeriod} <span className="text-lg font-medium">years</span>
              </Card.Title>
            </Card.Body>
          </Card>
        </Col>
        <Col>
          <Card className="text-center shadow-md border-0 rounded-lg h-100">
            <Card.Body className="p-4 d-flex flex-column align-items-center justify-content-center">
              <i className="bi bi-graph-up-arrow fs-1 text-warning mb-3"></i> {/* Changed icon for ROI */}
              <Card.Subtitle className="text-xs text-gray-500 mb-1">Return on Investment (ROI)</Card.Subtitle>
              <Card.Title className="text-2xl font-bold text-warning">
                {results.roi}%
              </Card.Title>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <div className="d-grid gap-2 d-md-flex justify-content-md-end">
        <Button
          variant="outline-secondary"
          onClick={onBack}
          className="px-5 py-2 rounded-md shadow-sm hover:shadow-md transition-shadow order-md-1" // Back button first on mobile
        >
          <i className="bi bi-arrow-left me-2"></i>Back
        </Button>
        <Button
          variant="primary" // Changed from success to primary for consistency
          onClick={onGenerate}
          className="px-5 py-2 fw-semibold rounded-md shadow-md hover:shadow-lg transition-shadow order-md-2" // Generate button second on mobile
          style={{backgroundColor: '#16a34a', borderColor: '#15803d'}} // A nice green color
        >
          <i className="bi bi-file-earmark-arrow-down-fill me-2"></i>Generate Proposal
        </Button>
      </div>
    </div>
  );
}

export default QuickResults;