import React from "react";
import logo from "../../assets/orka_logo_transparent_background.png";
import sitePhoto from "../../assets/site_photo.png";

import pvIcon from "../../assets/icon_pv.svg";
import inverterIcon from "../../assets/icon_inverter.svg";
import batteryIcon from "../../assets/icon_battery.svg";
import costIcon from "../../assets/icon_cost.svg";
import savingsIcon from "../../assets/icon_savings.svg";

import "../../ReportBuilder.css";

function ExecutiveSummary({ data }) {
  const project = data?.project || {
    name: "Rutherfords – Grid Tied Solar PV Solution",
    system_type: "grid",
    pv_kwp: 32.2,
    num_panels: 57,
    inverter_total: 50,
    inverter_hybrid: 0,
    inverter_grid: 50,
    battery_chem: "LiFePO₄",
    battery_kwh_100: 0,
    battery_kwh_80: 0,
    capex: 465527,
    capex_after_tax: 339835,
    tax_deduction: 125692,
    savings_year1: 107676,
    yield_year1: 23,
    payback: 3.8,
    lcoe_25y: 0.74,
    photo_credit: "Orka Solar\nHospital in Potchefstroom\n280 kWp, 260 kVA inverters",
    page_number: "Page 2 of 24"
  };

  let typeText = "";
  if (project.system_type === "grid") {
    typeText = "grid tied solar PV solution";
  } else if (project.system_type === "hybrid") {
    typeText = "hybrid solar and battery backup system";
  } else if (project.system_type === "off-grid") {
    typeText = "off-grid solar and battery solution";
  }

  const summary1 = `Orka Solar is pleased to respond to the request for ${typeText}.`;

  return (
    <section className="orka-exec-summary-page">
      {/* Top bar */}
      <div className="orka-summary-headerbar">
        <div className="orka-summary-project">{project.name}</div>
        <img className="orka-summary-logo" src={logo} alt="Orka Solar Logo" />
      </div>
      <hr className="orka-summary-topline" />

      {/* Title & paragraphs */}
      <h2 className="orka-summary-title">EXECUTIVE SUMMARY</h2>
      <div className="orka-summary-paragraphs">
        <p>{summary1}</p>
        <p>
          The proposal is in the form of a full turn key solution. All Engineering, Procurement and Construction (EPC) will be handled by Orka Solar. The client will own the system outright and in return will benefit from the electrical power provided by the system, related cost and taxation benefits as well as meeting their carbon reduction/green energy goals.
        </p>
        <p>
          Orka Solar made use of actual electrical consumption data of this site in the design of this system.
        </p>
        <p>
          The details of the proposal are discussed in this document, with the key figures summarised below:
        </p>
      </div>

      {/* Icon summary rows */}
      <div className="orka-summary-icons-row1">
        <div className="orka-summary-icon-col">
          <img src={pvIcon} className="orka-summary-icon" alt="" />
          <div className="orka-summary-label">Solar PV</div>
          <div className="orka-summary-value">{project.pv_kwp} <span className="orka-summary-unit">kWp</span></div>
          <div className="orka-summary-sublabel">{project.num_panels} panels</div>
        </div>
        <div className="orka-summary-icon-col">
          <img src={inverterIcon} className="orka-summary-icon" alt="" />
          <div className="orka-summary-label">Inverters</div>
          <div className="orka-summary-value">Total {project.inverter_total} <span className="orka-summary-unit">kVA</span></div>
          <div className="orka-summary-sublabel">
            Hybrid {project.inverter_hybrid} <span className="orka-summary-unit">kVA</span><br />
            Grid {project.inverter_grid} <span className="orka-summary-unit">kVA</span>
          </div>
        </div>
        <div className="orka-summary-icon-col">
          <img src={batteryIcon} className="orka-summary-icon" alt="" />
          <div className="orka-summary-label">Backup</div>
          <div className="orka-summary-sublabel">Chemistry: {project.battery_chem}</div>
          <div className="orka-summary-sublabel">{project.battery_kwh_100} kWh @ 100%</div>
          <div className="orka-summary-sublabel">{project.battery_kwh_80} kWh @ 80%</div>
        </div>
      </div>
      <div className="orka-summary-icons-row2">
        <div className="orka-summary-icon-col orka-summary-icon-col-wide">
          <img src={costIcon} className="orka-summary-icon" alt="" />
          <div className="orka-summary-label">Cost</div>
          <div className="orka-summary-value">R {project.capex.toLocaleString()} <span className="orka-summary-unit">(excl VAT)</span></div>
          <div className="orka-summary-sublabel">Effective cost after tax incentive: R {project.capex_after_tax.toLocaleString()}</div>
          <div className="orka-summary-sublabel">Tax deduction: R {project.tax_deduction.toLocaleString()}</div>
        </div>
        <div className="orka-summary-icon-col orka-summary-icon-col-wide">
          <img src={savingsIcon} className="orka-summary-icon" alt="" />
          <div className="orka-summary-label">Savings</div>
          <div className="orka-summary-sublabel">Savings year 1: R {project.savings_year1.toLocaleString()}</div>
          <div className="orka-summary-sublabel">First year yield: {project.yield_year1}%</div>
          <div className="orka-summary-sublabel">Payback (years): {project.payback}</div>
          <div className="orka-summary-sublabel">LCOE (25y): R {project.lcoe_25y}</div>
        </div>
      </div>

      {/* Footnote */}
      <div className="orka-summary-footnote">
        *Tax incentive available to companies, 100% deduction
      </div>

      {/* Full-width site photo as page background */}
      <div className="orka-summary-sitephoto-fullwrap">
        <img className="orka-summary-sitephoto-full" src={sitePhoto} alt="Site Photo" />
        <div className="orka-summary-pagenum">{project.page_number}</div>
        <div className="orka-summary-photocredit">{project.photo_credit}</div>
      </div>
    </section>
  );
}

export default ExecutiveSummary;
