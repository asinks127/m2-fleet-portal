import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Helper to determine document type from folder name, consistent with frontend logic
const getDocumentType = (folderName) => {
  const folderLower = (folderName || '').toLowerCase();
  if (folderLower.includes('workers comp') || folderLower.includes('workers compensation')) {
    return 'workers_comp';
  }
  if (folderLower.includes('safety') || folderLower.includes('osha') || folderLower.includes('certification')) {
    return 'safety';
  }
  if (folderLower.includes('w-9') || folderLower.includes('w9') || folderLower.includes('initial') || folderLower.includes('onboarding')) {
    return 'initial_paperwork';
  }
  if (folderLower.includes('invoice')) {
    return 'invoice';
  }
  return 'initial_paperwork'; // Default for other document types
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log(`User ${user.email} triggered document sync to Drive.`);

    // Fetch all contractor documents
    // Using a large limit to get as many as possible, or handling pagination if SDK supports it automatically or requires it.
    // For now, assuming .list() gets a reasonable batch or all if not too many.
    const documents = await base44.asServiceRole.entities.ContractorDocument.filter({}, '-uploadDate', 1000);
    console.log(`Found ${documents.length} contractor documents.`);

    // Fetch all users to map contractorId to contractorName
    const allUsers = await base44.asServiceRole.entities.User.filter({}, '-created_date', 1000);
    const usersMap = new Map(allUsers.map(u => [u.id, u]));

    const results = [];
    
    // Process in batches to avoid overwhelming the system/timeouts if possible, 
    // but for now sequential or small parallel batches.
    
    for (const doc of documents) {
      // Skip placeholder folder entries
      if (doc.fileName === '.folder_placeholder') {
        continue;
      }

      const contractor = usersMap.get(doc.contractorId);
      if (!contractor) {
        console.warn(`Contractor not found for document ${doc.id}`);
        continue;
      }

      const contractorName = contractor.displayName || contractor.full_name || contractor.email || 'Unknown Contractor';
      const documentType = getDocumentType(doc.folder || '');

      try {
        console.log(`Syncing document: ${doc.fileName} for ${contractorName} to Drive...`);
        // We don't await the result strictly if we want speed, but for sync logs we might want to.
        // To prevent timeout on large sets, we might fire and forget or limit the loop.
        // Given Deno Deploy limits, we'll try to do it. 
        
        const response = await base44.asServiceRole.functions.invoke('uploadToDrive', {
          fileUrl: doc.fileUrl,
          fileName: doc.fileName,
          documentType: documentType,
          contractorName: contractorName,
        });
        
        if (response.data && response.data.success) {
             console.log(`Successfully uploaded: ${doc.fileName} to ${response.data.folderPath}. Link: ${response.data.webViewLink}`);
             results.push({ documentId: doc.id, fileName: doc.fileName, status: 'success', link: response.data.webViewLink });
        } else {
             console.error(`Failed to upload ${doc.fileName}: ${response.data ? response.data.error : 'Unknown error'}`);
             results.push({ documentId: doc.id, fileName: doc.fileName, status: 'error', error: response.data ? response.data.error : 'Unknown error' });
        }
      } catch (error) {
        console.error(`Failed to sync document ${doc.fileName} for ${contractorName} to Drive:`, error);
        results.push({ documentId: doc.id, fileName: doc.fileName, status: 'error', error: error.message });
      }
    }

    return Response.json({ success: true, message: 'Documents sync processed.', count: results.length });
  } catch (error) {
    console.error('Error in syncContractorDocumentsToDrive:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});