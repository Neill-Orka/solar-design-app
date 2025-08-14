// src/components/sections/BOMSection.js
import React, { useEffect, useMemo, useState, useLayoutEffect, useRef } from "react";
import axios from "axios";
import StandardPage from "./StandardPage";
import { API_URL } from "../../apiConfig";

const slugify = (t) =>
  String(t || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

export default function BOMSection({ data }) {
  const projectId = data?.project?.id;
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  // ---- Load BOM + join products ----
  useEffect(() => {
    if (!projectId) return;
    (async () => {
      setLoading(true);
      try {
        const productsRes = await axios.get(`${API_URL}/api/products`);
        const products = (productsRes.data || []).map((p) => ({
          ...p,
          category: slugify(p.category),
        }));
        const bomRes = await axios.get(`${API_URL}/api/projects/${projectId}/bom`);
        const list = bomRes.data || [];
        const joined = list
          .map((row) => {
            const prod = products.find((p) => p.id === row.product_id);
            if (!prod) return null;
            return { product: prod, quantity: Number(row.quantity) || 1 };
          })
          .filter(Boolean);
        setRows(joined);
      } catch {
        setRows([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [projectId]);

  // ---- Compact unique rows (Product + total Qty) ----
  const compactRows = useMemo(() => {
    const byId = new Map();
    for (const r of rows) {
      const p = r.product || {};
      const name = [p.brand, p.model].filter(Boolean).join(" ").trim() || p.name || "Unnamed product";
      if (!byId.has(p.id)) byId.set(p.id, { id: p.id, name, qty: 0 });
      byId.get(p.id).qty += r.quantity || 0;
    }
    return Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [rows]);

  // ---- Measure available content height correctly (inside .orka-page-content) ----
  const measureShellRef = useRef(null);
  const headRef = useRef(null);
  const rowRef = useRef(null);
  const [rowsPerPage, setRowsPerPage] = useState(0);

  useLayoutEffect(() => {
    if (!measureShellRef.current) return;

    // Wait for layout to settle
    const raf = requestAnimationFrame(() => {
      const pageEl = measureShellRef.current;
      const contentEl = pageEl.querySelector(".orka-page-content");
      if (!contentEl || !headRef.current || !rowRef.current) return;

      const contentH = contentEl.clientHeight;            // available space for table
      const headH = headRef.current.getBoundingClientRect().height || 18;
      const rowH = rowRef.current.getBoundingClientRect().height || 16;

      const fit = Math.max(1, Math.floor((contentH - headH) / rowH));
      setRowsPerPage(Math.min(fit, 1000)); // safety cap
    });

    return () => cancelAnimationFrame(raf);
  }, [loading, compactRows.length]);

  // ---- Split rows into pages ----
  const pages = useMemo(() => {
    const rpp = rowsPerPage || 40; // sensible fallback
    const chunks = [];
    for (let i = 0; i < compactRows.length; i += rpp) chunks.push(compactRows.slice(i, i + rpp));
    return chunks.length ? chunks : [[]];
  }, [compactRows, rowsPerPage]);

  // ---- Hidden measurer: full StandardPage shell so we get real content height ----
  const Measurer = () => (
    <div className="bom-measurer no-print" aria-hidden="true" style={{ position: "absolute", visibility: "hidden", pointerEvents: "none", inset: 0 }} ref={measureShellRef}>
      <StandardPage header="Bill of Materials" className="bom-dense" data={data}>
        <table className="bom-compact-table">
          <thead ref={headRef}>
            <tr>
              <th className="bom-prod-col">Product</th>
              <th className="bom-qty-col">Qty</th>
            </tr>
          </thead>
          <tbody>
            <tr ref={rowRef}>
              <td className="bom-prod-cell">Example product name for measurement</td>
              <td className="bom-qty-cell">99</td>
            </tr>
          </tbody>
        </table>
      </StandardPage>
    </div>
  );

  // ---- Render ----
  if (loading) {
    return (
      <StandardPage header="Bill of Materials" className="bom-dense" data={data}>
        <div className="text-center text-muted py-2">Loading BOM…</div>
        <Measurer />
      </StandardPage>
    );
  }

  if (compactRows.length === 0) {
    return (
      <StandardPage header="Bill of Materials" className="bom-dense" data={data}>
        <div className="text-center text-muted py-2">No saved BOM for this project.</div>
        <Measurer />
      </StandardPage>
    );
  }

  return (
    <>
      {pages.map((pageRows, idx) => (
        <StandardPage
          key={idx}
          header={`Bill of Materials ${pages.length > 1 ? `(${idx + 1}/${pages.length})` : ""}`}
          className="bom-dense"
          data={data}
        >
          <div className="table-responsive">
            <table className="bom-compact-table">
              <thead>
                <tr>
                  <th className="bom-prod-col">Product</th>
                  <th className="bom-qty-col">Qty</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((r) => (
                  <tr key={r.id}>
                    <td className="bom-prod-cell">{r.name}</td>
                    <td className="bom-qty-cell">{r.qty}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </StandardPage>
      ))}
      <Measurer />
    </>
  );
}
