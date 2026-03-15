import { supabase } from '../src/lib/supabaseClient';
import { google } from 'npm:googleapis@140.0.0';
import { Buffer } from 'node:buffer';
import { Readable } from 'node:stream';

// Helper to convert Web Stream to Node Stream ensuring Buffer chunks
function webToNodeStream(webStream) {
    if (!webStream) return new Readable({ read() { this.push(null); } });
    
    const reader = webStream.getReader();
    return new Readable({
        async read() {
            try {
                const { done, value } = await reader.read();
                if (done) {
                    this.push(null);
                } else {
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
};

// Initialize Google Drive client
function getDriveClient() {
    let key = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_KEY');
    if (!key) throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY is missing');
    
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
    
    if (credentials.private_key) {
        credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');
    }
    
    const auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/drive']
    });
    
    return google.drive({ version: 'v3', auth });
}

// Cache for folder IDs to prevent redundant API calls
const folderCache = {};

// Create folder if it doesn't exist (with caching)
async function getOrCreateFolder(drive, folderName, parentId) {
    const cacheKey = `${parentId}_${folderName}`;
    if (folderCache[cacheKey]) {
        return folderCache[cacheKey];
    }

    const escapedName = folderName.replace(/'/g, "\\'");
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
            const folderId = response.data.files[0].id;
            folderCache[cacheKey] = folderId;
            return folderId;
        }
    } catch (e) {
        console.error(`Error searching for folder ${folderName}:`, e);
    }

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

    const newFolderId = folder.data.id;
    folderCache[cacheKey] = newFolderId;
    return newFolderId;
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(200).end();

    try {        
        const user = await base44.auth.me();
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Fetch 2000 NEWEST approved invoices. 
        // We prioritize recent files (-created_date) so users see immediate results for active work.
        const allApprovedInvoices = await base44.entities.Invoice.filter({ status: 'approved' }, '-created_date', 2000);
        
        // Filter for those needing sync
        const invoicesToSync = allApprovedInvoices.filter(inv => !inv.driveFileId && inv.fileUrl);
        
        if (invoicesToSync.length === 0) {
             return Response.json({
                success: true,
                message: "No recent invoices found needing sync (checked top 2000).",
                syncedCount: 0
            });
        }

        // Process batch of 50 for efficiency (user requested larger batch despite timeouts)
        const batch = invoicesToSync.slice(0, 50);
        
        const drive = getDriveClient();
        const typeFolderName = DOCUMENT_TYPE_FOLDERS['invoice'];
        
        // Ensure root folder exists
        const typeFolderId = await getOrCreateFolder(drive, typeFolderName, ROOT_FOLDER_ID);

        const results = [];
        const syncedNames = [];

        for (const invoice of batch) {
            try {
                const contractorName = invoice.contractorName || 'Unknown Contractor';
                const invoiceDate = invoice.invoiceDate ? new Date(invoice.invoiceDate) : new Date();
                const year = invoiceDate.getFullYear().toString();
                
                // 1. Get/Create Contractor Folder (Cached)
                const contractorFolderId = await getOrCreateFolder(drive, contractorName, typeFolderId);

                // 2. Get/Create Year Folder (Cached)
                const yearFolderId = await getOrCreateFolder(drive, year, contractorFolderId);

                // Download file
                const fileResponse = await fetch(invoice.fileUrl);
                if (!fileResponse.ok) throw new Error(`Download failed: ${fileResponse.statusText}`);

                // Stream setup
                const contentLength = fileResponse.headers.get('content-length');
                const size = contentLength ? parseInt(contentLength, 10) : 0;
                const MAX_BUFFER_SIZE = 25 * 1024 * 1024; // 25MB

                let mediaBody;
                if (size > 0 && size < MAX_BUFFER_SIZE) {
                    const arrayBuffer = await fileResponse.arrayBuffer();
                    mediaBody = Readable.from(Buffer.from(arrayBuffer));
                } else {
                    mediaBody = webToNodeStream(fileResponse.body);
                }

                // Upload to Year Folder
                const fileMetadata = {
                    name: invoice.fileName,
                    parents: [yearFolderId]
                };

                const media = {
                    mimeType: fileResponse.headers.get('content-type') || 'application/octet-stream',
                    body: mediaBody
                };

                const uploadResponse = await drive.files.create({
                    requestBody: fileMetadata,
                    media: media,
                    fields: 'id, name, webViewLink',
                    supportsAllDrives: true
                });

                // Update Invoice Record
                await supabase.from('Invoice').update({
                    driveFileId: uploadResponse.data.id,
                    driveLink: uploadResponse.data.webViewLink
                }).eq('id', invoice.id);

                results.push({ id: invoice.id, status: 'success', fileId: uploadResponse.data.id });
                syncedNames.push(invoice.fileName);

            } catch (err) {
                console.error(`Failed to sync invoice ${invoice.id}:`, err);
                results.push({ id: invoice.id, status: 'error', error: err.message });
            }
        }

        const successCount = results.filter(r => r.status === 'success').length;
        const remainingCount = invoicesToSync.length - results.length;

        // Provide detailed feedback
        let msg = `Synced ${successCount} files. `;
        if (syncedNames.length > 0) {
            msg += `Latest: ${syncedNames.slice(0, 3).join(', ')}... `;
        }
        msg += `(${remainingCount} more pending in this batch)`;

        return Response.json({
            success: true,
            message: msg,
            results: results,
            remaining: remainingCount
        });

    } catch (error) {
        console.error('Sync error:', error);
        return Response.json({ 
            success: false,
            error: error.message,
            stack: error.stack
        }, { status: 500 });
    }
}
