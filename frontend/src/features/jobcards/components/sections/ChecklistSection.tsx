import React from 'react';
import type { JobCardUI } from '../JobCardUI.types';

type Props = { model: JobCardUI };

const ChecklistSection: React.FC<Props> = ({ model }) => {
  return (
    <section className="glass-card p-3 p-md-4">
      <h5 className="mb-1"><i className="bi bi-ui-checks-grid me-2" />Checklist & Sign-off</h5>
      <div className="text-secondary small mb-3">Safety and QA checks before completing job</div>

      <div className="row g-3">
        <div className="col-12 col-md-6">
          <div className="p-3 rounded border bg-white h-100">
            <div className="mb-2 small text-muted">Checks</div>
            <ul className="list-unstyled d-flex flex-column gap-2 mb-0">
              {model.checklist.map(item => (
                <li key={item.key} className="d-flex align-items-center gap-2">
                  <input type="checkbox" className="form-check-input" checked={item.checked} disabled />
                  <span>{item.label}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="col-12 col-md-6">
          <div className="p-3 rounded border bg-white h-100">
            <div className="mb-2 small text-muted">Client signature</div>
            <div className="border rounded ratio ratio-21x9 bg-light d-flex align-items-center justify-content-center">
              <span className="text-muted">Signature pad placeholder</span>
            </div>
            <div className="form-text">Client signs to confirm work done</div>
          </div>
        </div>

        <div className="col-12">
          <label className="form-label">Technician notes</label>
          <textarea className="form-control" rows={5} placeholder="Observations, serials, readings…" disabled />
        </div>
      </div>
    </section>
  );
};

export default ChecklistSection;
