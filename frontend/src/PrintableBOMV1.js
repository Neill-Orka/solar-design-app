
import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import logo from './assets/orka_logo_transparent_background.png';
import './PrintableBOM.css';

/**
 * PrintableBOM (paginated)
 * - Renders fixed-size A4 pages with a repeated header & footer
 * - Pre-paginates BOM rows so you can SEE page layout before printing
 * - Does not rely on browser table header repetition
 */
function PrintableBOM() {
  const navigate = useNavigate();

  // Retrieve data from localStorage (set in BillOfMaterials.js)
  const bomData = JSON.parse(localStorage.getItem('printBomData') || '{}');
  const currentDate = new Date().toLocaleDateString('en-ZA');

  const formatCurrency = (value) =>
    new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value || 0).replace('R', 'R ');

  // ----- Pagination constants (keep in sync with CSS) -----
  const CM_TO_PX = 37.79527559;
  const PAGE_HEIGHT_CM = 29.7;
  const HEADER_HEIGHT_CM = 6.8;     // .bom-header height
  const FOOTER_HEIGHT_CM = 0.7;     // .bom-footer height
  const CONTENT_TOP_PADDING_CM = 0.2;
  const COLUMN_HEADER_HEIGHT_CM = 1.0; // .bom-thead-row height
  const ROW_HEIGHT_CM = 0.78;         // .bom-row height
  const CAT_ROW_HEIGHT_CM = 0.78;     // .bom-category-row height

  const CONTENT_HEIGHT_PX = (PAGE_HEIGHT_CM - HEADER_HEIGHT_CM - FOOTER_HEIGHT_CM - CONTENT_TOP_PADDING_CM) * CM_TO_PX;
  const ROW_HEIGHT_PX = ROW_HEIGHT_CM * CM_TO_PX;
  const CAT_ROW_HEIGHT_PX = CAT_ROW_HEIGHT_CM * CM_TO_PX;
  const COL_HEADER_HEIGHT_PX = COLUMN_HEADER_HEIGHT_CM * CM_TO_PX;

  // Flatten BOM data into renderable rows with known heights
  const rows = useMemo(() => {
    const out = [];
    if (Array.isArray(bomData.categories)) {
      bomData.categories.forEach((category) => {
        out.push({ type: 'category', name: category.name });
        category.items.forEach((item) => {
          out.push({ type: 'item', item });
        });
      });
    }
    return out;
  }, [bomData]);

  // Split rows into pages by accumulating heights
  const pages = useMemo(() => {
    const result = [];
    let current = [];
    let remaining = CONTENT_HEIGHT_PX - COL_HEADER_HEIGHT_PX;

    const pushPage = () => {
      if (current.length) {
        result.push(current);
        current = [];
        remaining = CONTENT_HEIGHT_PX - COL_HEADER_HEIGHT_PX;
      }
    };

    rows.forEach((r) => {
      const h = r.type === 'category' ? CAT_ROW_HEIGHT_PX : ROW_HEIGHT_PX;
      if (h > remaining) pushPage();
      current.push(r);
      remaining -= h;
    });
    if (current.length) result.push(current);

    return result;
  }, [rows, CONTENT_HEIGHT_PX, COL_HEADER_HEIGHT_PX, ROW_HEIGHT_PX, CAT_ROW_HEIGHT_PX]);

  // Decide if totals/content fit on last page; otherwise move to a new page
  const totalsBlockEstimatedRows = 9; // approx visual height (deposit schedule, terms, banking, signature)
  const ROWS_PER_PAGE_ESTIMATE = Math.floor((CONTENT_HEIGHT_PX - COL_HEADER_HEIGHT_PX) / ROW_HEIGHT_PX);
  const needsTotalsOnNewPage = useMemo(() => {
    if (!pages.length) return true;
    const lastPageRowCount = pages[pages.length - 1].length;
    return (ROWS_PER_PAGE_ESTIMATE - lastPageRowCount) < totalsBlockEstimatedRows;
  }, [pages, ROWS_PER_PAGE_ESTIMATE]);

  const allPages = useMemo(() => {
    // Clone to avoid mutating original
    const cloned = pages.map(p => [...p]);
    if (needsTotalsOnNewPage) {
      cloned.push([]); // append a blank page for totals/terms
    }
    return cloned;
  }, [pages, needsTotalsOnNewPage]);

  const renderHeader = () => (
    <header className="bom-header">
      <div className="bom-header-top">
        <img className="bom-logo" src={logo} alt="Orka Solar Logo" />
        <div className="bom-company-meta">
          <div>Orka Solar (Pty) Ltd</div>
          <div>Reg No: 2017/141572/07</div>
          <div>VAT No: 443 028 1337</div>
          <div>T: 082 660 0951&nbsp; E: info@orkasolar.co.za&nbsp; W: www.orkasolar.co.za</div>
        </div>
      </div>
      <div className="bom-title">Quotation</div>
      <div className="bom-info-grid">
        <div>
          <span className="label">For attention:</span> {bomData.project?.client_name || 'Client Name'}
        </div>
        <div>
          <span className="label">Date:</span> {currentDate}
        </div>
        <div>
          <span className="label">Company:</span> {bomData.project?.name || 'Company Name'}
        </div>
        <div>
          <span className="label">Quote number:</span> QTE{(bomData.project?.id || '').toString().padStart(8, '0')}
        </div>
        <div>
          <span className="label">Address:</span> {bomData.project?.location || 'Address'}
        </div>
        <div>
          <span className="label">Contact Person:</span> {bomData.project?.site_contact_person || '-'}
        </div>
        <div>
          <span className="label">Tel:</span> {bomData.project?.site_phone || '-'}
        </div>
        <div />
      </div>
      <div className="bom-project-strip">
        {bomData.project?.name} - {bomData.systemSpecs?.panelKw}kW{" "}
        {bomData.systemSpecs?.batteryKwh > 0
          ? `${bomData.systemSpecs?.batteryKwh}kWh Storage`
          : 'System'}
      </div>
    </header>
  );

  const renderFooter = (pageIndex) => (
    <footer className="bom-footer">
      <div className="bom-page-number">Page {pageIndex + 1} of {allPages.length}</div>
    </footer>
  );

  const renderTableHead = () => (
    <thead>
      <tr className="bom-thead-row">
        <th className="bom-thead-cell bom-col-desc">Item Description</th>
        <th className="bom-thead-cell bom-col-units">Units</th>
        <th className="bom-thead-cell bom-col-unitprice">Price per Unit</th>
        <th className="bom-thead-cell bom-col-total">Total</th>
      </tr>
    </thead>
  );

  const renderRow = (r, idx) => {
    if (r.type === 'category') {
      return (
        <tr className="bom-category-row" key={`cat-${idx}`}>
          <td className="bom-category-cell" colSpan={4}>{r.name}</td>
        </tr>
      );
    }
    const { item } = r;
    const spec =
      (item.product.category === 'panel' && item.product.power_w && `${item.product.power_w}W`) ||
      (item.product.category === 'inverter' && item.product.rating_kva && `${item.product.rating_kva}kVA`) ||
      (item.product.category === 'battery' && item.product.capacity_kwh && `${item.product.capacity_kwh}kWh`) ||
      '';

    return (
      <tr className="bom-row" key={`row-${idx}`}>
        <td className="bom-cell bom-col-desc">
          <div className="bom-item-model">{item.product.brand} {item.product.model}</div>
          {spec && <div className="bom-item-spec">{spec}</div>}
        </td>
        <td className="bom-cell bom-col-units" style={{ textAlign: 'center' }}>{item.quantity}</td>
        <td className="bom-cell bom-col-unitprice">{formatCurrency(item.price)}</td>
        <td className="bom-cell bom-col-total">{formatCurrency(item.price * item.quantity)}</td>
      </tr>
    );
  };

  const TotalsAndTerms = () => (
    <div>
      <div className="bom-totals">
        <div className="row"><div>Subtotal:</div><div><b>{formatCurrency(bomData.totals?.subtotal || 0)}</b></div></div>
        <div className="row"><div>Extras / Labor:</div><div>{formatCurrency(bomData.totals?.extras || 0)}</div></div>
        <div className="row total">
          <div>Total (excl. VAT):</div><div>{formatCurrency(bomData.totals?.grand || 0)}</div>
        </div>
      </div>

      <div className="bom-terms">
        <p style={{ margin: '5px 0', fontWeight: 700 }}>Please note that a 65% deposit will be required before Orka Solar will commence with any work.</p>
      </div>

      {/* Payment schedule */}
      <table className="bom-table" style={{ marginTop: '6px' }}>
        <tbody>
          <tr className="bom-row"><td className="bom-cell">Deposit</td><td className="bom-cell bom-col-units">65%</td><td className="bom-cell bom-col-unitprice" colSpan={2} style={{ textAlign: 'right' }}>{formatCurrency((bomData.totals?.grand || 0) * 0.65 * 1.15)} <span style={{ fontWeight: 400 }}>Incl. VAT</span></td></tr>
          <tr className="bom-row"><td className="bom-cell">On delivery of inverters and panels to site</td><td className="bom-cell bom-col-units">25%</td><td className="bom-cell bom-col-unitprice" colSpan={2} style={{ textAlign: 'right' }}>{formatCurrency((bomData.totals?.grand || 0) * 0.25 * 1.15)} <span style={{ fontWeight: 400 }}>Incl. VAT</span></td></tr>
          <tr className="bom-row"><td className="bom-cell">On project completion</td><td className="bom-cell bom-col-units">10%</td><td className="bom-cell bom-col-unitprice" colSpan={2} style={{ textAlign: 'right' }}>{formatCurrency((bomData.totals?.grand || 0) * 0.10 * 1.15)} <span style={{ fontWeight: 400 }}>Incl. VAT</span></td></tr>
          <tr className="bom-row"><td className="bom-cell" colSpan={4} style={{ borderBottom: '1px solid #000' }}></td></tr>
          <tr className="bom-row"><td className="bom-cell" colSpan={2}></td><td className="bom-cell" colSpan={2} style={{ textAlign: 'right', fontWeight: 700 }}>{formatCurrency((bomData.totals?.grand || 0) * 1.15)}</td></tr>
        </tbody>
      </table>

      <div className="bom-two-col">
        <div className="bom-box">
          <div style={{ fontWeight: 700, borderBottom: '1px solid #000', paddingBottom: 4, marginBottom: 4 }}>Banking details:</div>
          <div>Company: Orka Solar (Pty) Ltd.</div>
          <div>Branch: ABSA Mooinooi Mall</div>
          <div>Account name: Orka Solar (PTY) Ltd</div>
          <div>Account type: Cheque</div>
          <div>Account number: 409 240 5135</div>
        </div>
        <div className="bom-box">
          <div className="bom-signature">Client acceptance: signature & date</div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="bom-report">
      {/* Controls */}
      <div className="bom-controls no-print">
        <button className="btn" onClick={() => navigate(-1)}>Back</button>
        <button className="btn" onClick={() => window.print()}>Print</button>
      </div>

      <main className="bom-printarea">
        {allPages.map((pageRows, pageIndex) => (
          <section className="bom-page" key={pageIndex}>
            {renderHeader()}

            <div className="bom-content">
              {pageRows.length > 0 ? (
                <table className="bom-table">
                  {renderTableHead()}
                  <tbody>
                    {pageRows.map((r, i) => renderRow(r, i))}
                  </tbody>
                </table>
              ) : (
                // Totals/terms page
                <TotalsAndTerms />
              )}
            </div>

            {renderFooter(pageIndex)}
          </section>
        ))}

        {/* If everything fit on last page, still add totals block right there */}
        {!needsTotalsOnNewPage && (
          <section className="bom-page" key="totals-last">
            {renderHeader()}
            <div className="bom-content">
              <TotalsAndTerms />
            </div>
            {renderFooter(allPages.length)}
          </section>
        )}
      </main>
    </div>
  );
}

export default PrintableBOM;
