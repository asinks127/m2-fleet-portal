import React, { useState, useEffect } from 'react';
import { JobOpening } from '@/api/entities.js';
import { useLocation, Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Textarea } from '@/components/ui/textarea.jsx';
import { Alert, AlertDescription } from '@/components/ui/alert.jsx';
import { ArrowLeft, Copy, CheckCircle, Loader2, FileText } from 'lucide-react';
import { createPageUrl } from '@/utils/index.js';

export default function JobPostingGenerator() {
  const location = useLocation();
  const [job, setJob] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [indeedPosting, setIndeedPosting] = useState('');
  const [linkedinPosting, setLinkedinPosting] = useState('');
  const [copiedField, setCopiedField] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const jobId = params.get('id');
    if (jobId) {
      loadJobAndGeneratePostings(jobId);
    }
  }, [location.search]);

  const loadJobAndGeneratePostings = async (jobId) => {
    setIsLoading(true);
    try {
      const jobs = await JobOpening.filter({ id: jobId });
      if (jobs.length > 0) {
        const jobData = jobs[0];
        setJob(jobData);
        generatePostings(jobData);
      }
    } catch (error) {
      console.error('Error loading job:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const generatePostings = (jobData) => {
    // Generate Indeed-optimized posting
    const indeedFormat = `${jobData.title}

Company: M2 Fleet
Location: ${jobData.location || 'Colorado'}
Employment Type: ${jobData.employmentType || 'Contractor'}

${jobData.description}

HOW TO APPLY:
Please send your resume and a brief introduction to our hiring team. We review applications on a rolling basis and will contact qualified candidates within 2-3 business days.

M2 Fleet is an equal opportunity employer committed to diversity and inclusion.`;

    // Generate LinkedIn-optimized posting
    const linkedinFormat = `🔧 ${jobData.title} Opportunity at M2 Fleet

📍 Location: ${jobData.location || 'Colorado'}
💼 Type: ${jobData.employmentType || 'Contractor'}

${jobData.description}

✅ Ready to join our growing team? Apply now!

#Hiring #${jobData.title.replace(/\s+/g, '')} #TechJobs #Colorado #M2Fleet`;

    setIndeedPosting(indeedFormat);
    setLinkedinPosting(linkedinFormat);
  };

  const copyToClipboard = async (text, field) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 flex justify-center items-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!job) {
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <AlertDescription>Job not found.</AlertDescription>
        </Alert>
        <Link to={createPageUrl('RecruitingDashboard')} className="mt-4 inline-block">
          <Button variant="outline">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <Link to={createPageUrl('RecruitingDashboard')}>
        <Button variant="outline">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Dashboard
        </Button>
      </Link>

      <div>
        <h1 className="text-3xl font-bold text-gray-900">Job Posting Generator</h1>
        <p className="text-gray-600 mt-1">
          Generated postings for: <strong>{job.title}</strong>
        </p>
      </div>

      <Alert>
        <FileText className="h-4 w-4" />
        <AlertDescription>
          Copy and paste these optimized job postings directly to Indeed, LinkedIn, or other job boards.
        </AlertDescription>
      </Alert>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Indeed Format
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyToClipboard(indeedPosting, 'indeed')}
              >
                {copiedField === 'indeed' ? (
                  <>
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 mr-2" />
                    Copy
                  </>
                )}
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={indeedPosting}
              onChange={(e) => setIndeedPosting(e.target.value)}
              rows={20}
              className="font-mono text-sm"
            />
            <p className="text-sm text-gray-500 mt-2">
              Optimized for Indeed's format with clear structure and professional tone.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              LinkedIn Format
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyToClipboard(linkedinPosting, 'linkedin')}
              >
                {copiedField === 'linkedin' ? (
                  <>
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 mr-2" />
                    Copy
                  </>
                )}
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={linkedinPosting}
              onChange={(e) => setLinkedinPosting(e.target.value)}
              rows={20}
              className="font-mono text-sm"
            />
            <p className="text-sm text-gray-500 mt-2">
              Optimized for LinkedIn with emojis, hashtags, and social media friendly format.
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Quick Tips for Job Board Success</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-2 gap-4 text-sm">
            <div>
              <h4 className="font-semibold mb-2">Indeed Tips:</h4>
              <ul className="space-y-1 text-gray-600">
                <li>• Use clear, descriptive job titles</li>
                <li>• Include salary range if possible</li>
                <li>• Add specific location details</li>
                <li>• Use bullet points for requirements</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-2">LinkedIn Tips:</h4>
              <ul className="space-y-1 text-gray-600">
                <li>• Use relevant hashtags</li>
                <li>• Keep it engaging and concise</li>
                <li>• Add emojis for visual appeal</li>
                <li>• Include a clear call to action</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}