import React, { useState, useEffect, useCallback, useRef } from 'react';
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

  // System settings variables
  const [vehicles, setVehicles] = useState([]);
  const [categories, setCategories] = useState([]);
  const [bums, setBums] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [settingsSection, setSettingsSection] = useState('vehicles');

  // Add loading states
  const [loadingVehicles, setLoadingVehicles] = useState(false);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [loadingBums, setLoadingBums] = useState(false);
  const [loadingTechnicians, setLoadingTechnicians] = useState(false);

  // Add form states for editing/creating
  const [editingVehicle, setEditingVehicle] = useState(null);
  const [editingCategory, setEditingCategory] = useState(null);
  const [editingBum, setEditingBum] = useState(null);
  const [editingTechnician, setEditingTechnician] = useState(null);

  
  const getAuthHeaders = useCallback(() => {
    const token = localStorage.getItem('access_token');
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
  }, []);
  
  const fetchVehicles = useCallback(async () => {
    setLoadingVehicles(true);
    try {
      const response = await fetch(`${API_URL}/api/vehicles`, {
        headers: getAuthHeaders()
      });
      if (response.ok) {
        const data = await response.json();
        setVehicles(data);
      } else {
        setMessage('Failed to fetch vehicles');
      }
    } catch (error) {
      console.error('Error fetching vehicles:', error);
      setMessage('Error loading vehicles');
    } finally {
      setLoadingVehicles(false);
    }
  }, [getAuthHeaders]);

  const fetchCategories = useCallback(async () => {
    setLoadingCategories(true);
    try {
      const response = await fetch(`${API_URL}/api/jobcategories`, {
        headers: getAuthHeaders()
      });
      if (response.ok) {
        const data = await response.json();
        setCategories(data);
      } else {
        setMessage('Failed to fetch job categories');
      }
    } catch (error) {
      console.error('Error fetching job categories:', error);
      setMessage('Error loading job categories');
    } finally {
      setLoadingCategories(false);
    }
  }, [getAuthHeaders]);

  const fetchBums = useCallback(async () => {
    setLoadingBums(true);
    try {
      const response = await fetch(`${API_URL}/api/auth/users?is_bum=1`, {
        headers: getAuthHeaders()
      });
      if (response.ok) {
        const data = await response.json();
        setBums(data);
      } else {
        setMessage('Failed to fetch BUMs');
      }
    } catch (error) {
      console.error('Error fetching BUMs:', error);
      setMessage('Error loading BUMs');
    } finally {
      setLoadingBums(false);
    }
  }, [getAuthHeaders]);

  const fetchTechnicians = useCallback(async () => {
    setLoadingTechnicians(true);
    try {
      const response = await fetch(`${API_URL}/api/auth/technicians`, {
        headers: getAuthHeaders()
      });
      if (response.ok) {
        const data = await response.json();
        setTechnicians(data);
      } else {
        setMessage('Failed to fetch technicians');
      }
    } catch (error) {
      console.error('Error fetching technicians:', error);
      setMessage('Error loading technicians');
    } finally {
      setLoadingTechnicians(false);
    }
  }, [getAuthHeaders]);

  useEffect(() => {
    if (activeTab === 'settings') {
      // Load all settings data
      fetchVehicles();
      fetchCategories();
      fetchBums();
      fetchTechnicians();
    }
  }, [activeTab, fetchVehicles, fetchCategories, fetchBums, fetchTechnicians]);

  // Add these handlers for vehicles
const handleSaveVehicle = async (vehicle) => {
  try {
    const method = vehicle.id ? 'PUT' : 'POST';
    const url = vehicle.id ? 
      `${API_URL}/api/vehicles/${vehicle.id}` : 
      `${API_URL}/api/vehicles`;
    
    const response = await fetch(url, {
      method,
      headers: getAuthHeaders(),
      body: JSON.stringify(vehicle)
    });
    
    if (response.ok) {
      setMessage(`Vehicle ${vehicle.id ? 'updated' : 'added'} successfully`);
      fetchVehicles();
      setEditingVehicle(null);
    } else {
      const error = await response.json();
      setMessage(error.message || `Failed to ${vehicle.id ? 'update' : 'add'} vehicle`);
    }
  } catch (error) {
    console.error(`Error ${vehicle.id ? 'updating' : 'adding'} vehicle:`, error);
    setMessage(`Error ${vehicle.id ? 'updating' : 'adding'} vehicle`);
  }
};

