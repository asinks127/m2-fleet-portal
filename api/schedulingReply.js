import nodemailer from 'nodemailer';
import { supabase, getAuthUser } from '../_lib/supabaseServer.js';

function header(value = '') { return String(value).replace(/[\r\n<>]/g, '').trim(); }

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  const user = await getAuthUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  const { id, body } = req.body || {};
  if (!id || !body?.trim()) return res.status(400).json({ error: 'Message and reply body are required' });
  const { data: message, error } = await supabase.from('SchedulingEmail').select('*').eq('id', id).single();
  if (error || !message) return res.status(404).json({ error: 'Scheduling message not found' });
  const smtpUser = process.env.GMAIL_SCHEDULING_USER || process.env.GMAIL_USER;
  const smtpPass = process.env.GMAIL_SCHEDULING_APP_PASSWORD || process.env.GMAIL_APP_PASSWORD;
  if (!smtpUser || !smtpPass) return res.status(503).json({ error: 'Reply-all is not configured on the portal server', detail: 'The scheduling mailbox is connected to Zo, but the portal server still needs a Gmail send credential or a Gmail relay.' });
  const transporter = nodemailer.createTransport({ service: 'gmail', auth: { user: smtpUser, pass: smtpPass } });
  const subject = /^re:/i.test(message.subject || '') ? message.subject : `Re: ${message.subject || ''}`;
  const to = [message.sender, message.recipients, message.cc_recipients].filter(Boolean).join(',');
  await transporter.sendMail({ from: smtpUser, to, subject, text: body, inReplyTo: message.message_id, references: message.message_id });
  const now = new Date().toISOString();
  await supabase.from('SchedulingEmail').update({ status: 'replied', needs_reply: false, last_replied_at: now, last_replied_by: user.email, updated_at: now }).eq('id', id);
  return res.status(200).json({ sent: true, status: 'replied' });
}
