import React, { useEffect, useState, useMemo } from "react";
import { useParams } from "react-router-dom";
import { getInvoice } from "./api";
import logo from "../../assets/orka_logo_text.png";
import "../../PrintableBOM.css";

type InvoiceItem = {
  id: number;
  description: string;
  sku?: string;
  quantity: number;
  unit?: string;
  unit_price_excl_vat: number;
  line_total_excl_vat: number;
  vat_rate: number;
  line_vat: number;
  line_total_incl_vat: number;
};

type Invoice = {
  id: number;
  project_id: number;
  invoice_number: string;
  invoice_type: "deposit" | "delivery" | "final";
  status: string;
  issue_date: string;
  due_date?: string;
  percent_of_quote?: number;
  quote_number?: string;
  billing: {
    name?: string;
    company?: string;
    vat_no?: string;
    address?: string;
  };
  vat_rate: number;
  subtotal_excl_vat: number;
  vat_amount: number;
  total_incl_vat: number;
  currency: string;
  items: InvoiceItem[];
};

export default function PrintableInvoice() {
  const { invoiceId } = useParams<{ invoiceId: string }>();
  const [inv, setInv] = useState<Invoice | null>(null);

  useEffect(() => {
    if (!invoiceId) return;
    getInvoice(Number(invoiceId)).then(setInv).catch(console.error);
  }, [invoiceId]);

  const currentDate = useMemo(() => {
    return new Date(inv?.issue_date || Date.now()).toLocaleString();
  }, [inv]);

  if (!inv) {
    return <div className="text-center p-5">Loading invoice...</div>;
  }

  return (
    <div className="bom-print-root">
      {/* Header */}
      <header className="bom-header">
        <div className="bom-header-top">
          <img className="bom-logo" src={logo} alt="Orka Solar Logo" />
          <div className="bom-company-meta">
            <div>Orka Solar (Pty) Ltd</div>
            <div>Reg No: 2017/141572/07</div>
            <div>VAT No: 463 028 1337</div>
            <div>
              T: 082 660 0851&nbsp; E: info@orkasolar.co.za&nbsp; W:
              www.orkasolar.co.za
            </div>
          </div>
        </div>

        <div className="bom-title">Tax Invoice</div>

        <div className="bom-info-grid">
          <div>
            <span className="label">Bill To:</span>{" "}
            {inv.billing?.name || inv.billing?.company || "Client"}
          </div>
          <div>
            <span className="label">Date:</span> {currentDate}
          </div>
          <div>
            <span className="label">Company:</span>{" "}
            {inv.billing?.company || inv.billing?.name || "Company"}
          </div>
          <div>
            <span className="label">Invoice #:</span> {inv.invoice_number}
          </div>
          <div>
            <span className="label">Billing Address:</span>{" "}
            {inv.billing?.address || "—"}
          </div>
          <div>
            <span className="label">VAT No:</span> {inv.billing?.vat_no || "—"}
          </div>
        </div>

        {inv.invoice_type === "deposit" && (
          <div
            className="alert alert-warning"
            style={{ marginTop: "6px", fontSize: "0.9rem" }}
          >
            Deposit Invoice: {inv.percent_of_quote?.toFixed(0) || 50}% of
            Quotation {inv.quote_number}
          </div>
        )}
      </header>

      {/* Table body */}
      <main className="bom-printarea">
        <section className="bom-page">
          <div className="bom-content">
            <table className="bom-table">
              <thead className="bom-thead">
                <tr className="bom-thead-row">
                  <th style={{ width: "55%" }}>Description</th>
                  <th style={{ textAlign: "right" }}>Qty</th>
                  <th style={{ textAlign: "right" }}>Unit Price (excl)</th>
                  <th style={{ textAlign: "right" }}>Line Total (excl)</th>
                </tr>
              </thead>
              <tbody>
                {inv.items.map((it) => (
                  <tr className="bom-row" key={it.id}>
                    <td>{it.description}</td>
                    <td style={{ textAlign: "right" }}>{it.quantity}</td>
                    <td style={{ textAlign: "right" }}>
                      R{it.unit_price_excl_vat.toFixed(2)}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      R{it.line_total_excl_vat.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Totals / Terms / Banking blocks */}
            <div className="bom-inline-blocks">
              <div className="bom-totals">
                <div className="tot-row">
                  <div>Subtotal (excl VAT)</div>
                  <div>R{inv.subtotal_excl_vat.toFixed(2)}</div>
                </div>
                <div className="tot-row">
                  <div>VAT ({inv.vat_rate.toFixed(0)}%)</div>
                  <div>R{inv.vat_amount.toFixed(2)}</div>
                </div>
                <div className="tot-row tot-grand">
                  <div>Total (incl VAT)</div>
                  <div>R{inv.total_incl_vat.toFixed(2)}</div>
                </div>
                {inv.due_date && (
                  <div className="tot-row">
                    <div>Due Date</div>
                    <div>{new Date(inv.due_date).toLocaleDateString()}</div>
                  </div>
                )}
              </div>

              <div className="bom-terms">
                <div className="terms-title">Terms</div>
                <div className="terms-body">
                  {inv.invoice_type === "deposit"
                    ? "50% payable upfront to commence works. Balance invoiced upon completion."
                    : "Final payment due on completion handover."}
                </div>
              </div>

              <div className="bom-banking">
                <div className="banking-title">Banking Details</div>
                <div className="banking-body">
                  <div>Orka Solar (Pty) Ltd</div>
                  <div>Bank: Standard Bank</div>
                  <div>Account: 123456789</div>
                  <div>Branch: 051001</div>
                  <div>Reference: {inv.invoice_number}</div>
                </div>
              </div>
            </div>
          </div>
          {/* (Optional) footer like BOM if you want */}
        </section>
      </main>
    </div>
  );
}
