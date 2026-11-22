export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    let fileUrl;

    if (req.method === 'GET') {
      fileUrl = req.query?.fileUrl || new URL(req.url, 'http://localhost').searchParams.get('fileUrl');
      if (!fileUrl) return res.status(400).json({ error: 'Missing fileUrl parameter' });

      const response = await fetch(fileUrl);
      if (!response.ok) return res.status(502).json({ error: 'Failed to fetch PDF' });

      const arrayBuffer = await response.arrayBuffer();
      const mimeTypes = {
        '.pdf': 'application/pdf',
        '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        '.doc': 'application/msword',
        '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        '.xls': 'application/vnd.ms-excel',
        '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        '.ppt': 'application/vnd.ms-powerpoint',
      };
      const ext = (fileUrl.split('?')[0].match(/\.(\w+)$/) || [])[1];
      const contentType = (ext && mimeTypes['.' + ext.toLowerCase()]) 
        || response.headers.get('content-type') 
        || 'application/octet-stream';
      res.setHeader('X-Frame-Options', 'SAMEORIGIN');
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', 'inline');
      res.setHeader('Access-Control-Allow-Origin', '*');
      return res.status(200).send(Buffer.from(arrayBuffer));
    }

    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    fileUrl = req.body?.fileUrl;
    if (!fileUrl) return res.status(400).json({ error: 'Missing fileUrl parameter' });

    const response = await fetch(fileUrl);
    if (!response.ok) return res.status(502).json({ error: 'Failed to fetch PDF' });

    const arrayBuffer = await response.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');

    return res.status(200).json({
      success: true,
      data: base64,
      contentType: response.headers.get('content-type') || 'application/pdf'
    });
  } catch (error) {
    console.error('Proxy PDF error:', error);
    return res.status(500).json({ error: error.message || 'Proxy failed' });
  }
}
