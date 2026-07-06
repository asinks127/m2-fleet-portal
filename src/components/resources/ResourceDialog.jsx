import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FileDown, ExternalLink, Play, Mail, Phone, ThumbsUp, ThumbsDown } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

export default function ResourceDialog({ resource, open, onOpenChange }) {
  const [feedbackState, setFeedbackState] = useState({ submitted: false, helpful: null, showText: false, text: '' });

  React.useEffect(() => {
    if (open && resource?.id) {
       base44.entities.ResourceLibrary.update(resource.id, { viewCount: (resource.viewCount || 0) + 1 }).catch(() => {});
    }
  }, [open, resource]);

  useEffect(() => {
    setFeedbackState({ submitted: false, helpful: null, showText: false, text: '' });
  }, [resource?.id]);

  if (!resource) return null;

  const handleDownload = (url) => {
    window.open(url, '_blank');
  };

  const handleFeedback = async (isHelpful) => {
    if (isHelpful) {
      await base44.entities.ResourceFeedback.create({
        resourceId: resource.id,
        userEmail: (await base44.auth.me().catch(()=>null))?.email || 'unknown',
        helpful: true,
      });
      setFeedbackState({ submitted: true, helpful: true, showText: false, text: '' });
      toast.success("Thanks for your feedback!");
    } else {
      setFeedbackState({ ...feedbackState, showText: true, helpful: false });
    }
  };

  const submitNegativeFeedback = async () => {
    await base44.entities.ResourceFeedback.create({
      resourceId: resource.id,
      userEmail: (await base44.auth.me().catch(()=>null))?.email || 'unknown',
      helpful: false,
      feedbackText: feedbackState.text,
    });
    setFeedbackState({ ...feedbackState, submitted: true, showText: false });
    toast.success("Thanks for your feedback!");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="outline">{resource.resourceType}</Badge>
            {resource.category && <Badge className="bg-blue-50 text-blue-700">{resource.category}</Badge>}
            {resource.featured && <Badge className="bg-amber-100 text-amber-800">Featured</Badge>}
          </div>
          <DialogTitle className="text-2xl">{resource.title}</DialogTitle>
          <DialogDescription>
            Added: {new Date(resource.created_date).toLocaleDateString()}
            {resource.viewCount > 0 && ` • Views: ${resource.viewCount}`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          
          {resource.videoLink && (
            <div className="aspect-video bg-black rounded-lg overflow-hidden flex items-center justify-center relative group">
              {resource.videoLink.includes('youtube.com') || resource.videoLink.includes('vimeo.com') ? (
                <iframe 
                  src={resource.videoLink} 
                  className="w-full h-full border-0" 
                  allowFullScreen 
                  title={resource.title}
                />
              ) : (
                <div className="text-center p-6">
                  <Play className="w-12 h-12 text-white/50 mx-auto mb-2" />
                  <a href={resource.videoLink} target="_blank" rel="noreferrer" className="text-blue-400 hover:underline">
                    Watch Video Externally
                  </a>
                </div>
              )}
            </div>
          )}

          {resource.content && (
            <div 
              className="prose max-w-none text-gray-700 bg-gray-50/50 p-6 rounded-xl border border-gray-100" 
              dangerouslySetInnerHTML={{ __html: resource.content }} 
            />
          )}

          {resource.resourceType === 'Contact' && (
             <div className="bg-gray-50 p-6 rounded-xl border flex flex-col sm:flex-row gap-6">
                <div className="flex-1">
                   <h3 className="text-lg font-semibold text-gray-900 mb-1">{resource.contactName || resource.title}</h3>
                   <p className="text-gray-500 mb-4">{resource.category}</p>
                   <div className="space-y-2">
                      {resource.contactEmail && (
                        <a href={`mailto:${resource.contactEmail}`} className="flex items-center text-blue-600 hover:underline font-medium">
                          <Mail className="w-4 h-4 mr-2" /> {resource.contactEmail}
                        </a>
                      )}
                      {resource.contactPhone && (
                        <a href={`tel:${resource.contactPhone}`} className="flex items-center text-blue-600 hover:underline font-medium">
                          <Phone className="w-4 h-4 mr-2" /> {resource.contactPhone}
                        </a>
                      )}
                   </div>
                </div>
             </div>
          )}

          {(resource.device || resource.vehicleType || resource.project) && (
            <div className="grid grid-cols-2 gap-4 bg-blue-50/50 p-4 rounded-lg border border-blue-100">
              {resource.device && <div><span className="text-gray-500 text-sm block mb-1">Device</span> <p className="font-medium text-gray-900">{resource.device}</p></div>}
              {resource.vehicleType && <div><span className="text-gray-500 text-sm block mb-1">Vehicle</span> <p className="font-medium text-gray-900">{resource.vehicleType}</p></div>}
              {resource.project && <div><span className="text-gray-500 text-sm block mb-1">Project</span> <p className="font-medium text-gray-900">{resource.project}</p></div>}
              {resource.customer && <div><span className="text-gray-500 text-sm block mb-1">Customer</span> <p className="font-medium text-gray-900">{resource.customer}</p></div>}
            </div>
          )}

          {resource.attachments && resource.attachments.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold mb-3">Attachments</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {resource.attachments.map((url, idx) => {
                  const fileName = url.split('/').pop().split('?')[0] || `Attachment ${idx + 1}`;
                  return (
                    <Button 
                      key={idx} 
                      variant="outline" 
                      className="justify-start h-auto py-3 px-4 hover:bg-blue-50 hover:border-blue-200 transition-colors" 
                      onClick={() => handleDownload(url)}
                    >
                      <FileDown className="w-5 h-5 mr-3 text-blue-500 shrink-0" />
                      <span className="truncate">{fileName}</span>
                    </Button>
                  );
                })}
              </div>
            </div>
          )}

          {resource.tags && resource.tags.length > 0 && (
            <div className="pt-6 border-t mt-6">
              <h4 className="text-sm font-medium text-gray-500 mb-3">Tags</h4>
              <div className="flex flex-wrap gap-2">
                {resource.tags.map((tag, idx) => (
                  <Badge key={idx} variant="secondary" className="bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors">#{tag}</Badge>
                ))}
              </div>
            </div>
          )}

          {/* Feedback Section */}
          <div className="pt-6 border-t mt-6 bg-gray-50/50 p-6 rounded-xl border border-gray-100">
            <h4 className="text-lg font-medium text-gray-900 mb-4 text-center">Was this helpful?</h4>
            {!feedbackState.submitted && !feedbackState.showText && (
              <div className="flex justify-center gap-4">
                <Button variant="outline" className="flex items-center gap-2 hover:bg-green-50 hover:text-green-700 hover:border-green-200" onClick={() => handleFeedback(true)}>
                  <ThumbsUp className="w-4 h-4" /> Helpful
                </Button>
                <Button variant="outline" className="flex items-center gap-2 hover:bg-red-50 hover:text-red-700 hover:border-red-200" onClick={() => handleFeedback(false)}>
                  <ThumbsDown className="w-4 h-4" /> Not Helpful
                </Button>
              </div>
            )}
            
            {!feedbackState.submitted && feedbackState.showText && (
              <div className="space-y-3 max-w-md mx-auto">
                <Textarea 
                  placeholder="How can we improve this resource? (Optional)" 
                  value={feedbackState.text}
                  onChange={(e) => setFeedbackState({...feedbackState, text: e.target.value})}
                  className="bg-white"
                />
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" onClick={() => setFeedbackState({...feedbackState, showText: false, helpful: null})}>Cancel</Button>
                  <Button onClick={submitNegativeFeedback}>Submit Feedback</Button>
                </div>
              </div>
            )}

            {feedbackState.submitted && (
              <div className="text-center text-green-600 font-medium py-2">
                Thank you for your feedback! It helps us improve our resources.
              </div>
            )}
          </div>
          
        </div>
      </DialogContent>
    </Dialog>
  );
}