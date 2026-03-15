import { supabase } from '../src/lib/supabaseClient';

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(200).end();    const { signatureToken, signatureRequestId } = req.body;

    console.log(`[getSignatureRequestData] Request: token=${signatureToken}, id=${signatureRequestId}`);

    if (!signatureToken && !signatureRequestId) {
        return new Response(JSON.stringify({ success: false, error: 'Signature token or request ID is required.' }), {
            status: 200, // Return 200 so frontend can parse error
            headers: { 'Content-Type': 'application/json' }
        });
    }

    try {
        const base44Admin = base44.asServiceRole;
        let signatureRequest = null;

        if (signatureToken) {
            // Case 1: Accessed via public token (e.g., from email link)
            const requests = await base44Admin.entities.SignatureRequest.filter({ signatureToken });
            if (requests && requests.length > 0) {
                signatureRequest = requests[0];
            }
        } else if (signatureRequestId) {
            // Case 2: Accessed via internal app link (requires authentication and authorization)
            const currentUser = await base44.auth.me();

            if (!currentUser) {
                return new Response(JSON.stringify({ success: false, error: 'Authentication required to view this document.' }), {
                    status: 200, // Return 200 so frontend can parse error
                    headers: { 'Content-Type': 'application/json' }
                });
            }
            
            console.log(`[getSignatureRequestData] Fetching request ${signatureRequestId} for user ${currentUser.id}`);
            let requestById;
            try {
                requestById = await base44Admin.entities.SignatureRequest.get(signatureRequestId);
            } catch (err) {
                console.error(`[getSignatureRequestData] Failed to get signature request: ${err.message}`);
                // Proceed as not found
            }

            if (requestById) {
                 // Check authorization: User must be the assigned technician OR an admin OR matching email
                 const userEmail = currentUser.email?.toLowerCase();
                 const techEmail = requestById.technicianEmail?.toLowerCase();
                 
                 console.log(`[getSignatureRequestData] Auth check: TechID=${requestById.technicianId}, UserID=${currentUser.id}, TechEmail=${techEmail}, UserEmail=${userEmail}`);
                 
                 if (requestById.technicianId === currentUser.id || 
                     (techEmail && userEmail && techEmail === userEmail) || 
                     currentUser.role === 'admin') {
                     signatureRequest = requestById;
                 } else {
                    return new Response(JSON.stringify({ success: false, error: 'Not authorized to view this document.' }), {
                        status: 200, // Return 200 so frontend can parse error
                        headers: { 'Content-Type': 'application/json' }
                    });
                 }
            } else {
                console.log(`[getSignatureRequestData] Signature Request ${signatureRequestId} not found`);
            }
        }

        if (!signatureRequest) {
            return new Response(JSON.stringify({ success: false, error: 'This signing request is invalid or has expired.' }), {
                status: 200, // Return 200 so frontend can parse error
                headers: { 'Content-Type': 'application/json' }
            });
        }
        
        // Check if already signed/declined
        if (signatureRequest.status === 'Signed' || signatureRequest.status === 'Declined') {
             return new Response(JSON.stringify({ success: false, error: `This document was already ${signatureRequest.status.toLowerCase()} on ${new Date(signatureRequest.signedAt || signatureRequest.updated_date).toLocaleDateString()}.` }), {
                status: 200, // Return 200 so frontend can parse error
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Fetch the associated document content
        let document;
        try {
            document = await base44Admin.entities.SignableDocument.get(signatureRequest.documentId);
        } catch (err) {
            console.error(`[getSignatureRequestData] Failed to get document ${signatureRequest.documentId}: ${err.message}`);
        }

        if (!document) {
            return new Response(JSON.stringify({ success: false, error: 'The requested document could not be found.' }), {
                status: 200, // Return 200 so frontend can parse error
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Mark the document as 'Viewed' if it's the first time
        if (signatureRequest.status === 'Sent') {
            await base44Admin.entities.SignatureRequest.update(signatureRequest.id, {
                status: 'Viewed',
                viewedAt: new Date().toISOString()
            });
            // Important: update the local signatureRequest object to reflect the change
            signatureRequest.status = 'Viewed';
            signatureRequest.viewedAt = new Date().toISOString();
        }

        return new Response(JSON.stringify({
            success: true,
            signatureRequest,
            document
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('Error in getSignatureRequestData function:', error);
        return new Response(JSON.stringify({
            success: false,
            error: error.message || 'An internal server error occurred.'
        }), {
            status: 200, // Return 200 so frontend can parse error
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
