import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useParams, Link } from "react-router-dom";
import { Container, Row, Col, Card, Table, Badge, Form, Spinner, Button } from "react-bootstrap";
import { API_URL } from "./apiConfig";

const fmtZAR = v => (new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR" }).format(v ?? 0)).replace("R", "R ");

export default function ProjectQuoteDetails() {
  const { projectId, docId } = useParams();
  const [loading, setLoading] = useState(true);
  const [doc, setDoc] = useState(null);          // envelope + versions (light)
  const [selectedVid, setSelectedVid] = useState(null);
  const [vDetail, setVDetail] = useState(null);  // version detail (lines + totals)
  const [vLoading, setVLoading] = useState(false);

  // load envelope + version list
  useEffect(() => {
    let mounted = true;
    setLoading(true);
    axios.get(`${API_URL}/api/quotes/${docId}`).then(r => {
      if (!mounted) return;
      setDoc(r.data);
      // default to latest version
      const last = r.data.versions?.[r.data.versions.length - 1];
      if (last) setSelectedVid(last.id);
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
                    <Badge bg="info" className="me-2">v{vDetail.version_no}</Badge>
                    <span className="text-muted">{new Date(vDetail.created_at).toLocaleString("en-ZA")}</span>
                  </div>
                  <div className="small text-muted">
                    Status: <b>{vDetail.status || "draft"}</b> {vDetail.pdf_path ? (<>
                      • <a href={`${API_URL}${vDetail.pdf_path}`} target="_blank" rel="noreferrer">PDF</a>
                    </>) : null}
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
        <Link to={`/projects/${projectId}`}><Button variant="outline-secondary">Back to Project</Button></Link>
        {/* Future actions (disabled for now) */}
        <div className="d-flex gap-2">
          <Button variant="outline-primary" disabled title="Coming soon">Load to BOM</Button>
          <Button variant="primary" disabled title="Coming soon">Create New Version</Button>
        </div>
      </div>
    </Container>
  );
}
