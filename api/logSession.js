// POST /api/logSession — user session tracking for the warranty app.
// Body: { action: 'start'|'heartbeat'|'end', session_id, is_idle }
import { getAuthUser, supabase } from '../_lib/supabaseServer.js';
import { entities } from './_warranty/warrantyService.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  const user = await getAuthUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  try {
    // The auth user object may not carry a User-table row; resolve role/name.
    const { data: userRow } = await supabase
      .from('User')
      .select('fullName, display_name, role')
      .eq('email', (user.email || '').toLowerCase())
      .maybeSingle();

    const email = user.email || 'unknown';
    const fullName = userRow?.fullName || userRow?.display_name || email;
    const now = new Date().toISOString();
    const body = typeof req.body === 'object' ? req.body : {};
    const { action, session_id, is_idle } = body;

    if (action === 'start') {
      const stale = await entities.UserSession.filter({ user_email: email, is_active: true });
      for (const s of stale) {
        const lastSeen = new Date(s.last_seen || s.session_start);
        const minutesAgo = (Date.now() - lastSeen.getTime()) / 60000;
        if (minutesAgo > 10) {
          const durSeconds = Math.round((lastSeen - new Date(s.session_start)) / 1000);
          await entities.UserSession.update(s.id, {
            is_active: false,
            session_end: s.last_seen,
            duration_minutes: Math.max(0, Math.floor(durSeconds / 60)),
            duration_seconds: Math.max(0, durSeconds),
          });
        }
      }
      const session = await entities.UserSession.create({
        user_email: email,
        user_name: fullName,
        session_start: now,
        last_seen: now,
        is_active: true,
        duration_minutes: 0,
        duration_seconds: 0,
      });
      return res.status(200).json({ session_id: session.id });
    }

    if (action === 'heartbeat' && session_id) {
      const { data: s } = await supabase.from('UserSession').select('*').eq('id', session_id).maybeSingle();
      if (s && s.is_active) {
        const durSeconds = Math.round((Date.now() - new Date(s.session_start).getTime()) / 1000);
        const intervalSeconds = 120;
        const newActive = is_idle ? (s.active_seconds || 0) : (s.active_seconds || 0) + intervalSeconds;
        const newIdle = is_idle ? (s.idle_seconds || 0) + intervalSeconds : (s.idle_seconds || 0);
        await entities.UserSession.update(session_id, {
          last_seen: now,
          duration_minutes: Math.floor(durSeconds / 60),
          duration_seconds: durSeconds,
          active_seconds: newActive,
          idle_seconds: newIdle,
        });
      }
      return res.status(200).json({ ok: true });
    }

    if (action === 'end' && session_id) {
      const { data: s } = await supabase.from('UserSession').select('*').eq('id', session_id).maybeSingle();
      if (s) {
        const durSeconds = Math.round((Date.now() - new Date(s.session_start).getTime()) / 1000);
        await entities.UserSession.update(session_id, {
          is_active: false,
          session_end: now,
          duration_minutes: Math.floor(durSeconds / 60),
          duration_seconds: Math.max(0, durSeconds),
        });
      }
      return res.status(200).json({ ok: true });
    }

    return res.status(200).json({ ok: true });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
