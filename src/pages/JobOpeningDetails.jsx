import React, { useState, useEffect, useCallback } from 'react';
import { JobOpening, Candidate } from '@/api/entities.js';
import { useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Label } from '@/components/ui/label.jsx';
import { PlusCircle, Loader2, ArrowLeft, Users, Phone, FileText } from 'lucide-react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils/index.js';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog.jsx';
import { UploadFile } from '@/api/integrations.js';

const STAGES = ["New Applicant", "Screening", "Interview", "Offer", "Hired", "Rejected"];

const STAGE_COLORS = {
  "New Applicant": "bg-blue-500",
  "Screening": "bg-purple-500",
  "Interview": "bg-orange-500",
  "Offer": "bg-yellow-500",
  "Hired": "bg-green-500",
  "Rejected": "bg-red-500",
};

const CandidateCard = ({ candidate, index, onEdit }) => {
  return (
    <Draggable draggableId={candidate.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className={`p-3 mb-3 bg-white rounded-lg shadow-sm border ${snapshot.isDragging ? 'shadow-lg ring-2 ring-blue-500' : ''} cursor-pointer hover:shadow-md transition-shadow`}
          onClick={() => onEdit(candidate)}
        >
          <p className="font-semibold text-sm text-gray-800">{candidate.fullName}</p>
          <p className="text-xs text-gray-500">{candidate.email}</p>
          {candidate.phone && (
            <p className="text-xs text-gray-500 flex items-center gap-1 mt-1">
              <Phone className="w-3 h-3" />
              {candidate.phone}
            </p>
          )}
          {candidate.source && (
            <p className="text-xs text-blue-600 mt-1">Source: {candidate.source}</p>
          )}
          <div className="flex items-center justify-between mt-2">
            {candidate.resumeUrl ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  window.open(candidate.resumeUrl, '_blank');
                }}
                className="text-xs text-green-600 hover:text-green-800 flex items-center gap-1"
              >
                <FileText className="w-3 h-3" />
                View Resume
              </button>
            ) : (
              <span className="text-xs text-gray-400">No resume</span>
            )}
            <span className="text-xs text-blue-500">Click to edit</span>
          </div>
        </div>
      )}
    </Draggable>
  );
};

