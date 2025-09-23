import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listJobCards } from '../api';
import type { JobCard } from '../types';

export default function JobCardsPage() {
    const [rows, setRows] = useState<JobCard[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        listJobCards().then(setRows).finally(() => setLoading(false));
    }, []);

    if (loading) return <div>Loading...</div>;

    return (
        <div className='container py-2'>
            <div className='d-flex justify-content-between align-items-center mb-3'>
                <h3> Job Cards </h3>
                <Link to="/jobcards/new" className='btn btn-primary'> New Job Card </Link>
            </div>
            <div className='table-responsive'>
                <table className='table table-sm align-middle'>
                    <thead>
                        <tr>
                            <th>ID</th><th>Title</th><th>Client</th><th>Status</th><th>Created</th><th></th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map(r => (
                            <tr key={r.id}>
                                <td>{r.id}</td>
                                <td>{r.title ?? '-'}</td>
                                <td>{r.client_name ?? '-'}</td>
                                <td><span className='badge text-bg-secondary'>{r.status}</span></td>
                                <td>{r.created_at?.slice(0, 10)}</td>
                                <td>
                                    <Link to={`/jobcards/${r.id}`} className='btn btn-sm btn-outline-secondary'>View</Link>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    )
}