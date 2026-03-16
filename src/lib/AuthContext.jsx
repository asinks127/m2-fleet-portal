import React, { createContext, useState, useContext, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient.js';
import { createPageUrl } from '@/utils/index.js';

const AuthContext = createContext();

const DEMO_USER = {
  id: '22222222-2222-4222-8222-222222222222',
  email: 'pm.west@m2fleetcom.com',
  user_metadata: {
    full_name: 'Casey Walker',
    role: 'pm'
  }
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(DEMO_USER);
  const [isAuthenticated, setIsAuthenticated] = useState(true);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [authError, setAuthError] = useState(null);

  useEffect(() => {
    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          setUser(session.user);
          setIsAuthenticated(true);
        } else {
          setUser(DEMO_USER);
          setIsAuthenticated(true);
        }
      } catch (error) {
        console.error('Session check failed, using demo mode:', error);
        setUser(DEMO_USER);
        setIsAuthenticated(true);
        setAuthError(null);
      } finally {
        setIsLoadingAuth(false);
      }
    };

    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || !session?.user) {
        setUser(DEMO_USER);
        setIsAuthenticated(true);
        setAuthError(null);
      } else {
        setUser(session.user);
        setIsAuthenticated(true);
      }
      setIsLoadingAuth(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const logout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Logout failed:', error);
    }
    setUser(DEMO_USER);
    setIsAuthenticated(true);
    setIsLoadingAuth(false);
    setAuthError(null);
    window.location.href = createPageUrl('AdminDashboard');
  };

  const navigateToLogin = () => {
    window.location.href = createPageUrl('AdminDashboard');
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
