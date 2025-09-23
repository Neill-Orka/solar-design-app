// JobCardCreatePage.tsx
import { useNavigate } from 'react-router-dom';
import JobCardForm from '../../jobcards/components/JobCardForm';
import { createJobCard } from '../api';
import type { JobCardFormValues } from '../schemas';
import { useAuth } from '../../../AuthContext'; // adjust path if needed

export default function JobCardCreatePage() {
  const nav = useNavigate();
  const { user } = useAuth();

  const onSubmit = async (values: JobCardFormValues) => {
    const created = await createJobCard({
      ...values,
      owner_id: user!.id,            // ensure > 0
    });
    nav(`/jobcards/${created.id}`);
  };

  return (
    <div className="container py-3">
      <h3>Create Job Card</h3>
      <JobCardForm
        initial={{ owner_id: user?.id ?? 0, status: 'draft' }}
        onSubmit={onSubmit}
      />
    </div>
  );
}
