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
            packetName,
            documentIds = [],
            recipientIds = [],       // array of technician IDs
            recipientEmails = [],     // array of emails for non-users
            documentType,            // 'onboarding' | 'safety' | 'agreement' | 'tax' | 'background' | 'ach' | 'other'
            message,
            dueDate
        } = payload;

        if (!packetName || (!documentIds.length && !recipientIds.length)) {
            return Response.json({ 
                success: false, 
                error: 'Packet name and at least one document + recipient are required' 
            }, { status: 200 });
        }

        const results = {
            sent: [],
            failed: []
        };

        // Get the document templates
        const templates = [];
        for (const docId of documentIds) {
            try {
                const doc = await base44.asServiceRole.entities.SignableDocument.get(docId);
                if (doc) templates.push(doc);
            } catch (e) { /* skip missing */ }
        }

        // Build list of recipients with their info
        const recipients = [];
        
        // Add by user IDs
        for (const rid of recipientIds) {
            try {
                const tech = await base44.asServiceRole.entities.User.get(rid);
                if (tech) {
                    recipients.push({
                        id: tech.id,
                        email: tech.email,
                        name: tech.displayName || tech.full_name || tech.email,
                        type: 'user'
                    });
                }
            } catch (e) { /* skip */ }
        }
        
        // Add by emails
        for (const email of recipientEmails) {
            const cleanEmail = email.trim().toLowerCase();
            if (cleanEmail) {
                recipients.push({
                    id: null,
                    email: cleanEmail,
                    name: cleanEmail.split('@')[0],
                    type: 'email'
                });
            }
        }

        // Send each document to each recipient
        for (const recipient of recipients) {
            for (const template of templates) {
                try {
                    // Determine folder based on document type
                    let folder = 'Other Documents';
                    if (documentType === 'onboarding') folder = 'Onboarding Documents';
                    else if (documentType === 'safety') folder = 'Safety Documents';
                    else if (documentType === 'agreement') folder = 'Agreements';
                    else if (documentType === 'tax') folder = 'Tax Documents';
                    else if (documentType === 'background') folder = 'Background Check Documents';
                    else if (documentType === 'ach') folder = 'ACH / Payment Documents';

                    const signatureRequest = await base44.asServiceRole.entities.SignatureRequest.create({
                        technicianId: recipient.id,
                        technicianEmail: recipient.email,
                        technicianName: recipient.name,
                        signableDocumentId: template.id,
                        documentTitle: template.title || template.name,
                        documentType: documentType || template.documentType || 'other',
                        folder: folder,
                        status: 'Sent',
                        sentDate: new Date().toISOString(),
                        dueDate: dueDate || null,
                        packetName: packetName,
                        message: message || `Please complete the attached ${template.title || 'document'}.`
                    });

                    results.sent.push({
                        recipient: recipient.email,
                        document: template.title,
                        requestId: signatureRequest.id
                    });
                } catch (err) {
                    results.failed.push({
                        recipient: recipient.email,
                        document: template.title,
                        error: err.message
                    });
                }
            }
        }

        // Log activity
        try {
            await base44.asServiceRole.entities.AppActivityLog.create({
                userId: user.id,
                userEmail: user.email,
                action: 'PAPERWORK_PACKET_SENT',
                details: {
                    packetName,
                    documentsSent: results.sent.length,
                    recipients: recipients.length,
                    documentType
                }
            });
        } catch (e) { /* non-critical */ }

        return Response.json({
            success: true,
            results
        });

    } catch (error) {
        console.error('sendPaperworkPacket error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});