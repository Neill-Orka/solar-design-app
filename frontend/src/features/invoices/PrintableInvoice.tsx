import React, { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { getInvoice, getProject, getJobCard } from "./api";
import logo from "../../assets/orka_logo_text.png";
import "../../PrintableBOM.css";
import { Button, Spinner } from "react-bootstrap";
import { useAuth } from "../../AuthContext";

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

type RowData = {
  type: "item";
  item: InvoiceItem;
};

export default function PrintableInvoice() {
  const { invoiceId } = useParams<{ invoiceId: string }>();
  const [inv, setInv] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const [project, setProject] = useState<{ name: string } | null>(null);

  // Get the 'from' parameter to determine where to navigate back to
  const fromParam = searchParams.get("from");
  const projectId = searchParams.get("projectId");

  // Check if we should auto-download
  const shouldAutoDownload = searchParams.get("action") === "download";

  useEffect(() => {
    if (!invoiceId) return;

    setLoading(true);
    getInvoice(Number(invoiceId))
      .then((data) => {
        setInv(data);

        // If we have a projectId, fetch project details
        if (data.project_id) {
          getProject(data.project_id)
            .then((projectData) => {
              setProject(projectData);
              console.log("Loaded project: ", projectData);
            })
            .catch((err) => {
              console.error("Failed to load project: ", err);
            });
        }

        // If we have a job card ID, fetch job card details
        else if (data.job_card_id) {
          getJobCard(data.job_card_id)
            .then((jobCardData) => {
              // Store job card title in the project state for simplicity
              setProject({ name: jobCardData.title || "Job Card" });
              console.log("Loaded job card: ", jobCardData);
            })
            .catch((err) => {
              console.error("Failed to load job card: ", err);
            });
        }

        setLoading(false);

        // Auto-download if requested
        if (shouldAutoDownload) {
          setTimeout(() => {
            window.print();
          }, 1000);
        }
      })
      .catch((error) => {
        console.error("Failed to load invoice:", error);
        setLoading(false);
      });
  }, [invoiceId, shouldAutoDownload]);

  // If we have a projectId, get the project details too

  const currentDate = useMemo(() => {
    return new Date(inv?.issue_date || Date.now()).toLocaleDateString("en-GB");
  }, [inv]);

  const handleBack = () => {
    if (fromParam === "projects" && projectId) {
      navigate(`/projects/${projectId}?tab=invoices`);
    } else if (projectId) {
      navigate(`/projects/${projectId}`);
    } else {
      navigate("/invoices");
    }
  };

  const [termsPerc, setTermsPerc] = useState(() => {
    const saved = localStorage.getItem(`bomTermsPerc_${projectId}`);
    return saved ? JSON.parse(saved) : [65, 25, 10];
  });

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("en-ZA", {
      style: "currency",
      currency: "ZAR",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
      .format(value || 0)
      .replace("R", "R ")
      .replace(/,/g, " "); // Replace commas with spaces for thousands

  // ----- Pagination constants (keep in sync with CSS) -----
  const CM_TO_PX = 37.79527559;
  const PAGE_HEIGHT_CM = 29.7;
  const HEADER_HEIGHT_CM = 7.3; // .bom-header height
  const FOOTER_HEIGHT_CM = 0.7; // .bom-footer height
  const CONTENT_TOP_PADDING_CM = 0;
  const COLUMN_HEADER_HEIGHT_CM = 1.25; // .bom-thead-row height
  const ROW_HEIGHT_CM = 0.75; // .bom-row height

  // Safety margin to avoid print rounding causing overflow
  const SAFETY_CM = 0.02;
  const HEADROOM_CM = 0.4;

  const CONTENT_HEIGHT_PX =
    (PAGE_HEIGHT_CM -
      HEADER_HEIGHT_CM -
      FOOTER_HEIGHT_CM -
      CONTENT_TOP_PADDING_CM) *
    CM_TO_PX;
  const ROW_HEIGHT_PX = (ROW_HEIGHT_CM + SAFETY_CM) * CM_TO_PX;
  const COL_HEADER_HEIGHT_PX = (COLUMN_HEADER_HEIGHT_CM + SAFETY_CM) * CM_TO_PX;
  const TOTALS_MIN_HEIGHT_CM = 8.0;
  const TOTALS_MIN_HEIGHT_PX = (TOTALS_MIN_HEIGHT_CM + SAFETY_CM) * CM_TO_PX;
  const HEADROOM_PX = HEADROOM_CM * CM_TO_PX;

  const H_TOT_CM = 3.0; // Totals section height
  const H_TERM_CM = 3.0; // Terms section height
  const H_BANK_CM = 4.2; // Banking section height
  const BLOCK_GAP_CM = 0.3;

  const H_TOT_PX = (H_TOT_CM + SAFETY_CM) * CM_TO_PX;
  const H_TERM_PX = (H_TERM_CM + SAFETY_CM) * CM_TO_PX;
  const H_BANK_PX = (H_BANK_CM + SAFETY_CM) * CM_TO_PX;
  const BLOCK_GAP_PX = BLOCK_GAP_CM * CM_TO_PX;

  // Flatten invoice items into renderable rows with known heights
  const rows = useMemo(() => {
    if (!inv?.items) return [];

    return inv.items.map((item) => ({
      type: "item" as const,
      item,
    }));
  }, [inv?.items]);

  // Calculate how many rows fit per page
  const ROWS_PER_PAGE = Math.floor(
    (CONTENT_HEIGHT_PX - COL_HEADER_HEIGHT_PX) / ROW_HEIGHT_PX
  );

  // Split rows into pages
  const pages = useMemo(() => {
    if (!rows.length) return [[]];

    const result = [];
    let current = [];
    let remaining = CONTENT_HEIGHT_PX - COL_HEADER_HEIGHT_PX;

    // Helper function to push the current page and start a new one
    const pushPage = () => {
      if (current.length) {
        result.push([...current]);
        current = [];
        remaining = CONTENT_HEIGHT_PX - COL_HEADER_HEIGHT_PX;
      }
    };

    rows.forEach((row) => {
      const rowHeight = ROW_HEIGHT_PX;

      // If this row won't fit on the current page, start a new page
      if (rowHeight > remaining) {
        pushPage();
      }

      current.push(row);
      remaining -= rowHeight;
    });

    // Add any remaining rows to the last page
    if (current.length) {
      result.push(current);
    }

    return result;
  }, [rows, CONTENT_HEIGHT_PX, COL_HEADER_HEIGHT_PX, ROW_HEIGHT_PX]);

  // Calculate remaining space on the last page
  const lastPageRemainingPx = useMemo(() => {
    if (!pages.length) return CONTENT_HEIGHT_PX - COL_HEADER_HEIGHT_PX;

    const last = pages[pages.length - 1];
    const usedRowsPx = last.reduce(() => ROW_HEIGHT_PX, 0) * last.length;
    return CONTENT_HEIGHT_PX - (COL_HEADER_HEIGHT_PX + usedRowsPx);
  }, [pages, CONTENT_HEIGHT_PX, COL_HEADER_HEIGHT_PX, ROW_HEIGHT_PX]);

  // Determine if totals/terms/banking blocks fit on the last page or need separate pages
  const totalsPlacement = useMemo(() => {
    const blocks = [
      { key: "totals", h: H_TOT_PX },
      { key: "terms", h: H_TERM_PX },
      { key: "banking", h: H_BANK_PX },
    ];

    // Keys for blocks that fit on the last page
    const inlineKeys = [];
    // Keys for blocks that need to go to new pages
    const carryKeys = [];

    let rem = lastPageRemainingPx - HEADROOM_PX; // Leave some headroom

    for (const b of blocks) {
      if (b.h + (inlineKeys.length ? BLOCK_GAP_PX : 0) <= rem) {
        inlineKeys.push(b.key);
        rem -= b.h + BLOCK_GAP_PX;
      } else {
        carryKeys.push(b.key);
      }
    }

    return { inlineKeys, carryKeys };
  }, [
    lastPageRemainingPx,
    H_TOT_PX,
    H_TERM_PX,
    H_BANK_PX,
    BLOCK_GAP_PX,
    HEADROOM_PX,
  ]);

  // Group carried blocks into pages
  const carryPages = useMemo(() => {
    if (!totalsPlacement.carryKeys.length) return [];

    const h = { totals: H_TOT_PX, terms: H_TERM_PX, banking: H_BANK_PX };
    const pagesArr = [];
    let page = [];
    let rem = CONTENT_HEIGHT_PX;

    for (const key of totalsPlacement.carryKeys) {
      if (h[key] + (page.length ? BLOCK_GAP_PX : 0) <= rem) {
        page.push(key);
        rem -= h[key] + BLOCK_GAP_PX;
      } else {
        if (page.length) pagesArr.push([...page]);
        page = [key];
        rem = CONTENT_HEIGHT_PX - h[key];
      }
    }

    if (page.length) pagesArr.push(page);
    return pagesArr;
  }, [
    totalsPlacement,
    CONTENT_HEIGHT_PX,
    H_TOT_PX,
    H_TERM_PX,
    H_BANK_PX,
    BLOCK_GAP_PX,
  ]);

  // Combine rows and totals pages
  const pagesWithKinds = useMemo(() => {
    const base = pages.map((p) => ({ kind: "rows" as const, rows: p }));

    carryPages.forEach((blocks) =>
      base.push({
        kind: "totals" as const,
        blocks,
      })
    );

    return base;
  }, [pages, carryPages]);

  const totalPages = pagesWithKinds.length;

  const renderHeader = () => (
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
      <div className="bom-title">{"Tax Invoice"}</div>
      <div className="bom-info-grid">
        <div>
          <span className="label">For attention:</span>{" "}
          {inv?.billing?.name || "Client Name"}
        </div>
        <div>
          <span className="label">Date:</span> {currentDate}
        </div>
        <div>
          <span className="label">Company:</span>{" "}
          {inv?.billing?.company || "Company Name"}
        </div>
        <div>
          <span className="label">Invoice #:</span>{" "}
          {inv?.invoice_number || "INV-0000"}
        </div>
        <div>
          <span className="label">Address:</span>{" "}
          {inv?.billing?.address || "Address"}
        </div>
        <div>
          <span className="label">Contact Person:</span>{" "}
          {user?.first_name || "Lourens"} {user?.last_name || "de Jongh"}
        </div>
        <div>
          <span className="label">Tel:</span> {user?.phone || "-"}
        </div>
        <div>
          <span className="label">Tel:</span> {user?.phone || "082 660 0851"}
        </div>
        <div>
          <span className="label">VAT No:</span> {inv?.billing?.vat_no || "-"}
        </div>
        <div>
          <span className="label">Email:</span>{" "}
          {user?.email || "lourens@orkasolar.co.za"}
        </div>
        <div />
      </div>
      <div className="bom-project-strip">
        {project?.name || "Invoice"}
        {/* {(() => {
          // This is if we have the project_id (so it is a quoted project)
          const name = inv?.project_id?.name || "Job Card Title";

          // const inverter = projectData?.inverter_brand_model;
          // const battery = projectData?.battery_brand_model;

          // let details = "";
          // if (inverter && battery) {
          //   details = ` - ${inverter} & ${battery}`;
          // } else if (inverter) {
          //   details = ` - ${inverter}`;
          // } else if (battery) {
          //   details = ` - ${battery}`;
          // }

          // return `${name}${details}`;
          return `${name}`;
        })()} */}
      </div>
    </header>
  );

  const TotalsBlock = () => {
    const vatPerc = Number(inv?.vat_rate ?? 15);

    return (
      <section className="bom-block bom-block-totals">
        <div className="bom-totals">
          <div className="rule" />
          <div className="row">
            <div className="label">Total (excl. VAT)</div>
            <div className="value">
              {formatCurrency(inv?.subtotal_excl_vat || 0)}
            </div>
          </div>
          <div className="row">
            <div className="label">{vatPerc}% VAT</div>
            <div className="value">{formatCurrency(inv?.vat_amount || 0)}</div>
          </div>
          <div className="rule" />
          <div className="row grand">
            <div className="label">Total (incl. VAT)</div>
            <div className="value">
              {formatCurrency(inv?.total_incl_vat || 0)}
            </div>
          </div>
          <div className="rule double" />
        </div>
      </section>
    );
  };

  // const TermsBlock = () => (
  //   <div className="bom-block" style={{ marginTop: "20px" }}>
  //     <div className="bom-terms" style={{ flex: "1" }}>
  //       <div
  //         className="terms-title"
  //         style={{ fontWeight: "bold", marginBottom: "4px" }}
  //       >
  //         Terms
  //       </div>
  //       <div className="terms-body">
  //         {inv?.invoice_type === "deposit"
  //           ? "50% payable upfront to commence works. Balance invoiced upon completion."
  //           : "Final payment due on completion handover."}
  //       </div>
  //     </div>
  //   </div>
  // );

  const TermsBlock = () => {
    const totalIncl = inv?.total_incl_vat || 0;
    const [p0, p1, p2] = termsPerc.map((n: number) => +n || 0);
    const amt = (p: number) => formatCurrency(totalIncl * (p / 100));

    return (
      <section className="bom-block bom-block-termsdeposit">
        <div className="bom-terms">
          <p style={{ margin: "5px 0", fontWeight: 700 }}>
            Please note that a {p0}% deposit will be required before Orka Solar
            will commence with any work.
          </p>
        </div>

        <table
          className="bom-table bom-terms-table"
          style={{ marginTop: "6px" }}
        >
          <colgroup>
            <col className="col-desc" />
            <col className="col-perc" />
            <col className="col-flex" />
            <col className="col-amount" />
            <col className="col-incl" />
          </colgroup>
          <tbody>
            <tr className="bom-row-terms">
              <td className="bom-cell-terms">Deposit</td>
              <td className="bom-cell-terms">{p0}%</td>
              <td className="bom-cell-terms"></td>
              <td className="bom-cell-terms amount">{amt(p0)}</td>
              <td className="bom-cell-terms incl">
                <span>Incl. VAT</span>
              </td>
            </tr>

            <tr className="bom-row-terms">
              <td className="bom-cell-terms">
                On delivery of inverters and panels to site
              </td>
              <td className="bom-cell-terms">{p1}%</td>
              <td className="bom-cell-terms"></td>
              <td className="bom-cell-terms amount">{amt(p1)}</td>
              <td className="bom-cell-terms incl">
                <span>Incl. VAT</span>
              </td>
            </tr>

            <tr className="bom-row-terms">
              <td className="bom-cell-terms">On project completion</td>
              <td className="bom-cell-terms">{p2}%</td>
              <td className="bom-cell-terms"></td>
              <td className="bom-cell-terms amount">{amt(p2)}</td>
              <td className="bom-cell-terms incl">
                <span>Incl. VAT</span>
              </td>
            </tr>

            <tr className="bom-row-terms grand">
              <td className="bom-cell-terms" colSpan={3}></td>
              <td className="bom-cell-terms amount total-amount">
                {formatCurrency(totalIncl)}
              </td>
              <td className="bom-cell-terms incl">
                <span>Incl. VAT</span>
              </td>
            </tr>
          </tbody>
        </table>
      </section>
    );
  };

  // const BankingBlock = () => (
  //   <div className="bom-block" style={{ marginTop: "20px" }}>
  //     <div className="bom-banking" style={{ flex: "1" }}>
  //       <div
  //         className="banking-title"
  //         style={{ fontWeight: "bold", marginBottom: "4px" }}
  //       >
  //         Banking Details
  //       </div>
  //       <div className="banking-body">
  //         <div>Orka Solar (Pty) Ltd</div>
  //         <div>Bank: Standard Bank</div>
  //         <div>Account: 123456789</div>
  //         <div>Branch: 051001</div>
  //         <div>Reference: {inv?.invoice_number}</div>
  //       </div>
  //     </div>
  //   </div>
  // );

  const BankingBlock = () => (
    <section className="bom-block bom-block-bankingaccept">
      <div className="bom-two-col">
        <div className="bom-box" style={{ fontSize: "12px" }}>
          <div
            style={{
              fontWeight: 700,
              borderBottom: "1px solid #000",
              paddingBottom: 4,
              marginBottom: 4,
            }}
          >
            Banking details:
          </div>
          <div>Company: Orka Solar (Pty) Ltd.</div>
          <div>Branch: ABSA Mooirivier Mall</div>
          <div>Account name: Orka Solar (PTY) Ltd</div>
          <div>Account type: Cheque</div>
          <div>Account number: 409 240 5135</div>
        </div>
      </div>
    </section>
  );

  if (loading) {
    return (
      <div
        className="d-flex align-items-center justify-content-center"
        style={{ height: "100vh" }}
      >
        <div className="text-center">
          <Spinner animation="border" variant="primary" />
          <p className="mt-3">Loading invoice...</p>
        </div>
      </div>
    );
  }

  if (!inv) {
    return (
      <div className="text-center p-5">
        <div className="alert alert-danger">
          Invoice not found or failed to load
        </div>
        <Button variant="secondary" onClick={handleBack}>
          Back
        </Button>
      </div>
    );
  }

  return (
    <div className="bom-report">
      {/* Navigation controls on the left */}
      <div
        className="no-print"
        style={{
          position: "fixed",
          left: "20px",
          top: "50%",
          transform: "translateY(-50%)",
          zIndex: 1000,
          display: "flex",
          flexDirection: "column",
          gap: "12px",
        }}
      >
        <Button
          variant="outline-secondary"
          size="sm"
          onClick={handleBack}
          style={{
            color: "#495057",
            borderColor: "#6c757d",
            backgroundColor: "white",
            boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
            border: "1px solid #dee2e6",
          }}
          title="Back"
        >
          <i className="bi bi-arrow-left"></i>
        </Button>
        <Button
          variant="primary"
          size="sm"
          onClick={() => window.print()}
          style={{
            backgroundColor: "#0d6efd",
            borderColor: "#0d6efd",
            color: "white",
            boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
          }}
          title="Print Invoice"
        >
          <i className="bi bi-printer"></i>
        </Button>
      </div>

      {/* Right side controls */}
      <div
        className="no-print"
        style={{
          position: "fixed",
          right: "20px",
          top: "50%",
          transform: "translateY(-50%)",
          zIndex: 1000,
          display: "flex",
          flexDirection: "column",
          gap: "12px",
        }}
      >
        <div
          style={{
            backgroundColor: "white",
            padding: "8px 12px",
            borderRadius: "6px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
            border: "1px solid #dee2e6",
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontSize: "0.75rem",
              color: "#6c757d",
              marginBottom: "4px",
            }}
          >
            Status
          </div>
          <span
            className={`badge bg-${
              inv.status === "paid"
                ? "success"
                : inv.status === "pending"
                  ? "warning"
                  : "secondary"
            }`}
          >
            {inv.status || "draft"}
          </span>
        </div>
      </div>

      <main className="bom-printarea">
        {pagesWithKinds.map((page, pageIndex) => (
          <section className="bom-page" key={pageIndex}>
            {renderHeader()}
            <div className="bom-content">
              {page.kind === "rows" && (
                <table className="bom-table">
                  <thead className="bom-thead">
                    <tr className="bom-thead-row">
                      <th className="bom-thead-cell bom-col-desc">
                        Description
                      </th>
                      <th
                        className="bom-thead-cell bom-col-units"
                        style={{ textAlign: "center" }}
                      >
                        Qty
                      </th>
                      <th
                        className="bom-thead-cell bom-col-unitprice"
                        style={{ textAlign: "right" }}
                      >
                        Unit Price (excl)
                      </th>
                      <th
                        className="bom-thead-cell bom-col-total"
                        style={{ textAlign: "right" }}
                      >
                        Line Total (excl)
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {page.rows.map((row, idx) => (
                      <tr className="bom-row" key={idx}>
                        <td className="bom-cell">{row.item.description}</td>
                        <td
                          className="bom-cell"
                          style={{ textAlign: "center" }}
                        >
                          {row.item.quantity}
                        </td>
                        <td className="bom-cell" style={{ textAlign: "right" }}>
                          R{row.item.unit_price_excl_vat.toFixed(2)}
                        </td>
                        <td className="bom-cell" style={{ textAlign: "right" }}>
                          R{row.item.line_total_excl_vat.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {/* Show totals on last rows page or dedicated totals page */}
              {page.kind === "rows" && pageIndex === pages.length - 1 && (
                <>
                  {totalsPlacement.inlineKeys.includes("totals") && (
                    <TotalsBlock />
                  )}
                  {totalsPlacement.inlineKeys.includes("terms") && (
                    <TermsBlock />
                  )}
                  {totalsPlacement.inlineKeys.includes("banking") && (
                    <BankingBlock />
                  )}
                </>
              )}

              {/* Show carried blocks on dedicated totals pages */}
              {page.kind === "totals" && (
                <>
                  {page.blocks.includes("totals") && <TotalsBlock />}
                  {page.blocks.includes("terms") && <TermsBlock />}
                  {page.blocks.includes("banking") && <BankingBlock />}
                </>
              )}
            </div>

            {/* <footer className="bom-footer">
              <div className="bom-page-number">
                Page {pageIndex + 1} of {totalPages}
              </div>
            </footer> */}
          </section>
        ))}
      </main>
    </div>
  );
}
