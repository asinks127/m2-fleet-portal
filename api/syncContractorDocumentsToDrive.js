import { supabase, getAuthUser } from './_lib/supabaseServer.js';

const DOCUMENT_TYPE_FOLDERS = {
  invoice: 'Contractor Invoices',
  workers_comp: 'Workers Comp',
  safety: 'Safety Documents',
  initial_paperwork: 'Initial Paperwork',
  w9: 'Initial Paperwork',
};

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
  return 'initial_paperwork';
};

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const user = await getAuthUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  console.log(`User ${user.email} triggered document sync to Drive.`);

  try {
    const { data: documents, error: docError } = await supabase
      .from('ContractorDocument')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1000);

    if (docError) throw docError;
    console.log(`Found ${documents?.length || 0} contractor documents.`);

    const { data: allUsers, error: userError } = await supabase
      .from('User')
      .select('id, email, displayName, full_name');

    if (userError) throw userError;
    const usersMap = new Map((allUsers || []).map(u => [u.id, u]));

    const results = { success: 0, failed: 0, skipped: 0, details: [] };

    for (const doc of (documents || [])) {
      if (doc.fileName === '.folder_placeholder' || !doc.fileUrl) {
        results.skipped++;
        continue;
      }

      const contractor = usersMap.get(doc.contractorId);
      if (!contractor) {
        console.warn(`Contractor not found for document ${doc.id}`);
        results.skipped++;
        continue;
      }

      const contractorName = contractor.displayName || contractor.full_name || contractor.email || 'Unknown';
      const documentType = getDocumentType(doc.folder || '');

      try {
        const response = await fetch(`${process.env.APP_URL || 'https://www.m2fleetcomportal.com'}/api/uploadToDrive`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileUrl: doc.fileUrl,
            fileName: doc.fileName,
            documentType: documentType,
            contractorName: contractorName,
            invoiceId: doc.invoiceId || null,
          }),
        });

        const result = await response.json();

        if (result.success) {
          results.success++;
          results.details.push({ documentId: doc.id, fileName: doc.fileName, status: 'success', link: result.webViewLink });
          console.log(`Synced: ${doc.fileName} → ${result.webViewLink}`);
        } else {
          results.failed++;
          results.details.push({ documentId: doc.id, fileName: doc.fileName, status: 'error', error: result.error });
        }
      } catch (error) {
        results.failed++;
        results.details.push({ documentId: doc.id, fileName: doc.fileName, status: 'error', error: error.message });
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Documents sync processed',
      total: documents?.length || 0,
      ...results,
    });
  } catch (error) {
    console.error('Error in syncContractorDocumentsToDrive:', error);
    return res.status(500).json({ error: error.message || 'Sync failed' });
  }
}
