import React, { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient.js';
import { Card, CardContent } from '@/components/ui/card.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Loader2, AlertTriangle, CheckCircle, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button.jsx';

export default function AlertLogPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const params = new URLSearchParams(location.search);
  const severityFilter = params.get('severity') || 'all';
  const statusFilter = params.get('status') || 'all';
  const [logs, setLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchLogs = async () => {
    setIsLoading(true);
    try {
      const { data: alertLogs, error } = await supabase
        .from('AlertLog')
        .select('*')
        .order('created_date', { ascending: false })
        .limit(100);

      if (error) throw error;
      setLogs(alertLogs || []);
    } catch (error) {
      console.error('Failed to fetch alert logs:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const visibleLogs = useMemo(() => logs.filter(log => {
    const severity = String(log.severity || '').toLowerCase();
    const status = String(log.status || '').toLowerCase();
    const unresolved = !['resolved', 'closed', 'dismissed'].includes(status) && log.resolved !== true;
    return (severityFilter === 'all' || severity === severityFilter) &&
      (statusFilter !== 'unresolved' || unresolved);
  }), [logs, severityFilter, statusFilter]);

  const clearFilters = () => navigate(location.pathname, { replace: true });

  useEffect(() => {
    fetchLogs();
  }, []);

  return (
    <div className="p-6">
      {(severityFilter !== 'all' || statusFilter !== 'all') && (
        <div className="mb-6 flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          <span>Showing {severityFilter !== 'all' ? `${severityFilter} ` : ''}{statusFilter === 'unresolved' ? 'unresolved ' : ''}alerts ({visibleLogs.length}).</span>
          <Button variant="outline" size="sm" onClick={clearFilters}>Show all alerts</Button>
        </div>
      )}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">System Alert Log</h1>
          <p className="text-gray-600 mt-1">An audit trail of all automated performance alerts.</p>
        </div>
        <Button onClick={fetchLogs} variant="outline" disabled={isLoading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center items-center h-64">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
          ) : visibleLogs.length === 0 ? (
            <div className="text-center p-12 text-gray-500">
              <p>No alerts have been triggered yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="p-4 text-left font-semibold text-gray-600">Status</th>
                    <th className="p-4 text-left font-semibold text-gray-600">Date</th>
                    <th className="p-4 text-left font-semibold text-gray-600">Technician</th>
                    <th className="p-4 text-left font-semibold text-gray-600">Triggered By</th>
                    <th className="p-4 text-left font-semibold text-gray-600">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleLogs.map(log => (
                    <tr key={log.id} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="p-4">
                        <Badge variant={log.status === 'success' ? 'default' : 'destructive'} className={log.status === 'success' ? 'bg-green-100 text-green-800' : ''}>
                          {log.status === 'success' ? <CheckCircle className="w-3 h-3 mr-1" /> : <AlertTriangle className="w-3 h-3 mr-1" />}
                          {log.status}
                        </Badge>
                      </td>
                      <td className="p-4 text-gray-700 whitespace-nowrap">{format(new Date(log.created_date), 'MMM d, yyyy h:mm a')}</td>
                      <td className="p-4 text-gray-900 font-medium">{log.technicianName}</td>
                      <td className="p-4 text-gray-700">{log.triggeredBy}</td>
                      <td className="p-4 text-gray-700">
                        <p className="font-medium">{log.subject}</p>
                        {log.status === 'error' && <p className="text-red-600 text-xs mt-1">{log.errorMessage}</p>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}