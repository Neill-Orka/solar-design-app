// src/features/jobcards/components/JobCardForm.tsx
// Read-only job card detail view (mobile-first, works great on desktop too)

import React from "react";
import { useNavigate } from "react-router-dom";
import type { JobCard } from "../types";
import { API_URL } from "../../../apiConfig";
import { useAuth } from '../../../AuthContext';
import { deleteJobCard } from "../api";
import { useState } from "react";
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
  const { user } = useAuth();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const clientName =
    job.client_name ||
    (job as any).client?.client_name ||
    "Client";

  const address =
    job.client_address ||
    (job as any).client?.address?.street ||
    "Location";

  const attachments = (job as any).attachments || []; // from backend `with_lines=True` (if present)

  // Process URLs to ensure they have the full API URL prefix
  const processUrl = (url: string) => {
    if (!url) return "";
    // if the url already starts with http:// or https:// return as is
    if (url.startsWith("http://") || url.startsWith("https://")) {
      return url;
    }
    // otherwise, prepend the API_URL
    return `${API_URL}${url}`;
  }

  const hero = attachments[0]?.url ? processUrl(attachments[0].url) : undefined;

  const isAdmin = user?.role === 'admin';

  const handleDelete = async () => {
    if (!isAdmin) return;

    try {
      setDeleting(true);
      await deleteJobCard(job.id);
      nav('/jobcards', { replace: true });
    } catch (error) {
      console.error("Failed to delete job card:", error);
      alert("Failed to delete job card. Please try again later");
    } finally {
      setDeleting(false);
    }
  };

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
        {isAdmin && (
          <button
            className="jcD-delete"
            onClick={() => setShowDeleteConfirm(true)}
            aria-label="Delete"
            disabled={deleting}
          >
            <i className="bi bi-trash"></i>
          </button>
        )}
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
            {job.owner_name || "Not Assigned"}
          </div>
          <div className="jcD-chip-label">Job Owner</div>
        </div>
        <div className="jcD-chip">
          <div className="jcD-chip-value">
            {job.bum_name || "Not assigned"}
          </div>
          <div className="jcD-chip-label">BUM</div>
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

      {/* If you want a simple gallery strip under hero, uncomment: */}
      <div className="jcD-strip">
        {attachments.slice(1).map((a: any) => (
          <img key={a.id || a.url} src={a.url} alt={a.filename || 'photo'} />
        ))}
      </div>

      {/* Delete Confirmation Model */}
      {showDeleteConfirm && (
        <div className="jcD-modal-overlay">
          <div className="jcD-modal-content">
            <h3>Delete Job Card</h3>
            <p>Are you sure you want to delete this job card? This action cannot be undone.</p>
            <div className="jcD-modal-actions">
              <button 
                className="jcD-modal-cancel-btn"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
              >
                Cancel
              </button>
              <button 
                className="jcD-modal-delete-btn"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}     
    </div>
  );
}
