// src/features/jobcards/components/JobCardForm.tsx
// Read-only job card detail view (mobile-first, works great on desktop too)

import React from "react";
import { useNavigate } from "react-router-dom";
import type { JobCard } from "../types";
import "./jobcard-detail.css";

type Props = {
  job: JobCard;
  categoryName?: string;
  onEdit?: () => void;
};

const fmtDate = (iso?: string | null) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  // 25/09/25 like your screenshot
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = String(d.getFullYear()).slice(-2);
  return `${dd}/${mm}/${yy}`;
};

export default function JobCardDetail({ job, categoryName, onEdit }: Props) {
  const nav = useNavigate();
  const clientName =
    job.client_name ||
    (job as any).client?.client_name ||
    "Client";

  const address =
    job.client_address ||
    (job as any).client?.address?.street ||
    "Location";

  const attachments = (job as any).attachments || []; // from backend `with_lines=True` (if present)

  const hero = attachments[0]?.url as string | undefined;

  return (
    <div className="jcD-page">
      {/* App bar */}
      <div className="jcD-appbar">
        <button className="jcD-back" onClick={() => nav("/jobcards")} aria-label="Back">
          <i className="bi bi-chevron-left" />
          <span>Back</span>
        </button>
        <div className="jcD-appbar-title">
          {clientName}
        </div>
        <button className="jcD-done" onClick={onEdit} aria-label="Edit">
          Edit
        </button>
      </div>

      {/* Header */}
      <div className="jcD-header">
        <div className="jcD-avatar" aria-hidden />
        <div className="jcD-title">{clientName}</div>
        <div className="jcD-subtle">{address || "—"}</div>
      </div>

      {/* Meta chips */}
      <div className="jcD-meta">
        <div className="jcD-chip">
          <div className="jcD-chip-value">{categoryName || "—"}</div>
          <div className="jcD-chip-label">Category</div>
        </div>
        <div className="jcD-chip">
          <div className="jcD-chip-value">{fmtDate(job.start_at as any)}</div>
          <div className="jcD-chip-label">Start Date</div>
        </div>
        <div className="jcD-chip">
          <div className="jcD-chip-value">{fmtDate(job.complete_at as any)}</div>
          <div className="jcD-chip-label">End Date</div>
        </div>
        <div className="jcD-chip">
          <div className="jcD-chip-value">
            {job.owner_name || "Job Owner"}
          </div>
          <div className="jcD-chip-label">Job Owner</div>
        </div>
      </div>

      {/* Description */}
      <div className="jcD-card">
        <div className="jcD-card-title">Job Description</div>
        <div className="jcD-card-body jcD-prewrap">
          {job.description || "—"}
        </div>
      </div>

      {/* Photos */}
      {hero ? (
        <div className="jcD-photoCard">
          <img src={hero} alt="Job photo" className="jcD-photo" />
          {!!(attachments.length - 1) && (
            <div className="jcD-photoCount">+{attachments.length - 1}</div>
          )}
        </div>
      ) : (
        <div className="jcD-photoPlaceholder">No photos yet</div>
      )}

      {/* If you want a simple gallery strip under hero, uncomment:
      <div className="jcD-strip">
        {attachments.slice(1).map((a: any) => (
          <img key={a.id || a.url} src={a.url} alt={a.filename || 'photo'} />
        ))}
      </div>
      */}
    </div>
  );
}
