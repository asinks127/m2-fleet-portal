import React, { useState, useEffect } from 'react';
import { getVeloSurveyData, submitVeloSurveyResponse } from '@/functions.js';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Textarea } from '@/components/ui/textarea.jsx';
import { Alert, AlertDescription } from '@/components/ui/alert.jsx';
import { Star, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
// It's designed for external Velo PMs who are NOT users of our system

const StarRating = ({ rating, onRatingChange, label }) => {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-gray-700">{label}</label>
      <div className="flex items-center space-x-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => onRatingChange(star)}
            className="focus:outline-none"
          >
            <Star
              className={`w-8 h-8 transition-colors ${
                star <= rating
                  ? 'text-yellow-400 fill-yellow-400'
                  : 'text-gray-300 hover:text-yellow-200'
              }`}
            />
          </button>
        ))}
        <span className="ml-3 text-sm text-gray-600">({rating}/5)</span>
      </div>
    </div>
  );
};

export default function Survey() {
  const [surveyData, setSurveyData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [responses, setResponses] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    // Extract token from URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const surveyToken = urlParams.get('token');
    
    console.log('Survey page loaded with token:', surveyToken ? 'present' : 'missing');

    if (!surveyToken) {
      setError('Invalid survey link. Please check the URL and try again.');
      setIsLoading(false);
      return;
    }

    loadSurveyData(surveyToken);
  }, []);

  const loadSurveyData = async (token) => {
    try {
      console.log('Loading survey data for token:', token);
      const response = await getVeloSurveyData({ surveyToken: token });
      
      console.log('Survey data response:', response);
      
      if (response.data && response.data.success) {
        const { survey, technicians } = response.data;
        setSurveyData({ survey, technicians });
        
        // Initialize responses array
        const initialResponses = technicians.map(tech => ({
          technicianId: tech.id,
          technicianName: tech.displayName,
          communicationSkills: 5,
          availability: 5,
          installQuality: 5,
          reliability: 5,
          problemSolving: 5,
          safetyCompliance: 5,
          overallPerformance: 5,
          additionalNotes: ''
        }));
        setResponses(initialResponses);
      } else {
        throw new Error(response.data?.error || 'Failed to load survey data');
      }
    } catch (err) {
      console.error('Error loading survey:', err);
      setError(err.message || 'Failed to load survey. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const updateResponse = (techIndex, field, value) => {
    const newResponses = [...responses];
    newResponses[techIndex] = {
      ...newResponses[techIndex],
      [field]: value
    };
    setResponses(newResponses);
  };

  const handleSubmit = async () => {
    if (!surveyData?.survey) {
      setError('Survey data not available');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await submitVeloSurveyResponse({
        surveyToken: surveyData.survey.surveyToken,
        responses: responses
      });

      if (response.data && response.data.success) {
        setSubmitted(true);
      } else {
        throw new Error(response.data?.error || 'Failed to submit survey');
      }
    } catch (err) {
      console.error('Error submitting survey:', err);
      setError(err.message || 'Failed to submit survey. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <Card className="max-w-md mx-auto text-center">
          <CardContent className="p-8">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Thank You!</h2>
            <p className="text-gray-600">
              Your feedback has been submitted successfully. We appreciate your time and input.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-gray-900">Loading Survey</h2>
          <p className="text-gray-600">Please wait...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <Card className="max-w-md mx-auto">
          <CardContent className="p-8 text-center">
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-gray-900 mb-2">Survey Error</h2>
            <p className="text-red-600 mb-4">{error}</p>
            <Button onClick={() => window.location.reload()}>
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!surveyData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <Card className="max-w-md mx-auto">
          <CardContent className="p-8 text-center">
            <AlertCircle className="w-16 h-16 text-orange-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-gray-900 mb-2">No Survey Data</h2>
            <p className="text-gray-600">Unable to load survey information.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Technician Performance Survey
          </h1>
          <p className="text-lg text-gray-600">Project: {surveyData.survey.projectName}</p>
          <p className="text-sm text-gray-500 mt-2">
            Please rate each technician on a scale of 1-5 stars (5 being excellent)
          </p>
        </div>

        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-8">
          {responses.map((response, index) => {
            const technician = surveyData.technicians[index];
            return (
              <Card key={technician.id} className="bg-white shadow-sm">
                <CardHeader className="border-b border-gray-100">
                  <CardTitle className="text-xl text-gray-900">
                    {technician.displayName}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-6">
                      <StarRating
                        label="Communication Skills"
                        rating={response.communicationSkills}
                        onRatingChange={(rating) => updateResponse(index, 'communicationSkills', rating)}
                      />
                      <StarRating
                        label="Availability"
                        rating={response.availability}
                        onRatingChange={(rating) => updateResponse(index, 'availability', rating)}
                      />
                      <StarRating
                        label="Installation Quality"
                        rating={response.installQuality}
                        onRatingChange={(rating) => updateResponse(index, 'installQuality', rating)}
                      />
                      <StarRating
                        label="Reliability"
                        rating={response.reliability}
                        onRatingChange={(rating) => updateResponse(index, 'reliability', rating)}
                      />
                    </div>
                    <div className="space-y-6">
                      <StarRating
                        label="Problem Solving"
                        rating={response.problemSolving}
                        onRatingChange={(rating) => updateResponse(index, 'problemSolving', rating)}
                      />
                      <StarRating
                        label="Safety Compliance"
                        rating={response.safetyCompliance}
                        onRatingChange={(rating) => updateResponse(index, 'safetyCompliance', rating)}
                      />
                      <StarRating
                        label="Overall Performance"
                        rating={response.overallPerformance}
                        onRatingChange={(rating) => updateResponse(index, 'overallPerformance', rating)}
                      />
                    </div>
                  </div>
                  <div className="mt-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Additional Notes (Optional)
                    </label>
                    <Textarea
                      value={response.additionalNotes}
                      onChange={(e) => updateResponse(index, 'additionalNotes', e.target.value)}
                      placeholder="Any additional comments about this technician's performance..."
                      rows={3}
                    />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="mt-8 text-center">
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="bg-blue-600 hover:bg-blue-700 px-8 py-3 text-lg"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Submitting Survey...
              </>
            ) : (
              'Submit Survey'
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}