import { google } from 'npm:googleapis@140.0.0';

// ROOT FOLDER ID from user context
const ROOT_FOLDER_ID = '0AG5XubOTYKLFUk9PVA';

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(200).end();

    // Always return 200 to allow frontend to display diagnostic info
    try {
        let key = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_KEY');
        if (!key) {
             return Response.json({
                serviceAccountEmail: 'unknown',
                rootFolderId: ROOT_FOLDER_ID,
                accessStatus: 'failed',
                folderName: 'unknown',
                errorDetails: 'GOOGLE_SERVICE_ACCOUNT_KEY environment variable is missing.'
            });
        }

        // Robust parsing: trim whitespace and remove wrapping quotes if user pasted them
        key = key.trim();
        if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
            key = key.slice(1, -1);
        }

        let credentials;
        try {
            credentials = JSON.parse(key);
        } catch (e) {
             return Response.json({
                serviceAccountEmail: 'unknown',
                rootFolderId: ROOT_FOLDER_ID,
                accessStatus: 'failed',
                folderName: 'unknown',
                errorDetails: 'Failed to parse GOOGLE_SERVICE_ACCOUNT_KEY. Ensure it is the full JSON content starting with { and ending with }. Error: ' + e.message
            });
        }

        // Fix newlines in private key if they are escaped (common issue with env vars)
        if (credentials.private_key) {
            credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');
        }

        const email = credentials.client_email;

        const auth = new google.auth.GoogleAuth({
            credentials,
            scopes: ['https://www.googleapis.com/auth/drive']
        });
        const drive = google.drive({ version: 'v3', auth });

        let accessStatus = 'unknown';
        let folderName = 'unknown';
        let errorDetails = null;

        try {
            const res = await drive.files.get({
                fileId: ROOT_FOLDER_ID,
                fields: 'id, name, capabilities, owners, shared, driveId',
                supportsAllDrives: true
            });
            
            folderName = res.data.name;
            
            if (!res.data.driveId) {
                accessStatus = 'not_shared_drive';
                errorDetails = 'This folder is in "My Drive", not a "Shared Drive". Service Accounts cannot upload here (0GB quota). Please move the folder to a Google Shared Drive.';
            } else if (res.data.capabilities.canAddChildren) {
                 accessStatus = 'success';
            } else {
                 accessStatus = 'read_only';
                 errorDetails = 'Service account can read the folder but CANNOT upload files to it. Please share the folder with the service account email as an Editor.';
            }
            
        } catch (e) {
            accessStatus = 'failed';
            errorDetails = e.message;
        }

        return Response.json({
            serviceAccountEmail: email,
            rootFolderId: ROOT_FOLDER_ID,
            accessStatus,
            folderName,
            errorDetails
        });
    } catch (e) {
        // Catch-all for any other errors (e.g. import errors, etc)
        return Response.json({ 
            serviceAccountEmail: 'unknown',
            rootFolderId: ROOT_FOLDER_ID,
            accessStatus: 'failed',
            folderName: 'unknown',
            errorDetails: 'Unexpected error: ' + e.message
        });
    }
}
