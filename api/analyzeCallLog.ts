import { supabase } from '../src/lib/supabaseClient';


export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(200).end();
    try {
        const { callLogId, notes, technicianId, technicianEmail, technicianName, loggedBy } = req.body;

        console.log('Starting AI analysis for call log:', callLogId);

        // Step 1: Perform AI analysis
        const aiAnalysis = await /* TODO: Implement Google Gemini AI Call */ gemini.generateContent({
            prompt: `You are a manager's assistant for a fleet services company. Your task is to analyze a Quality Control (QC) call log note and determine if it requires an immediate alert to management.

**Call Log Note:**
"${notes}"

**Your Analysis Steps:**
1.  Read the note carefully.
2.  Identify if any of the following URGENT patterns exist:
    *   **Intention to Quit:** Any mention of quitting, resigning, leaving, being done, etc.
    *   **Extreme Negative Emotion:** Strong words of anger or frustration (e.g., "pissed off", "furious", "hate").
    *   **Safety Issues:** Any mention of unsafe practices, accidents, or near-misses.
    *   **Client Complaints:** Direct mention of a client being unhappy or filing a complaint.
    *   **Hostile Behavior:** Any threats or aggressive language.
3.  **Decision:** If ANY of the URGENT patterns above are found, you MUST set the "alertNeeded" field to true. Otherwise, set it to false. The phrases "pissed off" and "wants to quit" are explicit triggers for an alert.
4.  Provide a brief summary and recommended action based on the note.

**Output ONLY the JSON object based on your analysis.**`,

            response_json_schema: {
                type: "object",
                properties: {
                    alertNeeded: {
                        type: "boolean",
                        description: "Set to true if any urgent pattern is found, otherwise false."
                    },
                    concernLevel: {
                        type: "string",
                        enum: ["low", "medium", "high", "critical"],
                        description: "The severity of the issue."
                    },
                    concernSummary: {
                        type: "string",
                        description: "A brief, one-sentence summary of the main concern."
                    },
                    recommendedAction: {
                        type: "string",
                        description: "A concrete next step for management to take."
                    }
                }
            }
        });

        console.log('AI Analysis result:', aiAnalysis);

        // Step 2: If alert needed, send it
        if (aiAnalysis.alertNeeded) {
            console.log('Alert needed! Sending performance alert...');

            const managerEmails = [
                'lena@m2fleetcom.com', 'orville@m2fleetcom.com', 'steve@m2fleetcom.com',
                'austin@m2fleetcom.com', 'adam@m2fleetcom.com', 'jason@m2fleetcom.com'
            ];

            const emailBody = `
                <h3 style="color: #e74c3c;">Urgent Call Log Alert</h3>
                <p>A QC call log entry contains concerning information that requires immediate attention.</p>
                
                <div style="background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 8px; margin: 15px 0;">
                  <p><strong>Concern Level:</strong> <span style="color: ${aiAnalysis.concernLevel === 'critical' || aiAnalysis.concernLevel === 'high' ? '#e74c3c' : '#f39c12'}; text-transform: uppercase; font-weight: bold;">${aiAnalysis.concernLevel}</span></p>
                </div>

                <h4>Technician Details:</h4>
                <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 15px 0;">
                  <p><strong>Name:</strong> ${technicianName}</p>
                  <p><strong>Email:</strong> ${technicianEmail}</p>
                </div>

                <h4>Original Call Log Notes:</h4>
                <div style="background: #f8f9fa; border-left: 4px solid #6c757d; padding: 15px; margin: 15px 0;">
                  <p style="white-space: pre-wrap; margin: 0;">${notes}</p>
                </div>

                <div style="background: #e8f4fd; padding: 15px; border-radius: 8px; margin: 15px 0;">
                  <p><strong>QC Officer:</strong> ${loggedBy}</p>
                  <p><strong>Call Date:</strong> ${new Date().toLocaleDateString()}</p>
                  <p><strong>Call Time:</strong> ${new Date().toLocaleTimeString()}</p>
                </div>

                <p><strong>Please follow up with this technician immediately.</strong></p>
            `;

            // Send emails to all managers in parallel
            const emailPromises = managerEmails.map(email =>
                /* TODO: Setup Resend */ resend.emails.send({
                    to: email,
                    subject: `🚨 Urgent: ${aiAnalysis.concernSummary}`,
                    body: emailBody,
                    from_name: 'M2 Fleet Portal Alerts'
                })
            );

            await Promise.all(emailPromises);
            console.log('Performance alerts sent to all managers');

            // Log the alert
            await supabase.from('AlertLog').insert({
                technicianId,
                technicianName,
                subject: aiAnalysis.concernSummary,
                status: 'success',
                errorMessage: null,
                sentTo: managerEmails,
                triggeredBy: loggedBy
            });
        } else {
            console.log('No alert needed based on AI analysis');
        }

        return new Response(JSON.stringify({
            success: true,
            alertSent: aiAnalysis.alertNeeded
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('Error in analyzeCallLog:', error);
        
        // Still return success since the call log was already saved
        // Just log the analysis failure
        return new Response(JSON.stringify({
            success: true,
            error: error.message,
            alertSent: false
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
