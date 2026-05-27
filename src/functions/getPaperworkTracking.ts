import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    const base44 = createClientFromRequest(req);
    
    if (req.method === 'OPTIONS') {
        return new Response(null, { status: 204 });
    }

    try {
        const user = await base44.auth.me();
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const adminEmails = [
            'lena@m2fleetcom.com', 'orville@m2fleetcom.com', 'steve@m2fleetcom.com',
            'austin@m2fleetcom.com', 'adam@m2fleetcom.com', 'jason@m2fleetcom.com',
            'erica@m2fleetcom.com', 'lowell@m2fleetcom.com', 'secretary@m2fleetcom.com'
        ];
        const isAdmin = user.role === 'admin' || adminEmails.includes(user.email.toLowerCase());
        
        if (!isAdmin) {
            return Response.json({ error: 'Forbidden - Admin access required' }, { status: 403 });
        }

        const payload = await req.json().catch(() => ({}));
        const { 
            filters = {}, 
            sort = '-created_date', 
            limit = 100 
        } = payload;

        // Build query for SignatureRequests
        let requestQuery = base44.asServiceRole.entities.SignatureRequest.list(sort, limit);
        
        const allRequests = await requestQuery;
        
        // Build contractor data with documents
        const contractorMap = new Map();
        
        for (const req of allRequests) {
            if (!req) continue;
            
            const techId = req.technicianId;
            const techEmail = (req.technicianEmail || '').toLowerCase().trim();
            
            // Find technician info
            let techName = req.technicianName || 'Unknown';
            let techProject = '';
            let techM2PM = '';
            let techActive = true;
            
            if (techId) {
                try {
                    const tech = await base44.asServiceRole.entities.User.get(techId);
                    if (tech) {
                        techName = tech.displayName || tech.full_name || tech.email;
                        techProject = tech.project || '';
                        techM2PM = tech.m2PM || '';
                        techActive = tech.active !== false;
                    }
                } catch (e) { /* ignore */ }
            }
            
            const key = techId || techEmail;
            if (!key) continue;
            
            if (!contractorMap.has(key)) {
                contractorMap.set(key, {
                    contractorId: techId,
                    contractorEmail: techEmail,
                    contractorName: techName,
                    project: techProject,
                    m2PM: techM2PM,
                    active: techActive,
                    documents: [],
                    pendingCount: 0,
                    completedCount: 0,
                    missingCount: 0,
                    needsReviewCount: 0,
                    lastSentDate: null,
                    lastSignedDate: null,
                    completionPercentage: 0,
                    status: 'No Paperwork Sent'
                });
            }
            
            const contractor = contractorMap.get(key);
            contractor.documents.push(req);
            
            if (req.status === 'Sent' || req.status === 'Viewed') {
                contractor.pendingCount++;
            } else if (req.status === 'Signed') {
                contractor.completedCount++;
                if (req.signedAt) {
                    const signedDate = new Date(req.signedAt);
                    if (!contractor.lastSignedDate || signedDate > new Date(contractor.lastSignedDate)) {
                        contractor.lastSignedDate = req.signedAt;
                    }
                }
            } else if (req.status === 'Needs Review') {
                contractor.needsReviewCount++;
            }
            
            const sentDate = req.created_date ? new Date(req.created_date) : null;
            if (sentDate && (!contractor.lastSentDate || sentDate > new Date(contractor.lastSentDate))) {
                contractor.lastSentDate = req.created_date;
            }
        }
        
        // Calculate completion percentages and missing
        const contractors = Array.from(contractorMap.values()).map(c => {
            const total = c.documents.length;
            if (total > 0) {
                c.completionPercentage = Math.round((c.completedCount / total) * 100);
            }
            
            // Determine status
            if (c.pendingCount > 0) {
                c.status = 'Pending';
            } else if (c.needsReviewCount > 0) {
                c.status = 'Needs Review';
            } else if (c.completedCount > 0 && c.completedCount === total) {
                c.status = 'Complete';
            } else if (c.completedCount > 0) {
                c.status = 'Partial';
            }
            
            return c;
        });
        
        // Apply filters
        let filtered = contractors;
        
        if (filters.search) {
            const search = filters.search.toLowerCase();
            filtered = filtered.filter(c => 
                c.contractorName.toLowerCase().includes(search) ||
                c.contractorEmail.toLowerCase().includes(search) ||
                c.project.toLowerCase().includes(search)
            );
        }
        
        if (filters.status === 'active') {
            filtered = filtered.filter(c => c.active === true);
        } else if (filters.status === 'inactive') {
            filtered = filtered.filter(c => c.active === false);
        }
        
        if (filters.missingDocs === true) {
            filtered = filtered.filter(c => c.pendingCount > 0);
        }
        
        if (filters.needsReview === true) {
            filtered = filtered.filter(c => c.needsReviewCount > 0);
        }
        
        if (filters.onboardingIncomplete === true) {
            filtered = filtered.filter(c => c.completionPercentage < 100);
        }
        
        // Sort
        if (sort.startsWith('-')) {
            const field = sort.slice(1);
            filtered.sort((a, b) => {
                if (field === 'contractorName') return b.contractorName.localeCompare(a.contractorName);
                if (field === 'completionPercentage') return b.completionPercentage - a.completionPercentage;
                if (field === 'lastSignedDate') return new Date(b.lastSignedDate || 0) - new Date(a.lastSignedDate || 0);
                return 0;
            });
        }
        
        return Response.json({
            contractors: filtered,
            total: filtered.length,
            filters
        });

    } catch (error) {
        console.error('getPaperworkTracking error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});