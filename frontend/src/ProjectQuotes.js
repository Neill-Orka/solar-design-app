// ProjectQuotes.js
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Table, Badge, Spinner } from 'react-bootstrap';

export default function ProjectQuotes({ projectId, API_URL, onOpenQuote }) {
  const [rows, setRows] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    axios.get(`${API_URL}/api/projects/${projectId}/quotes`)
      .then(r => { if (mounted) { setRows(r.data); setLoading(false); }})
      .catch(() => setLoading(false));
    return () => { mounted = false; };
  }, [projectId, API_URL]);

  if (loading) return <Spinner size="sm" />;

  if (!rows?.length) return <div className="text-muted">No quotes yet.</div>;

  const fmtZAR = v => (new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(v || 0)).replace('R', 'R ');

  return (
    <Table striped hover size="sm" className="align-middle">
      <thead>
        <tr>
          <th>#</th>
          <th>Status</th>
          <th>Latest ver.</th>
          <th>Total (incl. VAT)</th>
          <th>Created</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(q => (
          <tr key={q.id} onClick={() => onOpenQuote?.(q.id)} style={{ cursor: onOpenQuote ? 'pointer' : 'default' }}>
            <td>{q.number}</td>
            <td><Badge bg="secondary">{q.status || 'draft'}</Badge></td>
            <td>v{q.latest_version_no || 1} ({q.version_count})</td>
            <td>{q.latest_totals?.total_incl_vat != null ? fmtZAR(q.latest_totals.total_incl_vat) : '—'}</td>
            <td>{new Date(q.created_at).toLocaleString('en-ZA')}</td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}
