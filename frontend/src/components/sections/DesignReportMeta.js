import React from "react";
import logo from "../../assets/orka_logo_transparent_background.png";
import bannerBg from "../../assets/banner_solar_dark.png";
import signatureLB from "../../assets/signature_lb.png";

import "../../ReportBuilder.css";

function DesignReportMeta({ data }) {
  const project = data?.project || {
    name: "Rutherfords - Grid Tied Solar PV Solution",
    document_no: "250XX_Project Proposal",
    rev: 1,
    date: "12 March 2025",
    client: "Rutherfords - Cecil & Bryan Rutherford",
    project_no: "24001",
    preparation: "L. Botha",
    approver_role: "Engineer\nOrka Solar",
    approver: "L. Botha, B. Eng (Mech), Pr. Eng, CEM, PMP",
    approval_date: "12 March 2025",
    signature_img: signatureLB,
    copyright: "© Copyright 2021 by Orka Solar (Pty) Ltd. Trading as Orka Solar. The information in this document shall not be reproduced or disclosed to third parties without written authorisation of the Orka Solar client above.",
    amendment_history: [
      { rev: 1, date: "12 March 2025", detail: "Final released to client.", authors: "L. Botha and N. Tuck" }
    ],
    page_number: "Page 3 of 24"
  };

  return (
    <section className="orka-meta-page">
      {/* Top bar */}
      <div className="orka-summary-headerbar">
        <div className="orka-summary-project">{project.name}</div>
        <img className="orka-summary-logo" src={logo} alt="Orka Solar Logo" />
      </div>
      <hr className="orka-summary-topline" />

      {/* Wide banner */}
      <div className="orka-meta-banner" style={{ backgroundImage: `url(${bannerBg})` }}>
        <div className="orka-meta-banner-inner">
          <div className="orka-meta-banner-title">DESIGN REPORT AND COSTING</div>
          <div className="orka-meta-banner-subtitle">The project's design and costing report is detailed in the pages below.</div>
        </div>
      </div>

      {/* Document Meta Table */}
      <table className="orka-meta-table" cellSpacing={0}>
        <tbody>
          {/* Row 1: Document Title */}
          <tr>
            <td className="orka-meta-label">Document Title</td>
            <td colSpan={5}>{project.name}</td>
          </tr>
          {/* Row 2: Document No, Rev, Date */}
          <tr>
            <td className="orka-meta-label">Document No.</td>
            <td>{project.document_no}</td>
            <td className="orka-meta-label">Rev:</td>
            <td>{project.rev}</td>
            <td className="orka-meta-label">Date:</td>
            <td>{project.date}</td>
          </tr>
          {/* Row 3: Client */}
          <tr>
            <td className="orka-meta-label">Client</td>
            <td colSpan={5}>{project.client}</td>
          </tr>
          {/* Row 4: Project No, Preparation */}
          <tr>
            <td className="orka-meta-label">Orka Solar Project No.</td>
            <td>{project.project_no}</td>
            <td className="orka-meta-label">Preparation</td>
            <td colSpan={3}>{project.preparation}</td>
          </tr>
          {/* Row 5: Design review and approval */}
          <tr>
            <td className="orka-meta-label" rowSpan={2}>Design review and internal approval</td>
            <td colSpan={2} style={{ verticalAlign: "top" }}>
              <div style={{ whiteSpace: "pre-line", fontSize: "0.98rem" }}>
                {project.approver}<br />{project.approver_role}
              </div>
            </td>
            <td className="orka-meta-label" style={{ textAlign: "center" }}>Signature</td>
            <td className="orka-meta-label" style={{ textAlign: "center" }}>Date</td>
            <td></td>
          </tr>
          <tr>
            <td colSpan={2}></td>
            <td style={{ textAlign: "center" }}>
              <img src={signatureLB} alt="Signature" className="orka-meta-signature" />
            </td>
            <td style={{ textAlign: "center" }}>
              {project.approval_date}
            </td>
            <td></td>
          </tr>
        </tbody>
      </table>

      {/* Copyright */}
      <div className="orka-meta-copyright">
        {project.copyright}
      </div>

      {/* Amendment Table */}
      <table className="orka-meta-table orka-meta-amendments" cellSpacing={0}>
        <thead>
          <tr>
            <th>Rev</th>
            <th>Date</th>
            <th>Amendment Details</th>
            <th>Author(s)</th>
          </tr>
        </thead>
        <tbody>
          {(project.amendment_history || []).map((row, i) => (
            <tr key={i}>
              <td>{row.rev}</td>
              <td>{row.date}</td>
              <td>{row.detail}</td>
              <td>{row.authors}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Footer */}
      <div className="orka-meta-footer-pagenum">{project.page_number}</div>
    </section>
  );
}

export default DesignReportMeta;
