import React, { useState , useEffect, useMemo, useRef } from 'react';
import axios from 'axios';
import { Line } from 'react-chartjs-2';
import Modal from 'react-bootstrap/Modal';
import Button from 'react-bootstrap/Button';
import { Row, Col, Card, ListGroup, Alert, Form, Spinner, Badge, Table } from 'react-bootstrap';
import Select from 'react-select'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  TimeScale,
  TimeSeriesScale,
  Decimation
} from 'chart.js';
import 'chartjs-adapter-date-fns';
import { API_URL } from './apiConfig';
import { useNotification } from './NotificationContext';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, TimeScale, TimeSeriesScale, Decimation);

const PANEL_WATTAGE = 565; // JA SOLAR 72S30-565/GR

// Generator sizes from fuel table
const GENERATOR_SIZES = [
  { value: 20, label: '20 kW' },
  { value: 30, label: '30 kW' },
  { value: 40, label: '40 kW' },
  { value: 50, label: '50 kW' },
  { value: 60, label: '60 kW' },
  { value: 75, label: '75 kW' },
  { value: 100, label: '100 kW' },
  { value: 125, label: '125 kW' },
  { value: 135, label: '135 kW' },
  { value: 150, label: '150 kW' },
  { value: 175, label: '175 kW' },
  { value: 200, label: '200 kW' },
  { value: 230, label: '230 kW' },
  { value: 250, label: '250 kW' },
  { value: 300, label: '300 kW' },
  { value: 350, label: '350 kW' },
  { value: 400, label: '400 kW' },
  { value: 500, label: '500 kW' },
  { value: 600, label: '600 kW' },
  { value: 750, label: '750 kW' },
  { value: 1000, label: '1000 kW' },
  { value: 1250, label: '1250 kW' },
  { value: 1500, label: '1500 kW' },
  { value: 1750, label: '1750 kW' },
  { value: 2000, label: '2000 kW' }
];

// Sub Component for Stage 1: Sizing Mode
const SizingView = ({ projectId, design, onDesignChange, products, usePvgis, setUsePvgis, profileName, setProfileName, showNotification }) => {

    const persistPanel = async (panelId, panelKw, numPanels) => {
        try {
            await axios.put(`${API_URL}/api/projects/${projectId}`, {
                panel_id: panelId || null,
                panel_kw: panelKw ? parseFloat(panelKw) : 0,
                num_panels: numPanels ? parseInt(numPanels) : 0
            });
            sessionStorage.setItem(`systemDesignModified_${projectId}`, 'true');
        } catch (e) {
            console.error('Failed to save panel selection', e);
            if (showNotification) showNotification('Failed to save panel selection', 'danger');
        }
    };

    const handleTargetKwChange = async (e) => {
      const kw = e.target.value;
      const panelWattage = design.selectedPanel?.product?.power_w || PANEL_WATTAGE;
      const newNumPanels = (kw && parseFloat(kw) > 0) 
        ? Math.max(1, Math.ceil((Math.round(parseFloat(kw) * 1000 * 100) / 100) / panelWattage)) 
        : '';

      onDesignChange({ ...design, panelKw: kw, numPanels: newNumPanels });
    
      // persist
      const panelId = design.selectedPanel?.product?.id || null;
      await persistPanel(panelId, kw || 0, newNumPanels || 0);
    };

    const handleNumPanelsChange = async (e) => {
      const panels = e.target.value;
      const panelWattage = design.selectedPanel?.product?.power_w || PANEL_WATTAGE;
      const newKw = (panels && parseInt(panels) > 0) ? ((parseInt(panels) * panelWattage) / 1000).toFixed(2) : '';
      onDesignChange({ ...design, numPanels: panels, panelKw: newKw });

      // persist
      const panelId = design.selectedPanel?.product?.id || null;
      await persistPanel(panelId, newKw || 0, panels || 0);
    };

    // Handler for react-select components
    const handleSelectChange = async (key, selectedOption) => {
      if (!products) return;
      
      if (!selectedOption) {
        onDesignChange({ ...design, [key]: null });
        if (key === 'selectedPanel') {
            await persistPanel(null, design.panelKw || 0);
        }
        return;
      }

      // Determine which product list to use based on the selection key
      let productType;
      if (key === 'selectedPanel') {
        productType = 'panels';
      } else if (key === 'selectedInverter') {
        productType = 'inverters';
      } else if (key === 'selectedBattery') {
        productType = 'batteries';
      } else {
        return;
      }

      const productList = products[productType] || [];
      const productObject = productList.find(p => p.id === selectedOption.value);
      const next = productObject ? { ...selectedOption, product: productObject } : null;

      onDesignChange({ ...design, [key]: next });

      if (key === 'selectedPanel') {
        const panelId = productObject?.id || null;

        // recompute kWp based on existing numPanels (keeps UI consistent)
        const watt = productObject?.power_w || PANEL_WATTAGE;
        const qty = parseInt(design.numPanels || 0, 10);
        const recomputedKw = qty > 0 ? ((qty * watt) / 1000).toFixed(2) : design.panelKw || 0;

        // Keep design in sync if we recomputed
        if (qty > 0) {
            onDesignChange({ ...design, [key]: next, panelKw: recomputedKw });
        }

        await persistPanel(panelId, recomputedKw);
      }
    };

  return (
    <>
        {/* --- Card Layout for Form --- */}
        <div className="row g-4 mb-4">

            {/* --- Card 1: Core Configuration --- */}
            <div className="col-lg-6">
                <Card className="h-100 shadow-sm">
                    <Card.Body className="d-flex flex-column">
                        <Card.Title as="h5" className="fw-semibold mb-3">
                            <i className="bi bi-gear-fill me-2 text-primary"></i>
                            Core Configuration
                        </Card.Title>
                        <Form.Group className="mb-3">
                            <Form.Label>Generation Data Source</Form.Label>
                            <Form.Check
                                type="switch"
                                id="pvgis-switch"
                                label={usePvgis ? "Live PVGIS Data (Slow)" : "Standard Profile (Fast)"}
                                checked={usePvgis}
                                onChange={e => setUsePvgis(e.target.checked)}
                            />
                        </Form.Group>
                        
                        {/* ONLY show profile dropdown if NOT using PVGIS */}
                        {!usePvgis && (
                            <Form.Group className="mb-3">
                                <Form.Label>Standard Profile Type</Form.Label>
                                <Form.Select
                                    value={profileName}
                                    onChange={e => setProfileName(e.target.value)}
                                >
                                    <option value="hopetown_14_15">Hopetown Azth:14 Tilt:15</option>
                                    <option value="midrand_ew_5">Midrand Azth:east-west Tilt:5</option>
                                    <option value="pvlib_hopetown_0_15">Pvlib Hopetown Azth:0 Tilt:15</option>
                                    <option value="pvlib_hopetown_0_15_0.9">Pvlib Hopetown (x0.9) Azth:0 Tilt:15</option>
                                </Form.Select>
                            </Form.Group>
                        )}

                        <Row>
                            <Col md={6}>
                                <Form.Group className="mb-3">
                                    <Form.Label>System Type</Form.Label>
                                    <Form.Select value={design.systemType} onChange={e => onDesignChange({ ...design, systemType: e.target.value })}>
                                        <option value="grid">Grid-tied</option>
                                        <option value="hybrid">Hybrid</option>
                                        <option value="off-grid">Off-grid</option>
                                    </Form.Select>
                                </Form.Group>
                            </Col>
                            <Col md={6}>
                                <Form.Group>
                                    <Form.Label>Grid Export</Form.Label>
                                    <Form.Check
                                        type="switch"
                                        id="allow_export_switch"
                                        label={design.allowExport ? "Allowed" : "Not Allowed"}
                                        checked={design.allowExport}
                                        onChange={e => onDesignChange({ ...design, allowExport: e.target.checked })}
                                    />
                                </Form.Group>
                            </Col>
                        </Row>
                        {usePvgis && (
                            <Row>
                                <Col md={6}>
                                    <Form.Group className="mb-3">
                                        <Form.Label>Panel Tilt (°)</Form.Label>
                                        <Form.Control
                                            type="number"
                                            value={design.tilt}
                                            onChange={e => onDesignChange({ ...design, tilt: e.target.value })}
                                            placeholder="e.g., 15"
                                        />
                                    </Form.Group>
                                </Col>
                                <Col md={6}>
                                    <Form.Group className="mb-3">
                                        <Form.Label>Panel Azimuth (°)</Form.Label>
                                        <Form.Control
                                            type="number"
                                            value={design.azimuth}
                                            onChange={e => onDesignChange({ ...design, azimuth: e.target.value })}
                                            placeholder="0=N, 180=S"
                                        />
                                    </Form.Group>
                                </Col>
                            </Row>
                        )}
                    </Card.Body>
                </Card>
            </div>

            {/* --- Card 2: PV Array --- */}
            <div className="col-lg-6">
                <Card className="h-100 shadow-sm">
                    <Card.Body className="d-flex flex-column">
                        <Card.Title as="h5" className="fw-semibold mb-3">
                            <i className="bi bi-box-seam me-2 text-primary"></i>
                            PV Array (Solar Panels)
                        </Card.Title>
                        <Row>
                            <Col md={6}>
                                <Form.Group className="mb-3">
                                    <Form.Label>Target Size (kWp)</Form.Label>
                                    <Form.Control
                                        type="number"
                                        value={design.panelKw}
                                        onChange={handleTargetKwChange}
                                        placeholder="e.g., 200"
                                    />
                                </Form.Group>
                            </Col>
                            <Col md={6}>
                                <Form.Group className="mb-3">
                                    <Form.Label>Number of Panels</Form.Label>
                                    <Form.Control
                                        type="number"
                                        value={design.numPanels}
                                        onChange={handleNumPanelsChange}
                                        placeholder="e.g., 354"
                                    />
                                </Form.Group>
                            </Col>
                        </Row>
                        <Row>
                            <Col md={12}>
                                <Form.Group className="mb-3">
                                    <Form.Label>Panel</Form.Label>
                                    <Select
                                        options={products.panels.map(p => ({
                                            value: p.id,
                                            label: `${p.brand} ${p.model}`
                                        }))}
                                        value={design.selectedPanel}
                                        onChange={opt => handleSelectChange('selectedPanel', opt)}
                                        isClearable
                                        placeholder="Select panel.."
                                    />
                                </Form.Group>
                            </Col>
                        </Row>
                    </Card.Body>
                </Card>
            </div>

            {/* --- Card 3: Equipment --- */}
            <div className="col-12">
                <Card className="shadow-sm">
                    <Card.Body>
                        <Card.Title as="h5" className="fw-semibold mb-3">
                            <i className="bi bi-cpu-fill me-2 text-primary"></i>
                            Equipment Selection
                        </Card.Title>
                        <Row>
                            <Col md={6}>
                                <Form.Group>
                                    <Form.Label>Inverter</Form.Label>
                                    <Select options={products.inverters.map(p => ({ value: p.id, label: `${p.brand} ${p.model} (${p.rating_kva}kVA)`}))} value={design.selectedInverter} onChange={opt => handleSelectChange('selectedInverter', opt)} isClearable />
                                </Form.Group>
                                <Form.Group className="mt-2">
                                    <Form.Label className="small">Inverter Quantity</Form.Label>
                                    <Form.Control
                                        type="number"
                                        size="sm"
                                        min="1"
                                        value={design.inverterQuantity}
                                        onChange={e => onDesignChange({...design, inverterQuantity: e.target.value})}
                                        onBlur={e => onDesignChange({...design, inverterQuantity: Math.max(1, parseInt(e.target.value) || 1)})}
                                    />
                                </Form.Group>
                            </Col>
                            <Col md={6}>
                                <Form.Group>
                                    <Form.Label>Battery</Form.Label>
                                    <Select isDisabled={design.systemType === 'grid'} options={products.batteries.map(p => ({ value: p.id, label: `${p.brand} ${p.model} (${p.capacity_kwh}kWh)`}))} value={design.selectedBattery} onChange={opt => handleSelectChange('selectedBattery', opt)} isClearable />
                                </Form.Group>

                                <Row className="mt-2">
                                    <Col md={6}>
                                        <Form.Group>
                                            <Form.Label className="small">Battery Quantity</Form.Label>
                                            <Form.Control
                                                type="number"
                                                size="sm"
                                                min="1"
                                                value={design.batteryQuantity}
                                                onChange={e => onDesignChange({...design, batteryQuantity: e.target.value})}
                                                onBlur={e => onDesignChange({...design, batteryQuantity: Math.max(1, parseInt(e.target.value) || 1)})}
                                                disabled={design.systemType === 'grid'}
                                            />
                                        </Form.Group>
                                    </Col>
                                    <Col md={6}>
                                        <Form.Group>
                                            <Form.Label className="small">Min SOC Limit (%)</Form.Label>
                                            <Form.Control
                                                type="number"
                                                size="sm"
                                                min="0"
                                                max="100"
                                                value={design.batterySocLimit}
                                                onChange={e => onDesignChange({...design, batterySocLimit: e.target.value})}
                                                onBlur={e => onDesignChange({...design, batterySocLimit: Math.max(0, Math.min(50, parseInt(e.target.value) || 0))})}
                                                disabled={design.systemType === 'grid'}
                                            />
                                        </Form.Group>
                                    </Col>
                                </Row>
                            </Col>
                        </Row>
                    </Card.Body>
                </Card>
            </div>
            {/* Card: Generator (Off-Grid) */}
            {design.systemType === 'off-grid' && (
                <div className="col-12 mt-4">
                    <Card className="shadow-sm">
                        <Card.Body>
                            <Card.Title as="h5" className="fw-semibold mb-3">
                                <i className='bi bi-fuel-pump me-2 text-danger'></i>
                                Generator (Off-Grid)
                            </Card.Title>
                            <Row className='g-3'>
                                <Col md={4}>
                                    <Form.Group>
                                        <Form.Label>Enable Generator</Form.Label>
                                        <Form.Check
                                            type="switch"
                                            id="gen-enabled"
                                            checked={design.generatorEnabled}
                                            onChange={e => onDesignChange({ ...design, generatorEnabled: e.target.checked })}
                                            label={design.generatorEnabled ? "Enabled": "Disabled"}
                                        />
                                    </Form.Group>
                                </Col>
                                <Col md={4}>
                                  <Form.Group>
                                    <Form.Label>Rated Power (kW)</Form.Label>
                                    <Select
                                      value={GENERATOR_SIZES.find(s => s.value === design.generatorKva)}
                                      onChange={option => onDesignChange({ ...design, generatorKva: option.value })}
                                      options={GENERATOR_SIZES}
                                      isDisabled={!design.generatorEnabled}
                                      placeholder="Select generator size..."
                                    />
                                  </Form.Group>
                                </Col>
                                <Col md={4}>
                                  <Form.Group>
                                    <Form.Label>Min Loading (%)</Form.Label>
                                    <Form.Control
                                      type="number"
                                      value={design.generatorMinLoading}
                                      min={0} max={100}
                                      onChange={e => onDesignChange({ ...design, generatorMinLoading: e.target.value })}
                                      disabled={!design.generatorEnabled}
                                    />
                                  </Form.Group>
                                </Col>                               
                            </Row>

                            <Row className="g-3 mt-1">
                              <Col md={4}>
                                <Form.Group>
                                  <Form.Label>Diesel Price (R / liter)</Form.Label>
                                  <Form.Control
                                    type="number"
                                    step="0.10"
                                    value={design.dieselPrice}
                                    onChange={e => onDesignChange({ ...design, dieselPrice: e.target.value })}
                                    disabled={!design.generatorEnabled}
                                  />
                                </Form.Group>
                              </Col>
                              <Col md={4}>
                                <Form.Group>
                                  <Form.Label>Min Run Time (hours)</Form.Label>
                                  <Form.Control
                                    type="number"
                                    step="0.1"
                                    value={design.generatorMinRunTime}
                                    onChange={e => onDesignChange({ ...design, generatorMinRunTime: e.target.value })}
                                    disabled={!design.generatorEnabled}
                                  />
                                </Form.Group>
                              </Col>
                              <Col md={4}>
                                <Form.Group className="mt-md-4">
                                  <Form.Check
                                    type="checkbox"
                                    id="gen-charge-batt"
                                    label="Charge battery while running"
                                    checked={design.generatorChargeBattery}
                                    onChange={e => onDesignChange({ ...design, generatorChargeBattery: e.target.checked })}
                                    disabled={!design.generatorEnabled}
                                  />
                                </Form.Group>
                              </Col>
                            </Row>   

                            <Row className="g-3 mt-1">
                              <Col md={4}>
                                <Form.Group>
                                  <Form.Label>Battery Start SoC (%)</Form.Label>
                                  <Form.Control
                                    type="number"
                                    value={design.generatorBatteryStartSoc}
                                    min={0} max={100}
                                    onChange={e => onDesignChange({ ...design, generatorBatteryStartSoc: e.target.value })}
                                    disabled={!design.generatorEnabled}
                                    placeholder="e.g., 20"
                                  />
                                </Form.Group>
                              </Col>
                              <Col md={4}>
                                <Form.Group>
                                  <Form.Label>Battery Stop SoC (%)</Form.Label>
                                  <Form.Control
                                    type="number"
                                    value={design.generatorBatteryStopSoc}
                                    min={0} max={100}
                                    onChange={e => onDesignChange({ ...design, generatorBatteryStopSoc: e.target.value })}
                                    disabled={!design.generatorEnabled}
                                    placeholder="e.g., 90"
                                  />
                                </Form.Group>
                              </Col>
                            </Row>   

                            <Row className="g-3 mt-1">
                              <Col md={4}>
                                <Form.Group>
                                  <Form.Label>Service Cost (R)</Form.Label>
                                  <Form.Control
                                    type="number"
                                    step="10"
                                    value={design.generatorServiceCost}
                                    onChange={e => onDesignChange({ ...design, generatorServiceCost: e.target.value })}
                                    disabled={!design.generatorEnabled}
                                    placeholder="e.g., 1000"
                                  />
                                </Form.Group>
                              </Col>
                              <Col md={4}>
                                <Form.Group>
                                  <Form.Label>Service Interval (hours)</Form.Label>
                                  <Form.Control
                                    type="number"
                                    step="100"
                                    value={design.generatorServiceInterval}
                                    onChange={e => onDesignChange({ ...design, generatorServiceInterval: e.target.value })}
                                    disabled={!design.generatorEnabled}
                                    placeholder="e.g., 1000"
                                  />
                                </Form.Group>
                              </Col>
                            </Row>   

                        </Card.Body>
                    </Card>
                </div>
            )}
        </div> 
    </>
  );
};

