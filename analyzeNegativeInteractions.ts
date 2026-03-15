import { supabase } from '../src/lib/supabaseClient';


export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(200).end();    
    try {
        // Get all the data we need for analysis
        const [users, callLogs, inspections] = await Promise.all([
            supabase.from('User').select('*'),
            supabase.from('CallLog').select('*'),
            supabase.from('QCInspection').select('*')
        ]);

        const contractors = users.filter(user => 
            user.email && (
                user.email.toLowerCase().includes('.contractor@m2fleetcom.com') ||
                user.email.toLowerCase().includes('.contractor@smcinstallations.com')
            )
        );

        const analysisResults = [];

        for (const contractor of contractors) {
            // Get contractor's specific data
            const contractorCalls = callLogs.filter(log => log.technicianId === contractor.id);
            const contractorInspections = inspections.filter(insp => insp.technicianId === contractor.id);
            
            // Prepare data for AI analysis with source tracking
            const analysisData = {
                contractorName: contractor.displayName || contractor.full_name || contractor.email,
                contractorId: contractor.id,
                absences: contractor.absences || 0,
                lateArrivals: contractor.lateArrivals || 0,
                avgQcScore: contractor.avgQcScore || 0,
                velocitiScore: contractor.velocitiScore || 100,
                recentCallNotes: contractorCalls.slice(0, 10).map((call, index) => ({
                    id: `call_${index}`,
                    date: call.callDate,
                    note: call.note,
                    loggedBy: call.loggedBy
                })),
                recentInspections: contractorInspections.slice(0, 5).map((insp, index) => ({
                    id: `inspection_${index}`,
                    date: insp.inspectionDate,
                    score: insp.score,
                    notes: insp.notes,
                    loggedBy: insp.qcUserName // Added qcUserName to inspection data
                }))
            };

            // Use AI to analyze this contractor's data
            const aiAnalysis = await /* TODO: Implement Google Gemini AI Call */ gemini.generateContent({
                prompt: `Analyze this contractor's performance data and identify any negative patterns or concerns that should be flagged for management attention.

Contractor Data:
- Name: ${analysisData.contractorName}
- Absences: ${analysisData.absences}
- Late Arrivals: ${analysisData.lateArrivals} 
- Average QC Score: ${analysisData.avgQcScore}
- Velociti Performance Score: ${analysisData.velocitiScore}

Recent Call Log Notes:
${analysisData.recentCallNotes.map(call => `- ID: ${call.id} | ${call.date}: ${call.note || 'No notes'} (by ${call.loggedBy})`).join('\n')}

Recent QC Inspection Notes:
${analysisData.recentInspections.map(insp => `- ID: ${insp.id} | ${insp.date}: Score ${insp.score}/100 - ${insp.notes || 'No notes'} (by ${insp.loggedBy})`).join('\n')}

Please identify concerning patterns and for each issue you find, reference the specific call log or inspection ID that contains the evidence.

For each issue identified, provide:
- A brief description of the concern
- The severity level (high, medium, low)
- Supporting evidence from the data
- The source ID (call_0, inspection_1, etc.) that contains the evidence
- Recommended action

If no significant concerns are found, respond with "NO_ISSUES_FOUND"`,

                response_json_schema: {
                    type: "object",
                    properties: {
                        hasIssues: { type: "boolean" },
                        issues: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    description: { type: "string" },
                                    severity: { type: "string", enum: ["high", "medium", "low"] },
                                    evidence: { type: "string" },
                                    sourceId: { type: "string", description: "ID of the call log or inspection that contains the evidence" }, // Added sourceId
                                    recommendedAction: { type: "string" },
                                    category: { type: "string", enum: ["attendance", "performance", "behavior", "safety", "quality"] }
                                }
                            }
                        },
                        overallRiskScore: { type: "number", minimum: 0, maximum: 100 },
                        recommendedQcStatus: { type: "string", enum: ["good_standing", "minor_issues", "needs_coaching"] }
                    }
                }
            });

            if (aiAnalysis.hasIssues) {
                // Add each identified issue to our results with proper source tracking
                aiAnalysis.issues.forEach((issue, index) => {
                    // Find the original source based on the sourceId
                    let originalLoggedBy = 'AI System';
                    
                    if (issue.sourceId && issue.sourceId.startsWith('call_')) {
                        const callIndex = parseInt(issue.sourceId.split('_')[1]);
                        if (analysisData.recentCallNotes[callIndex]) {
                            originalLoggedBy = analysisData.recentCallNotes[callIndex].loggedBy;
                        }
                    } else if (issue.sourceId && issue.sourceId.startsWith('inspection_')) {
                        const inspIndex = parseInt(issue.sourceId.split('_')[1]);
                        if (analysisData.recentInspections[inspIndex]) {
                            originalLoggedBy = analysisData.recentInspections[inspIndex].loggedBy || 'QC Inspector';
                        }
                    }
                    
                    analysisResults.push({
                        id: `ai_${contractor.id}_${index}`,
                        type: 'AI Analysis',
                        contractorName: analysisData.contractorName,
                        contractorId: contractor.id,
                        date: new Date().toISOString(),
                        content: `${issue.description}\n\nEvidence: ${issue.evidence}\n\nRecommended Action: ${issue.recommendedAction}`,
                        loggedBy: `AI System (Source: ${originalLoggedBy})`, // Updated loggedBy to include source
                        severity: issue.severity,
                        category: issue.category,
                        riskScore: aiAnalysis.overallRiskScore
                    });
                });

                // Update contractor's risk score and QC status if AI recommends it
                await supabase.from('User').update({
                    riskScore: aiAnalysis.overallRiskScore,
                    qcStatus: aiAnalysis.recommendedQcStatus,
                    notesSentimentScore: aiAnalysis.overallRiskScore // Use risk score as sentiment
                }).eq('id', contractor.id);
            }
        }

        return new Response(JSON.stringify({
            success: true,
            analysisResults,
            contractorsAnalyzed: contractors.length,
            issuesFound: analysisResults.length
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('Error in AI analysis:', error);
        return new Response(JSON.stringify({
            success: false,
            error: error.message
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
