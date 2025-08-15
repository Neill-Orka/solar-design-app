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
  TimeSeriesScale
} from 'chart.js';
import 'chartjs-adapter-date-fns';
import { API_URL } from './apiConfig';
import { useNotification } from './NotificationContext';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, TimeScale, TimeSeriesScale);

const PANEL_WATTAGE = 565; // JA SOLAR 72S30-565/GR

// Sub Component for Stage 1: Sizing Mode
const SizingView = ({ projectId, design, onDesignChange, products, usePvgis, setUsePvgis, profileName, setProfileName, showNotification }) => {

    const persistPanel = async (panelId, panelKw) => {
        try {
            await axios.put(`${API_URL}/api/projects/${projectId}`, {
                panel_id: panelId || null,
                panel_kw: panelKw ? parseFloat(panelKw) : 0
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
        ? Math.ceil((parseFloat(kw) * 1000) / panelWattage) 
        : '';

      onDesignChange({ ...design, panelKw: kw, numPanels: newNumPanels });
    
      // persist
      const panelId = design.selectedPanel?.product?.id || null;
      await persistPanel(panelId, kw || 0);
    };

    const handleNumPanelsChange = async (e) => {
      const panels = e.target.value;
      const panelWattage = design.selectedPanel?.product?.power_w || PANEL_WATTAGE;
      const newKw = (panels && parseInt(panels) > 0) ? ((parseInt(panels) * panelWattage) / 1000).toFixed(2) : '';
      onDesignChange({ ...design, numPanels: panels, panelKw: newKw });

      // persist
      const panelId = design.selectedPanel?.product?.id || null;
      await persistPanel(panelId, newKw || 0);
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
                                        onChange={e => onDesignChange({...design, inverterQuantity: Math.max(1, parseInt(e.target.value) || 1)})}
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
                                                onChange={e => onDesignChange({...design, batteryQuantity: Math.max(1, parseInt(e.target.value) || 1)})}
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
                                                onChange={e => onDesignChange({...design, batterySocLimit: Math.max(0, Math.min(50, parseInt(e.target.value) || 0))})}
                                                disabled={design.systemType === 'grid' || design.systemType === 'off-grid'}
                                            />
                                        </Form.Group>
                                    </Col>
                                </Row>
                            </Col>
                        </Row>
                    </Card.Body>
                </Card>
            </div>
        </div> 
        {/* Remove the Button for "Refine Components & Build BOM" */}
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



function SystemDesign({ projectId }) {
    const simulateButtonRef = useRef(null);

    // --- Piece 1: State Management ---

    // UI Control State
    const [loading, setLoading] = useState(false);
    const [simulationData, setSimulationData] = useState(null);
    const [startDate, setStartDate] = useState(null); // Changed to null like QuickResults
    const [endDate, setEndDate] = useState(null); // Changed to null like QuickResults
    const [showLosses, setShowLosses] = useState(false);

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
    const [design, setDesign] = useState({
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
                    console.log('Loaded cached simulation data:', projectId);
                }
            } catch (err) {
                console.error('Failed to parse cached simulation data:', err);
                // Clean up corrupted cache
                sessionStorage.removeItem(`simulationData_${projectId}`);
            }
        }
    }, [projectId]);

    // Effect to load the specific project's data
    // This runs after the project ID is available and after the products have been loaded
    useEffect(() => {
        // Wait until we have products before trying to match them
        if (!projectId || products.inverters.length === 0) return;
        
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

            // Rest of your existing code for loading project data
            const savedKw = p.panel_kw || '';
            const defaultPanelId = p.panel_id;
            const currentPanel = defaultPanelId ?
                products.panels.find(panel => panel.id === defaultPanelId) :
                products.panels.find(panel => panel.power_w === PANEL_WATTAGE)

            const numPanels = savedKw ? Math.ceil((savedKw * 1000) / (currentPanel?.power_w || PANEL_WATTAGE)) : '';
            
            // Find the full product object for the saved inverter
            const inverterInfo = p.inverter_kva && typeof p.inverter_kva === 'object' ? p.inverter_kva : {model: null, capacity: p.inverter_kva, quantity: 1 };
            const currentInverter = inverterInfo.model ? products.inverters.find(inv => inv.model === inverterInfo.model) : null;

            // Find the full product object for the saved battery
            const batteryInfo = p.battery_kwh && typeof p.battery_kwh === 'object' ? p.battery_kwh : { model: null, capacity: p.battery_kwh, quantity: 1 };
            const currentBattery = products.batteries.find(bat => bat.model === batteryInfo.model);

            setUsePvgis(p.use_pvgis || false);
            setProfileName(p.generation_profile_name || 'midrand_ew_5'); // Default to

            // Update the master 'design' state with all the loaded data
            setDesign({
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
            });
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

        // Update the design state
        const newDesign = ({
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
        });

        setDesign(newDesign);
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
                system_type: newDesign.systemType,
                panel_kw: parseFloat(newDesign.panelKw),
                surface_tilt: parseFloat(newDesign.tilt),
                surface_azimuth: parseFloat(newDesign.azimuth),
                allow_export: newDesign.allowExport,
                panel_id: newDesign.selectedPanel?.product?.id,
                inverter_kva: newDesign.selectedInverter ? {
                    model: newDesign.selectedInverter.product.model,
                    capacity: newDesign.selectedInverter.product.rating_kva,
                    quantity: newDesign.inverterQuantity
                } : null,
                inverter_ids: newDesign.selectedInverter ? [newDesign.selectedInverter.product.id] : [],
                battery_kwh: newDesign.systemType !== 'grid' && newDesign.selectedBattery ? {
                    model: newDesign.selectedBattery.product.model,
                    capacity: newDesign.selectedBattery.product.capacity_kwh,
                    quantity: newDesign.batteryQuantity
                } : null,
                battery_ids: newDesign.systemType !== 'grid' && newDesign.selectedBattery ? [newDesign.selectedBattery.product.id] : [],
                use_pvgis: usePvgis,
                generation_profile_name: profileName,
                battery_soc_limit: newDesign.batterySocLimit,
                project_value_excl_vat: template.total_cost,
                from_standard_template: true,
                template_id: template.id,
                template_name: template.name
            };

            sessionStorage.setItem(`systemDesignModified_${projectId}`, 'true'); 

            // Save first, then simulate (just like in handleSimulate)
            axios.put(`${API_URL}/api/projects/${projectId}`, savePayload)
                .then(() => {
                    // Now run simulation with the same data
                    const simPayload = {
                        project_id: projectId,
                        use_pvgis: usePvgis,
                        profile_name: profileName,
                        system: {
                            panel_kw: parseFloat(newDesign.panelKw),
                            panel_id: newDesign.selectedPanel?.product?.id || null,
                            tilt: parseFloat(newDesign.tilt),
                            azimuth: parseFloat(newDesign.azimuth),
                            system_type: newDesign.systemType,
                            inverter_kva: (newDesign.selectedInverter?.product?.rating_kva || 0) * newDesign.inverterQuantity,
                            battery_kwh: (newDesign.selectedBattery?.product?.capacity_kwh || 0) * newDesign.batteryQuantity,
                            allow_export: newDesign.allowExport,
                            battery_soc_limit: newDesign.batterySocLimit
                            
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

    // Memorized chart data (exactly like QuickResults structure)
    const chartData = useMemo(() => {
        if (!simulationData || !startDate || !endDate) {
            return { labels: [], datasets: [] };
        }

        const sim = simulationData;
        
        const startIndex = sim.timestamps.findIndex(t => new Date(t) >= startDate);
        let endIndex = sim.timestamps.findIndex(t => new Date(t) > endDate);    
        if (endIndex === -1) endIndex = sim.timestamps.length; // If no end date found, use full length

        if (startIndex === -1) return { labels: [], datasets: [] }; // If no start date found, return empty

        const labels = sim.timestamps.slice(startIndex, endIndex).map(t => new Date(t));

        const datasets = [
            { 
                label: 'Demand (kW)', 
                data: sim.demand.slice(startIndex, endIndex), 
                borderColor: '#ff6384', 
                backgroundColor: '#ff638420', 
                tension: 0.3, 
                pointRadius: 0, 
                borderWidth: 2 
            },
            { 
                label: 'Grid Import (kW)', 
                data: sim.import_from_grid.slice(startIndex, endIndex), 
                borderColor: '#cc65fe', 
                backgroundColor: '#cc65fe20', 
                tension: 0.3, 
                pointRadius: 0, 
                borderWidth: 1.5, 
                borderDash: [5, 5] 
            },
            { 
                label: 'Battery SOC (%)', 
                data: sim.battery_soc.slice(startIndex, endIndex), 
                borderColor: '#ffce56', 
                backgroundColor: '#ffce5620', 
                yAxisID: 'y1', 
                tension: 0.3, 
                pointRadius: 0, 
                borderWidth: 2 
            }
        ];

        if (showLosses) {
            datasets.push({
                label: 'PV Generation (kW)', // Changed to match QuickResults naming
                data: sim.generation.slice(startIndex, endIndex),
                borderColor: '#4bc0c0',
                backgroundColor: '#4bc0c020',
                tension: 0.3,
                pointRadius: 0,
                borderWidth: 2,
                fill: true,              
            },
            {
                label: 'Throttling Losses',
                data: sim.potential_generation.slice(startIndex, endIndex),
                borderColor: 'transparent',
                backgroundColor: 'rgba(108, 117, 125, 0.3)',
                pointRadius: 0,
                fill: 3, // Changed to match QuickResults (fill: 3 instead of fill: '-1')
            });
        } else {
            datasets.push({
                label: 'PV Generation (kW)', // Changed to match QuickResults naming
                data: sim.generation.slice(startIndex, endIndex),
                borderColor: '#4bc0c0',
                backgroundColor: '#4bc0c020',
                tension: 0.3,
                pointRadius: 0,
                borderWidth: 2
            });            
        }

        return { labels, datasets };
    }, [simulationData, startDate, endDate, showLosses]);

    // Chart options (exactly like QuickResults)
    const chartOptions = useMemo(() =>  ({
        responsive: true, 
        maintainAspectRatio: false, 
        interaction: { mode: 'index', intersect: false },
        plugins: {
            datalabels: {display: false}
        },
        scales: { 
            x: { 
                type: 'time', 
                time: { unit: 'day', tooltipFormat: 'MMM dd, HH:mm' },
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
    }), []);

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
    
    const [usingStandardTemplate, setUsingStandardTemplate] = useState(false);
    const [standardTemplateInfo, setStandardTemplateInfo] = useState(null);

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
                      battery_soc_limit: design.batterySocLimit
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
            battery_soc: [], import_from_grid: [], export_to_grid: []
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

        setMetrics({
            totalPVGeneration: totalPotentialGenKwh.toFixed(0),
            utilizedPVGeneration: pvUsedOnSiteKwh.toFixed(0),
            gridImport: totalImportKwh.toFixed(0),
            gridExport: totalExportKwh.toFixed(0),
            pvUtilization: pvUtilizationPct.toFixed(0),
        });

    }, [filteredData]); // Re-calculate if filtered data or design changes

    // For Annual Metrics
    useEffect(() => {
        if (!simulationData || !simulationData.timestamps || simulationData.timestamps.length === 0) return;

        const data = simulationData;
        const timeIntervalHours = 0.5;

        const totalDemandKwh = data.demand.reduce((sum, val) => sum+val,0) * timeIntervalHours;
        const totalPotentialGenKwh = data.potential_generation.reduce((sum, val) => sum+val,0) * timeIntervalHours;
        const totalUtilizedGenKwh = data.generation.reduce((sum, val) => sum+val,0) * timeIntervalHours;
        const totalExportKwh = data.export_to_grid.reduce((sum, val) => sum+val,0) * timeIntervalHours;
        const pvUsedOnSiteKwh = totalUtilizedGenKwh - totalExportKwh;

        const daytimeDemandKwh = data.timestamps.map((ts, i) => {
            const hour = new Date(ts).getHours();
            return (hour >= 6 && hour < 18) ? data.demand[i] : 0;
        }).reduce((sum, val) => sum + val, 0) * timeIntervalHours;

        const daytimeConsumptionPct = totalDemandKwh > 0 ? (daytimeDemandKwh / totalDemandKwh) * 100 : 0;
        const consumptionFromPvPct = totalUtilizedGenKwh > 0 ? (pvUsedOnSiteKwh / totalDemandKwh) * 100 : 0;

        const daysInSim = data.timestamps.length / 48;
        const potentialGenDaily = totalPotentialGenKwh / daysInSim;
        const utilizedGenDaily = totalUtilizedGenKwh / daysInSim;
        const throttlingLossesDaily = (totalPotentialGenKwh - totalUtilizedGenKwh) / daysInSim;

        const panelKwFloat = safeParseFloat(design.panelKw);
        const specYieldInclThrottling = panelKwFloat > 0 ? (utilizedGenDaily / panelKwFloat) : 0;
        const specYieldExclThrottling = panelKwFloat > 0 ? (potentialGenDaily / panelKwFloat) : 0; 

        let cyclesAnnual = '-'
        const totalBatteryCapacity = (design.selectedBattery?.product.capacity_kwh || 0) * design.batteryQuantity;
        if (data.battery_soc?.length > 1 && totalBatteryCapacity > 0) {
            let totalChargeEnergy = 0;
            for (let i = 1; i < data.battery_soc.length; i++) {
                const socDiff = data.battery_soc[i] - data.battery_soc[i - 1];
                if (socDiff > 0) totalChargeEnergy += (socDiff / 100) * totalBatteryCapacity;
            }
            const dailyCycles = (totalChargeEnergy / totalBatteryCapacity) / daysInSim;
            cyclesAnnual = (dailyCycles * 365).toFixed(1);
        }

        setAnnualMetrics({
            daytimeConsumption: daytimeConsumptionPct.toFixed(0),
            consumptionFromPV: consumptionFromPvPct.toFixed(0),
            potentialGenDaily: potentialGenDaily.toFixed(2),
            utilizedGenDaily: utilizedGenDaily.toFixed(2),
            throttlingLossesDaily: throttlingLossesDaily.toFixed(2),
            specificYieldWithThrottling: specYieldInclThrottling.toFixed(2),
            specificYieldExclThrottling: specYieldExclThrottling.toFixed(2),
            potentialGenAnnual: (potentialGenDaily * 365).toFixed(0),
            utilizedGenAnnual: (utilizedGenDaily * 365).toFixed(0),
            throttlingLossesAnnual: (throttlingLossesDaily * 365).toFixed(0),
            batteryCyclesAnnual: cyclesAnnual,
        })
    }, [simulationData, design]);

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

            {/* Move the standard template alert here, right after the design mode selector */}
            {usingStandardTemplate && (
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
                            onClick={() => {
                                if (window.confirm("Reset to original template components? This will discard your changes.")) {
                                    // Reset template modifications
                                    sessionStorage.removeItem(`systemDesignModified_${projectId}`);
                                    sessionStorage.removeItem(`standardTemplateModified_${projectId}`);
                                    
                                    // Re-fetch the template and apply it
                                    axios.get(`${API_URL}/api/system_templates/${standardTemplateInfo.id}`)
                                        .then(res => {
                                            handleSelectTemplate(res.data);
                                            showNotification("Reset to original template components", "success");
                                        })
                                        .catch(err => {
                                            console.error("Error resetting to template:", err);
                                            showNotification("Failed to reset template", "danger");
                                        });
                                }
                            }}
                        >
                            <i className="bi bi-arrow-counterclockwise me-1"></i>
                            Reset to Template
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
                                options={chartOptions} 
                                data={chartData} 
                            />
                        </Card.Body>
                    </Card>

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
                                        <td>Overall Consumption from PV (Grid Independence)</td>
                                        <td>{annualMetrics.consumptionFromPV}</td>
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
        </>
    );
}    

export default SystemDesign;