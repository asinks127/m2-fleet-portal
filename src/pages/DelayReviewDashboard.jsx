import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { CheckCircle, AlertCircle, Edit, ListChecks } from 'lucide-react';

export default function DelayReviewDashboard() {
  const [selectedDelay, setSelectedDelay] = useState(null);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [editedDelay, setEditedDelay] = useState('');
  const [reviewNotes, setReviewNotes] = useState('');
  const [actionStatus, setActionStatus] = useState('Valid');
  const [filterStatus, setFilterStatus] = useState('Pending Review');
  
  const queryClient = useQueryClient();

  const { data: delays = [], isLoading } = useQuery({
    queryKey: ['DelayDetail'],
    queryFn: () => base44.entities.DelayDetail.list('-dateWorked', 500),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      // Update DelayDetail
      await base44.entities.DelayDetail.update(id, data);
      
      // If Valid and has submissionId, also update DailyActivityRecord
      if (data.delayStatus === 'Valid' && data.submissionId) {
        const activityRecords = await base44.entities.DailyActivityRecord.filter({ submissionId: data.submissionId });
        if (activityRecords.length > 0) {
            await base44.entities.DailyActivityRecord.update(activityRecords[0].id, {
                delayReason: data.finalApprovedDelay
            });
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['DelayDetail'] });
      queryClient.invalidateQueries({ queryKey: ['DailyActivityRecord'] });
      toast.success('Delay review saved successfully');
      setIsReviewModalOpen(false);
      setSelectedDelay(null);
    },
    onError: (error) => {
      toast.error(`Error saving review: ${error.message}`);
    }
  });

  const flaggedDelays = delays.filter(d => {
    if (filterStatus === 'Pending Review') {
       return !d.isReviewed && (d.delayStatus === 'Needs Review' || d.delayStatus === 'Reject');
    }
    if (filterStatus === 'All') return true;
    return d.delayStatus === filterStatus;
  });

  const openReviewModal = (delay) => {
    setSelectedDelay(delay);
    setEditedDelay(delay.aiCleanedDelay || delay.rawDelayEntry || '');
    setReviewNotes(delay.reviewNotes || '');
    setActionStatus(delay.delayStatus === 'Pending AI' ? 'Needs Review' : delay.delayStatus);
    setIsReviewModalOpen(true);
  };

  const submitReview = () => {
    updateMutation.mutate({
      id: selectedDelay.id,
      data: {
        delayStatus: actionStatus,
        finalApprovedDelay: actionStatus === 'Valid' ? editedDelay : '',
        reviewNotes: reviewNotes,
        isReviewed: true,
        submissionId: selectedDelay.submissionId
      }
    });
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'Valid': return <Badge className="bg-green-100 text-green-800 border-green-200 hover:bg-green-200">Valid</Badge>;
      case 'Needs Review': return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200 hover:bg-yellow-200">Needs Review</Badge>;
      case 'Reject': return <Badge className="bg-red-100 text-red-800 border-red-200 hover:bg-red-200">Reject</Badge>;
      case 'Pending AI': return <Badge variant="outline" className="text-gray-500">Processing...</Badge>;
      default: return <Badge variant="outline">{status || 'Unknown'}</Badge>;
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <ListChecks className="w-8 h-8 text-primary" />
            AI Delay Reviews
          </h1>
          <p className="text-muted-foreground mt-1">Review, edit, and approve delays flagged by AI standardization.</p>
        </div>
        <div className="flex gap-2">
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Pending Review">Action Required</SelectItem>
              <SelectItem value="Needs Review">Needs Review</SelectItem>
              <SelectItem value="Reject">Rejected</SelectItem>
              <SelectItem value="Valid">Valid</SelectItem>
              <SelectItem value="All">All Delays</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card className="card-elevated">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Technician</TableHead>
                  <TableHead className="w-1/3">Raw Entry</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Reviewed</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Loading delays...</TableCell></TableRow>
                ) : flaggedDelays.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No delays found for this filter.</TableCell></TableRow>
                ) : (
                  flaggedDelays.map(delay => (
                    <TableRow key={delay.id}>
                      <TableCell className="whitespace-nowrap">{new Date(delay.dateWorked || delay.created_date).toLocaleDateString()}</TableCell>
                      <TableCell className="font-medium whitespace-nowrap">{delay.technicianName}</TableCell>
                      <TableCell>
                        <div className="text-sm line-clamp-2 max-w-sm" title={delay.rawDelayEntry || delay.delayDescription}>
                          {delay.rawDelayEntry || delay.delayDescription || '-'}
                        </div>
                        {delay.aiCleanedDelay && (
                          <div className="text-xs text-muted-foreground line-clamp-2 max-w-sm mt-1" title={delay.aiCleanedDelay}>
                            <span className="font-medium text-primary">AI:</span> {delay.aiCleanedDelay}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {delay.delayCategory ? (
                          <Badge variant="secondary" className="font-normal whitespace-nowrap">{delay.delayCategory}</Badge>
                        ) : '-'}
                      </TableCell>
                      <TableCell>{getStatusBadge(delay.delayStatus)}</TableCell>
                      <TableCell>
                        {delay.isReviewed ? (
                          <CheckCircle className="w-5 h-5 text-green-500" />
                        ) : (
                          <AlertCircle className="w-5 h-5 text-yellow-500" />
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => openReviewModal(delay)} className="text-primary hover:text-primary-700 hover:bg-primary-50">
                          <Edit className="w-4 h-4 mr-2" /> {delay.isReviewed ? 'Edit' : 'Review'}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isReviewModalOpen} onOpenChange={setIsReviewModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Review Delay Entry</DialogTitle>
            <DialogDescription>Review the AI-generated delay description and finalize it for the app.</DialogDescription>
          </DialogHeader>
          
          {selectedDelay && (
            <div className="space-y-6 my-4">
              <div className="grid grid-cols-2 gap-4 bg-muted/30 p-4 rounded-lg border border-border">
                <div>
                  <Label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Technician</Label>
                  <p className="font-medium">{selectedDelay.technicianName}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Date & Project</Label>
                  <p className="font-medium">{selectedDelay.dateWorked} • {selectedDelay.project || selectedDelay.customer}</p>
                </div>
                <div className="col-span-2 mt-2">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Original Raw Entry</Label>
                  <div className="bg-white p-3 rounded border border-border mt-1 font-mono text-sm shadow-sm">
                    {selectedDelay.rawDelayEntry || selectedDelay.delayDescription || 'No description provided'}
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <Label className="font-semibold text-base">Final Description for App</Label>
                  {selectedDelay.delayCategory && <Badge variant="secondary">{selectedDelay.delayCategory}</Badge>}
                </div>
                <Textarea 
                  value={editedDelay} 
                  onChange={(e) => setEditedDelay(e.target.value)}
                  className="min-h-[100px] text-base focus-visible:ring-primary"
                  placeholder="Enter the professional description to be displayed..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Review Decision</Label>
                  <Select value={actionStatus} onValueChange={setActionStatus}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select outcome" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Valid">Approve (Valid)</SelectItem>
                      <SelectItem value="Reject">Reject (Do not display)</SelectItem>
                      <SelectItem value="Needs Review">Keep in Review</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Admin Review Notes (Internal)</Label>
                  <Textarea 
                    value={reviewNotes} 
                    onChange={(e) => setReviewNotes(e.target.value)}
                    placeholder="Optional notes about this decision..."
                    className="min-h-[80px]"
                  />
                </div>
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsReviewModalOpen(false)}>Cancel</Button>
            <Button 
              onClick={submitReview} 
              className={actionStatus === 'Reject' ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-primary hover:bg-primary/90 text-white'}
            >
              Save Decision
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}