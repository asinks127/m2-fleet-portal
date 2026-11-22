import React, { useState } from "react";
import { base44 } from "@/api/warrantyClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Plus, AlertTriangle, Mail, Zap, RefreshCw } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { AnimatePresence, motion } from "framer-motion";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

import QCIssueCard from "../components/qc/QCIssueCard";
import QCIssueForm from "../components/qc/QCIssueForm";
import QCReports from "../components/qc/QCReports";
import { isOpenIssue, isClosedIssue } from "../lib/qcUtils";

export default function QCIssues() {
  const [showForm, setShowForm] = useState(false);
  const [backfilling, setBackfilling] = useState(false);
  const { toast } = useToast();

  const runBackfill = async () => {
    setBackfilling(true);
    try {
      const res = await base44.functions.invoke('backfillQCEmails', { maxEmails: 500 });
      const { processed, skipped_non_qc } = res.data;
      toast({ title: `Backfill complete`, description: `Processed ${processed} QC emails, skipped ${skipped_non_qc} non-QC emails.` });
      queryClient.invalidateQueries({ queryKey: ['qcIssues'] });
      queryClient.invalidateQueries({ queryKey: ['technicians'] });
    } catch (e) {
      toast({ title: 'Backfill failed', description: e.message, variant: 'destructive' });
    }
    setBackfilling(false);
  };
  const [editingIssue, setEditingIssue] = useState(null);
  const [activeTab, setActiveTab] = useState("all");
  const queryClient = useQueryClient();

  const { data: qcIssues = [], isLoading } = useQuery({
    queryKey: ['qcIssues'],
    queryFn: () => base44.entities.QCIssue.list('-created_date'),
  });

  const { data: technicians = [] } = useQuery({
    queryKey: ['technicians'],
    queryFn: () => base44.entities.Technician.list(),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.QCIssue.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['qcIssues'] });
      setShowForm(false);
      setEditingIssue(null);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.QCIssue.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['qcIssues'] });
      setShowForm(false);
      setEditingIssue(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.QCIssue.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['qcIssues'] });
    },
  });

  const handleSubmit = (data) => {
    if (editingIssue) {
      updateMutation.mutate({ id: editingIssue.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (issue) => {
    setEditingIssue(issue);
    setShowForm(true);
  };

  const handleDelete = (id) => {
    if (confirm('Are you sure you want to delete this QC issue?')) {
      deleteMutation.mutate(id);
    }
  };

  // Exclude known duplicates from all views (same logic as Command Center)
  const deduped = qcIssues.filter(
    issue => !(issue.duplicate_status && issue.duplicate_status.startsWith('duplicate_of_'))
  );

  const filteredIssues = activeTab === "all"
    ? deduped
    : activeTab === "pending_repair"
      ? deduped.filter(isOpenIssue)
      : activeTab === "repaired"
        ? deduped.filter(isClosedIssue)
        : deduped.filter(issue => issue.status === activeTab);

  return (
    <div className="p-6 md:p-8 space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Quality Control Issues</h1>
          <p className="text-gray-500 mt-1">Track and manage QC findings</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 text-sm px-3 py-2 rounded-lg">
            <Zap className="w-4 h-4 text-green-500" />
            <Mail className="w-4 h-4" />
            <span className="font-medium">Gmail Auto-Scan Active</span>
          </div>
          <Button
            variant="outline"
            onClick={runBackfill}
            disabled={backfilling}
            className="border-blue-300 text-blue-700 hover:bg-blue-50"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${backfilling ? 'animate-spin' : ''}`} />
            {backfilling ? 'Scanning...' : 'Backfill from Gmail'}
          </Button>
          <Button
            onClick={() => {
              setEditingIssue(null);
              setShowForm(!showForm);
            }}
            className="bg-blue-600 hover:bg-blue-700 shadow-md ripple"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add QC Issue
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-white shadow-sm">
          <TabsTrigger value="all">All Issues ({deduped.length})</TabsTrigger>
          <TabsTrigger value="pending_repair">Open ({deduped.filter(isOpenIssue).length})</TabsTrigger>
          <TabsTrigger value="scheduled">Scheduled ({deduped.filter(i => i.status === 'scheduled').length})</TabsTrigger>
          <TabsTrigger value="repaired">Resolved ({deduped.filter(isClosedIssue).length})</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
        </TabsList>

        <TabsContent value="reports" className="mt-6">
          <QCReports qcIssues={qcIssues} technicians={technicians} />
        </TabsContent>

        <TabsContent value="all" className="mt-6 space-y-6">
          <AnimatePresence>
            {showForm && (
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
              >
                <QCIssueForm
                  qcIssue={editingIssue}
                  technicians={technicians}
                  onSubmit={handleSubmit}
                  onCancel={() => {
                    setShowForm(false);
                    setEditingIssue(null);
                  }}
                  isLoading={createMutation.isPending || updateMutation.isPending}
                />
              </motion.div>
            )}
          </AnimatePresence>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <AnimatePresence>
              {filteredIssues.map((issue) => (
                <QCIssueCard
                  key={issue.id}
                  qcIssue={issue}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                />
              ))}
            </AnimatePresence>
          </div>

          {!isLoading && filteredIssues.length === 0 && !showForm && (
            <div className="text-center py-12">
              <AlertTriangle className="w-16 h-16 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No QC issues</h3>
              <p className="text-gray-500">Great job! No quality control issues to track</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="pending_repair" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <AnimatePresence>
              {filteredIssues.map((issue) => (
                <QCIssueCard
                  key={issue.id}
                  qcIssue={issue}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                />
              ))}
            </AnimatePresence>
          </div>
        </TabsContent>

        <TabsContent value="scheduled" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <AnimatePresence>
              {filteredIssues.map((issue) => (
                <QCIssueCard
                  key={issue.id}
                  qcIssue={issue}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                />
              ))}
            </AnimatePresence>
          </div>
        </TabsContent>

        <TabsContent value="repaired" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <AnimatePresence>
              {filteredIssues.map((issue) => (
                <QCIssueCard
                  key={issue.id}
                  qcIssue={issue}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                />
              ))}
            </AnimatePresence>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}