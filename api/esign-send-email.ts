import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {
    user: process.env.GMAIL_USER || "austin@m2fleetcom.com",
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { to, subject, signingUrl, recipientName, documentTitle } = req.body || {};

  if (!to || !signingUrl) {
    return res.status(400).json({ error: "Missing required fields: to, signingUrl" });
  }

  const name = recipientName || "there";
  const title = documentTitle || "a document";

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: #1e3a8a; padding: 24px; border-radius: 8px 8px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 22px;">M2 Fleet Communications</h1>
        <p style="color: #bfdbfe; margin: 4px 0 0; font-size: 14px;">E-Signature Request</p>
      </div>
      <div style="background: #f8fafc; padding: 32px; border-radius: 0 0 8px 8px; border: 1px solid #e2e8f0;">
        <p style="font-size: 16px; color: #1e293b; margin: 0 0 16px;">Hi ${name},</p>
        <p style="font-size: 15px; color: #475569; line-height: 1.6; margin: 0 0 24px;">
          You have a document that requires your electronic signature:
        </p>
        <div style="background: white; border: 1px solid #e2e8f0; border-radius: 6px; padding: 16px; margin: 0 0 24px;">
          <p style="font-size: 16px; font-weight: 600; color: #1e293b; margin: 0;">${title}</p>
        </div>
        <a href="${signingUrl}"
           style="display: inline-block; background: #2563eb; color: white; padding: 14px 32px;
                  border-radius: 6px; text-decoration: none; font-size: 16px; font-weight: 600;">
          Review &amp; Sign Document
        </a>
        <p style="font-size: 13px; color: #94a3b8; margin: 24px 0 0; line-height: 1.5;">
          This link is unique to you. Do not forward this email to anyone else.<br/>
          If you did not expect this document, please disregard this email.
        </p>
      </div>
      <p style="font-size: 12px; color: #94a3b8; text-align: center; margin: 16px 0 0;">
        M2 Fleet Communications · Electronic Signature Service
      </p>
    </div>
  `;

  const text = `Hi ${name},\n\nYou have a document that requires your electronic signature: ${title}\n\nTo review and sign, click this link:\n${signingUrl}\n\nThis link is unique to you. Do not forward this email.\n\nM2 Fleet Communications`;

  try {
    const info = await transporter.sendMail({
      from: `"M2 Fleet E-Sign" <${process.env.GMAIL_USER || "austin@m2fleetcom.com"}>`,
      to,
      subject: subject || `Please sign: ${title}`,
      html,
      text,
    });

    console.log(`[esign-email] Sent to ${to}: ${info.messageId}`);
    return res.status(200).json({ success: true, messageId: info.messageId });
  } catch (error: any) {
    console.error("[esign-email] Send failed:", error?.message);
    return res.status(500).json({ error: error?.message || "Failed to send email" });
  }
}
