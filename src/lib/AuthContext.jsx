import React, { createContext, useState, useContext, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient.js';
import { createPageUrl } from '@/utils/index.js';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [authError, setAuthError] = useState(null);

  useEffect(() => {
    const checkSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw error;
        setIsAuthenticated(!!session);
        setUser(session?.user ?? null);
      } catch (error) {
        console.error('Session check failed:', error);
        setAuthError({
          type: 'auth_required',
          message: 'Authentication required'
        });
      } finally {
        setIsLoadingAuth(false);
      }
    };

    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setIsAuthenticated(!!session);
      setUser(session?.user ?? null);
      if (event === 'SIGNED_OUT') {
        setAuthError(null);
      }
      setIsLoadingAuth(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const logout = async (shouldRedirect = true) => {
    setIsLoadingAuth(true);
    await supabase.auth.signOut();
    setUser(null);
    setIsAuthenticated(false);
    setIsLoadingAuth(false);
    if (shouldRedirect) {
      window.location.href = createPageUrl('PortalAccess');
    }
  };

  const navigateToLogin = () => {
    window.location.href = createPageUrl('PortalAccess');
  };

  const checkAppState = async () => {};

  return (
    <AuthContext.Provider value={{ 
      user, 
      isAuthenticated, 
      isLoadingAuth,
      isLoadingPublicSettings: false,
      authError,
      appPublicSettings: {},
      logout,
      navigateToLogin,
      checkAppState
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
