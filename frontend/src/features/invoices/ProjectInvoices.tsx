import React, { useEffect, useState } from "react";
import axios from "axios";
import { Table, Badge, Spinner, Button } from "react-bootstrap";
import { useNotification } from "../../NotificationContext";
import { API_URL } from "../../apiConfig";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../AuthContext";

type InvoiceRow = {
  id: number;
  invoice_number: string;
  status: "draft" | "sent" | "paid" | "overdue" | "cancelled";
  issue_date: string;
  due_date?: string;
  total_incl_vat: number;
  quote_number?: string;
};

export default function ProjectInvoices({ projectId }: { projectId: number }) {
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<Record<number, boolean>>(
    {}
  );
  const { showNotification } = useNotification();
  const { token } = useAuth();
  const navigate = useNavigate();

  const loadInvoices = async () => {
    setLoading(true);
    try {
      const response = await axios.get(
        `${API_URL}/api/invoices?project_id=${projectId}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      setInvoices(response.data);
    } catch (error) {
      console.error("Error loading invoices:", error);
      showNotification("Error loading invoices", "danger");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (projectId) {
      loadInvoices();
    }
  }, [projectId]);

  const handleDeleteInvoice = async (invoiceId: number) => {
    if (!window.confirm("Are you sure you want to delete this invoice?")) {
      return;
    }

    setActionLoading((prev) => ({ ...prev, [invoiceId]: true }));
    try {
      await axios.delete(`${API_URL}/api/invoices/${invoiceId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      showNotification("Invoice deleted successfully", "success");
      loadInvoices();
    } catch (error) {
      console.error("Failed to delete invoice:", error);
      showNotification(
        (error as any).response?.data?.error || "Failed to delete invoice",
        "danger"
      );
    } finally {
      setActionLoading((prev) => ({ ...prev, [invoiceId]: false }));
    }
  };

  const handleOpenInvoice = (invoiceId: number) => {
    navigate(`/invoices/${invoiceId}/print`);
  };

  if (loading) {
    return (
      <div className="text-center">
        <Spinner size="sm" />
        <p className="mt-2">Loading invoices...</p>
      </div>
    );
  }

  if (!invoices?.length) {
    return (
      <div className="text-muted">No invoices found for this project.</div>
    );
  }

  const fmtZAR = (v: number) =>
    new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR" })
      .format(v || 0)
      .replace("R", "R ");

  const getStatusBadge = (status: InvoiceRow["status"]) => {
    const statusLower = (status || "draft").toLowerCase();
    switch (statusLower) {
      case "paid":
        return <Badge bg="success">{status}</Badge>;
      case "sent":
        return <Badge bg="primary">{status}</Badge>;
      case "overdue":
        return <Badge bg="danger">{status}</Badge>;
      default:
        return <Badge bg="secondary">{status}</Badge>;
    }
  };

  return (
    <Table striped hover size="sm" className="align-middle">
      <thead>
        <tr>
          <th>Invoice #</th>
          <th>Status</th>
          <th>Issue Date</th>
          <th>Due Date</th>
          <th className="text-end">Total (incl. VAT)</th>
          <th>Quote #</th>
          <th className="text-end">Actions</th>
        </tr>
      </thead>
      <tbody>
        {invoices.map((inv) => (
          <tr
            key={inv.id}
            onClick={() => handleOpenInvoice(inv.id)}
            style={{ cursor: "pointer" }}
          >
            <td>
              <strong>{inv.invoice_number}</strong>
            </td>
            <td>{getStatusBadge(inv.status)}</td>
            <td>{new Date(inv.issue_date).toLocaleDateString("en-ZA")}</td>
            <td>
              {inv.due_date
                ? new Date(inv.due_date).toLocaleDateString("en-ZA")
                : "—"}
            </td>
            <td className="text-end">{fmtZAR(inv.total_incl_vat)}</td>
            <td>{inv.quote_number || "—"}</td>
            <td className="text-end">
              <Button
                variant="outline-danger"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation(); // Prevent row click
                  handleDeleteInvoice(inv.id);
                }}
                disabled={actionLoading[inv.id]}
                title="Delete Invoice"
              >
                {actionLoading[inv.id] ? (
                  <Spinner animation="border" size="sm" />
                ) : (
                  <i className="bi bi-trash"></i>
                )}
              </Button>
            </td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}
