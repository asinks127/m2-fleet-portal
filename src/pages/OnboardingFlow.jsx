import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, FileText, CheckCircle2, ChevronRight, PenTool } from 'lucide-react';
import SignatureCanvas from 'react-signature-canvas';
import { useNavigate } from 'react-router-dom';

export default function OnboardingFlow() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [acknowledgedDocs, setAcknowledgedDocs] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const sigCanvas = useRef({});

  useEffect(() => {
    const init = async () => {
      try {
        const me = await base44.auth.me();
        setUser(me);

        // Check if already completed
        if (me.onboardingStatus === 'Completed') {
          navigate('/', { replace: true });
          return;
        }

        // Set status to In Progress if it was pending
        if (me.onboardingStatus !== 'In Progress') {
          await base44.auth.updateMe({ onboardingStatus: 'In Progress' });
        }

        const docs = await base44.entities.OnboardingDocument.filter({ type: 'contractor_facing', isRequired: true }, 'sortOrder');
        setDocuments(docs || []);
        
      } catch (error) {
        console.error(error);
        toast({ title: 'Error', description: 'Failed to load onboarding.', variant: 'destructive' });
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [navigate, toast]);

  const toggleAcknowledge = (docId) => {
    const newSet = new Set(acknowledgedDocs);
    if (newSet.has(docId)) newSet.delete(docId);
    else newSet.add(docId);
    setAcknowledgedDocs(newSet);
  };

  const allAcknowledged = documents.length > 0 && acknowledgedDocs.size === documents.length;

  const handleClearSignature = () => {
    sigCanvas.current.clear();
  };

  const handleCompleteOnboarding = async () => {
    if (documents.length > 0) {
      if (!allAcknowledged) {
        toast({ title: 'Missing Acknowledgements', description: 'Please read and acknowledge all documents.', variant: 'destructive' });
        return;
      }
      if (sigCanvas.current && sigCanvas.current.isEmpty()) {
        toast({ title: 'Signature Required', description: 'Please provide your signature before completing.', variant: 'destructive' });
        return;
      }
    }

    try {
      setSubmitting(true);
      
      const now = new Date().toISOString();
      
      if (documents.length > 0) {
        // 1. Record acknowledgements
        for (const docId of acknowledgedDocs) {
          const doc = documents.find(d => d.id === docId);
          await base44.entities.OnboardingCompletionRecord.create({
            contractorId: user.id,
            contractorEmail: user.email,
            documentId: docId,
            documentTitle: doc.title,
            acknowledgedAt: now
          });
        }

        // 2. Upload signature to drive/documents
        const dataUrl = sigCanvas.current.getTrimmedCanvas().toDataURL('image/png');
        const res = await fetch(dataUrl);
        const blob = await res.blob();
        const file = new File([blob], `onboarding_signature_${user.id}.png`, { type: 'image/png' });
        
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        
        // 3. Save signature as a Contractor Document
        await base44.entities.ContractorDocument.create({
          contractorId: user.id,
          fileName: 'Onboarding_Signature_Acknowledgement.png',
          fileUrl: file_url,
          mimeType: 'image/png',
          folder: 'Onboarding',
          uploadedBy: 'System Auto',
          uploadDate: now
        });
      }

      // 4. Update user profile to Completed
      await base44.auth.updateMe({
        onboardingStatus: 'Completed',
        onboardingRequired: false,
        signedOnboardingDate: now
      });

      toast({ title: 'Onboarding Complete!', description: 'Thank you. You will now be redirected to your dashboard.' });
      
      setTimeout(() => {
        window.location.href = '/ContractorDashboard';
      }, 1500);

    } catch (error) {
      console.error(error);
      toast({ title: 'Submission Error', description: 'Failed to complete onboarding. Please try again.', variant: 'destructive' });
      setSubmitting(false);
    }
  };

  if (loading) return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><Loader2 className="w-12 h-12 animate-spin text-blue-600" /></div>;

  if (documents.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6">
        <Card className="max-w-md w-full p-8 text-center space-y-4">
          <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto" />
          <h2 className="text-2xl font-bold">You're all set!</h2>
          <p className="text-gray-600">No onboarding documents are currently required.</p>
          <Button onClick={handleCompleteOnboarding} disabled={submitting} className="w-full mt-4">
            Continue to App
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight">Welcome Aboard!</h1>
          <p className="text-lg text-gray-600">Please review and acknowledge the following onboarding materials before continuing.</p>
        </div>

        <div className="space-y-6">
          {documents.map((doc, index) => (
            <Card key={doc.id} className={`overflow-hidden transition-all duration-300 border-l-4 ${acknowledgedDocs.has(doc.id) ? 'border-l-green-500' : 'border-l-blue-500'}`}>
              <CardContent className="p-6">
                <div className="flex flex-col md:flex-row justify-between gap-6">
                  <div className="flex-1 space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-bold text-sm">
                        {index + 1}
                      </div>
                      <h3 className="text-xl font-semibold text-gray-900">{doc.title}</h3>
                    </div>
                    {doc.description && <p className="text-gray-600 ml-11">{doc.description}</p>}
                    
                    <div className="ml-11">
                      <a href={doc.fileUrl} target="_blank" rel="noreferrer">
                        <Button variant="outline" className="gap-2">
                          <FileText className="w-4 h-4" /> Open Document
                        </Button>
                      </a>
                    </div>
                  </div>

                  <div className="flex items-center md:items-end justify-start md:justify-end">
                    <label className="flex items-center gap-3 cursor-pointer bg-gray-50 hover:bg-gray-100 p-4 rounded-lg border border-gray-200 transition-colors w-full md:w-auto">
                      <Checkbox 
                        checked={acknowledgedDocs.has(doc.id)} 
                        onCheckedChange={() => toggleAcknowledge(doc.id)} 
                        className="w-6 h-6 rounded-md"
                      />
                      <span className="font-medium text-gray-800 select-none">I have read & agree</span>
                    </label>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {allAcknowledged && (
          <Card className="animate-fade-in border-t-4 border-t-indigo-600 shadow-xl">
            <CardContent className="p-8 space-y-6 text-center">
              <div className="mx-auto w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 mb-2">
                <PenTool className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900">Final Signature</h2>
              <p className="text-gray-600">Please provide your signature below to confirm you have read and understood all onboarding materials.</p>
              
              <div className="border-2 border-dashed border-gray-300 rounded-xl bg-white relative max-w-lg mx-auto">
                <SignatureCanvas 
                  penColor="blue"
                  canvasProps={{className: 'signature-canvas w-full h-48 rounded-xl'}}
                  ref={sigCanvas} 
                />
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="absolute top-2 right-2 text-gray-400 hover:text-red-500" 
                  onClick={handleClearSignature}
                >
                  Clear
                </Button>
              </div>

              <div className="pt-6">
                <Button 
                  size="lg" 
                  className="w-full md:w-auto px-12 text-lg h-14 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700" 
                  onClick={handleCompleteOnboarding}
                  disabled={submitting}
                >
                  {submitting ? <Loader2 className="w-6 h-6 animate-spin mr-2" /> : <CheckCircle2 className="w-6 h-6 mr-2" />}
                  {submitting ? 'Submitting...' : 'Complete Onboarding'}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}