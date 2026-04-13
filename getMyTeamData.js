import { supabase, getAuthUser } from './_lib/supabaseServer.js';
import { differenceInDays, isBefore, addDays } from 'date-fns';

function displayNameFor(user) {
  return user?.displayName || user?.display_name || user?.full_name || user?.email || 'Unknown User';
}

function getTaskStatus(task) {
  return task.status || task.taskStatus || 'Open';
}

function getAssignedEmails(task) {
  return [
    task.assignedTo,
    task.assignedToEmail,
    task.assignedtoemail,
    task.ownerEmail,
    task.owneremail,
  ].filter(Boolean);
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const user = await getAuthUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const [{ data: allUsers, error: usersError }, { data: allTasks, error: tasksError }, { data: wcRecords, error: wcError }, { data: certRecords, error: certError }] = await Promise.all([
      supabase.from('User').select('*'),
      supabase.from('Task').select('*'),
      supabase.from('WorkersCompRecord').select('*'),
      supabase.from('SafetyCertification').select('*')
    ]);

    if (usersError) throw usersError;
    if (tasksError) throw tasksError;
    if (wcError) throw wcError;
    if (certError) throw certError;

    const pmName = user.user_metadata?.full_name || user.full_name || user.email;
    const pmEmail = user.email?.toLowerCase();

    const myTechnicians = (allUsers || []).filter((tech) => {
      const techPm = (tech.m2PM || tech.m2pm || '').toString().toLowerCase();
      const techEmail = tech.email?.toLowerCase() || '';
      const isContractor = techEmail.includes('.contractor@') || tech.role === 'technician';
      return tech.active !== false && isContractor && (techPm === pmName.toLowerCase() || techPm === pmEmail);
    });

    const myTasks = (allTasks || []).filter((task) => getAssignedEmails(task).map(v => v.toLowerCase()).includes(pmEmail));

    const totalTechnicians = myTechnicians.length;
    const totalVelocitiScore = myTechnicians.reduce((sum, tech) => sum + Number(tech.velocitiScore || tech.velocitiscore || 0), 0);
    const avgPerfScore = totalTechnicians > 0 ? Math.round(totalVelocitiScore / totalTechnicians) : 0;

    const today = new Date();
    const expiringContracts = myTechnicians
      .filter((tech) => tech.endDate && isBefore(new Date(tech.endDate), addDays(today, 30)) && isBefore(today, new Date(tech.endDate)))
      .map((tech) => ({
        id: tech.id,
        name: displayNameFor(tech),
        endDate: tech.endDate,
        daysLeft: differenceInDays(new Date(tech.endDate), today)
      }));

    const complianceIssues = myTechnicians
      .filter((tech) => {
        const wc = (wcRecords || []).find((r) => r.userEmail === tech.email);
        const cert = (certRecords || []).find((c) => c.userEmail === tech.email);
        if (!wc || !cert) return true;
        if (wc.expirationDate && isBefore(new Date(wc.expirationDate), today)) return true;
        if (cert.expirationDate && isBefore(new Date(cert.expirationDate), today)) return true;
        return false;
      })
      .map((tech) => ({
        id: tech.id,
        name: displayNameFor(tech),
        reason: 'Missing or expired compliance document'
      }));

    return res.status(200).json({
      myTechnicians,
      myTasks,
      stats: {
        totalTechnicians,
        avgPerfScore,
        pendingTasks: myTasks.filter((t) => getTaskStatus(t) !== 'Done').length,
        complianceIssuesCount: complianceIssues.length,
      },
      alerts: {
        expiringContracts,
        complianceIssues
      }
    });
  } catch (error) {
    console.error('Error fetching My Team data:', error);
    return res.status(500).json({ error: 'Internal Server Error', details: "See server logs for details" });
  }
}
