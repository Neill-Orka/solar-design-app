// ProjectQuotes.js
import React, { useEffect, useState } from "react";
import axios from "axios";
import {
  Table,
  Badge,
  Spinner,
  Button,
  ButtonGroup,
  Form,
} from "react-bootstrap";
import { useNotification } from "../../NotificationContext";
import { API_URL } from "../../apiConfig";
import { useAuth } from "../../AuthContext";
import { useNavigate } from "react-router-dom";
import { createInvoice, deleteInvoice } from "./api";
import Modal from "react-bootstrap/Modal";

export default function InvoicesPage() {
  const [rows, setRows] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState({});
  const [editingQuote, setEditingQuote] = useState(null);
  const [editValue, setEditValue] = useState("");
  const { showNotification } = useNotification();
  const [showCelebration, setShowCelebration] = useState(false);
  const [celebrationMeta, setCelebrationMeta] = useState(null);
  const { user } = useAuth();
  const navigate = useNavigate();

  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({
    projectId: "" as string,
    quoteNumber: "" as string,
    invoiceType: "deposit" as "deposit" | "delivery" | "final",
    percent: (JSON.parse(
      localStorage.getItem("invoiceTermsPerc") || "[65,25,10]"
    )[0] || 65) as number,
    dueInDays: 7 as number,
  });
  const [submitting, setSubmitting] = useState(false);

  const loadInvoices = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_URL}/api/invoices`);
      setRows(response.data);
    } catch (error) {
      console.error("Failed to load invoices:", error);
      showNotification("Failed to load invoices", "danger");
    } finally {
      setLoading(false);
    }
  };

  const openInvoice = (invoiceId: number) => {
    navigate(`/invoices/${invoiceId}/print`);
  };

  useEffect(() => {
    loadInvoices();
  }, []);

  const handleDeleteInvoice = async (
    invoiceId: number,
    invoiceNumber: string,
    e
  ) => {
    e.stopPropagation();
    if (confirm(`Are you sure you want to delete invoice ${invoiceNumber}?`)) {
      setActionLoading((prev) => ({ ...prev, [invoiceId]: "delete" }));
      try {
        await deleteInvoice(invoiceId);
        showNotification(`Invoice ${invoiceNumber} deleted`, "success");
        loadInvoices();
      } catch (error) {
        console.error("Failed to delete invoice:", error);
        showNotification("Failed to delete invoice", "danger");
      } finally {
        setActionLoading((prev) => ({ ...prev, [invoiceId]: undefined }));
      }
    }
  };

  if (loading)
    return (
      <div className="d-flex justify-content-center p-5">
        <Spinner animation="border" role="status">
          <span className="visually-hidden">Loading...</span>
        </Spinner>
      </div>
    );

  if (!rows?.length) return <div className="text-muted">No invoices yet.</div>;

  const fmtZAR = (v: number | null | undefined) =>
    new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR" })
      .format(v || 0)
      .replace("R", "R ");

  return (
    <>
      <div className="d-flex justify-content-between align-items-center mb-3 p-3">
        <h3>Invoices</h3>
        <Button variant="primary" size="sm" onClick={() => setShowNew(true)}>
          <i className="bi bi-plus me-1"></i> New Invoice
        </Button>
      </div>
      <Table striped hover size="sm" className="align-middle">
        <thead>
          <tr>
            <th>#</th>
            <th>Status</th>
            <th>Latest ver.</th>
            <th>Total (incl. VAT)</th>
            <th>Created</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((q) => (
            <tr key={q.id}>
              <td
                onClick={() => openInvoice(q.id)}
                style={{
                  cursor: !editingQuote ? "pointer" : "default",
                }}
              >
                {editingQuote === q.id ? (
                  <div className="d-flex align-items-center">
                    <Form.Control
                      type="text"
                      size="sm"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      style={{ width: "200px", marginRight: "5px" }}
                      autoFocus
                    />
                    <span className="text-muted"></span>
                    <div className="ms-2">
                      <Button variant="secondary" size="sm">
                        <i className="bi bi-x"></i>
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="d-flex align-items-center">
                    <span>{q.number}</span>
                    <Button
                      variant="link"
                      size="sm"
                      className="ms-2 p-0"
                      title="Rename quote"
                    >
                      <i className="bi bi-pencil"></i>
                    </Button>
                  </div>
                )}
              </td>
              <td
                onClick={() => openInvoice(q.id)}
                style={{
                  cursor: !editingQuote ? "pointer" : "default",
                }}
              ></td>
              <td
                onClick={() => openInvoice(q.id)}
                style={{
                  cursor: !editingQuote ? "pointer" : "default",
                }}
              >
                V{q.version_count || 1}
              </td>
              <td
                onClick={() => openInvoice(q.id)}
                style={{
                  cursor: !editingQuote ? "pointer" : "default",
                }}
              >
                {q.latest_totals?.total_incl_vat != null
                  ? fmtZAR(q.latest_totals.total_incl_vat)
                  : "—"}
              </td>
              <td
                onClick={() => openInvoice(q.id)}
                style={{
                  cursor: !editingQuote ? "pointer" : "default",
                }}
              >
                {new Date(q.created_at).toLocaleString("en-ZA")}
                {q.created_by && (
                  <div className="small text-muted">
                    by {q.created_by.full_name}
                  </div>
                )}
              </td>
              <td>
                <Button
                  variant="outline-danger"
                  size="sm"
                  onClick={(e) => handleDeleteInvoice(q.id, q.number, e)}
                  // disabled={actionLoading[q.id] === "delete"}
                  title="Delete Invoice"
                >
                  <i className="bi bi-trash"></i>
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>

      <Modal show={showNew} onHide={() => setShowNew(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Create Invoice from Quote</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form className="d-grid gap-2">
            <Form.Group>
              <Form.Label>Project ID</Form.Label>
              <Form.Control
                type="number"
                value={form.projectId}
                onChange={(e) =>
                  setForm({ ...form, projectId: e.target.value })
                }
                placeholder="e.g. 67"
              />
            </Form.Group>
            <Form.Group>
              <Form.Label>Quote Number</Form.Label>
              <Form.Control
                value={form.quoteNumber}
                onChange={(e) =>
                  setForm({ ...form, quoteNumber: e.target.value })
                }
                placeholder="e.g. Orka_Solar_QTE_P67_2025-0001"
              />
            </Form.Group>
            <Form.Group>
              <Form.Label>Invoice Type</Form.Label>
              <Form.Select
                value={form.invoiceType}
                onChange={(e) => {
                  const type = e.target.value as
                    | "deposit"
                    | "delivery"
                    | "final";
                  const defaults = { deposit: 65, delivery: 25, final: 10 };
                  setForm({
                    ...form,
                    invoiceType: type,
                    percent: defaults[type],
                  });
                }}
              >
                <option value="deposit">Deposit</option>
                <option value="delivery">Delivery</option>
                <option value="final">Final</option>
              </Form.Select>
            </Form.Group>
            {form.invoiceType !== "final" && (
              <Form.Group>
                <Form.Label>Percent of Quote</Form.Label>
                <Form.Control
                  type="number"
                  min={1}
                  max={100}
                  value={form.percent}
                  onChange={(e) =>
                    setForm({ ...form, percent: Number(e.target.value) })
                  }
                />
              </Form.Group>
            )}
            <Form.Group>
              <Form.Label>Due in (days)</Form.Label>
              <Form.Control
                type="number"
                min={1}
                value={form.dueInDays}
                onChange={(e) =>
                  setForm({ ...form, dueInDays: Number(e.target.value) })
                }
              />
            </Form.Group>
            <div className="text-muted small">
              Tip: You can set your default term split in localStorage key{" "}
              <code>invoiceTermsPerc</code> as <code>[65,25,10]</code>.
            </div>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="secondary"
            onClick={() => setShowNew(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={!form.projectId || !form.quoteNumber || submitting}
            onClick={async () => {
              try {
                setSubmitting(true);
                const payload: any = {
                  type: form.invoiceType,
                  quote_number: form.quoteNumber,
                  due_in_days: form.dueInDays,
                };
                if (form.invoiceType !== "final")
                  payload.percent = form.percent;
                const res = await createInvoice(
                  Number(form.projectId),
                  payload
                );
                showNotification(
                  `Invoice ${res.invoice_number} created`,
                  "success"
                );
                setShowNew(false);
                loadInvoices();
              } catch (err) {
                console.error(err);
                showNotification("Failed to create invoice", "danger");
              } finally {
                setSubmitting(false);
              }
            }}
          >
            {submitting ? "Creating…" : "Create"}
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}