export default function JobOpeningDetails() {
  const location = useLocation();
  const [job, setJob] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [jobId, setJobId] = useState(null);
  const [isAddCandidateOpen, setIsAddCandidateOpen] = useState(false);
  const [newCandidate, setNewCandidate] = useState({
    fullName: '',
    email: '',
    phone: '',
    source: '',
    notes: ''
  });
  const [isUploadingResume, setIsUploadingResume] = useState(false);
  const [editingCandidate, setEditingCandidate] = useState(null);
  const [isEditCandidateOpen, setIsEditCandidateOpen] = useState(false);

  const loadData = useCallback(async (id) => {
    setIsLoading(true);
    try {
      const jobData = await JobOpening.filter({ id });
      if (jobData.length > 0) {
        setJob(jobData[0]);
      }
      const candidateData = await Candidate.filter({ jobOpeningId: id });
      setCandidates(candidateData);
    } catch (error) {
      console.error("Failed to load job details:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const id = params.get('id');
    if (id) {
      setJobId(id);
      loadData(id);
    }
  }, [location.search, loadData]);

  const onDragEnd = async (result) => {
    const { destination, source, draggableId } = result;
    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    const newStage = destination.droppableId;
    
    const newCandidates = candidates.map(c => 
      c.id === draggableId ? { ...c, stage: newStage } : c
    );
    setCandidates(newCandidates);

    try {
      await Candidate.update(draggableId, { stage: newStage });
    } catch (error) {
      console.error("Failed to update candidate stage:", error);
      setCandidates(candidates);
      alert("Failed to move candidate. Please try again.");
    }
  };

  const handleResumeUpload = async (file) => {
    if (!file) return null;
    
    setIsUploadingResume(true);
    try {
      const { file_url } = await UploadFile({ file });
      return file_url;
    } catch (error) {
      console.error("Failed to upload resume:", error);
      alert("Failed to upload resume. Please try again.");
      return null;
    } finally {
      setIsUploadingResume(false);
    }
  };

  const handleAddCandidate = async (e) => {
    e.preventDefault();
    try {
      let resumeUrl = '';
      
      const resumeFile = document.getElementById('resumeFile').files[0];
      if (resumeFile) {
        resumeUrl = await handleResumeUpload(resumeFile);
        if (!resumeUrl) return;
      }

      await Candidate.create({
        ...newCandidate,
        jobOpeningId: jobId,
        stage: 'New Applicant',
        resumeUrl: resumeUrl
      });
      
      setNewCandidate({ fullName: '', email: '', phone: '', source: '', notes: '' });
      const resumeFileInput = document.getElementById('resumeFile');
      if (resumeFileInput) {
        resumeFileInput.value = '';
      }
      setIsAddCandidateOpen(false);
      loadData(jobId);
    } catch (error) {
      console.error("Failed to add candidate:", error);
      alert("Failed to add candidate. Please try again.");
    }
  };

  const handleEditCandidate = (candidate) => {
    setEditingCandidate(candidate);
    setNewCandidate({
      fullName: candidate.fullName || '',
      email: candidate.email || '',
      phone: candidate.phone || '',
      source: candidate.source || '',
      notes: candidate.notes || ''
    });
    setIsEditCandidateOpen(true);
  };

  const handleUpdateCandidate = async (e) => {
    e.preventDefault();
    if (!editingCandidate) return;

    try {
      let resumeUrl = editingCandidate.resumeUrl;
      
      const resumeFile = document.getElementById('editResumeFile').files[0];
      if (resumeFile) {
        resumeUrl = await handleResumeUpload(resumeFile);
        if (!resumeUrl) return;
      }

      await Candidate.update(editingCandidate.id, {
        ...newCandidate,
        resumeUrl: resumeUrl
      });
      
      setNewCandidate({ fullName: '', email: '', phone: '', source: '', notes: '' });
      setEditingCandidate(null);
      const resumeFileInput = document.getElementById('editResumeFile');
      if (resumeFileInput) {
        resumeFileInput.value = '';
      }
      setIsEditCandidateOpen(false);
      loadData(jobId);
    } catch (error) {
      console.error("Failed to update candidate:", error);
      alert("Failed to update candidate. Please try again.");
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
    <div className="p-6 h-full flex flex-col">
      <div className="mb-6">
        <Link to={createPageUrl('RecruitingDashboard')}>
          <Button variant="outline">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
        </Link>
      </div>
      
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{job?.title}</h1>
          <p className="text-gray-600 mt-1">{job?.department} • {job?.location}</p>
        </div>
        <div className="flex gap-2">
          <Link to={createPageUrl(`JobPostingGenerator?id=${jobId}`)}>
            <Button variant="outline">Generate Indeed Post</Button>
          </Link>
          <Button onClick={() => setIsAddCandidateOpen(true)}>
            <PlusCircle className="w-4 h-4 mr-2" />
            Add Candidate
          </Button>
        </div>
      </div>

      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex-1 flex gap-4 overflow-x-auto pb-4">
          {STAGES.map(stage => {
            const stageCandidates = candidates.filter(c => c.stage === stage);
            return (
              <div key={stage} className="w-72 flex-shrink-0 bg-gray-100 rounded-lg">
                <div className="p-3 sticky top-0 bg-gray-100">
                  <h2 className="font-semibold text-gray-700 flex items-center gap-2">
                    <span className={`w-3 h-3 rounded-full ${STAGE_COLORS[stage]}`}></span>
                    {stage}
                    <span className="text-sm font-normal text-gray-500">{stageCandidates.length}</span>
                  </h2>
                </div>
                <Droppable droppableId={stage}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`px-3 pt-1 pb-3 transition-colors min-h-32 ${snapshot.isDraggingOver ? 'bg-blue-50' : ''}`}
                    >
                      {stageCandidates.map((candidate, index) => (
                        <CandidateCard 
                          key={candidate.id} 
                          candidate={candidate} 
                          index={index} 
                          onEdit={handleEditCandidate}
                        />
                      ))}
                      {provided.placeholder}
                      {stageCandidates.length === 0 && (
                         <div className="flex flex-col items-center justify-center h-32 text-gray-400">
                           <Users className="w-8 h-8"/>
                           <p className="text-xs mt-1">No candidates</p>
                         </div>
                      )}
                    </div>
                  )}
                </Droppable>
              </div>
            );
          })}
        </div>
      </DragDropContext>

      <Dialog open={isAddCandidateOpen} onOpenChange={setIsAddCandidateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Candidate</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddCandidate} className="space-y-4">
            <div>
              <Label htmlFor="fullName">Full Name *</Label>
              <Input
                id="fullName"
                value={newCandidate.fullName}
                onChange={(e) => setNewCandidate({...newCandidate, fullName: e.target.value})}
                required
              />
            </div>
            <div>
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={newCandidate.email}
                onChange={(e) => setNewCandidate({...newCandidate, email: e.target.value})}
                required
              />
            </div>
            <div>
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={newCandidate.phone}
                onChange={(e) => setNewCandidate({...newCandidate, phone: e.target.value})}
              />
            </div>
            <div>
              <Label htmlFor="source">Source</Label>
              <Input
                id="source"
                placeholder="e.g., Indeed, LinkedIn, Referral"
                value={newCandidate.source}
                onChange={(e) => setNewCandidate({...newCandidate, source: e.target.value})}
              />
            </div>
            <div>
              <Label htmlFor="resumeFile">Resume (PDF)</Label>
              <Input
                id="resumeFile"
                type="file"
                accept=".pdf,.doc,.docx"
                disabled={isUploadingResume}
              />
              <p className="text-sm text-gray-500 mt-1">
                Upload PDF, DOC, or DOCX files only
              </p>
            </div>
            <div>
              <Label htmlFor="notes">Notes</Label>
              <Input
                id="notes"
                placeholder="Additional notes about this candidate"
                value={newCandidate.notes}
                onChange={(e) => setNewCandidate({...newCandidate, notes: e.target.value})}
              />
            </div>
            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setIsAddCandidateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isUploadingResume}>
                {isUploadingResume ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  'Add Candidate'
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditCandidateOpen} onOpenChange={(open) => {
        setIsEditCandidateOpen(open);
        if (!open) {
          setEditingCandidate(null);
          setNewCandidate({ fullName: '', email: '', phone: '', source: '', notes: '' });
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Candidate</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpdateCandidate} className="space-y-4">
            <div>
              <Label htmlFor="editFullName">Full Name *</Label>
              <Input
                id="editFullName"
                value={newCandidate.fullName}
                onChange={(e) => setNewCandidate({...newCandidate, fullName: e.target.value})}
                required
              />
            </div>
            <div>
              <Label htmlFor="editEmail">Email *</Label>
              <Input
                id="editEmail"
                type="email"
                value={newCandidate.email}
                onChange={(e) => setNewCandidate({...newCandidate, email: e.target.value})}
                required
              />
            </div>
            <div>
              <Label htmlFor="editPhone">Phone</Label>
              <Input
                id="editPhone"
                value={newCandidate.phone}
                onChange={(e) => setNewCandidate({...newCandidate, phone: e.target.value})}
              />
            </div>
            <div>
              <Label htmlFor="editSource">Source</Label>
              <Input
                id="editSource"
                placeholder="e.g., Indeed, LinkedIn, Referral"
                value={newCandidate.source}
                onChange={(e) => setNewCandidate({...newCandidate, source: e.target.value})}
              />
            </div>
            <div>
              <Label htmlFor="editResumeFile">Resume (PDF)</Label>
              {editingCandidate?.resumeUrl && (
                <div className="mb-2">
                  <button
                    type="button"
                    onClick={() => window.open(editingCandidate.resumeUrl, '_blank')}
                    className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
                  >
                    <FileText className="w-4 h-4" />
                    View Current Resume
                  </button>
                </div>
              )}
              <Input
                id="editResumeFile"
                type="file"
                accept=".pdf,.doc,.docx"
                disabled={isUploadingResume}
              />
              <p className="text-sm text-gray-500 mt-1">
                {editingCandidate?.resumeUrl 
                  ? "Upload a new file to replace the current resume" 
                  : "Upload PDF, DOC, or DOCX files only"
                }
              </p>
            </div>
            <div>
              <Label htmlFor="editNotes">Notes</Label>
              <Input
                id="editNotes"
                placeholder="Additional notes about this candidate"
                value={newCandidate.notes}
                onChange={(e) => setNewCandidate({...newCandidate, notes: e.target.value})}
              />
            </div>
            <div className="flex justify-end gap-3">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setIsEditCandidateOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isUploadingResume}>
                {isUploadingResume ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  'Update Candidate'
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}