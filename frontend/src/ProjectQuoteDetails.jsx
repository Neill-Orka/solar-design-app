import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useNavigate, useParams, Link } from "react-router-dom";
import { Container, Row, Col, Card, Table, Badge, Form, Spinner, Button, Alert } from "react-bootstrap";
import { useNotification } from './NotificationContext';
import { API_URL } from './apiConfig';

const fmtZAR = v => (new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR" }).format(v ?? 0)).replace("R", "R ");

export default function ProjectQuoteDetails() {
  const { projectId, docId } = useParams();
  const [loading, setLoading] = useState(true);
  const [doc, setDoc] = useState(null);          // envelope + versions (light)
  const [selectedVid, setSelectedVid] = useState(null);
  const [vDetail, setVDetail] = useState(null);  // version detail (lines + totals)
  const [vLoading, setVLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const navigate = useNavigate();
  const { showNotification } = useNotification();

  // Handlers
  const handleLoadToBOM = async (versionId) => {
    try {
      const response = await axios.post(`${API_URL}/api/quote-versions/${versionId}/load-to-bom`);
      showNotification('Quote loaded to BOM for editing', 'success');
      
      // Check if we have core components data to synchronize SystemDesign
      if (response.data.core_components) {
        // Store core components for SystemDesign synchronization
        sessionStorage.setItem(`quoteLoadCoreComponents_${projectId}`, JSON.stringify(response.data.core_components));
      }
      
      // Navigate to the BOM so user is immediately in edit mode
      navigate(`/projects/${projectId}?tab=bom&quoteDoc=${doc.id}&quoteNo=${doc.number}&fromVersion=${vDetail.version_no}`);
    } catch (e) {
      console.error(e);
      showNotification('Failed to load quote to BOM', 'danger');
    }
  };

  const handleCreateNewVersion = async () => {
    try {
      await axios.post(`${API_URL}/api/quotes/${docId}/versions`, {});
      showNotification('New version created from current BOM', 'success');
      // Reload the quote to show new version
      window.location.reload();
    } catch (e) {
      console.error(e);
      showNotification('Failed to create new version', 'danger');
    }
  };

  const handleSendQuote = async () => {
    if (!window.confirm('Send this quote to the client?')) return;
    
    setActionLoading(true);
    try {
      console.log('Sending quote...', { docId, vDetail });
      await axios.post(`${API_URL}/api/quotes/${docId}/send`);
      showNotification('Quote sent successfully!', 'success');
      
      console.log('Quote sent, now preparing print data...', { vDetail });
      
      // Transform quote data to PrintableBOM format
      if (vDetail && vDetail.line_items) {
        console.log('vDetail found, processing line items:', vDetail.line_items);
        // Group line items by category
        const categoryMap = {};
        
        vDetail.line_items.forEach(item => {
          // Use category from product snapshot or default to 'Other'
          const category = item.category || item.product_snapshot?.category || 'Other';
          
          if (!categoryMap[category]) {
            categoryMap[category] = {
              name: category,
              items: []
            };
          }
          
          categoryMap[category].items.push({
            brand: item.brand || '',
            model: item.model || '',
            quantity: item.qty || 0,
            cost: item.unit_cost_locked || 0,
            price: item.unit_price_locked || 0,
            lineTotal: item.line_total_locked || 0
          });
        });
        
        // Convert to array format expected by PrintableBOM
        const categories = Object.values(categoryMap);
        
        // Create project data structure expected by PrintableBOM
        const printData = {
          project: {
            id: parseInt(projectId),
            project_name: `Quote ${doc.number}`,
            client_name: doc.client_snapshot_json?.name || 'Unknown Client',
            location: doc.client_snapshot_json?.location || '',
            created_at: vDetail.created_at,
            quote_number: doc.number,
            quote_status: vDetail.status || 'sent'
          },
          systemSpecs: {
            // Add any system specs if available from payload
            ...vDetail.payload_json
          },
          totals: {
            subtotal_excl_vat: vDetail.totals?.subtotal_items_excl_vat || 0,
            extras_excl_vat: vDetail.totals?.extras_excl_vat || 0,
            total_excl_vat: vDetail.totals?.total_excl_vat || 0,
            vat_perc: vDetail.totals?.vat_perc || 15,
            vat_price: vDetail.totals?.vat_price || 0,
            total_incl_vat: vDetail.totals?.total_incl_vat || 0
          },
          categories: categories
        };
        
        // Store with quote-specific key for PrintableBOM
        localStorage.setItem(`quoteData_${docId}`, JSON.stringify(printData));
        
        console.log('Print data stored in localStorage:', printData);
        console.log('Navigating to:', `/projects/${projectId}/printable-bom/${docId}?action=download`);
        
        // Navigate to printable BOM with auto-download
        navigate(`/projects/${projectId}/printable-bom/${docId}?action=download`);
      } else {
        console.error('No vDetail or line_items found:', { vDetail });
        showNotification('No quote data available for printing', 'warning');
      }
      
    } catch (e) {
      console.error(e);
      showNotification(e.response?.data?.error || 'Failed to send quote', 'danger');
    } finally {
      setActionLoading(false);
    }
  };

  const handleMarkAccepted = async () => {
    if (!window.confirm('Mark this quote as accepted?')) return;
    
    setActionLoading(true);
    try {
      await axios.post(`${API_URL}/api/quotes/${docId}/accept`);
      showNotification('Quote marked as accepted!', 'success');
      window.location.reload();
    } catch (e) {
      console.error(e);
      showNotification(e.response?.data?.error || 'Failed to mark quote as accepted', 'danger');
    } finally {
      setActionLoading(false);
    }
  };

  const handleMarkDeclined = async () => {
    if (!window.confirm('Mark this quote as declined?')) return;
    
    setActionLoading(true);
    try {
      await axios.post(`${API_URL}/api/quotes/${docId}/decline`);
      showNotification('Quote marked as declined', 'info');
      window.location.reload();
    } catch (e) {
      console.error(e);
      showNotification(e.response?.data?.error || 'Failed to mark quote as declined', 'danger');
    } finally {
      setActionLoading(false);
    }
  };

  // load envelope + version list
  useEffect(() => {
    let mounted = true;
    setLoading(true);
    axios.get(`${API_URL}/api/quotes/${docId}`).then(r => {
      if (!mounted) return;
      const data = r.data;
      setDoc(data);
      // Auto-select latest version
      if (data.versions?.length > 0) {
        setSelectedVid(data.versions[data.versions.length - 1].id);
      }
      setLoading(false);
    }).catch(() => setLoading(false));
    return () => { mounted = false; };
  }, [docId]);

  // load selected version details
  useEffect(() => {
    if (!selectedVid) { setVDetail(null); return; }
    let mounted = true;
    setVLoading(true);
    axios.get(`${API_URL}/api/quote-versions/${selectedVid}`).then(r => {
      if (!mounted) return;
      setVDetail(r.data);
      setVLoading(false);
    }).catch(() => setVLoading(false));
    return () => { mounted = false; };
  }, [selectedVid]);

  const versionOptions = useMemo(() => (doc?.versions || []).map(v => ({
    id: v.id,
    label: `v${v.version_no} • ${new Date(v.created_at).toLocaleString("en-ZA")} • ${v.status || "draft"}`
  })), [doc]);

  // Get current version status
  const currentVersionStatus = vDetail?.status || 'draft';
  const isDraft = currentVersionStatus === 'draft';
  const isSent = currentVersionStatus === 'sent';

  if (loading) return <div className="p-3"><Spinner size="sm" /> Loading quote…</div>;
  if (!doc) return <div className="p-3 text-danger">Quote not found.</div>;

  return (
    <Container fluid className="py-3">
      <Row className="align-items-center mb-3">
        <Col>
          <h5 className="mb-0">Quote <span className="text-muted">{doc.number}</span></h5>
          <div className="small text-muted">Project #{projectId}</div>
        </Col>
        <Col className="text-end">
          <Badge bg={doc.status === "accepted" ? "success" : doc.status === "declined" ? "danger" : "secondary"}>
            {doc.status || "open"}
          </Badge>
        </Col>
      </Row>

      <Row className="mb-3">
        <Col md={6}>
          <Card className="mb-3">
            <Card.Header className="d-flex justify-content-between align-items-center">
              <span>Versions</span>
              <Form.Select
                size="sm"
                style={{ maxWidth: 380 }}
                value={selectedVid || ""}
                onChange={e => setSelectedVid(Number(e.target.value))}
              >
                <option value="">Select version...</option>
                {(versionOptions || []).map(opt => (
                  <option key={opt.id} value={opt.id}>{opt.label}</option>
                ))}
              </Form.Select>
            </Card.Header>
            <Card.Body>
              {vLoading && <Spinner size="sm" />}
              {!vLoading && vDetail && (
                <>
                  <div className="mb-2">
                    <Badge bg={isDraft ? "secondary" : isSent ? "primary" : "success"} className="me-2">
                      v{vDetail.version_no} • {currentVersionStatus}
                    </Badge>
                    <span className="text-muted">{new Date(vDetail.created_at).toLocaleString("en-ZA")}</span>
                  </div>
                  {vDetail.valid_until && (
                    <div className="small text-muted mb-2">
                      Valid until: {new Date(vDetail.valid_until).toLocaleDateString("en-ZA")}
                    </div>
                  )}
                  <div className="small text-muted">
                    {vDetail.pdf_path ? (
                      <a href={`${API_URL}${vDetail.pdf_path}`} target="_blank" rel="noreferrer" className="text-decoration-none">
                        <i className="bi bi-file-pdf me-1"></i>View PDF
                      </a>
                    ) : isDraft ? (
                      <span className="text-muted">PDF will be generated when sent</span>
                    ) : null}
                  </div>
                </>
              )}
            </Card.Body>
          </Card>
        </Col>

        <Col md={6}>
          <Card className="mb-3">
            <Card.Header>Totals</Card.Header>
            <Card.Body>
              {vLoading && <Spinner size="sm" />}
              {!vLoading && vDetail && (
                <Row>
                  <Col xs={6} className="mb-2">Subtotal (items):</Col>
                  <Col xs={6} className="text-end mb-2">{fmtZAR(vDetail.totals?.subtotal_items_excl_vat)}</Col>

                  <Col xs={6} className="mb-2">Extras:</Col>
                  <Col xs={6} className="text-end mb-2">{fmtZAR(vDetail.totals?.extras_excl_vat)}</Col>

                  <Col xs={6} className="mb-2">Total excl. VAT:</Col>
                  <Col xs={6} className="text-end mb-2">{fmtZAR(vDetail.totals?.total_excl_vat)}</Col>

                  <Col xs={6} className="mb-2">VAT ({vDetail.totals?.vat_perc ?? 15}%):</Col>
                  <Col xs={6} className="text-end mb-2">{fmtZAR(vDetail.totals?.vat_price)}</Col>

                  <Col xs={6}><b>Total incl. VAT:</b></Col>
                  <Col xs={6} className="text-end"><b>{fmtZAR(vDetail.totals?.total_incl_vat)}</b></Col>
                </Row>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Action buttons based on status */}
      {vDetail && (
        <Row className="mb-3">
          <Col>
            <Card>
              <Card.Header>Actions</Card.Header>
              <Card.Body>
                {isDraft && (
                  <div className="d-flex gap-2 flex-wrap">
                    <Button variant="outline-primary" onClick={() => handleLoadToBOM(selectedVid)} disabled={actionLoading}>
                      <i className="bi bi-pencil me-1"></i>Edit in BOM
                    </Button>
                    <Button variant="success" onClick={handleSendQuote} disabled={actionLoading}>
                      <i className="bi bi-send me-1"></i>
                      {actionLoading ? 'Sending...' : 'Send Quote'}
                    </Button>
                  </div>
                )}
                {isSent && (
                  <div className="d-flex gap-2 flex-wrap">
                    <Button variant="success" onClick={handleMarkAccepted} disabled={actionLoading}>
                      <i className="bi bi-check-circle me-1"></i>
                      {actionLoading ? 'Processing...' : 'Mark Accepted'}
                    </Button>
                    <Button variant="outline-danger" onClick={handleMarkDeclined} disabled={actionLoading}>
                      <i className="bi bi-x-circle me-1"></i>
                      {actionLoading ? 'Processing...' : 'Mark Declined'}
                    </Button>
                  </div>
                )}
                {(currentVersionStatus === 'accepted' || currentVersionStatus === 'declined') && (
                  <Alert variant={currentVersionStatus === 'accepted' ? 'success' : 'warning'} className="mb-0">
                    <i className={`bi ${currentVersionStatus === 'accepted' ? 'bi-check-circle' : 'bi-x-circle'} me-1`}></i>
                    This quote has been {currentVersionStatus}.
                  </Alert>
                )}
              </Card.Body>
            </Card>
          </Col>
        </Row>
      )}

      <Card>
        <Card.Header>Line items</Card.Header>
        <Card.Body className="p-0">
          {vLoading && <div className="p-3"><Spinner size="sm" /></div>}
          {!vLoading && vDetail && (
            <Table hover size="sm" className="mb-0 align-middle">
              <thead>
                <tr>
                  <th style={{ width: "38%" }}>Product</th>
                  <th>Qty</th>
                  <th>Unit Price</th>
                  <th>Line Total</th>
                </tr>
              </thead>
              <tbody>
                {(vDetail.lines || []).map(li => (
                  <tr key={li.id}>
                    <td>
                      <div className="fw-semibold">{li.brand || li.product_snapshot_json?.brand || "—"} {li.model || li.product_snapshot_json?.model || ""}</div>
                      <div className="small text-muted">ID: {li.product_id || "n/a"}</div>
                    </td>
                    <td>{li.qty}</td>
                    <td>{fmtZAR(li.unit_price_locked)}</td>
                    <td>{fmtZAR(li.line_total_locked)}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card.Body>
      </Card>

      <div className="mt-3 d-flex justify-content-between">
        <Link to={`/projects/${projectId}?tab=quotes`}><Button variant="outline-secondary">Back to Quotes</Button></Link>
        <div className="d-flex gap-2">
          <Button variant="outline-primary" onClick={handleCreateNewVersion} disabled={actionLoading}>
            <i className="bi bi-plus-circle me-1"></i>Create New Version
          </Button>
        </div>
      </div>
    </Container>
  );
}