// JobCardCreatePage.tsx
import { useNavigate } from 'react-router-dom';
import JobCardFormMobile from '../components/JobCardFormMobile';
import { createJobCard, createJobCardMaterial, uploadMaterialReceipt,setAuthToken } from '../api';
import type { JobCardFormValues } from '../schemas';
import { useAuth } from '../../../AuthContext';
import { useEffect, useState } from 'react';
import { API_URL } from '../../../apiConfig';

export default function JobCardCreatePage() {
  const nav = useNavigate();
  const { user, token } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  useEffect(() => setAuthToken(token), [token]);

  if (!user?.id) {
    return <div className="p-3">Loading…</div>;
  }

  const onSubmit = async (values: JobCardFormValues, materialData?: any) => {
    try {
      setIsSubmitting(true);

      const time_entries = materialData?.time_entries || [];

      // 1. Create the job card
      const created = await createJobCard(values);

      // 2. If materials are used, save the material lines
      if (values.materials_used && materialData?.materialLines?.length > 0) {
        const { materialLines, usedMaterials, materialFileUploads } = materialData;

        // Only save materials marked as used
        const usedLines = materialLines.filter((_, index) => usedMaterials[index] ?? true);

        for (let i = 0; i < usedLines.length; i++) {
          const line = usedLines[i];
          const originalIndex = materialLines.findIndex(l => l === line);

          // Create materials entry
          const materialResponse = await createJobCardMaterial({
            job_card_id: created.id,
            product_id: line.product_id,
            quantity: line.qty,
            unit_price_at_time: line.unit_price,
            unit_cost_at_time: line.unit_cost,
            note: line.fromQuote ? "From accepted quote" : "Manually added"
          });

          // Upload receipt if needed (not from quote)
          if (!line.fromQuote) {
            const receipt = materialFileUploads[originalIndex];
            if (receipt) {
              await uploadMaterialReceipt(created.id, materialResponse.id, receipt);
            }
          }
        }
      }

      // 3. Upload site photos
      if (materialData?.sitePhotos?.length) {
        const token = localStorage.getItem('access_token');
        for (const sp of materialData.sitePhotos) {
          const fd = new FormData();
          fd.append('file', sp.file);
          fd.append('attachement_type', 'site');
          if (sp.caption.trim()) fd.append('caption', sp.caption.trim());
          await fetch(`${API_URL}/api/jobcards/${created.id}/attachments`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token || ''}` },
            body: fd
          });
        }
      }

      // 4. Navigate to the job card details page
      nav(`/jobcards/${created.id}`);
    } catch (error) {
      console.error("Failed to create job card: ", error);
      alert('An error occurred while saving the job card');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="container-fluid px-0">
      <JobCardFormMobile
        key={user.id}                              // re-init form with the proper owner
        initial={{ owner_id: user.id, status: 'draft' }}
        onSubmit={onSubmit}
        onCancel={() => nav(-1)}
        isSubmitting={isSubmitting}
      />
    </div>
  );
}
