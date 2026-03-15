import { supabase } from '../src/lib/supabaseClient';

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(200).end();

    try {        const { invoice } = req.body;

        if (!invoice || invoice.status !== 'approved') {
            console.log('Invalid trigger: Invoice must be provided and approved.');
            return Response.json({ 
                success: false, 
                message: 'Invalid trigger: Invoice must be provided and approved.' 
            }, { status: 400 });
        }

        console.log(`Processing payment ledger update for invoice ${invoice.id}`);

        // 1. Check if a ledger entry for this invoice already exists to prevent duplicates
        const existingEntries = await base44.asServiceRole.entities.PaymentLedger.filter({ 
            invoiceId: invoice.id 
        });
        
        if (existingEntries.length > 0) {
            console.log(`Ledger entry for invoice ${invoice.id} already exists. Skipping.`);
            return Response.json({ 
                success: true, 
                message: 'Ledger entry already exists.' 
            });
        }

        // 2. Get the contractor's project info
        const users = await base44.asServiceRole.entities.User.filter({ 
            email: invoice.contractorEmail 
        });
        const user = users[0];
        const job = user?.project || 'N/A';

        // 3. Determine the sequential invoice number for this technician
        const techInvoices = await base44.asServiceRole.entities.PaymentLedger.filter(
            { technicianEmail: invoice.contractorEmail },
            'billedDate'
        );
        const invoiceNumber = techInvoices.length + 1;

        // 4. Create the new ledger entry
        const ledgerEntry = await supabase.from('PaymentLedger').insert({
            technicianEmail: invoice.contractorEmail,
            technicianName: invoice.contractorName,
            invoiceId: invoice.id,
            invoiceNumber: invoiceNumber,
            job: job,
            billedDate: invoice.approvedDate,
            amount: invoice.totalAmount,
            payment: 0 // Initialize payment as 0
        });

        console.log(`Successfully created ledger entry for invoice ${invoice.id}`, ledgerEntry);
        
        return Response.json({ 
            success: true, 
            ledgerEntryId: ledgerEntry.id,
            message: 'Payment ledger updated successfully' 
        });

    } catch (error) {
        console.error(`Failed to update payment ledger:`, error);
        return Response.json({ 
            success: false, 
            error: error.message,
            stack: error.stack 
        }, { status: 500 });
    }
}
