import { db, storage } from '@/config/firebase.js';
import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  limit,
  startAfter,
  onSnapshot,
  Timestamp,
  writeBatch,
} from 'firebase/firestore';
import { 
  ref, 
  uploadBytes, 
  getDownloadURL, 
  deleteObject,
  uploadBytesResumable,
} from 'firebase/storage';

// Collection names
const COLLECTIONS = {
  TEMPLATES: 'documentTemplates',
  REQUESTS: 'documentRequests',
  SIGNED_DOCS: 'signedDocuments',
  AUDIT_LOGS: 'documentAuditLogs',
  BULK_SENDS: 'bulkSends',
};

// ============ TEMPLATES ============

export async function createTemplate(template) {
  if (!db) throw new Error('Firebase not initialized');
  
  const docRef = doc(collection(db, COLLECTIONS.TEMPLATES));
  const templateData = {
    ...template,
    id: docRef.id,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };
  
  await setDoc(docRef, templateData);
  return templateData;
}

export async function updateTemplate(templateId, updates) {
  if (!db) throw new Error('Firebase not initialized');
  
  const docRef = doc(db, COLLECTIONS.TEMPLATES, templateId);
  await updateDoc(docRef, {
    ...updates,
    updatedAt: Timestamp.now(),
  });
  
  const updated = await getDoc(docRef);
  return updated.data();
}

export async function getTemplate(templateId) {
  if (!db) throw new Error('Firebase not initialized');
  
  const docRef = doc(db, COLLECTIONS.TEMPLATES, templateId);
  const snapshot = await getDoc(docRef);
  
  if (!snapshot.exists()) return null;
  return snapshot.data();
}

export async function listTemplates(filters = {}) {
  if (!db) throw new Error('Firebase not initialized');
  
  let q = collection(db, COLLECTIONS.TEMPLATES);
  const constraints = [orderBy('createdAt', 'desc')];
  
  if (filters.isActive !== undefined) {
    constraints.push(where('isActive', '==', filters.isActive));
  }
  if (filters.documentType) {
    constraints.push(where('documentType', '==', filters.documentType));
  }
  if (filters.createdBy) {
    constraints.push(where('createdBy', '==', filters.createdBy));
  }
  if (filters.limit) {
    constraints.push(limit(filters.limit));
  }
  
  q = query(q, ...constraints);
  const snapshot = await getDocs(q);
  
  return snapshot.docs.map(doc => doc.data());
}

export async function deleteTemplate(templateId) {
  if (!db) throw new Error('Firebase not initialized');
  
  const template = await getTemplate(templateId);
  if (template?.originalPdfUrl) {
    await deleteFileByUrl(template.originalPdfUrl);
  }
  
  await deleteDoc(doc(db, COLLECTIONS.TEMPLATES, templateId));
}

// ============ DOCUMENT REQUESTS ============

export async function createDocumentRequest(request) {
  if (!db) throw new Error('Firebase not initialized');
  
  const docRef = doc(collection(db, COLLECTIONS.REQUESTS));
  const requestData = {
    ...request,
    id: docRef.id,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };
  
  await setDoc(docRef, requestData);
  return requestData;
}

export async function updateDocumentRequest(requestId, updates) {
  if (!db) throw new Error('Firebase not initialized');
  
  const docRef = doc(db, COLLECTIONS.REQUESTS, requestId);
  await updateDoc(docRef, {
    ...updates,
    updatedAt: Timestamp.now(),
  });
  
  const updated = await getDoc(docRef);
  return updated.data();
}

export async function getDocumentRequest(requestId) {
  if (!db) throw new Error('Firebase not initialized');
  
  const docRef = doc(db, COLLECTIONS.REQUESTS, requestId);
  const snapshot = await getDoc(docRef);
  
  if (!snapshot.exists()) return null;
  return snapshot.data();
}

