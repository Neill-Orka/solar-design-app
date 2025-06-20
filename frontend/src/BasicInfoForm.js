import React, { useEffect, useState } from 'react';
import { Form, Button, Alert, Row, Col } from 'react-bootstrap'; // Added Row, Col

function BasicInfoForm({ projectId, savedData, onSubmit }) {
  const [consumption, setConsumption] = useState('');
  const [tariff, setTariff] = useState('');
  const [consumerType, setConsumerType] = useState('Residential'); // Default value
  const [transformerSize, setTransformerSize] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (savedData) {
      setConsumption(savedData.consumption || '');
      setTariff(savedData.tariff || '');
      setConsumerType(savedData.consumerType || 'Residential');
      setTransformerSize(savedData.transformerSize || '');
    }
  }, [savedData]); // This effect runs whenever the savedData prop changes

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!consumption || !tariff || !consumerType || !transformerSize) {
      setError('Please fill in all fields.');
      return;
    }
    // Convert to numbers for validation and submission
    const numConsumption = parseFloat(consumption);
    const numTariff = parseFloat(tariff);
    const numTransformerSize = parseFloat(transformerSize);

    if (isNaN(numConsumption) || isNaN(numTariff) || isNaN(numTransformerSize)) {
      setError('Consumption, tariff, and transformer/max demand size must be valid numbers.');
      return;
    }
    if (numConsumption <= 0 || numTariff <= 0 || numTransformerSize <= 0) {
      setError('All numerical values must be positive.');
      return;
    }
    setError('');
    onSubmit({
      consumption: numConsumption,
      tariff: numTariff,
      consumerType,
      transformerSize: numTransformerSize,
    });
  };

  const commonFormControlClasses = "shadow-sm border-gray-300 focus:border-indigo-500 focus:ring focus:ring-indigo-200 focus:ring-opacity-50 rounded-md";

  return (
    <div className="p-4 p-md-5 bg-white rounded-xl shadow-xl" style={{maxWidth: '800px', margin: '2rem auto'}}> {/* Centered and max-width */}
      <h2 className="text-2xl font-semibold text-gray-800 mb-4 text-center">Client & Site Information</h2>
      
      {error && (
        <Alert variant="danger" className="mb-4 shadow-sm d-flex align-items-center">
          <i className="bi bi-exclamation-triangle-fill me-2 fs-5"></i> {/* Bootstrap Icon */}
          {error}
        </Alert>
      )}

      <Form onSubmit={handleSubmit}>
        <Row className="g-4"> {/* Added g-3 for gutter spacing */}
          <Col md={6}>
            <Form.Group className="mb-3">
              <Form.Label className="text-sm font-medium text-gray-700">Monthly Consumption (kWh)</Form.Label>
              <Form.Control
                type="number"
                value={consumption}
                onChange={(e) => setConsumption(e.target.value)}
                placeholder="e.g., 1500"
                className={commonFormControlClasses}
                required
              />
            </Form.Group>
          </Col>

          <Col md={6}>
            <Form.Group className="mb-3">
              <Form.Label className="text-sm font-medium text-gray-700">Average Tariff (R/kWh)</Form.Label>
              <Form.Control
                type="number"
                step="0.01"
                value={tariff}
                onChange={(e) => setTariff(e.target.value)}
                placeholder="e.g., 2.50"
                className={commonFormControlClasses}
                required
              />
            </Form.Group>
          </Col>
        
          <Col md={6}>
            <Form.Group className="mb-3">
              <Form.Label className="text-sm font-medium text-gray-700">Type of Consumer</Form.Label>
              <Form.Select
                value={consumerType}
                onChange={(e) => setConsumerType(e.target.value)}
                className={commonFormControlClasses}
                required
              >
                <option value="" disabled>Select type...</option> {/* Added a disabled default option */}
                <option value="Residential">Residential</option>
                <option value="Commercial">Commercial</option>
                {/* Add more options if needed, e.g., Industrial */}
              </Form.Select>
            </Form.Group>
          </Col>

          <Col md={6}>
            <Form.Group className="mb-3">
              <Form.Label className="text-sm font-medium text-gray-700">Transformer/Max Demand (kW)</Form.Label>
              <Form.Control
                type="number"
                value={transformerSize}
                onChange={(e) => setTransformerSize(e.target.value)}
                placeholder="e.g., 100"
                className={commonFormControlClasses}
                required
              />
            </Form.Group>
          </Col>
        </Row>

        <div className="mt-4 pt-2 text-end"> {/* Aligned button to the right */}
          <Button
            variant="primary" // Consistent primary button styling
            type="submit" // Changed from onClick to type="submit" for form
            className="px-5 py-2 fw-semibold rounded-md shadow-sm hover:bg-blue-700"
            style={{backgroundColor: '#2563eb', borderColor: '#1d4ed8'}} // indigo-600
          >
            Next <i className="bi bi-arrow-right ms-2"></i> {/* Bootstrap Icon */}
          </Button>
        </div>
      </Form>
    </div>
  );
}

export default BasicInfoForm;