import React from "react";
import logo from "../../assets/OrkaLogoWithText.png";
import panelBg from "../../assets/solar_panel_bg.png";
import { useAuth } from "../../AuthContext"

import "../../ReportBuilder.css";

function CoverPage({ data }) {
    const { user } = useAuth();
  // Helper function to safely display JSON fields
  const displayValue = (value, fallback, field = "") => {
    if (value === undefined || value === null) return fallback;

    if (typeof value === 'object') {
      // If it's an object, try to extract capacity or return the first value
      if (field === "battery_kwh" && value.capacity && value.quantity) {
        const total = value.capacity * value.quantity;
        return total.toString();
      }

      if (value.capacity && value.quantity) {
        return `${value.capacity * value.quantity}`;
      }

      return value.capacity || value.quantity || Object.values(value)[0] || fallback;
    }
    return value;
  };

  const project = data?.project || {
    name: "Toets Solar PV Solution",
    id: "24108_Proposal",
    description: "Design Report and Costing for grid tied solar PV supply solution",
    inverter_kva: "50",
    battery_kwh: "0",
    panel_kw: "32.1",
    load_shedding: "0",
    owner: "Rutherfords",
    version: "Final",
    compiled_by: "L. Botha",
    created_at: "2025-03-12T00:00:00Z",
    client_name: "Cecil & Bryan Rutherford",
  };
  
  // const dateStr = project.created_at
  //   ? new Date(project.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" })
  //   : "12 March 2025";

  const dateStr = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });

  return (
    <section className="orka-reference-cover">
      {/* solar panel bg as watermark */}
      <img className="orka-cover-bgimg" src={panelBg} alt="" />
      {/* logo top right */}
      <img className="orka-cover-logo-topright" src={logo} alt="Orka Solar Logo" />
      {/* main text block */}
      <div className="orka-cover-centerblock">
        <div className="orka-cover-mainheading">Design Report and Costing</div>
        <div className="orka-cover-proposalno">Proposal_270825_{project.id}</div>
        <hr className="orka-cover-line" />
        <div className="orka-cover-projectname">{project.name}</div>
        <div className="orka-cover-specblock">
          <span>Inverting: <b>{displayValue(project.inverter_kva, "50", "inverter_kva")} kVA</b></span><br />
          <span>ESS: <b>{project.battery_nominal_rating} kWh</b></span><br />
          <span>PV: <b>{displayValue(project.panel_kw, "32.1", "panel_kw")} kWp</b></span><br />
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
          Compiled by: {displayValue(user.full_name, "Orka Solar")}
        </div>
      </div>
    </section>
  );
}

export default CoverPage;
