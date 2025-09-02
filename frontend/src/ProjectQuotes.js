// ProjectQuotes.js
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Table, Badge, Spinner, Button, ButtonGroup } from 'react-bootstrap';
import { useNotification } from './NotificationContext';
import { API_URL } from './apiConfig';

export default function ProjectQuotes({ projectId, onOpenQuote }) {
  const [rows, setRows] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState({});
  const { showNotification } = useNotification();

  const loadQuotes = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_URL}/api/projects/${projectId}/quotes`);
      setRows(response.data);
    } catch (error) {
      console.error('Failed to load quotes:', error);
      showNotification('Failed to load quotes', 'danger');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadQuotes();
  }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleAcceptQuote = async (quoteId, e) => {
    e.stopPropagation(); // Prevent row click
    if (!window.confirm('Mark this quote as accepted?')) return;
    
    setActionLoading(prev => ({ ...prev, [quoteId]: 'accept' }));
    try {
      await axios.post(`${API_URL}/api/quotes/${quoteId}/accept`);
      showNotification('Quote accepted!', 'success');
      await loadQuotes(); // Reload quotes to get updated status
    } catch (error) {
      console.error(error);
      showNotification(error.response?.data?.error || 'Failed to accept quote', 'danger');
    } finally {
      setActionLoading(prev => ({ ...prev, [quoteId]: null }));
    }
  };

  const handleDeclineQuote = async (quoteId, e) => {
    e.stopPropagation(); // Prevent row click
    if (!window.confirm('Mark this quote as declined?')) return;
    
    setActionLoading(prev => ({ ...prev, [quoteId]: 'decline' }));
    try {
      await axios.post(`${API_URL}/api/quotes/${quoteId}/decline`);
      showNotification('Quote declined', 'info');
      await loadQuotes(); // Reload quotes to get updated status
    } catch (error) {
      console.error(error);
      showNotification(error.response?.data?.error || 'Failed to decline quote', 'danger');
    } finally {
      setActionLoading(prev => ({ ...prev, [quoteId]: null }));
    }
  };

  if (loading) return <Spinner size="sm" />;

  if (!rows?.length) return <div className="text-muted">No quotes yet.</div>;

  const fmtZAR = v => (new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(v || 0)).replace('R', 'R ');

  const getStatusBadge = (status) => {
    const statusLower = (status || 'draft').toLowerCase();
    switch (statusLower) {
      case 'sent': return <Badge bg="success">{status}</Badge>;
      case 'accepted': return <Badge bg="primary">{status}</Badge>;
      case 'declined': return <Badge bg="danger">{status}</Badge>;
      default: return <Badge bg="secondary">{status || 'draft'}</Badge>;
    }
  };

  return (
    <Table striped hover size="sm" className="align-middle">
      <thead>
        <tr>
          <th>#</th>
          <th>Status</th>
          <th>Latest ver.</th>
          <th>Total (incl. VAT)</th>
          <th>Created</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(q => (
          <tr key={q.id}>
            <td 
              onClick={() => onOpenQuote?.(q.id)} 
              style={{ cursor: onOpenQuote ? 'pointer' : 'default' }}
            >
              {q.number}
            </td>
            <td 
              onClick={() => onOpenQuote?.(q.id)} 
              style={{ cursor: onOpenQuote ? 'pointer' : 'default' }}
            >
              {getStatusBadge(q.status)}
            </td>
            <td 
              onClick={() => onOpenQuote?.(q.id)} 
              style={{ cursor: onOpenQuote ? 'pointer' : 'default' }}
            >
              V{q.version_count || 1}
            </td>
            <td 
              onClick={() => onOpenQuote?.(q.id)} 
              style={{ cursor: onOpenQuote ? 'pointer' : 'default' }}
            >
              {q.latest_totals?.total_incl_vat != null ? fmtZAR(q.latest_totals.total_incl_vat) : '—'}
            </td>
            <td 
              onClick={() => onOpenQuote?.(q.id)} 
              style={{ cursor: onOpenQuote ? 'pointer' : 'default' }}
            >
              {new Date(q.created_at).toLocaleString('en-ZA')}
            </td>
            <td>
              {q.status === 'sent' && (
                <ButtonGroup size="sm">
                  <Button 
                    variant="success" 
                    size="sm"
                    onClick={(e) => handleAcceptQuote(q.id, e)}
                    disabled={actionLoading[q.id] === 'accept'}
                    title="Accept Quote"
                  >
                    {actionLoading[q.id] === 'accept' ? (
                      <Spinner animation="border" size="sm" />
                    ) : (
                      <i className="bi bi-check-circle"></i>
                    )}
                  </Button>
                  <Button 
                    variant="outline-danger" 
                    size="sm"
                    onClick={(e) => handleDeclineQuote(q.id, e)}
                    disabled={actionLoading[q.id] === 'decline'}
                    title="Decline Quote"
                  >
                    {actionLoading[q.id] === 'decline' ? (
                      <Spinner animation="border" size="sm" />
                    ) : (
                      <i className="bi bi-x-circle"></i>
                    )}
                  </Button>
                </ButtonGroup>
              )}
              {q.status === 'accepted' && (
                <Badge bg="success" style={{ fontSize: '0.7rem' }}>
                  <i className="bi bi-check-circle me-1"></i>Accepted
                </Badge>
              )}
              {q.status === 'declined' && (
                <Badge bg="danger" style={{ fontSize: '0.7rem' }}>
                  <i className="bi bi-x-circle me-1"></i>Declined
                </Badge>
              )}
              {(q.status === 'draft' || !q.status) && (
                <span className="text-muted" style={{ fontSize: '0.8rem' }}>
                  <i className="bi bi-pencil"></i> Draft
                </span>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}
