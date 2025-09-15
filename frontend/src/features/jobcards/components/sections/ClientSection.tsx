import React from 'react';
import type { JobCardUI } from '../JobCardUI.types';

type Props = {
  model: JobCardUI;
  clients: Array<{ id: number; name: string; email: string }>;
};

const ClientSection: React.FC<Props> = ({ model, clients }) => {
  return (
    <section className="glass-card p-3 p-md-4">
      <h5 className="mb-1"><i className="bi bi-person-badge me-2" />Client & Site</h5>
      <div className="text-secondary small mb-3">Choose client and capture site info</div>
      <div className="row g-3">
        <div className="col-md-6">
          <label className="form-label">Client</label>
          <select className="form-select" value={model.client_id ?? ''} disabled>
            <option value="">Select…</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="col-md-6">
          <label className="form-label">Contact email</label>
          <input className="form-control" value={model.client_email || ''} placeholder="client@email" disabled />
        </div>
        <div className="col-12">
          <label className="form-label">Site address</label>
          <input className="form-control" value={model.client_address || ''} placeholder="Street, Suburb, City" disabled />
        </div>
        <div className="col-12">
          <label className="form-label">On-site instructions</label>
          <textarea className="form-control" rows={5} placeholder="Access, safety, keys, parking…" disabled />
        </div>
      </div>
    </section>
  );
};

export default ClientSection;
