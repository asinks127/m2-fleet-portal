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
            signatureRequestId,
            action,          // 'approve' | 'reject' | 'request_correction'
            notes,
            adminId
        } = payload;

        if (!signatureRequestId || !action) {
            return Response.json({ success: false, error: 'Signature request ID and action are required' }, { status: 200 });
        }

        if (!['approve', 'reject', 'request_correction'].includes(action)) {
            return Response.json({ success: false, error: 'Invalid action' }, { status: 200 });
        }

        const sigRequest = await base44.asServiceRole.entities.SignatureRequest.get(signatureRequestId);
        if (!sigRequest) {
            return Response.json({ success: false, error: 'Signature request not found' }, { status: 200 });
        }

        const now = new Date().toISOString();
        let newStatus;
        let message;

        if (action === 'approve') {
            newStatus = 'Signed';
            
            // File the document
            const contractorName = (sigRequest.technicianName || 'Unknown').replace(/\s+/g, '').replace(/[^a-zA-Z0-9]/g, '');
            const docType = (sigRequest.documentType || 'Document').replace(/\s+/g, '');
            const dateStr = new Date().toISOString().split('T')[0];
            const fileName = `${contractorName}_${docType}_${dateStr}.pdf`;
            
            await base44.asServiceRole.entities.ContractorDocument.create({
                contractorId: sigRequest.technicianId,
                contractorEmail: sigRequest.technicianEmail,
                contractorName: sigRequest.technicianName,
                documentTitle: sigRequest.documentTitle || sigRequest.documentType,
                documentType: sigRequest.documentType,
                folder: sigRequest.folder || 'Other Documents',
                fileName: fileName,
                fileUrl: sigRequest.originalFileUrl || '',
                signedPdfUrl: sigRequest.signedPdfUrl || '',
                status: 'Filed',
                signedAt: sigRequest.signedAt || now,
                signedBy: sigRequest.signedBy,
                signatureRequestId: signatureRequestId,
                sourceDocId: sigRequest.signableDocumentId,
                approvedBy: user.email,
                approvedAt: now,
                tags: ['signed', 'approved', sigRequest.packetName].filter(Boolean)
            });
            
            await base44.asServiceRole.entities.SignatureRequest.update(signatureRequestId, {
                status: 'Signed',
                approvedBy: user.email,
                approvedAt: now
            });
            
            message = 'Document approved and filed successfully';
            
        } else if (action === 'reject') {
            newStatus = 'Rejected';
            
            await base44.asServiceRole.entities.SignatureRequest.update(signatureRequestId, {
                status: 'Rejected',
                rejectedBy: user.email,
                rejectedAt: now,
                rejectionNotes: notes || 'Document was rejected'
            });
            
            message = 'Document rejected';
            
        } else if (action === 'request_correction') {
            newStatus = 'Correction Requested';
            
            await base44.asServiceRole.entities.SignatureRequest.update(signatureRequestId, {
                status: 'Correction Requested',
                correctionNotes: notes || 'Please make the requested corrections and resubmit.',
                correctionRequestedAt: now,
                correctionRequestedBy: user.email
            });
            
            message = 'Correction requested - contractor has been notified';
        }

        // Log activity
        try {
            await base44.asServiceRole.entities.AppActivityLog.create({
                userId: user.id,
                userEmail: user.email,
                action: `PAPERWORK_${action.toUpperCase()}`,
                details: {
                    signatureRequestId,
                    documentTitle: sigRequest.documentTitle,
                    contractorEmail: sigRequest.technicianEmail,
                    contractorName: sigRequest.technicianName,
                    notes
                }
            });
        } catch (e) { /* non-critical */ }

        return Response.json({
            success: true,
            newStatus,
            message
        });

    } catch (error) {
        console.error('reviewDocument error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});