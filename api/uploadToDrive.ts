import { supabase } from '../src/lib/supabaseClient';
import { google } from 'npm:googleapis@140.0.0';
import { Buffer } from 'node:buffer';
import { Readable } from 'node:stream';

// Helper to convert Web Stream to Node Stream ensuring Buffer chunks
function webToNodeStream(webStream) {
    if (!webStream) return new Readable({ read() { this.push(null); } });
    
    // We avoid Readable.fromWeb here because googleapis sometimes requires Buffer chunks specifically
    // and Readable.fromWeb might emit Uint8Arrays which can cause issues in some environments.
    const reader = webStream.getReader();
    return new Readable({
        async read() {
            try {
                const { done, value } = await reader.read();
                if (done) {
                    this.push(null);
                } else {
                    // Convert Uint8Array to Node Buffer to satisfy googleapis
                    this.push(Buffer.from(value));
                }
            } catch (e) {
                this.destroy(e);
            }
        }
    });
}

// Root folder ID for all contractor documents
const ROOT_FOLDER_ID = '0AG5XubOTYKLFUk9PVA';

// Document type to folder name mapping
const DOCUMENT_TYPE_FOLDERS = {
    'invoice': 'Contractor Invoices',
    'workers_comp': 'Workers Comp',
    'safety': 'Safety Documents',
    'initial_paperwork': 'Initial Paperwork',
    'w9': 'Initial Paperwork'
};

// Initialize Google Drive client
function getDriveClient() {
    let key = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_KEY');
    if (!key) throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY is missing');
    
    // Robust parsing
    key = key.trim();
    if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
        key = key.slice(1, -1);
    }

    let credentials;
    try {
        credentials = JSON.parse(key);
    } catch (e) {
        throw new Error('Failed to parse GOOGLE_SERVICE_ACCOUNT_KEY JSON: ' + e.message);
    }
    
    // Fix newlines in private key if they are escaped
    if (credentials.private_key) {
        credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');
    }
    
    const auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/drive']
    });
    
    return google.drive({ version: 'v3', auth });
}

