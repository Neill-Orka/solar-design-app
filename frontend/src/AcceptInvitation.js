import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { API_URL } from './apiConfig';
import './Login.css'; // Reuse login styles

const AcceptInvitation = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    password: '',
    confirmPassword: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    setError(''); // Clear error when user starts typing
  };

  const validatePassword = (password) => {
    if (password.length < 8) {
      return 'Password must be at least 8 characters long';
    }
    if (!/[A-Z]/.test(password)) {
      return 'Password must contain at least one uppercase letter';
    }
    if (!/[a-z]/.test(password)) {
      return 'Password must contain at least one lowercase letter';
    }
    if (!/[0-9]/.test(password)) {
      return 'Password must contain at least one number';
    }
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      return 'Password must contain at least one special character';
    }
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    const passwordError = validatePassword(formData.password);
    if (passwordError) {
      setError(passwordError);
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/auth/accept-invitation/${token}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          password: formData.password
        })
      });

      const data = await response.json();

      if (response.ok) {
        setMessage('Account activated successfully! Redirecting to login...');
        setTimeout(() => {
          navigate('/login');
        }, 2000);
      } else {
        setError(data.message || 'Failed to accept invitation');
      }
    } catch (error) {
      setError('Network error. Please try again.');
      console.error('Accept invitation error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <img 
            src="/orka_logo.png" 
            alt="Orka Solar" 
            className="login-logo"
          />
          <h2>Complete Your Registration</h2>
          <p>Set your password to activate your account</p>
        </div>

        <div className="login-form">
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="password">New Password</label>
              <input
                type="password"
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="Enter your password"
                required
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label htmlFor="confirmPassword">Confirm Password</label>
              <input
                type="password"
                id="confirmPassword"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                placeholder="Confirm your password"
                required
                disabled={loading}
              />
            </div>

            {error && (
              <div className="error-message">
                {error}
              </div>
            )}

            {message && (
              <div style={{ 
                padding: '10px', 
                marginBottom: '15px', 
                backgroundColor: '#d4edda', 
                color: '#155724', 
                border: '1px solid #c3e6cb', 
                borderRadius: '5px' 
              }}>
                {message}
              </div>
            )}

            <button 
              type="submit" 
              className="login-button" 
              disabled={loading}
            >
              {loading ? 'Activating Account...' : 'Activate Account'}
            </button>
          </form>
        </div>

        <div className="login-footer">
          <div style={{ fontSize: '12px', color: '#666', marginTop: '15px' }}>
            <strong>Password Requirements:</strong>
            <ul style={{ textAlign: 'left', marginTop: '5px', paddingLeft: '20px' }}>
              <li>At least 8 characters long</li>
              <li>One uppercase letter</li>
              <li>One lowercase letter</li>
              <li>One number</li>
              <li>One special character</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AcceptInvitation;
