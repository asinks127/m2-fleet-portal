import { supabase, getAuthUser } from './_lib/supabaseServer.js';

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

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {    const user = await getAuthUser(req);

    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    console.log(`User ${user.email} triggered document sync to Drive.`);

    // Fetch all contractor documents
    // Using a large limit to get as many as possible, or handling pagination if SDK supports it automatically or requires it.
    // For now, assuming .list() gets a reasonable batch or all if not too many.
    const documents = await supabase.from('ContractorDocument').select('*').match({}, '-uploadDate', 1000).then(r => r.data || []);
    console.log(`Found ${documents.length} contractor documents.`);

    // Fetch all users to map contractorId to contractorName
    const allUsers = await supabase.from('User').select('*').match({}, '-created_date', 1000).then(r => r.data || []);
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
        
        const response = await fetch('/api/uploadToDrive', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify( {
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

    return res.status(200).json({ success: true, message: 'Documents sync processed.', count: results.length });
  } catch (error) {
    console.error('Error in syncContractorDocumentsToDrive:', error);
    return res.status(500).json({ error: error.message });
  }
}
