// src/components/sections/BOMSection.js
import React, { useEffect, useMemo, useState, useLayoutEffect, useRef } from "react";
import axios from "axios";
import StandardPage from "./StandardPage";
import { API_URL } from "../../apiConfig";

const slugify = (t) =>
  String(t || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

// nice label for categories stored as slugs
const pretty = (s) => (s || "").replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());

// Non-breaking space
const NBSP = "\u00A0";

const formatCurrency = (v = 0) => {
  const sign = v < 0 ? "-" : "";
  const num = Math.abs(v).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })
  // commas -> NBSP thousands separators
  .replace(/,/g, NBSP);

  // R + NBSP + number (all glued with NBSP so it never breaks)
  return `${sign}R${NBSP}${num}`;
};

export default function BOMSection({ data, settings, startPageNumber = 16, totalPages = 24 }) {
  const projectId = data?.project?.id;
  const priceMode = settings?.bomPriceMode || 'none';
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
            return { 
              product: prod, 
              quantity: Number(row.quantity) || 1,
              unitPrice: Number(prod.price ?? 0),
            };
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
  // const compactRows = useMemo(() => {
  //   const byId = new Map();
  //   for (const r of rows) {
  //     const p = r.product || {};
  //     const name = [p.brand, p.model].filter(Boolean).join(" ").trim() || p.name || "Unnamed product";
  //     if (!byId.has(p.id)) byId.set(p.id, { id: p.id, name, qty: 0 });
  //     byId.get(p.id).qty += r.quantity || 0;
  //   }
  //   return Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name));
  // }, [rows]);

  // ---- Group by category and compact duplicates within category ----
  const grouped = useMemo(() => {
    const byCat = new Map();
    for (const r of rows) {
      const p = r.product || {};
      const cat = p.category || "other";
      if (!byCat.has(cat)) byCat.set(cat, new Map()); // item map by product id
      const map = byCat.get(cat);
      if (!map.has(p.id)) map.set(p.id, {
        id: p.id,
        name: [p.brand, p.model].filter(Boolean).join(" ").trim() || p.name || "Unnamed product",
        qty: 0,
        unitPrice: Number(r.unitPrice || 0)
      });
      const item = map.get(p.id);
      item.qty += r.quantity || 0;
    }
    // compute category totals (for 'category' mode)
    const out = [];
    for (const [cat, itemsMap] of Array.from(byCat.entries()).sort((a,b)=>a[0].localeCompare(b[0]))) {
      const items = Array.from(itemsMap.values()).sort((a,b)=>a.name.localeCompare(b.name));
      const catTotal = items.reduce((s,i)=>s + i.qty * (i.unitPrice||0), 0);
      out.push({ type: 'category', cat, label: pretty(cat), total: catTotal });
      items.forEach(i => out.push({ type: 'item', ...i }));
    }
    return out;
  }, [rows]);  


  // ---- Measure available content height correctly (inside .orka-page-content) ----
  const measureShellRef = useRef(null);
  const headRef = useRef(null);
  const itemRowRef = useRef(null);
  const catRowRef = useRef(null);
  const [pageHeights, setPageHeights] = useState({ contentH: 0, headH: 0, itemH: 10, catH: 18 });
  const [rowsPerPage, setRowsPerPage] = useState(0);

  useLayoutEffect(() => {
    if (!measureShellRef.current) return;
    const raf = requestAnimationFrame(() => {
      const pageEl = measureShellRef.current;
      const contentEl = pageEl.querySelector(".orka-page-content");
      if (!contentEl || !headRef.current || !itemRowRef.current || !catRowRef.current) return;

      const contentH = contentEl.clientHeight;
      const headH = headRef.current.getBoundingClientRect().height || 18;
      const itemH = itemRowRef.current.getBoundingClientRect().height || 16;
      const catH  = catRowRef.current.getBoundingClientRect().height  || itemH;

      setPageHeights({ contentH, headH, itemH, catH });
    });
    return () => cancelAnimationFrame(raf);
  }, [loading, grouped.length, priceMode]);

  // ---- Split rows into pages ----
  const pages = useMemo(() => {
    const { contentH, headH, itemH, catH } = pageHeights;
    if (!contentH) return [[]];

    const rowsPerPage = [];
    let current = [];
    let rem = contentH - headH;

    const pushPage = () => {
      if (current.length) rowsPerPage.push(current);
      current = [];
      rem = contentH - headH;
    };

    for (const r of grouped) {
      const h = r.type === 'category' ? catH : itemH;
      if (h > rem) pushPage();
      current.push(r);
      rem -= h;
    }
    if (current.length) rowsPerPage.push(current);
    return rowsPerPage.length ? rowsPerPage : [[]];
  }, [grouped, pageHeights]);    

  const showTotalColumn = priceMode !== 'none';
  const showLineTotals  = priceMode === 'line';

  // ---- Hidden measurer: full StandardPage shell so we get real content height ----
  const Measurer = () => (
    <div className="bom-measurer no-print" aria-hidden="true"
         style={{ position: "absolute", visibility: "hidden", pointerEvents: "none", inset: 0 }}
         ref={measureShellRef}>
      <StandardPage header="Bill of Materials" className="bom-dense" data={data}>
        <table className="bom-compact-table">
          <thead ref={headRef}>
            <tr>
              <th className="bom-prod-col">Product</th>
              <th className="bom-qty-col">Qty</th>
              {showTotalColumn && (
                <th style={{ width: 94, textAlign: "right" }}>Total</th>
              )}
            </tr>
          </thead>
          <tbody>
            {/* Category sample row */}
            <tr ref={catRowRef}>
              <td colSpan={2}><strong>Category</strong></td>
              {showTotalColumn && <td style={{ textAlign: "right" }}>{formatCurrency(0)}</td>}
            </tr>

            {/* Item sample row */}
            <tr ref={itemRowRef}>
              <td>Example product name</td>
              <td style={{ textAlign: "right" }}>9</td>
              {showTotalColumn && (
                // Only show a number in line mode; keep cell empty in category-only mode
                <td style={{ textAlign: "right" }}>
                  {showLineTotals ? formatCurrency(0) : ""}
                </td>
              )}
            </tr>
          </tbody>
        </table>
      </StandardPage>
    </div>
  );

  // ---- Render ----
  if (loading) {
    return (
      <StandardPage header="Bill of Materials" className="bom-dense" data={data} pageNumber={startPageNumber} totalPages={totalPages}>
        <div className="text-center text-muted py-2">Loading BOM…</div>
        <Measurer />
      </StandardPage>
    );
  }

  if (!grouped.length) {
    return (
      <StandardPage header="Bill of Materials" className="bom-dense" data={data} pageNumber={startPageNumber} totalPages={totalPages}>
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
          pageNumber={startPageNumber + idx}
          totalPages={totalPages}
        >
          <div className="table-responsive">
            <table className="bom-compact-table">
              <thead>
                <tr>
                  <th className="bom-prod-col">Product</th>
                  <th className="bom-qty-col">Qty</th>
                  {showTotalColumn && (
                    <th style={{ width: 80, textAlign: "right" }}>Total</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {pageRows.map((r, i) => {
                  if (r.type === "category") {
                    return (
                      <tr key={`cat-${idx}-${i}`} style={{ background: "#f7f7f7" }}>
                        <td colSpan={2}>
                          <strong>{r.label}</strong>
                        </td>
                        {showTotalColumn && (
                          <td style={{ textAlign: "right", fontWeight: 700 }}>
                            {formatCurrency(r.total)}
                          </td>
                        )}
                      </tr>
                    );
                  }
                
                  const lineTotal = r.qty * (r.unitPrice || 0);
                  return (
                    <tr key={`row-${idx}-${i}`}>
                      <td className="bom-prod-cell">{r.name}</td>
                      <td className="bom-qty-cell">{r.qty}</td>
                      {showTotalColumn && (
                        <td style={{ textAlign: "right" }}>
                          {showLineTotals ? formatCurrency(lineTotal) : ""}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </StandardPage>
      ))}
      <Measurer />
    </>
  );
}
