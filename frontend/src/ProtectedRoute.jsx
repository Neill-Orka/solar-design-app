import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';

const ProtectedRoute = ({ children, requiredRole = null, fallback = null }) => {
  const { user, loading, isAuthenticated, hasRole } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    // Redirect to login with the current location
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (requiredRole) {
    // Handle both string and array role requirements
    const hasAccess = Array.isArray(requiredRole)
      ? requiredRole.some(role => hasRole(role))
      : hasRole(requiredRole);

    if (!hasAccess) {
      if (fallback) {
        return fallback;
      }

      // Format required role(s) for display
      const roleDisplay = Array.isArray(requiredRole)
        ? requiredRole.join(' or ')
        : requiredRole;

      return (
        <div className="access-denied">
        <h2>Access Denied</h2>
        <p>You don't have permission to access this page.</p>
        <p>Required role: {roleDisplay}</p>
        <p>Your role: {user.role}</p>
      </div>
      );
    }
  }

  return children;
};

export default ProtectedRoute;