const handleDeleteVehicle = async (id) => {
  if (!confirm('Are you sure you want to delete this vehicle?')) return;
  
  try {
    const response = await fetch(`${API_URL}/api/vehicles/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    
    if (response.ok) {
      setMessage('Vehicle deleted successfully');
      fetchVehicles();
    } else {
      const error = await response.json();
      setMessage(error.message || 'Failed to delete vehicle');
    }
  } catch (error) {
    console.error('Error deleting vehicle:', error);
    setMessage('Error deleting vehicle');
  }
};

// Add handlers for categories
const handleSaveCategory = async (category) => {
  try {
    const method = category.id ? 'PUT' : 'POST';
    const url = category.id ? 
      `${API_URL}/api/jobcategories/${category.id}` : 
      `${API_URL}/api/jobcategories`;
    
    const response = await fetch(url, {
      method,
      headers: getAuthHeaders(),
      body: JSON.stringify(category)
    });
    
    if (response.ok) {
      setMessage(`Category ${category.id ? 'updated' : 'added'} successfully`);
      fetchCategories();
      setEditingCategory(null);
    } else {
      const error = await response.json();
      setMessage(error.message || `Failed to ${category.id ? 'update' : 'add'} category`);
    }
  } catch (error) {
    console.error(`Error ${category.id ? 'updating' : 'adding'} category:`, error);
    setMessage(`Error ${category.id ? 'updating' : 'adding'} category`);
  }
};

const handleDeleteCategory = async (id) => {
  if (!confirm('Are you sure you want to delete this category? This may affect existing job cards.')) return;
  
  try {
    const response = await fetch(`${API_URL}/api/jobcategories/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    
    if (response.ok) {
      setMessage('Category deleted successfully');
      fetchCategories();
    } else {
      const error = await response.json();
      setMessage(error.message || 'Failed to delete category');
    }
  } catch (error) {
    console.error('Error deleting category:', error);
    setMessage('Error deleting category');
  }
};

// Add handlers for BUMs management
const handleToggleBumStatus = async (userId, isBum) => {
  try {
    const response = await fetch(`${API_URL}/api/auth/users/${userId}/toggle-bum`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ is_bum: !isBum })
    });
    
    if (response.ok) {
      setMessage(`User ${isBum ? 'removed from' : 'set as'} BUM successfully`);
      fetchBums();
      // Also update the regular users list if shown
      if (activeTab === 'users') {
        fetchUsers();
      }
    } else {
      const error = await response.json();
      setMessage(error.message || `Failed to update BUM status`);
    }
  } catch (error) {
    console.error('Error updating BUM status:', error);
    setMessage('Error updating BUM status');
  }
};

// Add handlers for technicians
const handleSaveTechnician = async (tech) => {
  try {
    const method = tech.tech_profile_id ? 'PUT' : 'POST';
    const url = tech.tech_profile_id ? 
      `${API_URL}/api/auth/technicians/${tech.tech_profile_id}` : 
      `${API_URL}/api/auth/technicians`;
    
    const response = await fetch(url, {
      method,
      headers: getAuthHeaders(),
      body: JSON.stringify(tech)
    });
    
    if (response.ok) {
      setMessage(`Technician ${tech.tech_profile_id ? 'updated' : 'added'} successfully`);
      fetchTechnicians();
      setEditingTechnician(null);
    } else {
      const error = await response.json();
      setMessage(error.message || `Failed to ${tech.tech_profile_id ? 'update' : 'add'} technician`);
    }
  } catch (error) {
    console.error(`Error ${tech.tech_profile_id ? 'updating' : 'adding'} technician:`, error);
    setMessage(`Error ${tech.tech_profile_id ? 'updating' : 'adding'} technician`);
  }
};

