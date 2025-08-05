import React from "react";
import '../../ReportBuilder.css';
import logo from "../../assets/orka_logo_transparent_background.png";

function StandardPage({ header, children, footer, className = "", data, pageNumber, totalPages = 24 }) {
    const project = data?.project || { name: header || "Project Report" };

    
    return (
        <section className={`orka-standard-page ${className}`}>
            {/* Header */}
            <div className="orka-summary-headerbar">
                <div className="orka-summary-project">{project.name}</div>
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