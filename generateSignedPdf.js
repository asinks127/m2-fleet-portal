import { supabase } from './_lib/supabaseServer.js';
import { PDFDocument, rgb } from 'pdf-lib';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { signatureRequestId, typedName, signatureData, signaturePlacement, fieldValues, signerIpAddress } = req.body || {};

    if (!signatureRequestId) {
      return res.status(400).json({ success: false, error: 'Missing signatureRequestId' });
    }

    // 1. Get the signature request
    const { data: sigReq, error: sigError } = await supabase
      .from('SignatureRequest')
      .select('*')
      .eq('id', signatureRequestId)
      .single();

    if (sigError || !sigReq) {
      console.error('[generateSignedPdf] SignatureRequest not found:', sigError?.message);
      return res.status(404).json({ success: false, error: 'Signature request not found' });
    }

    if (sigReq.status === 'Signed') {
      return res.json({ success: true, pdfUrl: sigReq.signedpdfurl, message: 'Already signed' });
    }

    // 2. Get the document
    const { data: document, error: docError } = await supabase
      .from('SignableDocument')
      .select('*')
      .eq('id', sigReq.documentid)
      .single();

    if (docError || !document) {
      console.error('[generateSignedPdf] Document not found:', docError?.message);
      return res.status(404).json({ success: false, error: 'Document not found' });
    }

    const pdfUrl = document.originalfileurl || document.fileUrl;
    if (!pdfUrl) {
      return res.status(400).json({ success: false, error: 'Document has no PDF URL' });
    }

    // 3. Fetch the original PDF
    const pdfResponse = await fetch(pdfUrl);
    if (!pdfResponse.ok) {
      return res.status(502).json({ success: false, error: 'Failed to fetch document PDF' });
    }
    const pdfBytes = await pdfResponse.arrayBuffer();

    // 4. Load PDF with pdf-lib and overlay signature
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const pages = pdfDoc.getPages();

    // Apply signature if provided
    if (signatureData && typedName) {
      // Decode signature image from base64 data URL
      let sigImageBytes;
      if (signatureData.startsWith('data:image/png;base64,')) {
        const base64 = signatureData.replace(/^data:image\/png;base64,/, '');
        sigImageBytes = Buffer.from(base64, 'base64');
      } else if (signatureData.startsWith('data:image/')) {
        const base64 = signatureData.split(',')[1];
        sigImageBytes = Buffer.from(base64, 'base64');
      } else {
        sigImageBytes = Buffer.from(signatureData, 'base64');
      }

      const sigImage = await pdfDoc.embedPng(sigImageBytes);

      // Determine which page to place the signature on
      const pageIndex = signaturePlacement?.page 
        ? Math.max(0, Math.min(signaturePlacement.page - 1, pages.length - 1))
        : pages.length - 1;

      const page = pages[pageIndex];
      const { width: pageWidth, height: pageHeight } = page.getSize();

      // Signature placement — use provided coordinates or default to bottom
      let x, y, sigWidth, sigHeight;
      if (signaturePlacement) {
        x = signaturePlacement.x || 50;
        y = signaturePlacement.y || pageHeight - 100;
        sigWidth = signaturePlacement.width || 200;
        sigHeight = signaturePlacement.height || 80;
      } else {
        sigWidth = 200;
        sigHeight = 80;
        x = 50;
        y = pageHeight - 150;
      }

      // Ensure placement is within page bounds
      x = Math.max(0, Math.min(x, pageWidth - sigWidth));
      y = Math.max(0, Math.min(y, pageHeight - sigHeight));

      // Draw the signature image
      page.drawImage(sigImage, {
        x,
        y,
        width: sigWidth,
        height: sigHeight,
      });

      // Add typed name text below the signature
      page.drawText(`Signed by: ${typedName}`, {
        x,
        y: y - 25,
        size: 10,
        color: rgb(0, 0, 0),
      });

      // Add date
      const dateStr = new Date().toISOString().split('T')[0];
      page.drawText(`Date: ${dateStr}`, {
        x,
        y: y - 40,
        size: 10,
        color: rgb(0, 0, 0),
      });
    }

    // 5. Save the signed PDF
    const signedPdfBytes = await pdfDoc.save();

    // 6. Upload to Supabase storage
    const fileName = `signed/${signatureRequestId}_${Date.now()}.pdf`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('documents')
      .upload(fileName, signedPdfBytes, {
        contentType: 'application/pdf',
        upsert: true,
      });

    if (uploadError) {
      console.error('[generateSignedPdf] Upload error:', uploadError.message);
      return res.status(500).json({ success: false, error: 'Failed to upload signed PDF: ' + uploadError.message });
    }

    // Get public URL
    const { data: publicUrlData } = supabase.storage
      .from('documents')
      .getPublicUrl(fileName);

    const signedPdfUrl = publicUrlData?.publicUrl;
    if (!signedPdfUrl) {
      return res.status(500).json({ success: false, error: 'Failed to get signed PDF URL' });
    }

    // 7. Update the SignatureRequest
    const { error: updateError } = await supabase
      .from('SignatureRequest')
      .update({
        status: 'Signed',
        signedat: new Date().toISOString(),
        signedpdfurl: signedPdfUrl,
        signaturedata: signatureData || '',
        typedname: typedName || '',
        signeripaddress: signerIpAddress || '',
      })
      .eq('id', signatureRequestId);

    if (updateError) {
      console.error('[generateSignedPdf] Update error:', updateError.message);
      // The file was uploaded, log but don't fail
    }

    // 8. Return success
    return res.status(200).json({
      success: true,
      pdfUrl: signedPdfUrl,
      message: 'Document signed successfully',
    });

  } catch (error) {
    console.error('[generateSignedPdf] Error:', error);
    return res.status(500).json({ success: false, error: error.message || 'An unexpected error occurred' });
  }
}
