import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';
import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, collection, doc, setDoc, getDoc, updateDoc, Timestamp } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';

const resend = new Resend(process.env.RESEND_API_KEY);

// Firebase admin config from environment
const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
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
    const { name, description, documentType, pdfBase64, pdfFileName, fields, signers, settings, createdBy } = body;

    const { db, storage } = getFirebase();
    
    if (!db) {
      return new Response(JSON.stringify({ error: 'Firebase not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Upload PDF to Firebase Storage
    const buffer = Buffer.from(pdfBase64, 'base64');
    const storagePath = `templates/${Date.now()}_${pdfFileName}`;
    const storageRef = ref(storage, storagePath);
    
    await uploadBytes(storageRef, buffer, { contentType: 'application/pdf' });
    const pdfUrl = await getDownloadURL(storageRef);

    // Create template document
    const templateId = `template_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const templateRef = doc(collection(db, 'documentTemplates'), templateId);
    
    const templateData = {
      id: templateId,
      name,
      description: description || '',
      documentType: documentType || 'custom',
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      createdBy,
      originalPdfUrl: pdfUrl,
      storagePath,
      fields: fields || [],
      signers: signers || [],
      settings: {
        signingOrder: settings?.signingOrder || 'sequential',
        expirationDays: settings?.expirationDays || 30,
        remindDays: settings?.remindDays || 3,
        allowTypedSignature: true,
        allowDrawnSignature: true,
        ...settings,
      },
      isActive: true,
      usageCount: 0,
    };

    await setDoc(templateRef, templateData);

    return new Response(JSON.stringify({ success: true, template: templateData }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('Error creating template:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
