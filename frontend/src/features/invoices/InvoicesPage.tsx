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
import { deleteInvoice } from "./api";

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
        <Button variant="primary" size="sm">
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
    </>
  );
}
