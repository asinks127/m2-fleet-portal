import { supabase, getAuthUser } from './_lib/supabaseServer.js';

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

    try {        const user = await getAuthUser(req);
        
        if (!user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const payload = req.body;
        const { channelId, dmThreadId } = payload;

        if (channelId) {
            const channel = await supabase.from('Channel').select('*').eq('id', channelId).single();
            if (!channel) return res.status(200).json({ messages: [] });
            
            if (channel.type !== 'public') {
                const memberships = await supabase.from('ChannelMember').select('*').match({
                    channelId,
                    userEmail: user.email
                }).then(r => r.data || []);
                if (memberships.length === 0) {
                    return res.status(403).json({ error: 'Forbidden: Not a member of this private channel' });
                }
            }
            
            const messages = await supabase.from('ChatMessage').select('*').match({ channelId }, '-created_date', 100).then(r => r.data || []);
            return res.status(200).json({ messages: messages.reverse() });
        } 
        
        if (dmThreadId) {
            const thread = await supabase.from('DirectMessageThread').select('*').eq('id', dmThreadId).single();
            if (!thread) return res.status(200).json({ messages: [] });
            
            if (!thread.participantEmails.includes(user.email)) {
                return res.status(403).json({ error: 'Forbidden: Not a participant in this DM thread' });
            }
            
            const messages = await supabase.from('ChatMessage').select('*').match({ dmThreadId }, '-created_date', 100).then(r => r.data || []);
            return res.status(200).json({ messages: messages.reverse() });
        }

        return res.status(200).json({ messages: [] });
    } catch (error) {
        return res.status(500).json({ error: "An unexpected error occurred. Please try again later." });
    }
}
