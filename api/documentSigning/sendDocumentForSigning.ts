import { Resend } from 'resend';
import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, collection, doc, setDoc, updateDoc, Timestamp } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL, copyToObject } from 'firebase/storage';
import { nanoid } from 'nanoid';

const resend = new Resend(process.env.RESEND_API_KEY);

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
};

let db: any = null;
let storage: any = null;

function getFirebase() {
  if (!db && firebaseConfig.apiKey) {
    const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
    db = getFirestore(app);
    storage = getStorage(app);
  }
  return { db, storage };
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
      name, 
      signers: inputSigners, 
      contractorId,
      contractorName,
      expiresAt,
      emailSubject,
      emailBody,
      createdBy,
      bulkSendId,
    } = body;

    const { db, storage } = getFirebase();
    
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

    // Create document request
    const requestId = `request_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const requestRef = doc(collection(db, 'documentRequests'), requestId);

    // Generate signing tokens for each signer
    const signers = inputSigners.map((signer: any, index: number) => ({
      ...signer,
      id: `signer_${Date.now()}_${index}`,
      order: index,
      status: 'pending',
      signingToken: generateSigningToken(),
      signingUrl: null, // Will be set below
      viewedAt: null,
      signedAt: null,
      reminderCount: 0,
    }));

    // Generate signing URLs
    signers.forEach((signer: any) => {
      signer.signingUrl = generateSigningUrl(requestId, signer.signingToken);
    });

    // Copy template PDF to new location
    const newStoragePath = `requests/${requestId}/original.pdf`;
    
    // If we have the original PDF URL, we'll reference it
    const originalPdfUrl = template.originalPdfUrl;

    // Calculate expiration
    const expirationDate = expiresAt 
      ? new Date(expiresAt)
      : new Date(Date.now() + (template.settings?.expirationDays || 30) * 24 * 60 * 60 * 1000);

    const requestData = {
      id: requestId,
      templateId,
      name: name || template.name,
      documentType: template.documentType,
      status: 'sent',
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      createdBy,
      originalPdfUrl,
      fields: JSON.parse(JSON.stringify(template.fields)),
      signers,
      currentSignerOrder: 0,
      expiresAt: Timestamp.fromDate(expirationDate),
      completedAt: null,
      signedPdfUrl: null,
      contractorId,
      contractorName,
      bulkSendId,
      metadata: {
        source: bulkSendId ? 'bulk_send' : 'manual',
        tags: [],
        notes: '',
      },
    };

    await setDoc(requestRef, requestData);

    // Update template usage count
    await updateDoc(templateRef, {
      usageCount: (template.usageCount || 0) + 1,
    });

    // Send emails to first signer(s) based on signing order
    const signersToNotify = template.settings?.signingOrder === 'parallel'
      ? signers
      : [signers[0]];

    for (const signer of signersToNotify) {
      if (signer.email) {
        try {
          await resend.emails.send({
            from: 'M2 Fleet Portal <noreply@m2fleetcom.com>',
            to: signer.email,
            subject: emailSubject || `Document Ready for Signature: ${requestData.name}`,
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
                      <p>Hello ${signer.name || 'there'},</p>
                      <p>${emailBody || `You have been requested to sign the document "${requestData.name}".`}</p>
                      <p><strong>Document:</strong> ${requestData.name}</p>
                      <p><strong>Requested by:</strong> M2 Fleet Communications</p>
                      <p><strong>Expires:</strong> ${expirationDate.toLocaleDateString()}</p>
                      <p style="text-align: center;">
                        <a href="${signer.signingUrl}" class="button">Review & Sign Document</a>
                      </p>
                      <p style="font-size: 12px; color: #666;">
                        Or copy and paste this link into your browser:<br>
                        ${signer.signingUrl}
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
          });

          // Update signer status
          const signerIndex = signers.findIndex((s: any) => s.id === signer.id);
          signers[signerIndex].status = 'sent';
          await updateDoc(requestRef, { signers });
        } catch (emailError) {
          console.error('Failed to send email to signer:', emailError);
        }
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      request: requestData,
      signingUrls: signers.map((s: any) => ({ email: s.email, url: s.signingUrl }))
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('Error sending document for signing:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Need to import getDoc
import { getDoc } from 'firebase/firestore';
