import { google } from 'googleapis';

const ROOT_FOLDER_ID = '0AG5XubOTYKLFUk9PVA';

function parseServiceAccount() {
  let key = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!key) throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY environment variable is missing.');
  key = key.trim();
  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
    key = key.slice(1, -1);
  }
  const credentials = JSON.parse(key);
  if (credentials.private_key) {
    credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');
  }
  return credentials;
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const credentials = parseServiceAccount();
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/drive']
    });

    const drive = google.drive({ version: 'v3', auth });
    const folder = await drive.files.get({
      fileId: ROOT_FOLDER_ID,
      fields: 'id,name,capabilities,driveId',
      supportsAllDrives: true
    });

    return res.status(200).json({
      serviceAccountEmail: credentials.client_email,
      rootFolderId: ROOT_FOLDER_ID,
      accessStatus: folder.data?.capabilities?.canAddChildren ? 'success' : 'read_only',
      folderName: folder.data?.name || 'unknown',
      errorDetails: null
    });
  } catch (e) {
    return res.status(200).json({
      serviceAccountEmail: 'unknown',
      rootFolderId: ROOT_FOLDER_ID,
      accessStatus: 'failed',
      folderName: 'unknown',
      errorDetails: e.message
    });
  }
}
