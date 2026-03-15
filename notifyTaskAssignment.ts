import { supabase } from '../src/lib/supabaseClient';

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(200).end();

  try {    
    // Process payload from entity automation
    const payload = req.body;
    const { event, data } = payload;
    
    // Only proceed for new assignments on create or update
    if (event.type !== 'create' && event.type !== 'update') {
      return Response.json({ status: 'ignored', reason: 'Not a create/update event' });
    }

    let taskData = data;
    if (payload.payload_too_large) {
      taskData = await supabase.from('ChannelTask').select('*').eq('id', event.entity_id).single();
    }
    
    if (!taskData || !taskData.assignedToEmail) {
      return Response.json({ status: 'ignored', reason: 'No assignee' });
    }

    // Determine the context (Channel vs DM) to include in the email
    let contextName = "a conversation";
    if (taskData.channelId) {
      const channel = await supabase.from('Channel').select('*').eq('id', taskData.channelId).single();
      if (channel) contextName = `channel #${channel.name}`;
    }

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>New Task Assigned: ${taskData.title}</h2>
        <p>You have been assigned a new task in ${contextName} by ${taskData.createdByEmail}.</p>
        
        <div style="background-color: #f3f4f6; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <strong>Task:</strong> ${taskData.title}<br/>
          ${taskData.dueDate ? `<strong>Due Date:</strong> ${new Date(taskData.dueDate).toLocaleDateString()}<br/>` : ''}
          <strong>Status:</strong> ${taskData.status.replace('_', ' ')}
        </div>
        
        <p>Log in to your team dashboard to view and update this task.</p>
      </div>
    `;

    await /* TODO: Setup Resend */ resend.emails.send({
      to: taskData.assignedToEmail,
      subject: `New Task Assigned: ${taskData.title}`,
      body: emailHtml,
    });

    return Response.json({ success: true, emailed: taskData.assignedToEmail });
  } catch (error) {
    console.error('Error sending task notification:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
