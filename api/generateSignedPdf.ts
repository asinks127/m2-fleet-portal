import { supabase } from '../src/lib/supabaseClient';
import { jsPDF } from 'npm:jspdf@2.5.1';
import { PDFDocument } from 'npm:pdf-lib@1.17.1';

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(200).end();  
  try {
    const { signatureRequestId, typedName, signatureData, signaturePlacement, signerIpAddress } = req.body;

    if (!signatureRequestId || !typedName || !signatureData) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Missing required parameters'
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Use service role for this public function
    const base44Admin = base44.asServiceRole;

    // Get the signature request and document
    const signatureRequest = await base44Admin.entities.SignatureRequest.get(signatureRequestId);
    const document = await base44Admin.entities.SignableDocument.get(signatureRequest.documentId);

    let pdfBuffer;
    let finalFileName;

    if (document.documentType === 'pdf' && document.originalFileUrl) {
        // For PDFs, embed the signature directly on the document
        const pdfResponse = await fetch(document.originalFileUrl);
        const existingPdfBytes = await pdfResponse.arrayBuffer();
        
        const pdfDoc = await PDFDocument.load(existingPdfBytes);
        const pages = pdfDoc.getPages();
        
        // Extract signature image from base64 data URL
        const signatureBase64 = signatureData.replace(/^data:image\/png;base64,/, '');
        const signatureBytes = Uint8Array.from(atob(signatureBase64), c => c.charCodeAt(0));
        const signatureImage = await pdfDoc.embedPng(signatureBytes);
        
        // If we have placement info, use it; otherwise default to last page bottom
        let targetPage, sigX, sigY, sigWidth, sigHeight;
        
        if (signaturePlacement && signaturePlacement.page) {
            const pageIndex = signaturePlacement.page - 1;
            targetPage = pages[Math.min(pageIndex, pages.length - 1)];
            const { width: pageWidth, height: pageHeight } = targetPage.getSize();
            
            // signaturePlacement coordinates are from canvas (top-left origin)
            // PDF coordinates are bottom-left origin, so we need to convert
            // The canvas was rendered at a certain scale, we need to map back to PDF coordinates
            // Assuming the canvas rendered at scale 1.2 and standard 72 DPI
            const canvasScale = 1.2; // This should match the frontend scale
            
            sigX = signaturePlacement.x / canvasScale;
            sigWidth = signaturePlacement.width / canvasScale;
            sigHeight = signaturePlacement.height / canvasScale;
            // Convert Y from top-origin to bottom-origin
            sigY = pageHeight - (signaturePlacement.y / canvasScale) - sigHeight;
        } else {
            // Default: place signature at bottom of last page
            targetPage = pages[pages.length - 1];
            const { width: pageWidth, height: pageHeight } = targetPage.getSize();
            sigWidth = 150;
            sigHeight = 50;
            sigX = 50;
            sigY = 80;
        }
        
        // Draw the signature on the page
        targetPage.drawImage(signatureImage, {
            x: sigX,
            y: sigY,
            width: sigWidth,
            height: sigHeight,
        });
        
        pdfBuffer = await pdfDoc.save();
        finalFileName = `${document.title}_signed_${new Date().toISOString().split('T')[0]}.pdf`;

    } else { // Handle text documents
        const doc = new jsPDF();
        
        // Add document title
        doc.setFontSize(20);
        doc.setTextColor(51, 65, 85);
        doc.text(document.title, 20, 20);
        
        // Add document content (simplified - convert HTML to plain text for PDF)
        doc.setFontSize(12);
        doc.setTextColor(55, 65, 81);
        
        // Remove HTML tags for PDF (basic cleanup)
        const cleanContent = (document.content || '')
          .replace(/<[^>]*>/g, ' ')
          .replace(/&nbsp;/g, ' ')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>');
        
        const splitContent = doc.splitTextToSize(cleanContent, 170);
        let yPosition = 35;
        
        splitContent.forEach(line => {
          if (yPosition > 270) {
            doc.addPage();
            yPosition = 20;
          }
          doc.text(line, 20, yPosition);
          yPosition += 5;
        });

        // Add signature page
        doc.addPage();
        doc.setFontSize(16);
        doc.setTextColor(51, 65, 85);
        doc.text('Electronic Signature', 20, 20);
        
        // Add signature details
        doc.setFontSize(12);
        doc.setTextColor(55, 65, 81);
        doc.text(`Signed by: ${typedName}`, 20, 40);
        doc.text(`Email: ${signatureRequest.technicianEmail}`, 20, 50);
        doc.text(`Date: ${new Date().toLocaleString()}`, 20, 60);
        doc.text(`IP Address: ${signerIpAddress || 'Not recorded'}`, 20, 70);
        
        // Add signature image (convert base64 to image)
        try {
          doc.addImage(signatureData, 'PNG', 20, 80, 100, 40);
        } catch (imgError) {
          console.warn('Could not add signature image to PDF:', imgError);
          doc.text('Signature: [Digital signature provided]', 20, 90);
        }
        
        // Add legal notice
        doc.setFontSize(10);
        doc.setTextColor(107, 114, 128);
        doc.text('This document was signed electronically and is legally binding.', 20, 140);
        
        pdfBuffer = doc.output('arraybuffer');
        // The original code used technicianName, but the outline simplified this.
        finalFileName = `${document.title}_signed_${new Date().toISOString().split('T')[0]}.pdf`;
    }

    // Upload the final PDF (either the full doc or the certificate)
    const fileToUpload = new File([pdfBuffer], finalFileName, { type: 'application/pdf' });
    const { file_url } = await base44Admin.integrations.Core.UploadFile({
      file: fileToUpload
    });

    // Update the signature request with signed status and PDF URL
    await base44Admin.entities.SignatureRequest.update(signatureRequest.id, {
      status: 'Signed',
      signedAt: new Date().toISOString(),
      signedPdfUrl: file_url,
      signatureData: signatureData,
      typedName: typedName,
      signerIpAddress: signerIpAddress || 'Not recorded'
    });

    // Automatically file the document if there's a technician ID
    if (signatureRequest.technicianId) {
      await base44Admin.entities.ContractorDocument.create({
        contractorId: signatureRequest.technicianId,
        fileName: finalFileName,
        fileUrl: file_url,
        mimeType: 'application/pdf',
        folder: 'Signed Documents',
        uploadedBy: 'system@m2fleetcom.com',
        uploadDate: new Date().toISOString(),
      });
    }

    // Send email notification to admins about the signed document
    const adminEmails = ['austin@m2fleetcom.com', 'lena@m2fleetcom.com'];
    const emailSubject = `Document Signed: ${document.title}`;
    const emailBody = `
      <h2>New Document Signed</h2>
      <p>A document has been signed and is ready for review.</p>
      <hr>
      <p><strong>Document:</strong> ${document.title}</p>
      <p><strong>Signed by:</strong> ${typedName}</p>
      <p><strong>Email:</strong> ${signatureRequest.technicianEmail}</p>
      <p><strong>Signed at:</strong> ${new Date().toLocaleString()}</p>
      <p><strong>IP Address:</strong> ${signerIpAddress || 'Not recorded'}</p>
      <hr>
      <p><a href="${file_url}">View Signed PDF</a></p>
    `;

    for (const adminEmail of adminEmails) {
      try {
        await base44Admin.integrations.Core.SendEmail({
          to: adminEmail,
          subject: emailSubject,
          body: emailBody
        });
      } catch (emailError) {
        console.error(`Failed to send notification to ${adminEmail}:`, emailError);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      pdfUrl: file_url,
      message: 'Document signed and filed successfully'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error generating signed PDF:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Failed to generate signed PDF'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
