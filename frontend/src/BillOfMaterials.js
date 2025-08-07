import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { 
  Container, Row, Col, Card, Button, Form, Spinner, 
  Alert, InputGroup, Badge, Table, ButtonGroup, Modal 
} from 'react-bootstrap';
import { API_URL } from './apiConfig';
import { useNotification } from './NotificationContext';

// Reuse component category metadata from SystemBuilder.js
const CATEGORY_META = {
  panel:        { name: 'Panels',           icon: 'bi-grid-3x3-gap-fill',     color: 'warning'  },
  inverter:     { name: 'Inverters',        icon: 'bi-box-seam',              color: 'info'     },
  battery:      { name: 'Batteries',        icon: 'bi-battery-full',          color: 'success'  },
  fuse:         { name: 'Fuses',            icon: 'bi-shield-slash-fill',     color: 'danger'   },
  breaker:      { name: 'Circuit Breakers', icon: 'bi-lightning-charge-fill', color: 'danger'   },
  isolator:     { name: 'Isolators',        icon: 'bi-plugin-fill',           color: 'secondary'},
  inverter_aux: { name: 'Inverter Aux',     icon: 'bi-hdd-stack-fill',        color: 'secondary'},
  dc_cable:     { name: 'DC Cables',        icon: 'bi-plug-fill',             color: 'dark'     },
  accessory:    { name: 'Accessories',      icon: 'bi-gear-fill',             color: 'secondary'},
};

// Helper to format currency
const formatCurrency = (value) => {
  return new Intl.NumberFormat('en-ZA', { 
    style: 'currency', 
    currency: 'ZAR', 
    maximumFractionDigits: 0 
  }).format(value || 0);
};

