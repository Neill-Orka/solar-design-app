// src/features/jobcards/pages/JobCardDetailPage.tsx
// @ts-ignore
import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getJobCard, listCategories } from "../api";
import type { JobCard, JobCategory } from "../types";
import JobCardDetail from "../components/JobCardDetail"; // will rename later to JobCardDetail

export default function JobCardDetailPage() {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();

  const [job, setJob] = useState<JobCard | null>(null);
  const [categoryName, setCategoryName] = useState<string>("");

  useEffect(() => {
    let mounted = true;

    (async () => {
      if (!id) return;
      const jc = await getJobCard(Number(id));
      if (!mounted) return;

      if (jc && jc.bum_status === "open") {
        nav(`/jobcards/${jc.id}/edit`, { replace: true });
        return;
      }

      setJob(jc);

      // map category id -> name (backend doesn’t snapshot it)
      if (jc?.category_id) {
        try {
          const cats: JobCategory[] = await listCategories();
          const match = cats.find((c) => c.id === jc.category_id);
          if (mounted) setCategoryName(match?.name || "");
        } catch {
          /* ignore, keep empty name */
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, [id]);

  if (!job) {
    return (
      <div className="container py-4">
        <div className="text-muted">Loading job card…</div>
      </div>
    );
  }

  return (
    <JobCardDetail
      job={job}
      categoryName={categoryName}
      onEdit={() => nav(`/jobcards/${job.id}/edit`)}
    />
  );
}
