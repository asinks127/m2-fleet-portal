
export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response(null, {
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            }
        });
    }

    try {
        const { fileUrl } = req.body;
        
        if (!fileUrl) {
            return res.status(400).json({ error: 'Missing fileUrl parameter' });
        }

        // Fetch the PDF from the original URL
        const response = await fetch(fileUrl);
        
        if (!response.ok) {
            return res.status(500).json({ error: 'Failed to fetch PDF' });
        }

        const pdfBuffer = await response.arrayBuffer();
        
        // Convert to base64 for JSON response
        const base64 = btoa(String.fromCharCode(...new Uint8Array(pdfBuffer)));
        
        return Response.json({ 
            success: true, 
            data: base64,
            contentType: 'application/pdf'
        }, {
            headers: {
                'Access-Control-Allow-Origin': '*',
            }
        });
    } catch (error) {
        console.error('Proxy PDF error:', error);
        return res.status(500).json({ error: error.message });
    }
}
