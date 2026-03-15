import { supabase } from '../src/lib/supabaseClient';
import { format, startOfWeek, endOfWeek, subWeeks, addDays } from 'npm:date-fns@2.30.0';

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(200).end();    
    try {
        console.log('Starting automated weekly invoice compliance report...');
        
        const [allUsers, allInvoices] = await Promise.all([
            supabase.from('User').select('*'),
            base44.asServiceRole.entities.Invoice.list('-created_date', 1000)
        ]);
        
        // Define compliance period: Wednesday through Sunday at 11:59 PM
        const now = new Date();
        const currentWeekStart = startOfWeek(now, { weekStartsOn: 1 }); // Monday
        
        // Compliance starts Wednesday at midnight
        const complianceStart = addDays(currentWeekStart, 2); // Wednesday
        complianceStart.setHours(0, 0, 0, 0);
        
        // Compliance ends Sunday at 11:59:59 PM
        const complianceEnd = endOfWeek(now, { weekStartsOn: 1 }); // Sunday
        complianceEnd.setHours(23, 59, 59, 999);

        console.log(`Compliance period: ${format(complianceStart, 'MMM d, yyyy HH:mm')} to ${format(complianceEnd, 'MMM d, yyyy HH:mm')}`);

        // Get all active contractors
        const activeContractors = allUsers.filter(user => 
            user.active !== false && 
            user.email && 
            (user.email.toLowerCase().includes('.contractor@m2fleetcom.com') || 
             user.email.toLowerCase().includes('.contractor@smcinstallations.com'))
        );

        // Get invoices submitted during compliance period (Wednesday-Sunday)
        const submittedInvoices = allInvoices.filter(inv => {
            if (!inv.created_date) return false;
            // Only include approved or pending invoices
            if (inv.status !== 'approved' && inv.status !== 'pending') return false;
            
            try {
                const createdDate = new Date(inv.created_date);
                if (isNaN(createdDate.getTime())) return false;
                // Check if submitted during compliance window
                return createdDate >= complianceStart && createdDate <= complianceEnd;
            } catch (error) {
                console.error("Error parsing created_date for invoice:", inv.id, error);
                return false;
            }
        });

        console.log(`Found ${submittedInvoices.length} approved/pending invoices submitted during compliance period.`);

        // Remove duplicates - keep only the most recent invoice per contractor
        const invoicesByContractor = new Map();
        submittedInvoices.forEach(inv => {
            const email = inv.contractorEmail?.toLowerCase().trim();
            if (!email) return;
            
            const existing = invoicesByContractor.get(email);
            if (!existing || new Date(inv.created_date) > new Date(existing.created_date)) {
                invoicesByContractor.set(email, inv);
            }
        });

        const uniqueInvoices = Array.from(invoicesByContractor.values());
        console.log(`After removing duplicates: ${uniqueInvoices.length} unique contractor submissions.`);

        const submittedEmails = new Set(uniqueInvoices.map(inv => inv.contractorEmail?.toLowerCase().trim()).filter(Boolean));
        
        const missingContractors = activeContractors.filter(contractor => {
            const email = contractor.email?.toLowerCase().trim();
            return email && !submittedEmails.has(email);
        });

        console.log(`Found ${missingContractors.length} contractors who didn't submit for this work period.`);

        const pending = uniqueInvoices.filter(inv => inv.status === 'pending');
        const approved = uniqueInvoices.filter(inv => inv.status === 'approved');
        const autoApproved = approved.filter(inv => inv.autoApproved === true);
        const manuallyApproved = approved.filter(inv => inv.autoApproved !== true);
        
        const totalSubmittedAmount = uniqueInvoices.reduce((sum, inv) => sum + (inv.totalAmount || 0), 0);
        const totalApprovedAmount = approved.reduce((sum, inv) => sum + (inv.totalAmount || 0), 0);
        const totalPendingAmount = pending.reduce((sum, inv) => sum + (inv.totalAmount || 0), 0);

        const formatInvoiceList = (invList) => {
            if (invList.length === 0) return '<li style="color: #666;">None</li>';
            return invList.sort((a, b) => (a.contractorName || '').localeCompare(b.contractorName || '')).map(inv => 
                `<li><strong>${inv.contractorName}</strong>: $${(inv.totalAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</li>`
            ).join('');
        };
        
        const formatApprovedInvoiceListWithNotes = (invList) => {
            if (invList.length === 0) return '<li style="color: #666;">None</li>';
            return invList.sort((a, b) => (a.contractorName || '').localeCompare(b.contractorName || '')).map(inv => {
                const contractor = activeContractors.find(c => c.email?.toLowerCase().trim() === inv.contractorEmail?.toLowerCase().trim());
                const expectedWeeklyPay = contractor?.weeklyPay;
                
                let itemHtml = `<strong>${inv.contractorName}</strong>: $${(inv.totalAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                
                if (expectedWeeklyPay) {
                    const difference = (inv.totalAmount || 0) - expectedWeeklyPay;
                    const diffColor = difference >= 0 ? '#28a745' : '#dc3545';
                    itemHtml += ` <span style="color: #666; font-size: 14px;">[Expected: $${expectedWeeklyPay.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}, Difference: <span style="color: ${diffColor};">${difference >= 0 ? '+' : ''}$${difference.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>]</span>`;
                }
                
                const notes = [];
                if (inv.approvalNotes) notes.push(`Approval: ${inv.approvalNotes}`);
                if (inv.surveyNotes) notes.push(`Survey: ${inv.surveyNotes}`);
                if (inv.notes) notes.push(`Contractor: ${inv.notes}`);
                
                if (notes.length > 0) {
                    const noteHtml = `<div style="margin-left: 20px; margin-top: 5px; padding: 8px; background-color: #e7f3fe; border-left: 3px solid #2196f3; font-size: 14px; color: #333;"><strong>Notes:</strong> ${notes.join('; ')}</div>`;
                    itemHtml += noteHtml;
                }
                
                return `<li style="margin-bottom: 10px;">${itemHtml}</li>`;
            }).join('');
        };

        const formatMissingList = (userList) => {
            if (userList.length === 0) return '<li style="color: #008000; font-weight: bold;">🎉 All active contractors submitted an invoice!</li>';
            return userList.sort((a,b) => (a.displayName || a.full_name || '').localeCompare(b.displayName || b.full_name || '')).map(u => 
                `<li><strong>${u.displayName || u.full_name || u.email}</strong> (${u.project || 'No project'}) - QC: ${u.qcAssignment || 'Unassigned'}</li>`
            ).join('');
        };

        const emailBody = `
            <div style="font-family: Arial, sans-serif; line-height: 1.6; max-width: 800px; color: #333;">
                <h2 style="color: #2c5aa0; border-bottom: 2px solid #2c5aa0; padding-bottom: 10px;">Weekly Invoice Compliance Report</h2>
                <p style="color: #666; font-size: 16px; margin-bottom: 20px;">
                    Compliance Period (Wednesday - Sunday): <strong>${format(complianceStart, 'MMM d, yyyy')} - ${format(complianceEnd, 'MMM d, yyyy')}</strong>
                </p>
                <p style="color: #666; font-size: 14px;">Generated automatically on ${format(now, 'MMMM d, yyyy')} at ${format(now, 'h:mm a')}</p>
                
                <div style="background: #e3f2fd; border-left: 4px solid #2196f3; padding: 12px; margin: 20px 0;">
                    <p style="margin: 0; color: #1565c0; font-size: 14px;">
                        💡 <strong>Note:</strong> This report shows only the most recent invoice per contractor. Duplicates are automatically filtered out, and only approved/pending invoices are counted.
                    </p>
                </div>

                <div style="background: #f8f9fa; border: 1px solid #dee2e6; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <h3 style="color: #2c5aa0; margin-top: 0; display: flex; align-items: center; gap: 8px;">
                        📊 Summary Overview
                    </h3>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 15px;">
                        <div>
                            <p style="margin: 5px 0;"><strong>Active Contractors:</strong> ${activeContractors.length}</p>
                            <p style="margin: 5px 0;"><strong>Contractors Submitted:</strong> ${submittedEmails.size}</p>
                            <p style="margin: 5px 0;"><strong>Contractors Missing:</strong> ${missingContractors.length}</p>
                        </div>
                        <div>
                            <p style="margin: 5px 0;"><strong>Total Amount:</strong> $${totalSubmittedAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                            <p style="margin: 5px 0;"><strong>Compliance Rate:</strong> ${Math.round((submittedEmails.size / activeContractors.length) * 100)}%</p>
                        </div>
                    </div>
                </div>

                <h3 style="border-bottom: 2px solid #28a745; padding-bottom: 5px; color: #155724; display: flex; align-items: center; gap: 8px;">
                    ✅ Approved Invoices (${approved.length}) - $${totalApprovedAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </h3>
                ${approved.length > 0 ? `
                    <div style="margin-left: 10px;">
                        <h4 style="margin-bottom: 5px; color: #555;">🤖 Auto-Approved (${autoApproved.length})</h4>
                        <ul style="padding-left: 20px; margin-top: 0;">${formatInvoiceList(autoApproved)}</ul>
                        <h4 style="margin-bottom: 5px; color: #555; margin-top: 20px;">👤 Manually Approved (${manuallyApproved.length})</h4>
                        <ul style="padding-left: 20px; margin-top: 0;">${formatApprovedInvoiceListWithNotes(manuallyApproved)}</ul>
                    </div>
                ` : `<p style="color: #666; padding-left: 10px;">No invoices were approved for this work period.</p>`}

                <h3 style="border-bottom: 2px solid #ffc107; padding-bottom: 5px; color: #856404; display: flex; align-items: center; gap: 8px; margin-top: 30px;">
                    ⏳ Pending Review (${pending.length}) - $${totalPendingAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </h3>
                ${pending.length > 0 ? `<ul style="padding-left: 20px;">${formatInvoiceList(pending)}</ul>` : `<p style="color: #666; padding-left: 10px;">No invoices are pending review.</p>`}
                
                <h3 style="border-bottom: 2px solid #dc3545; padding-bottom: 5px; color: #721c24; display: flex; align-items: center; gap: 8px; margin-top: 30px;">
                    ❌ Missing Submissions (${missingContractors.length})
                </h3>
                ${missingContractors.length > 0 ? 
                    `<p style="color: #666; padding-left: 10px;">The following active contractors did not submit an invoice for the work week ending ${format(complianceEnd, 'MMM d')}:</p><ul style="padding-left: 20px;">${formatMissingList(missingContractors)}</ul>` : 
                    `<p style="color: #155724; font-weight: bold; padding-left: 10px; font-size: 16px;">🎉 Excellent! All active contractors submitted their invoices for this work period.</p>`
                }
                
                <hr style="margin: 40px 0; border: none; border-top: 2px solid #ccc;">
                <div style="background: #f8f9fa; padding: 15px; border-radius: 8px;">
                    <p style="color: #6c757d; font-size: 14px; margin: 0;">
                        📧 This automated report is sent every Monday morning from the M2 Fleet Portal.<br>
                        🕐 Generated: ${format(now, 'EEEE, MMMM d, yyyy')} at ${format(now, 'h:mm a')}<br>
                        📊 For questions about this report, contact the M2 Fleet Portal administrator.
                    </p>
                </div>
            </div>
        `;

        console.log('Attempting to send automated compliance report...');

        // Send to both Lena and Erica
        const managementEmails = ['lena@m2fleetcom.com', 'erica@m2fleetcom.com'];
        let emailsSent = 0;
        let emailErrors = [];

        for (const email of managementEmails) {
            try {
                await /* TODO: Setup Resend */ resend.emails.send({
                    to: email,
                    subject: `Weekly Invoice Compliance Report: ${format(complianceStart, 'MMM d')} - ${format(complianceEnd, 'MMM d')} (${submittedEmails.size}/${activeContractors.length} submitted)`,
                    body: emailBody,
                    from_name: 'M2 Fleet Portal - Automated Reports'
                });
                console.log(`✅ Compliance report sent successfully to: ${email}`);
                emailsSent++;
            } catch (emailError) {
                console.error(`❌ Failed to send report to ${email}:`, emailError);
                emailErrors.push({ email, error: emailError.message });
            }
        }
        
        console.log(`✅ Automated compliance report completed: ${emailsSent}/${managementEmails.length} emails sent`);
        
        return new Response(JSON.stringify({ 
            success: true,
            emailsSent,
            totalEmails: managementEmails.length,
            errors: emailErrors,
            stats: {
                activeContractors: activeContractors.length,
                submitted: submittedEmails.size,
                missing: missingContractors.length,
                totalAmount: totalSubmittedAmount,
                complianceRate: Math.round((submittedEmails.size / activeContractors.length) * 100)
            }
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('❌ Error in automated weekly compliance report:', error);
        
        // Try to send failure notification
        try {
            await /* TODO: Setup Resend */ resend.emails.send({
                to: 'lena@m2fleetcom.com',
                subject: 'ACTION REQUIRED: Weekly Invoice Compliance Report Failed',
                body: `<div style="font-family: Arial, sans-serif;">
                    <h2 style="color: #dc3545;">⚠️ Automated Report Failure</h2>
                    <p>The automated weekly invoice compliance report failed to generate.</p>
                    <p><strong>Error Details:</strong> ${error.message}</p>
                    <p><strong>Time:</strong> ${new Date().toISOString()}</p>
                    <p>Please check the system logs and contact technical support if needed.</p>
                </div>`,
                from_name: 'M2 Fleet Portal Alert System'
            });
        } catch (sendError) {
            console.error('Failed to send failure notification email:', sendError);
        }

        return new Response(JSON.stringify({ 
            success: false, 
            error: error.message,
            timestamp: new Date().toISOString()
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
