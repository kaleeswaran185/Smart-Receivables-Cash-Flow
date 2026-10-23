import React, { createContext, useContext, useState, useEffect } from 'react';
import api, { getAuthToken, requestSilentDemoToken } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => getAuthToken());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [demoMode, setDemoMode] = useState(true);

  // Initialize silent demo session on app start
  useEffect(() => {
    let isMounted = true;

    async function initSession() {
      // If we are on a public payment link (/pay/:token), do not block
      if (typeof window !== 'undefined' && window.location.pathname.startsWith('/pay/')) {
        if (isMounted) setLoading(false);
        return;
      }

      try {
        let currentToken = getAuthToken();
        if (!currentToken) {
          currentToken = await requestSilentDemoToken();
        }

        if (currentToken && isMounted) {
          setToken(currentToken);
          setUser({ email: 'owner@baaki.app', role: 'owner', demo: true });
        }
      } catch (err) {
        console.error('Failed to establish silent demo session:', err);
        if (isMounted) {
          setError(err.message || 'Unable to establish demo session');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    initSession();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        error,
        demoMode,
        isAuthenticated: true
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
