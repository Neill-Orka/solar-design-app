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
const SizingView = ({ design, onDesignChange, onPromote, products, usePvgis, setUsePvgis }) => {
  
  const handleTargetKwChange = (e) => {
    const kw = e.target.value;
    const newNumPanels = (kw && parseFloat(kw) > 0) ? Math.ceil((parseFloat(kw) * 1000) / PANEL_WATTAGE) : '';
    onDesignChange({ ...design, panelKw: kw, numPanels: newNumPanels });
  };

  const handleNumPanelsChange = (e) => {
    const panels = e.target.value;
    const newKw = (panels && parseInt(panels) > 0) ? ((parseInt(panels) * PANEL_WATTAGE) / 1000).toFixed(2) : '';
    onDesignChange({ ...design, numPanels: panels, panelKw: newKw });
  };

    // Handler for react-select components
    const handleSelectChange = (key, selectedOption) => {
      if (!products) {
        return;
      }
      
      if (!selectedOption) {
        onDesignChange({ ...design, [key]: null });
          return;
      }

      const productList = products[key === 'selectedInverter' ? 'inverters' : 'batteries'] || [];
      const productObject = productList.find(p => p.id === selectedOption.value);
      onDesignChange({ ...design, [key]: productObject ? { ...selectedOption, product: productObject } : null });
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

                        <Row>
                            <Col md={6}>
                                <Form.Group className="mb-3">
                                    <Form.Label>System Type</Form.Label>
                                    <Form.Select value={design.systemType} onChange={e => onDesignChange({ ...design, systemType: e.target.value })}>
                                        <option value="grid">Grid‑tied</option>
                                        <option value="hybrid">Hybrid</option>
                                        <option value="off-grid">Off‑grid</option>
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
                        <div className="mt-auto">
                            <p className="text-muted small mb-0">
                                Using {PANEL_WATTAGE}W panels. Entering a value in one box will automatically calculate the other.
                            </p>
                        </div>
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
                                <Form.Group className="mt-2">
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
                        </Row>
                    </Card.Body>
                </Card>
            </div>
        </div> 
        <Button onClick={onPromote} variant="success" size="lg"><i className="bi bi-tools me-2"></i>Refine Components & Build BOM</Button>    
    </>
  );
};

// ===================================================================================
//  SUB-COMPONENT FOR STAGE 2: BOM BUILDER
// ===================================================================================
const Step1InverterAC = ({ design, onBomChange }) => {
    const { showNotification } = useNotification();
    const inverter = design.selectedInverter?.product;

    // State to hold the lists of compatible products
    const [compatibleCables, setCompatibleCables] = useState([]);
    const [compatibleIsolators, setCompatibleIsolators] = useState([]);
    const [compatibleBreakers, setCompatibleBreakers] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const inverterId = inverter?.id;
        if (!inverterId) {
            setLoading(false);
            return;
        }

        const fetchCompatible = async (category, setter) => {
            try {
                const res = await axios.get(`${API_URL}/api/compatible_products`, {
                    params: { subject_id: inverterId, category: category }
                });
                const options = res.data.map(p => ({
                    value: p.id,
                    label: `${p.model}`,
                    product: p
                }));
                setter(options);
            } catch (error) {
                showNotification(`Failed to load compatible ${category}s`, 'danger');
            }
        };

        setLoading(true);
        Promise.all([
            fetchCompatible('cable', setCompatibleCables),
            fetchCompatible('isolator', setCompatibleIsolators),
            fetchCompatible('breaker', setCompatibleBreakers)
        ]).finally(() => setLoading(false));

    }, [inverter, showNotification]);

    if (!inverter) return <Alert variant="warning">Go back to Sizing Mode to select an inverter first.</Alert>;

    return (
        <div>
            <h5 className="mb-3 fw-bold">Step 1: Inverter & AC Protection</h5>
            <Alert variant="success">
                <i className="bi bi-info-circle-fill me-2"></i>
                <strong>Selected Inverter:</strong> {inverter.model} ({inverter.rating_kva}kVA)
            </Alert>
            <hr />
            {loading ? <div className="text-center"><Spinner animation="border" /></div> : <>
                <Form.Group className="mb-3">
                    <Form.Label>Main AC Cable to Point of Connection</Form.Label>
                    <Select placeholder="Select AC Cable..." options={compatibleCables} onChange={opt => onBomChange(opt.product, 1)} />
                </Form.Group>
                <Form.Group className="mb-3">
                    <Form.Label>Inverter Isolator</Form.Label>
                    <Select placeholder="Select Isolator..." options={compatibleIsolators} onChange={opt => onBomChange(opt.product, 1)} />
                </Form.Group>
                <Form.Group className="mb-3">
                    <Form.Label>Inverter OCPD at POC (Breaker)</Form.Label>
                    <Select placeholder="Select AC Breaker..." options={compatibleBreakers} onChange={opt => onBomChange(opt.product, 1)} />
                </Form.Group>
            </>}
        </div>
    );
};

