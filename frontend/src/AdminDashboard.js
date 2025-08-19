import React, { useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { API_URL } from './apiConfig';
import './AdminDashboard.css';

const AdminDashboard = () => {
  const { user, loading: authLoading } = useAuth();
  const [users, setUsers] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteFirstName, setInviteFirstName] = useState('');
  const [inviteLastName, setInviteLastName] = useState('');
  const [inviteRole, setInviteRole] = useState('design');
  const [loading, setLoading] = useState(true);
  const [inviting, setInviting] = useState(false);
  const [message, setMessage] = useState('');
  const [activeTab, setActiveTab] = useState('users');

  const [currentUserId, setCurrentUserId] = useState(null);

  useEffect(() => {
    setCurrentUserId(user?.id);
  }, [user]);

  const getAuthHeaders = React.useCallback(() => {
    const token = localStorage.getItem('access_token');
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
  }, []);

  const fetchUsers = React.useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/api/auth/admin/users`, {
        headers: getAuthHeaders()
      });

      if (response.ok) {
        const data = await response.json();
        setUsers(data.users);
      } else {
        setMessage('Failed to fetch users');
      }
    } catch (error) {
      setMessage('Error fetching users');
      console.error('Error:', error);
    }
  }, [getAuthHeaders]);

  const fetchAuditLogs = React.useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/api/auth/admin/audit-logs`, {
        headers: getAuthHeaders()
      });

      if (response.ok) {
        const data = await response.json();
        setAuditLogs(data.logs);
      }
    } catch (error) {
      console.error('Error fetching audit logs:', error);
    }
  }, [getAuthHeaders]);

  useEffect(() => {
    const loadData = async () => {
      // Only fetch data if auth is loaded and user is authenticated
      if (!authLoading && user && user.id) {
        try {
          await Promise.all([fetchUsers(), fetchAuditLogs()]);
        } catch (error) {
          console.error('Error loading admin data:', error);
          setMessage('Error loading admin data');
        } finally {
          setLoading(false);
        }
      } else if (!authLoading) {
        // Auth is loaded but no user - should not happen in protected route
        setLoading(false);
      }
    };
    loadData();
  }, [fetchUsers, fetchAuditLogs, user, authLoading]);

  const handleInviteUser = async (e) => {
    e.preventDefault();
    setInviting(true);
    setMessage('');

    try {
      const response = await fetch(`${API_URL}/api/auth/admin/invite`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          email: inviteEmail,
          first_name: inviteFirstName,
          last_name: inviteLastName,
          role: inviteRole
        })
      });

      const data = await response.json();

      if (response.ok) {
        setMessage(`Invitation sent to ${inviteEmail}`);
        setInviteEmail('');
        setInviteFirstName('');
        setInviteLastName('');
        fetchUsers(); // Refresh users list
      } else {
        setMessage(data.message || 'Failed to send invitation');
      }
    } catch (error) {
      setMessage('Error sending invitation');
      console.error('Error:', error);
    } finally {
      setInviting(false);
    }
  };

  const handleToggleUserStatus = async (userId, currentStatus) => {
    try {
      const action = currentStatus ? 'deactivate' : 'activate';
      const response = await fetch(`${API_URL}/api/auth/admin/users/${userId}/${action}`, {
        method: 'POST',
        headers: getAuthHeaders()
      });

      if (response.ok) {
        setMessage(`User ${action}d successfully`);
        fetchUsers(); // Refresh users list
      } else {
        setMessage(`Failed to ${action} user`);
      }
    } catch (error) {
      setMessage('Error updating user status');
      console.error('Error:', error);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('en-ZA', {
      timeZone: 'Africa/Johannesburg',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
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
        <p>Welcome, {user.first_name}</p>
      </div>

      <div className="admin-tabs">
        <button 
          className={`tab-button ${activeTab === 'users' ? 'active' : ''}`}
          onClick={() => setActiveTab('users')}
        >
          User Management
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

      {activeTab === 'users' && (
        <div className="users-section">
          <div className="invite-section">
            <h2>Invite New User</h2>
            <form onSubmit={handleInviteUser} className="invite-form">
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="firstName">First Name</label>
                  <input
                    type="text"
                    id="firstName"
                    value={inviteFirstName}
                    onChange={(e) => setInviteFirstName(e.target.value)}
                    placeholder="John"
                    required
                    disabled={inviting}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="lastName">Last Name</label>
                  <input
                    type="text"
                    id="lastName"
                    value={inviteLastName}
                    onChange={(e) => setInviteLastName(e.target.value)}
                    placeholder="Doe"
                    required
                    disabled={inviting}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="email">Email Address</label>
                  <input
                    type="email"
                    id="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="user@orkasolar.co.za"
                    required
                    disabled={inviting}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="role">Role</label>
                  <select
                    id="role"
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value)}
                    disabled={inviting}
                  >
                    <option value="design">Design Team</option>
                    <option value="sales">Sales Team</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <button type="submit" disabled={inviting} className="invite-button">
                  {inviting ? 'Sending...' : 'Send Invitation'}
                </button>
              </div>
            </form>
          </div>

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
                    <th>Last Login</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(user => (
                    <tr key={user.id}>
                      <td>{user.first_name}</td>
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
                      <td>{user.last_login ? formatDate(user.last_login) : 'Never'}</td>
                      <td>
                        <button
                          onClick={() => handleToggleUserStatus(user.id, user.is_active)}
                          className={`action-button ${user.is_active ? 'deactivate' : 'activate'}`}
                          disabled={user.id === currentUserId} // Can't deactivate yourself
                        >
                          {user.is_active ? 'Deactivate' : 'Activate'}
                        </button>
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
                  <th>Timestamp</th>
                  <th>User</th>
                  <th>Action</th>
                  <th>Resource Type</th>
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
    </div>
  );
};

export default AdminDashboard;
