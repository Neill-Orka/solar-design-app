import React from 'react';
import type { JobCardUI } from '../JobCardUI.types';

type Props = {
  model: JobCardUI;
  technicians: Array<{ id: number; name: string; rate: number }>;
};

const LabourSection: React.FC<Props> = ({ model, technicians }) => {
  return (
    <section className="glass-card p-3 p-md-4">
      <div className="d-flex align-items-center justify-content-between">
        <h5 className="mb-1"><i className="bi bi-clock-history me-2" />Labour & Time</h5>
        <button className="btn btn-sm btn-outline-primary" disabled>
          <i className="bi bi-plus-lg me-1" /> Add entry
        </button>
      </div>
      <div className="text-secondary small mb-3">Track who worked, how long, and cost</div>

      <div className="table-responsive">
        <table className="table table-sm align-middle">
          <thead className="table-light">
            <tr>
              <th style={{minWidth: 160}}>Technician</th>
              <th>Hours</th>
              <th>Rate</th>
              <th>Amount</th>
              <th style={{width: 40}}></th>
            </tr>
          </thead>
          <tbody>
            {(model.time_entries || []).map((t) => (
              <tr key={t.id}>
                <td>
                  <select className="form-select form-select-sm" value={t.user_id} disabled>
                    {technicians.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
                  </select>
                </td>
                <td><input className="form-control form-control-sm" value={t.hours} disabled /></td>
                <td><input className="form-control form-control-sm" value={`R ${t.hourly_rate_at_time}`} disabled /></td>
                <td className="fw-semibold">R {t.amount.toFixed(2)}</td>
                <td><button className="btn btn-sm btn-outline-secondary" disabled><i className="bi bi-trash" /></button></td>
              </tr>
            ))}
            {model.time_entries?.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center text-muted py-3">No time entries yet</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
};

export default LabourSection;
