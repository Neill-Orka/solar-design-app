import React from 'react';
import type { JobCardUI } from '../JobCardUI.types';

type Props = {
  model: JobCardUI;
  vehicles: Array<{ id: number; name: string; reg: string; rate_per_km: number }>;
};

const TravelSection: React.FC<Props> = ({ model, vehicles }) => {
  return (
    <section className="glass-card p-3 p-md-4">
      <h5 className="mb-1"><i className="bi bi-truck me-2" />Travel</h5>
      <div className="text-secondary small mb-3">Vehicle, distance and notes</div>

      <div className="row g-3">
        <div className="col-md-6">
          <label className="form-label">Vehicle used</label>
          <select className="form-select" value={model.vehicle_id ?? ''} disabled>
            <option value="">Select…</option>
            {vehicles.map(v => (
              <option key={v.id} value={v.id}>{v.name} ({v.reg})</option>
            ))}
          </select>
        </div>
        <div className="col-md-6">
          <label className="form-label">Distance (km)</label>
          <div className="input-group">
            <span className="input-group-text"><i className="bi bi-signpost-2" /></span>
            <input className="form-control" value={model.travel_distance_km || ''} disabled />
          </div>
        </div>

        <div className="col-12">
          <div className="p-3 rounded border bg-white">
            <div className="small text-muted mb-1">Map / Route</div>
            <div className="placeholder-glow">
              <div className="placeholder col-12" style={{height: 180}} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default TravelSection;
