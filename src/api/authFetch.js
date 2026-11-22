// Shared fetch helper that attaches the Supabase session token to /api calls.
import { supabase } from '@/lib/supabaseClient.js';

export async function authFetch(path, options = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  const headers = { ...(options.headers || {}) };
  if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
  else if (options.body && !(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }
  const res = await fetch(path, { ...options, headers, credentials: 'include' });
  return res;
}

// Authenticated download (export endpoints return file bodies, not JSON).
export async function authDownload(path, fallbackName = 'download') {
  const res = await authFetch(path);
  if (!res.ok) {
    let msg = `Download failed (${res.status})`;
    try { msg = (await res.json()).error || msg; } catch {}
    throw new Error(msg);
  }
  const blob = await res.blob();
  const dispo = res.headers.get('content-disposition') || '';
  const m = dispo.match(/filename="?([^";]+)"?/);
  const name = m ? m[1] : fallbackName;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
