import { supabase, getAuthUser } from './_lib/supabaseServer.js';
import { XMLParser } from 'fast-xml-parser';

const parser = new XMLParser();

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

    // Using server-side supabase client instead
    try {
        const text = await req.text();
        const jsonObj = parser.parse(text);
        
        const envelopeStatus = jsonObj.DocuSignEnvelopeInformation.EnvelopeStatus;
        const envelopeId = envelopeStatus.EnvelopeID;
        const status = envelopeStatus.Status.toLowerCase();

        console.log(`Webhook received for Envelope ${envelopeId}, Status: ${status}`);

        const envelopes = await supabase.from('DocusignEnvelope').select('*').match({ docusignEnvelopeId: envelopeId }).then(r => r.data || []);
        if (envelopes.length > 0) {
            const ourEnvelope = envelopes[0];
            const updatePayload = { status: status };

            if (status === 'completed') {
                updatePayload.completedDate = new Date().toISOString();
            }

            await supabase.from('DocusignEnvelope').update(updatePayload).eq('id', ourEnvelope.id);
            console.log(`Updated envelope ${ourEnvelope.id} to status ${status}.`);
        } else {
            console.warn(`Received webhook for unknown envelope ID: ${envelopeId}`);
        }
        
        // Respond to DocuSign to acknowledge receipt
        return res.status(200).send(null);

    } catch (error) {
        console.error('Error processing DocuSign webhook:', error);
        return res.status(500).json({ error: error.message });
    }
}