// Create folder if it doesn't exist
async function getOrCreateFolder(drive, folderName, parentId) {
    // Escape single quotes in folder name for the query
    const escapedName = folderName.replace(/'/g, "\\'");

    // Search for existing folder
    const query = `name='${escapedName}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;

    try {
        const response = await drive.files.list({
            q: query,
            fields: 'files(id, name)',
            spaces: 'drive',
            includeItemsFromAllDrives: true,
            supportsAllDrives: true
        });

        if (response.data.files.length > 0) {
            return response.data.files[0].id;
        }
    } catch (e) {
        console.error(`Error searching for folder ${folderName}:`, e);
        // Fall through to create if search fails (though search fail usually implies bigger issues)
    }

    // Create new folder
    const fileMetadata = {
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parentId]
    };

    const folder = await drive.files.create({
        requestBody: fileMetadata,
        fields: 'id',
        supportsAllDrives: true
    });

    return folder.data.id;
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(200).end();

    try {        
        // Verify user is authenticated
        const user = await base44.auth.me();
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }
        
        const { fileUrl, fileName, documentType, contractorName, invoiceId } = req.body;
        
        if (!fileUrl || !fileName) {
            return Response.json({ 
                error: 'Missing required parameters: fileUrl and fileName' 
            }, { status: 400 });
        }
        
        if (!documentType || !contractorName) {
            return Response.json({ 
                error: 'Missing required parameters: documentType and contractorName' 
            }, { status: 400 });
        }
        
        // Get the folder name for this document type
        const typeFolderName = DOCUMENT_TYPE_FOLDERS[documentType];
        if (!typeFolderName) {
            return Response.json({ 
                error: `Invalid documentType: ${documentType}. Valid types: ${Object.keys(DOCUMENT_TYPE_FOLDERS).join(', ')}` 
            }, { status: 400 });
        }
        
        const drive = getDriveClient();
        
        // Create folder structure: Root > Contractor Name > Document Type
        // Step 1: Get or create the Contractor's folder in the Root
        const contractorFolderId = await getOrCreateFolder(drive, contractorName, ROOT_FOLDER_ID);
        
        // Step 2: Get or create the Document Type folder inside the Contractor's folder
        const typeFolderId = await getOrCreateFolder(drive, typeFolderName, contractorFolderId);
        
        // Download file from URL
        const fileResponse = await fetch(fileUrl);
        if (!fileResponse.ok) {
            throw new Error(`Failed to download file from URL: ${fileResponse.statusText}`);
        }
        
        // Hybrid Approach: 
        // Use memory buffer for small files (< 25MB) for maximum reliability.
        // Use streams for large files to prevent Out-Of-Memory errors.
        const contentLength = fileResponse.headers.get('content-length');
        const size = contentLength ? parseInt(contentLength, 10) : 0;
        const MAX_BUFFER_SIZE = 25 * 1024 * 1024; // 25MB

        let mediaBody;
        if (size > 0 && size < MAX_BUFFER_SIZE) {
            console.log(`Using Buffer strategy for file size: ${size} bytes`);
            const arrayBuffer = await fileResponse.arrayBuffer();
            mediaBody = Readable.from(Buffer.from(arrayBuffer));
        } else {
            console.log(`Using Stream strategy for file size: ${size || 'unknown'} bytes`);
            mediaBody = webToNodeStream(fileResponse.body);
        }
        
        // Upload to Google Drive in the specific document type folder within the contractor's folder
        const fileMetadata = {
            name: fileName,
            parents: [typeFolderId]
        };
        
        const media = {
            mimeType: fileResponse.headers.get('content-type') || 'application/octet-stream',
            body: mediaBody
        };
        
        const uploadResponse = await drive.files.create({
            requestBody: fileMetadata,
            media: media,
            fields: 'id, name, webViewLink, webContentLink',
            supportsAllDrives: true
        });
        
        // Update invoice with Drive link if invoiceId provided
        if (invoiceId) {
            try {
                await supabase.from('Invoice').update({
                    driveFileId: uploadResponse.data.id,
                    driveLink: uploadResponse.data.webViewLink
                }).eq('id', invoiceId);
            } catch (dbError) {
                console.error("Failed to update invoice with drive link:", dbError);
                // Don't fail the whole request if DB update fails, but log it
            }
        }
        
        return Response.json({
            success: true,
            fileId: uploadResponse.data.id,
            fileName: uploadResponse.data.name,
            webViewLink: uploadResponse.data.webViewLink,
            webContentLink: uploadResponse.data.webContentLink,
            folderPath: `${contractorName}/${typeFolderName}`
        });
        
    } catch (error) {
        console.error('Drive upload error:', error);

        // Attempt to extract service account email for better error messaging
        let serviceAccountEmail = 'unknown (check GOOGLE_SERVICE_ACCOUNT_KEY)';
        try {
            let key = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_KEY');
            if (key) {
                key = key.trim();
                if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
                    key = key.slice(1, -1);
                }
                const creds = JSON.parse(key);
                serviceAccountEmail = creds.client_email;
            }
        } catch (e) {
            console.error('Failed to parse service account email for error message:', e);
        }
        
        // Log error to AlertLog for admin visibility
        try {            // Try to get user details if possible, but don't fail if we can't
            let userEmail = 'unknown';
            try {
                const user = await base44.auth.me();
                if (user) userEmail = user.email;
            } catch (e) { /* ignore auth error in catch block */ }

            // We use a direct DB call via service role to ensure it saves
            await supabase.from('AlertLog').insert({
                technicianId: 'system', 
                technicianName: 'System Upload',
                subject: 'Google Drive Upload Failed',
                status: 'error',
                errorMessage: `Failed to upload file for ${userEmail}. Error: ${error.message}. Stack: ${error.stack}`,
                triggeredBy: userEmail,
                sentTo: [] // System alert
            });
        } catch (logError) {
            console.error('Failed to create AlertLog:', logError);
        }

        // Return 200 with error details so client doesn't see generic 500
        let userFriendlyError = error.message;
        
        if (error.message && error.message.includes('storage quota')) {
            userFriendlyError = `STORAGE QUOTA ERROR: The destination folder is NOT a Google Shared Drive (Team Drive). Service Accounts can ONLY upload to Shared Drives because they have 0GB personal storage. Please move your "Contractor Documents" folder into a true Google Shared Drive.`;
        } else {
             userFriendlyError = `Upload Failed. You must grant "Editor" access to this Service Account: ${serviceAccountEmail}. Details: ${error.message}`;
        }

        return Response.json({ 
            success: false,
            error: userFriendlyError,
            details: error.stack
        }, { status: 200 });
    }
}