function BillOfMaterials({ projectId }) {
  const { showNotification } = useNotification();

  // State Management
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState([]);
  const [project, setProject] = useState(null);
  const [bomComponents, setBomComponents] = useState([]);
  const [isStandardDesign, setIsStandardDesign] = useState(false);
  const [templateInfo, setTemplateInfo] = useState(null);
  const [searchFilter, setSearchFilter] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [savingComponents, setSavingComponents] = useState(false);
  const [showSaveTemplateModal, setShowSaveTemplateModal] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [newTemplateDesc, setNewTemplateDesc] = useState('');
  const [extrasCost, setExtrasCost] = useState('0');
  const [quoteStatus, setQuoteStatus] = useState('draft'); // draft, sent, accepted, complete

  // Load initial data: project details, products, and existing BOM
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);

      try {
        // Load products first
        const productsRes = await axios.get(`${API_URL}/api/products`);
        setProducts(productsRes.data);

        // Load project details
        const projectRes = await axios.get(`${API_URL}/api/projects/${projectId}`);
        setProject(projectRes.data);

        console.log("Project data loaded: ", projectRes.data);

        // Check if using a standard design
        if (projectRes.data.from_standard_template || projectRes.data.template_id) {
            console.log("Standard design detected: ", projectRes.data.template_id);    
            setIsStandardDesign(true);
            setTemplateInfo({
              id: projectRes.data.template_id,
              name: projectRes.data.template_name || 'Standard Design'
            });
        }

        // Load BOM for this project
        await loadProjectBOM(projectId, productsRes.data, projectRes.data);

      } catch (error) {
        console.error("Error loading initial data:", error);
        showNotification("Failed to load project or product data.", "danger");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [projectId, showNotification]);

  // Load existing BOM or initialize from system design components
  const loadProjectBOM = async (projectId, productsData, projectData) => {
    try {
      // Try to load existing BOM first
      const bomRes = await axios.get(`${API_URL}/api/projects/${projectId}/bom`);
      
      if (bomRes.data && bomRes.data.length > 0) {
        // If we have a saved BOM, use it with its historical pricing
        const components = bomRes.data.map(item => {
          const product = products.find(p => p.id === item.product_id) || {
            id: item.product_id,
            name: "Unknown Product"
          };
          
          return {
            product,
            quantity: item.quantity,
            price_at_time: item.price_at_time, // Historical price
            current_price: product.price // Current price for comparison
          };
        });
        
        setBomComponents(components);
        setQuoteStatus(bomRes.data[0].quote_status || 'draft');
        setExtrasCost(bomRes.data[0].extras_cost?.toString() || '0');
        return;
      }
      
      // If no saved BOM, initialize from system design
      initializeFromSystemDesign(projectData, productsData);

    } catch (error) {
      console.error("Error loading BOM:", error);
      // If there's an error or no BOM, initialize from system design
      initializeFromSystemDesign(projectData, productsData);
    }
  };

  // Initialize BOM from system design components
  const initializeFromSystemDesign = (projectData, productsData) => {
    if (!projectData || !productsData.length) return;

    console.log("Initializing BOM from system design:", projectData);
    // Skip panel_id check as it doesn't exist yet
    console.log("Inverter IDs:", projectData.inverter_ids);
    console.log("Battery IDs:", projectData.battery_ids);
    
    const coreComponents = [];
    
    // Skip panel handling since we don't have panel_id yet
    
    // Handle inverters - ONLY use inverter_ids, no fallbacks
    if (projectData.inverter_ids && projectData.inverter_ids.length > 0) {
      const inverterId = projectData.inverter_ids[0]; // Take first one for simplicity
      const inverterProduct = productsData.find(p => p.id === inverterId);
      console.log("Inverter product from ID:", inverterProduct);
      
      if (inverterProduct) {
        const quantity = typeof projectData.inverter_kva === 'object' ? 
          projectData.inverter_kva.quantity || 1 : 1;
        
        coreComponents.push({
          product: inverterProduct,
          quantity: quantity,
          price_at_time: inverterProduct.price,
          current_price: inverterProduct.price
        });
      }
    }

    // Handle batteries - ONLY use battery_ids, no fallbacks
    if (projectData.battery_ids && projectData.battery_ids.length > 0 && projectData.system_type !== 'grid') {
      const batteryId = projectData.battery_ids[0]; // Take first one for simplicity
      const batteryProduct = productsData.find(p => p.id === batteryId);
      console.log("Battery product from ID:", batteryProduct);
      
      if (batteryProduct) {
        const quantity = typeof projectData.battery_kwh === 'object' ? 
          projectData.battery_kwh.quantity || 1 : 1;
          
        coreComponents.push({
          product: batteryProduct,
          quantity: quantity,
          price_at_time: batteryProduct.price,
          current_price: batteryProduct.price
        });
      }
    }

    console.log("Core components initialized from system design:", coreComponents);
    setBomComponents(coreComponents);
  };

  // Filter products by search and category
  const filteredProducts = useMemo(() => {
    return products.filter(product => {
      // Filter by category if a specific one is selected
      if (selectedCategory !== 'all' && product.category !== selectedCategory) {
        return false;
      }
      
      // Filter by search term
      if (searchFilter) {
        const searchText = `${product.brand || ''} ${product.model || ''} ${product.category || ''} ${product.power_w || ''} ${product.rating_kva || ''} ${product.capacity_kwh || ''}`.toLowerCase();
        const searchTerms = searchFilter.toLowerCase().split(/\s+/).filter(term => term);
        return searchTerms.every(term => searchText.includes(term));
      }
      
      return true;
    });
  }, [products, selectedCategory, searchFilter]);

  // Add a component to the BOM
  const addComponent = (product) => {
    const existingComponent = bomComponents.find(c => c.product.id === product.id);
    
    if (existingComponent) {
      // Update quantity if already in list
      updateQuantity(product.id, (existingComponent.quantity || 1) + 1);
      return;
    }
    
    // Add new component with current price as historical price
    setBomComponents([...bomComponents, { 
      product, 
      quantity: 1,
      price_at_time: product.price,
      current_price: product.price 
    }]);
  };

  // Remove a component from the BOM
  const removeComponent = (productId) => {
    setBomComponents(bomComponents.filter(c => c.product.id !== productId));
  };

  // Update component quantity
  const updateQuantity = (productId, quantity) => {
    const numQuantity = parseInt(quantity, 10);
    if (numQuantity > 0) {
      setBomComponents(bomComponents.map(c => 
        c.product.id === productId ? { ...c, quantity: numQuantity } : c
      ));
    }
  };

  // Save the BOM to the project
  const saveBOM = async () => {
    try {
      setSavingComponents(true);
      
      // Format the BOM data for the API
      const bomPayload = {
        project_id: projectId,
        components: bomComponents.map(c => ({
          product_id: c.product.id,
          quantity: c.quantity,
          price_at_time: c.price_at_time || c.product.price // Use historical price if available, else current price
        })),
        extras_cost: parseFloat(extrasCost) || 0,
        from_standard_template: isStandardDesign,
        template_id: isStandardDesign ? templateInfo?.id : null,
        quote_status: quoteStatus
      };
      
      // Call API to save BOM
      await axios.post(`${API_URL}/api/projects/${projectId}/bom`, bomPayload);
      
      // Also update project value
      await axios.put(`${API_URL}/api/projects/${projectId}`, {
        project_value_excl_vat: totalCost
      });
      
      showNotification("Bill of Materials saved successfully!", "success");
    } catch (error) {
      console.error("Error saving BOM:", error);
      showNotification("Failed to save Bill of Materials.", "danger");
    } finally {
      setSavingComponents(false);
    }
  };

  // Save current BOM as a new template
  const saveAsTemplate = async () => {
    if (!newTemplateName.trim()) {
      showNotification("Please provide a template name.", "warning");
      return;
    }
    
    try {
      setSavingComponents(true);
      
      const templatePayload = {
        name: newTemplateName.trim(),
        description: newTemplateDesc.trim(),
        system_type: project?.system_type || 'hybrid',
        extras_cost: parseFloat(extrasCost) || 0,
        components: bomComponents.map(c => ({
          product_id: c.product.id,
          quantity: c.quantity
        }))
      };
      
      await axios.post(`${API_URL}/api/system_templates`, templatePayload);
      
      showNotification("System template created successfully!", "success");
      setShowSaveTemplateModal(false);
      setNewTemplateName('');
      setNewTemplateDesc('');
    } catch (error) {
      console.error("Error saving template:", error);
      showNotification("Failed to save system template.", "danger");
    } finally {
      setSavingComponents(false);
    }
  };

  // Calculate totals
  const totalCost = useMemo(() => {
    let cost = parseFloat(extrasCost) || 0;
    bomComponents.forEach(comp => {
      // Use historical price (price_at_time) for calculations
      cost += (comp.price_at_time || comp.product.price || 0) * comp.quantity;
    });
    return cost;
  }, [bomComponents, extrasCost]);

  // Calculate system specifications
  const systemSpecs = useMemo(() => {
    let panelKw = 0, inverterKva = 0, batteryKwh = 0;
    
    bomComponents.forEach(comp => {
      if (comp.product.category === 'panel') {
        panelKw += (comp.product.power_w || 0) * comp.quantity / 1000;
      }
      if (comp.product.category === 'inverter') {
        inverterKva += (comp.product.rating_kva || 0) * comp.quantity;
      }
      if (comp.product.category === 'battery') {
        batteryKwh += (comp.product.capacity_kwh || 0) * comp.quantity;
      }
    });
    
    return {
      panelKw: panelKw.toFixed(2),
      inverterKva: inverterKva.toFixed(2),
      batteryKwh: batteryKwh.toFixed(2)
    };
  }, [bomComponents]);

  // Group components by category for display
  const componentsByCategory = useMemo(() => {
    const grouped = {};
    
    bomComponents.forEach(comp => {
      const category = comp.product.category || 'other';
      if (!grouped[category]) {
        grouped[category] = [];
      }
      grouped[category].push(comp);
    });
    
    return grouped;
  }, [bomComponents]);

  // Check if any prices have changed since last saved
  const hasPriceChanges = useMemo(() => {
    return bomComponents.some(comp => 
      comp.price_at_time !== undefined && 
      comp.current_price !== undefined && 
      comp.price_at_time !== comp.current_price
    );
  }, [bomComponents]);

  if (loading) {
    return (
      <div className="text-center py-5">
        <Spinner animation="border" variant="primary" />
        <p className="mt-3">Loading bill of materials...</p>
      </div>
    );
  }

  return (
    <div className="p-lg-4" style={{ backgroundColor: '#f8f9fa' }}>
      <h2 className="text-3xl font-bold text-gray-800 mb-4 text-center">Bill of Materials</h2>
      
      {/* Status Card - Standard vs Custom */}
      <Card className="shadow-sm mb-4">
        <Card.Body>
          <div className="d-flex align-items-center justify-content-between flex-wrap">
            <div>
              <h5 className="mb-0">
                {isStandardDesign ? (
                  <>
                    <i className="bi bi-collection-fill me-2 text-success"></i>
                    Standard Design: {templateInfo?.name}
                  </>
                ) : (
                  <>
                    <i className="bi bi-tools me-2 text-primary"></i>
                    Custom System Design
                  </>
                )}
              </h5>
              <p className="text-muted mt-1 mb-0">
                {isStandardDesign 
                  ? "Using a predefined system template. You can modify components if needed." 
                  : "Build your complete system by adding all necessary components."}
              </p>
            </div>
            <div className="d-flex align-items-center">
              <Form.Group className="me-3">
                <Form.Select
                  size="sm"
                  value={quoteStatus}
                  onChange={(e) => setQuoteStatus(e.target.value)}
                  style={{ width: '180px' }}
                >
                  <option value="draft">Quote Status: Draft</option>
                  <option value="sent">Quote Status: Sent</option>
                  <option value="accepted">Quote Status: Accepted</option>
                  <option value="complete">Quote Status: Complete</option>
                </Form.Select>
              </Form.Group>
              <div>
                <Button 
                  variant="outline-primary"
                  className="me-2"
                  size="sm"
                  onClick={() => setShowSaveTemplateModal(true)}
                >
                  <i className="bi bi-save me-1"></i>
                  Save as Template
                </Button>
                <Button 
                  variant="primary"
                  size="sm"
                  onClick={saveBOM}
                  disabled={savingComponents}
                >
                  {savingComponents ? (
                    <>
                      <Spinner as="span" animation="border" size="sm" className="me-1" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <i className="bi bi-check-circle me-1"></i>
                      Save BOM
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
          
          {hasPriceChanges && (
            <Alert variant="warning" className="mt-3 mb-0 d-flex align-items-center">
              <i className="bi bi-exclamation-triangle-fill me-2 fs-5"></i>
              <div>
                <strong>Price changes detected!</strong> Some product prices have changed since this BOM was created. 
                The project will continue to use the historical prices unless you update them.
              </div>
            </Alert>
          )}
        </Card.Body>
      </Card>
      
      <Row>
        {/* Left Column - Component Selection */}
        <Col lg={7}>
          <Card className="shadow-sm mb-4">
            <Card.Header as="h5">
              <i className="bi bi-list-ul me-2"></i>
              Add Components
            </Card.Header>
            <Card.Body>
              {/* Search and Category Filter */}
              <Row className="mb-3">
                <Col md={6}>
                  <InputGroup>
                    <InputGroup.Text>
                      <i className="bi bi-search"></i>
                    </InputGroup.Text>
                    <Form.Control
                      placeholder="Search products..."
                      value={searchFilter}
                      onChange={e => setSearchFilter(e.target.value)}
                    />
                  </InputGroup>
                </Col>
                <Col md={6}>
                  <Form.Select 
                    value={selectedCategory}
                    onChange={e => setSelectedCategory(e.target.value)}
                  >
                    <option value="all">All Categories</option>
                    {Object.keys(CATEGORY_META).map(cat => (
                      <option key={cat} value={cat}>{CATEGORY_META[cat].name}</option>
                    ))}
                  </Form.Select>
                </Col>
              </Row>
              
              {/* Product List */}
              <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                <Table hover responsive>
                  <thead className="table-light sticky-top">
                    <tr>
                      <th>Category</th>
                      <th>Product</th>
                      <th>Specifications</th>
                      <th className="text-end">Price</th>
                      <th className="text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProducts.length > 0 ? (
                      filteredProducts.map(product => {
                        const catMeta = CATEGORY_META[product.category] || { 
                          name: product.category || 'Uncategorized', 
                          icon: 'bi-box',
                          color: 'secondary'
                        };
                        
                        // Check if product is already in BOM
                        const existingComponent = bomComponents.find(c => c.product.id === product.id);
                        
                        return (
                          <tr key={product.id} style={{ verticalAlign: 'middle' }}>
                            <td>
                              <Badge bg={catMeta.color} className="text-capitalize">
                                <i className={`bi ${catMeta.icon} me-1`}></i>
                                {catMeta.name}
                              </Badge>
                            </td>
                            <td>
                              <strong>{product.brand} {product.model}</strong>
                            </td>
                            <td>
                              {product.category === 'panel' && product.power_w && (
                                <Badge bg="warning" text="dark">{product.power_w}W</Badge>
                              )}
                              {product.category === 'inverter' && product.rating_kva && (
                                <Badge bg="info">{product.rating_kva}kVA</Badge>
                              )}
                              {product.category === 'battery' && product.capacity_kwh && (
                                <Badge bg="success">{product.capacity_kwh}kWh</Badge>
                              )}
                            </td>
                            <td className="text-end">
                              {formatCurrency(product.price)}
                            </td>
                            <td className="text-center">
                              {existingComponent ? (
                                <ButtonGroup size="sm">
                                  <Button variant="outline-secondary" onClick={() => updateQuantity(product.id, existingComponent.quantity - 1)}>-</Button>
                                  <Button variant="outline-secondary" disabled>{existingComponent.quantity}</Button>
                                  <Button variant="outline-secondary" onClick={() => updateQuantity(product.id, existingComponent.quantity + 1)}>+</Button>
                                </ButtonGroup>
                              ) : (
                                <Button
                                  variant="outline-primary"
                                  size="sm"
                                  onClick={() => addComponent(product)}
                                >
                                  <i className="bi bi-plus-lg"></i> Add
                                </Button>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan="5" className="text-center py-3">
                          No products match your search criteria.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </Table>
              </div>
            </Card.Body>
          </Card>
        </Col>
        
        {/* Right Column - BOM Summary */}
        <Col lg={5}>
          <Card className="shadow-sm mb-4">
            <Card.Header as="h5">
              <i className="bi bi-receipt me-2"></i>
              Bill of Materials
            </Card.Header>
            <Card.Body style={{ maxHeight: '500px', overflowY: 'auto' }}>
              {Object.keys(componentsByCategory).length > 0 ? (
                <>
                  {Object.entries(componentsByCategory).map(([category, comps]) => {
                    const catMeta = CATEGORY_META[category] || { 
                      name: category || 'Uncategorized', 
                      icon: 'bi-box',
                      color: 'secondary'
                    };
                    
                    return (
                      <div key={category} className="mb-4">
                        <h6 className="text-uppercase text-muted small mb-3">
                          <i className={`bi ${catMeta.icon} me-2`}></i>
                          {catMeta.name}
                        </h6>
                        
                        <Table size="sm" borderless className="mb-0">
                          <tbody>
                            {comps.map(comp => {
                              // Check if price has changed
                              const priceChanged = comp.price_at_time !== undefined && 
                                                  comp.current_price !== undefined && 
                                                  comp.price_at_time !== comp.current_price;
                              
                              return (
                                <tr key={comp.product.id}>
                                  <td style={{width: '40%'}}>
                                    <div className="fw-medium">{comp.product.brand} {comp.product.model}</div>
                                    <small className="text-muted d-flex align-items-center">
                                      {priceChanged ? (
                                        <div>
                                          <span className={`${comp.price_at_time < comp.current_price ? 'text-success' : 'text-danger'} me-1`}>
                                            {formatCurrency(comp.price_at_time)} (saved)
                                          </span>
                                          <span className="ms-1">
                                            <i className="bi bi-arrow-right"></i> {formatCurrency(comp.current_price)} (current)
                                          </span>
                                        </div>
                                      ) : (
                                        <span>
                                          {formatCurrency(comp.price_at_time || comp.product.price)} each
                                        </span>
                                      )}
                                    </small>
                                  </td>
                                  <td style={{width: '30%'}}>
                                    <InputGroup size="sm">
                                      <InputGroup.Text>Qty</InputGroup.Text>
                                      <Form.Control
                                        type="number"
                                        min="1"
                                        value={comp.quantity}
                                        onChange={e => updateQuantity(comp.product.id, e.target.value)}
                                      />
                                    </InputGroup>
                                  </td>
                                  <td className="text-end" style={{width: '30%'}}>
                                    <div className="fw-bold">
                                      {formatCurrency((comp.price_at_time || comp.product.price) * comp.quantity)}
                                    </div>
                                    <Button 
                                      variant="link" 
                                      className="text-danger p-0"
                                      onClick={() => removeComponent(comp.product.id)}
                                    >
                                      <i className="bi bi-trash"></i>
                                    </Button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </Table>
                      </div>
                    );
                  })}
                  
                  <hr className="my-4" />
                  
                  <Form.Group className="mb-3">
                    <Form.Label>Extras & Labor Cost</Form.Label>
                    <InputGroup>
                      <InputGroup.Text>R</InputGroup.Text>
                      <Form.Control
                        type="number"
                        value={extrasCost}
                        onChange={e => setExtrasCost(e.target.value)}
                      />
                    </InputGroup>
                  </Form.Group>
                </>
              ) : (
                <p className="text-center text-muted py-4">
                  No components added yet. Add components from the left panel.
                </p>
              )}
            </Card.Body>
            <Card.Footer className="bg-white">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <h6 className="mb-0">Total Cost:</h6>
                </div>
                <div className="text-primary fs-4 fw-bold">
                  {formatCurrency(totalCost)}
                </div>
              </div>
            </Card.Footer>
          </Card>
          
          {/* System Specifications Card */}
          <Card className="shadow-sm mb-4">
            <Card.Header as="h5">
              <i className="bi bi-info-circle me-2"></i>
              System Specifications
            </Card.Header>
            <Card.Body>
              <Row>
                <Col sm={4} className="mb-3 text-center">
                  <div className="small text-muted">PV Size</div>
                  <div className="fs-4 fw-bold text-warning">
                    {systemSpecs.panelKw} <small>kWp</small>
                  </div>
                </Col>
                <Col sm={4} className="mb-3 text-center">
                  <div className="small text-muted">Inverter</div>
                  <div className="fs-4 fw-bold text-info">
                    {systemSpecs.inverterKva} <small>kVA</small>
                  </div>
                </Col>
                <Col sm={4} className="mb-3 text-center">
                  <div className="small text-muted">Battery</div>
                  <div className="fs-4 fw-bold text-success">
                    {systemSpecs.batteryKwh} <small>kWh</small>
                  </div>
                </Col>
              </Row>
            </Card.Body>
          </Card>
        </Col>
      </Row>
      
      {/* Save as Template Modal */}
      <Modal show={showSaveTemplateModal} onHide={() => setShowSaveTemplateModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Save as System Template</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form.Group className="mb-3">
            <Form.Label>Template Name</Form.Label>
            <Form.Control
              type="text"
              value={newTemplateName}
              onChange={e => setNewTemplateName(e.target.value)}
              placeholder="e.g., 10kW Hybrid System"
            />
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label>Description</Form.Label>
            <Form.Control
              as="textarea"
              rows={3}
              value={newTemplateDesc}
              onChange={e => setNewTemplateDesc(e.target.value)}
              placeholder="Describe this system template..."
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowSaveTemplateModal(false)}>
            Cancel
          </Button>
          <Button 
            variant="primary" 
            onClick={saveAsTemplate}
            disabled={savingComponents || !newTemplateName.trim()}
          >
            {savingComponents ? (
              <>
                <Spinner as="span" animation="border" size="sm" className="me-2" />
                Saving...
              </>
            ) : "Save Template"}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}

export default BillOfMaterials;