// ===================================================================================
//  MAIN COMPONENT
// ===================================================================================

// Helper function to safely parse values that might be numbers or strings
const safeParseFloat = (value) => {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') return parseFloat(value) || 0;
    return 0;
};

const toMidnight = (d) => { d.setHours(0, 0, 0, 0); return d; };
const toEndOfDay = (d) => { d.setHours(23, 59, 59, 999); return d; };
// Component for the Standard Desing feature
const StandardDesignSelector = ({ templates, loading, onSelectSystem }) => {
    if (loading) {
        return (
            <div className='text-center p-5'>
                <Spinner animation="border" variant='primary' />
                <p className='mt-3'>Loading standard designs...</p>
            </div>
        );
    }

    if (!templates || templates.length === 0) {
        return (
            <Alert variant='info' className='my-4'>
                <Alert.Heading>No Standard Designs Available</Alert.Heading>
                <p>There are no standard designs available. You can create a design in the System Builder Tool.</p>
            </Alert>
        );
    }

    return (
        <div className='row g-4 mb-4'>
            {templates.map((system) => (
                <div className='col-md-6 col-lg-4' key={system.id}>
                    <Card className='h-100 shadow-sm hover-card'>
                        <Card.Body className='d-flex flex-column'>
                            <div className='d-flex align-items-center mb-3'>
                                <div className={`rounded-circle bg-${getSystemTypeColor(system.system_type)} p-2 me-2`}>
                                    <i className={`bi ${getSystemTypeIcon(system.system_type)} text-white`}></i>
                                </div>
                                <Card.Title className='mb-0 fs-5'>
                                    {system.name}
                                </Card.Title>
                            </div>

                            <Card.Text className='small text-muted mb-3'>
                                {system.description || 'No description available.'}
                            </Card.Text>
                            <div className='small mb-3'>
                                <div className='small mb-3'>
                                    <span>PV Size:</span>
                                    <Badge bg='warning' text='dark'>{system.panel_kw} kWp</Badge>
                                </div>
                                <div className='d-flex justify-content-between mb-1'>
                                    <span>Inverter:</span>
                                    <Badge bg='info'>{system.inverter_kva} kVA</Badge>
                                </div>
                                <div className='d-flex justify-content-between mb-1'>
                                    <span>Battery:</span>
                                    <Badge bg='success'>
                                        {system.battery_kwh > 0 ? `${system.battery_kwh} kWh` : 'None'}
                                    </Badge>
                                </div>
                                <div className='d-flex justify-content-between mb-1'>
                                    <span>Type:</span>
                                    <span className='fw-semibold'>{formatSystemType(system.system_type)}</span>
                                </div>
                            </div>

                            <div className='mt-auto pt-3 border-top'>
                                <div className='d-flex justify-content-between align-items-center'>
                                    <span className='fw-bold text-primary'>
                                        R{system.total_cost.toLocaleString()}
                                    </span>
                                    <Button 
                                        variant='primary'
                                        size='sm'
                                        onClick={() => onSelectSystem(system)}>
                                        Use This System
                                    </Button>
                                </div>
                            </div>
                        </Card.Body>
                    </Card>
                </div>
            ))}
        </div>
    );
};

// Helper functions for StandardDesignSelector
const getSystemTypeColor = (type) => {
    switch (type?.toLowerCase()) {
        case 'hybrid': return 'success';
        case 'grid-tied': return 'primary';
        case 'off-grid': return 'danger';
        default: return 'secondary';
    }
};

const getSystemTypeIcon = (type) => {
    switch (type?.toLowerCase()) {
        case 'hybrid': return 'bi-battery-charging';
        case 'grid-tied': return 'bi-plug-fill';
        case 'off-grid': return 'bi-sun-fill';
        default: return 'bi-gear-fill';
    }
};

const formatSystemType = (type) => {
    if (!type) return 'Unknown';
    return type.charAt(0).toUpperCase() + type.slice(1).toLowerCase().replace('-', ' ');
};

// Helper function to calculate fuel consumption based on generator size and load factor
const getFuelConsumption = (generatorSizeKw, loadFactor) => {
    // Fuel table data - match the backend fuel table
    const FUEL_TABLE = [
        { size_kw: 20, lph: { 0.25: 2.3, 0.50: 3.4, 0.75: 4.9, 1.00: 6.1 } },
        { size_kw: 30, lph: { 0.25: 4.9, 0.50: 6.8, 0.75: 9.1, 1.00: 10.0 } },
        { size_kw: 40, lph: { 0.25: 6.1, 0.50: 8.7, 0.75: 12.0, 1.00: 15.0 } },
        { size_kw: 50, lph: { 0.25: 6.45, 0.50: 9.8, 0.75: 13.15, 1.00: 16.85 } },
        { size_kw: 60, lph: { 0.25: 6.8, 0.50: 10.9, 0.75: 14.3, 1.00: 18.7 } },
        { size_kw: 75, lph: { 0.25: 9.1, 0.50: 12.8, 0.75: 17.4, 1.00: 23.0 } },
        { size_kw: 100, lph: { 0.25: 9.8, 0.50: 15.5, 0.75: 21.9, 1.00: 28.0 } },
        { size_kw: 125, lph: { 0.25: 11.7, 0.50: 18.9, 0.75: 26.8, 1.00: 34.4 } },
        { size_kw: 135, lph: { 0.25: 12.4, 0.50: 20.4, 0.75: 28.7, 1.00: 37.0 } },
        { size_kw: 150, lph: { 0.25: 13.6, 0.50: 22.3, 0.75: 31.7, 1.00: 41.2 } },
        { size_kw: 175, lph: { 0.25: 15.5, 0.50: 25.7, 0.75: 36.7, 1.00: 48.0 } },
        { size_kw: 200, lph: { 0.25: 17.7, 0.50: 29.1, 0.75: 41.6, 1.00: 54.5 } },
        { size_kw: 230, lph: { 0.25: 20.0, 0.50: 33.3, 0.75: 47.3, 1.00: 62.8 } },
        { size_kw: 250, lph: { 0.25: 21.5, 0.50: 35.9, 0.75: 51.4, 1.00: 68.1 } },
        { size_kw: 300, lph: { 0.25: 25.7, 0.50: 42.7, 0.75: 60.9, 1.00: 81.3 } },
        { size_kw: 350, lph: { 0.25: 29.9, 0.50: 49.5, 0.75: 70.7, 1.00: 95.0 } },
        { size_kw: 400, lph: { 0.25: 33.6, 0.50: 56.4, 0.75: 80.6, 1.00: 108.2 } },
        { size_kw: 500, lph: { 0.25: 41.6, 0.50: 70.0, 0.75: 99.9, 1.00: 135.1 } },
        { size_kw: 600, lph: { 0.25: 49.9, 0.50: 83.2, 0.75: 119.2, 1.00: 182.4 } },
        { size_kw: 750, lph: { 0.25: 61.7, 0.50: 103.7, 0.75: 148.7, 1.00: 202.1 } },
        { size_kw: 1000, lph: { 0.25: 81.7, 0.50: 137.7, 0.75: 197.2, 1.00: 269.1 } },
        { size_kw: 1250, lph: { 0.25: 101.8, 0.50: 171.4, 0.75: 246.0, 1.00: 336.1 } },
        { size_kw: 1500, lph: { 0.25: 121.8, 0.50: 205.5, 0.75: 294.5, 1.00: 403.1 } },
        { size_kw: 1750, lph: { 0.25: 141.9, 0.50: 273.0, 0.75: 343.3, 1.00: 470.1 } },
        { size_kw: 2000, lph: { 0.25: 162.0, 0.50: 273.3, 0.75: 391.7, 1.00: 537.1 } }
    ];

    if (generatorSizeKw <= 0) return 0.0;

    // Find the fuel data for this generator size
    const fuelData = FUEL_TABLE.find(entry => entry.size_kw === generatorSizeKw);
    if (!fuelData) {
        // If exact match not found, use interpolation logic or closest match
        const sortedSizes = FUEL_TABLE.map(e => e.size_kw).sort((a, b) => a - b);
        const closestSize = sortedSizes.reduce((prev, curr) => 
            Math.abs(curr - generatorSizeKw) < Math.abs(prev - generatorSizeKw) ? curr : prev
        );
        const closestData = FUEL_TABLE.find(e => e.size_kw === closestSize);
        if (closestData) {
            return interpolateFuelConsumption(closestData.lph, loadFactor);
        }
        return 0.0;
    }

    return interpolateFuelConsumption(fuelData.lph, loadFactor);
};

