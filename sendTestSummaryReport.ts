import { supabase } from '../src/lib/supabaseClient';
import { format, startOfWeek, endOfWeek, subWeeks } from 'npm:date-fns@2.30.0';

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(200).end();    
    const user = await base44.auth.me();
    if (!user) {
        return new Response(JSON.stringify({ success: false, error: 'Authentication required' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
    }
    
    try {
        console.log('Sending test summary report for most recent complete work week...');
        
        const [allUsers, allInvoices] = await Promise.all([
            supabase.from('User').select('*'),
            base44.asServiceRole.entities.Invoice.list('-created_date', 1000)
        ]);

        // Calculate the most recent complete Friday-Thursday work week
        const now = new Date();
        const currentWeekStart = startOfWeek(now, { weekStartsOn: 5 }); // Current Friday
        
        // If today is Friday or later in the current week, look at last week
        // Otherwise, look at the week before current
        let reportWeek;
        if (now >= currentWeekStart) {
            // We're in the current work week, so look at the previous complete week
            reportWeek = subWeeks(now, 1);
        } else {
            // This shouldn't happen with weekStartsOn: 5, but just in case
            reportWeek = subWeeks(now, 1);
        }
        
        const reportWeekStart = startOfWeek(reportWeek, { weekStartsOn: 5 }); // Friday
        const reportWeekEnd = endOfWeek(reportWeek, { weekStartsOn: 5 }); // Thursday

        console.log(`Test report for most recent complete work week: ${format(reportWeekStart, 'MMM d, yyyy')} to ${format(reportWeekEnd, 'MMM d, yyyy')}`);

        const submittedInvoices = allInvoices.filter(inv => {
            // Filter by submission date only
            const createdDate = new Date(inv.created_date);
            return createdDate >= reportWeekStart && createdDate <= reportWeekEnd;
        });

        console.log(`Found ${submittedInvoices.length} invoices for test report period.`);

        const activeContractors = allUsers.filter(u => 
            u.active !== false && 
            u.email && 
            (u.email.toLowerCase().includes('.contractor@m2fleetcom.com') || 
             u.email.toLowerCase().includes('.contractor@smcinstallations.com'))
        );

        const submittedEmails = new Set(submittedInvoices.map(inv => inv.contractorEmail.toLowerCase()));
        const missingContractors = activeContractors.filter(c => !submittedEmails.has(c.email.toLowerCase()));

        const pending = submittedInvoices.filter(inv => inv.status === 'pending');
        const approved = submittedInvoices.filter(inv => inv.status === 'approved');
        const autoApproved = approved.filter(inv => inv.autoApproved === true);
        const manuallyApproved = approved.filter(inv => inv.autoApproved !== true);
        
        const totalSubmittedAmount = submittedInvoices.reduce((sum, inv) => sum + (inv.totalAmount || 0), 0);
        const totalApprovedAmount = approved.reduce((sum, inv) => sum + (inv.totalAmount || 0), 0);
        const totalPendingAmount = pending.reduce((sum, inv) => sum + (inv.totalAmount || 0), 0);

        const formatInvoiceList = (invList) => {
            if (invList.length === 0) return '<li style="color: #666;">None</li>';
            const consolidated = invList.reduce((acc, inv) => {
                const email = inv.contractorEmail.toLowerCase();
                if (!acc[email]) acc[email] = { name: inv.contractorName, amount: 0, count: 0 };
                acc[email].amount += (inv.totalAmount || 0);
                acc[email].count += 1;
                return acc;
            }, {});
            return Object.values(consolidated).sort((a, b) => a.name.localeCompare(b.name)).map(item => `<li><strong>${item.name}</strong>: $${item.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${item.count > 1 ? `(${item.count} invoices)` : ''}</li>`).join('');
        };
        
        const formatApprovedInvoiceListWithNotes = (invList) => {
             if (invList.length === 0) return '<li style="color: #666;">None</li>';
            const consolidated = invList.reduce((acc, inv) => {
                const email = inv.contractorEmail.toLowerCase();
                if (!acc[email]) acc[email] = { name: inv.contractorName, amount: 0, count: 0, notes: [] };
                acc[email].amount += (inv.totalAmount || 0);
                acc[email].count += 1;
                if (inv.approvalNotes) acc[email].notes.push(inv.approvalNotes);
                return acc;
            }, {});
            return Object.values(consolidated).sort((a, b) => a.name.localeCompare(b.name)).map(item => {
                const noteHtml = item.notes.length > 0 ? `<div style="margin-left: 20px; margin-top: 5px; padding: 8px; background-color: #e7f3fe; border-left: 3px solid #2196f3; font-size: 14px; color: #333;">Notes: ${item.notes.join('; ')}</div>` : '';
                return `<li><strong>${item.name}</strong>: $${item.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${item.count > 1 ? `(${item.count} invoices)` : ''}${noteHtml}</li>`;
            }).join('');
        };

        const formatMissingList = (userList) => {
            if (userList.length === 0) return '<li style="color: #008000;">All active contractors submitted an invoice!</li>';
            return userList.sort((a,b) => (a.displayName || a.full_name).localeCompare(b.displayName || b.full_name)).map(u => `<li>${u.displayName || u.full_name || u.email}</li>`).join('');
        };

        const emailBody = `
            <div style="font-family: Arial, sans-serif; line-height: 1.6; max-width: 800px; color: #333;">
                 <div style="background-color: #fffbe6; border: 1px solid #ffe58f; padding: 12px 16px; border-radius: 8px; margin-bottom: 20px; text-align: center;">
                    <strong style="color: #d46b08;">This is a TEST of the automated weekly summary report.</strong>
                </div>
                <h2 style="color: #2c5aa0;">Weekly Invoice Summary - ${format(now, 'MMMM d, yyyy')}</h2>
                <p style="color: #666;">Report for invoices <strong>submitted</strong> during <strong>${format(reportWeekStart, 'MMM d, yyyy')}</strong> to <strong>${format(reportWeekEnd, 'MMM d, yyyy')}</strong>.</p>
                
                <div style="background: #f8f9fa; border: 1px solid #dee2e6; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <h3 style="color: #2c5aa0; margin-top: 0; display: flex; align-items: center; gap: 8px;"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20V10M18 20V4M6 20V16"/></svg> Submission Summary</h3>
                    <ul style="padding-left: 20px; margin: 0; list-style-type: disc;">
                        <li><strong>Active Contractors:</strong> ${activeContractors.length}</li>
                        <li><strong>Contractors Who Submitted:</strong> ${submittedEmails.size}</li>
                        <li><strong>Contractors Missing Submission:</strong> ${missingContractors.length}</li>
                        <li><strong>Total Invoices Submitted:</strong> ${submittedInvoices.length}</li>
                        <li><strong>Total Amount Submitted:</strong> $${totalSubmittedAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</li>
                    </ul>
                </div>

                <h3 style="border-bottom: 2px solid #28a745; padding-bottom: 5px; color: #155724; display: flex; align-items: center; gap: 8px;"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> Approved Invoices (${approved.length}) - $${totalApprovedAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h3>
                ${approved.length > 0 ? `
                    <div style="margin-left: 10px;">
                        <h4 style="margin-bottom: 5px; color: #555;">Auto-Approved (${autoApproved.length})</h4>
                        <ul style="padding-left: 20px; margin-top: 0;">${formatInvoiceList(autoApproved)}</ul>
                        <h4 style="margin-bottom: 5px; color: #555;">Manually Approved (${manuallyApproved.length})</h4>
                        <ul style="padding-left: 20px; margin-top: 0;">${formatApprovedInvoiceListWithNotes(manuallyApproved)}</ul>
                    </div>
                ` : `<p style="color: #666; padding-left: 10px;">No invoices submitted in this period were approved.</p>`}

                <h3 style="border-bottom: 2px solid #ffc107; padding-bottom: 5px; color: #856404; display: flex; align-items: center; gap: 8px;"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> Pending Review (${pending.length}) - $${totalPendingAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h3>
                ${pending.length > 0 ? `<ul style="padding-left: 20px;">${formatInvoiceList(pending)}</ul>` : `<p style="color: #666; padding-left: 10px;">No submitted invoices are pending review.</p>`}
                
                <h3 style="border-bottom: 2px solid #dc3545; padding-bottom: 5px; color: #721c24; display: flex; align-items: center; gap: 8px;"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg> Missing Submissions (${missingContractors.length})</h3>
                 ${missingContractors.length > 0 ? `<p style="color: #666; padding-left: 10px;">The following active contractors did not submit an invoice for the work week ending ${format(reportWeekEnd, 'MMM d')}:</p><ul style="padding-left: 20px;">${formatMissingList(missingContractors)}</ul>` : `<p style="color: #155724; font-weight: bold; padding-left: 10px;">Great news! All active contractors submitted an invoice for this period.</p>`}
                
                <hr style="margin: 30px 0; border: none; border-top: 1px solid #ccc;">
                 <p style="color: #6c757d; font-size: 14px;">This is a test report from the M2 Fleet Portal showing the most recent complete work week.</p>
            </div>
        `;

        const managementEmails = ['lena@m2fleetcom.com'];
        if (user.email && !managementEmails.includes(user.email)) {
            managementEmails.push(user.email);
        }
        
        for (const email of managementEmails) {
            await base44.integrations.Core.SendEmail({ 
                to: email, 
                subject: `[TEST] Weekly Invoice Summary: ${format(reportWeekStart, 'MMM d')} - ${format(reportWeekEnd, 'MMM d')}`,
                body: emailBody, 
                from_name: 'M2 Fleet Portal' 
            });
        }
        
        return new Response(JSON.stringify({ 
            success: true, 
            message: `Test report sent for most recent complete work week: ${format(reportWeekStart, 'MMM d')} - ${format(reportWeekEnd, 'MMM d')}. Found ${submittedInvoices.length} invoices.`
        }), { 
            status: 200, 
            headers: { 'Content-Type': 'application/json' } 
        });

    } catch (error) {
        console.error('Error in test summary report:', error);
        return new Response(JSON.stringify({ success: false, error: error.message }), { 
            status: 500, 
            headers: { 'Content-Type': 'application/json' } 
        });
    }
}
