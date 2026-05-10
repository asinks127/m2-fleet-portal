import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, ClipboardList, Eye } from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function MySafetyReports() {
  const [hazards, setHazards] = useState([]);
  const [injuries, setInjuries] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchReports = async () => {
      try {
        const me = await base44.auth.me();
        if (!me) return;
        
        const [haz, inj] = await Promise.all([
          base44.entities.SafetyHazardReport.filter({ submittedByEmail: me.email }, '-submittedAt'),
          base44.entities.SafetyInjuryReport.filter({ submittedByEmail: me.email }, '-submittedAt')
        ]);
        
        setHazards(haz || []);
        setInjuries(inj || []);
      } catch (error) {
        console.error('Error fetching safety reports:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchReports();
  }, []);

  const getStatusColor = (status) => {
    if (status?.includes('Immediate')) return 'bg-red-100 text-red-800 border-red-200';
    if (status?.includes('Serious')) return 'bg-orange-100 text-orange-800 border-orange-200';
    if (status?.includes('Closed') || status?.includes('Resolved')) return 'bg-green-100 text-green-800 border-green-200';
    if (status?.includes('Review')) return 'bg-blue-100 text-blue-800 border-blue-200';
    return 'bg-gray-100 text-gray-800 border-gray-200';
  };

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>;
  }

  const allReports = [
    ...hazards.map(h => ({ ...h, _type: 'Hazard' })),
    ...injuries.map(i => ({ ...i, _type: 'Injury/Accident' }))
  ].sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">My Safety Reports</h1>
          <p className="text-gray-600 mt-1">View the status of your submitted hazard and injury reports.</p>
        </div>
        <Button variant="outline" onClick={() => navigate(createPageUrl('SafetyHome'))}>
          Back to Safety Home
        </Button>
      </div>

      {allReports.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center text-gray-500">
            <ClipboardList className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <h3 className="text-xl font-medium text-gray-700">No reports submitted yet</h3>
            <p className="mt-2">When you submit hazard or injury reports, they will appear here.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {allReports.map((report) => (
            <Card key={report.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-0">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 sm:p-6 gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="font-mono text-sm text-gray-500">{report.reportId}</span>
                      <Badge variant="outline" className={report._type === 'Hazard' ? 'bg-orange-50 text-orange-700' : 'bg-red-50 text-red-700'}>
                        {report._type}
                      </Badge>
                      <Badge variant="outline" className={getStatusColor(report.status)}>
                        {report.status}
                      </Badge>
                    </div>
                    <h3 className="text-lg font-semibold">{report.projectName} - {report.siteLocation}</h3>
                    <p className="text-sm text-gray-600 mt-1">
                      Submitted on {format(new Date(report.submittedAt), 'PPP p')}
                    </p>
                    <p className="text-sm text-gray-700 mt-2 line-clamp-2">
                      {report.description || report.incidentDescription}
                    </p>
                  </div>
                  <div className="shrink-0 w-full sm:w-auto">
                    <Button 
                      variant="outline" 
                      className="w-full sm:w-auto"
                      onClick={() => navigate(createPageUrl('SafetyReportDetail') + `?id=${report.id}&type=${report._type}`)}
                    >
                      <Eye className="w-4 h-4 mr-2" />
                      View Details
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}