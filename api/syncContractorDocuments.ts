import { supabase } from '../src/lib/supabaseClient';
import { google } from 'npm:googleapis@140.0.0';

// Initialize Google Drive client
function getDriveClient() {
    const credentials = JSON.parse(Deno.env.get('GOOGLE_SERVICE_ACCOUNT_KEY'));
    
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

    try {        
        // Service role for admin operations
        const user = await base44.auth.me();
        if (!user || user.role !== 'admin') {
            return Response.json({ error: 'Unauthorized - Admin only' }, { status: 401 });
        }
        
        const { contractorId } = req.body;
        
        if (!contractorId) {
            return Response.json({ 
                error: 'Missing contractorId parameter' 
            }, { status: 400 });
        }
        
        // Get contractor info
        const contractor = await base44.asServiceRole.entities.User.filter(
            { id: contractorId },
            null,
            1
        );
        
        if (contractor.length === 0) {
            return Response.json({ error: 'Contractor not found' }, { status: 404 });
        }
        
        const contractorName = contractor[0].displayName || contractor[0].full_name || contractor[0].email;
        
        // Get all contractor documents
        const documents = await base44.asServiceRole.entities.ContractorDocument.filter({
            contractorId: contractorId
        });
        
        if (documents.length === 0) {
            return Response.json({ 
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
        return Response.json({ 
            error: error.message || 'Failed to sync documents' 
        }, { status: 500 });
    }
}
