import React, { useEffect, useState } from 'react';
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
  const [status, setStatus] = useState('initializing');

  useEffect(() => {
    const handleLogin = async () => {
      try {
        const { data: { user }, error } = await supabase.auth.getUser();
        
        if (error || !user) throw new Error('Not logged in');
        
        setStatus('redirecting');
        const role = getUserRole(user.email);
        
        if (role === 'admin' || role === 'qc') {
          navigate(createPageUrl('AdminDashboard'), { replace: true });
        } else if (role === 'contractor') {
          navigate(createPageUrl('ContractorDashboard'), { replace: true });
        } else {
          // Fallback for any other user to the main admin dashboard
          navigate(createPageUrl('AdminDashboard'), { replace: true });
        }
      } catch (error) {
        // User is not logged in, start the login process.
        setStatus('logging_in');
        await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: window.location.origin + createPageUrl('PortalAccess')
          }
        });
      }
    };

    handleLogin();
  }, [navigate]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="text-center">
        <Building2 className="w-12 h-12 text-blue-600 mx-auto mb-4" />
        <div className="flex items-center justify-center space-x-3">
          <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
          <p className="text-lg text-gray-700 font-medium">
            {status === 'redirecting' ? 'Redirecting to your dashboard...' : 'Preparing login...'}
          </p>
        </div>
        <p className="text-sm text-gray-500 mt-2">
          You will be forwarded to the Google sign-in page.
        </p>
      </div>
    </div>
  );
}