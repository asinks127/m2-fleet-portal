// POST /api/mergeTechnicians — dedupe technician records (admin only).
// Body: { action: 'health_summary'|'find_duplicates'|'preview_merge'|'merge', primary_id, duplicate_ids, dry_run }
import { getAuthUser, supabase } from '../_lib/supabaseServer.js';
import { entities, normalizeName } from './_warranty/warrantyService.js';
import { recalcTechnicianStats } from './_warranty/warrantyService.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const normalizePhone = (phone) => (phone || '').replace(/\D/g, '');

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  const authUser = await getAuthUser(req);
  if (!authUser) return res.status(403).json({ error: 'Forbidden' });
  // getAuthUser returns the raw auth user; resolve role from the User table.
  const { data: userRow } = await supabase
    .from('User')
    .select('role')
    .eq('email', (authUser.email || '').toLowerCase())
    .maybeSingle();
  const user = { ...authUser, role: userRow?.role || authUser.role };
  if (user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });

  try {
    const body = typeof req.body === 'object' ? req.body : {};
    const { action, primary_id, duplicate_ids, dry_run } = body;

    if (action === 'health_summary') {
      const [technicians, allIssues] = await Promise.all([
        entities.Technician.list(),
        entities.QCIssue.list(),
      ]);
      const total = technicians.length;
      const primary = technicians.filter((t) => t.is_primary !== false && t.technician_profile_status !== 'merged' && !String(t.full_name || '').includes('[MERGED]'));
      const merged = technicians.filter((t) => t.technician_profile_status === 'merged' || String(t.full_name || '').includes('[MERGED]'));
      const needsReview = technicians.filter((t) => t.technician_profile_status === 'needs_review');
      const dupCandidates = technicians.filter((t) => t.technician_profile_status === 'duplicate_candidate');
      const primaryIds = new Set(primary.map((t) => t.id));
      const nonPrimaryLinkedIssues = allIssues.filter((i) => i.technician_id && !primaryIds.has(i.technician_id));
      return res.status(200).json({
        total,
        primary: primary.length,
        merged: merged.length,
        needs_review: needsReview.length,
        duplicate_candidates: dupCandidates.length,
        issues_linked_to_non_primary: nonPrimaryLinkedIssues.length,
      });
    }

    if (action === 'find_duplicates') {
      const technicians = await entities.Technician.list();
      const activeTechs = technicians.filter((t) => t.technician_profile_status !== 'merged' && !String(t.full_name || '').includes('[MERGED]'));

      const groups = {};
      for (const tech of activeTechs) {
        const key = 'name:' + normalizeName(tech.full_name);
        if (!key || key === 'name:') continue;
        if (!groups[key]) groups[key] = { type: 'name', match_value: normalizeName(tech.full_name), techs: [] };
        groups[key].techs.push(tech);
      }
      for (const tech of activeTechs) {
        const phone = normalizePhone(tech.phone);
        if (!phone || phone.length < 7) continue;
        const key = 'phone:' + phone;
        if (!groups[key]) groups[key] = { type: 'phone', match_value: tech.phone, techs: [] };
        if (!groups[key].techs.find((t) => t.id === tech.id)) groups[key].techs.push(tech);
      }
      for (const tech of activeTechs) {
        const email = (tech.email || '').toLowerCase().trim();
        if (!email) continue;
        const key = 'email:' + email;
        if (!groups[key]) groups[key] = { type: 'email', match_value: email, techs: [] };
        if (!groups[key].techs.find((t) => t.id === tech.id)) groups[key].techs.push(tech);
      }

      const duplicates = Object.entries(groups)
        .filter(([, g]) => g.techs.length > 1)
        .map(([key, g]) => ({
          group_key: key,
          match_type: g.type,
          match_value: g.match_value,
          normalized_name: g.match_value,
          techs: g.techs.map((t) => ({
            id: t.id,
            full_name: t.full_name,
            status: t.status,
            is_primary: t.is_primary,
            technician_profile_status: t.technician_profile_status,
            qc_issue_count_total: t.qc_issue_count_total || 0,
            phone: t.phone,
            email: t.email,
          })),
          count: g.techs.length,
        }));
      return res.status(200).json({ duplicates, total_groups: duplicates.length });
    }

    if (action === 'preview_merge') {
      if (!primary_id || !duplicate_ids?.length) return res.status(400).json({ error: 'primary_id and duplicate_ids required' });
      const issueCount = [];
      for (const dup_id of duplicate_ids) {
        const issues = await entities.QCIssue.filter({ technician_id: dup_id });
        const dupTech = (await entities.Technician.filter({ id: dup_id }))[0];
        issueCount.push({ technician_id: dup_id, technician_name: dupTech?.full_name, issue_count: issues.length });
      }
      return res.status(200).json({ primary_id, duplicate_ids, issues_to_relink: issueCount });
    }

    if (action === 'merge') {
      if (!primary_id || !duplicate_ids?.length) return res.status(400).json({ error: 'primary_id and duplicate_ids required' });
      const primaryResults = await entities.Technician.filter({ id: primary_id });
      if (!primaryResults[0]) return res.status(404).json({ error: 'Primary technician not found' });
      const primaryTech = primaryResults[0];

      let totalRelinked = 0;
      for (const dup_id of duplicate_ids) {
        const issues = await entities.QCIssue.filter({ technician_id: dup_id });
        if (!dry_run) {
          for (const issue of issues) {
            await entities.QCIssue.update(issue.id, {
              technician_id: primaryTech.id,
              technician_name: primaryTech.full_name,
              technician_normalized_name: normalizeName(primaryTech.full_name),
              technician_profile_status: 'linked',
              warranty_title: issue.asset_number
                ? `${issue.asset_number} - ${primaryTech.full_name} - Warranty Return`
                : issue.warranty_title,
              warranty_audit_log: (issue.warranty_audit_log || '') +
                `\n[MERGE] Relinked from tech ${dup_id} to ${primaryTech.id} (${primaryTech.full_name}) by ${user.email} on ${new Date().toISOString()}`,
            });
            await sleep(100);
          }
          await sleep(100);
          const dupResults = await entities.Technician.filter({ id: dup_id });
          if (dupResults[0]) {
            await entities.Technician.update(dup_id, {
              status: 'inactive',
              is_primary: false,
              is_active: false,
              technician_profile_status: 'merged',
              merged_into_technician_id: primaryTech.id,
              full_name: dupResults[0].full_name.includes('[MERGED]') ? dupResults[0].full_name : dupResults[0].full_name + ' [MERGED]',
              normalized_name: normalizeName(dupResults[0].full_name) + '_merged',
            });
          }
        }
        totalRelinked += issues.length;
      }

      if (!dry_run) {
        await entities.Technician.update(primaryTech.id, {
          normalized_name: normalizeName(primaryTech.full_name),
          is_primary: true,
          is_active: true,
          technician_profile_status: 'linked',
        });
        await recalcTechnicianStats(primaryTech.id);
      }

      return res.status(200).json({
        dry_run: dry_run === true,
        primary_id,
        primary_name: primaryTech.full_name,
        duplicate_ids,
        total_issues_relinked: totalRelinked,
        message: dry_run ? 'Preview only — no changes made' : 'Merge complete',
      });
    }

    return res.status(400).json({ error: 'Unknown action' });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
