import React from "react";
import logo from "../../assets/orka_logo_transparent_background.png";
import "../../ReportBuilder.css";

function roman(n) {
  // Simple Roman numerals up to 20 for TOC
  const arr = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X",
    "XI", "XII", "XIII", "XIV", "XV", "XVI", "XVII", "XVIII", "XIX", "XX"];
  return arr[n - 1] || n;
}

function TableOfContents({ data }) {
  // Fallback/sample dynamic TOC structure
  const toc = data?.toc || [
    { title: "EXECUTIVE SUMMARY", page: "II" },
    { title: "DESIGN REPORT AND COSTING", page: "II" },
    { title: "1  SITE INFORMATION", page: 6 },
    { title: "2  GENERAL SITE LAYOUT", page: 6 },
    { title: "3  PROJECT GOAL", page: 7 },
    { title: "3.1  CURRENT LOAD PROFILE AND ELECTRICAL CONSUMPTION", page: 7, isSub: true },
    { title: "4  SYSTEM DESIGN", page: 11 },
    { title: "4.1  METEOROLOGICAL DATA", page: 11, isSub: true },
    { title: "5  SYSTEM'S TECHNICAL & FINANCIAL INFORMATION", page: 12 },
    { title: "5.1.1  Installed capacity and simulated yield", page: 12, isSub: true },
    { title: "5.1.2  Energy Production", page: 13, isSub: true },
    { title: "5.1.3  Simulated profiles", page: 14, isSub: true },
    { title: "5.1.4  Financial Information", page: 14, isSub: true },
    { title: "6  SCOPE OF WORK", page: 17 },
    { title: "6.1  MAJOR EQUIPMENT LIST", page: 17, isSub: true },
    { title: "7  QUALITY AND WARRANTY", page: 17 },
    { title: "8  TERMS OF SERVICE", page: 18 },
    { title: "9  PROJECT SCHEDULE", page: 18 },
    { title: "10  STANDARDS AND REGULATIONS", page: 18 },
    { title: "11  NOTABLE POINTS", page: 19 },
    { title: "ANNEXURE A  BILL OF MATERIALS", page: 20, isAnnex: true },
    { title: "ANNEXURE B  ASSUMPTIONS AFFECTING FINANCIAL METRICS", page: 22, isAnnex: true },
    { title: "ANNEXURE C  PERFORMANCE GUARANTEE", page: 23, isAnnex: true },
    { title: "ANNEXURE D  25 YEAR SOLAR PV PRODUCTION FORECAST", page: 24, isAnnex: true },
    { title: "ANNEXURE E  SHADE ANALYSIS", page: 25, isAnnex: true },
    { title: "ANNEXURE F  CONDUCTOR SCHEDULE (DRAFT)", page: 26, isAnnex: true },
  ];

  // Roman numeral logic for first two entries
  const formatPage = (n, idx) => (idx < 2 ? roman(idx + 1) : n);

  // Page meta
  const project = data?.project || {
    name: "TSES Injection Moulding - Hybrid ESS Solar PV Solution"
  };

  return (
    <section className="orka-toc-page">
      {/* Top bar */}
      <div className="orka-summary-headerbar">
        <div className="orka-summary-project">{project.name}</div>
        <img className="orka-summary-logo" src={logo} alt="Orka Solar Logo" />
      </div>
      <hr className="orka-summary-topline" />

      {/* TOC title */}
      <div className="orka-toc-title">TABLE OF CONTENT</div>
      
      <div className="orka-toc-list">
        {toc.map((item, i) => (
          <div
            key={i}
            className={
              "orka-toc-entry" +
              (item.isSub ? " orka-toc-sub" : "") +
              (item.isAnnex ? " orka-toc-annex" : "")
            }
          >
            <span className="orka-toc-label">{item.title}</span>
            <span className="orka-toc-dots">
              ............................................................................................................................................
            </span>
            <span className="orka-toc-page">{formatPage(item.page, i)}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

export default TableOfContents;
