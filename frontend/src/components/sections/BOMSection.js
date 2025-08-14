// src/components/sections/BOMSection.js
import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import StandardPage from "./StandardPage";
import { API_URL } from "../../apiConfig";

const slugify = (t) =>
  String(t || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

export default function BOMSection({ data }) {
  const projectId = data?.project?.id;
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!projectId) return;
    (async () => {
      setLoading(true);
      try {
        // 1) Get products (for names)
        const productsRes = await axios.get(`${API_URL}/api/products`);
        const products = (productsRes.data || []).map((p) => ({
          ...p,
          category: slugify(p.category),
        }));

        // 2) Get saved BOM snapshot
        const bomRes = await axios.get(`${API_URL}/api/projects/${projectId}/bom`);
        const list = bomRes.data || [];

        // Join BOM rows → product details
        const joined = list
          .map((row) => {
            const prod = products.find((p) => p.id === row.product_id);
            if (!prod) return null;
            return {
              product: prod,
              quantity: Number(row.quantity) || 1,
            };
          })
          .filter(Boolean);

        setRows(joined);
      } catch (e) {
        console.warn("BOMSection load failed:", e);
        setRows([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [projectId]);

  // Aggregate duplicates by product id and keep only a display name + total qty
  const compactRows = useMemo(() => {
    const byId = new Map();
    for (const r of rows) {
      const p = r.product || {};
      const display =
        [p.brand, p.model].filter(Boolean).join(" ").trim() ||
        p.name ||
        "Unnamed product";

      if (!byId.has(p.id)) byId.set(p.id, { id: p.id, name: display, qty: 0 });
      byId.get(p.id).qty += r.quantity || 0;
    }
    return Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [rows]);

  return (
    <StandardPage header="Bill of Materials" className="bom-dense" data={data} pageNumber={16}>
      <h6 className='fw-bold'>Bill of Materials</h6>
      {loading ? (
        <div className="text-center text-muted py-2">Loading BOM…</div>
      ) : compactRows.length === 0 ? (
        <div className="text-center text-muted py-2">No saved BOM for this project.</div>
      ) : (
        <div className="table-responsive">
          <table className="bom-compact-table">
            <thead>
              <tr>
                <th className="bom-prod-col">Product</th>
                <th className="bom-qty-col">Qty</th>
              </tr>
            </thead>
            <tbody>
              {compactRows.map((r) => (
                <tr key={r.id}>
                  <td className="bom-prod-cell">{r.name}</td>
                  <td className="bom-qty-cell">{r.qty}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </StandardPage>
  );
}
