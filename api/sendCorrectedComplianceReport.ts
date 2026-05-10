import { supabase } from '../src/lib/supabaseClient';

import { Resend } from 'npm:resend@3.2.0';
import { startOfWeek, endOfWeek, format, subWeeks, addDays } from 'npm:date-fns@2.30.0';
import { toZonedTime } from 'npm:date-fns-tz@1.3.8';

const resend = new Resend(Deno.env.get('RESEND_API_KEY'));
const CENTRAL_TZ = 'America/Chicago';

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(200).end();
    try {
        const user = await base44.auth.me();
        if (!user) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), {
                status: 401,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Calculate last week's compliance period in Central Time
        const today = new Date();
        const lastWeekReference = subWeeks(today, 1);
        
        const mondayOfWeek = startOfWeek(toZonedTime(lastWeekReference, CENTRAL_TZ), { weekStartsOn: 1 });
        
        // Compliance starts Wednesday at midnight Central
        const complianceStart = addDays(mondayOfWeek, 2);
        complianceStart.setHours(0, 0, 0, 0);
        
        // Compliance ends Sunday at 11:59:59 PM Central
        const complianceEnd = endOfWeek(toZonedTime(lastWeekReference, CENTRAL_TZ), { weekStartsOn: 1 });
        complianceEnd.setHours(23, 59, 59, 999);

        const weekLabel = `${format(mondayOfWeek, 'MMM d')} - ${format(complianceEnd, 'MMM d, yyyy')}`;

        // Load data using service role
        const [allInvoices, allUsers] = await Promise.all([
            base44.asServiceRole.entities.Invoice.list('-created_date', 2000),
            supabase.from('User').select('*')
        ]);

        // Get active contractors
        const activeContractors = allUsers.filter(u =>
            u.active !== false &&
            u.email &&
            (u.email.toLowerCase().includes('.contractor@m2fleetcom.com') ||
             u.email.toLowerCase().includes('.contractor@smcinstallations.com'))
        );

        // Find submitted invoices with Central Time conversion
        const submittedInvoices = [];
        const submittedEmails = new Set();

        allInvoices.forEach(inv => {
            if (!inv.created_date || !inv.contractorEmail) return;
            
            try {
                const submittedUTC = new Date(inv.created_date);
                const submittedCentral = toZonedTime(submittedUTC, CENTRAL_TZ);
                
                if (submittedCentral >= complianceStart && submittedCentral <= complianceEnd) {
                    submittedInvoices.push({
                        ...inv,
                        submittedCentral: format(submittedCentral, 'MMM d, yyyy h:mm a')
                    });
                    submittedEmails.add(inv.contractorEmail.toLowerCase());
                }
            } catch (error) {
                console.error('Error processing invoice:', error);
            }
        });

        // Categorize contractors
        const compliant = [];
        const nonCompliant = [];

        activeContractors.forEach(contractor => {
            const data = {
                name: contractor.displayName || contractor.full_name || contractor.email,
                email: contractor.email,
                business: contractor.business || 'N/A',
                project: contractor.project || 'N/A'
            };

            if (submittedEmails.has(contractor.email.toLowerCase())) {
                const invoice = submittedInvoices.find(inv => 
                    inv.contractorEmail.toLowerCase() === contractor.email.toLowerCase()
                );
                compliant.push({
                    ...data,
                    submittedAt: invoice?.submittedCentral || 'N/A'
                });
            } else {
                nonCompliant.push(data);
            }
        });

        // Generate HTML email
        const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; }
        .content { padding: 30px; max-width: 800px; margin: 0 auto; }
        .alert-box { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; }
        .stats { display: flex; justify-content: space-around; margin: 30px 0; }
        .stat-card { text-align: center; padding: 20px; background: #f8f9fa; border-radius: 8px; }
        .stat-number { font-size: 36px; font-weight: bold; color: #667eea; }
        .stat-label { color: #6c757d; margin-top: 5px; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th { background: #667eea; color: white; padding: 12px; text-align: left; }
        td { padding: 12px; border-bottom: 1px solid #ddd; }
        tr:hover { background: #f8f9fa; }
        .compliant { color: #28a745; font-weight: bold; }
        .non-compliant { color: #dc3545; font-weight: bold; }
        .footer { text-align: center; padding: 20px; color: #6c757d; font-size: 12px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🔄 Corrected Invoice Compliance Report</h1>
        <p>Week of ${weekLabel} (Central Time)</p>
    </div>
    
    <div class="content">
        <div class="alert-box">
            <strong>⚠️ Timezone Correction Applied</strong><br>
            This report reflects the corrected compliance data using Central Time (America/Chicago) as the authoritative timezone. 
            All submission deadlines are enforced as <strong>Sunday 11:59 PM Central Time</strong>.
        </div>

        <div class="stats">
            <div class="stat-card">
                <div class="stat-number">${activeContractors.length}</div>
                <div class="stat-label">Total Active</div>
            </div>
            <div class="stat-card">
                <div class="stat-number compliant">${compliant.length}</div>
                <div class="stat-label">Compliant</div>
            </div>
            <div class="stat-card">
                <div class="stat-number non-compliant">${nonCompliant.length}</div>
                <div class="stat-label">Non-Compliant</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${Math.round((compliant.length / activeContractors.length) * 100)}%</div>
                <div class="stat-label">Compliance Rate</div>
            </div>
        </div>

        ${compliant.length > 0 ? `
        <h2 style="color: #28a745;">✅ Compliant Contractors (${compliant.length})</h2>
        <table>
            <thead>
                <tr>
                    <th>Name</th>
                    <th>Business</th>
                    <th>Project</th>
                    <th>Submitted (Central Time)</th>
                </tr>
            </thead>
            <tbody>
                ${compliant.map(c => `
                    <tr>
                        <td>${c.name}</td>
                        <td>${c.business}</td>
                        <td>${c.project}</td>
                        <td>${c.submittedAt}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
        ` : ''}

        ${nonCompliant.length > 0 ? `
        <h2 style="color: #dc3545;">❌ Non-Compliant Contractors (${nonCompliant.length})</h2>
        <table>
            <thead>
                <tr>
                    <th>Name</th>
                    <th>Business</th>
                    <th>Project</th>
                    <th>Email</th>
                </tr>
            </thead>
            <tbody>
                ${nonCompliant.map(c => `
                    <tr>
                        <td>${c.name}</td>
                        <td>${c.business}</td>
                        <td>${c.project}</td>
                        <td>${c.email}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
        ` : '<p style="color: #28a745; font-weight: bold;">🎉 All contractors were compliant this week!</p>'}

        <div class="alert-box" style="background: #d1ecf1; border-left-color: #0c5460;">
            <strong>📋 Summary</strong><br>
            This corrected report uses Central Standard Time for all deadline enforcement. 
            Any previous reports that incorrectly flagged contractors due to timezone conversion issues have been corrected here.
        </div>
    </div>

    <div class="footer">
        <p>M2 Fleet Communications Portal - Automated Compliance Reporting</p>
        <p>Report generated: ${format(new Date(), 'MMM d, yyyy h:mm a')} Central Time</p>
    </div>
</body>
</html>
        `;

        // Send email to management
        const managementEmails = [
            'lena@m2fleetcom.com',
            'orville@m2fleetcom.com',
            'steve@m2fleetcom.com',
            'austin@m2fleetcom.com'
        ];

        await resend.emails.send({
            from: 'M2 Fleet Portal <notifications@m2fleetcom.com>',
            to: managementEmails,
            subject: `🔄 Corrected Invoice Compliance Report - ${weekLabel}`,
            html: htmlContent,
        });

        return new Response(JSON.stringify({ 
            success: true, 
            compliant: compliant.length,
            nonCompliant: nonCompliant.length,
            total: activeContractors.length
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('Error sending corrected compliance report:', error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
