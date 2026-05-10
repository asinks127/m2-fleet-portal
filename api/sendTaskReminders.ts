import { supabase } from '../src/lib/supabaseClient';

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(200).end();

  try {    
    // Use service role since this is a scheduled task running without a user context
    const tasks = await base44.asServiceRole.entities.ChannelTask.filter({
      status: { "$ne": "completed" },
      dueDate: { "$exists": true, "$ne": null }
    });
    
    let emailsSent = 0;
    const now = new Date();

    for (const task of tasks) {
      if (!task.assignedToEmail) continue;

      const dueDate = new Date(task.dueDate);
      
      // Calculate days difference
      const timeDiff = dueDate.getTime() - now.getTime();
      const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));
      
      // We want to send a reminder if the task is overdue, OR if it's due soon.
      // Since the prompt asks for "reminder every 48 hours", we'll implement a simple 
      // logic that checks if we are within certain 2-day windows or overdue.
      // Easiest approach for a daily cron: send if overdue, or if daysDiff is even and < 7.
      // A more robust way is to just send if overdue or due in <= 2 days. 
      // Let's send if: Overdue (daysDiff < 0) OR Due in exactly 2 days OR Due Today (daysDiff === 0)
      
      const shouldRemind = daysDiff < 0 || daysDiff === 2 || daysDiff === 0;

      if (shouldRemind) {
        let statusText = daysDiff < 0 ? "OVERDUE" : `Due in ${daysDiff} day(s)`;
        if (daysDiff === 0) statusText = "DUE TODAY";

        const emailHtml = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
            <div style="background-color: ${daysDiff < 0 ? '#ef4444' : '#f59e0b'}; color: white; padding: 15px; text-align: center;">
              <h2 style="margin: 0;">Task Reminder: ${statusText}</h2>
            </div>
            <div style="padding: 20px;">
              <p>Hi ${task.assignedToName || 'Team Member'},</p>
              <p>This is a reminder regarding your assigned task:</p>
              
              <div style="background-color: #f9fafb; padding: 15px; border-radius: 5px; margin: 15px 0;">
                <h3 style="margin-top: 0;">${task.title}</h3>
                <p style="margin-bottom: 0;"><strong>Due Date:</strong> ${dueDate.toLocaleDateString()}</p>
                <p style="margin-bottom: 0;"><strong>Current Status:</strong> ${task.status.replace('_', ' ')}</p>
              </div>
              
              <p>Please log in to update the status of this task once complete.</p>
            </div>
          </div>
        `;

        await /* TODO: Setup Resend */ resend.emails.send({
          to: task.assignedToEmail,
          subject: `Task Reminder: ${task.title} is ${statusText}`,
          body: emailHtml,
        });
        
        emailsSent++;
      }
    }

    return Response.json({ success: true, processedTasks: tasks.length, emailsSent });
  } catch (error) {
    console.error('Error processing task reminders:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
