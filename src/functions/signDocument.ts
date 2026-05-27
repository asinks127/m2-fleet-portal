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

        const payload = await req.json().catch(() => ({}));
        const {
            signatureRequestId,
            signatureData,          // base64 PNG of drawn signature
            typedName,
            initials,
            signedFields = [],      // array of { fieldId, value, type }
            signerIpAddress
        } = payload;

        if (!signatureRequestId) {
            return Response.json({ success: false, error: 'Signature request ID is required' }, { status: 200 });
        }

        // Get the signature request
        const sigRequest = await base44.asServiceRole.entities.SignatureRequest.get(signatureRequestId);
        if (!sigRequest) {
            return Response.json({ success: false, error: 'Signature request not found' }, { status: 200 });
        }

        // Verify the current user is the signer (or is admin)
        const adminEmails = [
            'lena@m2fleetcom.com', 'orville@m2fleetcom.com', 'steve@m2fleetcom.com',
            'austin@m2fleetcom.com', 'adam@m2fleetcom.com', 'jason@m2fleetcom.com',
            'erica@m2fleetcom.com', 'lowell@m2fleetcom.com', 'secretary@m2fleetcom.com'
        ];
        const isAdmin = user.role === 'admin' || adminEmails.includes(user.email.toLowerCase());
        
        const isSigner = sigRequest.technicianEmail?.toLowerCase() === user.email.toLowerCase() ||
                         sigRequest.technicianId === user.id;
        
        if (!isSigner && !isAdmin) {
            return Response.json({ success: false, error: 'You are not authorized to sign this document' }, { status: 200 });
        }

        // Check if already signed
        if (sigRequest.status === 'Signed' && !isAdmin) {
            return Response.json({ success: false, error: 'This document has already been signed' }, { status: 200 });
        }

        const now = new Date().toISOString();
        
        // Determine if needs admin review
        const needsReview = (sigRequest.documentType === 'onboarding' || sigRequest.documentType === 'background') 
            ? true 
            : false;

        // Update the signature request
        await base44.asServiceRole.entities.SignatureRequest.update(signatureRequestId, {
            status: needsReview ? 'Needs Review' : 'Signed',
            signedAt: now,
            signedBy: user.email,
            signedByName: user.displayName || user.full_name || user.email,
            signatureData: signatureData || null,
            typedName: typedName || null,
            initials: initials || null,
            signedFields: signedFields || [],
            signerIpAddress: signerIpAddress || null
        });

        // If not needing review, auto-file the document
        if (!needsReview) {
            const doc = await base44.asServiceRole.entities.SignableDocument.get(sigRequest.signableDocumentId);
            
            // Determine folder
            let folder = sigRequest.folder || 'Other Documents';
            
            // Build file name: ContractorName_DocumentType_DateSigned.pdf
            const contractorName = (sigRequest.technicianName || 'Unknown').replace(/\s+/g, '').replace(/[^a-zA-Z0-9]/g, '');
            const docType = (sigRequest.documentType || 'Document').replace(/\s+/g, '');
            const dateStr = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
            
            const fileName = `${contractorName}_${docType}_${dateStr}.pdf`;
            
            // Store metadata in ContractorDocument
            await base44.asServiceRole.entities.ContractorDocument.create({
                contractorId: sigRequest.technicianId,
                contractorEmail: sigRequest.technicianEmail,
                contractorName: sigRequest.technicianName,
                documentTitle: sigRequest.documentTitle || sigRequest.documentType,
                documentType: sigRequest.documentType,
                folder: folder,
                fileName: fileName,
                fileUrl: sigRequest.originalFileUrl || '',
                signedPdfUrl: sigRequest.signedPdfUrl || '',
                status: 'Filed',
                signedAt: now,
                signedBy: user.email,
                signatureRequestId: signatureRequestId,
                sourceDocId: sigRequest.signableDocumentId,
                tags: ['signed', folder.toLowerCase().replace(/\s+/g, '_'), sigRequest.packetName].filter(Boolean)
            });
        }

        // Notify admin if needs review
        if (needsReview) {
            // Log for admin notification
            try {
                await base44.asServiceRole.entities.AppActivityLog.create({
                    userId: user.id,
                    userEmail: user.email,
                    action: 'DOCUMENT_NEEDS_REVIEW',
                    details: {
                        signatureRequestId,
                        documentTitle: sigRequest.documentTitle,
                        contractorEmail: sigRequest.technicianEmail,
                        contractorName: sigRequest.technicianName
                    }
                });
            } catch (e) { /* non-critical */ }
        }

        return Response.json({
            success: true,
            status: needsReview ? 'Needs Review' : 'Signed',
            needsReview,
            message: needsReview 
                ? 'Document signed and submitted for admin review' 
                : 'Document signed and filed successfully'
        });

    } catch (error) {
        console.error('signDocument error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});