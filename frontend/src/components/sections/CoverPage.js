import React from "react";
import logo from "../../assets/orka_logo_transparent_background.png";
import panelBg from "../../assets/solar_panel_bg.png"; // Use your own semi-transparent panel background

import "../../ReportBuilder.css";

function CoverPage({ data }) {
  // Fallback/test values if no data passed
  const client = data?.client || {
    client_name: "Cecil & Bryan Rutherford",
    address: "123 Some Street, City",
  };
  const project = data?.project || {
    name: "Rutherfords - Grid Tied Solar PV Solution",
    id: "24108_Proposal",
    description: "Design Report and Costing for grid tied solar PV supply solution",
    inverter_kva: "50",
    ess_kwh: "0",
    pv_kwp: "32.2",
    load_shedding: "0",
    owner: "Rutherfords",
    version: "Final",
    compiled_by: "L. Botha",
    created_at: "2025-03-12T00:00:00Z"
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
          <span>Inverting: <b>{project.inverter_kva} kVA</b></span><br />
          <span>ESS: <b>{project.ess_kwh} kWh</b></span><br />
          <span>PV: <b>{project.pv_kwp} kWp</b></span><br />
          <span>Load Shedding Scenario: <b>{project.load_shedding}</b></span>
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
          Prepared for: {client.client_name}<br />
          Project Owner: {project.owner}<br />
          Document version: {project.version}<br />
          Compiled by: {project.compiled_by}
        </div>
      </div>
    </section>
  );
}

export default CoverPage;
