import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import { format } from 'date-fns';

export default function CorrectiveActions() {
  const { data: actions = [], isLoading } = useQuery({
    queryKey: ['correctiveActions'],
    queryFn: () => base44.entities.CorrectiveAction.list('-created_date', 100),
    initialData: [],
  });

  const getStatusColor = (status) => {
    switch (status) {
      case 'Closed':
      case 'Resolved': return 'bg-green-100 text-green-800';
      case 'In Progress': return 'bg-blue-100 text-blue-800';
      case 'Open': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Corrective Actions</h1>
        <p className="text-gray-600 mt-1">Track and manage resolutions for failed audit items</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Action Items</CardTitle>
          <CardDescription>Items flagged during audits that require resolution</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p>Loading...</p>
          ) : actions.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-lg border border-dashed">
              <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-3" />
              <h3 className="text-lg font-medium text-gray-900">No Action Required</h3>
              <p className="text-sm text-gray-500">There are no open corrective actions at this time.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {actions.map(action => (
                <div key={action.id} className="p-4 border rounded-lg hover:shadow-md transition-shadow bg-white flex flex-col md:flex-row gap-4 justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5 text-orange-500" />
                      <h4 className="font-semibold text-lg">{action.title}</h4>
                      <Badge className={getStatusColor(action.status)}>{action.status}</Badge>
                    </div>
                    <p className="text-gray-600 text-sm">{action.description}</p>
                    <div className="flex items-center gap-4 text-sm text-gray-500">
                      <span className="flex items-center gap-1"><Clock className="w-4 h-4" /> Due: {action.dueDate ? format(new Date(action.dueDate), 'MMM d, yyyy') : 'N/A'}</span>
                      <span>Owner: {action.ownerEmail}</span>
                    </div>
                  </div>
                  <div className="flex items-center">
                    <Button variant="outline">View Details</Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}