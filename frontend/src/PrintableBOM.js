import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from 'react-bootstrap';
import logo from './assets/orka_logo_transparent_background.png';

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

  const handlePrint = () => {
    window.print();
  };

  return (
    <div>
      {/* Controls (hidden on print) */}
      <div
        className="no-print"
        style={{ padding: '20px', position: 'fixed', top: '20px', right: '20px' }}
      >
        <Button variant="light" onClick={() => navigate(-1)}>
          Back
        </Button>
        <Button variant="primary" onClick={handlePrint} style={{ marginLeft: '10px' }}>
          Print
        </Button>
      </div>

      {/* Single table: header in <thead> so it repeats on each page */}
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
        <thead>
          {/* Company / Address */}
          <tr>
            <td colSpan={4} style={{ paddingBottom: '8px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <tbody>
                  <tr>
                    <td style={{ width: '50%', verticalAlign: 'top' }}>
                      <img
                        src={logo}
                        alt="Orka Solar Logo"
                        style={{ height: '40px', width: 'auto', marginBottom: '5px' }}
                      />
                      <div style={{ fontSize: '10px', color: '#555' }}>
                        <p style={{ margin: 0 }}>Orka Solar (Pty) Ltd</p>
                        <p style={{ margin: 0 }}>Reg No: 2017/141572/07</p>
                        <p style={{ margin: 0 }}>VAT No: 443 028 1337</p>
                        <p style={{ margin: 0 }}>
                          T: 082 660 0951&nbsp; E: info@orkasolar.co.za&nbsp; W: www.orkasolar.co.za
                        </p>
                      </div>
                    </td>
                    <td
                      style={{
                        width: '50%',
                        textAlign: 'right',
                        fontSize: '10px',
                        color: '#555',
                        verticalAlign: 'top'
                      }}
                    >
                      <p style={{ margin: 0 }}>3 Retief Street</p>
                      <p style={{ margin: 0 }}>The Square, Unit 13</p>
                      <p style={{ margin: 0 }}>Potchefstroom</p>
                    </td>
                  </tr>
                </tbody>
              </table>
            </td>
          </tr>

          {/* Title */}
          <tr>
            <td colSpan={4} style={{ textAlign: 'center', padding: 0, paddingBottom: '8px' }}>
              <h1 style={{ fontSize: '20px', margin: 0 }}>Quotation</h1>
            </td>
          </tr>

          {/* Client / Quote info */}
          <tr>
            <td colSpan={4} style={{ paddingBottom: '8px' }}>
              <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0 1px' }}>
                <tbody>
                  <tr>
                    {/* Left block: client */}
                    <td style={{ width: '50%', verticalAlign: 'top' }}>
                      <table
                        style={{
                          width: '100%',
                          fontSize: '10px',
                          borderCollapse: 'separate',
                          borderSpacing: '0 1px'
                        }}
                      >
                        <tbody>
                          <tr>
                            <td style={{ width: '120px', fontWeight: 'bold' }}>For attention:</td>
                            <td>{bomData.project?.client_name || 'Client Name'}</td>
                          </tr>
                          <tr>
                            <td style={{ fontWeight: 'bold' }}>Company:</td>
                            <td>{bomData.project?.name || 'Company Name'}</td>
                          </tr>
                          <tr>
                            <td style={{ fontWeight: 'bold' }}>Address:</td>
                            <td>{bomData.project?.location || 'Address'}</td>
                          </tr>
                          <tr>
                            <td style={{ fontWeight: 'bold' }}>Mail:</td>
                            <td>-</td>
                          </tr>
                          <tr>
                            <td style={{ fontWeight: 'bold' }}>Tel:</td>
                            <td>{bomData.project?.site_phone || '-'}</td>
                          </tr>
                        </tbody>
                      </table>
                    </td>

                    {/* Right block: quote meta */}
                    <td style={{ width: '50%', verticalAlign: 'top' }}>
                      <table
                        style={{
                          width: '100%',
                          fontSize: '10px',
                          borderCollapse: 'separate',
                          borderSpacing: '0 1px'
                        }}
                      >
                        <tbody>
                          <tr>
                            <td style={{ width: '120px', fontWeight: 'bold' }}>Date:</td>
                            <td>{currentDate}</td>
                          </tr>
                          <tr>
                            <td style={{ fontWeight: 'bold' }}>Quote number:</td>
                            <td>QTE{(bomData.project?.id || '').toString().padStart(8, '0')}</td>
                          </tr>
                          <tr>
                            <td style={{ fontWeight: 'bold' }}>Contact Person:</td>
                            <td>{bomData.project?.site_contact_person || '-'}</td>
                          </tr>
                        </tbody>
                      </table>
                    </td>
                  </tr>
                </tbody>
              </table>
            </td>
          </tr>

          {/* Project title bar */}
          <tr>
            <td
              colSpan={4}
              style={{
                borderTop: '1px solid #000',
                borderBottom: '1px solid #000',
                padding: '5px 0',
                fontSize: '12px',
                fontWeight: 'bold'
              }}
            >
              {bomData.project?.name} - {bomData.systemSpecs?.panelKw}kW{' '}
              {bomData.systemSpecs?.batteryKwh > 0
                ? `${bomData.systemSpecs?.batteryKwh}kWh Storage`
                : 'System'}
            </td>
          </tr>

          {/* Column headers */}
          <tr style={{ backgroundColor: '#f2f2f2' }}>
            <th style={{ textAlign: 'left', padding: '8px', borderBottom: '1px solid #ddd' }}>
              Item Description
            </th>
            <th
              style={{
                textAlign: 'center',
                padding: '8px',
                borderBottom: '1px solid #ddd',
                width: '60px'
              }}
            >
              Units
            </th>
            <th
              style={{
                textAlign: 'right',
                padding: '8px',
                borderBottom: '1px solid #ddd',
                width: '100px'
              }}
            >
              Price per Unit
            </th>
            <th
              style={{
                textAlign: 'right',
                padding: '8px',
                borderBottom: '1px solid #ddd',
                width: '100px'
              }}
            >
              Total
            </th>
          </tr>
        </thead>

        <tbody>
          {/* BOM rows */}
          {bomData.categories?.map((category, catIndex) => (
            <React.Fragment key={catIndex}>
              <tr>
                <td
                  colSpan={4}
                  style={{
                    backgroundColor: '#f9f9f9',
                    padding: '8px',
                    fontWeight: 'bold',
                    borderBottom: '1px solid #eee'
                  }}
                >
                  {category.name}
                </td>
              </tr>
              {category.items.map((item, itemIndex) => (
                <tr key={`${catIndex}-${itemIndex}`}>
                  <td style={{ padding: '8px', borderBottom: '1px solid #eee' }}>
                    <div style={{ fontWeight: 'bold' }}>
                      {item.product.brand} {item.product.model}
                    </div>
                    <div style={{ fontSize: '10px', color: '#666' }}>
                      {item.product.category === 'panel' && item.product.power_w && `${item.product.power_w}W`}
                      {item.product.category === 'inverter' &&
                        item.product.rating_kva &&
                        `${item.product.rating_kva}kVA`}
                      {item.product.category === 'battery' &&
                        item.product.capacity_kwh &&
                        `${item.product.capacity_kwh}kWh`}
                    </div>
                  </td>
                  <td style={{ textAlign: 'center', padding: '8px', borderBottom: '1px solid #eee' }}>
                    {item.quantity}
                  </td>
                  <td style={{ textAlign: 'right', padding: '8px', borderBottom: '1px solid #eee' }}>
                    {formatCurrency(item.price)}
                  </td>
                  <td style={{ textAlign: 'right', padding: '8px', borderBottom: '1px solid #eee' }}>
                    {formatCurrency(item.price * item.quantity)}
                  </td>
                </tr>
              ))}
            </React.Fragment>
          ))}

          {/* Totals (single appearance, not repeated) */}
          <tr>
            <td colSpan={3} style={{ textAlign: 'right', padding: '8px', fontWeight: 'bold' }}>
              Subtotal:
            </td>
            <td style={{ textAlign: 'right', padding: '8px', fontWeight: 'bold' }}>
              {formatCurrency(bomData.totals?.subtotal || 0)}
            </td>
          </tr>
          <tr>
            <td colSpan={3} style={{ textAlign: 'right', padding: '8px' }}>
              Extras / Labor:
            </td>
            <td style={{ textAlign: 'right', padding: '8px' }}>
              {formatCurrency(bomData.totals?.extras || 0)}
            </td>
          </tr>
          <tr style={{ backgroundColor: '#f2f2f2' }}>
            <td colSpan={3} style={{ textAlign: 'right', padding: '8px', fontWeight: 'bold' }}>
              Total (excl. VAT):
            </td>
            <td style={{ textAlign: 'right', padding: '8px', fontWeight: 'bold' }}>
              {formatCurrency(bomData.totals?.grand || 0)}
            </td>
          </tr>

          {/* Payment Terms Section */}
          <tr>
            <td colSpan={4} style={{ paddingTop: '30px', fontSize: '11px' }}>
              <p style={{ margin: '5px 0', fontWeight: 'bold' }}>
                Please note that a 65% deposit will be required before Orka Solar will commence with any work.
              </p>
            </td>
          </tr>
  
            {/* Payment Schedule Table */}
          <tr>
            <td colSpan={4}>            
            <table style={{ width: '100%', marginTop: '10px', borderCollapse: 'collapse' }}>
                <tbody>
                  <tr>
                    <td style={{ padding: '3px 5px', width: '200px' }}>Deposit</td>
                    <td style={{ padding: '3px 5px', textAlign: 'center', width: '50px' }}>65%</td>
                    <td style={{ padding: '3px 5px', textAlign: 'right' }}>
                      {formatCurrency(bomData.totals?.grand * 0.65 * 1.15)}
                    </td>
                    <td style={{ padding: '3px 5px', width: '80px' }}>Incl. Vat</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '3px 5px' }}>
                      Payment on delivery of inverters and panels to site
                    </td>
                    <td style={{ padding: '3px 5px', textAlign: 'center' }}>25%</td>
                    <td style={{ padding: '3px 5px', textAlign: 'right' }}>
                      {formatCurrency(bomData.totals?.grand * 0.25 * 1.15)}
                    </td>
                    <td style={{ padding: '3px 5px' }}>Incl. Vat</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '3px 5px' }}>Payment on project completion</td>
                    <td style={{ padding: '3px 5px', textAlign: 'center' }}>10%</td>
                    <td style={{ padding: '3px 5px', textAlign: 'right' }}>
                      {formatCurrency(bomData.totals?.grand * 0.10 * 1.15)}
                    </td>
                    <td style={{ padding: '3px 5px' }}>Incl. Vat</td>
                  </tr>
                  <tr>
                    <td colSpan={4} style={{ paddingTop: '5px', borderBottom: '1px solid black' }} />
                  </tr>
                  <tr>
                    <td colSpan={2} />
                    <td style={{ padding: '3px 5px', textAlign: 'right', fontWeight: 'bold' }}>
                      {formatCurrency(bomData.totals?.grand * 1.15)}
                    </td>
                    <td />
                  </tr>
                </tbody>
              </table>
              </td>
              </tr>

              <tr>
                <td colSpan={4}>
              {/* Terms of Quotation */}
              <div style={{ marginTop: '20px' }}>
                <p style={{ fontWeight: 'bold', marginBottom: '5px' }}>Terms of quotation:</p>
                <p style={{ margin: '5px 0' }}>Refer to statement of work for terms agreement.</p>
              </div>
              </td>
              </tr>

            <tr>
                <td colSpan={4}>
              {/* Banking + Client Acceptance */}
              <div
                style={{
                  marginTop: '20px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: '4%'
                }}
              >
                <table
                  style={{ width: '48%', border: '1px solid black', borderCollapse: 'collapse' }}
                >
                  <tbody>
                    <tr>
                      <td
                        style={{
                          fontWeight: 'bold',
                          padding: '3px',
                          borderBottom: '1px solid black'
                        }}
                      >
                        Banking details:
                      </td>
                      <td style={{ borderBottom: '1px solid black' }} />
                    </tr>
                    <tr>
                      <td style={{ padding: '3px' }}>Company</td>
                      <td style={{ padding: '3px' }}>Orka Solar (Pty) Ltd.</td>
                    </tr>
                    <tr>
                      <td style={{ padding: '3px' }}>Branch:</td>
                      <td style={{ padding: '3px' }}>ABSA Mooinooi Mall</td>
                    </tr>
                    <tr>
                      <td style={{ padding: '3px' }}>Account name:</td>
                      <td style={{ padding: '3px' }}>Orka Solar (PTY) Ltd</td>
                    </tr>
                    <tr>
                      <td style={{ padding: '3px' }}>Account type:</td>
                      <td style={{ padding: '3px' }}>Cheque</td>
                    </tr>
                    <tr>
                      <td style={{ padding: '3px' }}>Account number:</td>
                      <td style={{ padding: '3px' }}>409 240 5135</td>
                    </tr>
                  </tbody>
                </table>

                <table
                  style={{ width: '48%', border: '1px solid black', borderCollapse: 'collapse' }}
                >
                  <tbody>
                    <tr>
                      <td style={{ height: '100px', verticalAlign: 'bottom', textAlign: 'center' }}>
                        Client acceptance: signature & date
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      {/* Print CSS */}
<style type="text/css" media="print">
  {`
  @media print {
    /* Hard reset: some global CSS is doing body * { visibility:hidden } */
    html, body, body * {
      visibility: visible !important;
    }

    /* Hide only the non-print UI */
    .no-print {
      display: none !important;
      visibility: hidden !important;
    }

    @page {
      size: A4;
      margin: 1.5cm;
    }

    /* Make the table header repeat on every page */
    thead { display: table-header-group; }

    /* Normal table pagination */
    table { page-break-inside: auto; width: 100%; border-collapse: collapse; }
    tr    { page-break-inside: avoid; page-break-after: auto; }

    /* Ensure greys/backgrounds print */
    tr[style*="background-color"],
    th, td, div {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
  }
  `}
</style>

    </div>
  );
}

export default PrintableBOM;
