import { supabase } from '../src/lib/supabaseClient';
import { XMLParser } from 'npm:fast-xml-parser@4.3.2';

const parser = new XMLParser();

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(200).end();

    const base44 = createClientFromRequest(req, true); // Use service role for webhooks
    try {
        const text = await req.text();
        const jsonObj = parser.parse(text);
        
        const envelopeStatus = jsonObj.DocuSignEnvelopeInformation.EnvelopeStatus;
        const envelopeId = envelopeStatus.EnvelopeID;
        const status = envelopeStatus.Status.toLowerCase();

        console.log(`Webhook received for Envelope ${envelopeId}, Status: ${status}`);

        const envelopes = await base44.asServiceRole.entities.DocusignEnvelope.filter({ docusignEnvelopeId: envelopeId });
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
