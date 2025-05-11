/* ----------  Reporting.js  ---------- */
import React, { useEffect, useState, useRef, useMemo } from 'react';
import axios from 'axios';

/* pdfmake (robust import) */
import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';
import logo from './assets/orka_logo_transparent_background.png';

/* Chart.js */
import { Line, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Tooltip,
  Legend
} from 'chart.js';
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Tooltip, Legend);

/* logo */
pdfMake.vfs = (pdfFonts.pdfMake ? pdfFonts.pdfMake.vfs : pdfFonts.default);

/* helper to load image → base‑64 */
const toBase64 = src =>
  fetch(src)
    .then(r => r.blob())
    .then(
      blob =>
        new Promise(res => {
          const fr = new FileReader();
          fr.onload = () => res(fr.result);
          fr.readAsDataURL(blob);
        })
    );

function Reporting({ projectId }) {
  /* ------------ state ------------ */
  const [project, setProject]       = useState(null);
  const [simulation, setSimulation] = useState(null);
  const [financial, setFinancial]   = useState(null);
  const [inverter, setInverter]     = useState(null);

  /* chart refs + captured images */
  const simRef   = useRef(null);
  const dailyRef = useRef(null);
  const [simImg,   setSimImg]   = useState(null);
  const [dailyImg, setDailyImg] = useState(null);

  /* ------------ load project + sim + finance ------------ */
  useEffect(() => {
    axios.get(`http://localhost:5000/api/projects/${projectId}`)
      .then(r => {
        setProject(r.data);

        /* fetch inverter meta for BOM */
        axios
          .get('http://localhost:5000/api/products?category=inverter')
          .then(res => {
            const match = res.data.find(p => p.rating_kva === r.data.inverter_kva);
            setInverter(match || null);
          })
          .catch(() => {});

        /* call financial endpoint */
        axios
          .post('http://localhost:5000/api/financial_model', {
            project_id: projectId,
            tariff: 2.2,
            export_enabled: false,
            feed_in_tariff: 1.0
          })
          .then(resF => setFinancial(resF.data))
          .catch(() => {});
      })
      .catch(err => console.error('Project load error', err));

    /* cached sim */
    const cached = sessionStorage.getItem(`simulationData_${projectId}`);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (parsed.timestamps) setSimulation(parsed);
      } catch {/* ignore */}
    }
  }, [projectId]);

  /* ------------ build dailyEnergyMap ------------- */
  const dailyEnergyMap = useMemo(() => {
    if (!simulation?.timestamps) return null;
    const map = {};
    simulation.timestamps.forEach((ts, i) => {
      const d = ts.split('T')[0];
      if (!map[d]) map[d] = 0;
      map[d] += simulation.demand[i] * 0.5; // kWh
    });
    return map;
  }, [simulation]);

  /* ------------ capture chart images once rendered ------------ */
  useEffect(() => {
    if (simulation && simRef.current && !simImg) {
      setSimImg(simRef.current.toBase64Image());
    }
    if (dailyEnergyMap && dailyRef.current && !dailyImg) {
      setDailyImg(dailyRef.current.toBase64Image());
    }
  }, [simulation, dailyEnergyMap, simImg, dailyImg]);

  /* ------------ helpers ------------ */
  const sumKwh = arr => (arr?.reduce((s, v) => s + v, 0) * 0.5).toFixed(0);

  /* ------------ PDF generation ------------ */
  const generatePdf = async () => {
    if (!project) return;

    const logoB64 = await toBase64(logo);
    const capex   = project.project_value_excl_vat || 0;
    const firstYr = financial?.annual_savings || 0;
    const payback = financial ? financial.payback_years.toFixed(1) : '-';
    const roi20   = financial ? financial.roi_20yr.toFixed(1) : '-';

    /* small BOM array */
    const bom = [
      ['PV Modules', `${project.panel_kw} kWp (generic)`, '1 lot'],
      ['Inverter', inverter ? `${inverter.brand} ${inverter.model}` : `${project.inverter_kva} kVA`, '1'],
      ...(project.system_type !== 'grid' && project.battery_kwh > 0
        ? [['Battery', `${project.battery_kwh} kWh (generic)`, '1']]
        : [])
    ];

    const doc = {
      pageMargins: [40, 60, 40, 60],
      content: [
        /* --- cover --- */
        { image: logoB64, width: 140, alignment: 'center', margin: [0, 0, 0, 20] },
        { text: 'Solar PV System Design Report', style: 'h1', alignment: 'center', margin: [0, 0, 0, 30] },

        /* --- project info --- */
        { text: 'Project Information', style: 'h2' },
        {
          ul: [
            `Client: ${project.client_name}`,
            `Location: ${project.location}`,
            `System Type: ${project.system_type}`,
            `Size: ${project.panel_kw} kWp • ${project.inverter_kva} kVA` +
              (project.battery_kwh && project.system_type !== 'grid' ? ` • Battery ${project.battery_kwh} kWh` : '')
          ],
          margin: [0, 5, 0, 15]
        },

        /* --- executive summary --- */
        { text: 'Executive Summary', style: 'h2', margin: [0, 10, 0, 5] },
        {
          table: {
            widths: ['*', '*'],
            body: [
              ['CAPEX (ex-VAT)', `R ${capex.toLocaleString()}`],
              ['1st-Year Savings', `R ${firstYr.toLocaleString()}`],
              ['Payback (yrs)', payback],
              ['20-yr ROI (%)', roi20]
            ]
          },
          layout: 'lightHorizontalLines',
          margin: [0, 0, 0, 15]
        },

        /* --- simulation chart --- */
        simImg && { text: 'System Simulation', style: 'h2', margin: [0, 10, 0, 5] },
        simImg && { image: simImg, width: 500 },

        /* --- daily energy bar --- */
        dailyImg && { text: 'Daily Load Variability', style: 'h2', margin: [0, 15, 0, 5] },
        dailyImg && { image: dailyImg, width: 500 },

        /* --- BOM --- */
        { text: 'Bill of Materials', style: 'h2', margin: [0, 20, 0, 5] },
        {
          table: {
            headerRows: 1,
            widths: ['*', '*', 'auto'],
            body: [
              [{ text: 'Item', bold: true }, { text: 'Specification', bold: true }, { text: 'Qty', bold: true }],
              ...bom
            ]
          },
          layout: 'lightHorizontalLines'
        }
      ],
      styles: {
        h1: { fontSize: 20, bold: true },
        h2: { fontSize: 14, bold: true }
      }
    };

    pdfMake.createPdf(doc).download(`Project_${projectId}_Report.pdf`);
  };

  /* ------------ render ------------ */
  return (
    <div className="container">
      <h4>Reporting</h4>
      {!project && <p>Loading project…</p>}
      {project && (
        <>
          <p>
            <strong>Client:</strong> {project.client_name}<br />
            <strong>Location:</strong> {project.location}<br />
            <strong>System:</strong> {project.panel_kw} kWp • {project.inverter_kva} kVA
            {project.battery_kwh && project.system_type !== 'grid' && ` • Battery ${project.battery_kwh} kWh`}
          </p>
          <button className="btn btn-primary" onClick={generatePdf} disabled={!simImg || !dailyImg}>
            {simImg && dailyImg ? 'Download PDF Report' : 'Preparing charts…'}
          </button>
        </>
      )}

      {/* ---- hidden canvases for screenshot ---- */}
      <div style={{ position: 'absolute', left: '-9999px', top: 0 }}>
        {simulation && (
          <Line
            ref={simRef}
            data={{
              labels: simulation.timestamps,
              datasets: [
                { label: 'Demand', data: simulation.demand, borderColor: 'red', pointRadius: 0, tension: 0.2 },
                { label: 'PV Gen', data: simulation.generation, borderColor: 'green', pointRadius: 0, tension: 0.2 },
                { label: 'SOC %', data: simulation.battery_soc, borderColor: 'orange', yAxisID: 'soc', pointRadius: 0, tension: 0.2 }
              ]
            }}
            options={{ responsive: false, animation: false, scales: { soc: { position: 'right', min: 0, max: 100 } } }}
          />
        )}

        {dailyEnergyMap && (
          <Bar
            ref={dailyRef}
            data={{
              labels: Object.keys(dailyEnergyMap),
              datasets: [{ label: 'Daily kWh', data: Object.values(dailyEnergyMap), backgroundColor: 'steelblue' }]
            }}
            options={{ responsive: false, animation: false }}
          />
        )}
      </div>
    </div>
  );
}

export default Reporting;
