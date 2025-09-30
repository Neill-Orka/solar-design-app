// JobCardCreatePage.tsx
import { useNavigate } from 'react-router-dom';
import JobCardFormMobile from '../components/JobCardFormMobile';
import { createJobCard, setAuthToken } from '../api';
import type { JobCardFormValues } from '../schemas';
import { useAuth } from '../../../AuthContext';
import { useEffect } from 'react';

export default function JobCardCreatePage() {
  const nav = useNavigate();
  const { user, token } = useAuth();
  useEffect(() => setAuthToken(token), [token]);

  if (!user?.id) {
    return <div className="p-3">Loading…</div>;
  }

  const onSubmit = async (values: JobCardFormValues) => {
    const created = await createJobCard({
      ...values,
      owner_id: user.id,
    });
    nav(`/jobcards/${created.id}`);
  };

  return (
    <div className="container-fluid px-0">
      <JobCardFormMobile
        key={user.id}                              // re-init form with the proper owner
        initial={{ owner_id: user.id, status: 'draft' }}
        onSubmit={onSubmit}
        onCancel={() => nav(-1)}
      />
    </div>
  );
}
