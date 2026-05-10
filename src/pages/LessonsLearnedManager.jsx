import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Plus, Edit, BookOpen, Users, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/components/ui/use-toast';

export default function LessonsLearnedManager() {
  const { toast } = useToast();
  const [lessons, setLessons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editDialog, setEditDialog] = useState(false);
  const [currentLesson, setCurrentLesson] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [user, setUser] = useState(null);

  useEffect(() => {
    fetchLessons();
  }, []);

  const fetchLessons = async () => {
    try {
      const me = await base44.auth.me();
      setUser(me);
      const data = await base44.entities.SafetyLessonLearned.list('-dateAdded');
      setLessons(data || []);
    } catch (error) {
      console.error('Error fetching lessons:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      if (currentLesson.id) {
        await base44.entities.SafetyLessonLearned.update(currentLesson.id, {
          ...currentLesson,
          updatedBy: user.email
        });
        toast({ title: 'Success', description: 'Lesson updated.' });
      } else {
        await base44.entities.SafetyLessonLearned.create({
          ...currentLesson,
          lessonId: 'LSL-' + Date.now().toString().slice(-6),
          dateAdded: new Date().toISOString(),
          addedBy: user.email,
          updatedBy: user.email
        });
        toast({ title: 'Success', description: 'Lesson created.' });
      }
      setEditDialog(false);
      fetchLessons();
    } catch (error) {
      console.error('Save error:', error);
      toast({ title: 'Error', description: 'Could not save lesson.', variant: 'destructive' });
    }
  };

  const openNew = () => {
    setCurrentLesson({
      title: '',
      category: '',
      relatedProject: '',
      relatedReportId: '',
      incidentDate: '',
      whatHappened: '',
      howItHappened: '',
      whatShouldHaveBeenDoneDifferently: '',
      preventiveAction: '',
      correctiveActionImplemented: '',
      requiredPpeOrTrainingReminder: '',
      audience: 'All Contractors',
      status: 'Draft',
      acknowledgmentRequired: false
    });
    setEditDialog(true);
  };

  const filteredLessons = lessons.filter(l => 
    l.title?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    l.category?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Lessons Learned Manager</h1>
          <p className="text-gray-600 mt-1">Create and manage safety lessons and alerts.</p>
        </div>
        <Button onClick={openNew} className="bg-green-600 hover:bg-green-700">
          <Plus className="w-4 h-4 mr-2" /> New Lesson
        </Button>
      </div>

      <div className="flex gap-4 items-center bg-white p-4 rounded-xl shadow-sm border">
        <div className="w-96">
          <Input 
            placeholder="Search lessons..." 
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center p-10"><Loader2 className="w-8 h-8 animate-spin text-green-600" /></div>
      ) : (
        <div className="bg-white rounded-xl shadow border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="p-4 font-medium text-gray-600">ID / Date Added</th>
                  <th className="p-4 font-medium text-gray-600">Title / Category</th>
                  <th className="p-4 font-medium text-gray-600">Audience</th>
                  <th className="p-4 font-medium text-gray-600">Status</th>
                  <th className="p-4 font-medium text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredLessons.map(lesson => (
                  <tr key={lesson.id} className="hover:bg-gray-50">
                    <td className="p-4">
                      <div className="font-mono text-gray-500">{lesson.lessonId}</div>
                      <div>{format(new Date(lesson.dateAdded || lesson.created_date), 'MMM d, yyyy')}</div>
                    </td>
                    <td className="p-4">
                      <div className="font-semibold text-gray-900">{lesson.title}</div>
                      <div className="text-gray-500">{lesson.category}</div>
                    </td>
                    <td className="p-4">
                      <Badge variant="outline">{lesson.audience}</Badge>
                      {lesson.acknowledgmentRequired && <div className="text-xs text-blue-600 mt-1">Ack Req.</div>}
                    </td>
                    <td className="p-4">
                      <Badge variant="outline" className={
                        lesson.status === 'Published' ? 'bg-green-100 text-green-800' :
                        lesson.status === 'Draft' ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100'
                      }>
                        {lesson.status}
                      </Badge>
                    </td>
                    <td className="p-4">
                      <Button variant="ghost" size="sm" onClick={() => { setCurrentLesson(lesson); setEditDialog(true); }}>
                        <Edit className="w-4 h-4 mr-2" /> Edit
                      </Button>
                    </td>
                  </tr>
                ))}
                {filteredLessons.length === 0 && (
                  <tr>
                    <td colSpan="5" className="p-8 text-center text-gray-500">No lessons found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Dialog open={editDialog} onOpenChange={setEditDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{currentLesson?.id ? 'Edit Lesson' : 'Create New Lesson'}</DialogTitle>
          </DialogHeader>
          
          {currentLesson && (
            <div className="space-y-6 mt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Title *</Label>
                  <Input value={currentLesson.title} onChange={e => setCurrentLesson({...currentLesson, title: e.target.value})} />
                </div>
                <div>
                  <Label>Category</Label>
                  <Input value={currentLesson.category} onChange={e => setCurrentLesson({...currentLesson, category: e.target.value})} placeholder="e.g. Fall Hazard, Vehicle Safety" />
                </div>
                <div>
                  <Label>Related Project</Label>
                  <Input value={currentLesson.relatedProject} onChange={e => setCurrentLesson({...currentLesson, relatedProject: e.target.value})} />
                </div>
                <div>
                  <Label>Incident Date</Label>
                  <Input type="date" value={currentLesson.incidentDate} onChange={e => setCurrentLesson({...currentLesson, incidentDate: e.target.value})} />
                </div>
              </div>

              <div>
                <Label>What Happened *</Label>
                <Textarea rows={3} value={currentLesson.whatHappened} onChange={e => setCurrentLesson({...currentLesson, whatHappened: e.target.value})} />
              </div>
              
              <div>
                <Label>How It Happened / Root Cause</Label>
                <Textarea rows={2} value={currentLesson.howItHappened} onChange={e => setCurrentLesson({...currentLesson, howItHappened: e.target.value})} />
              </div>

              <div>
                <Label>Preventive Action Going Forward *</Label>
                <Textarea rows={3} value={currentLesson.preventiveAction} onChange={e => setCurrentLesson({...currentLesson, preventiveAction: e.target.value})} />
              </div>

              <div>
                <Label>Training / PPE Reminder</Label>
                <Textarea rows={2} value={currentLesson.requiredPpeOrTrainingReminder} onChange={e => setCurrentLesson({...currentLesson, requiredPpeOrTrainingReminder: e.target.value})} />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t pt-4">
                <div>
                  <Label>Audience *</Label>
                  <Select value={currentLesson.audience} onValueChange={v => setCurrentLesson({...currentLesson, audience: v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="All Contractors">All Contractors</SelectItem>
                      <SelectItem value="PMs Only">PMs Only</SelectItem>
                      <SelectItem value="QC Only">QC Only</SelectItem>
                      <SelectItem value="Admin Only">Admin Only</SelectItem>
                      <SelectItem value="Specific Project">Specific Project</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Status *</Label>
                  <Select value={currentLesson.status} onValueChange={v => setCurrentLesson({...currentLesson, status: v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Draft">Draft</SelectItem>
                      <SelectItem value="Published">Published</SelectItem>
                      <SelectItem value="Archived">Archived</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center space-x-2 pt-6">
                  <Checkbox 
                    id="ackReq" 
                    checked={currentLesson.acknowledgmentRequired} 
                    onCheckedChange={c => setCurrentLesson({...currentLesson, acknowledgmentRequired: c})} 
                  />
                  <Label htmlFor="ackReq">Require Acknowledgment</Label>
                </div>
              </div>

            </div>
          )}

          <DialogFooter className="mt-6 border-t pt-4">
            <Button variant="outline" onClick={() => setEditDialog(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={!currentLesson?.title || !currentLesson?.whatHappened || !currentLesson?.preventiveAction}>
              Save Lesson
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}