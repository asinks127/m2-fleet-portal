import React, { useState, useEffect } from 'react';
import { VeloSurveyResponse } from '@/api/entities.js';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Star, Loader2, Mail } from 'lucide-react';
import { format } from 'date-fns';

const StarRatingDisplay = ({ rating }) => (
  <div className="flex items-center">
    {[...Array(5)].map((_, i) => (
      <Star
        key={i}
        className={`w-4 h-4 ${i < rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`}
      />
    ))}
  </div>
);

export default function VeloFeedbackTab({ technicianId }) {
  const [responses, setResponses] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (technicianId) {
      loadFeedback();
    }
  }, [technicianId]);

  const loadFeedback = async () => {
    setIsLoading(true);
    try {
      const feedbackData = await VeloSurveyResponse.filter({ technicianId }, '-submittedDate');
      setResponses(feedbackData);
    } catch (error) {
      console.error('Error loading Velo feedback:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin" /></div>;
  }

  if (responses.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <Mail className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p>No Velo PM feedback has been submitted for this technician yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {responses.map(response => (
        <Card key={response.id}>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle className="text-lg">
                Feedback from {format(new Date(response.submittedDate), 'MMMM d, yyyy')}
              </CardTitle>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg">{response.calculatedScore?.toFixed(2)}</span>
                <Star className="w-5 h-5 text-yellow-400 fill-yellow-400" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-4 mb-4">
              <div className="flex justify-between items-center text-sm"><span>Communication:</span> <StarRatingDisplay rating={response.communicationSkills} /></div>
              <div className="flex justify-between items-center text-sm"><span>Availability:</span> <StarRatingDisplay rating={response.availability} /></div>
              <div className="flex justify-between items-center text-sm"><span>Install Quality:</span> <StarRatingDisplay rating={response.installQuality} /></div>
              <div className="flex justify-between items-center text-sm"><span>Reliability:</span> <StarRatingDisplay rating={response.reliability} /></div>
              <div className="flex justify-between items-center text-sm"><span>Problem Solving:</span> <StarRatingDisplay rating={response.problemSolving} /></div>
              <div className="flex justify-between items-center text-sm"><span>Safety:</span> <StarRatingDisplay rating={response.safetyCompliance} /></div>
              <div className="flex justify-between items-center text-sm"><span>Overall:</span> <StarRatingDisplay rating={response.overallPerformance} /></div>
            </div>
            {response.additionalNotes && (
              <div className="mt-4 border-t pt-4">
                <h4 className="font-semibold mb-2">Additional Notes:</h4>
                <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded-md">{response.additionalNotes}</p>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}