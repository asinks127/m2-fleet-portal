import { supabase } from '../src/lib/supabaseClient';
import { jsPDF } from 'npm:jspdf@2.5.1';
import autoTableModule from 'npm:jspdf-autotable@3.8.2';
import { format } from 'npm:date-fns@3.6.0';

// Handle potential ESM default export mismatch
const autoTable = autoTableModule.default || autoTableModule;

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(200).end();

    try {        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { contractorId, startDate, endDate } = req.body;

        if (!contractorId) {
            return Response.json({ error: 'Contractor ID is required' }, { status: 400 });
        }

        // Fetch Contractor
        const contractors = await base44.entities.User.filter({ id: contractorId });
        const contractor = contractors[0];

        if (!contractor) {
            return Response.json({ error: 'Contractor not found' }, { status: 404 });
        }

        // Fetch ALL invoices for this contractor (ignoring payment status to include open/pending)
        // We filter by email. To be robust, if the primary email fetch returns nothing, 
        // we could try lowercase, but usually the system keeps it consistent.
        let allInvoices = await base44.entities.Invoice.filter({ 
            contractorEmail: contractor.email
        });

        // Fallback: try lowercase email if different and no results found (handle potential casing mismatch)
        if (allInvoices.length === 0 && contractor.email && contractor.email !== contractor.email.toLowerCase()) {
             const lowerInvoices = await base44.entities.Invoice.filter({ 
                contractorEmail: contractor.email.toLowerCase() 
            });
            allInvoices = lowerInvoices;
        }

        const start = startDate ? new Date(startDate) : new Date(0); // Default to epoch if no start
        const end = endDate ? new Date(endDate) : new Date(); // Default to now if no end
        // Adjust end date to include the full day
        end.setHours(23, 59, 59, 999);

        // Filter invoices that fall within the date range
        // Logic: Include if Created Date OR Payment Date is in range
        const filteredInvoices = allInvoices.filter(inv => {
            const createdDate = new Date(inv.created_date);
            const paymentDate = inv.paymentDate ? new Date(inv.paymentDate) : null;
            
            const createdInRange = createdDate >= start && createdDate <= end;
            const paidInRange = paymentDate && paymentDate >= start && paymentDate <= end;
            
            return createdInRange || paidInRange;
        }).sort((a, b) => {
            // Sort by effective date (Payment date if paid, else created date)
            const dateA = a.paymentStatus === 'paid' && a.paymentDate ? new Date(a.paymentDate) : new Date(a.created_date);
            const dateB = b.paymentStatus === 'paid' && b.paymentDate ? new Date(b.paymentDate) : new Date(b.created_date);
            return dateA - dateB;
        });

        // Generate PDF
        const doc = new jsPDF();

        // Header
        doc.setFontSize(22);
        doc.setTextColor(40);
        doc.text('Statement of Account', 14, 22);

        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text(`Contractor: ${contractor.displayName || contractor.full_name}`, 14, 32);
        doc.text(`Email: ${contractor.email}`, 14, 37);
        doc.text(`Business: ${contractor.business || 'N/A'}`, 14, 42);
        
        doc.text(`Statement Period:`, 140, 32);
        doc.text(`${format(start, 'MMM d, yyyy')} - ${format(end, 'MMM d, yyyy')}`, 140, 37);
        doc.text(`Generated on: ${format(new Date(), 'PPP')}`, 140, 42);

        // Table Data
        const tableBody = filteredInvoices.map(inv => {
            const isPaid = inv.paymentStatus === 'paid';
            const date = isPaid && inv.paymentDate ? inv.paymentDate : inv.created_date;
            
            let status = 'Draft';
            if (inv.status === 'pending') status = 'Pending';
            if (inv.status === 'approved') status = 'Open';
            if (inv.status === 'rejected') status = 'Void';
            if (inv.paymentStatus === 'paid') status = 'Paid';

            return [
                format(new Date(date), 'MM/dd/yyyy'),
                inv.fileName || `Invoice #${inv.id.slice(-6)}`,
                inv.businessName || inv.project || 'N/A',
                status,
                inv.paymentReference || '-',
                `$${(inv.totalAmount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
            ];
        });

        const totalBilled = filteredInvoices.reduce((sum, inv) => sum + (inv.totalAmount || 0), 0);
        const totalPaid = filteredInvoices
            .filter(inv => inv.paymentStatus === 'paid')
            .reduce((sum, inv) => sum + (inv.totalAmount || 0), 0);
        const balanceDue = filteredInvoices
            .filter(inv => inv.status === 'approved' && inv.paymentStatus !== 'paid')
            .reduce((sum, inv) => sum + (inv.totalAmount || 0), 0);

        // Add Summary Rows
        // Add a separator row
        tableBody.push([
            { content: '', colSpan: 6, styles: { cellPadding: 1, fillColor: [240, 240, 240] } }
        ]);
        
        // Summary
        tableBody.push([
            '', '', '', '', 
            { content: 'Total Billed:', styles: { fontStyle: 'bold', halign: 'right' } },
            { content: `$${totalBilled.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, styles: { fontStyle: 'bold' } }
        ]);
        tableBody.push([
            '', '', '', '', 
            { content: 'Total Paid:', styles: { fontStyle: 'bold', halign: 'right', textColor: [22, 163, 74] } },
            { content: `$${totalPaid.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, styles: { fontStyle: 'bold', textColor: [22, 163, 74] } }
        ]);
        tableBody.push([
            '', '', '', '', 
            { content: 'Balance Due:', styles: { fontStyle: 'bold', halign: 'right', textColor: [220, 38, 38] } },
            { content: `$${balanceDue.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, styles: { fontStyle: 'bold', textColor: [220, 38, 38] } }
        ]);

        autoTable(doc, {
            head: [['Date', 'Invoice/File', 'Project', 'Status', 'Ref', 'Amount']],
            body: tableBody,
            startY: 55,
            theme: 'striped',
            headStyles: { fillColor: [51, 65, 85] },
            styles: { fontSize: 9, cellPadding: 3 },
            columnStyles: {
                0: { cellWidth: 25 },
                1: { cellWidth: 'auto' },
                2: { cellWidth: 30 },
                3: { cellWidth: 20 },
                4: { cellWidth: 25 },
                5: { cellWidth: 30, halign: 'right' },
            }
        });

        // Add footer
        const pageCount = doc.internal.getNumberOfPages();
        for(let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setTextColor(150);
            doc.text(`Page ${i} of ${pageCount}`, doc.internal.pageSize.width - 20, doc.internal.pageSize.height - 10, { align: 'right' });
            doc.text('M2 Fleet Portal Generated Statement', 14, doc.internal.pageSize.height - 10);
        }

        const pdfBytes = doc.output('arraybuffer');

        const safeName = (contractor.displayName || contractor.full_name || 'Contractor').replace(/\s+/g, '_');
        
        return new Response(pdfBytes, {
            status: 200,
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="Statement_${safeName}.pdf"`
            }
        });

    } catch (error) {
        console.error('Export error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
}
