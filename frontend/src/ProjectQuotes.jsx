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
import { useNotification } from "./NotificationContext";
import { API_URL } from "./apiConfig";
import CelebrationOverlay from "./CelebrationOverlay";
import { Howler } from "howler";
import { useAuth } from "./AuthContext";
import { createInvoice } from "./features/invoices/api";
import Modal from "react-bootstrap/Modal";
import { useNavigate } from "react-router-dom";

export default function ProjectQuotes({ projectId, onOpenQuote }) {
  const [rows, setRows] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState({});
  const [editingQuote, setEditingQuote] = useState(null);
  const [editValue, setEditValue] = useState("");
  const { showNotification } = useNotification();
  const [showCelebration, setShowCelebration] = useState(false);
  const [celebrationMeta, setCelebrationMeta] = useState(null);

  // For invoice generation
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [selectedQuote, setSelectedQuote] = useState(null);
  const [invoiceForm, setInvoiceForm] = useState({
    invoiceType: "deposit",
    percent: 65,
    dueInDays: 7,
  });
  const [creatingInvoice, setCreatingInvoice] = useState(false);
  const [navigateToInvoice, setNavigateToInvoice] = useState(true); // New state variable

  // Load default percentages from localStorage
  const [termsPerc, setTermsPerc] = useState(() => {
    return JSON.parse(localStorage.getItem("invoiceTermsPerc") || "[65,25,10]");
  });

  // Add these new state variables
  const [quoteInvoices, setQuoteInvoices] = useState({});
  const [checkingInvoices, setCheckingInvoices] = useState(false);

  const handleCreateInvoiceClick = async (quote, e) => {
    e.stopPropagation(); // Prevent row click
    setSelectedQuote(quote);

    // Set default invoice type and percent
    setInvoiceForm({
      invoiceType: "deposit",
      percent: termsPerc[0] || 65,
      dueInDays: 7,
    });

    // Check for existing invoices
    const existingInvoices = await checkExistingInvoices(quote.number);
    setQuoteInvoices({
      ...quoteInvoices,
      [quote.id]: existingInvoices,
    });

    setShowInvoiceModal(true);
  };

  const handleInvoiceTypeChange = (type) => {
    // Map invoice type to the corresponding percentage in termsPerc array
    const typeIndex = { deposit: 0, delivery: 1, final: 2 };
    const defaultPercent =
      termsPerc[typeIndex[type]] ||
      (type === "deposit" ? 65 : type === "delivery" ? 25 : 10);

    setInvoiceForm({
      ...invoiceForm,
      invoiceType: type,
      percent: type === "final" ? 0 : defaultPercent, // For the final invoice, we'll calculate remaining
    });
  };

  // Function to handle invoice creation
  const handleCreateInvoice = async () => {
    if (!selectedQuote) return;

    try {
      setCreatingInvoice(true);

      const payload = {
        type: invoiceForm.invoiceType,
        quote_number: selectedQuote.number,
        due_in_days: invoiceForm.dueInDays,
      };

      if (invoiceForm.invoiceType !== "final") {
        payload.percent = invoiceForm.percent;
      }

      const result = await createInvoice(projectId, payload);

      showNotification(
        `Invoice ${result.invoice_number} created successfully!`,
        "success"
      );
      setShowInvoiceModal(false);

      // If navigateToInvoice is true, navigate to the invoice
      if (navigateToInvoice && result.invoice_id) {
        navigate(`/invoices/${result.invoice_id}/print`);
      } else {
        // Otherwise just refresh quotes to update the list
        loadQuotes();
      }
    } catch (error) {
      console.error("Failed to create invoice: ", error);
      showNotification(
        error.response?.data?.error || "Failed to create invoice",
        "danger"
      );
    } finally {
      setCreatingInvoice(false);
    }
  };

  const { user } = useAuth();
  const navigate = useNavigate();

  const loadQuotes = async () => {
    setLoading(true);
    try {
      const response = await axios.get(
        `${API_URL}/api/projects/${projectId}/quotes`
      );
      setRows(response.data);
    } catch (error) {
      console.error("Failed to load quotes:", error);
      showNotification("Failed to load quotes", "danger");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadQuotes();
  }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onRefetch = () => window.location.reload();
    window.addEventListener("refresh-project", onRefetch);
    window.addEventListener("refresh-quotes", onRefetch);
    return () => {
      window.removeEventListener("refresh-project", onRefetch);
      window.removeEventListener("refresh-quotes", onRefetch);
    };
  }, []);

  const handleAcceptQuote = async (quoteId, e) => {
    e.stopPropagation(); // Prevent row click
    if (!window.confirm("Mark this quote as accepted?")) return;

    // Try to unlock audio right at the user gesture
    try {
      await Howler.ctx.resume();
    } catch {}

    setActionLoading((prev) => ({ ...prev, [quoteId]: "accept" }));
    try {
      await axios.post(`${API_URL}/api/quotes/${quoteId}/accept`);
      showNotification("Quote accepted!", "success");

      // Celebration
      setCelebrationMeta({
        title: "JA MANNEEEEE!",
        subtitle: "BAIE GELUK GROOTHOND!!!!!!",
      });
      setShowCelebration(true);

      await loadQuotes(); // Reload quotes to get updated status
    } catch (error) {
      console.error(error);
      showNotification(
        error.response?.data?.error || "Failed to accept quote",
        "danger"
      );
    } finally {
      setActionLoading((prev) => ({ ...prev, [quoteId]: null }));
    }
  };

  const handleDeclineQuote = async (quoteId, e) => {
    e.stopPropagation(); // Prevent row click
    if (!window.confirm("Mark this quote as declined?")) return;

    setActionLoading((prev) => ({ ...prev, [quoteId]: "decline" }));
    try {
      await axios.post(`${API_URL}/api/quotes/${quoteId}/decline`);
      showNotification("Quote declined", "info");
      await loadQuotes(); // Reload quotes to get updated status
    } catch (error) {
      console.error(error);
      showNotification(
        error.response?.data?.error || "Failed to decline quote",
        "danger"
      );
    } finally {
      setActionLoading((prev) => ({ ...prev, [quoteId]: null }));
    }
  };

  const handleDeleteQuote = async (quoteId, quoteNumber, e) => {
    e.stopPropagation(); // Prevent row click
    if (
      !window.confirm(
        `Are you sure you want to delete quote "${quoteNumber}"? This action cannot be undone.`
      )
    )
      return;

    setActionLoading((prev) => ({ ...prev, [quoteId]: "delete" }));
    try {
      await axios.delete(`${API_URL}/api/quotes/${quoteId}`);
      showNotification("Quote deleted successfully", "success");
      await loadQuotes(); // Reload quotes
    } catch (error) {
      console.error(error);
      showNotification(
        error.response?.data?.error || "Failed to delete quote",
        "danger"
      );
    } finally {
      setActionLoading((prev) => ({ ...prev, [quoteId]: null }));
    }
  };

  const handleStartEdit = (quote, e) => {
    e.stopPropagation(); // Prevent row click
    setEditingQuote(quote.id);
    // Find the last sequence of digits and separate everything before it
    const match = quote.number.match(/^(.*?)(\d+)$/);
    if (match) {
      // If we found a numeric ending, edit everything except that number
      setEditValue(match[1]); // Everything before the number
    } else {
      // If no numeric ending, allow editing the whole thing
      setEditValue(quote.number);
    }
  };

  const handleCancelEdit = () => {
    setEditingQuote(null);
    setEditValue("");
  };

  const handleSaveEdit = async (quoteId, originalNumber) => {
    if (!editValue.trim()) {
      showNotification("Quote prefix cannot be empty", "danger");
      return;
    }

    setActionLoading((prev) => ({ ...prev, [quoteId]: "rename" }));
    try {
      await axios.patch(`${API_URL}/api/quotes/${quoteId}/rename`, {
        new_prefix: editValue.trim(),
      });
      showNotification("Quote renamed successfully", "success");
      setEditingQuote(null);
      setEditValue("");
      await loadQuotes(); // Reload quotes
    } catch (error) {
      console.error(error);
      showNotification(
        error.response?.data?.error || "Failed to rename quote",
        "danger"
      );
    } finally {
      setActionLoading((prev) => ({ ...prev, [quoteId]: null }));
    }
  };

  const handleKeyPress = (e, quoteId, originalNumber) => {
    if (e.key === "Enter") {
      handleSaveEdit(quoteId, originalNumber);
    } else if (e.key === "Escape") {
      handleCancelEdit();
    }
  };

  // Add this function to check for existing invoices
  const checkExistingInvoices = async (quoteNumber) => {
    try {
      setCheckingInvoices(true);
      const { data } = await axios.get(
        `${API_URL}/api/invoices?quote_number=${quoteNumber}`
      );
      return data.filter((inv) => inv.quote_number === quoteNumber);
    } catch (error) {
      console.error("Error checking existing invoices:", error);
      return [];
    } finally {
      setCheckingInvoices(false);
    }
  };

  if (loading) return <Spinner size="sm" />;

  if (!rows?.length) return <div className="text-muted">No quotes yet.</div>;

  const fmtZAR = (v) =>
    new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR" })
      .format(v || 0)
      .replace("R", "R ");

  const getStatusBadge = (status) => {
    const statusLower = (status || "draft").toLowerCase();
    switch (statusLower) {
      case "sent":
        return <Badge bg="success">{status}</Badge>;
      case "accepted":
        return <Badge bg="primary">{status}</Badge>;
      case "declined":
        return <Badge bg="danger">{status}</Badge>;
      default:
        return <Badge bg="secondary">{status || "draft"}</Badge>;
    }
  };

  const getSequenceNumber = (quoteNumber) => {
    // Find the last sequence of digits at the end
    const match = quoteNumber.match(/(\d+)$/);
    return match ? match[1] : "";
  };

  return (
    <>
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
                onClick={() => !editingQuote && onOpenQuote?.(q.id)}
                style={{
                  cursor: !editingQuote && onOpenQuote ? "pointer" : "default",
                }}
              >
                {editingQuote === q.id ? (
                  <div className="d-flex align-items-center">
                    <Form.Control
                      type="text"
                      size="sm"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={(e) => handleKeyPress(e, q.id, q.number)}
                      style={{ width: "200px", marginRight: "5px" }}
                      autoFocus
                    />
                    <span className="text-muted">
                      {getSequenceNumber(q.number)}
                    </span>
                    <div className="ms-2">
                      <Button
                        variant="success"
                        size="sm"
                        onClick={() => handleSaveEdit(q.id, q.number)}
                        disabled={actionLoading[q.id] === "rename"}
                        className="me-1"
                      >
                        {actionLoading[q.id] === "rename" ? (
                          <Spinner animation="border" size="sm" />
                        ) : (
                          <i className="bi bi-check"></i>
                        )}
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={handleCancelEdit}
                      >
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
                      onClick={(e) => handleStartEdit(q, e)}
                      className="ms-2 p-0"
                      title="Rename quote"
                    >
                      <i className="bi bi-pencil"></i>
                    </Button>
                  </div>
                )}
              </td>
              <td
                onClick={() => !editingQuote && onOpenQuote?.(q.id)}
                style={{
                  cursor: !editingQuote && onOpenQuote ? "pointer" : "default",
                }}
              >
                {getStatusBadge(q.status)}
              </td>
              <td
                onClick={() => !editingQuote && onOpenQuote?.(q.id)}
                style={{
                  cursor: !editingQuote && onOpenQuote ? "pointer" : "default",
                }}
              >
                V{q.version_count || 1}
              </td>
              <td
                onClick={() => !editingQuote && onOpenQuote?.(q.id)}
                style={{
                  cursor: !editingQuote && onOpenQuote ? "pointer" : "default",
                }}
              >
                {q.latest_totals?.total_incl_vat != null
                  ? fmtZAR(q.latest_totals.total_incl_vat)
                  : "—"}
              </td>
              <td
                onClick={() => !editingQuote && onOpenQuote?.(q.id)}
                style={{
                  cursor: !editingQuote && onOpenQuote ? "pointer" : "default",
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
                {editingQuote === q.id ? (
                  <div className="text-muted small">Editing...</div>
                ) : (
                  <div className="d-flex align-items-center">
                    {/* Accept/Decline buttons for sent quotes */}
                    {q.status === "sent" && (
                      <ButtonGroup size="sm" className="me-2">
                        <Button
                          variant="success"
                          size="sm"
                          onClick={(e) => handleAcceptQuote(q.id, e)}
                          disabled={actionLoading[q.id] === "accept"}
                          title="Accept Quote"
                        >
                          {actionLoading[q.id] === "accept" ? (
                            <Spinner animation="border" size="sm" />
                          ) : (
                            <i className="bi bi-check-circle"></i>
                          )}
                        </Button>
                        <Button
                          variant="outline-danger"
                          size="sm"
                          onClick={(e) => handleDeclineQuote(q.id, e)}
                          disabled={actionLoading[q.id] === "decline"}
                          title="Decline Quote"
                        >
                          {actionLoading[q.id] === "decline" ? (
                            <Spinner animation="border" size="sm" />
                          ) : (
                            <i className="bi bi-x-circle"></i>
                          )}
                        </Button>
                      </ButtonGroup>
                    )}

                    {/* Status badges for accepted/declined quotes */}
                    {q.status === "accepted" && (
                      <>
                        <Badge
                          bg="success"
                          style={{ fontSize: "0.7rem" }}
                          className="me-2"
                        >
                          <i className="bi bi-check-circle me-1"></i>Accepted
                        </Badge>
                        <Button
                          variant="outline-success"
                          size="sm"
                          onClick={(e) => handleCreateInvoiceClick(q, e)}
                          className="ms-2"
                          title="Create Invoice"
                        >
                          <i className="bi bi-receipt"></i>
                        </Button>
                      </>
                    )}
                    {q.status === "declined" && (
                      <Badge
                        bg="danger"
                        style={{ fontSize: "0.7rem" }}
                        className="me-2"
                      >
                        <i className="bi bi-x-circle me-1"></i>Declined
                      </Badge>
                    )}
                    {(q.status === "draft" || !q.status) && (
                      <span
                        className="text-muted me-2"
                        style={{ fontSize: "0.8rem" }}
                      >
                        <i className="bi bi-pencil"></i> Draft
                      </span>
                    )}

                    {/* Delete button */}
                    <Button
                      variant="outline-danger"
                      size="sm"
                      onClick={(e) => handleDeleteQuote(q.id, q.number, e)}
                      disabled={actionLoading[q.id] === "delete"}
                      title="Delete Quote"
                    >
                      {actionLoading[q.id] === "delete" ? (
                        <Spinner animation="border" size="sm" />
                      ) : (
                        <i className="bi bi-trash"></i>
                      )}
                    </Button>
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </Table>

      {/* Add Invoice Creation Modal */}
      <Modal
        show={showInvoiceModal}
        onHide={() => setShowInvoiceModal(false)}
        centered
      >
        <Modal.Header closeButton>
          <Modal.Title>Create Invoice from Quote</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedQuote && (
            <Form className="d-grid gap-3">
              <div className="alert alert-info">
                <strong>Quote:</strong> {selectedQuote.number}
                <br />
                <strong>Total:</strong>{" "}
                {selectedQuote.latest_totals?.total_incl_vat != null
                  ? fmtZAR(selectedQuote.latest_totals.total_incl_vat)
                  : "—"}
              </div>

              {selectedQuote && selectedQuote.latest_totals && (
                <div className="mt-3 p-3 border rounded bg-light">
                  <div className="d-flex justify-content-between mb-2">
                    <span>Quote Total:</span>
                    <strong>
                      {fmtZAR(selectedQuote.latest_totals.total_incl_vat)}
                    </strong>
                  </div>

                  {invoiceForm.invoiceType !== "final" && (
                    <div className="d-flex justify-content-between mb-2">
                      <span>Invoice Amount ({invoiceForm.percent}%):</span>
                      <strong>
                        {fmtZAR(
                          (selectedQuote.latest_totals.total_incl_vat *
                            invoiceForm.percent) /
                            100
                        )}
                      </strong>
                    </div>
                  )}

                  {invoiceForm.invoiceType === "final" && (
                    <div className="d-flex justify-content-between">
                      <span>Final Invoice Amount:</span>
                      <strong>
                        {fmtZAR(
                          selectedQuote.latest_totals.total_incl_vat * 0.1
                        )}
                      </strong>
                    </div>
                  )}
                </div>
              )}

              <Form.Group>
                <Form.Label>Invoice Type</Form.Label>
                <Form.Select
                  value={invoiceForm.invoiceType}
                  onChange={(e) => handleInvoiceTypeChange(e.target.value)}
                >
                  <option value="deposit">Deposit ({termsPerc[0]}%)</option>
                  <option value="delivery">Delivery ({termsPerc[1]}%)</option>
                  <option value="final">Final (Remaining Balance)</option>
                </Form.Select>
              </Form.Group>

              {invoiceForm.invoiceType !== "final" && (
                <Form.Group>
                  <Form.Label>Percent of Quote</Form.Label>
                  <Form.Control
                    type="number"
                    min={1}
                    max={100}
                    value={invoiceForm.percent}
                    onChange={(e) =>
                      setInvoiceForm({
                        ...invoiceForm,
                        percent: Number(e.target.value),
                      })
                    }
                  />
                </Form.Group>
              )}

              <Form.Group>
                <Form.Label>Due in (days)</Form.Label>
                <Form.Control
                  type="number"
                  min={1}
                  value={invoiceForm.dueInDays}
                  onChange={(e) =>
                    setInvoiceForm({
                      ...invoiceForm,
                      dueInDays: Number(e.target.value),
                    })
                  }
                />
              </Form.Group>

              {/* New checkbox for navigation option */}
              <Form.Group>
                <Form.Check
                  type="checkbox"
                  id="navigateToInvoice"
                  label="Open invoice after creation"
                  checked={navigateToInvoice}
                  onChange={(e) => setNavigateToInvoice(e.target.checked)}
                />
              </Form.Group>
            </Form>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="secondary"
            onClick={() => setShowInvoiceModal(false)}
            disabled={creatingInvoice}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleCreateInvoice}
            disabled={creatingInvoice}
          >
            {creatingInvoice ? "Creating..." : "Create Invoice"}
          </Button>
        </Modal.Footer>
      </Modal>

      <CelebrationOverlay
        show={showCelebration}
        onClose={() => setShowCelebration(false)}
        title={celebrationMeta?.title}
        subtitle={celebrationMeta?.subtitle}
      />
    </>
  );
}
