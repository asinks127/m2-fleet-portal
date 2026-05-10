import { supabase } from '../src/lib/supabaseClient';
import { differenceInDays, startOfWeek, endOfWeek, isBefore, addDays } from 'npm:date-fns@2.30.0';

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(200).end();    
    try {
        const base44Admin = base44.asServiceRole;
        
        // Fetch all necessary data
        const [users, invoices, wcRecords, certRecords, callLogs, inspections, shadowingChecklists] = await Promise.all([
            base44Admin.entities.User.list(),
            base44Admin.entities.Invoice.list(),
            base44Admin.entities.WorkersCompRecord.list(),
            base44Admin.entities.SafetyCertification.list(),
            base44Admin.entities.CallLog.list(),
            base44Admin.entities.QCInspection.list(),
            base44Admin.entities.ShadowingChecklist.list()
        ]);

        const activeContractors = users.filter(user => 
            user.active !== false && 
            user.email && 
            (user.email.includes('.contractor@m2fleetcom.com') || user.email.includes('.contractor@smcinstallations.com'))
        );

        const atRiskTechnicians = [];
        const today = new Date();
        const currentWeekStart = startOfWeek(today, { weekStartsOn: 0 });
        const currentWeekEnd = endOfWeek(today, { weekStartsOn: 0 });

        for (const tech of activeContractors) {
            const riskFactors = [];
            let riskLevel = 'low'; // low, medium, high, critical

            // 1. QC Score Risk
            const qcScore = tech.avgQcScore || 0;
            if (qcScore > 0 && qcScore < 75) {
                riskFactors.push({
                    type: 'performance',
                    severity: 'high',
                    message: `QC Score critically low: ${qcScore}`,
                    actionable: true,
                    action: 'Schedule coaching session'
                });
                riskLevel = 'high';
            } else if (qcScore > 0 && qcScore < 85) {
                riskFactors.push({
                    type: 'performance',
                    severity: 'medium',
                    message: `QC Score below target: ${qcScore}`,
                    actionable: true,
                    action: 'Monitor closely'
                });
                if (riskLevel === 'low') riskLevel = 'medium';
            }

            // 2. Velociti Score Risk
            const velocitiScore = tech.velocitiScore || 100;
            if (velocitiScore < 70) {
                riskFactors.push({
                    type: 'performance',
                    severity: 'high',
                    message: `Velociti Score critically low: ${velocitiScore}`,
                    actionable: true,
                    action: 'Immediate performance review required'
                });
                riskLevel = 'high';
            } else if (velocitiScore < 80) {
                riskFactors.push({
                    type: 'performance',
                    severity: 'medium',
                    message: `Velociti Score below target: ${velocitiScore}`,
                    actionable: true,
                    action: 'Performance improvement plan'
                });
                if (riskLevel === 'low') riskLevel = 'medium';
            }

            // 3. Compliance Document Expiration Risk
            const wcRecord = wcRecords.find(r => r.userEmail === tech.email);
            const certRecord = certRecords.find(c => c.userEmail === tech.email);
            
            if (wcRecord && wcRecord.expirationDate) {
                const wcExpDays = differenceInDays(new Date(wcRecord.expirationDate), today);
                if (wcExpDays < 0) {
                    riskFactors.push({
                        type: 'compliance',
                        severity: 'critical',
                        message: `Workers Comp EXPIRED ${Math.abs(wcExpDays)} days ago`,
                        actionable: true,
                        action: 'Must renew immediately'
                    });
                    riskLevel = 'critical';
                } else if (wcExpDays <= 30) {
                    riskFactors.push({
                        type: 'compliance',
                        severity: 'high',
                        message: `Workers Comp expires in ${wcExpDays} days`,
                        actionable: true,
                        action: 'Initiate renewal process'
                    });
                    if (riskLevel !== 'critical') riskLevel = 'high';
                }
            } else {
                riskFactors.push({
                    type: 'compliance',
                    severity: 'critical',
                    message: 'Workers Comp documentation missing',
                    actionable: true,
                    action: 'Obtain documentation immediately'
                });
                riskLevel = 'critical';
            }

            if (certRecord && certRecord.expirationDate) {
                const certExpDays = differenceInDays(new Date(certRecord.expirationDate), today);
                if (certExpDays < 0) {
                    riskFactors.push({
                        type: 'compliance',
                        severity: 'high',
                        message: `Safety Certification EXPIRED ${Math.abs(certExpDays)} days ago`,
                        actionable: true,
                        action: 'Must renew certification'
                    });
                    if (riskLevel !== 'critical') riskLevel = 'high';
                } else if (certExpDays <= 30) {
                    riskFactors.push({
                        type: 'compliance',
                        severity: 'medium',
                        message: `Safety Certification expires in ${certExpDays} days`,
                        actionable: true,
                        action: 'Schedule renewal'
                    });
                    if (riskLevel === 'low') riskLevel = 'medium';
                }
            }

            // 4. Contract Expiration Risk
            if (tech.endDate) {
                const contractExpDays = differenceInDays(new Date(tech.endDate), today);
                if (contractExpDays <= 30 && contractExpDays > 0) {
                    riskFactors.push({
                        type: 'administrative',
                        severity: 'medium',
                        message: `Contract expires in ${contractExpDays} days`,
                        actionable: true,
                        action: 'Discuss renewal options'
                    });
                    if (riskLevel === 'low') riskLevel = 'medium';
                }
            }

            // 5. Shadowing Activity Risk
            if (tech.shadowingStatus === 'in_progress') {
                const shadowingChecklist = shadowingChecklists.find(c => c.contractorId === tech.id);
                const recentCallLogs = callLogs.filter(log => 
                    log.technicianId === tech.id && 
                    differenceInDays(today, new Date(log.callDate)) <= 7
                );
                const recentInspections = inspections.filter(insp => 
                    insp.technicianId === tech.id && 
                    differenceInDays(today, new Date(insp.inspectionDate)) <= 7
                );

                if (!shadowingChecklist && tech.shadowingStartDate && 
                    differenceInDays(today, new Date(tech.shadowingStartDate)) > 14) {
                    riskFactors.push({
                        type: 'process',
                        severity: 'high',
                        message: 'Shadowing period overdue - no checklist found',
                        actionable: true,
                        action: 'Create and complete shadowing checklist'
                    });
                    if (riskLevel !== 'critical') riskLevel = 'high';
                } else if (recentCallLogs.length === 0 && recentInspections.length === 0 && 
                          differenceInDays(today, new Date(tech.shadowingStartDate || tech.created_date)) > 7) {
                    riskFactors.push({
                        type: 'process',
                        severity: 'medium',
                        message: 'No shadowing activity logged in past week',
                        actionable: true,
                        action: 'Follow up with assigned trainer'
                    });
                    if (riskLevel === 'low') riskLevel = 'medium';
                }
            }

            // 6. Invoice Submission Risk (for active contractors)
            if (tech.shadowingStatus === 'completed') {
                const currentWeekInvoices = invoices.filter(inv => 
                    inv.contractorEmail === tech.email &&
                    inv.created_date >= currentWeekStart.toISOString() &&
                    inv.created_date <= currentWeekEnd.toISOString()
                );

                if (currentWeekInvoices.length === 0 && differenceInDays(today, currentWeekStart) >= 4) {
                    riskFactors.push({
                        type: 'administrative',
                        severity: 'medium',
                        message: 'No invoice submitted for current week',
                        actionable: true,
                        action: 'Send invoice reminder'
                    });
                    if (riskLevel === 'low') riskLevel = 'medium';
                }
            }

            // 7. Attendance Risk
            const absences = tech.absences || 0;
            const lateArrivals = tech.lateArrivals || 0;
            if (absences >= 3) {
                riskFactors.push({
                    type: 'attendance',
                    severity: 'high',
                    message: `High absence count: ${absences}`,
                    actionable: true,
                    action: 'Review attendance policy'
                });
                if (riskLevel !== 'critical') riskLevel = 'high';
            } else if (lateArrivals >= 5) {
                riskFactors.push({
                    type: 'attendance',
                    severity: 'medium',
                    message: `Frequent late arrivals: ${lateArrivals}`,
                    actionable: true,
                    action: 'Discuss punctuality expectations'
                });
                if (riskLevel === 'low') riskLevel = 'medium';
            }

            // Only include technicians with at least one risk factor
            if (riskFactors.length > 0) {
                atRiskTechnicians.push({
                    id: tech.id,
                    name: tech.displayName || tech.full_name || tech.email,
                    email: tech.email,
                    project: tech.project,
                    m2PM: tech.m2PM,
                    riskLevel,
                    riskFactors,
                    totalRiskFactors: riskFactors.length,
                    highSeverityCount: riskFactors.filter(f => f.severity === 'high' || f.severity === 'critical').length,
                    lastUpdated: new Date().toISOString()
                });
            }
        }

        // Sort by risk level (critical first, then high, medium, low)
        const riskOrder = { critical: 4, high: 3, medium: 2, low: 1 };
        atRiskTechnicians.sort((a, b) => riskOrder[b.riskLevel] - riskOrder[a.riskLevel]);

        return new Response(JSON.stringify({
            success: true,
            atRiskTechnicians,
            summary: {
                total: atRiskTechnicians.length,
                critical: atRiskTechnicians.filter(t => t.riskLevel === 'critical').length,
                high: atRiskTechnicians.filter(t => t.riskLevel === 'high').length,
                medium: atRiskTechnicians.filter(t => t.riskLevel === 'medium').length,
                low: atRiskTechnicians.filter(t => t.riskLevel === 'low').length,
            },
            lastAnalyzed: new Date().toISOString()
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('Error analyzing at-risk technicians:', error);
        return new Response(JSON.stringify({
            success: false,
            error: error.message
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
