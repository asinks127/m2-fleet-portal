import { supabase, getAuthUser } from './_lib/supabaseServer.js';

// QC Board Data API - v3
const qcEmails = [
    'rmiller.contractor@m2fleetcom.com',
    'choffman.contractor@m2fleetcom.com'
];

const adminEmails = [
    'lena@m2fleetcom.com', 'orville@m2fleetcom.com', 'steve@m2fleetcom.com',
    'austin@m2fleetcom.com', 'adam@m2fleetcom.com', 'jason@m2fleetcom.com', 'erica@m2fleetcom.com'
];

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    const user = await getAuthUser(req);
    if (!user) {
        return res.status(401).json({ error: 'Unauthorized: Not logged in' });
    }

    const userEmail = user.email.toLowerCase();
    const isQC = qcEmails.includes(userEmail);
    const isAdmin = adminEmails.includes(userEmail) || user.role === 'admin';

    // Only QC and Admins can access this board's data
    if (!isQC && !isAdmin) {
        return res.status(403).json({ error: 'Forbidden: Insufficient permissions' });
    }

    try {
        // Use service role to get all users, regardless of who is asking (as long as they are authorized)
        const [allUsers, externalManagers] = await Promise.all([
            supabase.from('User').select('*'),
            supabase.from('ExternalManager').select('*').match({ active: true }).then(r => r.data || [])
        ]);
        
        // Fetch recent call logs
        const recentCalls = await supabase.from('CallLog').select('*').match({}, '-callDate', 2000).then(r => r.data || []);
        
        // Fetch recent manager call logs
        const recentManagerCalls = await supabase.from('ManagerCallLog').select('*').match({}, '-callDate', 2000).then(r => r.data || []);

        // Fetch recent manager inspections for score calc
        const recentManagerInspections = await supabase.from('ManagerQCInspection').select('*').match({}, '-inspectionDate', 2000).then(r => r.data || []);

        console.log(`Fetched ${recentCalls.length} call logs and ${recentManagerCalls.length} manager logs`);

        const latestCallByTech = {};
        const latestCallByManager = {};
        const managerScores = {};

        // Helper to index logs
        const indexLogs = (logs, targetDict, idField, emailField, dateField) => {
            for (const log of logs) {
                if (log[idField] && !targetDict[log[idField]]) {
                    targetDict[log[idField]] = log;
                }
                if (log[emailField]) {
                    const emailKey = log[emailField].trim().toLowerCase();
                    if (!targetDict[emailKey]) {
                        targetDict[emailKey] = log;
                    }
                }
            }
        };

        indexLogs(recentCalls, latestCallByTech, 'technicianId', 'technicianEmail', 'callDate');
        indexLogs(recentManagerCalls, latestCallByManager, 'managerId', 'managerEmail', 'callDate');

        // Calculate Manager Average Scores
        // Group by managerId
        const managerInspectionsMap = {};
        for(const insp of recentManagerInspections) {
            if(!managerInspectionsMap[insp.managerId]) managerInspectionsMap[insp.managerId] = [];
            managerInspectionsMap[insp.managerId].push(insp.score);
        }
        
        Object.keys(managerInspectionsMap).forEach(mgrId => {
            const scores = managerInspectionsMap[mgrId];
            const avg = scores.reduce((a,b) => a+b, 0) / scores.length;
            managerScores[mgrId] = Math.round(avg);
        });

        // Merge data into users
        let combinedList = allUsers.map(u => ({ ...u, type: 'user' }));

        // Map external managers to look like users for the UI
        const mappedExternalManagers = externalManagers.map(em => ({
            id: em.id,
            displayName: em.name,
            full_name: em.name,
            email: em.email,
            phone: em.phone,
            role: em.role || 'External Manager',
            project: em.project,
            active: em.active,
            type: 'external_manager', // distinct type
            // Default user fields to prevent UI errors
            avgQcScore: 0, 
            velocitiScore: 0
        }));

        combinedList = [...combinedList, ...mappedExternalManagers];

        const usersWithData = combinedList.map(u => {
            const userId = u.id;
            const userEmail = u.email ? u.email.trim().toLowerCase() : null;

            // Technician Call Data
            let lastCall = latestCallByTech[userId];
            if (!lastCall && userEmail) lastCall = latestCallByTech[userEmail];

            // Manager Call Data
            let lastManagerCall = latestCallByManager[userId];
            if (!lastManagerCall && userEmail) lastManagerCall = latestCallByManager[userEmail];
            
            return {
                ...u,
                lastContacted: lastCall?.callDate || null,
                lastContactedBy: lastCall?.loggedBy || null,
                // Manager specific fields
                managerLastContacted: lastManagerCall?.callDate || null,
                managerLastContactedBy: lastManagerCall?.loggedBy || null,
                managerAvgQcScore: managerScores[userId] || 0
            };
        });

        return res.status(200).json({
            users: usersWithData,
            currentUser: user
        });
    } catch (error) {
        console.error('Error fetching QC Board data:', error);
        return res.status(500).json({ error: 'Internal Server Error', details: "See server logs for details" });
    }
}