const Step2PanelsAndStringing = ({ design, onBomChange }) => {
    const [strings, setStrings] = useState([{ id: 1, count: design.numPanels || 0 }]);
    const [validationMsg, setValidationMsg] = useState({ type: 'info', text: '' });

    const handleStringCountChange = (index, value) => {
        const newStrings = [...strings];
        newStrings[index].count = parseInt(value, 10) || 0;
        setStrings(newStrings);
    };

    const addString = () => setStrings([...strings, { id: Date.now(), count: 0 }]);
    const removeString = (index) => setStrings(strings.filter((_, i) => i !== index));
    const totalPanelsInStrings = useMemo(() => strings.reduce((sum, s) => sum + s.count, 0), [strings]);
    
    // Placeholder for validation logic
    useEffect(() => {
        const panel = { voc: design.selectedInverter?.product?.properties?.voc || 50.28 }; // Example
        const inverter = { max_dc_voltage: design.selectedInverter?.product?.properties?.max_dc_voltage || 450 };
        // This is where you would call your backend validation engine
        // For now, we'll simulate it
        const longestString = Math.max(...strings.map(s => s.count));
        const maxVoltage = longestString * panel.voc * 1.15; // Simulated cold temp calculation
        if (maxVoltage > inverter.max_dc_voltage) {
            setValidationMsg({ type: 'danger', text: `Warning: String voltage (${maxVoltage.toFixed(0)}V) exceeds inverter limit of ${inverter.max_dc_voltage}V!` });
        } else {
            setValidationMsg({ type: 'success', text: `Max String Voltage: ${maxVoltage.toFixed(0)}V (OK)` });
        }
    }, [strings, design.selectedInverter]);

    return (
        <div>
            <h5 className="mb-3 fw-bold">Step 2: PV Panel & String Configuration</h5>
            <Alert variant="info">
                <i className="bi bi-info-circle-fill me-2"></i>
                You need to configure **{design.numPanels}** panels. Please arrange them into strings below.
            </Alert>
            {strings.map((str, index) => (
                <Form.Group as={Row} key={str.id} className="mb-2 align-items-center">
                    <Form.Label column sm={3}>String {index + 1}</Form.Label>
                    <Col sm={5}>
                        <Form.Control type="number" min="0" value={str.count} onChange={(e) => handleStringCountChange(index, e.target.value)} />
                    </Col>
                    <Col sm={3}><small className="text-muted">panels</small></Col>
                    <Col sm={1}><Button variant="link" className="text-danger p-0" onClick={() => removeString(index)}><i className="bi bi-trash"></i></Button></Col>
                </Form.Group>
            ))}
            <Button variant="outline-primary" size="sm" onClick={addString} className="mt-2"><i className="bi bi-plus-lg me-1"></i> Add String</Button>
            <hr />
            <div className="text-end">
                <p className="mb-1">Total Panels Configured: <strong className={totalPanelsInStrings !== parseInt(design.numPanels) ? 'text-danger' : 'text-success'}>{totalPanelsInStrings}</strong></p>
                {validationMsg.text && <Alert variant={validationMsg.type} className="py-2 px-3 mt-2 text-center small">{validationMsg.text}</Alert>}
            </div>
        </div>
    );
};

