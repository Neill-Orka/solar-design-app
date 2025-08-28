import React from "react";
import '../../ReportBuilder.css';
import logo from "../../assets/orka_logo_transparent_background.png";

function StandardPage({ header, children, footer, className = "", data, pageNumber, totalPages = 24 }) {
    const project = data?.project || { name: header || "Project Report" };

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
    
    return (
        <section className={`orka-standard-page ${className}`}>
            {/* Header */}
            <div className="orka-summary-headerbar">
                <div className="orka-summary-project">{project.name} - {displayValue(project.inverter_kva, "0", "inverter_kva")} kVA & {displayValue(project.battery_kwh, "0", "battery_kwh") / 0.8} kWh</div>
                <img className="orka-summary-logo" src={logo} alt="Orka Solar Logo" />
            </div>
            <hr className="orka-summary-topline" />
            
            {/* Content */}
            <div className="orka-page-content">{children}</div>
            
            {/* Footer with page number */}
            <footer className="orka-page-footer">
                {pageNumber && (
                    <>
                        <hr className="orka-page-footer-line" />
                        <div className="orka-page-number">Page {pageNumber} of {totalPages}</div>
                    </>
                )}
                {footer && <div className="orka-page-footer-text">{footer}</div>}
            </footer>
        </section>
    );
}

export default StandardPage;