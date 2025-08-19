import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { API_URL } from './apiConfig';
import './AdminDashboard.css';

const AdminDashboard = () => {
  const { user: currentUser, loading: authLoading } = useAuth();
  const [users, setUsers] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [registrationTokens, setRegistrationTokens] = useState([]);
  const [tokenRole, setTokenRole] = useState('design');
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [message, setMessage] = useState('');
  const [activeTab, setActiveTab] = useState('users');
  
  // User management modals
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [newRole, setNewRole] = useState('');
  const [userActionLoading, setUserActionLoading] = useState(false);

  const getAuthHeaders = useCallback(() => {
    const token = localStorage.getItem('access_token');
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
  }, []);

  const fetchUsers = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/api/auth/admin/users`, {
        headers: getAuthHeaders()
      });

      if (response.ok) {
        const data = await response.json();
        setUsers(data.users);
      } else {
        console.error('Failed to fetch users');
      }
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  }, [getAuthHeaders]);

  const fetchAuditLogs = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/api/auth/admin/audit-logs`, {
        headers: getAuthHeaders()
      });

      if (response.ok) {
        const data = await response.json();
        setAuditLogs(data.logs);
      } else {
        console.error('Failed to fetch audit logs');
      }
    } catch (error) {
      console.error('Error fetching audit logs:', error);
    }
  }, [getAuthHeaders]);

  const fetchRegistrationTokens = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/api/auth/admin/tokens`, {
        headers: getAuthHeaders()
      });

      if (response.ok) {
        const data = await response.json();
        setRegistrationTokens(data.tokens);
      } else {
        console.error('Failed to fetch registration tokens');
      }
    } catch (error) {
      console.error('Error fetching registration tokens:', error);
    }
  }, [getAuthHeaders]);

  useEffect(() => {
    const loadData = async () => {
      if (currentUser && currentUser.role === 'admin' && !authLoading) {
        setLoading(true);
        await Promise.all([
          fetchUsers(),
          fetchAuditLogs(),
          fetchRegistrationTokens()
        ]);
        setLoading(false);
      } else {
        setLoading(false);
      }
    };

    loadData();
  }, [fetchUsers, fetchAuditLogs, fetchRegistrationTokens, currentUser, authLoading]);

  const handleGenerateToken = async (e) => {
    e.preventDefault();
    setGenerating(true);
    setMessage('');

    try {
      const response = await fetch(`${API_URL}/api/auth/admin/generate-token`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          role: tokenRole
        })
      });

      const data = await response.json();

      if (response.ok) {
        setMessage(`Registration token generated: ${data.token} (Role: ${data.role}, Expires: ${new Date(data.expires_at).toLocaleDateString()})`);
        fetchRegistrationTokens();
        setTokenRole('design');
      } else {
        setMessage(data.message || 'Failed to generate token');
      }
    } catch (error) {
      setMessage('Error generating token');
      console.error('Error:', error);
    } finally {
      setGenerating(false);
    }
  };

  const handleToggleUserStatus = async (userId, currentStatus) => {
    const action = currentStatus ? 'deactivate' : 'activate';
    
    try {
      const response = await fetch(`${API_URL}/api/auth/admin/users/${userId}/${action}`, {
        method: 'POST',
        headers: getAuthHeaders()
      });

      if (response.ok) {
        fetchUsers();
        setMessage(`User ${action}d successfully`);
      } else {
        const data = await response.json();
        setMessage(data.message || `Failed to ${action} user`);
      }
    } catch (error) {
      setMessage(`Error ${action}ing user`);
      console.error('Error:', error);
    }
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;
    
    setUserActionLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/auth/admin/users/${selectedUser.id}/delete`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });

      if (response.ok) {
        fetchUsers();
        setMessage(`User ${selectedUser.email} deleted successfully`);
        setShowDeleteModal(false);
        setSelectedUser(null);
      } else {
        const data = await response.json();
        setMessage(data.message || 'Failed to delete user');
      }
    } catch (error) {
      setMessage('Error deleting user');
      console.error('Error:', error);
    } finally {
      setUserActionLoading(false);
    }
  };

  const handleChangeRole = async () => {
    if (!selectedUser || !newRole) return;
    
    setUserActionLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/auth/admin/users/${selectedUser.id}/role`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ role: newRole })
      });

      if (response.ok) {
        fetchUsers();
        setMessage(`User role changed successfully`);
        setShowRoleModal(false);
        setSelectedUser(null);
        setNewRole('');
      } else {
        const data = await response.json();
        setMessage(data.message || 'Failed to change user role');
      }
    } catch (error) {
      setMessage('Error changing user role');
      console.error('Error:', error);
    } finally {
      setUserActionLoading(false);
    }
  };

  const openDeleteModal = (user) => {
    setSelectedUser(user);
    setShowDeleteModal(true);
  };

  const openRoleModal = (user) => {
    setSelectedUser(user);
    setNewRole(user.role);
    setShowRoleModal(true);
  };

  const closeModals = () => {
    setShowDeleteModal(false);
    setShowRoleModal(false);
    setSelectedUser(null);
    setNewRole('');
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  const getRoleBadgeClass = (role) => {
    switch (role) {
      case 'admin': return 'role-admin';
      case 'sales': return 'role-sales';
      case 'design': return 'role-design';
      default: return 'role-default';
    }
  };

  if (authLoading || loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading admin dashboard...</p>
      </div>
    );
  }

  return (
    <div className="admin-dashboard">
      <div className="admin-header">
        <h1>Admin Dashboard</h1>
        <p>Welcome, {currentUser.first_name}</p>
      </div>

      <div className="admin-tabs">
        <button 
          className={`tab-button ${activeTab === 'users' ? 'active' : ''}`}
          onClick={() => setActiveTab('users')}
        >
          User Management
        </button>
        <button 
          className={`tab-button ${activeTab === 'tokens' ? 'active' : ''}`}
          onClick={() => setActiveTab('tokens')}
        >
          Registration Tokens
        </button>
        <button 
          className={`tab-button ${activeTab === 'logs' ? 'active' : ''}`}
          onClick={() => setActiveTab('logs')}
        >
          Audit Logs
        </button>
      </div>

      {message && (
        <div className={`message ${message.includes('Error') || message.includes('Failed') ? 'error' : 'success'}`}>
          {message}
        </div>
      )}

      {activeTab === 'tokens' && (
        <div className="tokens-section">
          <div className="token-generation-section">
            <h2>Generate Registration Token</h2>
            <form onSubmit={handleGenerateToken} className="token-form">
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="tokenRole">Role</label>
                  <select
                    id="tokenRole"
                    value={tokenRole}
                    onChange={(e) => setTokenRole(e.target.value)}
                    required
                    disabled={generating}
                  >
                    <option value="design">Design</option>
                    <option value="sales">Sales</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div className="form-group">
                  <button 
                    type="submit" 
                    className="generate-button"
                    disabled={generating}
                  >
                    {generating ? 'Generating...' : 'Generate Token'}
                  </button>
                </div>
              </div>
            </form>
          </div>

          <div className="tokens-list">
            <h2>Registration Tokens</h2>
            <div className="tokens-table">
              <table>
                <thead>
                  <tr>
                    <th>Token</th>
                    <th>Role</th>
                    <th>Created By</th>
                    <th>Created</th>
                    <th>Expires</th>
                    <th>Status</th>
                    <th>Used By</th>
                  </tr>
                </thead>
                <tbody>
                  {registrationTokens.map(token => (
                    <tr key={token.id}>
                      <td><code>{token.token}</code></td>
                      <td>
                        <span className={`role-badge role-${token.role.toLowerCase()}`}>
                          {token.role}
                        </span>
                      </td>
                      <td>{token.created_by}</td>
                      <td>{formatDate(token.created_at)}</td>
                      <td>{formatDate(token.expires_at)}</td>
                      <td>
                        <span className={`status-badge ${token.is_used ? 'used' : 'active'}`}>
                          {token.is_used ? 'Used' : 'Active'}
                        </span>
                      </td>
                      <td>{token.used_by || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'users' && (
        <div className="users-section">
          <div className="users-list">
            <h2>Current Users</h2>
            <div className="users-table">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Created</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(user => (
                    <tr key={user.id}>
                      <td>{user.full_name}</td>
                      <td>{user.email}</td>
                      <td>
                        <span className={`role-badge ${getRoleBadgeClass(user.role)}`}>
                          {user.role}
                        </span>
                      </td>
                      <td>
                        <span className={`status-badge ${user.is_active ? 'active' : 'inactive'}`}>
                          {user.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td>{formatDate(user.created_at)}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                          <button
                            className={`action-button ${user.is_active ? 'deactivate' : 'activate'}`}
                            onClick={() => handleToggleUserStatus(user.id, user.is_active)}
                            style={{ fontSize: '12px', padding: '4px 8px' }}
                          >
                            {user.is_active ? 'Deactivate' : 'Activate'}
                          </button>
                          
                          <button
                            className="action-button"
                            onClick={() => openRoleModal(user)}
                            style={{ fontSize: '12px', padding: '4px 8px', backgroundColor: '#007bff', borderColor: '#007bff' }}
                          >
                            Change Role
                          </button>
                          
                          {user.email !== currentUser.email && (
                            <button
                              className="action-button"
                              onClick={() => openDeleteModal(user)}
                              style={{ fontSize: '12px', padding: '4px 8px', backgroundColor: '#dc3545', borderColor: '#dc3545' }}
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'logs' && (
        <div className="logs-section">
          <h2>Audit Logs</h2>
          <div className="logs-table">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>User</th>
                  <th>Action</th>
                  <th>Resource</th>
                  <th>Resource ID</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.map(log => (
                  <tr key={log.id}>
                    <td>{formatDate(log.timestamp)}</td>
                    <td>{log.user_name || 'System'}</td>
                    <td>
                      <span className={`action-badge action-${log.action.toLowerCase()}`}>
                        {log.action}
                      </span>
                    </td>
                    <td>{log.resource_type}</td>
                    <td>{log.resource_id || '-'}</td>
                    <td>
                      {log.details ? (
                        typeof log.details === 'object' ? 
                          JSON.stringify(log.details) : 
                          log.details
                      ) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Delete User Modal */}
      {showDeleteModal && (
        <div className="modal-overlay" style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div className="modal-content" style={{
            backgroundColor: 'white',
            padding: '20px',
            borderRadius: '8px',
            maxWidth: '400px',
            width: '90%'
          }}>
            <h3>Delete User</h3>
            <p>Are you sure you want to delete <strong>{selectedUser?.email}</strong>?</p>
            <p style={{ color: '#dc3545', fontSize: '14px' }}>This action cannot be undone.</p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '20px' }}>
              <button 
                className="btn btn-secondary" 
                onClick={closeModals}
                disabled={userActionLoading}
              >
                Cancel
              </button>
              <button 
                className="btn btn-danger" 
                onClick={handleDeleteUser}
                disabled={userActionLoading}
              >
                {userActionLoading ? 'Deleting...' : 'Delete User'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Change Role Modal */}
      {showRoleModal && (
        <div className="modal-overlay" style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div className="modal-content" style={{
            backgroundColor: 'white',
            padding: '20px',
            borderRadius: '8px',
            maxWidth: '400px',
            width: '90%'
          }}>
            <h3>Change User Role</h3>
            <p>Change role for <strong>{selectedUser?.email}</strong></p>
            <div className="form-group" style={{ marginBottom: '20px' }}>
              <label htmlFor="roleSelect">New Role:</label>
              <select 
                id="roleSelect"
                className="form-control"
                value={newRole}
                onChange={(e) => setNewRole(e.target.value)}
                disabled={userActionLoading}
              >
                <option value="admin">Admin</option>
                <option value="sales">Sales</option>
                <option value="design">Design</option>
              </select>
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button 
                className="btn btn-secondary" 
                onClick={closeModals}
                disabled={userActionLoading}
              >
                Cancel
              </button>
              <button 
                className="btn btn-primary" 
                onClick={handleChangeRole}
                disabled={userActionLoading || !newRole}
              >
                {userActionLoading ? 'Changing...' : 'Change Role'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
