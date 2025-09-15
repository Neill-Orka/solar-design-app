import React from 'react';
import type { JobCardUI } from '../JobCardUI.types';

type Props = {
  model: JobCardUI;
  products: Array<{ id: number; label: string; price: number }>;
};

const MaterialsSection: React.FC<Props> = ({ model, products }) => {
  return (
    <section className="glass-card p-3 p-md-4">
      <div className="d-flex align-items-center justify-content-between">
        <h5 className="mb-1"><i className="bi bi-box-seam me-2" />Materials</h5>
        <button className="btn btn-sm btn-outline-primary" disabled>
          <i className="bi bi-plus-lg me-1" /> Add item
        </button>
      </div>
      <div className="text-secondary small mb-3">Log parts & consumables used on site</div>

      <div className="table-responsive">
        <table className="table table-sm align-middle">
          <thead className="table-light">
            <tr>
              <th style={{minWidth: 220}}>Product</th>
              <th>Qty</th>
              <th>Unit Price</th>
              <th>Line Total</th>
              <th>Note</th>
              <th style={{width: 40}}></th>
            </tr>
          </thead>
          <tbody>
            {(model.materials || []).map((m) => (
              <tr key={m.id}>
                <td>
                  <select className="form-select form-select-sm" value={m.product_id} disabled>
                    {products.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                  </select>
                </td>
                <td style={{maxWidth: 80}}>
                  <input className="form-control form-control-sm" value={m.quantity} disabled />
                </td>
                <td>R {m.unit_price_at_time.toFixed(2)}</td>
                <td className="fw-semibold">R {m.line_total.toFixed(2)}</td>
                <td>
                  <input className="form-control form-control-sm" value={m.note || ''} disabled />
                </td>
                <td><button className="btn btn-sm btn-outline-secondary" disabled><i className="bi bi-trash" /></button></td>
              </tr>
            ))}
            {model.materials?.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center text-muted py-3">No materials captured</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
};

export default MaterialsSection;
