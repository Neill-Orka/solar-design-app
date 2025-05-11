import React, { useEffect, useState } from 'react';
import axios from 'axios';
import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';
import logo from './assets/orka_logo_transparent_background.png'; // adjust path if needed

pdfMake.vfs = (pdfFonts.pdfMake ? pdfFonts.pdfMake.vfs : pdfFonts.default);


function Reporting({ projectId }) {
  const [project, setProject] = useState(null);
  const [simulation, setSimulation] = useState(null);

  useEffect(() => {
    // Load project
    axios.get(`http://localhost:5000/api/projects/${projectId}`)
      .then(res => setProject(res.data))
      .catch(err => console.error('Failed to load project', err));

    // Load simulation from sessionStorage
    const cached = sessionStorage.getItem(`simulationData_${projectId}`);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        setSimulation(parsed);
      } catch (err) {
        console.error('Error parsing cached simulation data:', err);
      }
    }
  }, [projectId]);

  const generatePdf = async () => {
    const logoDataUrl = await toBase64(logo);

    const docDefinition = {
      content: [
        {
          image: logoDataUrl,
          width: 120,
          alignment: 'center',
          margin: [0, 0, 0, 20]
        },
        { text: 'Project Report', style: 'header', alignment: 'center' },
        { text: `Client: ${project.client_name}`, margin: [0, 10, 0, 0] },
        { text: `Location: ${project.location}` },
        { text: `System Type: ${project.system_type}` },
        { text: `Panel: ${project.panel_kw} kWp` },
        { text: `Inverter: ${project.inverter_kva} kVA` },
        ...(project.system_type !== 'grid' && project.battery_kwh > 0
          ? [{ text: `Battery: ${project.battery_kwh} kWh` }]
          : []),

        { text: '\nSimulation Summary', style: 'subheader' },
        ...(simulation?.timestamps?.length
          ? [
              { text: `Period: ${simulation.timestamps[0].split('T')[0]} to ${simulation.timestamps.at(-1).split('T')[0]}` },
              { text: `Total Demand: ${sum(simulation.demand).toFixed(0)} kWh` },
              { text: `Total PV Generation: ${sum(simulation.generation).toFixed(0)} kWh` },
              { text: `Grid Import: ${sum(simulation.import_from_grid).toFixed(0)} kWh` },
              { text: `Grid Export: ${sum(simulation.export_to_grid).toFixed(0)} kWh` }
            ]
          : [{ text: 'No simulation data available.', italics: true }])
      ],
      styles: {
        header: {
          fontSize: 18,
          bold: true
        },
        subheader: {
          fontSize: 14,
          bold: true,
          margin: [0, 20, 0, 8]
        }
      }
    };

    pdfMake.createPdf(docDefinition).download(`project_${projectId}_report.pdf`);
  };

  const toBase64 = (imgPath) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      fetch(imgPath)
        .then(res => res.blob())
        .then(blob => {
          reader.readAsDataURL(blob);
          reader.onloadend = () => resolve(reader.result);
        })
        .catch(err => reject(err));
    });
  };

  const sum = arr => arr?.reduce((a, b) => a + b, 0) * 0.5;

  return (
    <div className="container">
      <h4>Reporting</h4>

      {!project && <p>Loading project info...</p>}
      {project && (
        <>
          <p>
            <strong>Client:</strong> {project.client_name}<br />
            <strong>Location:</strong> {project.location}<br />
            <strong>System:</strong> {project.system_type}, {project.panel_kw} kWp, {project.inverter_kva} kVA
            {project.battery_kwh && project.system_type !== 'grid' && `, Battery: ${project.battery_kwh} kWh`}
          </p>

          <button className="btn btn-primary" onClick={generatePdf}>
            Download PDF Report
          </button>
        </>
      )}
    </div>
  );
}

export default Reporting;
