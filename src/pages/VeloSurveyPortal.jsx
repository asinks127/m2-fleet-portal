import React, { useState, useEffect } from 'react';
import { VeloSurvey, User } from '@/api/entities.js';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Loader2, Star, CheckCircle, Clock, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils/index.js';
import { format } from 'date-fns';

export default function VeloSurveyPortal() {
  const [user, setUser] = useState(null);
  const [pendingSurveys, setPendingSurveys] = useState([]);
  const [completedSurveys, setCompletedSurveys] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        const currentUser = await User.me();
        setUser(currentUser);

        if (!currentUser?.email) {
          throw new Error('Could not identify user.');
        }

        const allSurveys = await VeloSurvey.filter({ veloPMEmail: currentUser.email }, '-sentDate');
        
        const pending = allSurveys.filter(s => s.status !== 'completed');
        const completed = allSurveys.filter(s => s.status === 'completed');

        setPendingSurveys(pending);
        setCompletedSurveys(completed);

      } catch (err) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, []);

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto" />
          <p className="mt-4 text-lg text-gray-700">Loading Your Survey Portal...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-center text-red-500">
        <p>Error: {error}</p>
        <p>Please try refreshing the page.</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 bg-gray-50 min-h-screen">
      <div className="max-w-6xl mx-auto">
        <header className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900">Velo PM Survey Portal</h1>
          <p className="text-lg text-gray-600 mt-1">
            Welcome, {user?.full_name || user?.email}. Here are your assigned performance surveys.
          </p>
        </header>

        {/* Pending Surveys */}
        <Card className="mb-8 border-blue-200 shadow-md">
          <CardHeader>
            <CardTitle className="text-2xl flex items-center gap-3 text-blue-800">
              <Clock className="w-7 h-7" />
              Pending Surveys ({pendingSurveys.length})
            </CardTitle>
            <CardDescription>
              These projects are awaiting your feedback on technician performance.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {pendingSurveys.length > 0 ? (
              <div className="space-y-4">
                {pendingSurveys.map(survey => (
                  <div key={survey.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 rounded-lg bg-white border hover:shadow-sm transition-shadow">
                    <div>
                      <p className="font-semibold text-lg text-gray-800">{survey.projectName}</p>
                      <p className="text-sm text-gray-500 mt-1">
                        Assigned on: {format(new Date(survey.sentDate), 'MMMM d, yyyy')}
                      </p>
                    </div>
                    <Link to={createPageUrl(`Survey?token=${survey.surveyToken}`)} target="_blank">
                      <Button className="mt-3 sm:mt-0 bg-blue-600 hover:bg-blue-700">
                        <Star className="w-4 h-4 mr-2" />
                        Start Survey
                        <ExternalLink className="w-4 h-4 ml-2" />
                      </Button>
                    </Link>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-10">
                <CheckCircle className="w-12 h-12 mx-auto text-green-500 mb-3" />
                <p className="text-gray-600 font-medium">All caught up!</p>
                <p className="text-sm text-gray-500">You have no pending surveys.</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Completed Surveys */}
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl flex items-center gap-3 text-gray-700">
              <CheckCircle className="w-7 h-7" />
              Completed Surveys ({completedSurveys.length})
            </CardTitle>
            <CardDescription>A history of the surveys you have completed.</CardDescription>
          </CardHeader>
          <CardContent>
            {completedSurveys.length > 0 ? (
              <div className="space-y-3">
                {completedSurveys.map(survey => (
                  <div key={survey.id} className="flex items-center justify-between p-3 rounded-lg bg-gray-100">
                    <p className="font-medium text-gray-700">{survey.projectName}</p>
                    <div className="text-sm text-gray-500 flex items-center gap-2">
                       <Badge variant="secondary" className="bg-green-100 text-green-800">Completed</Badge>
                       <span>{format(new Date(survey.completedDate), 'MMMM d, yyyy')}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-10 text-gray-500">
                <p>No surveys completed yet.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}