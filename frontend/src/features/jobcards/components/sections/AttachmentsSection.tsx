import React from 'react';
import type { JobCardUI } from '../JobCardUI.types';

type Props = { model: JobCardUI };

const AttachmentsSection: React.FC<Props> = ({ model }) => {
  return (
    <section className="glass-card p-3 p-md-4">
      <div className="d-flex align-items-center justify-content-between">
        <h5 className="mb-1"><i className="bi bi-images me-2" />Photos</h5>
        <button className="btn btn-sm btn-outline-primary" disabled>
          <i className="bi bi-upload me-1" /> Upload
        </button>
      </div>
      <div className="text-secondary small mb-3">Snap the DB, inverter labels, connections, array & signage</div>

      <div className="row g-3">
        {model.attachments.map(a => (
          <div className="col-6 col-md-4 col-lg-3" key={a.id}>
            <div className="card shadow-sm border-0 overflow-hidden">
              <div className="ratio ratio-1x1 bg-light">
                <div className="placeholder col-12" />
              </div>
              <div className="card-body py-2">
                <div className="small text-truncate">{a.filename}</div>
              </div>
            </div>
          </div>
        ))}
        {model.attachments.length === 0 && (
          <div className="col-12">
            <div className="text-center text-muted py-3">No photos yet</div>
          </div>
        )}
      </div>
    </section>
  );
};

export default AttachmentsSection;
