import { Resend } from 'resend';
import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, collection, doc, setDoc, updateDoc, getDoc, getDocs, query, where, Timestamp, writeBatch } from 'firebase/firestore';
import { nanoid } from 'nanoid';

const resend = new Resend(process.env.RESEND_API_KEY);

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
};

let db: any = null;

function getFirebase() {
  if (!db && firebaseConfig.apiKey) {
    const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
    db = getFirestore(app);
  }
  return db;
}

function generateSigningToken() {
  return `${nanoid(12)}-${Date.now().toString(36)}`;
}

function generateSigningUrl(requestId: string, token: string) {
  const baseUrl = process.env.APP_URL || 'https://m23for3-15-portal-live-austin1.zocomputer.io';
  return `${baseUrl}/sign/${requestId}/${token}`;
}

export default async function handler(req: Request) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: { 'Access-Control-Allow-Origin': '*' } });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { 
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const body = await req.json();
    const { 
      templateId, 
      recipientIds,        // Array of contractor/user IDs
      recipients,          // Or direct recipient data
      emailSubject,
      emailBody,
      createdBy,
    } = body;

    const db = getFirebase();
    
    if (!db) {
      return new Response(JSON.stringify({ error: 'Firebase not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get template
    const templateRef = doc(db, 'documentTemplates', templateId);
    const templateSnap = await getDoc(templateRef);
    
    if (!templateSnap.exists()) {
      return new Response(JSON.stringify({ error: 'Template not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const template = templateSnap.data();

    // Create bulk send record
    const bulkSendId = `bulk_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const bulkSendRef = doc(collection(db, 'bulkSends'), bulkSendId);
    
    await setDoc(bulkSendRef, {
      id: bulkSendId,
      templateId,
      templateName: template.name,
      totalRecipients: recipientIds?.length || recipients?.length || 0,
      status: 'in_progress',
      createdAt: Timestamp.now(),
      createdBy,
      emailSubject,
      emailBody,
      results: [],
      stats: {
        sent: 0,
        completed: 0,
        failed: 0,
        pending: 0,
      },
    });

    // Resolve recipients if IDs provided
    let finalRecipients = recipients || [];
    
    if (recipientIds && recipientIds.length > 0) {
      // Fetch user data from Supabase (if configured) or use provided data
      // For now, we'll expect recipients to be passed directly
      finalRecipients = recipients || [];
    }

    const results = [];
    const batch = writeBatch(db);
    const expirationDate = new Date(Date.now() + (template.settings?.expirationDays || 30) * 24 * 60 * 60 * 1000);

    // Create document requests for each recipient
    for (const recipient of finalRecipients) {
      try {
        const requestId = `request_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const requestRef = doc(collection(db, 'documentRequests'), requestId);

        // Generate signing tokens for signers
        const signers = template.signers.map((templateSigner: any, index: number) => {
          const recipientSigner = recipient.signers?.[index] || {};
          const token = generateSigningToken();
          const email = recipientSigner.email || (index === 0 ? recipient.email : null);
          const name = recipientSigner.name || (index === 0 ? recipient.name : templateSigner.name);
          
          return {
            ...templateSigner,
            id: `signer_${Date.now()}_${index}`,
            order: index,
            name,
            email,
            status: 'pending',
            signingToken: token,
            signingUrl: generateSigningUrl(requestId, token),
            viewedAt: null,
            signedAt: null,
            reminderCount: 0,
          };
        });

        const requestData = {
          id: requestId,
          templateId,
          name: template.name,
          documentType: template.documentType,
          status: 'sent',
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
          createdBy,
          originalPdfUrl: template.originalPdfUrl,
          fields: JSON.parse(JSON.stringify(template.fields)),
          signers,
          currentSignerOrder: 0,
          expiresAt: Timestamp.fromDate(expirationDate),
          completedAt: null,
          signedPdfUrl: null,
          contractorId: recipient.id,
          contractorName: recipient.name,
          bulkSendId,
          metadata: {
            source: 'bulk_send',
            tags: [],
            notes: '',
          },
        };

        batch.set(requestRef, requestData);

        results.push({
          recipientId: recipient.id,
          recipientName: recipient.name,
          recipientEmail: recipient.email,
          requestId,
          status: 'created',
          signers: signers.map((s: any) => ({ email: s.email, url: s.signingUrl })),
        });

      } catch (err: any) {
        results.push({
          recipientId: recipient.id,
          recipientName: recipient.name,
          status: 'failed',
          error: err.message,
        });
      }
    }

    // Commit all document requests
    await batch.commit();

    // Update template usage count
    await updateDoc(templateRef, {
      usageCount: (template.usageCount || 0) + finalRecipients.length,
    });

    // Send emails asynchronously (don't block response)
    const emailPromises = [];
    
    for (const result of results) {
      if (result.status === 'created' && result.signers?.[0]?.email) {
        const firstSigner = result.signers[0];
        
        emailPromises.push(
          resend.emails.send({
            from: 'M2 Fleet Portal <noreply@m2fleetcom.com>',
            to: firstSigner.email,
            subject: emailSubject || `Document Ready for Signature: ${template.name}`,
            html: `
              <!DOCTYPE html>
              <html>
                <head>
                  <meta charset="utf-8">
                  <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background: #1e40af; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
                    .content { background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; }
                    .button { display: inline-block; background: #1e40af; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
                    .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
                  </style>
                </head>
                <body>
                  <div class="container">
                    <div class="header">
                      <h1>Document Ready for Signature</h1>
                    </div>
                    <div class="content">
                      <p>Hello ${result.recipientName || 'there'},</p>
                      <p>${emailBody || `You have been requested to sign the document "${template.name}".`}</p>
                      <p><strong>Document:</strong> ${template.name}</p>
                      <p><strong>Expires:</strong> ${expirationDate.toLocaleDateString()}</p>
                      <p style="text-align: center;">
                        <a href="${firstSigner.url}" class="button">Review & Sign Document</a>
                      </p>
                      <p style="font-size: 12px; color: #666;">
                        Or copy and paste this link into your browser:<br>
                        ${firstSigner.url}
                      </p>
                    </div>
                    <div class="footer">
                      <p>M2 Fleet Communications Portal</p>
                      <p>This is an automated message. Please do not reply directly to this email.</p>
                    </div>
                  </div>
                </body>
              </html>
            `,
          }).catch(err => console.error('Email send error:', err))
        );
      }
    }

    // Don't wait for all emails to send
    Promise.all(emailPromises).then(() => {
      console.log('Bulk send emails completed');
    });

    // Update bulk send record with results
    await updateDoc(bulkSendRef, {
      results,
      'stats.sent': results.filter(r => r.status === 'created').length,
      'stats.failed': results.filter(r => r.status === 'failed').length,
      'stats.pending': results.filter(r => r.status === 'created').length,
      status: 'sent',
    });

    return new Response(JSON.stringify({ 
      success: true, 
      bulkSendId,
      totalSent: results.filter(r => r.status === 'created').length,
      totalFailed: results.filter(r => r.status === 'failed').length,
      results,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('Error in bulk send:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
