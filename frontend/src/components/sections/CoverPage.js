import React from "react";
import logo from "../../assets/orka_logo_transparent_background.png";
import panelBg from "../../assets/solar_panel_bg.png";

import "../../ReportBuilder.css";

function CoverPage({ data }) {
  // Helper function to safely display JSON fields
  const displayValue = (value, fallback) => {
    if (value === undefined || value === null) return fallback;
    if (typeof value === 'object') {
      // If it's an object, try to extract capacity or return the first value
      return value.capacity || Object.values(value)[0] || fallback;
    }
    return value;
  };

  const project = data?.project || {
    name: "Toets Solar PV Solution",
    id: "24108_Proposal",
    description: "Design Report and Costing for grid tied solar PV supply solution",
    inverter_kva: "50",
    ess_kwh: "0",
    pv_kwp: "32.1",
    load_shedding: "0",
    owner: "Rutherfords",
    version: "Final",
    compiled_by: "L. Botha",
    created_at: "2025-03-12T00:00:00Z",
    client_name: "Cecil & Bryan Rutherford",
  };
  
  const dateStr = project.created_at
    ? new Date(project.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" })
    : "12 March 2025";

  return (
    <section className="orka-reference-cover">
      {/* solar panel bg as watermark */}
      <img className="orka-cover-bgimg" src={panelBg} alt="" />
      {/* logo top right */}
      <img className="orka-cover-logo-topright" src={logo} alt="Orka Solar Logo" />
      {/* main text block */}
      <div className="orka-cover-centerblock">
        <div className="orka-cover-mainheading">Design Report and Costing</div>
        <div className="orka-cover-proposalno">{project.id}</div>
        <div className="orka-cover-projectname">{project.name}</div>
        <hr className="orka-cover-line" />
        <div className="orka-cover-specblock">
          <span>Inverting: <b>{displayValue(project.inverter_kva, "50")} kVA</b></span><br />
          <span>ESS: <b>{displayValue(project.battery_kwh, "0")} kWh</b></span><br />
          <span>PV: <b>{displayValue(project.panel_kw, "32.1")} kWp</b></span><br />
          <span>Load Shedding Scenario: <b>{displayValue(project.load_shedding, "0")}</b></span>
        </div>
        <hr className="orka-cover-line" />
        <div className="orka-cover-description">
          {project.description}
        </div>
      </div>
      {/* footer */}
      <div className="orka-cover-footerblock">
        <div className="orka-cover-date">{dateStr}</div>
        <div className="orka-cover-preparedfor">
          Prepared for: {displayValue(project.client_name, "Client")}<br />
          Project Owner: {displayValue(project.client_name, "Owner")}<br />
          Document version: {displayValue(project.version, "1.0")}<br />
          Compiled by: {displayValue(project.compiled_by, "Orka Solar")}
        </div>
      </div>
    </section>
  );
}

export default CoverPage;
