import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import JobCardFormMobile from "../components/JobCardFormMobile";
import { getJobCard, updateJobCard, setAuthToken } from "../api";
import type { JobCard } from "../types";
import type { JobCardFormValues} from "../schemas";
// @ts-ignore
import { useAuth } from '../../../AuthContext'

export default function JobCardEditPage() {
    const { id } = useParams<{ id: string }>();
    const nav = useNavigate();
    const { token } = useAuth();
    const [job, setJob] = useState<JobCard | null>(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => setAuthToken(token), [token]);
    useEffect(() => { (async () => id && setJob(await getJobCard(Number(id))))(); }, [id]);

    if (!job) return <div className="p-3">Loading...</div>;

    const onSubmit = async (values: JobCardFormValues) => {
        setSaving(true);
        try {
            await updateJobCard(job.id, values);
            nav(`/jobcards/${job.id}`);
        } finally { setSaving(false); }
    };
    
    return (
        <div className="container-fluid px-0">
            <JobCardFormMobile initial={job} onSubmit={onSubmit} onCancel={() => nav(-1)} isSubmitting={saving} />
        </div>
    )

}