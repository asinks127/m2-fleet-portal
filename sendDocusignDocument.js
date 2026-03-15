import { supabase, getAuthUser } from './_lib/supabaseServer.js';
import docusign from 'docusign-esign';

const DOCUSIGN_INTEGRATION_KEY = process.env.DOCUSIGN_INTEGRATION_KEY;
const DOCUSIGN_USER_ID = process.env.DOCUSIGN_USER_ID;
const DOCUSIGN_ACCOUNT_ID = process.env.DOCUSIGN_ACCOUNT_ID;
const DOCUSIGN_SERVER = docusign.ApiClient.RestApi.BasePath.PRODUCTION;

async function getApiClient() {
    const apiClient = new docusign.ApiClient();
    apiClient.setBasePath(DOCUSIGN_SERVER);

    let privateKey = process.env.DOCUSIGN_PRIVATE_KEY;
    if (!privateKey) {
        throw new Error("DOCUSIGN_PRIVATE_KEY secret is not set in your app's settings.");
    }
    
    privateKey = privateKey.replace(/\\n/g, '\n').trim();
    if (!privateKey.startsWith('-----BEGIN RSA PRIVATE KEY-----')) {
        privateKey = '-----BEGIN RSA PRIVATE KEY-----\n' + privateKey;
    }
    if (!privateKey.endsWith('-----END RSA PRIVATE KEY-----')) {
        privateKey = privateKey + '\n-----END RSA PRIVATE KEY-----';
    }

    const results = await apiClient.requestJWTUserToken(
        DOCUSIGN_INTEGRATION_KEY,
        DOCUSIGN_USER_ID,
        ['signature', 'impersonation'],
        privateKey,
        3600
    );

    apiClient.addDefaultHeader('Authorization', 'Bearer ' + results.body.access_token);
    return apiClient;
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });    
    try {
        const { templateId, recipientEmail, recipientName } = req.body;
        const user = await getAuthUser(req);
        if (!adminUser) throw new Error("Authentication required.");

        const appTemplate = await supabase.from('DocusignTemplate').select('*').eq('id', templateId).single();
        if (!appTemplate || !appTemplate.docusignTemplateId) {
            throw new Error("App template not found or missing DocuSign Template ID.");
        }

        const apiClient = await getApiClient();
        const envelopesApi = new docusign.EnvelopesApi(apiClient);
        
        const commonRoleNames = ['Signer 1', 'Contractor', 'Signer', 'Client', 'Recipient'];
        let lastError = null;

        for (const roleName of commonRoleNames) {
            try {
                const env = new docusign.EnvelopeDefinition();
                env.templateId = appTemplate.docusignTemplateId;
                env.status = 'sent';

                const templateRole = docusign.TemplateRole.constructFromObject({
                    email: recipientEmail,
                    name: recipientName,
                    roleName: roleName
                });
                env.templateRoles = [templateRole];

                const results = await envelopesApi.createEnvelope(DOCUSIGN_ACCOUNT_ID, { envelopeDefinition: env });
                
                await supabase.from('DocusignEnvelope').insert({
                    templateId: appTemplate.id,
                    templateName: appTemplate.name,
                    recipientEmail,
                    recipientName,
                    docusignEnvelopeId: results.envelopeId,
                    status: 'sent',
                    sentDate: new Date().toISOString()
                });

                return res.status(200).json({ success: true, envelopeId: results.envelopeId });
            } catch (roleError) {
                lastError = roleError;
                continue;
            }
        }
        
        throw new Error(`Failed to send with all fallback roles. Last error: ${lastError?.message}`);

    } catch (error) {
        let errorMessage = error.message;
        if (error.response) {
            try {
                errorMessage = await error.response.text();
            } catch (e) { /* ignore */ }
        }
        return res.status(500).json({ success: false, error: errorMessage });
    }
}
