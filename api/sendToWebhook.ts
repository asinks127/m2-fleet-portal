export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(200).end();

    // This function can be called by other functions or from the frontend
    // It's designed to be a generic utility to send data to any webhook URL.
    try {
        const { webhookUrl, payload } = req.body;

        if (!webhookUrl || !payload) {
            return new Response(JSON.stringify({ error: 'webhookUrl and payload are required.' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`Webhook failed with status ${response.status}: ${errorBody}`);
        }

        return new Response(JSON.stringify({ success: true, message: 'Payload sent to webhook.' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });

    } catch (error) {
        console.error('Error sending to webhook:', error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}
