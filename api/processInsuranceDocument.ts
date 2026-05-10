import { supabase } from '../src/lib/supabaseClient';

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(200).end();    
    try {
        const { documentId } = req.body;
        
        console.log('Processing insurance document:', documentId);
        
        // Get the document details using service role
        const allDocs = await supabase.from('ContractorDocument').select('*');
        const document = allDocs.find(d => d.id === documentId);
        
        if (!document) {
            console.error('Document not found:', documentId);
            return Response.json({ error: 'Document not found' }, { status: 404 });
        }
        
        console.log('Found document:', document.fileName, 'in folder:', document.folder);
        
        // Only process documents in insurance-related folders
        const insuranceFolders = [
            'workers comp', 'workers compensation', 'insurance', 'coi', 
            'certificate of insurance', 'liability', 'workers comp records'
        ];
        
        const folderLower = document.folder.toLowerCase();
        if (!insuranceFolders.some(folder => folderLower.includes(folder))) {
            console.log('Document not in insurance folder, skipping');
            return Response.json({ 
                message: 'Document not in insurance folder, skipping processing' 
            });
        }
        
        // Extract data using AI
        console.log('Extracting data from document...');
        const extractionResult = await base44.integrations.Core.ExtractDataFromUploadedFile({
            file_url: document.fileUrl,
            json_schema: {
                type: "object",
                properties: {
                    policyNumber: { type: "string", description: "Workers compensation policy number" },
                    provider: { type: "string", description: "Insurance provider/company name" },
                    issueDate: { type: "string", description: "Policy issue date in YYYY-MM-DD format" },
                    expirationDate: { type: "string", description: "Policy expiration date in YYYY-MM-DD format" },
                    coverageAmount: { type: "number", description: "Coverage amount in dollars" },
                    contractorName: { type: "string", description: "Name of the insured contractor/business" }
                }
            }
        });
        
        console.log('Extraction result:', JSON.stringify(extractionResult));
        
        if (extractionResult.status !== 'success' || !extractionResult.output) {
            console.error('Failed to extract data:', extractionResult);
            return Response.json({ 
                error: 'Failed to extract insurance data from document',
                details: extractionResult.details || 'Unknown error'
            }, { status: 400 });
        }
        
        const insuranceData = extractionResult.output;
        console.log('Extracted insurance data:', JSON.stringify(insuranceData));
        
        // Get contractor info using service role
        const allUsers = await supabase.from('User').select('*');
        const contractor = allUsers.find(u => u.id === document.contractorId);
        
        if (!contractor) {
            console.error('Contractor not found for ID:', document.contractorId);
            return Response.json({ error: 'Contractor not found' }, { status: 404 });
        }
        
        console.log('Found contractor:', contractor.email);
        
        // Check if a workers comp record already exists - match by email (case insensitive)
        const allWcRecords = await supabase.from('WorkersCompRecord').select('*');
        const existingRecords = allWcRecords.filter(r => 
            r.userEmail?.toLowerCase() === contractor.email?.toLowerCase() ||
            r.userId === contractor.id
        );
        
        console.log('Existing WC records for contractor:', existingRecords.length);
        
        // Determine policy status
        let status = 'Active';
        if (insuranceData.expirationDate) {
            const expDate = new Date(insuranceData.expirationDate);
            const today = new Date();
            const thirtyDaysFromNow = new Date();
            thirtyDaysFromNow.setDate(today.getDate() + 30);
            
            if (expDate < today) {
                status = 'Expired';
            } else if (expDate < thirtyDaysFromNow) {
                status = 'Pending Renewal';
            }
        }
        
        const recordData = {
            userId: contractor.id,
            userEmail: contractor.email,
            userName: contractor.displayName || contractor.full_name || contractor.email,
            policyNumber: insuranceData.policyNumber || 'Not found',
            provider: insuranceData.provider || 'Not specified',
            issueDate: insuranceData.issueDate || new Date().toISOString().split('T')[0],
            expirationDate: insuranceData.expirationDate || new Date(Date.now() + 365*24*60*60*1000).toISOString().split('T')[0],
            coverageAmount: insuranceData.coverageAmount || 0,
            status: status,
            documentUrl: document.fileUrl,
            notes: `Auto-imported from uploaded document: ${document.fileName} on ${new Date().toISOString()}`
        };
        
        console.log('Creating/updating WC record:', JSON.stringify(recordData));
        
        let workersCompRecord;
        if (existingRecords.length > 0) {
            // Update existing record
            const existingRecord = existingRecords[0];
            console.log('Updating existing record:', existingRecord.id);
            workersCompRecord = await supabase.from('WorkersCompRecord').update(recordData
            ).eq('id', 
                existingRecord.id);
        } else {
            // Create new record
            console.log('Creating new WC record');
            workersCompRecord = await supabase.from('WorkersCompRecord').insert(recordData);
        }
        
        console.log('WC record saved successfully:', workersCompRecord.id);
        
        return Response.json({
            success: true,
            message: 'Insurance document processed successfully',
            workersCompRecord: workersCompRecord,
            extractedData: insuranceData
        });
        
    } catch (error) {
        console.error('Error processing insurance document:', error);
        return Response.json({ 
            error: 'Failed to process insurance document',
            details: error.message 
        }, { status: 500 });
    }
}
