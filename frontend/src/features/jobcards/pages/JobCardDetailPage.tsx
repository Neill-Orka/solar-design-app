import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import JobCardForm from '../../jobcards/components/JobCardForm';
import { getJobCard, updateJobCard } from '../api';
import type { JobCard } from '../types';
import type { JobCardFormValues } from '../schemas';

export default function JobCardDetailPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const [item, setItem] = useState<JobCard | null>(null);

  useEffect(() => {
    if (!id) return;
    getJobCard(Number(id)).then(setItem);
  }, [id]);

  const onSubmit = async (values: JobCardFormValues) => {
    if (!id) return;
    const updated = await updateJobCard(Number(id), values);
    setItem(updated);
  };

  if (!item) return <div className="container py-3">Loading…</div>;

  return (
    <div className="container py-3">
      <div className="d-flex justify-content-between align-items-center mb-2">
        <h3>Job Card #{item.id}</h3>
        <button className="btn btn-outline-secondary" onClick={() => nav('/jobcards')}>Back</button>
      </div>
      <JobCardForm initial={item} onSubmit={onSubmit} />
    </div>
  );
}
