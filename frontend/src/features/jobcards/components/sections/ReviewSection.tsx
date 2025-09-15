import React from 'react';
import type { JobCardUI } from '../JobCardUI.types';

type Props = {
  model: JobCardUI;
  totals: { labour: number; materials: number; travel: number; subtotal: number; vat: number; total: number };
};

const ItemRow: React.FC<{ label: string; value: number; strong?: boolean }> = ({ label, value, strong }) => (
  <div className="d-flex justify-content-between py-1">
    <span className={strong ? 'fw-semibold' : ''}>{label}</span>
    <span className={strong ? 'fw-semibold' : ''}>R {value.toFixed(2)}</span>
  </div>
);

const ReviewSection: React.FC<Props> = ({ totals }) => {
  return (
    <section className="glass-card p-3 p-md-4">
      <h5 className="mb-1"><i className="bi bi-cash-coin me-2" />Review & Totals</h5>
      <div className="text-secondary small mb-3">Final glance before submitting / invoicing</div>

      <div className="row g-3">
        <div className="col-12 col-md-6">
          <div className="p-3 rounded border bg-white h-100">
            <div className="small text-muted mb-2">Summary</div>
            <ItemRow label="Labour" value={totals.labour} />
            <ItemRow label="Materials" value={totals.materials} />
            <ItemRow label="Travel" value={totals.travel} />
            <hr className="my-2" />
            <ItemRow label="Subtotal" value={totals.subtotal} strong />
            <ItemRow label="VAT (15%)" value={totals.vat} />
            <div className="pt-2 border-top mt-2">
              <div className="d-flex justify-content-between">
                <span className="fs-6 fw-bold">Total</span>
                <span className="fs-6 fw-bold">R {totals.total.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="col-12 col-md-6">
          <div className="p-3 rounded border bg-white h-100">
            <div className="small text-muted mb-2">Submission</div>
            <div className="d-grid gap-2">
              <button className="btn btn-outline-secondary" disabled>
                <i className="bi bi-cloud-arrow-down me-1" /> Save as draft
              </button>
              <button className="btn btn-primary" disabled>
                <i className="bi bi-send-check me-1" /> Submit for invoicing
              </button>
              <button className="btn btn-outline-dark" disabled>
                <i className="bi bi-filetype-pdf me-1" /> Preview PDF
              </button>
            </div>
            <div className="form-text mt-2">
              Buttons are placeholders — wiring to backend comes later.
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ReviewSection;
