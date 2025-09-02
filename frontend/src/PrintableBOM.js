import React, { useMemo, useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import logo from './assets/orka_logo_text.png';
import './PrintableBOM.css';
import { useAuth } from './AuthContext';

/**
 * PrintableBOM (paginated, WYSIWYG, print-stable)
 */
function PrintableBOM({ projectId: propProjectId }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { projectId: urlProjectId } = useParams();
  
  // Use projectId from props if available (when used in ProjectDashboard), otherwise from URL
  const projectId = propProjectId || urlProjectId;

  // Retrieve data from localStorage (project-specific key)
  const bomData = JSON.parse(localStorage.getItem(`printBomData_${projectId}`) || '{}');
  const currentDate = new Date().toLocaleDateString('en-ZA');

  const [priceMode, setPriceMode] = useState(() => localStorage.getItem('bomPriceMode') || 'all');
  useEffect(() => localStorage.setItem('bomPriceMode', priceMode), [priceMode]);

  // category totals for the “category only” mode
  const categoryTotals = useMemo(() => {
    const map = {};
    (bomData.categories || []).forEach(cat => {
      map[cat.name] = (cat.items || []).reduce((s, it) => s + (it.price || 0) * (it.quantity || 0), 0);
    });
    return map;
  }, [bomData]);  

const [termsPerc, setTermsPerc] = useState(() => {
  const saved = localStorage.getItem(`bomTermsPerc_${projectId}`);
  return saved ? JSON.parse(saved) : [65, 25, 10];
});
useEffect(() => {
  localStorage.setItem(`bomTermsPerc_${projectId}`, JSON.stringify(termsPerc));
}, [termsPerc, projectId]);

const handleTermsChange = (i, val) => {
  const v = Math.max(0, Math.min(100, parseFloat(val) || 0));
  setTermsPerc(prev => prev.map((p, idx) => (idx === i ? v : p)));
};
const termsSum = useMemo(() => termsPerc.reduce((a,b)=>a+(+b||0),0), [termsPerc]);


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
  const HEADER_HEIGHT_CM = 7.3;     // .bom-header height
  const FOOTER_HEIGHT_CM = 0.7;     // .bom-footer height
  const CONTENT_TOP_PADDING_CM = 0;
  const COLUMN_HEADER_HEIGHT_CM = 1.25; // .bom-thead-row height
  const ROW_HEIGHT_CM = 0.75;         // .bom-row height
  const CAT_ROW_HEIGHT_CM = 0.75;     // .bom-category-row height

  // Safety margin to avoid print rounding causing overflow
  const SAFETY_CM = 0.02;
  const HEADROOM_CM = 0.40;

  const CONTENT_HEIGHT_PX = (PAGE_HEIGHT_CM - HEADER_HEIGHT_CM - FOOTER_HEIGHT_CM - CONTENT_TOP_PADDING_CM) * CM_TO_PX;
  const ROW_HEIGHT_PX = (ROW_HEIGHT_CM + SAFETY_CM) * CM_TO_PX;
  const CAT_ROW_HEIGHT_PX = (CAT_ROW_HEIGHT_CM + SAFETY_CM) * CM_TO_PX;
  const COL_HEADER_HEIGHT_PX = (COLUMN_HEADER_HEIGHT_CM + SAFETY_CM) * CM_TO_PX;
  const TOTALS_MIN_HEIGHT_CM = 8.0;
  const TOTALS_MIN_HEIGHT_PX = (TOTALS_MIN_HEIGHT_CM + SAFETY_CM) * CM_TO_PX;
  const HEADROOM_PX = HEADROOM_CM * CM_TO_PX;

  const H_TOT_CM = 3.0;
  const H_TERM_CM = 6.4;
  const H_BANK_CM = 4.2;
  const BLOCK_GAP_CM = 0.3;

  const H_TOT_PX = (H_TOT_CM + SAFETY_CM) * CM_TO_PX;
  const H_TERM_PX = (H_TERM_CM + SAFETY_CM) * CM_TO_PX;
  const H_BANK_PX = (H_BANK_CM + SAFETY_CM) * CM_TO_PX;
  const BLOCK_GAP_PX = (BLOCK_GAP_CM) * CM_TO_PX;

  // Flatten BOM data into renderable rows with known heights
  const rows = useMemo(() => {
    const out = [];
    if (Array.isArray(bomData.categories)) {
      bomData.categories.forEach((category) => {
        out.push({ type: 'category', name: category.name });
        (category.items || []).forEach((item) => {
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


  const lastPageRemainingPx = useMemo(() => {
    if (!pages.length) return 0;
    const last = pages[pages.length - 1];
    const usedRowsPx = last.reduce((acc, r) => acc + (r.type === 'category' ? CAT_ROW_HEIGHT_PX : ROW_HEIGHT_PX), 0);
    return CONTENT_HEIGHT_PX - (COL_HEADER_HEIGHT_PX + usedRowsPx);
  }, [pages, CONTENT_HEIGHT_PX, COL_HEADER_HEIGHT_PX, ROW_HEIGHT_PX, CAT_ROW_HEIGHT_PX]);  

  const totalsPlacement = useMemo(() => {
    const blocks = [
        { key: 'totals', h: H_TOT_PX },
        { key: 'termsDeposit', h: H_TERM_PX },
        { key: 'bankingAccept', h: H_BANK_PX },
    ];
    const inlineKeys = [];
    const carryKeys = [];
    let rem = lastPageRemainingPx;

    for (const b of blocks) {
        const need = b.h + (inlineKeys.length ? BLOCK_GAP_PX : 0);
        if (need + HEADROOM_PX <= rem) { inlineKeys.push(b.key); rem -= need; }
        else { carryKeys.push(b.key); }
    }
    return { inlineKeys, carryKeys };
  }, [lastPageRemainingPx, H_TOT_PX, H_TERM_PX, H_BANK_PX, BLOCK_GAP_PX, HEADROOM_PX]);

  const carryPages = useMemo(() => {
    if (!totalsPlacement.carryKeys.length) return [];
    const h = { totals: H_TOT_PX, termsDeposit: H_TERM_PX, bankingAccept: H_BANK_PX };
    const pagesArr = [];
    let page = [];
    let rem = CONTENT_HEIGHT_PX;

    for (const key of totalsPlacement.carryKeys) {
        const need = h[key] + (page.length ? BLOCK_GAP_PX : 0);
        if (need > rem) { pagesArr.push(page); page = []; rem = CONTENT_HEIGHT_PX; }
        page.push(key);
        rem -= need;
    }
    if (page.length) pagesArr.push(page);
    return pagesArr;
  }, [totalsPlacement, CONTENT_HEIGHT_PX, H_TOT_PX, H_TERM_PX, H_BANK_PX, BLOCK_GAP_PX]);

  // Estimate whether totals fit on the last page
  const totalsBlockEstimatedRows = 9; // approx
  const ROWS_PER_PAGE_ESTIMATE = Math.floor((CONTENT_HEIGHT_PX - COL_HEADER_HEIGHT_PX) / ROW_HEIGHT_PX);
  
  const needsTotalsOnNewPage = useMemo(() => {
    if (!pages.length) return true;
    const last = pages[pages.length - 1];

    // sum actual height of last page rows
    const usedRowsPx = last.reduce((acc, r) => 
        acc + (r.type === 'category' ? CAT_ROW_HEIGHT_PX : ROW_HEIGHT_PX), 0);

    // header (col head) + rows already on the page
    const usedPx = COL_HEADER_HEIGHT_PX + usedRowsPx;

    // remaining space on the page
    const remainingPx = CONTENT_HEIGHT_PX - usedPx;

    // if our totals+banking+acceptance block won't fit fully, push to a new page
    return remainingPx < TOTALS_MIN_HEIGHT_PX;
  }, [pages, CONTENT_HEIGHT_PX, COL_HEADER_HEIGHT_PX, ROW_HEIGHT_PX, CAT_ROW_HEIGHT_PX, TOTALS_MIN_HEIGHT_PX]);

  // Build pages: either append a dedicated totals page, or render totals inline on the last page
  // const pagesWithKinds = useMemo(() => {
  //   const base = pages.map(p => ({ kind: 'rows', rows: p }));
  //   if (carryPages.length) {
  //       carryPages.forEach(blocks => base.push({ kind: 'totals', blocks }));
  //   }
  //   return base;
  // }, [pages, carryPages]);
 const pagesWithKinds = useMemo(() => {
   const base = pages.map(p => ({ kind: 'rows', rows: p }));
   // keep bankingAccept in qty mode; drop totals/terms
   const filteredCarry = carryPages
     .map(blocks => blocks.filter(k => (priceMode !== 'qty') || k === 'bankingAccept'))
     .filter(b => b.length);
   filteredCarry.forEach(blocks => base.push({ kind: 'totals', blocks }));
   return base;
 }, [pages, carryPages, priceMode]);

  const totalPages = pagesWithKinds.length;

const renderHeader = () => (
    <header className="bom-header">
      <div className="bom-header-top">
        <img className="bom-logo" src={logo} alt="Orka Solar Logo" />
        <div className="bom-company-meta">
          <div>Orka Solar (Pty) Ltd</div>
          <div>Reg No: 2017/141572/07</div>
          <div>VAT No: 463 028 1337</div>
          <div>T: 082 660 0851&nbsp; E: info@orkasolar.co.za&nbsp; W: www.orkasolar.co.za</div>
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
          <span className="label">Contact Person:</span> {user?.first_name || 'Lourens'} {user?.last_name || 'de Jongh'}
        </div>
        <div>
          <span className="label">Email:</span> {bomData.project?.client_email || '-'}
        </div>
        <div>
          <span className='label'>Email:</span> {user?.email || 'lourens@orkasolar.co.za'}
        </div>
        <div>
          <span className="label">Tel:</span> {bomData.project?.client_phone || '-'}
        </div>
        <div>
          <span className="label">Tel:</span> {user?.phone || '082 660 0851'}
        </div>
        <div />
      </div>
    <div className="bom-project-strip">
      {bomData.project?.name} - 
      {bomData.project?.inverter_brand_model ? ` ${bomData.project.inverter_brand_model}` : ""}
      {bomData.systemSpecs?.inverterKva ? ` ${Number(bomData.systemSpecs.inverterKva).toFixed(0)}kVA` : ""}
      {bomData.project?.battery_brand_model && bomData.systemSpecs?.batteryKwh > 0
        ? ` & ${bomData.project.battery_brand_model} ${(bomData.systemSpecs.batteryKwh / 0.8).toFixed(0)}kWh`
        : bomData.systemSpecs?.batteryKwh > 0
          ? ` ${(bomData.systemSpecs.batteryKwh / 0.8).toFixed(0)}kWh`
          : ' System'}
    </div>
    </header>
  );

  const renderFooter = (pageIndex) => (
    <footer className="bom-footer">
      <div className="bom-page-number">Page {pageIndex + 1} of {totalPages}</div>
    </footer>
  );

  const renderTableHead = () => (
    <thead>
      <tr className="bom-thead-row">
        <th className="bom-thead-cell bom-col-desc">Item Description</th>
        <th className="bom-thead-cell bom-col-units">Units</th>
        {priceMode === 'all' && (
          <th className="bom-thead-cell bom-col-unitprice">Price per Unit</th>
        )}
        {priceMode !== 'qty' && (
          <th className="bom-thead-cell bom-col-total">Total</th>
        )}
      </tr>
    </thead>

    // <thead>
    //   <tr className="bom-thead-row">
    //     <th className="bom-thead-cell bom-col-desc">Item Description</th>
    //     <th className="bom-thead-cell bom-col-units">Units</th>
    //     <th className="bom-thead-cell bom-col-unitprice">Price per Unit</th>
    //     <th className="bom-thead-cell bom-col-total">Total</th>
    //   </tr>
    // </thead>
  );

const renderRow = (r, idx) => {
  if (r.type === 'category') {
    const catTotal = categoryTotals[r.name] || 0;

    if (priceMode === 'qty') {
      return (
        <tr className="bom-category-row" key={`cat-${idx}`}>
          <td className="bom-category-cell" colSpan={2}>{r.name}</td>
        </tr>
      );
    }
    // 'all' → [Desc, Units, UnitPrice, Total]  (show total in Total col)
    // 'category' → [Desc, Units, Total]
    const preCols = priceMode === 'all' ? 3 : 2;
    return (
      <tr className="bom-category-row" key={`cat-${idx}`}>
        <td className="bom-category-cell" colSpan={preCols}>{r.name}</td>
        <td className="bom-cell bom-col-total" style={{ textAlign: 'right', fontWeight: 700 }}>
          {formatCurrency(catTotal)}
        </td>
      </tr>
    );
  }

  const { item } = r;
  const desc = (
    <div className="bom-item-model">
      {item.product.brand} {item.product.model}
    </div>
  );

  if (priceMode === 'qty') {
    return (
      <tr className="bom-row" key={`row-${idx}`}>
        <td className="bom-cell bom-col-desc">{desc}</td>
        <td className="bom-cell bom-col-units" style={{ textAlign: 'center' }}>{item.quantity}</td>
      </tr>
    );
  }

  if (priceMode === 'category') {
    return (
      <tr className="bom-row" key={`row-${idx}`}>
        <td className="bom-cell bom-col-desc">{desc}</td>
        <td className="bom-cell bom-col-units" style={{ textAlign: 'center' }}>{item.quantity}</td>
        <td className="bom-cell bom-col-total"></td>
      </tr>
    );
  }

  // 'all'
  return (
    <tr className="bom-row" key={`row-${idx}`}>
      <td className="bom-cell bom-col-desc">{desc}</td>
      <td className="bom-cell bom-col-units" style={{ textAlign: 'center' }}>{item.quantity}</td>
      <td className="bom-cell bom-col-unitprice">{formatCurrency(item.price)}</td>
      <td className="bom-cell bom-col-total">{formatCurrency(item.price * item.quantity)}</td>
    </tr>
  );
};


  // const renderRow = (r, idx) => {
  //   if (r.type === 'category') {
  //     return (
  //       <tr className="bom-category-row" key={`cat-${idx}`}>
  //         <td className="bom-category-cell" colSpan={4}>{r.name}</td>
  //       </tr>
  //     );
  //   }
  //   const { item } = r;
  //   const spec = (
  //     (item.product.category === 'panel' && item.product.power_w && `${item.product.power_w}W`) ||
  //     (item.product.category === 'inverter' && item.product.rating_kva && `${item.product.rating_kva}kVA`) ||
  //     (item.product.category === 'battery' && item.product.capacity_kwh && `${item.product.capacity_kwh}kWh`) ||
  //     ''
  //   );

  //   return (
  //     <tr className="bom-row" key={`row-${idx}`}>
  //       <td className="bom-cell bom-col-desc">
  //         <div className="bom-item-model">{item.product.brand} {item.product.model}</div>
  //         {/* {spec && <div className="bom-item-spec">{spec}</div>} */}
  //       </td>
  //       <td className="bom-cell bom-col-units" style={{ textAlign: 'center' }}>{item.quantity}</td>
  //       <td className="bom-cell bom-col-unitprice">{formatCurrency(item.price)}</td>
  //       <td className="bom-cell bom-col-total">{formatCurrency(item.price * item.quantity)}</td>
  //     </tr>
  //   );
  // };

    const TotalsBlock = () => {
      const vatPerc = Number(bomData.totals?.vat_perc ?? 0);
    
      return (
        <section className="bom-block bom-block-totals">
          <div className="bom-totals">
            <div className="rule" />
            <div className="row">
              <div className="label">Total (excl. VAT)</div>
              <div className="value">{formatCurrency(bomData.totals?.total_excl_vat || 0)}</div>
            </div>
            <div className="row">
              <div className="label">{vatPerc}% VAT</div>
              <div className="value">{formatCurrency(bomData.totals?.vat_price || 0)}</div>
            </div>
            <div className="rule" />
            <div className="row grand">
              <div className="label">Total (incl. VAT)</div>
              <div className="value">{formatCurrency(bomData.totals?.total_incl_vat || 0)}</div>
            </div>
            <div className="rule double" />
          </div>
        </section>
      );
    };

    // const TermsDepositBlock = () => (
    //   <section className="bom-block bom-block-termsdeposit">
    //     <div className="bom-terms">
    //       <p style={{ margin: '5px 0', fontWeight: 700 }}>
    //         Please note that a 65% deposit will be required before Orka Solar will commence with any work.
    //       </p>
    //     </div>
    //     <table className="bom-table" style={{ marginTop: '6px' }}>
    //       <tbody>
    //         <tr className="bom-row-terms"><td className="bom-cell-terms">Deposit</td><td className="bom-cell-terms bom-col-units">65%</td><td className="bom-cell-terms bom-col-unitprice" colSpan={2} style={{ textAlign: 'right' }}>{formatCurrency((bomData.totals?.total_incl_vat || 0) * 0.65)} </td><td> <span style={{ fontWeight: 400 }}>Incl. VAT</span></td></tr>
    //         <tr className="bom-row-terms"><td className="bom-cell-terms">On delivery of inverters and panels to site</td><td className="bom-cell-terms bom-col-units">25%</td><td className="bom-cell-terms bom-col-unitprice" colSpan={2} style={{ textAlign: 'right' }}>{formatCurrency((bomData.totals?.total_incl_vat || 0) * 0.25)} </td><td>  <span style={{ fontWeight: 400 }}>Incl. VAT</span></td></tr>
    //         <tr className="bom-row-terms"><td className="bom-cell-terms">On project completion</td><td className="bom-cell-terms bom-col-units">10%</td><td className="bom-cell-terms bom-col-unitprice" colSpan={2} style={{ textAlign: 'right' }}>{formatCurrency((bomData.totals?.total_incl_vat || 0) * 0.10)} </td><td> <span style={{ fontWeight: 400 }}>Incl. VAT</span></td></tr>
    //         {/* <tr className="bom-row"><td className="bom-cell" colSpan={4} style={{ borderBottom: '1px solid #000' }}></td></tr> */}
    //         <tr className="bom-row-terms"><td className="bom-cell-terms" colSpan={2}></td><td className="bom-cell-terms" colSpan={2} style={{ textAlign: 'right', fontWeight: 700, borderTop: '1px solid #000', borderBottom: '1px solid #000' }}>{formatCurrency((bomData.totals?.total_incl_vat || 0))}</td></tr>
    //       </tbody>
    //     </table>
    //   </section>
    // );

const TermsDepositBlock = () => {
  const totalIncl = (bomData.totals?.total_incl_vat || 0);
  const [p0, p1, p2] = termsPerc.map(n => +n || 0);
  const amt = (p) => formatCurrency(totalIncl * (p / 100));

  return (
    <section className="bom-block bom-block-termsdeposit">
      <div className="bom-terms">
        <p style={{ margin: '5px 0', fontWeight: 700 }}>
          Please note that a {p0}% deposit will be required before Orka Solar will commence with any work.
        </p>
      </div>

      <table className="bom-table bom-terms-table" style={{ marginTop: '6px' }}>
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
            <td className="bom-cell-terms incl"><span>Incl. VAT</span></td>
          </tr>

          <tr className="bom-row-terms">
            <td className="bom-cell-terms">On delivery of inverters and panels to site</td>
            <td className="bom-cell-terms">{p1}%</td>
            <td className="bom-cell-terms"></td>
            <td className="bom-cell-terms amount">{amt(p1)}</td>
            <td className="bom-cell-terms incl"><span>Incl. VAT</span></td>
          </tr>

          <tr className="bom-row-terms">
            <td className="bom-cell-terms">On project completion</td>
            <td className="bom-cell-terms">{p2}%</td>
            <td className="bom-cell-terms"></td>
            <td className="bom-cell-terms amount">{amt(p2)}</td>
            <td className="bom-cell-terms incl"><span>Incl. VAT</span></td>
          </tr>

          <tr className="bom-row-terms grand">
            <td className="bom-cell-terms" colSpan={3}></td>
            <td className="bom-cell-terms amount total-amount">
              {formatCurrency(totalIncl)}
            </td>
            <td className="bom-cell-terms incl"><span>Incl. VAT</span></td>
          </tr>
        </tbody>
      </table>
    </section>
  );
};


    const BankingAcceptanceBlock = () => (
      <section className="bom-block bom-block-bankingaccept">
        <div className="bom-two-col">
          <div className="bom-box">
            <div style={{ fontWeight: 700, borderBottom: '1px solid #000', paddingBottom: 4, marginBottom: 4 }}>Banking details:</div>
            <div>Company: Orka Solar (Pty) Ltd.</div>
            <div>Branch: ABSA Mooirivier Mall</div>
            <div>Account name: Orka Solar (PTY) Ltd</div>
            <div>Account type: Cheque</div>
            <div>Account number: 409 240 5135</div>
          </div>
          <div className="bom-box">
            <div className="bom-signature">Client acceptance: signature & date</div>
          </div>
        </div>
      </section>
    );

  // If no BOM data exists for this project, show a message
  if (!bomData.project || !bomData.categories || bomData.categories.length === 0) {
    return (
      <div className="container mt-5 text-center">
        <div className="alert alert-info">
          <h4>No Print Data Available</h4>
          <p>Please go to the <strong>Bill of Materials</strong> tab and click <strong>"Export to PDF"</strong> to generate the printable BOM for this project.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bom-report">
      {/* Controls */}
      <div className="bom-controls no-print">
        <button className="btn" onClick={() => navigate(-1)}>Back</button>
        <button className="btn" onClick={() => window.print()}>Print</button>
        <select
          className="form-select form-select-sm"
          style={{ width: 260, marginLeft: 8 }}
          value={priceMode}
          onChange={(e) => setPriceMode(e.target.value)}
          aria-label="Price visibility"
        >
          <option value="all">Show line & category prices</option>
          <option value="category">Show category prices only</option>
          <option value="qty">Hide all prices (qty only)</option>
        </select>      
        <div className="d-flex align-items-center" style={{ gap: 8, marginLeft: 8 }}>
  <label className="form-label mb-0" style={{ fontSize: 12 }}>Deposit %</label>
  <input type="number" min="0" max="100" step="1"
    className="form-control form-control-sm" style={{ width: 70 }}
    value={termsPerc[0]} onChange={e => handleTermsChange(0, e.target.value)} />
  <label className="form-label mb-0" style={{ fontSize: 12 }}>Delivery %</label>
  <input type="number" min="0" max="100" step="1"
    className="form-control form-control-sm" style={{ width: 70 }}
    value={termsPerc[1]} onChange={e => handleTermsChange(1, e.target.value)} />
  <label className="form-label mb-0" style={{ fontSize: 12 }}>Completion %</label>
  <input type="number" min="0" max="100" step="1"
    className="form-control form-control-sm" style={{ width: 70 }}
    value={termsPerc[2]} onChange={e => handleTermsChange(2, e.target.value)} />
  <span className={`badge ${termsSum===100 ? 'bg-success' : 'bg-warning text-dark'}`} title="Percentages should sum to 100%">
    Sum: {termsSum}%
  </span>
  <button
    type="button"
    className="btn btn-sm btn-outline-secondary"
    onClick={() => setTermsPerc([65,25,10])}
    title="Reset to 65/25/10"
  >Reset</button>
</div>
  
      </div>

      <main className="bom-printarea">
        {pagesWithKinds.map((pg, pageIndex) => (
          <section className="bom-page" key={pageIndex}>
            {renderHeader()}
            <div className="bom-content">
              {pg.kind === 'rows' && (
                <table className="bom-table">
                  {renderTableHead()}
                  <tbody>
                    {pg.rows.map((r, i) => renderRow(r, i))}
                  </tbody>
                </table>
              )}
              {/* Inline blocks on the last rows page */}
              {pg.kind === 'rows' && pageIndex === (pages.length - 1) && (
                <>
                  {priceMode !== 'qty' && totalsPlacement.inlineKeys.includes('totals') && <TotalsBlock />}
                  {priceMode !== 'qty' && totalsPlacement.inlineKeys.includes('termsDeposit') && <TermsDepositBlock />}
                  {totalsPlacement.inlineKeys.includes('bankingAccept') && <BankingAcceptanceBlock />}
                </>
              )}

              {/* Dedicated totals page for any carried blocks */}
              {pg.kind === 'totals' && (
                <>
                  {priceMode !== 'qty' && pg.blocks.includes('totals') && <TotalsBlock />}
                  {priceMode !== 'qty' && pg.blocks.includes('termsDeposit') && <TermsDepositBlock />}
                  {pg.blocks.includes('bankingAccept') && <BankingAcceptanceBlock />}
                </>
              )}
            </div>
            {/* {renderFooter(pageIndex)} */}
          </section>
        ))}
      </main>
    </div>
  );
}

export default PrintableBOM;
