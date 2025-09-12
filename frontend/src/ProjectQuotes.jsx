// ProjectQuotes.js
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Table, Badge, Spinner, Button, ButtonGroup, Form } from 'react-bootstrap';
import { useNotification } from './NotificationContext';
import { API_URL } from './apiConfig';

export default function ProjectQuotes({ projectId, onOpenQuote }) {
  const [rows, setRows] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState({});
  const [editingQuote, setEditingQuote] = useState(null);
  const [editValue, setEditValue] = useState('');
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

  useEffect(() => {
    const onRefetch = () => window.location.reload();
    window.addEventListener('refresh-project', onRefetch);
    window.addEventListener('refresh-quotes', onRefetch);
    return () => {
      window.removeEventListener('refresh-project', onRefetch);
      window.removeEventListener('refresh-quotes', onRefetch);
    };
}, []);


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

  const handleDeleteQuote = async (quoteId, quoteNumber, e) => {
    e.stopPropagation(); // Prevent row click
    if (!window.confirm(`Are you sure you want to delete quote "${quoteNumber}"? This action cannot be undone.`)) return;
    
    setActionLoading(prev => ({ ...prev, [quoteId]: 'delete' }));
    try {
      await axios.delete(`${API_URL}/api/quotes/${quoteId}`);
      showNotification('Quote deleted successfully', 'success');
      await loadQuotes(); // Reload quotes
    } catch (error) {
      console.error(error);
      showNotification(error.response?.data?.error || 'Failed to delete quote', 'danger');
    } finally {
      setActionLoading(prev => ({ ...prev, [quoteId]: null }));
    }
  };

  const handleStartEdit = (quote, e) => {
    e.stopPropagation(); // Prevent row click
    setEditingQuote(quote.id);
    // Find the last sequence of digits and separate everything before it
    const match = quote.number.match(/^(.*?)(\d+)$/);
    if (match) {
      // If we found a numeric ending, edit everything except that number
      setEditValue(match[1]); // Everything before the number
    } else {
      // If no numeric ending, allow editing the whole thing
      setEditValue(quote.number);
    }
  };

  const handleCancelEdit = () => {
    setEditingQuote(null);
    setEditValue('');
  };

  const handleSaveEdit = async (quoteId, originalNumber) => {
    if (!editValue.trim()) {
      showNotification('Quote prefix cannot be empty', 'danger');
      return;
    }

    setActionLoading(prev => ({ ...prev, [quoteId]: 'rename' }));
    try {
      await axios.patch(`${API_URL}/api/quotes/${quoteId}/rename`, {
        new_prefix: editValue.trim()
      });
      showNotification('Quote renamed successfully', 'success');
      setEditingQuote(null);
      setEditValue('');
      await loadQuotes(); // Reload quotes
    } catch (error) {
      console.error(error);
      showNotification(error.response?.data?.error || 'Failed to rename quote', 'danger');
    } finally {
      setActionLoading(prev => ({ ...prev, [quoteId]: null }));
    }
  };

  const handleKeyPress = (e, quoteId, originalNumber) => {
    if (e.key === 'Enter') {
      handleSaveEdit(quoteId, originalNumber);
    } else if (e.key === 'Escape') {
      handleCancelEdit();
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

  const getSequenceNumber = (quoteNumber) => {
    // Find the last sequence of digits at the end
    const match = quoteNumber.match(/(\d+)$/);
    return match ? match[1] : '';
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
              onClick={() => !editingQuote && onOpenQuote?.(q.id)} 
              style={{ cursor: !editingQuote && onOpenQuote ? 'pointer' : 'default' }}
            >
              {editingQuote === q.id ? (
                <div className="d-flex align-items-center">
                  <Form.Control
                    type="text"
                    size="sm"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={(e) => handleKeyPress(e, q.id, q.number)}
                    style={{ width: '200px', marginRight: '5px' }}
                    autoFocus
                  />
                  <span className="text-muted">{getSequenceNumber(q.number)}</span>
                  <div className="ms-2">
                    <Button
                      variant="success"
                      size="sm"
                      onClick={() => handleSaveEdit(q.id, q.number)}
                      disabled={actionLoading[q.id] === 'rename'}
                      className="me-1"
                    >
                      {actionLoading[q.id] === 'rename' ? <Spinner animation="border" size="sm" /> : <i className="bi bi-check"></i>}
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={handleCancelEdit}
                    >
                      <i className="bi bi-x"></i>
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="d-flex align-items-center">
                  <span>{q.number}</span>
                  <Button
                    variant="link"
                    size="sm"
                    onClick={(e) => handleStartEdit(q, e)}
                    className="ms-2 p-0"
                    title="Rename quote"
                  >
                    <i className="bi bi-pencil"></i>
                  </Button>
                </div>
              )}
            </td>
            <td 
              onClick={() => !editingQuote && onOpenQuote?.(q.id)} 
              style={{ cursor: !editingQuote && onOpenQuote ? 'pointer' : 'default' }}
            >
              {getStatusBadge(q.status)}
            </td>
            <td 
              onClick={() => !editingQuote && onOpenQuote?.(q.id)} 
              style={{ cursor: !editingQuote && onOpenQuote ? 'pointer' : 'default' }}
            >
              V{q.version_count || 1}
            </td>
            <td 
              onClick={() => !editingQuote && onOpenQuote?.(q.id)} 
              style={{ cursor: !editingQuote && onOpenQuote ? 'pointer' : 'default' }}
            >
              {q.latest_totals?.total_incl_vat != null ? fmtZAR(q.latest_totals.total_incl_vat) : '—'}
            </td>
            <td 
              onClick={() => !editingQuote && onOpenQuote?.(q.id)} 
              style={{ cursor: !editingQuote && onOpenQuote ? 'pointer' : 'default' }}
            >
              {new Date(q.created_at).toLocaleString('en-ZA')}
            </td>
            <td>
              {editingQuote === q.id ? (
                <div className="text-muted small">Editing...</div>
              ) : (
                <div className="d-flex align-items-center">
                  {/* Accept/Decline buttons for sent quotes */}
                  {q.status === 'sent' && (
                    <ButtonGroup size="sm" className="me-2">
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

                  {/* Status badges for accepted/declined quotes */}
                  {q.status === 'accepted' && (
                    <Badge bg="success" style={{ fontSize: '0.7rem' }} className="me-2">
                      <i className="bi bi-check-circle me-1"></i>Accepted
                    </Badge>
                  )}
                  {q.status === 'declined' && (
                    <Badge bg="danger" style={{ fontSize: '0.7rem' }} className="me-2">
                      <i className="bi bi-x-circle me-1"></i>Declined
                    </Badge>
                  )}
                  {(q.status === 'draft' || !q.status) && (
                    <span className="text-muted me-2" style={{ fontSize: '0.8rem' }}>
                      <i className="bi bi-pencil"></i> Draft
                    </span>
                  )}

                  {/* Delete button */}
                  <Button
                    variant="outline-danger"
                    size="sm"
                    onClick={(e) => handleDeleteQuote(q.id, q.number, e)}
                    disabled={actionLoading[q.id] === 'delete'}
                    title="Delete Quote"
                  >
                    {actionLoading[q.id] === 'delete' ? (
                      <Spinner animation="border" size="sm" />
                    ) : (
                      <i className="bi bi-trash"></i>
                    )}
                  </Button>
                </div>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}
