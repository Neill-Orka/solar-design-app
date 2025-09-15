import React from 'react';
import type { JobCardUI, JobPriority, JobCardStatus } from '../JobCardUI.types';

type Props = {
  model: JobCardUI;
  STATUS_OPTIONS: JobCardStatus[];
  PRIORITY_OPTIONS: JobPriority[];
};

const OverviewSection: React.FC<Props> = ({ model }) => {
  return (
    <section className="glass-card p-3 p-md-4">
      <div className="d-flex align-items-start justify-content-between gap-3">
        <div>
          <h5 className="mb-1"><i className="bi bi-clipboard2-check me-2" />Overview</h5>
          <div className="text-secondary small">High-level summary and quick context</div>
        </div>
        <span className="badge bg-light text-dark border">
          <i className="bi bi-clock me-1" />
          Updated {new Date(model.updated_at).toLocaleString()}
        </span>
      </div>

      <hr className="text-muted opacity-25" />

      <div className="row g-3">
        <div className="col-12">
          <div className="p-3 rounded border bg-white">
            <div className="small text-muted mb-1">Description</div>
            <div>{model.description}</div>
          </div>
        </div>

        <div className="col-6 col-md-3">
          <div className="p-3 rounded border bg-white h-100">
            <div className="small text-muted mb-1">Status</div>
            <div className="fw-semibold">
              <span className={`badge bg-${model.status === 'open' ? 'info' : model.status === 'completed' ? 'success' : model.status === 'invoiced' ? 'primary' : 'dark'}`}>
                {model.status}
              </span>
            </div>
          </div>
        </div>

        <div className="col-6 col-md-3">
          <div className="p-3 rounded border bg-white h-100">
            <div className="small text-muted mb-1">Priority</div>
            <div className="fw-semibold text-capitalize">{model.priority}</div>
          </div>
        </div>

        <div className="col-6 col-md-3">
          <div className="p-3 rounded border bg-white h-100">
            <div className="small text-muted mb-1">Start (planned)</div>
            <div>{model.start_at ? new Date(model.start_at).toLocaleString() : '—'}</div>
          </div>
        </div>

        <div className="col-6 col-md-3">
          <div className="p-3 rounded border bg-white h-100">
            <div className="small text-muted mb-1">Completion</div>
            <div>{model.complete_at ? new Date(model.complete_at).toLocaleString() : '—'}</div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default OverviewSection;
