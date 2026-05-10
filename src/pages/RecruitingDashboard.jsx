
import React, { useState, useEffect } from 'react';
import { JobOpening, Candidate } from '@/api/entities.js';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils/index.js';
import { PlusCircle, Briefcase, Users, CheckSquare, Loader2, Upload, FileText, Trash2 } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from '@/components/ui/badge.jsx';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog.jsx';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog.jsx';
import CreateJobForm from '../components/recruiting/CreateJobForm';
import BulkCandidateImport from '../components/recruiting/BulkCandidateImport';

export default function RecruitingDashboard() {
  const [jobs, setJobs] = useState([]);
  const [stats, setStats] = useState({ open: 0, newCandidates: 0, hired: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateJobOpen, setIsCreateJobOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [jobToDelete, setJobToDelete] = useState(null);
  const [isDeletingJob, setIsDeletingJob] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [jobData, candidateData] = await Promise.all([
        JobOpening.list('-created_date'),
        Candidate.list('-created_date', 100)
      ]);
      setJobs(jobData);
      
      const openCount = jobData.filter(j => j.status === 'Open').length;
      const hiredCount = candidateData.filter(c => c.stage === 'Hired').length;
      
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      const newCandidatesCount = candidateData.filter(c => new Date(c.created_date) > oneWeekAgo).length;
      
      setStats({ open: openCount, newCandidates: newCandidatesCount, hired: hiredCount });
    } catch (error) {
      console.error("Failed to load recruiting data:", error);
    } finally {
      setIsLoading(false);
    }
  };
  
  const StatCard = ({ title, value, icon: Icon, color }) => (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-gray-600">{title}</CardTitle>
        <Icon className={`w-5 h-5 ${color}`} />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-gray-900">{value}</div>
      </CardContent>
    </Card>
  );

  const handleDeleteJob = async () => {
    if (!jobToDelete) return;
    
    setIsDeletingJob(true);
    try {
      // First, get all candidates for this job
      const jobCandidates = await Candidate.filter({ jobOpeningId: jobToDelete.id });
      
      // Delete all candidates associated with this job
      for (const candidate of jobCandidates) {
        await Candidate.delete(candidate.id);
      }
      
      // Then delete the job opening
      await JobOpening.delete(jobToDelete.id);
      
      setJobToDelete(null); // Close dialog
      loadData(); // Refresh the data
    } catch (error) {
      console.error('Error deleting job:', error);
      // Optionally show a toast notification for the error
    } finally {
      setIsDeletingJob(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-full p-6">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Recruiting Dashboard</h1>
          <p className="text-gray-600 mt-1">Manage your hiring pipeline from here.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setIsImportOpen(true)}>
            <Upload className="w-4 h-4 mr-2" />
            Import Candidates
          </Button>
          <Button onClick={() => setIsCreateJobOpen(true)}>
            <PlusCircle className="w-4 h-4 mr-2" />
            Create New Job
          </Button>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard title="Open Positions" value={stats.open} icon={Briefcase} color="text-blue-500" />
        <StatCard title="New Candidates (7d)" value={stats.newCandidates} icon={Users} color="text-orange-500" />
        <StatCard title="Total Hired" value={stats.hired} icon={CheckSquare} color="text-green-500" />
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>Job Openings</CardTitle>
          <CardDescription>Click on a job to view its hiring pipeline, or use the actions to generate Indeed postings.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Position</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobs.map(job => (
                <TableRow key={job.id}>
                  <TableCell className="font-medium">{job.title}</TableCell>
                  <TableCell>{job.department}</TableCell>
                  <TableCell>{job.location}</TableCell>
                  <TableCell>
                    <Badge variant={job.status === 'Open' ? 'default' : 'secondary'}
                           className={job.status === 'Open' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
                      {job.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Link to={createPageUrl(`JobOpeningDetails?id=${job.id}`)}>
                        <Button variant="outline" size="sm">View Pipeline</Button>
                      </Link>
                      <Link to={createPageUrl(`JobPostingGenerator?id=${job.id}`)}>
                        <Button variant="outline" size="sm">
                          <FileText className="w-4 h-4 mr-1" />
                          Generate Post
                        </Button>
                      </Link>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => setJobToDelete(job)}
                        className="text-red-600 border-red-200 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {jobs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                    No job openings yet. Create your first job to get started!
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isCreateJobOpen} onOpenChange={setIsCreateJobOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create New Job Opening</DialogTitle>
          </DialogHeader>
          <CreateJobForm
            onSuccess={() => {
              setIsCreateJobOpen(false);
              loadData();
            }}
            onCancel={() => setIsCreateJobOpen(false)}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={isImportOpen} onOpenChange={setIsImportOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Import Candidates from Indeed</DialogTitle>
          </DialogHeader>
          <BulkCandidateImport
            jobs={jobs}
            onSuccess={() => {
              setIsImportOpen(false);
              loadData();
            }}
            onCancel={() => setIsImportOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Delete Job Confirmation Dialog */}
      <AlertDialog open={!!jobToDelete} onOpenChange={() => setJobToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Job Opening</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{jobToDelete?.title}"? This will also delete all candidates associated with this job opening. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingJob}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteJob}
              disabled={isDeletingJob}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeletingJob ? 'Deleting...' : 'Delete Job'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
