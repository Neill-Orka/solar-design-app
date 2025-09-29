import { Link } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import "./jobcards.mobile.css"; // add the styles below
import type { Client, JobCard } from "../types";
import { listJobCards } from "../api";

type FeedItem = {
  id: number;
  clientName: string;
  technician: string;
  timeAgo: string;
  location?: string;
  summary: string;
  thumbUrl?: string;
};

const MOCK: FeedItem[] = [
  {
    id: 101,
    clientName: "Cecil Rutherford",
    technician: "Justin Pretorius",
    timeAgo: "3d ago",
    location: "Potch",
    summary: "Changed DC fuses and basic electric work.",
    thumbUrl: "https://picsum.photos/seed/db1/240/160",
  },
  {
    id: 102,
    clientName: "Juan Kleynhans",
    technician: "ORKA Solar",
    timeAgo: "3d ago",
    location: "Location",
    summary:
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Fusce convallis pellentesque metus id lacinia.",
    thumbUrl: "https://picsum.photos/seed/logo/120/120",
  },
  {
    id: 103,
    clientName: "Leon Swanson",
    technician: "Team",
    timeAgo: "3d ago",
    location: "Location",
    summary:
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Fusce convallis pellentesque metus id lacinia.",
  }
];

const Avatar = ({ name }: { name: string }) => {
  const initials = useMemo(() => {
    const [a = "", b = ""] = name.split(" ");
    return (a[0] || "").toUpperCase() + (b[0] || "").toUpperCase();
  }, [name]);
  return <div className="jc-avatar">{initials || "•"}</div>;
};

export default function JobCardsPage() {
  const [jobcards, setJobcards] = useState<JobCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchJobCards = async () => {
    setLoading(true);
    setError(null);
    try {
      const jcs = await listJobCards();
      setJobcards(jcs);
    } catch (error) {
      setError("Failed to fetch job cards");
    } finally {
      setLoading(false);
    }
  };

  // Fetch job cards on component mount
  useEffect(() => {
    fetchJobCards();
  }, []);

  // Using placeholder data only (no API call yet)
  const items = jobcards;

  return (
    <div className="jc-wrap">
      {/* Top app bar */}
      <div className="jc-appbar">
        <div className="jc-deviceslot" />
        <h1 className="jc-title">Job Cards</h1>

        <Link
          to="/jobcards/new"
          className="jc-add"
          aria-label="Create job card"
          title="Create job card"
        >
          <i className="bi bi-plus-lg" />
        </Link>
      </div>

      {/* Feed */}
      <div className="jc-feed">
        {items.map((it) => (
          <Link
            to={`/jobcards/${it.id}`}
            key={it.id}
            className="jc-card"
            aria-label={`Open job card ${it.client_name}`}
          >
            <div className="jc-row jc-header">
              <Avatar name={String(it.client_name)} />
              <div className="jc-header-col">
                <div className="jc-name">{it.client_name}</div>
                <div className="jc-sub">
                  {it.created_at ? (it.created_at) : "—"}
                  {it.client_address ? ` in ${it.client_address}` : ""}
                </div>
              </div>
              {/* {it.thumbUrl && (
                <img src={it.thumbUrl} alt="" className="jc-thumb" />
              )} */}
            </div>

            <div className="jc-body">{it.description}</div>

            <div className="jc-divider" />

            <div className="jc-row jc-footer">
              <div className="jc-meta-left">
                {/* <span className="jc-dots" aria-hidden="true">
                  •••
                </span> */}
                <span className="jc-tech">{it.owner_name}</span>
              </div>
              {/* <div className="jc-meta-right">
                <span className="jc-count">{it.likes}</span>
                <i className="bi bi-heart-fill jc-heart" />
              </div> */}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
