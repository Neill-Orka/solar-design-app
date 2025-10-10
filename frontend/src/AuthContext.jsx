import React, { createContext, useContext, useState, useEffect } from 'react';
import { API_URL } from './apiConfig';
import { setAuthToken } from './features/jobcards/api';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initializeAuth = async () => {
      const token = localStorage.getItem('access_token');
      const userData = localStorage.getItem('user');

      if (!token || !userData) {
        setLoading(false);
        return;
      }

      setAuthToken(token);

      const hitMe = async (accessToken) => {
        const res = await fetch(`${API_URL}/api/auth/me`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        return res;
      };

      try {
        // 1) try with current token
        let res = await hitMe(token);

        // 2) if 401, try refresh once, then retry /me
        if (res.status === 401) {
          const newToken = await refreshToken(); // your existing function
          if (newToken) {
            res = await hitMe(newToken);
          }
        }

        if (res.ok) {
          const data = await res.json();
          setUser(data.user);
        } else {
          // only logout if second attempt also failed
          logout();
        }
      } catch (err) {
        console.error('Auth verification failed:', err);
        // network hiccup? don’t nuke the session immediately
        // optionally keep the user and rely on next interaction to refresh
        // but if you prefer to be strict, call logout() here.
        logout();
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();
  }, []);

  useEffect(() => {
      let timer;
      const schedule = (token) => {
          try {
              const [, payload] = token.split('.');
              const { exp } = JSON.parse(atob(payload));
              const ms = exp * 1000 - Date.now() - 60_000; // refresh 60s early
              if (ms > 0) {
                  timer = setTimeout(async () => {
                      // try a silent refresh; on failure logout() is already handled in refreshToken()
                      const ok = await refreshToken();
                      const t = localStorage.getItem('access_token');
                      if (ok && t) schedule(t);
                  }, ms);
              }
          } catch {}
      };

      const t = localStorage.getItem('access_token');
      if (t) schedule(t);

      return () => timer && clearTimeout(timer);
  }, [user]);


  const login = (userData, tokens) => {
    setUser(userData);
    localStorage.setItem('access_token', tokens.access_token);
    localStorage.setItem('refresh_token', tokens.refresh_token);
    localStorage.setItem('user', JSON.stringify(userData));
    setAuthToken(tokens.access_token);
  };

  // logout: also clears axios defaults
  const logout = async () => {
    const accessToken = localStorage.getItem('access_token');
    const refreshToken = localStorage.getItem('refresh_token');
    
    // Call logout endpoint to invalidate tokens
    if (refreshToken && accessToken) {
      try {
        await fetch(`${API_URL}/api/auth/logout`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`
          },
          body: JSON.stringify({ refresh_token: refreshToken })
        });
      } catch (error) {
        console.error('Logout error:', error);
      }
    }

    // Clear user state and tokens
    setUser(null);
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
    setAuthToken(null);
  };

  const refreshToken = async () => {
    const refresh = localStorage.getItem('refresh_token');
    
    if (!refresh) {
      logout();
      return null;
    }

    try {
      const response = await fetch(`${API_URL}/api/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refresh_token: refresh })
      });

      if (response.ok) {
        const data = await response.json();
        localStorage.setItem('access_token', data.access_token);
        setAuthToken(data.access_token);
        return data.access_token;
      } else {
        logout();
        return null;
      }
    } catch (error) {
      console.error('Token refresh failed:', error);
      logout();
      return null;
    }
  };

  const hasRole = (requiredRole) => {
    if (!user) return false;
    
    const roleHierarchy = {
      'admin': 6,
      'manager': 5,
      'sales': 4,
      'design': 3,
      'team_leader': 2,
      'technician': 1
    };

    return roleHierarchy[user.role] >= roleHierarchy[requiredRole];
  };

  const canDelete = () => {
    return user && user.role === 'admin'; // only admin can delete
  }

  const canModifyProjects = () => {
    return user && (user.role === 'admin' || user.role === 'design');
  };

  const canModifyProducts = () => {
    return user && (user.role === 'admin' || user.role === 'sales');
  };

  const canApproveJobCards = () => {
    return user && ['admin'].includes(user.role);
  }

  const canCreateJobCards = () => {
    return user && ['admin', 'team_leader'].includes(user.role);
  }

  const canViewJobCards = () => {
    return user && ['admin', 'manager', 'team_leader', 'technician', 'sales'].includes(user.role);
  }

  const value = {
    user,
    login,
    logout,
    refreshToken,
    hasRole,
    canModifyProjects,
    canModifyProducts,
    canDelete,
    canApproveJobCards,
    canCreateJobCards,
    canViewJobCards,
    loading,
    isAuthenticated: !!user
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
