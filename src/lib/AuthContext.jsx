import React, { createContext, useState, useContext, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient.js';
import { createPageUrl } from '@/utils/index.js';

const AuthContext = createContext();

const DEMO_MODE = import.meta.env.VITE_DEMO_MODE === 'true';
const DEBUG_USER_EMAIL = 'tjserota@gmail.com';

const DEMO_USER = {
  id: '22222222-2222-4222-8222-222222222222',
  email: 'pm.west@m2fleetcom.com',
  user_metadata: {
    full_name: 'Casey Walker',
    role: 'pm'
  }
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(DEMO_MODE ? DEMO_USER : null);
  const [isAuthenticated, setIsAuthenticated] = useState(DEMO_MODE);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [authError, setAuthError] = useState(null);
  // Debug role override for tjserota@gmail.com
  const [roleOverride, setRoleOverride] = useState(null); // null = use real role, 'admin' = force admin, 'contractor' = force contractor

  useEffect(() => {
    const checkSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw error;

        if (session?.user) {
          setUser(session.user);
          setIsAuthenticated(true);
          setAuthError(null);
        } else if (DEMO_MODE) {
          setUser(DEMO_USER);
          setIsAuthenticated(true);
          setAuthError(null);
        } else {
          setUser(null);
          setIsAuthenticated(false);
          setAuthError({ type: 'auth_required', message: 'Authentication required' });
        }
      } catch (error) {
        if (DEMO_MODE) {
          setUser(DEMO_USER);
          setIsAuthenticated(true);
          setAuthError(null);
        } else {
          setUser(null);
          setIsAuthenticated(false);
          setAuthError({ type: 'auth_required', message: 'Authentication required' });
        }
      } finally {
        setIsLoadingAuth(false);
      }
    };

    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || !session?.user) {
        if (DEMO_MODE) {
          setUser(DEMO_USER);
          setIsAuthenticated(true);
          setAuthError(null);
        } else {
          setUser(null);
          setIsAuthenticated(false);
          setAuthError({ type: 'auth_required', message: 'Authentication required' });
        }
      } else {
        setUser(session.user);
        setIsAuthenticated(true);
        setAuthError(null);
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
    } catch {}

    if (DEMO_MODE) {
      setUser(DEMO_USER);
      setIsAuthenticated(true);
      setAuthError(null);
      window.location.href = createPageUrl('AdminDashboard');
      return;
    }

    setUser(null);
    setIsAuthenticated(false);
    setAuthError({ type: 'auth_required', message: 'Authentication required' });
    window.location.href = createPageUrl('PortalAccess');
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
      checkAppState,
      roleOverride,
      isDebugUser: user?.email === DEBUG_USER_EMAIL,
      toggleDebugRole: () => setRoleOverride(prev => prev === 'admin' ? 'contractor' : prev === 'contractor' ? null : 'admin'),
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
