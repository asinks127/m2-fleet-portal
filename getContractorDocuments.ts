import { supabase } from '../src/lib/supabaseClient';

export default export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(200).end();

    try {        
        // Handle OPTIONS for CORS
        if (req.method === 'OPTIONS') {
            return res.status(204).send(null);
        }

        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const payload = req.body.catch(() => ({}));
        console.log(`[getContractorDocuments] Payload: ${JSON.stringify(payload)}, AuthUser: ${user.email} (${user.id})`);

        const targetUserId = payload.targetUserId || user.id;
        let targetUserEmail = payload.targetUserEmail;

        // Security check
        const adminEmails = [
            'lena@m2fleetcom.com', 'orville@m2fleetcom.com', 'steve@m2fleetcom.com',
            'austin@m2fleetcom.com', 'adam@m2fleetcom.com', 'jason@m2fleetcom.com', 'erica@m2fleetcom.com',
            'lowell@m2fleetcom.com', 'secretary@m2fleetcom.com'
        ];
        
        const isAdmin = user.role === 'admin' || adminEmails.includes(user.email.toLowerCase());
        const isOwnProfile = targetUserId === user.id;

        if (!isOwnProfile && !isAdmin) {
             return Response.json({ error: 'Forbidden' }, { status: 403 });
        }

        // If user is viewing their own profile, force the email to be their own to prevent spoofing
        // UNLESS the user is an admin debugging/viewing as themselves but providing a specific email (rare case)
        // But strictly speaking, if targetUserId == user.id, we assume they are the user.
        if (isOwnProfile) {
            targetUserEmail = user.email;
        }
        
        // If the caller is admin and provided an email but no ID (or ID matches themselves), 
        // we might want to allow searching by that email.
        // However, the dashboard calls this with targetUserId=user.id.
        // If I am admin and I want to debug tjserota, I should pass targetUserId='anything_else'.

        const targetEmailLower = targetUserEmail ? targetUserEmail.trim().toLowerCase() : '';
        
        console.log(`[getContractorDocuments] Searching: ID=${targetUserId}, Email=${targetUserEmail}`);

        // 1. Documents (Uploads)
        const docsPromise = base44.asServiceRole.entities.ContractorDocument.filter({ contractorId: targetUserId }, '-uploadDate');
        
        // 2. Signature Requests - Robust Fetch
        // We fetch a large batch of recent requests and filter in memory to ensure we catch email matches regardless of indexing/casing issues
        const allRequestsPromise = base44.asServiceRole.entities.SignatureRequest.list('-created_date', 500);

        const [documents, allRequests] = await Promise.all([
            docsPromise.catch(e => { console.error('Docs error:', e); return []; }),
            allRequestsPromise.catch(e => { console.error('AllReqs error:', e); return []; })
        ]);

        // Filter in memory
        const signatureRequests = allRequests.filter(req => {
            if (!req) return false;
            
            // Check ID match
            const idMatch = req.technicianId && req.technicianId === targetUserId;
            
            // Check Email match (case insensitive, trimmed)
            let emailMatch = false;
            if (req.technicianEmail && targetEmailLower) {
                const reqEmail = req.technicianEmail.trim().toLowerCase();
                emailMatch = reqEmail === targetEmailLower;
            }
            
            return idMatch || emailMatch;
        });

        console.log(`[getContractorDocuments] Found ${signatureRequests.length} matching requests from ${allRequests.length} recent entries`);

        // Sort by date desc
        signatureRequests.sort((a, b) => new Date(b.created_date) - new Date(a.created_date));

        return Response.json({
            documents: documents || [],
            signatureRequests: signatureRequests || []
        });

    } catch (error) {
        console.error('getContractorDocuments error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
}