export async function getDocumentRequestByToken(signingToken) {
  if (!db) throw new Error('Firebase not initialized');
  
  const q = query(
    collection(db, COLLECTIONS.REQUESTS),
    where('signers', 'array-contains', { signingToken }),
    limit(1)
  );
  
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;
  
  const docData = snapshot.docs[0].data();
  // Find the signer with matching token
  const signer = docData.signers.find(s => s.signingToken === signingToken);
  return { request: docData, signer };
}

export async function listDocumentRequests(filters = {}) {
  if (!db) throw new Error('Firebase not initialized');
  
  let q = collection(db, COLLECTIONS.REQUESTS);
  const constraints = [orderBy('createdAt', 'desc')];
  
  if (filters.status) {
    if (Array.isArray(filters.status)) {
      constraints.push(where('status', 'in', filters.status));
    } else {
      constraints.push(where('status', '==', filters.status));
    }
  }
  if (filters.contractorId) {
    constraints.push(where('contractorId', '==', filters.contractorId));
  }
  if (filters.createdBy) {
    constraints.push(where('createdBy', '==', filters.createdBy));
  }
  if (filters.bulkSendId) {
    constraints.push(where('bulkSendId', '==', filters.bulkSendId));
  }
  if (filters.limit) {
    constraints.push(limit(filters.limit));
  }
  
  q = query(q, ...constraints);
  const snapshot = await getDocs(q);
  
  return snapshot.docs.map(doc => doc.data());
}

export async function deleteDocumentRequest(requestId) {
  if (!db) throw new Error('Firebase not initialized');
  
  const request = await getDocumentRequest(requestId);
  if (request?.originalPdfUrl) {
    await deleteFileByUrl(request.originalPdfUrl);
  }
  
  await deleteDoc(doc(db, COLLECTIONS.REQUESTS, requestId));
}

// ============ SIGNED DOCUMENTS ============

export async function createSignedDocument(signedDoc) {
  if (!db) throw new Error('Firebase not initialized');
  
  const docRef = doc(collection(db, COLLECTIONS.SIGNED_DOCS));
  const signedData = {
    ...signedDoc,
    id: docRef.id,
    signedAt: Timestamp.now(),
  };
  
  await setDoc(docRef, signedData);
  return signedData;
}

export async function getSignedDocument(signedDocId) {
  if (!db) throw new Error('Firebase not initialized');
  
  const docRef = doc(db, COLLECTIONS.SIGNED_DOCS, signedDocId);
  const snapshot = await getDoc(docRef);
  
  if (!snapshot.exists()) return null;
  return snapshot.data();
}

export async function listSignedDocuments(filters = {}) {
  if (!db) throw new Error('Firebase not initialized');
  
  let q = collection(db, COLLECTIONS.SIGNED_DOCS);
  const constraints = [orderBy('signedAt', 'desc')];
  
  if (filters.contractorId) {
    constraints.push(where('contractorId', '==', filters.contractorId));
  }
  if (filters.documentType) {
    constraints.push(where('documentType', '==', filters.documentType));
  }
  if (filters.limit) {
    constraints.push(limit(filters.limit));
  }
  
  q = query(q, ...constraints);
  const snapshot = await getDocs(q);
  
  return snapshot.docs.map(doc => doc.data());
}

// ============ AUDIT LOGS ============

export async function addAuditEntry(requestId, entry) {
  if (!db) throw new Error('Firebase not initialized');
  
  const docRef = doc(collection(db, `${COLLECTIONS.REQUESTS}/${requestId}/${COLLECTIONS.AUDIT_LOGS}`));
  const auditData = {
    ...entry,
    id: docRef.id,
    timestamp: Timestamp.now(),
  };
  
  await setDoc(docRef, auditData);
  return auditData;
}

export async function getAuditLogs(requestId) {
  if (!db) throw new Error('Firebase not initialized');
  
  const q = query(
    collection(db, `${COLLECTIONS.REQUESTS}/${requestId}/${COLLECTIONS.AUDIT_LOGS}`),
    orderBy('timestamp', 'asc')
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => doc.data());
}

