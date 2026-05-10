import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Search, BookOpen, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/components/ui/use-toast';

export default function LessonsLearned() {
  const { toast } = useToast();
  const [lessons, setLessons] = useState([]);
  const [acknowledgments, setAcknowledgments] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [user, setUser] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const me = await base44.auth.me();
      setUser(me);

      const [allLessons, acks] = await Promise.all([
        base44.entities.SafetyLessonLearned.filter({ status: 'Published' }, '-dateAdded'),
        base44.entities.SafetyLessonAcknowledgment.filter({ contractorEmail: me.email })
      ]);

      // Only show lessons for 'All Contractors' or a Specific Project (this logic could be more robust if contractor projects are known)
      // For now, let's assume contractors can see 'All Contractors' and 'Specific Project'
      const visibleLessons = allLessons.filter(l => 
        l.audience === 'All Contractors' || l.audience === 'Specific Project'
      );

      setLessons(visibleLessons || []);
      setAcknowledgments(new Set(acks.map(a => a.lessonId)));
    } catch (error) {
      console.error('Error fetching lessons:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAcknowledge = async (lessonId) => {
    try {
      await base44.entities.SafetyLessonAcknowledgment.create({
        lessonId,
        contractorId: user.id,
        contractorEmail: user.email,
        contractorName: user.full_name || user.email,
        acknowledgedAt: new Date().toISOString()
      });
      setAcknowledgments(prev => new Set(prev).add(lessonId));
      toast({ title: 'Success', description: 'Acknowledgment recorded.' });
    } catch (error) {
      console.error('Failed to acknowledge:', error);
      toast({ title: 'Error', description: 'Could not record acknowledgment.', variant: 'destructive' });
    }
  };

  const filteredLessons = lessons.filter(l => 
    l.title?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    l.category?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    l.whatHappened?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-green-600" /></div>;
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center">
          <BookOpen className="w-8 h-8 mr-3 text-green-600" />
          Safety Lessons Learned
        </h1>
        <p className="text-gray-600 mt-2">
          Review important safety bulletins, alerts, and lessons from past incidents to prevent future occurrences.
        </p>
      </div>

      <div className="relative max-w-md mb-8">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
        <Input 
          placeholder="Search lessons..." 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {filteredLessons.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center text-gray-500">
            <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <h3 className="text-xl font-medium text-gray-700">No lessons found</h3>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6">
          {filteredLessons.map((lesson) => (
            <Card key={lesson.id} className="overflow-hidden border-t-4 border-t-green-500">
              <CardHeader className="bg-green-50/50 pb-4">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="bg-green-100 text-green-800 border-green-200">
                        {lesson.category}
                      </Badge>
                      {lesson.incidentDate && (
                        <span className="text-xs text-gray-500">
                          Incident Date: {format(new Date(lesson.incidentDate), 'MMM d, yyyy')}
                        </span>
                      )}
                    </div>
                    <CardTitle className="text-xl">{lesson.title}</CardTitle>
                    {lesson.relatedProject && (
                      <p className="text-sm text-gray-600 mt-1">Project: {lesson.relatedProject}</p>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                
                <div>
                  <h4 className="font-semibold text-gray-900 border-b pb-1 mb-2">What Happened</h4>
                  <p className="text-gray-700 whitespace-pre-wrap">{lesson.whatHappened}</p>
                </div>
                
                {lesson.howItHappened && (
                  <div>
                    <h4 className="font-semibold text-gray-900 border-b pb-1 mb-2">How It Happened / Root Cause</h4>
                    <p className="text-gray-700 whitespace-pre-wrap">{lesson.howItHappened}</p>
                  </div>
                )}
                
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <h4 className="font-semibold text-green-900 mb-2">Prevention Steps</h4>
                  <p className="text-green-800 whitespace-pre-wrap">{lesson.preventiveAction}</p>
                </div>

                {lesson.requiredPpeOrTrainingReminder && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <h4 className="font-semibold text-yellow-900 mb-2">Training / PPE Reminder</h4>
                    <p className="text-yellow-800 whitespace-pre-wrap">{lesson.requiredPpeOrTrainingReminder}</p>
                  </div>
                )}

                {lesson.acknowledgmentRequired && (
                  <div className="pt-4 border-t mt-6">
                    {acknowledgments.has(lesson.id) ? (
                      <div className="flex items-center text-green-600 font-medium bg-green-50 p-3 rounded-lg">
                        <CheckCircle2 className="w-5 h-5 mr-2" />
                        You have acknowledged reading this lesson.
                      </div>
                    ) : (
                      <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div className="text-blue-900 text-sm font-medium">
                          Please acknowledge that you have read and understood this safety bulletin.
                        </div>
                        <Button 
                          onClick={() => handleAcknowledge(lesson.id)}
                          className="bg-blue-600 hover:bg-blue-700 whitespace-nowrap"
                        >
                          I have read and understood
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}