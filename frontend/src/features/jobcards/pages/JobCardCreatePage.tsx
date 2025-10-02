// JobCardCreatePage.tsx
import { useNavigate } from 'react-router-dom';
import JobCardFormMobile from '../components/JobCardFormMobile';
import { createJobCard, createJobCardMaterial, uploadMaterialReceipt,setAuthToken } from '../api';
import type { JobCardFormValues } from '../schemas';
import { useAuth } from '../../../AuthContext';
import { useEffect, useState } from 'react';

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

      // 1. Create the job card
      const created= await createJobCard({
        ...values
      });

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

      // 3. Navigate to the job card details page
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