// ============ BULK SENDS ============

export async function createBulkSend(bulkSend) {
  if (!db) throw new Error('Firebase not initialized');
  
  const docRef = doc(collection(db, COLLECTIONS.BULK_SENDS));
  const bulkData = {
    ...bulkSend,
    id: docRef.id,
    createdAt: Timestamp.now(),
    status: 'in_progress',
    totalSent: 0,
    totalCompleted: 0,
    totalFailed: 0,
  };
  
  await setDoc(docRef, bulkData);
  return bulkData;
}

export async function updateBulkSend(bulkSendId, updates) {
  if (!db) throw new Error('Firebase not initialized');
  
  const docRef = doc(db, COLLECTIONS.BULK_SENDS, bulkSendId);
  await updateDoc(docRef, updates);
  
  const updated = await getDoc(docRef);
  return updated.data();
}

export async function listBulkSends(filters = {}) {
  if (!db) throw new Error('Firebase not initialized');
  
  let q = collection(db, COLLECTIONS.BULK_SENDS);
  const constraints = [orderBy('createdAt', 'desc')];
  
  if (filters.status) {
    constraints.push(where('status', '==', filters.status));
  }
  if (filters.limit) {
    constraints.push(limit(filters.limit));
  }
  
  q = query(q, ...constraints);
  const snapshot = await getDocs(q);
  
  return snapshot.docs.map(doc => doc.data());
}

// ============ FILE STORAGE ============

export async function uploadPdfFile(file, path, onProgress) {
  if (!storage) throw new Error('Firebase Storage not initialized');
  
  const storageRef = ref(storage, path);
  
  if (onProgress) {
    const uploadTask = uploadBytesResumable(storageRef, file, {
      contentType: 'application/pdf',
    });
    
    return new Promise((resolve, reject) => {
      uploadTask.on('state_changed',
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          onProgress(progress);
        },
        (error) => reject(error),
        async () => {
          const url = await getDownloadURL(uploadTask.snapshot.ref);
          resolve({ url, path });
        }
      );
    });
  } else {
    const snapshot = await uploadBytes(storageRef, file, {
      contentType: 'application/pdf',
    });
    const url = await getDownloadURL(snapshot.ref);
    return { url, path };
  }
}

export async function deleteFileByUrl(fileUrl) {
  if (!storage) return;
  
  try {
    const storageRef = ref(storage, fileUrl);
    await deleteObject(storageRef);
  } catch (error) {
    console.warn('Failed to delete file:', error.message);
  }
}

// ============ REAL-TIME SUBSCRIPTIONS ============

export function subscribeToDocumentRequest(requestId, callback) {
  if (!db) throw new Error('Firebase not initialized');
  
  const docRef = doc(db, COLLECTIONS.REQUESTS, requestId);
  return onSnapshot(docRef, (snapshot) => {
    if (snapshot.exists()) {
      callback(snapshot.data());
    } else {
      callback(null);
    }
  });
}

export function subscribeToBulkSend(bulkSendId, callback) {
  if (!db) throw new Error('Firebase not initialized');
  
  const docRef = doc(db, COLLECTIONS.BULK_SENDS, bulkSendId);
  return onSnapshot(docRef, (snapshot) => {
    if (snapshot.exists()) {
      callback(snapshot.data());
    } else {
      callback(null);
    }
  });
}

// ============ BATCH OPERATIONS ============

export async function batchCreateDocumentRequests(requests) {
  if (!db) throw new Error('Firebase not initialized');
  
  const batch = writeBatch(db);
  const createdRequests = [];
  
  for (const request of requests) {
    const docRef = doc(collection(db, COLLECTIONS.REQUESTS));
    const requestData = {
      ...request,
      id: docRef.id,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };
    batch.set(docRef, requestData);
    createdRequests.push(requestData);
  }
  
  await batch.commit();
  return createdRequests;
}
