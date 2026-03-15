import { supabase } from '../src/lib/supabaseClient';
import { startOfWeek, endOfWeek } from 'npm:date-fns@2.30.0';

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(200).end();    
    try {
        // This function is called automatically.
        console.log('Starting weekly reminder check...');
        
        // Define the work week as Monday to Sunday
        const now = new Date();
        const weekStartsOn = 1; // Monday
        const weekStart = startOfWeek(now, { weekStartsOn });
        const weekEnd = endOfWeek(now, { weekStartsOn });

        // Get all active contractors
        const allUsers = await supabase.from('User').select('*');
        const activeContractors = allUsers.filter(user => 
            user.active !== false && 
            user.email && 
            (user.email.toLowerCase().includes('.contractor@m2fleetcom.com') || 
             user.email.toLowerCase().includes('.contractor@smcinstallations.com'))
        );

        // Get invoices for the current work period based on weekEndingDate
        const invoicesForPeriod = await base44.asServiceRole.entities.Invoice.filter({
            weekEndingDate: { 
                $gte: weekStart.toISOString().split('T')[0],
                $lte: weekEnd.toISOString().split('T')[0]
            }
        });

        // Find contractors who haven't submitted invoices for this period
        const submittedEmails = new Set(invoicesForPeriod.map(inv => inv.contractorEmail?.toLowerCase().trim()).filter(Boolean));
        const contractorsToRemind = activeContractors.filter(
            contractor => {
                const email = contractor.email?.toLowerCase().trim();
                return email && !submittedEmails.has(email);
            }
        );

        if (contractorsToRemind.length === 0) {
            console.log('All contractors have submitted their invoices for this work week.');
            return new Response(JSON.stringify({ 
                success: true, 
                message: 'All contractors have submitted invoices for this work period.' 
            }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // --- AUTOMATED REMINDERS DISABLED BY ADMIN REQUEST ---
        // The following code for sending emails has been temporarily commented out.
        // To re-enable, uncomment the section below.
        
        /*
        // Send reminder emails
        const emailPromises = contractorsToRemind.map(contractor => {
            const emailBody = `
                <p>Hi ${contractor.displayName || contractor.full_name || contractor.email},</p>
                <p>This is a friendly reminder that your weekly invoice for the work period ending ${weekEnd.toLocaleDateString()} is due for submission.</p>
                <p>If you have already submitted it, please ensure the "Week Ending Date" on the invoice is correct. If not, please submit it through the M2 Fleet Portal as soon as possible.</p>
                <p>Thank you,</p>
                <p>M2 Fleet Management</p>
            `;
            
            return /* TODO: Setup Resend */ resend.emails.send({
                to: contractor.email,
                subject: `Reminder: Invoice for week ending ${weekEnd.toLocaleDateString()}`,
                body: emailBody,
                from_name: 'M2 Fleet Portal'
            });
        });

        await Promise.all(emailPromises);

        console.log(`Successfully sent reminders to ${contractorsToRemind.length} contractors`);
        */
       
        console.log(`AUTOMATED REMINDERS DISABLED. Found ${contractorsToRemind.length} contractors to remind, but no emails were sent.`);

        return new Response(JSON.stringify({ 
            success: true, 
            message: 'Automated reminders are currently disabled. No emails were sent.',
            remindersSent: 0,
            contractorsFound: contractorsToRemind.length
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('Error in weekly reminder scheduler:', error);
        return new Response(JSON.stringify({ 
            success: false, 
            error: error.message 
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