const interpolateFuelConsumption = (lphData, loadFactor) => {
    if (loadFactor <= 0.25) return lphData[0.25];
    if (loadFactor <= 0.50) {
        const factor = (loadFactor - 0.25) / 0.25;
        return lphData[0.25] + factor * (lphData[0.50] - lphData[0.25]);
    }
    if (loadFactor <= 0.75) {
        const factor = (loadFactor - 0.50) / 0.25;
        return lphData[0.50] + factor * (lphData[0.75] - lphData[0.50]);
    }
    if (loadFactor <= 1.00) {
        const factor = (loadFactor - 0.75) / 0.25;
        return lphData[0.75] + factor * (lphData[1.00] - lphData[0.75]);
    }
    // Over 100% load - extrapolate
    return lphData[1.00] * loadFactor;
};



function SystemDesign({ projectId }) {
    const simulateButtonRef = useRef(null);

    // --- Piece 1: State Management ---

    // UI Control State
    const [loading, setLoading] = useState(false);
    const [simulationData, setSimulationData] = useState(null);
    const [startDate, setStartDate] = useState(null); // Changed to null like QuickResults
    const [endDate, setEndDate] = useState(null); // Changed to null like QuickResults
    const [showLosses, setShowLosses] = useState(false);
    const [showAverages, setShowAverages] = useState(true);

    // Data State
    const [products, setProducts] = useState({ panels: [], inverters: [], batteries: [] });
    const [project, setProject] = useState(null); // Will hold the loaded project details
    const [usePvgis, setUsePvgis] = useState(false);
    const [profileName, setProfileName] = useState('midrand_ew_5'); // Default profile for non-PVGIS mode

    const [designMode, setDesignMode] = useState('custom');
    const [systemTemplates, setSystemTemplates] = useState([]);
    const [loadingTemplates, setLoadingTemplates] = useState(true);

    const { showNotification } = useNotification();

    // The single, unified state object for the entire design
    // Load generator settings synchronously from sessionStorage in the initializer
    const [design, setDesign] = useState(() => {
            const initial = {
                systemType: 'grid',
                panelKw: '',
                numPanels: '',
                tilt: '15',
                azimuth: '0',
                selectedPanel: null,
                selectedInverter: null, // Will hold the full { value, label, product } object
                inverterQuantity: 1,
                selectedBattery: null,  // Will hold the full { value, label, product } object
                batteryQuantity: 1,
                allowExport: false,
                batterySocLimit: 20,

                // New generator config (only used in off-grid)
                generatorEnabled: false,
                generatorKva: 50, // Default to 50kW
                generatorMinLoading: 25, // % - Default minimum loading
                dieselPrice: 20.4, // R per liter - Default diesel price
                generatorChargeBattery: true,
                generatorMinRunTime: 0, // minimum run time in hours (changed from minutes)
                generatorBatteryStartSoc: 20, // battery SoC when generator starts
                generatorBatteryStopSoc: 100, // battery SoC when generator stops (changed from 90)
                generatorServiceCost: 1000, // R - Default service cost
                generatorServiceInterval: 1000, // hours - Default service interval
            };

            if (!projectId) return initial;

            const cached = sessionStorage.getItem(`generatorSettings_${projectId}`);
            if (cached) {
                try {
                    const parsed = JSON.parse(cached);
                    console.log('Loading cached generator settings in initializer:', parsed);
                    return {
                        ...initial,
                        generatorEnabled: parsed.generatorEnabled ?? initial.generatorEnabled,
                        generatorKva: parsed.generatorKva ?? initial.generatorKva,
                        generatorMinLoading: parsed.generatorMinLoading ?? initial.generatorMinLoading,
                        generatorChargeBattery: parsed.generatorChargeBattery ?? initial.generatorChargeBattery,
                        dieselPrice: parsed.dieselPrice ?? initial.dieselPrice,
                        generatorMinRunTime: parsed.generatorMinRunTime ?? initial.generatorMinRunTime,
                        generatorBatteryStartSoc: parsed.generatorBatteryStartSoc ?? initial.generatorBatteryStartSoc,
                        generatorBatteryStopSoc: parsed.generatorBatteryStopSoc ?? initial.generatorBatteryStopSoc,
                        generatorServiceCost: parsed.generatorServiceCost ?? initial.generatorServiceCost,
                        generatorServiceInterval: parsed.generatorServiceInterval ?? initial.generatorServiceInterval
                    };
                } catch (err) {
                    console.error('Failed to parse cached generator settings in initializer:', err);
                    sessionStorage.removeItem(`generatorSettings_${projectId}`);
                }
            }
            console.log('No cached generator settings found in initializer for project:', projectId);
            return initial;
    });            

    // State for all calculated metrics from the simulation results
    const [metrics, setMetrics] = useState({
        totalPVGeneration: 0,
        utilizedPVGeneration: 0,
        gridImport: 0,
        gridExport: 0,
        batteryChargeDischarge: 0,
        pvUtilization: '0',
    });

    const [annualMetrics, setAnnualMetrics] = useState({
        daytimeConsumption: '0',
        consumptionFromPV: '0',
        pvUtilization: '0',
        potentialGenDaily: '0',
        utilizedGenDaily: '0',
        throttlingLossesDaily: '0',
        specificYieldWithThrottling: '0',
        potentialGenAnnual: '0',
        utilizedGenAnnual: '0',
        throttlingLossesAnnual: '0',
        specificYieldExclThrottling: '0',
        batteryCyclesAnnual: '0',
    });

// --- Piece 2: Data Fetching & Side Effects ---

    // Effect to fetch all system templates
    useEffect(() => {
        if (designMode === 'standard') {
            setLoadingTemplates(true);
            axios.get(`${API_URL}/api/system_templates`)
                .then(res => {
                    setSystemTemplates(res.data);
                    setLoadingTemplates(false);
                })
                .catch(err => {
                    console.error("Error fetching system templates:", err);
                    showNotification("Failed to load standard designs.", 'danger');
                    setLoadingTemplates(false);
                });
        }
    }, [designMode, showNotification]); // Only runs when designMode changes

    // Effect to fetch all product lists once
    useEffect(() => {
        const fetchAllProducts = async () => {
            try {
                // Fetch all product categories in parallel for efficiency
                const [panelsRes, invertersRes, batteriesRes] = await Promise.all([
                    axios.get(`${API_URL}/api/products?category=panel`),
                    axios.get(`${API_URL}/api/products?category=inverter`),
                    axios.get(`${API_URL}/api/products?category=battery`)
                ]);
                setProducts({
                    panels: panelsRes.data,
                    inverters: invertersRes.data,
                    batteries: batteriesRes.data
                });
            } catch (err) {
                showNotification('Failed to load product lists.', 'danger');
            }
        };
        fetchAllProducts();
    }, [showNotification]); // The dependency array is empty so it only runs once

    // Effect to load cached simulation data from sessionStorage
    useEffect(() => {
        if (!projectId) return;

        // Load simulation data from sessionStorage
        const cached = sessionStorage.getItem(`simulationData_${projectId}`);
        if (cached) {
            try {
                const parsed = JSON.parse(cached);
                if (parsed.timestamps) {
                    setSimulationData(parsed);
                }
            } catch (err) {
                console.error('Failed to parse cached simulation data:', err);
                // Clean up corrupted cache
                sessionStorage.removeItem(`simulationData_${projectId}`);
            }
        }
    }, [projectId]);

    // Effect to save generator settings to sessionStorage when they change
    useEffect(() => {
        if (!projectId) return;

        const generatorSettings = {
            generatorEnabled: design.generatorEnabled,
            generatorKva: design.generatorKva,
            generatorMinLoading: design.generatorMinLoading,
            generatorChargeBattery: design.generatorChargeBattery,
            dieselPrice: design.dieselPrice,
            generatorMinRunTime: design.generatorMinRunTime,
            generatorBatteryStartSoc: design.generatorBatteryStartSoc,
            generatorBatteryStopSoc: design.generatorBatteryStopSoc,
            generatorServiceCost: design.generatorServiceCost,
            generatorServiceInterval: design.generatorServiceInterval
        };

        sessionStorage.setItem(`generatorSettings_${projectId}`, JSON.stringify(generatorSettings));
    }, [projectId, design.generatorEnabled, design.generatorKva, design.generatorMinLoading, 
        design.generatorChargeBattery, design.dieselPrice, design.generatorMinRunTime, 
        design.generatorBatteryStartSoc, design.generatorBatteryStopSoc, 
        design.generatorServiceCost, design.generatorServiceInterval]);

    // Effect to load the specific project's data or core components from quotes
    // This runs after the project ID is available and after the products have been loaded
    useEffect(() => {
        // Wait until we have products before trying to match them
        if (!projectId || products.inverters.length === 0) return;
        
        // Check for core components from quote first
        const coreComponentsKey = `quoteLoadCoreComponents_${projectId}`;
        const coreComponentsData = sessionStorage.getItem(coreComponentsKey);
        
        if (coreComponentsData) {
            // If we have core components from a quote, use those instead of project data
            try {
                const coreComponents = JSON.parse(coreComponentsData);
                console.log('Loading core components from quote instead of project data:', coreComponents);
                
                let updates = {};
                
                // Update panel selection if present
                if (coreComponents.panel) {
                    const panelProduct = products.panels.find(p => p.id === coreComponents.panel.id);
                    if (panelProduct) {
                        updates.selectedPanel = {
                            value: panelProduct.id,
                            label: `${panelProduct.brand_name} ${panelProduct.model}`,
                            product: panelProduct
                        };
                        updates.panelKw = ((coreComponents.panel.quantity * (panelProduct.power_w || PANEL_WATTAGE)) / 1000).toFixed(2);
                        updates.numPanels = coreComponents.panel.quantity;
                    }
                }
                
                // Update inverter selection if present
                if (coreComponents.inverter) {
                    console.log('Looking for inverter with ID:', coreComponents.inverter.id, 'in products:', products.inverters.length, 'inverters');
                    const inverterProduct = products.inverters.find(p => p.id === coreComponents.inverter.id);
                    console.log('Found inverter product:', inverterProduct);
                    if (inverterProduct) {
                        updates.selectedInverter = {
                            value: inverterProduct.id,
                            label: `${inverterProduct.model} (${inverterProduct.rating_kva}kVA)`,
                            product: inverterProduct
                        };
                        updates.inverterQuantity = coreComponents.inverter.quantity;
                        console.log('Set inverter:', updates.selectedInverter, 'quantity:', updates.inverterQuantity);
                    } else {
                        console.warn('Inverter product not found with ID:', coreComponents.inverter.id);
                    }
                }
                
                // Update battery selection if present
                if (coreComponents.battery) {
                    const batteryProduct = products.batteries.find(p => p.id === coreComponents.battery.id);
                    if (batteryProduct) {
                        updates.selectedBattery = {
                            value: batteryProduct.id,
                            label: `${batteryProduct.description} (${batteryProduct.capacity_kwh}kWh)`,
                            product: batteryProduct
                        };
                        updates.batteryQuantity = coreComponents.battery.quantity;
                    }
                }
                
                if (Object.keys(updates).length > 0) {
                    setDesign(prevDesign => ({
                        ...prevDesign,
                        ...updates
                    }));
                    
                    // Set quote info when loading from quote
                    setLoadedFromQuote(true);
                    setQuoteInfo({
                        name: coreComponents.quote_name || 'Quote Components',
                        number: coreComponents.quote_number || 'Unknown'
                    });
                    
                    // Clear standard template state since we're now using quote components
                    setUsingStandardTemplate(false);
                    setStandardTemplateInfo(null);
                    
                    console.log('Updated SystemDesign with core components from quote');
                }
                
                // Clean up the sessionStorage after using it
                sessionStorage.removeItem(coreComponentsKey);
                
            } catch (error) {
                console.error('Failed to parse core components data:', error);
                sessionStorage.removeItem(coreComponentsKey);
            }
            
            // Don't continue with normal project loading if we used core components
            return;
        }
        
        // Normal project data loading (only if no core components from quote)
        axios.get(`${API_URL}/api/projects/${projectId}`).then(res => {
            const p = res.data;
            if (!p) return;

            // Check if this project uses a standard template
            if (p.from_standard_template || p.template_id) {
                console.log("Loading project from standard template:", p.template_name);
                setUsingStandardTemplate(true);
                setStandardTemplateInfo({
                    id: p.template_id,
                    name: p.template_name || 'Standard Design'
                });
            }

            // Check for core components from quote first - if present, skip normal project loading
        const coreComponentsKey = `quoteLoadCoreComponents_${projectId}`;
        const coreComponentsData = sessionStorage.getItem(coreComponentsKey);
        
        if (coreComponentsData) {
            // Core components will be handled by the other effect, skip normal project loading
            return;
        }
            const savedKw = p.panel_kw || '';
            const defaultPanelId = p.panel_id;
            const currentPanel = defaultPanelId ?
                products.panels.find(panel => panel.id === defaultPanelId) :
                products.panels.find(panel => panel.power_w === PANEL_WATTAGE)

            // Use stored num_panels directly instead of calculating to avoid rounding issues
            const numPanels = p.num_panels || '';
            
            // Find the full product object for the saved inverter
            const inverterInfo = p.inverter_kva && typeof p.inverter_kva === 'object' ? p.inverter_kva : {model: null, capacity: p.inverter_kva, quantity: 1 };
            const currentInverter = inverterInfo.model ? products.inverters.find(inv => inv.model === inverterInfo.model) : null;

            // Find the full product object for the saved battery
            const batteryInfo = p.battery_kwh && typeof p.battery_kwh === 'object' ? p.battery_kwh : { model: null, capacity: p.battery_kwh, quantity: 1 };
            const currentBattery = products.batteries.find(bat => bat.model === batteryInfo.model);

            setUsePvgis(p.use_pvgis || false);
            setProfileName(p.generation_profile_name || 'midrand_ew_5'); // Default to

            // Update the master 'design' state with all the loaded data
            // Apply generator settings override if available
            setDesign(prevDesign => ({
                ...prevDesign, // Preserve any existing settings
                systemType: p.system_type || 'grid',
                panelKw: savedKw,
                numPanels: numPanels,
                tilt: p.surface_tilt ?? '15',
                azimuth: p.surface_azimuth ?? '0',
                selectedPanel: currentPanel ? { value: currentPanel.id, label: `${currentPanel.brand} ${currentPanel.model}`, product: currentPanel } : null,
                selectedInverter: currentInverter ? { value: currentInverter.id, label: `${currentInverter.model} (${currentInverter.rating_kva}kVA)`, product: currentInverter } : null,
                inverterQuantity: inverterInfo.quantity || 1,
                selectedBattery: currentBattery ? { value: currentBattery.id, label: `${currentBattery.model} (${currentBattery.capacity_kwh}kWh)`, product: currentBattery } : null,
                batteryQuantity: batteryInfo.quantity || 1,
                allowExport: p.allow_export || false,
                batterySocLimit: p.battery_soc_limit || 20,
            }));
        });
    }, [projectId, products]); // Reruns if projectId or the loaded products change

    // Logic to load products of the system templates
    const handleSelectTemplate = (template) => {
        setLoading(true);
        // Find the products from the template components
        const panelComponent = template.components?.find(c => 
            products.panels.some(p => p.id === c.product_id));
        const inverterComponent = template.components?.find(c =>
            products.inverters.some(p => p.id === c.product_id));
        const batteryComponent = template.components?.find(c =>
            products.batteries.some(p => p.id === c.product_id));

        // Find the product objects
        const selectedPanel = panelComponent ? 
            products.panels.find(p => p.id === panelComponent.product_id) : null;
        const selectedInverter = inverterComponent ? 
            products.inverters.find(p => p.id === inverterComponent.product_id) : null;
        const selectedBattery = batteryComponent ? 
            products.batteries.find(p => p.id === batteryComponent.product_id) : null;

        // Calculate quantities
        const panelQuantity = panelComponent?.quantity || 0;
        const inverterQuantity = inverterComponent?.quantity || 1;
        const batteryQuantity = batteryComponent?.quantity || 1;

        // Calculate panel_kw from panel quantity and power rating
        const calculatedPanelKw = selectedPanel && panelQuantity > 0 ? 
            ((selectedPanel.power_w * panelQuantity) / 1000) : 0;

        // Update the design state while preserving generator settings  
        const newDesignData = {
            systemType: template.system_type?.toLowerCase() || 'grid',
            panelKw: calculatedPanelKw.toString(),
            numPanels: panelQuantity.toString(),
            tilt: '15',
            azimuth: '0',
            selectedPanel: selectedPanel ? {
                value: selectedPanel.id,
                label: `${selectedPanel.brand} ${selectedPanel.model}`,
                product: selectedPanel
            } : null,
            selectedInverter: selectedInverter ? {
                value: selectedInverter.id,
                label: `${selectedInverter.brand} ${selectedInverter.model} (${selectedInverter.rating_kva} kVA)`,
                product: selectedInverter
            } : null,
            inverterQuantity: inverterQuantity,
            selectedBattery: selectedBattery ? {
                value: selectedBattery.id,
                label: `${selectedBattery.brand} ${selectedBattery.model} (${selectedBattery.capacity_kwh} kWh)`,
                product: selectedBattery
            } : null,
            batteryQuantity: batteryQuantity,
            allowExport: template.allow_export || false,
            batterySocLimit: template.battery_soc_limit || 20,
            from_standard_template: true,
            template_id: template.id,
            template_name: template.name
        };

        setDesign(prevDesign => ({
            ...prevDesign, // Preserve existing generator settings
            ...newDesignData
        }));
        
        // Update template state immediately to fix banner display
        setUsingStandardTemplate(true);
        setStandardTemplateInfo({
            id: template.id,
            name: template.name
        });
        
        // Switch back to custom design mode to show the populated form
        setDesignMode('custom');
        showNotification(`Applied system template: ${template.name}`, 'success');

        // Scroll to simulate button immediately
        if (simulateButtonRef.current) {
            simulateButtonRef.current.scrollIntoView({
                behavior: 'smooth',
                block: 'start',
            });
        }

        // Automatically run simulation with the new design
        // Use Timeout to ensure state is updated before simulation
        setTimeout(() => {
            
            // First, build the save payload (just like in handleSimulate)
            const savePayload = {
                system_type: newDesignData.systemType,
                panel_kw: parseFloat(newDesignData.panelKw),
                num_panels: parseInt(newDesignData.numPanels),
                surface_tilt: parseFloat(newDesignData.tilt),
                surface_azimuth: parseFloat(newDesignData.azimuth),
                allow_export: newDesignData.allowExport,
                panel_id: newDesignData.selectedPanel?.product?.id,
                inverter_kva: newDesignData.selectedInverter ? {
                    model: newDesignData.selectedInverter.product.model,
                    capacity: newDesignData.selectedInverter.product.rating_kva,
                    quantity: newDesignData.inverterQuantity
                } : null,
                inverter_ids: newDesignData.selectedInverter ? [newDesignData.selectedInverter.product.id] : [],
                battery_kwh: newDesignData.systemType !== 'grid' && newDesignData.selectedBattery ? {
                    model: newDesignData.selectedBattery.product.model,
                    capacity: newDesignData.selectedBattery.product.capacity_kwh,
                    quantity: newDesignData.batteryQuantity
                } : null,
                battery_ids: newDesignData.systemType !== 'grid' && newDesignData.selectedBattery ? [newDesignData.selectedBattery.product.id] : [],
                use_pvgis: usePvgis,
                generation_profile_name: profileName,
                battery_soc_limit: newDesignData.batterySocLimit,
                project_value_excl_vat: template.total_cost,
                from_standard_template: true,
                template_id: template.id,
                template_name: template.name
            };

            sessionStorage.setItem(`systemDesignModified_${projectId}`, 'true'); 

            // Save first, then simulate (just like in handleSimulate)
            axios.put(`${API_URL}/api/projects/${projectId}`, savePayload)
                .then(() => {
                    // Clear BOM when switching templates (fresh start)
                    return axios.post(`${API_URL}/api/projects/${projectId}/bom/clear`);
                })
                .then(() => {
                    // Now run simulation with the current design state (which includes generator settings)
                    const simPayload = {
                        project_id: projectId,
                        use_pvgis: usePvgis,
                        profile_name: profileName,
                        system: {
                            panel_kw: parseFloat(newDesignData.panelKw),
                            panel_id: newDesignData.selectedPanel?.product?.id || null,
                            tilt: parseFloat(newDesignData.tilt),
                            azimuth: parseFloat(newDesignData.azimuth),
                            system_type: newDesignData.systemType,
                            inverter_kva: (newDesignData.selectedInverter?.product?.rating_kva || 0) * newDesignData.inverterQuantity,
                            battery_kwh: (newDesignData.selectedBattery?.product?.capacity_kwh || 0) * newDesignData.batteryQuantity,
                            allow_export: newDesignData.allowExport,
                            battery_soc_limit: newDesignData.batterySocLimit,

                            generator: {
                              enabled: newDesignData.systemType === 'off-grid' && !!design.generatorEnabled,
                              kva: parseFloat(design.generatorKva || 0),
                              min_loading_pct: parseFloat(design.generatorMinLoading || 25),
                              can_charge_battery: !!design.generatorChargeBattery,
                              diesel_price_r_per_liter: parseFloat(design.dieselPrice || 23.50),
                              min_run_time_hours: parseFloat(design.generatorMinRunTime || 1.0),
                              battery_start_soc: parseFloat(design.generatorBatteryStartSoc || 20),
                              battery_stop_soc: parseFloat(design.generatorBatteryStopSoc || 100),
                              service_cost: parseFloat(design.generatorServiceCost || 1000),
                              service_interval_hours: parseFloat(design.generatorServiceInterval || 1000)
                            }
                        }
                    };

                    return axios.post(`${API_URL}/api/simulate`, simPayload);
                })
                .then(res => {
                    if (!res.data || !res.data.timestamps) {
                        showNotification('Simulation failed: No data returned.', 'danger');
                        return;
                    }

                    setSimulationData(res.data);

                    try {
                        sessionStorage.setItem(`simulationData_${projectId}`, JSON.stringify(res.data));
                        console.log('Cached simulation data:', projectId);
                    } catch (err) {
                        console.error('Failed to cache simulation data:', err);
                    }

                    showNotification('Standard system applied, saved, and simulated!', 'success');
                })
                .catch(err => {
                    const errorMsg = err.response?.data?.error || 'Failed to save or simulate the system.';
                    showNotification(errorMsg, 'danger');
                })
                .finally(() => setLoading(false));
        }, 100);
    }

    // --- Piece 3: User Actions & Event Handlers ---

    // Effect to set default date range when simulation data loads
    useEffect(() => {
        if (simulationData?.timestamps?.length > 0) {
            const timestamps = simulationData.timestamps;
            const firstDate = new Date(timestamps[0]);
            const lastDate = new Date(timestamps[timestamps.length - 1]);

            const defaultEndDate = new Date(firstDate);
            defaultEndDate.setDate(firstDate.getDate() + 7); // Default to 7 days later

            setStartDate(firstDate);
            setEndDate(defaultEndDate > lastDate ? lastDate : defaultEndDate);
        }
    }, [simulationData]);

    const rangeDays = useMemo(() => {
        if (!startDate || !endDate) return 0;
        const days = Math.round((endDate - startDate) / (1000 * 60 * 60 * 24));
        return Math.max(1, days);
    }, [startDate, endDate]);




    const chartData = useMemo(() => {
    if (!simulationData || !startDate || !endDate) return { labels: [], datasets: [] };

    const sim = simulationData;
    const startIndex = sim.timestamps.findIndex(t => new Date(t) >= startDate);
    let endIndex = sim.timestamps.findIndex(t => new Date(t) > endDate);
    if (endIndex === -1) endIndex = sim.timestamps.length;
    if (startIndex === -1) return { labels: [], datasets: [] };

    const ts = sim.timestamps.slice(startIndex, endIndex).map(t => new Date(t));
    const enableLTTB = rangeDays > 120 && ts.length >= 3; // > ~4 months
    
    const demand = sim.demand.slice(startIndex, endIndex);
    const import_grid = sim.import_from_grid.slice(startIndex, endIndex);
    const export_grid = sim.export_to_grid.slice(startIndex, endIndex);
    const battery_soc = sim.battery_soc.slice(startIndex, endIndex);
    const generation = sim.generation.slice(startIndex, endIndex);
    const pv_potential = sim.potential_generation ? sim.potential_generation.slice(startIndex, endIndex) : [];
    const generator_kw = sim.generator_kw ? sim.generator_kw.slice(startIndex, endIndex) : [];

    // Helper to produce {x,y} points for LTTB
    const toXY = (xs, ys) => {
        const out = new Array(xs.length);
        for (let i = 0; i < xs.length; i++) {
            const x = xs[i] instanceof Date ? xs[i].getTime() : +xs[i];
            const yy = ys?.[i];
            const y = Number.isFinite(yy) ? yy : 0;
            out[i] = { x, y };
        }
        return out;
    }

    // When LTTB is on, pass {x,y}. Otherwise keep fast numeric arrays + labels.
    const labels = enableLTTB ? [] : ts;
    const demandData      = enableLTTB ? toXY(ts, demand)       : demand;
    const importData      = enableLTTB ? toXY(ts, import_grid)  : import_grid;
    const exportData      = enableLTTB ? toXY(ts, export_grid)  : export_grid;
    const socData         = enableLTTB ? toXY(ts, battery_soc)  : battery_soc;
    const genData         = enableLTTB ? toXY(ts, generation)   : generation;
    const potentialData   = enableLTTB ? toXY(ts, pv_potential) : pv_potential;
    const generatorData   = enableLTTB ? toXY(ts, generator_kw) : generator_kw;

    const datasets = [
        {
        label: 'Demand (kW)',
        data: demandData,
        borderColor: '#ff6384', backgroundColor: '#ff638420',
        tension: 0.3, pointRadius: 0, borderWidth: 2
        },
        {
        label: 'Grid Import (kW)',
        data: importData,
        borderColor: '#cc65fe', backgroundColor: '#cc65fe20',
        tension: 0.3, pointRadius: 0, borderWidth: 1.5, borderDash: [5,5]
        },
        {
        label: 'Battery SOC (%)',
        data: socData, yAxisID: 'y1',
        borderColor: '#ffce56', backgroundColor: '#ffce5620',
        tension: 0.3, pointRadius: 0, borderWidth: 2
        },
        {
        label: 'PV Generation (kW)',
        data: genData,
        borderColor: '#36a2eb', backgroundColor: '#36a2eb20',
        tension: 0.3, pointRadius: 0, borderWidth: 2, fill: true
        }
    ];

    if (showLosses && potentialData.length > 0) {
        datasets.push({
        label: 'PV Potential (kW)',
        data: potentialData,
        borderColor: '#4bc0c0', backgroundColor: '#386f6f20',
        tension: 0.3, pointRadius: 0, borderWidth: 1, borderDash: [5,5], fill: true
        });
    }

    if (showLosses && exportData.length > 0 && design.allowExport) {
        datasets.push({
        label: 'Grid Export (kW)',
        data: exportData,
        borderColor: '#ff9f40', backgroundColor: '#ff9f4020',
        tension: 0.3, pointRadius: 0, borderWidth: 1.5
        });
    }

    if (design.systemType === 'off-grid' && generatorData.length > 0) {
        datasets.push({
        label: 'Generator (kW)',
        data: generatorData,
        borderColor: '#33ff92ff', backgroundColor: '#33ff6320',
        tension: 0.3, pointRadius: 0, borderWidth: 2
        });
    }

    return { labels, datasets };
    }, [simulationData, startDate, endDate, showLosses, design.systemType, design.allowExport, rangeDays]);


    // Memorized chart data (exactly like QuickResults structure)
    const chartDataAverage = useMemo(() => {
        if (!simulationData || !startDate || !endDate) {
            return { labels: [], datasets: [] };
        }

        const sim = simulationData;
        
        const startIndex = sim.timestamps.findIndex(t => new Date(t) >= startDate);
        let endIndex = sim.timestamps.findIndex(t => new Date(t) > endDate);    
        if (endIndex === -1) endIndex = sim.timestamps.length; // If no end date found, use full length
        if (startIndex === -1) return { labels: [], datasets: [] }; // If no start date found, return empty

        // Determine if we need to downsample based on range size
        // For ranges > 90 days, downsample to improve performance
        let timestamps = [];
        let demand = [];
        let import_grid = [];
        let battery_soc = [];
        let generation = [];
        let pv_potential = [];
        let export_grid = [];
        let generator_kw = [];

        if (rangeDays > 90) {
            // Downsample to daily average values for long ranges
            console.log('Downsampling data for better performance - showing daily averages');

            // Group by day and calculate averages
            const dailyData = {};

            for (let i = startIndex; i < endIndex; i++) {
                const date = new Date(sim.timestamps[i]);
                const dayKey = date.toISOString().split('T')[0]; // YYYY-MM-DD

                if (!dailyData[dayKey]) {
                    dailyData[dayKey] = {
                        count: 0,
                        demand: 0,
                        import: 0,
                        export: 0,
                        battery: 0,
                        genArr: [],
                        potArr: [],
                        generator: 0,
                        timestamp: new Date(dayKey)
                    };
                }

                // Sum values for averaging later
                dailyData[dayKey].count++;
                dailyData[dayKey].demand += sim.demand[i] || 0;
                dailyData[dayKey].import += sim.import_from_grid[i] || 0;
                dailyData[dayKey].export += sim.export_to_grid[i] || 0;
                dailyData[dayKey].battery += sim.battery_soc[i] || 0;
                dailyData[dayKey].genArr.push(sim.generation[i] || 0);
                dailyData[dayKey].potArr.push((sim.potential_generation ? sim.potential_generation[i] : sim.generation[i]) || 0);
                dailyData[dayKey].generator += (sim.generator_kw ? sim.generator_kw[i] : 0) || 0;
            }

            // Convert to arrays of daily averages
            const days = Object.keys(dailyData).sort();
            days.forEach(day => {
                const data = dailyData[day];
                timestamps.push(data.timestamp);
                demand.push(data.demand / data.count);
                import_grid.push(data.import / data.count);
                export_grid.push(data.export / data.count);
                battery_soc.push(data.battery / data.count);
                
                // daylight-aware threshold
                const panelKw = parseFloat(design.panelKw || 0) || 0;
                const baseThresh = panelKw > 0 ? 0.02 * panelKw : 0.05; // 2% of array kW, fallback 0.05 kW
                const dayMaxPot = data.potArr.length ? Math.max(...data.potArr) : 0;
                const thr = Math.max(baseThresh, 0.05 * dayMaxPot);

                // average only where PV is "on"
                let gSum = 0, pSum = 0, n = 0;
                for (let i = 0; i < data.genArr.length; i++) {
                const g = data.genArr[i] || 0;
                const p = data.potArr[i] || 0;
                if (p > thr || g > thr) { gSum += g; pSum += p; n++; }
                }
                generation.push(n ? gSum / n : 0);
                pv_potential.push(n ? pSum / n : 0);

                generator_kw.push(data.generator / data.count);
            });
        } else {
            // For smaller ranges, use full resolution
            timestamps = sim.timestamps.slice(startIndex, endIndex).map(t => new Date(t));
            demand = sim.demand.slice(startIndex, endIndex);
            import_grid = sim.import_from_grid.slice(startIndex, endIndex);
            export_grid = sim.export_to_grid.slice(startIndex, endIndex);
            battery_soc = sim.battery_soc.slice(startIndex, endIndex);
            generation = sim.generation.slice(startIndex, endIndex);
            pv_potential = sim.potential_generation ? sim.potential_generation.slice(startIndex, endIndex) : [];
            generator_kw = sim.generator_kw ? sim.generator_kw.slice(startIndex, endIndex) : [];
        }

        const datasets = [
            { 
                label: 'Demand (kW)', 
                data: demand, 
                borderColor: '#ff6384', 
                backgroundColor: '#ff638420', 
                tension: 0.3, 
                pointRadius: 0, 
                borderWidth: 2 
            },
            { 
                label: 'Grid Import (kW)', 
                data: import_grid, 
                borderColor: '#cc65fe', 
                backgroundColor: '#cc65fe20', 
                tension: 0.3, 
                pointRadius: 0, 
                borderWidth: 1.5, 
                borderDash: [5, 5] 
            },
            { 
                label: 'Battery SOC (%)', 
                data: battery_soc, 
                borderColor: '#ffce56', 
                backgroundColor: '#ffce5620', 
                yAxisID: 'y1', 
                tension: 0.3, 
                pointRadius: 0, 
                borderWidth: 2 
            }
        ];

        if (showLosses) {
            // Add PV generation dataset
            datasets.push({ 
                label: 'PV Generation (kW)', 
                data: generation, 
                borderColor: '#36a2eb', 
                backgroundColor: '#36a2eb20', 
                tension: 0.3, 
                pointRadius: 0, 
                borderWidth: 2,
                fill: true
            });

            // Add PV potential if available
            if (pv_potential.length > 0) {
                datasets.push({
                    label: 'PV Potential (kW)',
                    data: pv_potential,
                    borderColor: '#4bc0c0',
                    backgroundColor: '#386f6f20',
                    tension: 0.3,
                    pointRadius: 0,
                    borderWidth: 1,
                    borderDash: [5, 5],
                    fill: true // Fill to the previous dataset (generation
                });
            }

            // Add grid export if available
            if (export_grid.length > 0 && design.allowExport) {
                datasets.push({
                    label: 'Grid Export (kW)',
                    data: export_grid,
                    borderColor: '#ff9f40',
                    backgroundColor: '#ff9f4020',
                    tension: 0.3,
                    pointRadius: 0,
                    borderWidth: 1.5
                });
            }
        } else {
            // Just add PV generation (but not potential or export)
            datasets.push({ 
                label: 'PV Generation (kW)', 
                data: generation, 
                borderColor: '#36a2eb', 
                backgroundColor: '#36a2eb20', 
                tension: 0.3, 
                pointRadius: 0, 
                borderWidth: 2,
                fill: true
            });
        }

        if (design.systemType === 'off-grid') {
            // Add generator dataset if it's available
            if (generator_kw.length > 0) {
                datasets.push({
                    label: 'Generator (kW)',
                    data: generator_kw,
                    borderColor: '#33ff92ff',
                    backgroundColor: '#33ff6320',
                    tension: 0.3,
                    pointRadius: 0,
                    borderWidth: 2
                });
            }
        }

        return { labels: timestamps, datasets };
    }, [simulationData, startDate, endDate, showLosses, design.systemType, design.allowExport, rangeDays, design.panelKw]);

    const chartOptions = useMemo(() => {
    const enableLTTB = rangeDays > 120; // > ~4 months
    // Aim for ~600–1200 rendered points depending on range length
    const targetSamples = Math.min(1200, Math.max(600, Math.round(rangeDays * 3)));
    const threshold = Math.max(targetSamples * 1.5, 1000); // start decimating only when big enough

    return {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: enableLTTB ? 0 : 300 },
        interaction: { mode: 'index', intersect: false },
        elements: {
        point: { radius: 0, hitRadius: 10 },
        line: { borderWidth: 2, tension: 0.3 }
        },
        // Important for {x,y} objects + LTTB
        parsing: enableLTTB ? false : true,
        normalized: true,
        plugins: {
        datalabels: { display: false },
        decimation: enableLTTB ? {
            enabled: true,
            algorithm: 'lttb',
            samples: targetSamples,
            threshold
        } : { enabled: false }
        },
        scales: {
        x: {
            type: 'time',
            time: {
            unit:
                rangeDays > 180 ? 'month' :
                rangeDays > 60  ? 'week'  : 'day',
            tooltipFormat: rangeDays > 60 ? 'MMM dd' : 'MMM dd, HH:mm',
            displayFormats: { day: 'MMM dd', week: 'MMM dd', month: 'MMM yyyy' }
            },
            ticks: { maxTicksLimit: 15 }
        },
        y: { beginAtZero: true, title: { display: true, text: 'Power (kW)' } },
        y1: {
            type: 'linear', position: 'right', beginAtZero: true, max: 100,
            title: { display: true, text: 'Battery SOC (%)' },
            grid: { drawOnChartArea: false }
        }
        }
    };
    }, [rangeDays]);


    // Update chartOptions to optimize rendering
    const chartOptionsAverage = useMemo(() => ({
        responsive: true, 
        maintainAspectRatio: false,
        animation: {
            duration: rangeDays > 90 ? 0 : 300 // Disable animation for large datasets
        },
        interaction: { mode: 'index', intersect: false },
        elements: {
            point: {
                radius: 0, // Hide all points
                hitRadius: 10 // Keep a hit area for tooltips
            },
            line: {
                borderWidth: 2,
                tension: 0.3 // Smooth lines
            }
        },
        parsing: true, // Disable parsing for performance
        normalized: true, // Pre-normalized data for performance
        plugins: {
            datalabels: {display: false},
            // decimation: {
            //     enabled: true,
            //     algorithm: 'lttb', // Largest-Triangle-Three-Buckets algorithm
            //     samples: rangeDays > 180 ? 200 : 500, // Fewer points for very long ranges
            //     threshold: 100 // Decimate if there are more than 100 points
            // }
        },
        scales: { 
            x: { 
                type: 'time',
                time: { 
                    unit: rangeDays > 90 ? 'month' : 
                          rangeDays > 30 ? 'week' : 'day',
                    tooltipFormat: rangeDays > 90 ? 'MMM dd' : 'MMM dd, HH:mm',
                    displayFormats: {
                        day: 'MMM dd',
                        week: 'MMM dd',
                        month: 'MMM yyyy'
                    }
                },
                ticks: {
                    maxTicksLimit: 15 // Limit the number of ticks for readability
                }
            },
            y: { 
                beginAtZero: true, 
                title: { display: true, text: 'Power (kW)' } 
            },
            y1: { 
                type: 'linear', 
                display: true, 
                position: 'right', 
                beginAtZero: true, 
                max: 100, 
                title: { display: true, text: 'Battery SOC (%)' }, 
                grid: { drawOnChartArea: false } 
            }
        }
    }), [rangeDays]);

    // A single, unified handler to update the master design state
    
    
    
    const handleDesignChange = (newDesignState) => {
        setDesign(newDesignState);
    };

    // FIX: Modify this function to ONLY clear sessionStorage, not the live state
    const clearSimulationCache = () => {
        sessionStorage.removeItem(`simulationData_${projectId}`);
        // setSimulationData(null); // DO NOT set the live data to null here
        console.log('Cleared simulation cache from sessionStorage.');
    };

    const saveProject = (payload) => {
        return axios.put(`${API_URL}/api/projects/${projectId}`, payload)
            .then(() => {
                showNotification('System saved to project 👍', 'success');
            })
            .catch(err => {
                const errorMsg = err.response?.data?.error || 'Could not save the system.';
                showNotification(errorMsg, 'danger');
            });
    };
    
    // State for modals
    const [showStopTemplateModal, setShowStopTemplateModal] = useState(false);
    const [showResetTemplateModal, setShowResetTemplateModal] = useState(false);

    // Function to stop using template
    const handleStopUsingTemplate = async () => {
        try {
            // Clear template flags
            setUsingStandardTemplate(false);
            setStandardTemplateInfo(null);
            
            // Update the project to remove template information
            const savePayload = {
                system_type: design.systemType,
                panel_kw: parseFloat(design.panelKw),
                num_panels: parseInt(design.numPanels),
                surface_tilt: parseFloat(design.tilt),
                surface_azimuth: parseFloat(design.azimuth),
                allow_export: design.allowExport,
                panel_id: design.selectedPanel?.product?.id,
                inverter_kva: design.selectedInverter ? {
                    model: design.selectedInverter.product.model,
                    capacity: design.selectedInverter.product.rating_kva,
                    quantity: design.inverterQuantity
                } : null,
                battery_kwh: design.systemType !== 'grid' && design.selectedBattery ? {
                    model: design.selectedBattery.product.model,
                    capacity: design.selectedBattery.product.capacity_kwh,
                    quantity: design.batteryQuantity
                } : null,
                use_pvgis: usePvgis,
                generation_profile_name: profileName,
                battery_soc_limit: design.batterySocLimit,
                inverter_ids: design.selectedInverter ? [design.selectedInverter.product.id] : [],
                battery_ids: design.systemType !== 'grid' && design.selectedBattery ? [design.selectedBattery.product.id] : [],

                // Clear template information
                from_standard_template: false,
                template_id: null,
                template_name: null
            };

            // Save project without template info
            await axios.put(`${API_URL}/api/projects/${projectId}`, savePayload);
            
            // Clear non-core components from BOM (keep only panels, inverters, batteries)
            await axios.post(`${API_URL}/api/projects/${projectId}/bom/clear-template-extras`);
            
            // Clear session storage flags
            sessionStorage.removeItem(`standardTemplateModified_${projectId}`);
            sessionStorage.setItem(`systemDesignModified_${projectId}`, 'true');
            
            setShowStopTemplateModal(false);
            showNotification("Stopped using template. Core components retained.", "success");
        } catch (err) {
            console.error("Error stopping template usage:", err);
            showNotification("Failed to stop using template", "danger");
            setShowStopTemplateModal(false);
        }
    };

    // Function to reset to template
    const handleResetToTemplate = async () => {
        try {
            // Reset template modifications
            sessionStorage.removeItem(`systemDesignModified_${projectId}`);
            sessionStorage.removeItem(`standardTemplateModified_${projectId}`);
            
            // Re-fetch the template and apply it
            const res = await axios.get(`${API_URL}/api/system_templates/${standardTemplateInfo.id}`);
            handleSelectTemplate(res.data);
            setShowResetTemplateModal(false);
            showNotification("Reset to original template components", "success");
        } catch (err) {
            console.error("Error resetting to template:", err);
            showNotification("Failed to reset template", "danger");
            setShowResetTemplateModal(false);
        }
    };

    const [usingStandardTemplate, setUsingStandardTemplate] = useState(false);
    const [standardTemplateInfo, setStandardTemplateInfo] = useState(null);
    const [loadedFromQuote, setLoadedFromQuote] = useState(false);
    const [quoteInfo, setQuoteInfo] = useState(null);

    const handleSimulate = () => {
        setLoading(true);
        
        // If we're modifying a standard design, we should indicate that
        if (usingStandardTemplate) {
            // Mark that we're working with a modified standard template
            sessionStorage.setItem(`standardTemplateModified_${projectId}`, 'true');
        }
        
        // Build the payload with all necessary fields
        const savePayload = {
                system_type: design.systemType,
                panel_kw: parseFloat(design.panelKw),
                num_panels: parseInt(design.numPanels),
                surface_tilt: parseFloat(design.tilt),
                surface_azimuth: parseFloat(design.azimuth),
                allow_export: design.allowExport,
                panel_id: design.selectedPanel?.product?.id,
                inverter_kva: design.selectedInverter ? {
                    model: design.selectedInverter.product.model,
                    capacity: design.selectedInverter.product.rating_kva,
                    quantity: design.inverterQuantity
                } : null,
                battery_kwh: design.systemType !== 'grid' && design.selectedBattery ? {
                    model: design.selectedBattery.product.model,
                    capacity: design.selectedBattery.product.capacity_kwh,
                    quantity: design.batteryQuantity
                } : null,
                use_pvgis: usePvgis,
                generation_profile_name: profileName,
                battery_soc_limit: design.batterySocLimit,
                inverter_ids: design.selectedInverter ? [design.selectedInverter.product.id] : [],
                battery_ids: design.systemType !== 'grid' && design.selectedBattery ? [design.selectedBattery.product.id] : [],

                // Include template information
                from_standard_template: usingStandardTemplate,
                template_id: standardTemplateInfo?.id,
                template_name: standardTemplateInfo?.name
          };

          // Set flag that system design has been modified
          sessionStorage.setItem(`systemDesignModified_${projectId}`, 'true');
          
          // Save first, then simulate
          saveProject(savePayload)
            .then(() => {
              // Now run simulation with the same data
              const simPayload = {
                  project_id: projectId,
                  use_pvgis: usePvgis,
                  profile_name: profileName,
                  system: {
                      panel_kw: parseFloat(design.panelKw),
                      panel_id: design.selectedPanel?.product.id,
                      tilt: parseFloat(design.tilt),
                      azimuth: parseFloat(design.azimuth),
                      system_type: design.systemType,
                      // Ensure we safely access nested properties
                      inverter_kva: (design.selectedInverter?.product.rating_kva || 0) * design.inverterQuantity,
                      battery_kwh: (design.selectedBattery?.product.capacity_kwh || 0) * design.batteryQuantity,
                      allow_export: design.allowExport,
                      battery_soc_limit: design.batterySocLimit,

                      generator: {
                        enabled: design.systemType === 'off-grid' && !!design.generatorEnabled,
                        kva: parseFloat(design.generatorKva || 0),
                        min_loading_pct: parseFloat(design.generatorMinLoading || 25),
                        can_charge_battery: !!design.generatorChargeBattery,
                        diesel_price_r_per_liter: parseFloat(design.dieselPrice || 23.50),
                        min_run_time_hours: parseFloat(design.generatorMinRunTime || 1.0),
                        battery_start_soc: parseFloat(design.generatorBatteryStartSoc || 20),
                        battery_stop_soc: parseFloat(design.generatorBatteryStopSoc || 100),
                        service_cost: parseFloat(design.generatorServiceCost || 1000),
                        service_interval_hours: parseFloat(design.generatorServiceInterval || 1000)
                      }
                  }
              };

              return axios.post(`${API_URL}/api/simulate`, simPayload);
            })
            .then(res => {
                if (!res || !res.data || !res.data.timestamps) {
                    showNotification('Simulation failed: No data returned.', 'danger');
                    return;
                }
                setSimulationData(res.data);

                try {
                    sessionStorage.setItem(`simulationData_${projectId}`, JSON.stringify(res.data));
                    console.log('Simulation Data: ', res.data);
                    console.log('Cached simulation data:', projectId);
                } catch (err) {
                    console.error('Failed to cache simulation data:', err);
                }

                showNotification('System saved and simulation complete!', 'success');
            })
            .catch(err => {
                const errorMsg = err.response?.data?.error || 'Failed to save system or run simulation.';
                showNotification(errorMsg, 'danger');
            })
            .finally(() => setLoading(false));
    };

    // --- Piece 3: Data Filtering & Metrics Calculation ---

    // This useMemo hook filters the simulation data based on the selected date range.
    const filteredData = useMemo(() => {
        if (!simulationData || !simulationData.timestamps || !startDate || !endDate) {
            return null;
        }

        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0); // Set to beginning of start date
        
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 9999); // Set to end of end date

        const filtered = {
            timestamps: [], demand: [], generation: [], potential_generation: [],
            battery_soc: [], import_from_grid: [], export_to_grid: [], shortfall_kw: [], generator_kw: []
        };

        simulationData.timestamps.forEach((ts, i) => {
            const date = new Date(ts);
            if (date >= start && date <= end) { 
                filtered.timestamps.push(ts);
                filtered.demand.push(simulationData.demand[i]);
                filtered.generation.push(simulationData.generation[i]);
                filtered.potential_generation.push(simulationData.potential_generation ? simulationData.potential_generation[i] : simulationData.generation[i]);
                filtered.battery_soc.push(simulationData.battery_soc[i]);
                filtered.import_from_grid.push(simulationData.import_from_grid[i]);
                filtered.export_to_grid.push(simulationData.export_to_grid[i]);
                filtered.shortfall_kw.push(simulationData.shortfall_kw ? simulationData.shortfall_kw[i]: 0);
                filtered.generator_kw.push(simulationData.generator_kw ? simulationData.generator_kw[i]: 0);
            }
        });
        return filtered;
    }, [simulationData, startDate, endDate]);


    // This useEffect hook calculates the DATE-RANGE metrics (for the top cards)
    useEffect(() => {
        if (!filteredData || !filteredData.timestamps || filteredData.timestamps.length === 0) return;

        const timeIntervalHours = 0.5;

        const totalPotentialGenKwh = filteredData.potential_generation.reduce((sum, val) => sum + (val * timeIntervalHours), 0);
        const totalUtlizedGenKwh = filteredData.generation.reduce((sum, val) => sum + (val * timeIntervalHours), 0);
        const totalImportKwh = filteredData.import_from_grid.reduce((sum, val) => sum + (val * timeIntervalHours), 0);
        const totalExportKwh = filteredData.export_to_grid.reduce((sum, val) => sum + (val * timeIntervalHours), 0);
        const pvUsedOnSiteKwh = totalUtlizedGenKwh - totalExportKwh; 
        const pvUtilizationPct = totalUtlizedGenKwh > 0 ? (pvUsedOnSiteKwh/totalPotentialGenKwh) * 100 : 0;
        const totalShortfallKwh = filteredData.shortfall_kw.reduce((sum, val) => sum + (val * timeIntervalHours), 0);
        const totalGenKwh = filteredData.generator_kw.reduce((sum, val) => sum + (val * timeIntervalHours), 0);

        // Calculate period-specific diesel cost based on filtered generator data
        let periodDieselCost = 0;
        if (design.systemType === 'off-grid' && design.generatorEnabled) {
            const generatorSizeKw = parseFloat(design.generatorKva || 0);
            const dieselPrice = parseFloat(design.dieselPrice || 23.50);
            const serviceCost = parseFloat(design.generatorServiceCost || 1000);
            const serviceInterval = parseFloat(design.generatorServiceInterval || 1000);
            
            // Calculate total fuel consumption and running hours for the filtered period
            let totalFuelLiters = 0;
            let totalRunningHours = 0;
            filteredData.generator_kw.forEach(genKw => {
                if (genKw > 0 && generatorSizeKw > 0) {
                    const loadFactor = genKw / generatorSizeKw;
                    const fuelRateLph = getFuelConsumption(generatorSizeKw, loadFactor);
                    totalFuelLiters += fuelRateLph * timeIntervalHours;
                    totalRunningHours += timeIntervalHours;
                }
            });
            
            const fuelCost = totalFuelLiters * dieselPrice;
            const serviceCostForPeriod = (totalRunningHours / serviceInterval) * serviceCost;
            periodDieselCost = fuelCost + serviceCostForPeriod;
        }

        setMetrics({
            totalPVGeneration: totalPotentialGenKwh.toFixed(0),
            utilizedPVGeneration: pvUsedOnSiteKwh.toFixed(0),
            gridImport: totalImportKwh.toFixed(0),
            gridExport: totalExportKwh.toFixed(0),
            pvUtilization: pvUtilizationPct.toFixed(0),

            energyShortfall: totalShortfallKwh.toFixed(0),
            generatorEnergy: totalGenKwh.toFixed(0),
            dieselCost: periodDieselCost.toFixed(0)
        });

    }, [filteredData, design.systemType, design.generatorEnabled, design.generatorKva, design.dieselPrice, design.generatorServiceCost, design.generatorServiceInterval]); // Re-calculate if filtered data or design changes

    // For Annual Metrics
    useEffect(() => {
        if (!simulationData || !simulationData.timestamps || simulationData.timestamps.length === 0 || !simulationData.annual_metrics) return;

        // const data = simulationData;
        // const timeIntervalHours = 0.5;

        // const totalDemandKwh = data.demand.reduce((sum, val) => sum+val,0) * timeIntervalHours;
        // const totalPotentialGenKwh = data.potential_generation.reduce((sum, val) => sum+val,0) * timeIntervalHours;
        // const totalUtilizedGenKwh = data.generation.reduce((sum, val) => sum+val,0) * timeIntervalHours;
        // const totalExportKwh = data.export_to_grid.reduce((sum, val) => sum+val,0) * timeIntervalHours;
        // const pvUsedOnSiteKwh = totalUtilizedGenKwh - totalExportKwh;

        // const daytimeDemandKwh = data.timestamps.map((ts, i) => {
        //     const hour = new Date(ts).getHours();
        //     return (hour >= 6 && hour < 18) ? data.demand[i] : 0;
        // }).reduce((sum, val) => sum + val, 0) * timeIntervalHours;

        // const daytimeConsumptionPct = totalDemandKwh > 0 ? (daytimeDemandKwh / totalDemandKwh) * 100 : 0;
        // const consumptionFromPvPct = totalUtilizedGenKwh > 0 ? (pvUsedOnSiteKwh / totalDemandKwh) * 100 : 0;


        // const daysInSim = data.timestamps.length / 48;
        // const potentialGenDaily = totalPotentialGenKwh / daysInSim;
        // const utilizedGenDaily = totalUtilizedGenKwh / daysInSim;
        // const throttlingLossesDaily = (totalPotentialGenKwh - totalUtilizedGenKwh) / daysInSim;

        // const pvUtilizationPct = utilizedGenDaily / potentialGenDaily * 100;

        // const panelKwFloat = safeParseFloat(design.panelKw);
        // const specYieldInclThrottling = panelKwFloat > 0 ? (utilizedGenDaily / panelKwFloat) : 0;
        // const specYieldExclThrottling = panelKwFloat > 0 ? (potentialGenDaily / panelKwFloat) : 0; 

        // let cyclesAnnual = '-'
        // const totalBatteryCapacity = (design.selectedBattery?.product.capacity_kwh || 0) * design.batteryQuantity;
        // if (data.battery_soc?.length > 1 && totalBatteryCapacity > 0) {
        //     let totalChargeEnergy = 0;
        //     for (let i = 1; i < data.battery_soc.length; i++) {
        //         const socDiff = data.battery_soc[i] - data.battery_soc[i - 1];
        //         if (socDiff > 0) totalChargeEnergy += (socDiff / 100) * totalBatteryCapacity;
        //     }
        //     const dailyCycles = (totalChargeEnergy / totalBatteryCapacity) / daysInSim;
        //     cyclesAnnual = (dailyCycles * 365).toFixed(1);
        // }

        const metrics = simulationData.annual_metrics;

        setAnnualMetrics({
            daytimeConsumption: metrics.daytime_consumption_pct.toString(),
            consumptionFromPV: metrics.consumption_from_pv_pct.toString(),
            pvUtilization: metrics.pv_utilization_pct.toString(),
            potentialGenDaily: metrics.potential_gen_daily_kwh.toFixed(2),
            utilizedGenDaily: metrics.utilized_gen_daily_kwh.toFixed(2),
            throttlingLossesDaily: metrics.throttling_losses_daily_kwh.toFixed(2),
            specificYieldWithThrottling: metrics.specific_yield_incl_losses.toFixed(2),
            specificYieldExclThrottling: metrics.specific_yield_excl_losses.toFixed(2),
            potentialGenAnnual: (metrics.potential_gen_annual_kwh).toString(),
            utilizedGenAnnual: (metrics.utilized_gen_annual_kwh).toString(),
            throttlingLossesAnnual: (metrics.throttling_losses_annual_kwh).toString(),
            batteryCyclesAnnual: metrics.battery_cycles_annual.toString(),
        })
    }, [simulationData]);

    // The main return statement that renders the component UI
    return (
        <>
            <div className='mb-4'>
                <Card className='shadow-sm border-0'>
                    <Card.Body>
                        <h4 className='mb-3'>System Design Mode</h4>
                        <div className='d-flex gap-3'>
                            <Button
                                variant={designMode === 'custom' ? 'primary': 'outline-primary'}
                                onClick={() => setDesignMode('custom')}
                                className='flex-grow-1 py-2'
                            >
                                <i className='bi bi-tools me-2'></i>
                                Custom Design
                            </Button>
                            <Button
                                variant={designMode === 'standard' ? 'primary': 'outline-primary'}
                                onClick={() => setDesignMode('standard')}
                                className='flex-grow-1 py-2'
                            >
                                <i className='bi bi-collection me-2'></i>
                                Standard Design
                            </Button>
                        </div>
                    </Card.Body>
                </Card>
            </div>

            {/* Template or Quote banner */}
            {usingStandardTemplate && !loadedFromQuote && (
                <Alert variant="success" className="d-flex align-items-center mb-4">
                    <div className="d-flex align-items-center flex-grow-1">
                        <i className="bi bi-collection-fill fs-4 me-3"></i>
                        <div>
                            <div className="fw-bold">Standard Design Template</div>
                            <div>You're using "{standardTemplateInfo?.name}" template as a starting point</div>
                        </div>
                    </div>
                    <div>
                        <Button 
                            variant="outline-success" 
                            size="sm"
                            className="me-2"
                            onClick={() => setShowResetTemplateModal(true)}
                        >
                            <i className="bi bi-arrow-counterclockwise me-1"></i>
                            Reset to Template
                        </Button>
                        <Button 
                            variant="outline-danger" 
                            size="sm"
                            onClick={() => setShowStopTemplateModal(true)}
                        >
                            <i className="bi bi-x-circle me-1"></i>
                            Stop Using Template
                        </Button>
                    </div>
                </Alert>
            )}
            
            {loadedFromQuote && (
                <Alert variant="info" className="d-flex align-items-center mb-4">
                    <div className="d-flex align-items-center flex-grow-1">
                        <i className="bi bi-file-earmark-text-fill fs-4 me-3"></i>
                        <div>
                            <div className="fw-bold">Loaded from Quote</div>
                            <div>Components loaded from quote: "{quoteInfo?.name}"</div>
                        </div>
                    </div>
                    <div>
                        <Button 
                            variant="outline-info" 
                            size="sm" 
                            onClick={() => {
                                setLoadedFromQuote(false);
                                setQuoteInfo(null);
                                sessionStorage.removeItem(`quoteComponents_${projectId}`);
                            }}
                            className="d-flex align-items-center"
                        >
                            <i className="bi bi-x-circle me-1"></i>
                            Clear Quote Loading
                        </Button>
                    </div>
                </Alert>
            )}

            {designMode === 'custom' ? (
                <SizingView
                    projectId={projectId}
                    design={design}
                    onDesignChange={setDesign}
                    products={products}
                    usePvgis={usePvgis}
                    setUsePvgis={setUsePvgis}
                    profileName={profileName}
                    setProfileName={setProfileName}
                    showNotification={showNotification}
                />
            ) : (
                <StandardDesignSelector 
                    templates={systemTemplates}
                    loading={loadingTemplates}
                    onSelectSystem={handleSelectTemplate}
                />
            )}

            {/* --- Action Buttons --- */}
            <div className="row g-3 my-4">
                <div className="col-12 d-flex gap-2">
                    <Button variant="primary" onClick={handleSimulate} disabled={loading} >
                        {loading ? <Spinner as="span" animation="border" size="sm" className="me-2" /> : <i className="bi bi-play-fill me-2"></i>}
                        {loading ? 'Simulating…' : 'Simulate'}
                    </Button>
                </div>
            </div>

            {/* --- Simulation Results, Charts, and Metrics --- */}
            {simulationData && startDate && (
                <div className="mt-5" >
                    <Card className="shadow-sm my-4">
                        <Card.Header as="h5" className='d-flex justify-content-between align-items-center flex-wrap' ref={simulateButtonRef}>
                            <span><i className="bi bi-bar-chart-line-fill me-2"></i>Simulation Results</span>
                            <div className='d-flex align-items-center' >
                                <Button
                                    variant={showLosses ? "primary" : "outline-secondary"}
                                    size="sm"
                                    className='me-3'
                                    onClick={() => setShowLosses(!showLosses)}
                                >
                                    <i className={`bi ${showLosses ? "bi-eye-slash-fill" : "bi-eye-fill"} me-2`}></i>
                                    {showLosses ? "Hide Losses" : "Show Losses"}
                                </Button>
                                <Button
                                    variant={showAverages ? "primary" : "outline-secondary"}
                                    size="sm"
                                    className='me-3'
                                    onClick={() => setShowAverages(!showAverages)}
                                >
                                    <i className={`bi ${showAverages ? "bi-eye-slash-fill" : "bi-eye-fill"} me-2`}></i>
                                    {showAverages ? "Hide Averages (for full year)" : "Show Averages (for full year)"}
                                </Button>
                            </div>

                            
                            <div className='date-picker-container'>
                                <button className="btn btn-outline-secondary" onClick={() => {
                                    const end = toEndOfDay(new Date());
                                    const start = toMidnight(new Date());
                                    start.setDate(end.getDate() - 7);
                                    setStartDate(start);
                                    setEndDate(end);
                                }}>Last 7 Days</button>

                                <button className="btn btn-outline-secondary" onClick={() => {
                                  const end = toEndOfDay(new Date());
                                  const start = toMidnight(new Date());
                                  start.setDate(end.getDate() - 30);
                                  setStartDate(start);
                                  setEndDate(end);
                                }}>Last 30 Days</button>

                                <button className="btn btn-outline-secondary" onClick={() => {
                                  setStartDate(toMidnight(new Date(2025, 0, 1)));
                                  setEndDate(toEndOfDay(new Date(2025, 11, 31)));
                                }}>Full Year</button>

                                <DatePicker
                                    selected={startDate}
                                    onChange={(dates) => {
                                        // FIX: This is the correct logic from QuickResults.js
                                        const [start, end] = dates;
                                        setStartDate(start);
                                        setEndDate(end);
                                    }}
                                    startDate={startDate}
                                    endDate={endDate}
                                    selectsRange
                                    isClearable={false}
                                    dateFormat={"dd/MM/yyyy"}
                                    className='form-control form-control-sm shadow-sm'
                                    popperPlacement='bottom-end'
                                    minDate={simulationData?.timestamps && new Date(simulationData.timestamps[0])}
                                    maxDate={simulationData?.timestamps && new Date(simulationData.timestamps[simulationData.timestamps.length - 1])}
                                />
                            </div>
                        </Card.Header>
                        <Card.Body style={{ height: '400px' }}>
                            <Line 
                                options={showAverages ? chartOptionsAverage : chartOptions} 
                                data={showAverages ? chartDataAverage : chartData} 
                            />
                        </Card.Body>
                    </Card>

                    {Number(metrics.energyShortfall || 0) > 0 && (
                        <Alert variant='danger' className='mb-3'>
                            <i className='bi bi-exclamation-triangle-fill me-2'></i>
                            This off-grid design has <b>{metrics.energyShortfall} kWh</b> of energy shortfall. Consider adding PV/battery capacity.
                        </Alert>
                    )}

                    {/* The Metrics Cards */}
                    <Row className="mb-4 g-3 mt-4" >
                        <Col md={4} lg>
                            <Card className="border-start border-4 border-primary bg-white shadow-sm rounded p-3 h-100">
                                <div className="text-muted small">Total PV Generation</div>
                                <div className="fs-4 fw-bold">{metrics.totalPVGeneration} kWh</div>
                            </Card>
                        </Col>
                        <Col md={4} lg>
                            <Card className="border-start border-4 border-success bg-white shadow-sm rounded p-3 h-100">
                                <div className="text-muted small">PV Energy Utilized</div>
                                <div className="fs-4 fw-bold">{metrics.utilizedPVGeneration} kWh</div>
                            </Card>
                        </Col>
                        <Col md={4} lg>
                            <Card className="border-start border-4 border-danger bg-white shadow-sm rounded p-3 h-100">
                                <div className="text-muted small">Grid Import</div>
                                <div className="fs-4 fw-bold">{metrics.gridImport} kWh</div>
                            </Card>
                        </Col>
                        <Col md={4} lg>
                            <Card className="border-start border-4 border-warning bg-white shadow-sm rounded p-3 h-100">
                                <div className="text-muted small">Grid Export</div>
                                <div className="fs-4 fw-bold">{metrics.gridExport} kWh</div>
                            </Card>
                        </Col>
                        <Col md={4} lg>
                             <Card className="border-start border-4 border-info bg-white shadow-sm rounded p-3 h-100">
                                <div className="text-muted small">PV Utilization</div>
                                <div className="fs-4 fw-bold">{metrics.pvUtilization}%</div>
                            </Card>
                        </Col>
                    </Row>
                    {simulationData && startDate && design.systemType === 'off-grid' && (
                    <Row>
                        <Col md={4} lg>
                          <Card className="border-start border-4 border-danger bg-white shadow-sm rounded p-3 h-100">
                            <div className="text-muted small">Energy Shortfall</div>
                            <div className="fs-6 fw-bold">{metrics.energyShortfall || 0} kWh</div>
                          </Card>
                        </Col>
                        <Col md={4} lg>
                          <Card className="border-start border-4 border-success bg-white shadow-sm rounded p-3 h-100">
                            <Row>
                            <Col xs={6}>
                                <div className="text-muted small">Generator Energy</div>
                                <div className="fs-6 fw-bold mb-1">{metrics.generatorEnergy || 0} kWh</div>
                            </Col>
                            <Col xs={6}>
                                <div className="text-muted small">Total Cost</div>
                                <div className="fs-6 fw-bold mb-1">R {(metrics.dieselCost || 0).toLocaleString()}</div>
                            </Col>
                            </Row>
                          </Card>
                        </Col>
                    </Row>
                    )}

                    {/* Enhanced Generator Metrics - only for off-grid systems with generator enabled */}
                    {simulationData && design.systemType === 'off-grid' && design.generatorEnabled && (() => {
                      // Calculate annual metrics using full simulation data (not filtered)
                      const timeIntervalHours = 0.5;
                      const annualGenKwh = simulationData.generator_kw?.reduce((sum, val) => sum + (val * timeIntervalHours), 0) || 0;
                      
                      // Calculate annual fuel cost using the same method as period calculation for consistency
                      const generatorSizeKw = parseFloat(design.generatorKva || 0);
                      const dieselPrice = parseFloat(design.dieselPrice || 23.50);
                      const serviceCost = parseFloat(design.generatorServiceCost || 1000);
                      const serviceInterval = parseFloat(design.generatorServiceInterval || 1000);
                      
                      let annualFuelLiters = 0;
                      let totalAnnualRunningHours = 0;
                      simulationData.generator_kw?.forEach(genKw => {
                        if (genKw > 0 && generatorSizeKw > 0) {
                          const loadFactor = genKw / generatorSizeKw;
                          const fuelRateLph = getFuelConsumption(generatorSizeKw, loadFactor);
                          annualFuelLiters += fuelRateLph * timeIntervalHours;
                          totalAnnualRunningHours += timeIntervalHours;
                        }
                      });
                      
                      const annualFuelCost = annualFuelLiters * dieselPrice;
                      const annualServiceCost = (totalAnnualRunningHours / serviceInterval) * serviceCost;
                      const annualTotalCost = annualFuelCost + annualServiceCost;
                      
                      return (
                      <Card className="shadow-sm mt-3">
                        <Card.Header as="h5">
                          <i className="bi bi-fuel-pump me-2"></i>Generator Performance Analysis - {design.generatorKva}kW Generator
                        </Card.Header>
                        <Card.Body>
                          {/* <Row className="mb-3">
                            <Col md={6}>
                              <div className="text-muted small">Selected Period Generator Energy</div>
                              <div className="fs-5 fw-bold text-success">{metrics.generatorEnergy || 0} kWh</div>
                            </Col>
                            <Col md={6}>
                              <div className="text-muted small">Selected Period Total Cost</div>
                              <div className="fs-5 fw-bold text-success">R {(metrics.dieselCost || 0).toLocaleString()}</div>
                            </Col>
                          </Row> */}
                          <Row className="mb-3">
                            <Col md={6}>
                              <div className="text-muted small">Annual Generator Energy</div>
                              <div className="fs-5 fw-bold text-primary">{Math.round(annualGenKwh)} kWh/year</div>
                            </Col>
                            <Col md={6}>
                              <div className="text-muted small">Annual Total Cost</div>
                              <div className="fs-5 fw-bold text-primary">R {Math.round(annualTotalCost).toLocaleString()}/year</div>
                            </Col>
                          </Row>
                          
                          <h6 className="mt-4 mb-3">Generator Efficiency by Load Factor</h6>
                          <div className="table-responsive">
                            <Table size="sm" striped hover>
                              <thead className="table-light">
                                <tr>
                                  <th>Load %</th>
                                  <th>Output (kW)</th>
                                  <th>Fuel Rate (L/h)</th>
                                  <th>Running Cost (R/h)</th>
                                  <th>Total Cost (R/kWh)</th>
                                </tr>
                              </thead>
                              <tbody>
                                {[25, 50, 75, 100].map(loadPct => {
                                  const generatorSizeKw = parseFloat(design.generatorKva) || 0;
                                  const dieselPriceRPerL = parseFloat(design.dieselPrice) || 23.50;
                                  const serviceCost = parseFloat(design.generatorServiceCost) || 1000;
                                  const serviceInterval = parseFloat(design.generatorServiceInterval) || 1000;
                                  
                                  const outputKw = (generatorSizeKw * loadPct / 100);
                                  const fuelRateLph = getFuelConsumption(generatorSizeKw, loadPct / 100);
                                  const fuelCostPerHour = fuelRateLph * dieselPriceRPerL;
                                  const serviceCostPerHour = serviceCost / serviceInterval; // R per hour for service
                                  const totalRunningCostPerHour = fuelCostPerHour + serviceCostPerHour;
                                  const totalCostPerKwh = outputKw > 0 ? (totalRunningCostPerHour / outputKw) : 0;
                                  
                                  return (
                                    <tr key={loadPct}>
                                      <td>{loadPct}%</td>
                                      <td>{outputKw.toFixed(1)} kW</td>
                                      <td>{fuelRateLph.toFixed(2)} L/h</td>
                                      <td>R {totalRunningCostPerHour.toFixed(2)}/h</td>
                                      <td>R {totalCostPerKwh.toFixed(2)}/kWh</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </Table>
                          </div>
                          
                          {/* Average Load Analysis */}
                          <h6 className="mt-4 mb-3">Average Load Analysis</h6>
                          <div className="table-responsive">
                            <Table size="sm" striped hover className="mb-0">
                              <thead className="table-light">
                                <tr>
                                  <th>Metric</th>
                                  <th>Value</th>
                                </tr>
                              </thead>
                              <tbody>
                                {(() => {
                                  const generatorSizeKw = parseFloat(design.generatorKva) || 0;
                                  const dieselPriceRPerL = parseFloat(design.dieselPrice) || 23.50;
                                  const serviceCost = parseFloat(design.generatorServiceCost) || 1000;
                                  const serviceInterval = parseFloat(design.generatorServiceInterval) || 1000;
                                  
                                  // Calculate average demand for the year
                                  const generatorKwData = simulationData.generator_kw || [];
                                  const activeGeneratorData = generatorKwData.filter(kw => kw > 0);
                                  const averageDemand = activeGeneratorData.length > 0 
                                    ? activeGeneratorData.reduce((sum, kw) => sum + kw, 0) / activeGeneratorData.length 
                                    : 0;
                                  
                                  // Calculate load percentage
                                  const loadPercentage = generatorSizeKw > 0 ? (averageDemand / generatorSizeKw) : 0;
                                  const loadFactor = Math.min(1.0, Math.max(0.25, loadPercentage)); // Clamp between 25% and 100%
                                  
                                  // Get fuel consumption at this load
                                  const fuelRateLph = getFuelConsumption(generatorSizeKw, loadFactor);
                                  const fuelCostPerHour = fuelRateLph * dieselPriceRPerL;
                                  const serviceCostPerHour = serviceCost / serviceInterval;
                                  
                                  // Get 100% load R/kWh for comparison
                                  const fuelRateAt100pct = getFuelConsumption(generatorSizeKw, 1.0);
                                  const costPerKwhAt100pct = generatorSizeKw > 0 ? (fuelRateAt100pct * dieselPriceRPerL / generatorSizeKw) : 0;
                                  
                                  // Calculate cost per kWh (excl service)
                                  const calculatedCostPerKwh = averageDemand > 0 ? (fuelCostPerHour / averageDemand) : 0;
                                  const costPerKwhExclService = (calculatedCostPerKwh < costPerKwhAt100pct) ? costPerKwhAt100pct : calculatedCostPerKwh;
                                  
                                  // Calculate cost per kWh (incl service)
                                  const totalCostPerHour = fuelCostPerHour + serviceCostPerHour;
                                  const calculatedTotalCostPerKwh = averageDemand > 0 ? (totalCostPerHour / averageDemand) : 0;
                                  const totalCostPerKwhAt100pct = generatorSizeKw > 0 ? ((fuelRateAt100pct * dieselPriceRPerL + serviceCostPerHour) / generatorSizeKw) : 0;
                                  const costPerKwhInclService = (calculatedTotalCostPerKwh < totalCostPerKwhAt100pct) ? totalCostPerKwhAt100pct : calculatedTotalCostPerKwh;
                                  
                                  return (
                                    <>
                                      <tr>
                                        <td>Average Generator Demand</td>
                                        <td>{averageDemand.toFixed(1)} kW</td>
                                      </tr>
                                      <tr>
                                        <td>Average Load Factor</td>
                                        <td>{(loadPercentage * 100).toFixed(1)}%</td>
                                      </tr>
                                      <tr>
                                        <td>Fuel Rate at Average Load</td>
                                        <td>{fuelRateLph.toFixed(2)} L/h</td>
                                      </tr>
                                      <tr>
                                        <td>Cost per kWh (excl. service)</td>
                                        <td><strong>R {costPerKwhExclService.toFixed(2)}/kWh</strong></td>
                                      </tr>
                                      <tr>
                                        <td>Cost per kWh (incl. service)</td>
                                        <td><strong>R {costPerKwhInclService.toFixed(2)}/kWh</strong></td>
                                      </tr>
                                    </>
                                  );
                                })()}
                              </tbody>
                            </Table>
                          </div>
                        </Card.Body>
                      </Card>
                      );
                    })()}

                    {/* Advanced System Metrics Table */}
                    <Card className="shadow-sm">
                        <Card.Header as="h5">
                            <i className="bi bi-table me-2"></i>Plant Output Specifications
                        </Card.Header>
                        <Card.Body>
                            <Table striped bordered hover responsive className="small">
                                <thead className="table-light">
                                    <tr>
                                        <th>Metric</th>
                                        <th>Value</th>
                                        <th>Units</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td>Daytime Consumption</td>
                                        <td>{annualMetrics.daytimeConsumption}</td>
                                        <td>%</td>
                                    </tr>
                                    <tr>
                                        <td>Overall Consumption from PV</td>
                                        <td>{annualMetrics.consumptionFromPV}</td>
                                        <td>%</td>
                                    </tr>
                                    <tr>
                                        <td>PV Utilization</td>
                                        <td>{annualMetrics.pvUtilization}</td>
                                        <td>%</td>
                                    </tr>
                                    <tr>
                                        <td>Potential Generation (daily)</td>
                                        <td>{annualMetrics.potentialGenDaily}</td>
                                        <td>kWh</td>
                                    </tr>
                                    <tr>
                                        <td>Utilized Generation (daily)</td>
                                        <td>{annualMetrics.utilizedGenDaily}</td>
                                        <td>kWh</td>
                                    </tr>
                                    <tr>
                                        <td>Throttling Losses (daily)</td>
                                        <td>{annualMetrics.throttlingLossesDaily}</td>
                                        <td>kWh</td>
                                    </tr>
                                    <tr>
                                        <td>Specific Yield (incl. losses)</td>
                                        <td>{annualMetrics.specificYieldWithThrottling}</td>
                                        <td>kWh/kWp/day</td>
                                    </tr>
                                    <tr>
                                        <td>Potential Yield (excl. losses)</td>
                                        <td>{annualMetrics.specificYieldExclThrottling}</td>
                                        <td>kWh/kWp/day</td>
                                    </tr>
                                    <tr>
                                        <td>Potential Generation p.a.</td>
                                        <td>{annualMetrics.potentialGenAnnual}</td>
                                        <td>kWh</td>
                                    </tr>
                                    <tr>
                                        <td>Utilized Generation p.a.</td>
                                        <td>{annualMetrics.utilizedGenAnnual}</td>
                                        <td>kWh</td>
                                    </tr>
                                    <tr>
                                        <td>Throttling Losses p.a.</td>
                                        <td>{annualMetrics.throttlingLossesAnnual}</td>
                                        <td>kWh</td>
                                    </tr>
                                    <tr>
                                        <td>Battery cycles in 1 year</td>
                                        <td>{annualMetrics.batteryCyclesAnnual}</td>
                                        <td>cycles/y</td>
                                    </tr>
                                </tbody>
                            </Table>
                        </Card.Body>
                    </Card>
                </div>
            )}

            {/* Stop Template Confirmation Modal */}
            <Modal show={showStopTemplateModal} onHide={() => setShowStopTemplateModal(false)} centered>
                <Modal.Header closeButton className="border-0 pb-0">
                    <Modal.Title className="d-flex align-items-center">
                        {/* <i className="bi bi-exclamation-triangle text-warning me-2"></i> */}
                        Stop Using Template
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body className="pt-0">
                    <div className="mb-3">
                        <p className="text-muted mb-3">
                            Are you sure you want to stop using the template "<strong>{standardTemplateInfo?.name}</strong>"?
                        </p>
                        <div className="bg-light rounded p-3">
                            <h6 className="text-success mb-2">
                                <i className="bi bi-check-circle me-1"></i>
                                What will be kept:
                            </h6>
                            <ul className="list-unstyled mb-3 ps-3">
                                <li><i className="bi bi-dot text-success"></i>Panels, inverters, and batteries</li>
                            </ul>
                            
                            <h6 className="text-danger mb-2">
                                <i className="bi bi-x-circle me-1"></i>
                                What will be removed:
                            </h6>
                            <ul className="list-unstyled mb-0 ps-3">
                                <li><i className="bi bi-dot text-danger"></i>All other template components from BOM</li>
                            </ul>
                        </div>
                    </div>
                </Modal.Body>
                <Modal.Footer className="border-0 pt-0">
                    <Button 
                        variant="outline-secondary" 
                        onClick={() => setShowStopTemplateModal(false)}
                    >
                        Cancel
                    </Button>
                    <Button 
                        variant="danger" 
                        onClick={handleStopUsingTemplate}
                        className="d-flex align-items-center"
                    >
                        <i className="bi bi-x-circle me-1"></i>
                        Stop Using Template
                    </Button>
                </Modal.Footer>
            </Modal>

            {/* Reset Template Confirmation Modal */}
            <Modal show={showResetTemplateModal} onHide={() => setShowResetTemplateModal(false)} centered>
                <Modal.Header closeButton className="border-0 pb-0">
                    <Modal.Title className="d-flex align-items-center">
                        <i className="bi bi-arrow-counterclockwise text-success me-2"></i>
                        Reset to Template
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body className="pt-0">
                    <div className="mb-3">
                        <p className="text-muted mb-3">
                            Are you sure you want to reset to the original template: <strong>{standardTemplateInfo?.name}</strong>
                        </p>
                        <div className="bg-light rounded p-3">
                            <h6 className="text-warning mb-2">
                                <i className="bi bi-exclamation-triangle me-1"></i>
                                This action will:
                            </h6>
                            <ul className="list-unstyled mb-0 ps-3">
                                <li><i className="bi bi-dot text-danger"></i>Discard all your custom changes</li>
                                <li><i className="bi bi-dot text-success"></i>Reset BOM to original template</li>
                            </ul>
                        </div>
                    </div>
                </Modal.Body>
                <Modal.Footer className="border-0 pt-0">
                    <Button 
                        variant="outline-secondary" 
                        onClick={() => setShowResetTemplateModal(false)}
                    >
                        Cancel
                    </Button>
                    <Button 
                        variant="success" 
                        onClick={handleResetToTemplate}
                        className="d-flex align-items-center"
                    >
                        <i className="bi bi-arrow-counterclockwise me-1"></i>
                        Reset to Template
                    </Button>
                </Modal.Footer>
            </Modal>
        </>
    );
}    

export default SystemDesign;