import { supabase, getAuthUser } from './_lib/supabaseServer.js';
import { google } from 'googleapis';
import { Readable } from 'node:stream';
import { Buffer } from 'node:buffer';

function getDriveClient() {
  let key = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!key) throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY is missing');
  key = key.trim();
  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
    key = key.slice(1, -1);
  }
  const credentials = JSON.parse(key);
  if (credentials.private_key) credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');
  const auth = new google.auth.GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/drive.file'] });
  return google.drive({ version: 'v3', auth });
}

async function getOrCreateFolder(drive, folderName, parentId = null) {
  const escapedName = folderName.replace(/'/g, "\\'");
  const q = parentId
    ? `name='${escapedName}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`
    : `name='${escapedName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  const list = await drive.files.list({ q, fields: 'files(id,name)', spaces: 'drive', includeItemsFromAllDrives: true, supportsAllDrives: true });
  if (list.data.files?.length) return list.data.files[0].id;
  const create = await drive.files.create({
    requestBody: {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
      ...(parentId ? { parents: [parentId] } : {}),
    },
    fields: 'id',
    supportsAllDrives: true,
  });
  return create.data.id;
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const user = await getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const { contractorId } = req.body || {};
    if (!contractorId) return res.status(400).json({ error: 'Missing contractorId parameter' });

    const { data: contractorRows, error: cErr } = await supabase.from('User').select('*').eq('id', contractorId).limit(1);
    if (cErr) throw cErr;
    if (!contractorRows?.length) return res.status(404).json({ error: 'Contractor not found' });

    const contractor = contractorRows[0];
    const contractorName = contractor.displayName || contractor.full_name || contractor.email;

    const { data: documents, error: dErr } = await supabase.from('ContractorDocument').select('*').eq('contractorId', contractorId);
    if (dErr) throw dErr;

    if (!documents?.length) return res.status(200).json({ message: 'No documents to sync', synced: 0, total: 0, results: [] });

    const drive = getDriveClient();
    const rootFolderId = await getOrCreateFolder(drive, 'M2 Fleet Documents');
    const contractorFolderId = await getOrCreateFolder(drive, contractorName, rootFolderId);

    const results = [];

    for (const doc of documents) {
      try {
        const folderId = await getOrCreateFolder(drive, doc.folder || 'General', contractorFolderId);
        const fileRes = await fetch(doc.fileUrl);
        if (!fileRes.ok) {
          results.push({ documentId: doc.id, fileName: doc.fileName, success: false, error: 'Failed to download file' });
          continue;
        }

        const arr = await fileRes.arrayBuffer();
        const media = {
          mimeType: doc.mimeType || fileRes.headers.get('content-type') || 'application/octet-stream',
          body: Readable.from(Buffer.from(arr)),
        };

        const upload = await drive.files.create({
          requestBody: { name: doc.fileName, parents: [folderId] },
          media,
          fields: 'id,name,webViewLink',
          supportsAllDrives: true,
        });

        await supabase.from('ContractorDocument').update({
          driveFileId: upload.data.id,
          driveLink: upload.data.webViewLink,
          lastSyncedAt: new Date().toISOString(),
        }).eq('id', doc.id);

        results.push({ documentId: doc.id, fileName: doc.fileName, success: true, driveFileId: upload.data.id, driveLink: upload.data.webViewLink });
      } catch (error) {
        results.push({ documentId: doc.id, fileName: doc.fileName, success: false, error: error.message });
      }
    }

    const successCount = results.filter(r => r.success).length;
    return res.status(200).json({ message: `Synced ${successCount} of ${documents.length} documents`, synced: successCount, total: documents.length, results });
  } catch (error) {
    console.error('Sync error:', error);
    return res.status(500).json({ error: error.message || 'Failed to sync documents' });
  }
}