const handleDeleteTechnician = async (id) => {
  if (!confirm('Are you sure you want to remove this technician profile?')) return;
  
  try {
    const response = await fetch(`${API_URL}/api/auth/technicians/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    
    if (response.ok) {
      setMessage('Technician profile removed successfully');
      fetchTechnicians();
    } else {
      const error = await response.json();
      setMessage(error.message || 'Failed to remove technician profile');
    }
  } catch (error) {
    console.error('Error removing technician profile:', error);
    setMessage('Error removing technician profile');
  }
};

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
      case 'manager': return 'role-manager';
      case 'sales': return 'role-sales';
      case 'design': return 'role-design';
      case 'team_leader': return 'role-team-leader';
      case 'technician': return 'role-technician';
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
          className={`tab-button ${activeTab === 'settings' ? 'active' : ''}`}
          onClick={() => setActiveTab('settings')}  
        >
          System Settings
        </button>
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

{activeTab === 'settings' && (
  <div className="settings-section">
    <div className="settings-header">
      <h2>System Settings</h2>
      <div className="settings-nav">
        <button 
          className={`settings-nav-btn ${settingsSection === 'vehicles' ? 'active' : ''}`}
          onClick={() => setSettingsSection('vehicles')}
        >
          Vehicles
        </button>
        <button 
          className={`settings-nav-btn ${settingsSection === 'categories' ? 'active' : ''}`}
          onClick={() => setSettingsSection('categories')}
        >
          Job Categories
        </button>
        <button 
          className={`settings-nav-btn ${settingsSection === 'bums' ? 'active' : ''}`}
          onClick={() => setSettingsSection('bums')}
        >
          Business Unit Managers
        </button>
        <button 
          className={`settings-nav-btn ${settingsSection === 'technicians' ? 'active' : ''}`}
          onClick={() => setSettingsSection('technicians')}
        >
          Technicians
        </button>
      </div>
    </div>

    {/* Vehicles Management */}
    {settingsSection === 'vehicles' && (
      <div className="vehicles-section">
        <div className="section-header">
          <h3>Vehicles Management</h3>
          <button 
            className="add-btn"
            onClick={() => setEditingVehicle({ name: '', registration: '', rate_per_km: 0, active: true })}
          >
            Add New Vehicle
          </button>
        </div>

        {loadingVehicles ? (
          <div className="loading">Loading vehicles...</div>
        ) : (
          <table className="settings-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Registration</th>
                <th>Rate (per km)</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {vehicles.map(vehicle => (
                <tr key={vehicle.id}>
                  <td>{vehicle.name}</td>
                  <td>{vehicle.registration || '-'}</td>
                  <td>R{vehicle.rate_per_km.toFixed(2)}</td>
                  <td>
                    <span className={`status-badge ${vehicle.active ? 'active' : 'inactive'}`}>
                      {vehicle.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>
                    <button 
                      className="action-button edit" 
                      onClick={() => setEditingVehicle(vehicle)}
                    >
                      Edit
                    </button>
                    <button 
                      className="action-button delete" 
                      onClick={() => handleDeleteVehicle(vehicle.id)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {vehicles.length === 0 && (
                <tr>
                  <td colSpan="5" className="no-data">No vehicles found</td>
                </tr>
              )}
            </tbody>
          </table>
        )}

        {/* Vehicle Edit Modal */}
        {editingVehicle && (
          <div className="modal-overlay">
            <div className="modal-content">
              <h3>{editingVehicle.id ? 'Edit Vehicle' : 'Add New Vehicle'}</h3>
              <form onSubmit={(e) => {
                e.preventDefault();
                handleSaveVehicle(editingVehicle);
              }}>
                <div className="form-group">
                  <label>Name</label>
                  <input 
                    type="text" 
                    value={editingVehicle.name} 
                    onChange={(e) => setEditingVehicle({...editingVehicle, name: e.target.value})}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Registration</label>
                  <input 
                    type="text" 
                    value={editingVehicle.registration || ''} 
                    onChange={(e) => setEditingVehicle({...editingVehicle, registration: e.target.value})}
                  />
                </div>
                <div className="form-group">
                  <label>Rate per km (R)</label>
                  <input 
                    type="number" 
                    step="0.01"
                    min="0"
                    value={editingVehicle.rate_per_km} 
                    onChange={(e) => setEditingVehicle({...editingVehicle, rate_per_km: parseFloat(e.target.value)})}
                    required
                  />
                </div>
                <div className="form-group checkbox">
                  <label>
                    <input 
                      type="checkbox" 
                      checked={editingVehicle.active} 
                      onChange={(e) => setEditingVehicle({...editingVehicle, active: e.target.checked})}
                    />
                    Active
                  </label>
                </div>
                <div className="modal-actions">
                  <button type="button" className="cancel-btn" onClick={() => setEditingVehicle(null)}>
                    Cancel
                  </button>
                  <button type="submit" className="save-btn">
                    {editingVehicle.id ? 'Update Vehicle' : 'Add Vehicle'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    )}

    {/* Job Categories Management */}
    {settingsSection === 'categories' && (
      <div className="categories-section">
        <div className="section-header">
          <h3>Job Categories Management</h3>
          <button 
            className="add-btn"
            onClick={() => setEditingCategory({ name: '', active: true })}
          >
            Add New Category
          </button>
        </div>

        {loadingCategories ? (
          <div className="loading">Loading categories...</div>
        ) : (
          <table className="settings-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {categories.map(category => (
                <tr key={category.id}>
                  <td>{category.name}</td>
                  <td>
                    <span className={`status-badge ${category.active ? 'active' : 'inactive'}`}>
                      {category.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>
                    <button 
                      className="action-button edit" 
                      onClick={() => setEditingCategory(category)}
                    >
                      Edit
                    </button>
                    <button 
                      className="action-button delete" 
                      onClick={() => handleDeleteCategory(category.id)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {categories.length === 0 && (
                <tr>
                  <td colSpan="3" className="no-data">No categories found</td>
                </tr>
              )}
            </tbody>
          </table>
        )}

        {/* Category Edit Modal */}
        {editingCategory && (
          <div className="modal-overlay">
            <div className="modal-content">
              <h3>{editingCategory.id ? 'Edit Category' : 'Add New Category'}</h3>
              <form onSubmit={(e) => {
                e.preventDefault();
                handleSaveCategory(editingCategory);
              }}>
                <div className="form-group">
                  <label>Name</label>
                  <input 
                    type="text" 
                    value={editingCategory.name} 
                    onChange={(e) => setEditingCategory({...editingCategory, name: e.target.value})}
                    required
                  />
                </div>
                <div className="form-group checkbox">
                  <label>
                    <input 
                      type="checkbox" 
                      checked={editingCategory.active} 
                      onChange={(e) => setEditingCategory({...editingCategory, active: e.target.checked})}
                    />
                    Active
                  </label>
                </div>
                <div className="modal-actions">
                  <button type="button" className="cancel-btn" onClick={() => setEditingCategory(null)}>
                    Cancel
                  </button>
                  <button type="submit" className="save-btn">
                    {editingCategory.id ? 'Update Category' : 'Add Category'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    )}

    {/* BUM Management */}
    {settingsSection === 'bums' && (
      <div className="bums-section">
        <div className="section-header">
          <h3>Business Unit Managers (BUMs)</h3>
          <p className="info-text">
            To add a new BUM, first add them as a user, then assign the BUM role here.
          </p>
        </div>

        <div className="bums-users-section">
          <h4>Current BUMs</h4>
          {loadingBums ? (
            <div className="loading">Loading BUMs...</div>
          ) : (
            <table className="settings-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {bums.map(bum => (
                  <tr key={bum.id}>
                    <td>{bum.full_name}</td>
                    <td>{bum.email}</td>
                    <td>
                      <button 
                        className="action-button remove" 
                        onClick={() => handleToggleBumStatus(bum.id, true)}
                      >
                        Remove BUM Status
                      </button>
                    </td>
                  </tr>
                ))}
                {bums.length === 0 && (
                  <tr>
                    <td colSpan="3" className="no-data">No BUMs assigned</td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        <div className="eligible-users-section">
          <h4>Assign BUM Role to Users</h4>
          {!loadingUsers ? (
            <table className="settings-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.filter(user => 
                  // Only show active users who aren't already BUMs
                  user.is_active && !user.is_bum
                ).map(user => (
                  <tr key={user.id}>
                    <td>{user.full_name}</td>
                    <td>{user.email}</td>
                    <td>{user.role}</td>
                    <td>
                      <button 
                        className="action-button assign" 
                        onClick={() => handleToggleBumStatus(user.id, false)}
                      >
                        Assign as BUM
                      </button>
                    </td>
                  </tr>
                ))}
                {users.filter(user => user.is_active && !user.is_bum).length === 0 && (
                  <tr>
                    <td colSpan="4" className="no-data">No eligible users found</td>
                  </tr>
                )}
              </tbody>
            </table>
          ) : (
            <div className="loading">Loading users...</div>
          )}
        </div>
      </div>
    )}

    {/* Technicians Management */}
    {settingsSection === 'technicians' && (
      <div className="technicians-section">
        <div className="section-header">
          <h3>Technicians Management</h3>
          <button 
            className="add-btn"
            onClick={() => {
              // Create a new technician form with dropdown of eligible users
              setEditingTechnician({ 
                user_id: '', 
                hourly_rate: 0, 
                active: true,
                eligible_users: users.filter(u => u.is_active && !technicians.some(t => t.id === u.id))
              });
            }}
          >
            Add New Technician
          </button>
        </div>

        {loadingTechnicians ? (
          <div className="loading">Loading technicians...</div>
        ) : (
          <table className="settings-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Hourly Rate</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {technicians.map(tech => (
                <tr key={tech.id}>
                  <td>{tech.full_name}</td>
                  <td>R{tech.hourly_rate.toFixed(2)}</td>
                  <td>
                    <span className={`status-badge ${tech.active ? 'active' : 'inactive'}`}>
                      {tech.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>
                    <button 
                      className="action-button edit" 
                      onClick={() => setEditingTechnician({
                        tech_profile_id: tech.tech_profile_id,
                        user_id: tech.id,
                        full_name: tech.full_name,
                        hourly_rate: tech.hourly_rate,
                        active: tech.active
                      })}
                    >
                      Edit
                    </button>
                    <button 
                      className="action-button delete" 
                      onClick={() => handleDeleteTechnician(tech.tech_profile_id)}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
              {technicians.length === 0 && (
                <tr>
                  <td colSpan="4" className="no-data">No technicians found</td>
                </tr>
              )}
            </tbody>
          </table>
        )}

        {/* Technician Edit Modal */}
        {editingTechnician && (
          <div className="modal-overlay">
            <div className="modal-content">
              <h3>{editingTechnician.tech_profile_id ? 'Edit Technician' : 'Add New Technician'}</h3>
              <form onSubmit={(e) => {
                e.preventDefault();
                handleSaveTechnician(editingTechnician);
              }}>
                {!editingTechnician.tech_profile_id ? (
                  <div className="form-group">
                    <label>Select User</label>
                    <select 
                      value={editingTechnician.user_id} 
                      onChange={(e) => setEditingTechnician({...editingTechnician, user_id: e.target.value})}
                      required
                    >
                      <option value="">-- Select a user --</option>
                      {editingTechnician.eligible_users.map(user => (
                        <option key={user.id} value={user.id}>
                          {user.full_name} ({user.email})
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div className="form-group">
                    <label>Technician</label>
                    <input type="text" value={editingTechnician.full_name} disabled />
                  </div>
                )}
                <div className="form-group">
                  <label>Hourly Rate (R)</label>
                  <input 
                    type="number" 
                    step="0.01"
                    min="0"
                    value={editingTechnician.hourly_rate} 
                    onChange={(e) => setEditingTechnician({...editingTechnician, hourly_rate: parseFloat(e.target.value)})}
                    required
                  />
                </div>
                <div className="form-group checkbox">
                  <label>
                    <input 
                      type="checkbox" 
                      checked={editingTechnician.active} 
                      onChange={(e) => setEditingTechnician({...editingTechnician, active: e.target.checked})}
                    />
                    Active
                  </label>
                </div>
                <div className="modal-actions">
                  <button type="button" className="cancel-btn" onClick={() => setEditingTechnician(null)}>
                    Cancel
                  </button>
                  <button type="submit" className="save-btn">
                    {editingTechnician.tech_profile_id ? 'Update Technician' : 'Add Technician'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    )}
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
                    <option value="admin">Admin</option>
                    <option value="manager">Manager</option>
                    <option value="design">Design</option>
                    <option value="sales">Sales</option>
                    <option value="team_leader">Team Leader</option>
                    <option value="technician">Technician</option>
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
                <option value="manager">Manager</option>
                <option value="sales">Sales</option>
                <option value="design">Design</option>
                <option value="team_leader">Team Leader</option>
                <option value="technician">Technician</option>
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
