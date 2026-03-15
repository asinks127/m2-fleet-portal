import { supabase } from '../src/lib/supabaseClient';

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(200).end();

    try {        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const payload = req.body;
        const { channelId, dmThreadId } = payload;

        if (channelId) {
            const channel = await supabase.from('Channel').select('*').eq('id', channelId).single();
            if (!channel) return Response.json({ messages: [] });
            
            if (channel.type !== 'public') {
                const memberships = await base44.asServiceRole.entities.ChannelMember.filter({
                    channelId,
                    userEmail: user.email
                });
                if (memberships.length === 0) {
                    return Response.json({ error: 'Forbidden: Not a member of this private channel' }, { status: 403 });
                }
            }
            
            const messages = await base44.asServiceRole.entities.ChatMessage.filter({ channelId }, '-created_date', 100);
            return Response.json({ messages: messages.reverse() });
        } 
        
        if (dmThreadId) {
            const thread = await supabase.from('DirectMessageThread').select('*').eq('id', dmThreadId).single();
            if (!thread) return Response.json({ messages: [] });
            
            if (!thread.participantEmails.includes(user.email)) {
                return Response.json({ error: 'Forbidden: Not a participant in this DM thread' }, { status: 403 });
            }
            
            const messages = await base44.asServiceRole.entities.ChatMessage.filter({ dmThreadId }, '-created_date', 100);
            return Response.json({ messages: messages.reverse() });
        }

        return Response.json({ messages: [] });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
}
