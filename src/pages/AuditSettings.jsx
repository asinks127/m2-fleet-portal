import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Save, Settings, AlertTriangle } from 'lucide-react';

export default function AuditSettings() {
    const queryClient = useQueryClient();
    const [saving, setSaving] = useState(false);
    
    const { data: settings = [], isLoading } = useQuery({
        queryKey: ['auditSettings'],
        queryFn: () => base44.entities.AuditSystemSetting.filter({})
    });

    const [formData, setFormData] = useState({
        passThreshold: 90, needsReviewThreshold: 80,
        weightAuditScore: 50, weightOnTime: 30, weightPenalty: 20,
        valueCompletedOnTime: 100, valueCompletedLate: 75, valueOpen: 50, valueOverdue: 25, valueEscalated: 0,
        riskModerate: 80, riskHigh: 70,
        repeatFailureCount: 3, repeatFailureDays: 60,
        userAtRiskCompletionRate: 85, userAtRiskOverdueCount: 3, userAtRiskDays: 30
    });

    useEffect(() => {
        if (settings.length > 0) {
            setFormData(settings[0]);
        }
    }, [settings]);

    const handleSave = async () => {
        setSaving(true);
        try {
            if (settings.length > 0) {
                await base44.entities.AuditSystemSetting.update(settings[0].id, formData);
            } else {
                await base44.entities.AuditSystemSetting.create(formData);
            }
            queryClient.invalidateQueries(['auditSettings']);
            alert('Settings saved successfully!');
        } catch (e) {
            alert('Error saving settings: ' + e.message);
        } finally {
            setSaving(false);
        }
    };

    const handleChange = (e) => {
        setFormData(prev => ({ ...prev, [e.target.name]: Number(e.target.value) }));
    };

    if (isLoading) return <div className="p-8 text-center text-gray-500">Loading settings...</div>;

    return (
        <div className="p-6 max-w-5xl mx-auto space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Audit System Settings</h1>
                    <p className="text-gray-500 text-sm">Configure global risk thresholds and formulas for the auditing module.</p>
                </div>
                <Button onClick={handleSave} disabled={saving}>
                    {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                    Save Settings
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Audit Execution Thresholds</CardTitle>
                        <CardDescription>Determine audit results based on percentage scores.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <Label>Pass Threshold (%)</Label>
                            <Input type="number" name="passThreshold" value={formData.passThreshold} onChange={handleChange} />
                            <p className="text-xs text-gray-500 mt-1">Scores &ge; this value will pass.</p>
                        </div>
                        <div>
                            <Label>Needs Review Threshold (%)</Label>
                            <Input type="number" name="needsReviewThreshold" value={formData.needsReviewThreshold} onChange={handleChange} />
                            <p className="text-xs text-gray-500 mt-1">Scores between this and Pass will need review. Below this is Fail.</p>
                        </div>
                        <div className="bg-yellow-50 p-3 rounded text-sm text-yellow-800 border border-yellow-200 flex items-start gap-2">
                            <AlertTriangle className="w-4 h-4 mt-0.5" />
                            <span>If any <b>Critical Item</b> fails, the result will automatically become <b>Fail</b> and require Corrective Action.</span>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Department Compliance Score Weighting</CardTitle>
                        <CardDescription>Weights for the blended risk score (must equal 100).</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <Label>Average Audit Score Weight (%)</Label>
                            <Input type="number" name="weightAuditScore" value={formData.weightAuditScore} onChange={handleChange} />
                        </div>
                        <div>
                            <Label>On-Time Completion Weight (%)</Label>
                            <Input type="number" name="weightOnTime" value={formData.weightOnTime} onChange={handleChange} />
                        </div>
                        <div>
                            <Label>Overdue Penalty Weight (%)</Label>
                            <Input type="number" name="weightPenalty" value={formData.weightPenalty} onChange={handleChange} />
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Overdue Risk Values</CardTitle>
                        <CardDescription>Point values (0-100) assigned to audits based on their timeline status.</CardDescription>
                    </CardHeader>
                    <CardContent className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>Completed On-Time</Label>
                            <Input type="number" name="valueCompletedOnTime" value={formData.valueCompletedOnTime} onChange={handleChange} />
                        </div>
                        <div>
                            <Label>Completed Late</Label>
                            <Input type="number" name="valueCompletedLate" value={formData.valueCompletedLate} onChange={handleChange} />
                        </div>
                        <div>
                            <Label>Open (Not Overdue)</Label>
                            <Input type="number" name="valueOpen" value={formData.valueOpen} onChange={handleChange} />
                        </div>
                        <div>
                            <Label>Overdue</Label>
                            <Input type="number" name="valueOverdue" value={formData.valueOverdue} onChange={handleChange} />
                        </div>
                        <div>
                            <Label>Escalated Overdue</Label>
                            <Input type="number" name="valueEscalated" value={formData.valueEscalated} onChange={handleChange} />
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Executive & Team Risk Indicators</CardTitle>
                        <CardDescription>Thresholds for flags on dashboards.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Moderate Risk Score (&lt; Low Risk)</Label>
                                <Input type="number" name="riskModerate" value={formData.riskModerate} onChange={handleChange} />
                            </div>
                            <div>
                                <Label>High Risk Score</Label>
                                <Input type="number" name="riskHigh" value={formData.riskHigh} onChange={handleChange} />
                            </div>
                        </div>
                        <div className="border-t pt-4">
                            <h4 className="font-semibold text-sm mb-2">Repeat Failure Logic</h4>
                            <div className="flex gap-4">
                                <div className="flex-1"><Label>Failure Count</Label><Input type="number" name="repeatFailureCount" value={formData.repeatFailureCount} onChange={handleChange} /></div>
                                <div className="flex-1"><Label>Rolling Days</Label><Input type="number" name="repeatFailureDays" value={formData.repeatFailureDays} onChange={handleChange} /></div>
                            </div>
                        </div>
                        <div className="border-t pt-4">
                            <h4 className="font-semibold text-sm mb-2">User At-Risk Flag</h4>
                            <div className="grid grid-cols-3 gap-4">
                                <div><Label>Min Compl. Rate %</Label><Input type="number" name="userAtRiskCompletionRate" value={formData.userAtRiskCompletionRate} onChange={handleChange} /></div>
                                <div><Label>Max Overdue</Label><Input type="number" name="userAtRiskOverdueCount" value={formData.userAtRiskOverdueCount} onChange={handleChange} /></div>
                                <div><Label>Rolling Days</Label><Input type="number" name="userAtRiskDays" value={formData.userAtRiskDays} onChange={handleChange} /></div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}