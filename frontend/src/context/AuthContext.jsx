import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('baaki_auth_token'));
  const [loading, setLoading] = useState(true);
  const [demoMode, setDemoMode] = useState(true);

  // Check existing session
  useEffect(() => {
    async function checkAuth() {
      try {
        const config = await api.get('/auth/config');
        if (config && config.demo_mode !== undefined) {
          setDemoMode(config.demo_mode);
        }

        const currentToken = localStorage.getItem('baaki_auth_token');
        if (currentToken) {
          const res = await api.get('/auth/me');
          if (res && res.authenticated) {
            setUser(res.user);
          } else {
            localStorage.removeItem('baaki_auth_token');
            setUser(null);
            setToken(null);
          }
        }
      } catch (err) {
        // Not authenticated
        setUser(null);
      } finally {
        setLoading(false);
      }
    }

    checkAuth();
  }, []);

  const login = async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    if (res && res.token) {
      localStorage.setItem('baaki_auth_token', res.token);
      setToken(res.token);
      setUser(res.user);
      return res;
    }
    throw new Error('Login failed: invalid response');
  };

  const loginDemo = async () => {
    const res = await api.post('/auth/demo-login', {});
    if (res && res.token) {
      localStorage.setItem('baaki_auth_token', res.token);
      setToken(res.token);
      setUser(res.user);
      return res;
    }
    throw new Error('Demo login failed');
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout', {});
    } catch {
      // ignore
    }
    localStorage.removeItem('baaki_auth_token');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        demoMode,
        isAuthenticated: Boolean(user || token),
        login,
        loginDemo,
        logout
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}

export default AuthContext;
