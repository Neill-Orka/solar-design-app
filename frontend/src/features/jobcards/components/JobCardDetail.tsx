// src/features/jobcards/components/JobCardForm.tsx
// Read-only job card detail view (mobile-first, works great on desktop too)

// @ts-ignore
import React , {useEffect, useState} from "react";
import { useNavigate } from "react-router-dom";
import type {JobCard, Vehicle} from "../types";
import { API_URL } from "../../../apiConfig";
import { useAuth } from '../../../AuthContext';
import { deleteJobCard } from "../api";
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

const formatCurrency = (v: number | null | undefined) => 
  (v == null || isNaN(Number(v)))
    ? "-"
    : new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR" }).format(Number(v));


export default function JobCardDetail({ job, categoryName, onEdit }: Props) {
  const nav = useNavigate();
  const { user } = useAuth();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showMaterials, setShowMaterials] = useState(false);
  const [attachments, setAttachments] = useState<any[]>(() => (job as any).attachments || []);
  const [resolvedVehicle, setResolvedVehicle] = useState<Vehicle | any>(null);
  const [heroIndex, setHeroIndex] = useState(0);
  
  useEffect(() => {
    setAttachments((job as any).attachments || []);
  }, [job]);


  const clientName =
    job.client_name ||
    (job as any).client?.client_name ||
    "Client";

  const address =
    job.client_address ||
    (job as any).client?.address?.street ||
    "Location";

  const assistantsCount = Number(job.labourers_count) || 0;
  const assistantHours = Number(job.labour_hours) || 0;
  const assistantRate = Number(job.labour_rate_per_hour) || 0;
  const assistantTotalCost = (assistantsCount * assistantHours * assistantRate);

  // Vehicle / Travel
  const didTravel = !!job.did_travel;
  const vehicleName = job.vehicle_name || (resolvedVehicle && resolvedVehicle.name) || null;
  const vehicleReg = job.vehicle_registration || (resolvedVehicle && resolvedVehicle.vehicle_registration) || "";

  const travelKm = Number(job.travel_distance_km) || 0; // already round trip
  const travelRate = Number(job.rate_per_km) ? Number(job.rate_per_km) : 0;
  const travelCost = travelKm * travelRate;

  useEffect(() => {
      // Fetch only if we have an id but backend didn't include name
      if (job.vehicle_id && !job.vehicle_name) {
          (async () => {
              try {
                  const token = localStorage.getItem("access_token");
                  const res = await fetch(`${API_URL}/api/vehicles`, {
                      headers: { Authorization: `Bearer ${token || ""}` }
                  });
                  if (res.ok) {
                      const list = await res.json();
                      const found = list.find((v: any) => v.id === job.vehicle_id);
                      if (found) setResolvedVehicle(found);
                  }
              } catch (e) {
                  console.warn('Failed loading vehicles: ', e);
              }
          })();
      }
  }, [job.vehicle_id, job.vehicle_name]);
    

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

  const sitePhotosAll = attachments.filter(a => (a.attachment_type || 'site').toLowerCase() === 'site');
  const receiptPhotosAll = attachments.filter(a => (a.attachment_type || '').toLowerCase() === 'receipt');

  const receipts = receiptPhotosAll;
  const sitePhotos = sitePhotosAll;

  // Reset hero index if photos change
  useEffect(() => {
    if (heroIndex >= sitePhotos.length) setHeroIndex(0);
  }, [sitePhotos.length, heroIndex]);
  
  const hero = sitePhotos[heroIndex]?.url ? processUrl(sitePhotos[heroIndex].url) : undefined;

  // Hero Navigation
  const prevSite = () => {
    if (sitePhotos.length < 2) return;
    setHeroIndex(i => (i - 1 + sitePhotos.length) % sitePhotos.length);
  }

  const nextSite = () => {
    if (sitePhotos.length < 2) return;
    setHeroIndex(i => (i + 1) % sitePhotos.length);
  }

  const selectSite = (idx: number) => setHeroIndex(idx);

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

      {/*  Technician Labour*/}
      {Array.isArray((job as any).time_entries) && (job as any).time_entries.length > 0 && (
        <div className="jcD-card">
          <div className="jcD-card-title">Technician Labour</div>
          <div className="jcD-card-body">
            <table className="table table-sm mb-0">
              <thead>
                <tr>
                  <th style={{ width: '40%' }}>Technician</th>
                  <th style={{ width: '20%', textAlign: 'center' }}>Hours</th>
                  <th style={{ width: '20%', textAlign: 'right' }}>Rate</th>
                  <th style={{ width: '20%', textAlign: 'right' }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {(job as any).time_entries.map((te: any) => (
                  <tr key={te.id}>
                    <td>{te.user_name || te.user_id}</td>
                    <td style={{ textAlign: 'center' }}>{Number(te.hours).toFixed(1)}</td>
                    <td style={{ textAlign: 'right' }}>
                      {formatCurrency(Number(te.hourly_rate_at_time))}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>
                      {formatCurrency(Number(te.amount))}
                    </td>
                  </tr>
                ))}
                <tr>
                  <td colSpan={3} style={{ textAlign: 'right', fontWeight: 700 }}>Total</td>
                  <td style={{ textAlign: 'right', fontWeight: 700 }}>
                    {formatCurrency(
                      (job as any).time_entries.reduce(
                        (s: number, te: any) => s + Number(te.amount || 0),
                        0
                      )
                    )}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Labour */}
      {(assistantsCount > 0 || assistantHours > 0 || assistantTotalCost) && (
        <div className="jcD-card">
          <div className="jcD-card-title">Labour</div>
          <div className="jcD-card-body">
            <div className="jcD-labour-grid">
              <div className="jcD-labour-item">
                <div className="jcD-labour-label">Assistants</div>
                <div className="jcD-labour-value">
                  {assistantsCount > 0 ? assistantsCount : "—"}
                </div>
              </div>
              <div className="jcD-labour-item">
                <div className="jcD-labour-label">Hours Worked</div>
                <div className="jcD-labour-value">
                  {assistantHours > 0 ? assistantHours : "—"}
                </div>
              </div>
              <div className="jcD-labour-item">
                <div className="jcD-labour-label">Total Cost</div>
                <div className="jcD-labour-value">
                  {formatCurrency(Number(assistantTotalCost))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Vehicles */}
      {(didTravel || vehicleName || travelKm > 0) && (
        <div className="jcD-card">
          <div className="jcD-card-title">Travel</div>
          <div className="jcD-card-body">
            <div className="jcD-veh-grid">
              <div className="jcD-veh-item">
                <div className="jcD-veh-label">Vehicle</div>
                <div className="jcD-veh-value">
                  {vehicleName ? vehicleName : "—"}
                  {vehicleReg && (
                    <span className="jcD-veh-sub">({vehicleReg})</span>
                  )}
                </div>
              </div>
              <div className="jcD-veh-item">
                <div className="jcD-veh-label">
                  Distance
                  <span className="jcD-veh-hint"> (round trip)</span>
                </div>
                <div className="jcD-veh-value">
                  {travelKm > 0 ? (
                    <>
                      {travelKm.toFixed(1)} <span className="jcD-veh-unit">km</span>
                    </>
                  ) : (
                    "—"
                  )}
                  {travelRate > 0 && travelKm > 0 && (
                    <span className="jcD-veh-sub">
                      {/* show rate subtly without emphasising */}
                      at {travelRate.toFixed(2)}/km
                    </span>
                  )}
                </div>
              </div>
              <div className="jcD-veh-item">
                <div className="jcD-veh-label">Travel Cost</div>
                <div className="jcD-veh-value">
                  {travelKm > 0 &&  travelRate > 0
                    ? formatCurrency(travelCost)
                    : "—"}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Materials */}
      {Array.isArray((job as any).materials) && (job as any).materials.length > 0 && (
        <div className="jcD-card jcD-mats">
          <button
            type="button"
            className="jcD-mats-header"
            onClick={() => setShowMaterials((v) => !v)}
            aria-expanded={showMaterials}
          >
            <div className="jcD-mats-header-left">
              <span className="jcD-mats-title">Materials</span>
              <span className="jcD-mats-count">
                {(job as any).materials.length} item{(job as any).materials.length !== 1 && 's'}
              </span>
            </div>
            <div className="jcD-mats-header-right">
              <span className="jcD-mats-total">
                {formatCurrency(
                  (job as any).materials.reduce(
                    (s: number, m: any) =>
                      s + Number(m.unit_price_at_time || 0) * Number(m.quantity || 0),
                    0
                  )
                )}
              </span>
              <i
                className={`bi bi-chevron-${showMaterials ? 'up' : 'down'} jcD-mats-chevron`}
                aria-hidden
              />
            </div>
          </button>

          <div className={`jcD-mats-body ${showMaterials ? 'open' : ''}`}>
            <table className="jcD-mats-table">
              <thead>
                <tr>
                  <th style={{ width: '42%' }}>Material</th>
                  <th style={{ width: '14%' }} className="ta-center">Qty</th>
                  <th style={{ width: '20%' }} className="ta-end">Unit Price</th>
                  <th style={{ width: '24%' }} className="ta-end">Line Total</th>
                </tr>
              </thead>
              <tbody>
                {(job as any).materials.map((m: any) => {
                  const qty = Number(m.quantity || 0);
                  const unit = Number(m.unit_price_at_time || 0);
                  const lineTotal = unit * qty;
                  return (
                    <tr key={m.id}>
                      <td>
                        <div className="jcD-mat-name">
                          {m.brand_name} {m.product_name || `#${m.product_id}`}
                        </div>
                      </td>
                      <td className="ta-center">{qty}</td>
                      <td className="ta-end">{formatCurrency(unit)}</td>
                      <td className="ta-end fw-semibold">{formatCurrency(lineTotal)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Receipt Photos */}
      <div className="jcD-card">
        <div className="jcD-card-title">Receipt Photos</div>
        <div className="jcD-card-body">
          {receipts.length === 0 && <div className="jcD-empty">No receipt photos</div>}
          {receipts.length > 0 && (
            <div className="jcD-photoStrip" role="list">
              {receipts.map((r: any) => (
                <button
                  key={r.id || r.url}
                  className="jcD-thumb"
                  role="listitem"
                  onClick={() => window.open(processUrl(r.url), "_blank")}
                  title={r.filename || "Receipt"}
                >
                  <img src={processUrl(r.url)} alt="Receipt" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Site Photos */}
      <div className="jcD-card">
        <div className="jcD-card-title">Site Photos</div>
        <div className="jcD-card-body">
          {hero ? (
            <div className="jcD-siteHeroWrap position-relative">
              <img
                src={hero}
                alt={`Site ${heroIndex + 1} of ${sitePhotos.length}`}
                className="jcD-siteHero"
              />
              {sitePhotos[heroIndex].caption && (
                <div className="jcD-caption-overlay">
                  {sitePhotos[heroIndex].caption}
                </div>
              )}
              {sitePhotos.length > 1 && (
                <>
                  <button
                    type="button"
                    className="jcD-heroNav jcD-heroNav-left"
                    onClick={prevSite}
                    aria-label="Previous photo"
                  >
                    <i className="bi bi-chevron-left" />
                  </button>
                  <button
                    type="button"
                    className="jcD-heroNav jcD-heroNav-right"
                    onClick={nextSite}
                    aria-label="Next photo"
                  >
                    <i className="bi bi-chevron-right" />
                  </button>
                  <div className="jcD-heroCounter">
                    {heroIndex + 1} / {sitePhotos.length}
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="jcD-empty">No site photos</div>
          )}

          {sitePhotos.length > 1 && (
            <div className="jcD-siteGrid">
              {sitePhotos.map((p: any, idx: number) => {
                const thumbUrl = processUrl(p.url);
                const active = idx === heroIndex;
                return (
                  <div
                    key={p.id || p.url}
                    className={`jcD-siteThumbWrap ${active ? 'active' : ''}`}
                  >
                    <button
                      type="button"
                      className={`jcD-siteThumb ${active ? 'active' : ''}`}
                      onClick={() => selectSite(idx)}
                      aria-label={`Show photo ${idx + 1}`}
                      title={p.filename || "Photo"}
                    >
                      <img src={thumbUrl} alt={p.caption || `Site ${idx + 1}`} />
                    </button>
                    {p.caption && <div className="jcD-thumb-cap">{p.caption}</div>}
                  </div>
                );
              })}
            </div>
          )}
        </div>
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
