import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils/index.js';
import { supabase } from '@/lib/supabaseClient.js';
import { Loader2, Building2 } from 'lucide-react';

const getUserRole = (email) => {
  if (!email) return null;
  const emailLower = email.toLowerCase();

  if (emailLower.includes('.contractor@')) {
    const qcUsers = [
      'rmiller.contractor@m2fleetcom.com',
      'choffman.contractor@m2fleetcom.com',
      'ryan@m2fleetcom.com'
    ];
    return qcUsers.includes(emailLower) ? 'qc' : 'contractor';
  }

  if (emailLower.endsWith('@m2fleetcom.com')) {
    return 'admin';
  }

  return null;
};

export default function PortalAccessPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState('checking');
  const [errorMessage, setErrorMessage] = useState('');
  const callbackUrl = useMemo(() => `${window.location.origin}${createPageUrl('PortalAccess')}`, []);

  useEffect(() => {
    const handleLogin = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw error;

        const user = session?.user;
        if (!user) {
          setStatus('ready');
          return;
        }

        setStatus('redirecting');
        const role = getUserRole(user.email);

        if (role === 'admin' || role === 'qc') {
          navigate(createPageUrl('AdminDashboard'), { replace: true });
        } else if (role === 'contractor') {
          navigate(createPageUrl('ContractorDashboard'), { replace: true });
        } else {
          navigate(createPageUrl('AdminDashboard'), { replace: true });
        }
      } catch (error) {
        setStatus('ready');
        setErrorMessage(error?.message || 'Unable to check your session.');
      }
    };

    handleLogin();
  }, [navigate]);

  const handleGoogleSignIn = async () => {
    try {
      setStatus('starting_login');
      setErrorMessage('');
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: callbackUrl
        }
      });
      if (error) throw error;
    } catch (error) {
      setStatus('ready');
      setErrorMessage(error?.message || 'Google sign-in could not be started.');
    }
  };

  const loading = status === 'checking' || status === 'redirecting' || status === 'starting_login';

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-6 text-center">
          <Building2 className="mx-auto mb-4 h-12 w-12 text-blue-600" />
          <h1 className="text-2xl font-semibold text-slate-900">M2 Fleet Portal</h1>
          <p className="mt-2 text-sm text-slate-600">Sign in with Google to access your dashboard.</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-3 rounded-xl bg-slate-50 px-4 py-6 text-slate-700">
            <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
            <span>
              {status === 'redirecting' ? 'Opening your dashboard...' : 'Preparing sign-in...'}
            </span>
          </div>
        ) : (
          <button
            onClick={handleGoogleSignIn}
            className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-blue-700"
          >
            Continue with Google
          </button>
        )}

        {errorMessage ? (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <p className="font-medium">Sign-in needs attention</p>
            <p className="mt-1 break-words">{errorMessage}</p>
            <p className="mt-3 text-amber-800">If Google login bounces back here, add this exact redirect URL in Supabase Auth:</p>
            <code className="mt-2 block break-all rounded-md bg-white px-3 py-2 text-xs text-slate-800">{callbackUrl}</code>
          </div>
        ) : null}
      </div>
    </div>
  );
}