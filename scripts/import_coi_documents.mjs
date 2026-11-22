// Downloads every COI from the Base44 WorkersCompRecord export and re-homes
// it into the app's private insurance-docs bucket, linking to InsurancePolicy rows.
// Usage: node scripts/import_coi_documents.mjs [--apply]  (default: dry run)
import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';
import path from 'node:path';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) { console.error('Missing Supabase env'); process.exit(1); }
const APPLY = process.argv.includes('--apply');
const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

const csvPath = '/home/.z/chat-uploads/WorkersCompRecord_export-bd3d4d8c8b7f.csv';
const raw = fs.readFileSync(csvPath, 'utf8');
const lines = raw.split(/\r?\n/);
const header = lines[0].split(',');
const idx = (n) => header.indexOf(n);
const rows = [];
for (const line of lines.slice(1)) {
  if (!line.trim()) continue;
  // naive CSV split (no quoted commas in this export)
  const c = line.split(',');
  rows.push({
    userName: c[idx('userName')],
    email: c[idx('userEmail')],
    policyNumber: c[idx('policyNumber')],
    effective: c[idx('policyEffectiveDate')],
    expiration: c[idx('policyExpirationDate')],
    docUrl: (c[idx('documentUrl')] || '').trim(),
  });
}
const withDocs = rows.filter(r => r.docUrl && r.docUrl !== 'None');
const uniqueUrls = [...new Set(withDocs.map(r => r.docUrl))];
console.log(`rows=${rows.length} rowsWithDoc=${withDocs.length} uniqueDocs=${uniqueUrls.length}`);

// Fetch live policies
const { data: policies, error } = await sb.from('InsurancePolicy').select('id,contractor_email,insurance_type,policy_number,effective_date,expiration_date,document_path');
if (error) { console.error('policies fetch:', error.message); process.exit(1); }
const wc = policies.filter(p => p.insurance_type === 'workers_comp');
console.log(`live policies=${policies.length} wc=${wc.length}`);

// Download each unique doc
const downloads = [];
for (const url of uniqueUrls) {
  let dl = url;
  if (!dl.startsWith('http')) dl = `https://base44.app/api/apps/68a390239868be00767c8ae8/files/${dl}`;
  try {
    const res = await fetch(dl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!res.ok) { console.log(`  SKIP ${res.status}: ${dl}`); downloads.push({ url, ok: false, status: res.status }); continue; }
    const buf = Buffer.from(await res.arrayBuffer());
    const isPdf = buf.slice(0, 5).toString() === '%PDF-';
    const isImg = buf[0] === 0xFF && buf[1] === 0xD8; // jpeg
    const isPng = buf.slice(0, 4).toString() === '\x89PNG';
    downloads.push({ url, ok: isPdf || isImg || isPng, buf, status: res.status });
    console.log(`  OK ${buf.length}B ${isPdf ? 'pdf' : isImg ? 'jpeg' : isPng ? 'png' : 'UNKNOWN'}: ${url}`);
  } catch (e) { downloads.push({ url, ok: false, status: e.message }); console.log(`  ERR ${e.message}: ${dl}`); }
}
const byUrl = new Map(downloads.map(d => [d.url, d]));

// Match CSV rows to live policies
let matched = 0, unmatched = [], plan = [];
for (const r of withDocs) {
  const d = byUrl.get(r.docUrl);
  if (!d?.ok) continue;
  const cands = wc.filter(p => (p.contractor_email || '').toLowerCase() === (r.email || '').toLowerCase());
  if (!cands.length) { unmatched.push(r); continue; }
  // prefer exact policy_number, then date-pair match, else most recent
  let p = cands.find(x => x.policy_number && r.policyNumber && x.policy_number === r.policyNumber);
  if (!p) p = cands.find(x => x.effective_date === r.effective && x.expiration_date === r.expiration);
  if (!p) p = cands.sort((a, b) => (b.effective_date || '').localeCompare(a.effective_date || ''))[0];
  const ext = d.buf.slice(0, 5).toString() === '%PDF-' ? 'pdf' : 'jpg';
  const storagePath = `certificates/${(r.email || 'unknown').toLowerCase().replace(/[^a-z0-9._-]/g, '_')}/workers_comp_${r.expiration || p.effective_date || 'record'}.${ext}`;
  plan.push({ policyId: p.id, email: r.email, storagePath, bytes: d.buf.length, already: p.document_path === storagePath });
  matched++;
}
console.log(`\nmatched=${matched} unmatchedRows=${unmatched.length}`);
if (unmatched.length) console.log('unmatched:', unmatched.map(u => u.email).join(', '));

if (!APPLY) {
  console.log('\nDRY RUN ONLY — re-run with --apply to upload + link');
  for (const s of plan.slice(0, 5)) console.log(`  would store ${s.storagePath} (${s.bytes}B) -> ${s.email}`);
  process.exit(0);
}

let uploaded = 0, linked = 0, skipped = 0, failed = 0;
for (const s of plan) {
  const d = byUrl.get(withDocs.find(r => (r.email || '').toLowerCase() === s.email.toLowerCase())?.docUrl);
  if (!d?.ok) { failed++; continue; }
  if (!s.already) {
    const { error: upErr } = await sb.storage.from('insurance-docs').upload(s.storagePath, d.buf, { contentType: d.buf.slice(0, 5).toString() === '%PDF-' ? 'application/pdf' : 'image/jpeg', upsert: true });
    if (upErr) { console.error(`  upload fail ${s.email}: ${upErr.message}`); failed++; continue; }
    uploaded++;
  } else skipped++;
  const { error: updErr } = await sb.from('InsurancePolicy').update({ document_bucket: 'insurance-docs', document_path: s.storagePath, document_name: s.storagePath.split('/').pop() }).eq('id', s.policyId);
  if (updErr) { console.error(`  link fail ${s.policyId}: ${updErr.message}`); failed++; continue; }
  linked++;
}
console.log(`\nAPPLIED: uploaded=${uploaded} alreadyThere=${skipped} linked=${linked} failed=${failed}`);
