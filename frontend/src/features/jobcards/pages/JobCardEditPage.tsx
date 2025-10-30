import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import JobCardFormMobile from "../components/JobCardFormMobile";
import {
  getJobCard,
  updateJobCard,
  setAuthToken,
  createJobCardMaterial,
  uploadMaterialReceipt,
} from "../api";
import type { JobCard } from "../types";
import type { JobCardFormValues } from "../schemas";
// @ts-ignore
import { useAuth } from "../../../AuthContext";
// @ts-ignore
import { API_URL } from "../../../apiConfig";

export default function JobCardEditPage() {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const { token } = useAuth();
  const [job, setJob] = useState<JobCard | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => setAuthToken(token), [token]);
  useEffect(() => {
    (async () => id && setJob(await getJobCard(Number(id))))();
  }, [id]);

  if (!job) return <div className="p-3">Loading...</div>;

  const onSubmit = async (values: JobCardFormValues, materialData?: any) => {
    setSaving(true);
    try {
      await updateJobCard(job.id, values as any);

      // Persist any newly added material lines and related receipts
      if (values.materials_used && materialData?.materialLines?.length) {
        const materialLines: Array<{
          product_id: number;
          qty: number;
          unit_price: number;
          unit_cost: number;
          fromQuote?: boolean;
          existingId?: number;
        }> = materialData.materialLines;
        const usedMaterials: Record<number, boolean> =
          materialData.usedMaterials ?? {};
        const materialFileUploads: Record<number, File | null> =
          materialData.materialFileUploads ?? {};

        for (let index = 0; index < materialLines.length; index++) {
          const line = materialLines[index];
          const isUsed = usedMaterials?.[index] ?? true;
          if (!isUsed) continue;

          if (!line.existingId) {
            if (line.qty <= 0) continue;
            const materialResponse = await createJobCardMaterial({
              job_card_id: job.id,
              product_id: line.product_id,
              quantity: line.qty,
              unit_price_at_time: line.unit_price,
              unit_cost_at_time: line.unit_cost,
              note: line.fromQuote ? "From accepted quote" : "Manually added",
            });

            if (!line.fromQuote) {
              const receipt = materialFileUploads?.[index];
              if (receipt) {
                await uploadMaterialReceipt(
                  job.id,
                  materialResponse.id,
                  receipt
                );
              }
            }
          } else if (!line.fromQuote) {
            const receipt = materialFileUploads?.[index];
            if (receipt) {
              await uploadMaterialReceipt(job.id, line.existingId, receipt);
            }
          }
        }
      }

      // Upload any freshly attached site photos
      if (materialData?.sitePhotos?.length) {
        const token = localStorage.getItem("access_token") || "";
        for (const sp of materialData.sitePhotos) {
          if (!sp?.file) continue;
          const fd = new FormData();
          fd.append("file", sp.file);
          fd.append("attachment_type", "site");
          if (sp.caption?.trim()) {
            fd.append("caption", sp.caption.trim());
          }
          const resp = await fetch(
            `${API_URL}/api/jobcards/${job.id}/attachments`,
            {
              method: "POST",
              headers: { Authorization: `Bearer ${token}` },
              body: fd,
            }
          );
          if (!resp.ok) {
            throw new Error("Failed to upload a site photo");
          }
        }
      }

      const refreshed = await getJobCard(job.id);
      setJob(refreshed);

      const statusValue = (values.status || "").toLowerCase();
      const isDraft =
        statusValue === "open" || statusValue === "draft" || !statusValue;

      if (!isDraft) {
        nav(`/jobcards/${job.id}`);
      }
    } catch (error) {
      console.error("Failed to update job card", error);
      alert("Failed to update job card. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="container-fluid px-0">
      <JobCardFormMobile
        initial={job}
        onSubmit={onSubmit}
        onCancel={() => nav(-1)}
        isSubmitting={saving}
      />
    </div>
  );
}