// ===================================================================================
//  BOM BUILDER MAIN COMPONENT
// ===================================================================================
const BomBuilderView = ({ onBack, design, products }) => {
    const [currentStep, setCurrentStep] = useState(1);
    const [bom, setBom] = useState([]);

    useEffect(() => {
        let initialBom = [];
        if (design.selectedInverter?.product) {
            initialBom.push({ product: design.selectedInverter.product, quantity: design.inverterQuantity });
        }
        const panelProduct = products.panels.find(p => p.power_w === PANEL_WATTAGE);
        if (panelProduct && design.numPanels > 0) {
            initialBom.push({ product: panelProduct, quantity: parseInt(design.numPanels) });
        }
        if (design.selectedBattery?.product) {
            initialBom.push({ product: design.selectedBattery.product, quantity: design.batteryQuantity });
        }
        setBom(initialBom);
    }, [design, products]);

    const handleBomChange = (product, quantity) => {
        setBom(currentBom => {
            const newBom = [...currentBom];
            const existingItemIndex = newBom.findIndex(item => item.product.id === product.id);

            if (existingItemIndex > -1) {
                // If item exists and quantity is > 0, update it. Otherwise, remove it.
                if (quantity > 0) {
                    newBom[existingItemIndex] = { ...newBom[existingItemIndex], quantity: quantity };
                } else {
                    newBom.splice(existingItemIndex, 1);
                }
            } else if (quantity > 0) {
                // Add new item if it doesn't exist and quantity is positive
                newBom.push({ product, quantity });
            }
            return newBom;
        });
    };

    const handleRemoveItem = (productIdToRemove) => {
        const coreProductIds = [
            design.selectedInverter?.product?.id,
            products.panels.find(p => p.power_w === PANEL_WATTAGE)?.id,
            design.selectedBattery?.product?.id
        ].filter(Boolean);

        if (coreProductIds.includes(productIdToRemove)) {
            alert("Core componenets cannot be removed");
            return;
        }

        setBom(currentBom => currentBom.filter(item => item.product.id !== productIdToRemove));
    };

    const totalCost = useMemo(() => {
        return bom.reduce((acc, item) => {
            const price = item.product.price || 0;
            const quantity = item.quantity || 0;
            return acc + (price * quantity);
        }, 0);
    }, [bom]);

    const renderStep = () => {
        switch (currentStep) {
            // MODIFIED: Pass the correct handler function to the step components
            case 1: return <Step1InverterAC design={design} onBomChange={handleBomChange} />;
            case 2: return <Step2PanelsAndStringing design={design} onBomChange={handleBomChange} />;
            default: return <h4>Review Final BOM</h4>;
        }
    };

    const totalSteps = 3; // Update this as you add more steps

    return (
        <Row className="g-4">
            <Col lg={4}>
                <Card className="shadow-sm sticky-top" style={{ top: '20px' }}>
                    <Card.Header className='d-flex justify-content-between align-items-center'>
                        <h5 className="mb-0">Live Bill of Materials</h5>
                        <span className='fw-bold text-success'>
                            R{totalCost.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                    </Card.Header>
                    <ListGroup variant="flush" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
                        {bom.map(item => (
                            <ListGroup.Item key={item.product.id} className="d-flex justify-content-between align-items-center">
                                <div>
                                    <p className="mb-0 fw-bold">{item.product.model}</p>
                                    <small className="text-muted text-capitalize">{item.product.category.replace('_', ' ')}</small>
                                </div>
                                <div className='d-flex align-items-center'>
                                    <Badge bg="primary" pill className='me-2'>x {item.quantity}</Badge>
                                    <Button variant="link" size='sm' className='text-danger p-0' onClick={() => handleRemoveItem(item.product.id)} title="Remove Item">
                                        <i className="bi bi-x-circle-fill"></i>
                                    </Button>
                                </div>
                            </ListGroup.Item>
                        ))}
                    </ListGroup>
                </Card>
            </Col>
            <Col lg={8}>
                <Card className="shadow-sm">
                    <Card.Body className="p-4">
                        <div className="d-flex justify-content-between align-items-center mb-4">
                            <h4 className="mb-0">Step-by-Step Builder</h4>
                            <Button onClick={onBack} variant="outline-secondary" size="sm"><i className="bi bi-arrow-left me-2"></i>Back to Sizing Mode</Button>
                        </div>
                        {renderStep()}
                        <div className="d-flex justify-content-between mt-4 border-top pt-3">
                            <Button variant="secondary" onClick={() => setCurrentStep(s => Math.max(1, s - 1))} disabled={currentStep === 1}>Previous</Button>
                            <span className="text-muted align-self-center">Step {currentStep} of {totalSteps}</span>
                            <Button variant="primary" onClick={() => setCurrentStep(s => Math.min(totalSteps, s + 1))} disabled={currentStep === totalSteps}>Next</Button>
                        </div>
                    </Card.Body>
                </Card>
            </Col>
        </Row>
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

function SystemDesign({ projectId }) {
    // Remove chartKey completely
    // const [chartKey, setChartKey] = useState(0); // Remove this line

    // --- Piece 1: State Management ---

    // UI Control State
    const [designStage, setDesignStage] = useState('sizing'); // To switch between 'sizing' and 'bom'
    const [loading, setLoading] = useState(false);
    const [simulationData, setSimulationData] = useState(null);
    const [startDate, setStartDate] = useState(null); // Changed to null like QuickResults
    const [endDate, setEndDate] = useState(null); // Changed to null like QuickResults
    const [showLosses, setShowLosses] = useState(false);

    // Data State
    const [products, setProducts] = useState({ panels: [], inverters: [], batteries: [] });
    const [project, setProject] = useState(null); // Will hold the loaded project details
    const [usePvgis, setUsePvgis] = useState(false);

    // The single, unified state object for the entire design
    const [design, setDesign] = useState({
        systemType: 'grid',
        panelKw: '',
        numPanels: '',
        tilt: '15',
        azimuth: '0',
        selectedInverter: null, // Will hold the full { value, label, product } object
        inverterQuantity: 1,
        selectedBattery: null,  // Will hold the full { value, label, product } object
        batteryQuantity: 1,
        allowExport: false,
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

    // Effect to fetch all product lists once
    const { showNotification } = useNotification();
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

            const savedKw = p.panel_kw || '';
            const numPanels = savedKw ? Math.ceil((savedKw * 1000) / PANEL_WATTAGE) : '';
            
            // Find the full product object for the saved inverter
            const inverterInfo = p.inverter_kva && typeof p.inverter_kva === 'object' ? p.inverter_kva : {model: null, capacity: p.inverter_kva, quantity: 1 };
            const currentInverter = inverterInfo.model ? products.inverters.find(inv => inv.model === inverterInfo.model) : null;

            // Find the full product object for the saved battery
            const batteryInfo = p.battery_kwh && typeof p.battery_kwh === 'object' ? p.battery_kwh : { model: null, capacity: p.battery_kwh, quantity: 1 };
            const currentBattery = products.batteries.find(bat => bat.model === batteryInfo.model);

            // Update the master 'design' state with all the loaded data
            setDesign({
                systemType: p.system_type || 'grid',
                panelKw: savedKw,
                numPanels: numPanels,
                tilt: p.surface_tilt ?? '15',
                azimuth: p.surface_azimuth ?? '0',
                selectedInverter: currentInverter ? { value: currentInverter.id, label: `${currentInverter.model} (${currentInverter.rating_kva}kVA)`, product: currentInverter } : null,
                inverterQuantity: inverterInfo.quantity || 1,
                selectedBattery: currentBattery ? { value: currentBattery.id, label: `${currentBattery.model} (${currentBattery.capacity_kwh}kWh)`, product: currentBattery } : null,
                batteryQuantity: batteryInfo.quantity || 1,
                allowExport: p.allow_export || false,
            });
        });
    }, [projectId, products]); // Reruns if projectId or the loaded products change

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

    const saveProject = () => {
        // Build the payload from the 'design' state object
        const payload = {
            system_type: design.systemType,
            panel_kw: parseFloat(design.panelKw),
            surface_tilt: parseFloat(design.tilt),
            surface_azimuth: parseFloat(design.azimuth),
            allow_export: design.allowExport,
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
        };

        axios.put(`${API_URL}/api/projects/${projectId}`, payload)
            .then(() => {
                showNotification('System saved to project 👍', 'success');
                clearSimulationCache();
            })
            .catch(err => {
                const errorMsg = err.response?.data?.error || 'Could not save the system.';
                showNotification(errorMsg, 'danger');
            });
    };
    
    const handleSimulate = () => {
        setLoading(true);
        // Build the payload from the 'design' state object
        const payload = {
            project_id: projectId,
            use_pvgis: usePvgis,
            system: {
                panel_kw: parseFloat(design.panelKw),
                tilt: parseFloat(design.tilt),
                azimuth: parseFloat(design.azimuth),
                system_type: design.systemType,
                // Ensure we safely access nested properties
                inverter_kva: (design.selectedInverter?.product.rating_kva || 0) * design.inverterQuantity,
                battery_kwh: (design.selectedBattery?.product.capacity_kwh || 0) * design.batteryQuantity,
                allow_export: design.allowExport
            }
        };

        axios.post(`${API_URL}/api/simulate`, payload)
            .then(res => {
                if (!res.data.timestamps) {
                    showNotification('Simulation failed: No data returned.', 'danger');
                    return;
                }
                setSimulationData(res.data);
                // Remove setChartKey line completely

                try {
                    sessionStorage.setItem(`simulationData_${projectId}`, JSON.stringify(res.data));
                    console.log('Cached simulation data:', projectId);
                } catch (err) {
                    console.error('Failed to cache simulation data:', err);
                }
            })
            .catch(err => {
                const errorMsg = err.response?.data?.error || 'Simulation failed.';
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
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999); // Ensure the end date is inclusive

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
        const pvUtilizationPct = totalUtlizedGenKwh > 0 ? (pvUsedOnSiteKwh/totalUtlizedGenKwh) * 100 : 0;

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
            potentialGenDaily: potentialGenDaily.toFixed(0),
            utilizedGenDaily: utilizedGenDaily.toFixed(1),
            throttlingLossesDaily: throttlingLossesDaily.toFixed(1),
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
            {designStage === 'sizing' ? (
                <SizingView
                    design={design}
                    onDesignChange={setDesign}
                    onPromote={() => setDesignStage('bom')}
                    products={products}
                    usePvgis={usePvgis}
                    setUsePvgis={setUsePvgis}
                />
            ) : (
                <BomBuilderView
                    onBack={() => setDesignStage('sizing')}
                    design={design}
                    products={products}
                />
            )}

            {/* --- Action Buttons --- */}
            <div className="row g-3 my-4">
                <div className="col-12 d-flex gap-2">
                    <Button variant="secondary" onClick={saveProject}><i className="bi bi-floppy-fill me-2"></i>Save System</Button>
                    <Button variant="primary" onClick={handleSimulate} disabled={loading}>
                        {loading ? <Spinner as="span" animation="border" size="sm" className="me-2" /> : <i className="bi bi-play-fill me-2"></i>}
                        {loading ? 'Simulating…' : 'Simulate'}
                    </Button>
                </div>
            </div>

            {/* --- Simulation Results, Charts, and Metrics --- */}
            {simulationData && startDate && (
                <div className="mt-5">
                    <Card className="shadow-sm my-4">
                        <Card.Header as="h5" className='d-flex justify-content-between align-items-center flex-wrap'>
                            <span><i className="bi bi-bar-chart-line-fill me-2"></i>Simulation Results</span>
                            <div className='d-flex align-items-center'>
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
                                    const today = new Date();
                                    const weekAgo = new Date();
                                    weekAgo.setDate(today.getDate() - 7);
                                    setStartDate(weekAgo);
                                    setEndDate(today);
                                }}>Last 7 Days</button>

                                <button className="btn btn-outline-secondary" onClick={() => {
                                  const today = new Date();
                                  const monthAgo = new Date();
                                  monthAgo.setDate(today.getDate() - 30);
                                  setStartDate(monthAgo);
                                  setEndDate(today);
                                }}>Last 30 Days</button>

                                <button className="btn btn-outline-secondary" onClick={() => {
                                  const simStartDate = new Date(simulationData.timestamps[0]);
                                  const simEndDate = new Date(simulationData.timestamps[simulationData.timestamps.length - 1]);
                                  setStartDate(simStartDate);
                                  setEndDate(simEndDate);
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
                    <Row className="mb-4 g-3 mt-4">
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