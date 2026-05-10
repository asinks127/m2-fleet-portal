import { supabase } from '../src/lib/supabaseClient';
import { differenceInDays, isBefore } from 'npm:date-fns@2.30.0';

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(200).end();
    try {
        const user = await base44.auth.me();
        if (!user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        
        // Use service role to fetch all necessary data
        const base44Admin = base44.asServiceRole;
        const [allUsers, allTasks, wcRecords, certRecords] = await Promise.all([
            base44Admin.entities.User.list(),
            base44Admin.entities.Task.list(),
            base44Admin.entities.WorkersCompRecord.list(),
            base44Admin.entities.SafetyCertification.list()
        ]);
        
        // Filter for active technicians assigned to the current PM
        const myTechnicians = allUsers.filter(tech => 
            tech.active !== false &&
            tech.m2PM === (user.displayName || user.full_name) &&
            (tech.email?.includes('.contractor@m2fleetcom.com') || tech.email?.includes('.contractor@smcinstallations.com'))
        );
        
        // Filter tasks assigned to the current PM
        const myTasks = allTasks.filter(task => task.assignedTo === user.email);

        // --- Calculate Stats for the PM's team ---
        const totalTechnicians = myTechnicians.length;
        const totalVelocitiScore = myTechnicians.reduce((sum, tech) => sum + (tech.velocitiScore || 0), 0);
        const avgPerfScore = totalTechnicians > 0 ? Math.round(totalVelocitiScore / totalTechnicians) : 0;

        // --- Generate Actionable Alerts ---
        const today = new Date();
        const expiringContracts = myTechnicians.filter(tech => 
            tech.endDate && 
            isBefore(new Date(tech.endDate), new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000)) &&
            isBefore(today, new Date(tech.endDate))
        ).map(tech => ({
            id: tech.id,
            name: tech.displayName || tech.full_name,
            endDate: tech.endDate,
            daysLeft: differenceInDays(new Date(tech.endDate), today)
        }));

        const complianceIssues = myTechnicians.filter(tech => {
            const wc = wcRecords.find(r => r.userEmail === tech.email);
            const cert = certRecords.find(c => c.userEmail === tech.email);
            if (!wc || !cert) return true;
            if (isBefore(new Date(wc.expirationDate), today) || isBefore(new Date(cert.expirationDate), today)) return true;
            return false;
        }).map(tech => ({
            id: tech.id,
            name: tech.displayName || tech.full_name,
            reason: 'Missing or Expired Document'
        }));

        const responsePayload = {
            myTechnicians,
            myTasks,
            stats: {
                totalTechnicians,
                avgPerfScore,
                pendingTasks: myTasks.filter(t => t.status !== 'Done').length,
                complianceIssuesCount: complianceIssues.length,
            },
            alerts: {
                expiringContracts,
                complianceIssues
            }
        };

        return new Response(JSON.stringify(responsePayload), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('Error fetching My Team data:', error);
        return res.status(500).json({ error: 'Internal Server Error', details: error.message });
    }
}
