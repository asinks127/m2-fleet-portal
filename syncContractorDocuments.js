import { supabase, getAuthUser } from './_lib/supabaseServer.js';
import { google } from 'googleapis';

// Initialize Google Drive client
function getDriveClient() {
    const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
    
    const auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/drive.file']
    });
    
    return google.drive({ version: 'v3', auth });
}

// Create folder if it doesn't exist
async function getOrCreateFolder(drive, folderName, parentId = null) {
    const query = parentId 
        ? `name='${folderName}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`
        : `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
    
    const response = await drive.files.list({
        q: query,
        fields: 'files(id, name)',
        spaces: 'drive'
    });
    
    if (response.data.files.length > 0) {
        return response.data.files[0].id;
    }
    
    const fileMetadata = {
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder'
    };
    
    if (parentId) {
        fileMetadata.parents = [parentId];
    }
    
    const folder = await drive.files.create({
        requestBody: fileMetadata,
        fields: 'id'
    });
    
    return folder.data.id;
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

    try {        
        // Service role for admin operations
        const user = await getAuthUser(req);
        if (!user || user.role !== 'admin') {
            return res.status(401).json({ error: 'Unauthorized - Admin only' });
        }
        
        const { contractorId } = req.body;
        
        if (!contractorId) {
            return res.status(400).json({ 
                error: 'Missing contractorId parameter' 
            });
        }
        
        // Get contractor info
        const contractor = await supabase.from('User').select('*').match(
            { id: contractorId },
            null,
            1
        ).then(r => r.data || []);
        
        if (contractor.length === 0) {
            return res.status(404).json({ error: 'Contractor not found' });
        }
        
        const contractorName = contractor[0].displayName || contractor[0].full_name || contractor[0].email;
        
        // Get all contractor documents
        const documents = await supabase.from('ContractorDocument').select('*').match({
            contractorId: contractorId
        }).then(r => r.data || []);
        
        if (documents.length === 0) {
            return res.status(200).json({ 
                message: 'No documents to sync',
                synced: 0
            });
        }
        
        const drive = getDriveClient();
        
        // Create root folder structure: "M2 Fleet Documents/Contractor Name"
        const rootFolderId = await getOrCreateFolder(drive, 'M2 Fleet Documents');
        const contractorFolderId = await getOrCreateFolder(drive, contractorName, rootFolderId);
        
        const results = [];
        
        for (const doc of documents) {
            try {
                // Create folder by document type
                const folderFolderId = await getOrCreateFolder(drive, doc.folder || 'General', contractorFolderId);
                
                // Download file
                const fileResponse = await fetch(doc.fileUrl);
                if (!fileResponse.ok) {
                    results.push({
                        documentId: doc.id,
                        fileName: doc.fileName,
                        success: false,
                        error: 'Failed to download file'
                    });
                    continue;
                }
                
                const fileBuffer = await fileResponse.arrayBuffer();
                const fileBlob = new Blob([fileBuffer]);
                
                // Upload to Drive
                const fileMetadata = {
                    name: doc.fileName,
                    parents: [folderFolderId]
                };
                
                const media = {
                    mimeType: doc.mimeType || 'application/octet-stream',
                    body: fileBlob.stream()
                };
                
                const uploadResponse = await drive.files.create({
                    requestBody: fileMetadata,
                    media: media,
                    fields: 'id, name, webViewLink'
                });
                
                // Update document record with Drive info
                await supabase.from('ContractorDocument').update({
                    driveFileId: uploadResponse.data.id,
                    driveLink: uploadResponse.data.webViewLink,
                    lastSyncedAt: new Date().eq('id', doc.id).toISOString()
                });
                
                results.push({
                    documentId: doc.id,
                    fileName: doc.fileName,
                    success: true,
                    driveFileId: uploadResponse.data.id,
                    driveLink: uploadResponse.data.webViewLink
                });
                
            } catch (error) {
                results.push({
                    documentId: doc.id,
                    fileName: doc.fileName,
                    success: false,
                    error: error.message
                });
            }
        }
        
        const successCount = results.filter(r => r.success).length;
        
        return Response.json({
            message: `Synced ${successCount} of ${documents.length} documents`,
            synced: successCount,
            total: documents.length,
            results: results
        });
        
    } catch (error) {
        console.error('Sync error:', error);
        return res.status(500).json({ 
            error: error.message || 'Failed to sync documents' 
        });
    }
}
