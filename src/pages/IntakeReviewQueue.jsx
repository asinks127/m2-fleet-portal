import React, { useState } from "react";
import { base44 } from "@/api/warrantyClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Inbox, CheckCircle, AlertTriangle, Copy } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { format } from "date-fns";

export default function IntakeReviewQueue() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: issues = [], isLoading } = useQuery({
    queryKey: ['qcIssues'],
    queryFn: () => base44.entities.QCIssue.list('-created_date'),
  });

  const { data: technicians = [] } = useQuery({
    queryKey: ['technicians'],
    queryFn: () => base44.entities.Technician.list(),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.QCIssue.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['qcIssues'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.QCIssue.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['qcIssues'] });
      toast({ title: 'Issue deleted' });
    },
  });

  const reviewIssues = issues.filter(issue =>
    issue.parse_status === 'needs_review' ||
    issue.parse_status === 'duplicate_suspected' ||
    issue.import_review_reasons?.length > 0 ||
    !issue.technician_id ||
    !issue.technician_name ||
    !issue.qc_notes ||
    !issue.install_service_date
  );

  const approve = (issue) => {
    updateMutation.mutate({ id: issue.id, data: { parse_status: 'ok', import_review_reasons: [] } });
    toast({ title: 'Approved', description: `${issue.work_order_name || 'Issue'} marked as OK` });
  };

  const assignTech = (issueId, techId) => {
    const tech = technicians.find(t => t.id === techId);
    updateMutation.mutate({ id: issueId, data: { technician_id: techId, technician_name: tech?.full_name || '' } });
  };

  if (isLoading) return <div className="p-8 text-center text-gray-500">Loading...</div>;

  return (
    <div className="p-6 md:p-8 space-y-6">
      <div className="flex items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Intake Review Queue</h1>
          <p className="text-gray-500 mt-1">Issues that need manual review before being actioned</p>
        </div>
        {reviewIssues.length > 0 && (
          <Badge className="bg-yellow-100 text-yellow-800 text-base px-3 py-1">
            {reviewIssues.length} Pending
          </Badge>
        )}
      </div>

      {reviewIssues.length === 0 && (
        <div className="text-center py-16">
          <CheckCircle className="w-16 h-16 mx-auto text-green-400 mb-4" />
          <h3 className="text-lg font-semibold text-gray-900">Queue is clear!</h3>
          <p className="text-gray-500">All intakes have been reviewed.</p>
        </div>
      )}

      <div className="space-y-4">
        {reviewIssues.map(issue => {
          const flags = [];
          if (issue.parse_status === 'needs_review') flags.push({ label: 'Needs Review', color: 'bg-yellow-100 text-yellow-800' });
          if (issue.parse_status === 'duplicate_suspected') flags.push({ label: 'Duplicate?', color: 'bg-red-100 text-red-800' });
          if (!issue.technician_id) flags.push({ label: 'No Technician', color: 'bg-orange-100 text-orange-800' });
          if (!issue.qc_notes) flags.push({ label: 'Missing QC Notes', color: 'bg-red-100 text-red-800' });
          if (!issue.install_service_date) flags.push({ label: 'Missing Date', color: 'bg-orange-100 text-orange-800' });

          return (
            <Card key={issue.id} className="border-l-4 border-l-yellow-400">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between flex-wrap gap-2">
                  <div>
                    <CardTitle className="text-base">
                      {issue.work_order_name || issue.asset_number || 'Untitled Issue'}
                    </CardTitle>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {flags.map((f, i) => (
                        <Badge key={i} className={`text-xs ${f.color}`}>{f.label}</Badge>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="text-green-700 border-green-300 hover:bg-green-50" onClick={() => approve(issue)}>
                      <CheckCircle className="w-3 h-3 mr-1" /> Approve
                    </Button>
                    <Button size="sm" variant="outline" className="text-red-600 border-red-300 hover:bg-red-50"
                      onClick={() => {
                        if (confirm('Delete this issue?')) deleteMutation.mutate(issue.id);
                      }}>
                      Delete
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <Field label="Technician" value={issue.technician_name || '—'} missing={!issue.technician_id} />
                  <Field label="Install Date" value={issue.install_service_date || '—'} missing={!issue.install_service_date} />
                  <Field label="Source" value={issue.issue_source || '—'} />
                  <Field label="Received" value={issue.date_received ? format(new Date(issue.date_received), 'MM/dd/yy') : '—'} />
                </div>

                {!issue.technician_id && (
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500 text-xs">Assign technician:</span>
                    <Select onValueChange={(val) => assignTech(issue.id, val)}>
                      <SelectTrigger className="h-7 text-xs w-48">
                        <SelectValue placeholder="Select tech..." />
                      </SelectTrigger>
                      <SelectContent>
                        {technicians.map(t => (
                          <SelectItem key={t.id} value={t.id}>{t.full_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {issue.import_review_reasons?.length > 0 && (
                  <div className="rounded-lg bg-orange-50 p-2 text-xs text-orange-800">
                    Import review: {issue.import_review_reasons.map(reason => reason.replaceAll('_', ' ').replace(':', ': ')).join('; ')}
                  </div>
                )}

                {issue.qc_notes && (
                  <div className="bg-gray-50 rounded-lg p-2">
                    <p className="text-xs text-gray-500 mb-1">QC Notes:</p>
                    <p className="text-gray-700 text-xs">{issue.qc_notes}</p>
                  </div>
                )}

                {issue.source_email_subject && (
                  <div className="text-xs text-gray-400">
                    <span className="font-medium">Email:</span> {issue.source_email_subject}
                    {issue.source_email_from && <> · From: {issue.source_email_from}</>}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function Field({ label, value, missing }) {
  return (
    <div>
      <p className="text-gray-400 text-xs">{label}</p>
      <p className={`font-medium ${missing ? 'text-red-500' : 'text-gray-800'}`}>{value}</p>
    </div>
  );
}