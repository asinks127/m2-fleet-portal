import React, { useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BarChart, SearchX, ThumbsDown, BookOpen, AlertCircle, Lightbulb } from 'lucide-react';
import { differenceInDays } from 'date-fns';

export default function ResourceInsights() {
  const { data: logs = [] } = useQuery({
    queryKey: ['resourceSearchLogs'],
    queryFn: () => base44.entities.ResourceSearchLog.list('-created_date', 1000),
  });

  const { data: feedbacks = [] } = useQuery({
    queryKey: ['resourceFeedbacks'],
    queryFn: () => base44.entities.ResourceFeedback.list('-created_date', 1000),
  });

  const { data: resources = [] } = useQuery({
    queryKey: ['resourceLibraryAll'],
    queryFn: () => base44.entities.ResourceLibrary.list('-created_date', 1000),
  });

  const mostSearched = useMemo(() => {
    const counts = {};
    logs.forEach(l => {
      const kw = l.searchTerm?.toLowerCase();
      if (!kw) return;
      counts[kw] = (counts[kw] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 10);
  }, [logs]);

  const searchFailures = useMemo(() => {
    const counts = {};
    logs.filter(l => l.resultsReturned === 0).forEach(l => {
      const kw = l.searchTerm?.toLowerCase();
      if (!kw) return;
      if (!counts[kw]) counts[kw] = { count: 0, dates: [] };
      counts[kw].count += 1;
      counts[kw].dates.push(new Date(l.created_date));
    });
    return Object.entries(counts).sort((a, b) => b[1].count - a[1].count).slice(0, 10);
  }, [logs]);

  const suggestedArticles = useMemo(() => {
    const suggestions = [];
    const counts = {};
    const now = new Date();
    
    logs.filter(l => l.resultsReturned === 0).forEach(l => {
      const kw = l.searchTerm?.toLowerCase();
      if (!kw) return;
      const date = new Date(l.created_date);
      if (differenceInDays(now, date) <= 7) {
        counts[kw] = (counts[kw] || 0) + 1;
      }
    });

    Object.entries(counts).forEach(([kw, count]) => {
      if (count >= 5) {
        suggestions.push({ term: kw, count });
      }
    });
    
    return suggestions.sort((a, b) => b.count - a.count);
  }, [logs]);

  const lowestRatedResources = useMemo(() => {
    const stats = {};
    feedbacks.forEach(f => {
      if (!stats[f.resourceId]) stats[f.resourceId] = { helpful: 0, notHelpful: 0 };
      if (f.helpful) stats[f.resourceId].helpful += 1;
      else stats[f.resourceId].notHelpful += 1;
    });

    const resourcesWithStats = resources.map(r => {
      const s = stats[r.id] || { helpful: 0, notHelpful: 0 };
      const total = s.helpful + s.notHelpful;
      const rating = total > 0 ? (s.helpful / total) * 100 : 100; // Assume 100 if no votes
      return { ...r, stats: s, rating, totalVotes: total };
    }).filter(r => r.totalVotes > 0);

    return resourcesWithStats.sort((a, b) => a.rating - b.rating).slice(0, 10);
  }, [feedbacks, resources]);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center">
          <BarChart className="w-8 h-8 mr-3 text-blue-600" />
          Resource Intelligence
        </h1>
        <p className="text-gray-600 mt-2">Analyze search behavior and resource feedback to improve documentation.</p>
      </div>

      {suggestedArticles.length > 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <CardHeader>
            <CardTitle className="flex items-center text-amber-800">
              <Lightbulb className="w-5 h-5 mr-2" />
              Suggested Articles Needed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-amber-700 mb-4">Based on our rules, the following terms have been searched with 0 results 5+ times in the last 7 days.</p>
            <div className="flex flex-wrap gap-3">
              {suggestedArticles.map((s, idx) => (
                <Badge key={idx} className="bg-amber-100 text-amber-800 border-amber-300 py-1.5 px-3">
                  "{s.term}" - {s.count} failed searches
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <SearchX className="w-5 h-5 mr-2 text-red-500" />
              Top Search Failures
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Search Term</TableHead>
                  <TableHead className="text-right">Failed Attempts</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {searchFailures.map(([term, data], idx) => (
                  <TableRow key={idx}>
                    <TableCell className="font-medium">"{term}"</TableCell>
                    <TableCell className="text-right">
                      <Badge variant="destructive">{data.count}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {searchFailures.length === 0 && (
                  <TableRow><TableCell colSpan={2} className="text-center text-gray-500 py-4">No failed searches logged.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <ThumbsDown className="w-5 h-5 mr-2 text-orange-500" />
              Resources Needing Improvement
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Resource Title</TableHead>
                  <TableHead className="text-right">Feedback</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lowestRatedResources.map((r, idx) => (
                  <TableRow key={idx}>
                    <TableCell>
                      <p className="font-medium line-clamp-1">{r.title}</p>
                      <p className="text-xs text-gray-500">{r.category || r.resourceType}</p>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-col items-end text-xs">
                        <span className="text-red-600 font-semibold">{r.stats.notHelpful} Not Helpful</span>
                        <span className="text-green-600">{r.stats.helpful} Helpful</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {lowestRatedResources.length === 0 && (
                  <TableRow><TableCell colSpan={2} className="text-center text-gray-500 py-4">No negative feedback recorded.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <BookOpen className="w-5 h-5 mr-2 text-blue-500" />
              Most Searched Topics
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {mostSearched.map(([term, count], idx) => (
                <div key={idx} className="flex justify-between items-center border-b pb-2">
                  <span className="font-medium text-gray-700">"{term}"</span>
                  <Badge variant="secondary">{count} searches</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <AlertCircle className="w-5 h-5 mr-2 text-indigo-500" />
              Most Viewed Resources
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {resources.sort((a,b) => (b.viewCount||0) - (a.viewCount||0)).slice(0, 10).map((r, idx) => (
                <div key={idx} className="flex flex-col border-b pb-2">
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-gray-700 line-clamp-1 mr-4">{r.title}</span>
                    <Badge variant="outline">{r.viewCount || 0} views</Badge>
                  </div>
                  <span className="text-xs text-gray-500">{r.category}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Written Feedback</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {feedbacks.filter(f => f.feedbackText).sort((a, b) => new Date(b.created_date) - new Date(a.created_date)).slice(0, 5).map((f, idx) => {
              const res = resources.find(r => r.id === f.resourceId);
              return (
                <div key={idx} className="bg-gray-50 p-4 rounded-lg border border-gray-100">
                  <div className="flex justify-between mb-2">
                    <span className="font-medium text-gray-900">{res?.title || 'Unknown Resource'}</span>
                    <span className="text-xs text-gray-500">{new Date(f.created_date).toLocaleDateString()}</span>
                  </div>
                  <p className="text-sm text-gray-700 italic">"{f.feedbackText}"</p>
                  <p className="text-xs text-gray-500 mt-2">- {f.userEmail}</p>
                </div>
              )
            })}
            {feedbacks.filter(f => f.feedbackText).length === 0 && (
              <p className="text-center text-gray-500 py-4">No written feedback submitted yet.</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}