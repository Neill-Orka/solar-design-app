import { Link, useParams, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState, useCallback } from "react";
import "./jobcards.mobile.css"; // styles extended with kanban below
import type { JobCard, JobCardReviewStatus } from "../types";
import { listJobCards, updateJobCard } from "../api";
import { useAuth } from "../../../AuthContext";

const Avatar = ({ name }: { name: string }) => {
  const initials = useMemo(() => {
    const [a = "", b = ""] = String(name || "").split(" ");
    return (a[0] || "").toUpperCase() + (b[0] || "").toUpperCase();
  }, [name]);
  return <div className="jc-avatar">{initials || "•"}</div>;
};

// Pretty labels for review columns
const REVIEW_LABEL: Record<JobCardReviewStatus, string> = {
  pending: "Pending",
  approved: "Accepted",
  needs_fix: "Needs Fix",
  declined: "Declined",
};

const REVIEW_KEYS: JobCardReviewStatus[] = ["pending", "approved", "needs_fix", "declined"];

export default function JobCardsPage() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [view, setView] = useState<"list" | "board">("board");
  const [jobcards, setJobcards] = useState<JobCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canModerate = !!user?.is_bum; // allow BUMs to move between review columns

  const fetchJobCards = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const jcs = await listJobCards();
      setJobcards(jcs);
    } catch (e: any) {
      setError(e?.message || "Failed to load job cards");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchJobCards();
  }, [fetchJobCards]);

  const byReview = useMemo(() => {
    const buckets: Record<JobCardReviewStatus, JobCard[]> = {
      pending: [],
      approved: [],
      needs_fix: [],
      declined: [],
    };
    for (const jc of jobcards) {
      const k = (jc.bum_status || "pending") as JobCardReviewStatus;
      if (k in buckets) buckets[k as JobCardReviewStatus].push(jc);
      else buckets.pending.push(jc);
    }
    return buckets;
  }, [jobcards]);

  const onDropTo = useCallback(
    async (status: JobCardReviewStatus, ev: React.DragEvent<HTMLDivElement>) => {
      ev.preventDefault();
      const idStr = ev.dataTransfer.getData("text/plain");
      const jid = Number(idStr);
      if (!jid || !canModerate) return;

      // optimistic update
      setJobcards((prev) => prev.map((j) => (j.id === jid ? { ...j, bum_status: status } : j)));
      try {
        await updateJobCard(jid, { bum_status: status });
      } catch (e) {
        // revert on error
        await fetchJobCards();
        alert("Failed to update review status");
      }
    },
    [canModerate, fetchJobCards]
  );

  const onDragStart = (jid: number) => (ev: React.DragEvent) => {
    ev.dataTransfer.setData("text/plain", String(jid));
    ev.dataTransfer.effectAllowed = "move";
  };

  const Column = ({ k }: { k: JobCardReviewStatus }) => {
    const items = byReview[k];
    return (
      <div
        className={`kb-column kb-${k}`}
        onDragOver={(e) => canModerate && e.preventDefault()}
        onDrop={(e) => onDropTo(k, e)}
      >
        <div className="kb-col-header">
          <span className={`kb-pill kb-pill-${k}`}>{REVIEW_LABEL[k]}</span>
          <span className="kb-count">{items.length}</span>
        </div>
        <div className="kb-col-list">
          {items.map((jc) => (
            <div
              key={jc.id}
              className="kb-card"
              draggable={canModerate}
              onDragStart={onDragStart(jc.id)}
              onDoubleClick={() => navigate(`/jobcards/${jc.id}`)}
              title="Open details"
            >
              <div className="kb-card-top">
                <Avatar name={String(jc.client_name || jc.title || "")} />
                <div className="kb-card-headings">
                  <div className="kb-card-title">{jc.title || jc.client_name || `Job #${jc.id}`}</div>
                  <div className="kb-card-sub">
                    {jc.client_name ? jc.client_name : ""}
                    {jc.owner_name ? ` • ${jc.owner_name}` : ""}
                  </div>
                </div>
              </div>
              {jc.description && <div className="kb-card-body">{jc.description}</div>}
              <div className="kb-card-actions">
                <Link to={`/jobcards/${jc.id}`} className="kb-btn kb-btn-light">
                  View
                </Link>
                {canModerate && k !== "approved" && (
                  <button className="kb-btn kb-btn-accept" onClick={() => onQuickChange(jc.id, "approved")}>Accept</button>
                )}
                {canModerate && k !== "needs_fix" && (
                  <button className="kb-btn kb-btn-warn" onClick={() => onQuickChange(jc.id, "needs_fix")}>Needs Fix</button>
                )}
                {canModerate && k !== "declined" && (
                  <button className="kb-btn kb-btn-danger" onClick={() => onQuickChange(jc.id, "declined")}>Decline</button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const onQuickChange = useCallback(
    async (jid: number, status: JobCardReviewStatus) => {
      if (!canModerate) return;
      setJobcards((prev) => prev.map((j) => (j.id === jid ? { ...j, bum_status: status } : j)));
      try {
        await updateJobCard(jid, { bum_status: status });
      } catch (e) {
        await fetchJobCards();
        alert("Failed to update review status");
      }
    },
    [canModerate, fetchJobCards]
  );

  return (
    <div className="jc-wrap">
      <div className="jc-appbar">
        <div className="jc-deviceslot" />
        <h1 className="jc-title">Job Cards</h1>
        <div className="jc-actions">
          <div className="jc-toggle" role="tablist" aria-label="View switch">
            <button
              className={`jc-toggle-btn ${view === "list" ? "is-active" : ""}`}
              onClick={() => setView("list")}
              role="tab"
              aria-selected={view === "list"}
              title="List view"
            >
              <i className="bi bi-list-ul" />
            </button>
            <button
              className={`jc-toggle-btn ${view === "board" ? "is-active" : ""}`}
              onClick={() => setView("board")}
              role="tab"
              aria-selected={view === "board"}
              title="Board view"
            >
              <i className="bi bi-kanban" />
            </button>
            <Link to="/jobcards/new" className="jc-add" aria-label="Create job card" title="Create job card">
              <i className="bi bi-plus-lg" />
            </Link>
          </div>
        </div>
      </div>

      {loading && <div className="jc-loading">Loading…</div>}
      {error && <div className="jc-error">{error}</div>}

      {view === "list" && (
        <div className="jc-feed">
          {jobcards.map((it) => (
            <Link to={`/jobcards/${it.id}`} key={it.id} className="jc-card" aria-label={`Open job card ${it.client_name}`}>
              <div className="jc-row jc-header">
                <Avatar name={String(it.client_name)} />
                <div className="jc-header-col">
                  <div className="jc-name">{it.client_name}</div>
                  <div className="jc-sub">
                    {it.created_at ? it.created_at : "—"}
                    {it.client_address ? ` in ${it.client_address}` : ""}
                  </div>
                </div>
              </div>
              <div className="jc-body">{it.description}</div>
              <div className="jc-divider" />
              <div className="jc-row jc-footer">
                <div className="jc-meta-left">
                  <span className="jc-tech">{it.owner_name}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {view === "board" && (
        <div className="kb-board">
          {REVIEW_KEYS.map((k) => (
            <Column key={k} k={k} />
          ))}
        </div>
      )}
    </div>
  );
}
