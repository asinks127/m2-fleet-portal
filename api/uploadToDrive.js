import { supabase, getAuthUser } from './_lib/supabaseServer.js';
import { google } from 'googleapis';
import { Buffer } from 'node:buffer';
import { Readable } from 'node:stream';

// File upload security constraints
const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB max
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'text/csv'
];

const ROOT_FOLDER_ID = '0AG5XubOTYKLFUk9PVA';
const DOCUMENT_TYPE_FOLDERS = {
  invoice: 'Contractor Invoices',
  workers_comp: 'Workers Comp',
  safety: 'Safety Documents',
  initial_paperwork: 'Initial Paperwork',
  w9: 'Initial Paperwork',
};

function validateFileUpload(contentType, contentLength) {
  const errors = [];
  
  if (contentLength && contentLength > MAX_FILE_SIZE) {
    errors.push(`File size exceeds maximum allowed (${MAX_FILE_SIZE / 1024 / 1024}MB)`);
  }
  
  if (contentType && !ALLOWED_MIME_TYPES.includes(contentType)) {
    errors.push(`File type "${contentType}" is not allowed`);
  }
  
  return errors;
}

function webToNodeStream(webStream) {
  if (!webStream) return new Readable({ read() { this.push(null); } });
  const reader = webStream.getReader();
  return new Readable({
    async read() {
      try {
        const { done, value } = await reader.read();
        if (done) this.push(null);
        else this.push(Buffer.from(value));
      } catch (e) {
        this.destroy(e);
      }
    }
  });
}

function getDriveClient() {
  let key = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!key) throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY is missing');
  key = key.trim();
  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
    key = key.slice(1, -1);
  }
  const credentials = JSON.parse(key);
  if (credentials.private_key) credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');
  const auth = new google.auth.GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/drive'] });
  return google.drive({ version: 'v3', auth });
}

async function getOrCreateFolder(drive, folderName, parentId) {
  const escapedName = folderName.replace(/'/g, "\\'");
  const q = `name='${escapedName}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  const list = await drive.files.list({
    q,
    fields: 'files(id,name)',
    spaces: 'drive',
    includeItemsFromAllDrives: true,
    supportsAllDrives: true,
  });
  if (list.data.files?.length) return list.data.files[0].id;
  const created = await drive.files.create({
    requestBody: { name: folderName, mimeType: 'application/vnd.google-apps.folder', parents: [parentId] },
    fields: 'id',
    supportsAllDrives: true,
  });
  return created.data.id;
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const user = await getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const { fileUrl, fileName, documentType, contractorName, invoiceId } = req.body || {};
    if (!fileUrl || !fileName || !documentType || !contractorName) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    const typeFolderName = DOCUMENT_TYPE_FOLDERS[documentType];
    if (!typeFolderName) return res.status(400).json({ error: `Invalid documentType: ${documentType}` });

    const drive = getDriveClient();
    const contractorFolderId = await getOrCreateFolder(drive, contractorName, ROOT_FOLDER_ID);
    const typeFolderId = await getOrCreateFolder(drive, typeFolderName, contractorFolderId);

    const fileResponse = await fetch(fileUrl);
    if (!fileResponse.ok) throw new Error(`Failed to download source file: ${fileResponse.status}`);

    const size = Number(fileResponse.headers.get('content-length') || '0');
    const MAX_BUFFER_SIZE = 25 * 1024 * 1024;
    let mediaBody;
    if (size > 0 && size < MAX_BUFFER_SIZE) {
      const arrayBuffer = await fileResponse.arrayBuffer();
      mediaBody = Readable.from(Buffer.from(arrayBuffer));
    } else {
      mediaBody = webToNodeStream(fileResponse.body);
    }

    const upload = await drive.files.create({
      requestBody: { name: fileName, parents: [typeFolderId] },
      media: {
        mimeType: fileResponse.headers.get('content-type') || 'application/octet-stream',
        body: mediaBody,
      },
      fields: 'id,name,webViewLink,webContentLink',
      supportsAllDrives: true,
    });

    if (invoiceId) {
      await supabase.from('Invoice').update({
        driveFileId: upload.data.id,
        driveLink: upload.data.webViewLink,
      }).eq('id', invoiceId);
    }

    return res.status(200).json({
      success: true,
      fileId: upload.data.id,
      fileName: upload.data.name,
      webViewLink: upload.data.webViewLink,
      webContentLink: upload.data.webContentLink,
      folderPath: `${contractorName}/${typeFolderName}`,
    });
  } catch (error) {
    console.error('Drive upload error:', error);
    return res.status(200).json({
      success: false,
      error: error.message || 'Drive upload failed',
    });
  }
}
