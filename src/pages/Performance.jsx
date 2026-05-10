import React, { useState, useEffect, useMemo } from 'react';
import { bulkUpdateScores } from '@/functions.js';
import { User } from '@/api/entities.js';
import { Input } from '@/components/ui/input.jsx';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select.jsx';
import { Button } from '@/components/ui/button.jsx'; // Added missing import
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils/index.js';
import {
  TrendingUp,
  Search,
  AlertCircle,
  Loader2,
  BarChart,
  UserCheck,
  Sparkles, // New import for bulk update button
  CheckCircle, // New import for success alert icon
  Activity
} from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from '@/components/ui/badge.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { ResponsiveContainer, BarChart as ReBarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';
import { Alert, AlertDescription } from '@/components/ui/alert.jsx'; // New import for status messages
import { supabase } from '@/lib/supabaseClient.js';
import PerformanceTrends from '../components/performance/PerformanceTrends';
import MonthlySummary from '../components/performance/MonthlySummary';

export default function Performance() {
  const [users, setUsers] = useState([]);
  const [inspections, setInspections] = useState([]);
  const [callLogs, setCallLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [projectFilter, setProjectFilter] = useState('all');
  const [sortConfig, setSortConfig] = useState('velocitiScore_desc');
  const [isUpdatingScores, setIsUpdatingScores] = useState(false); // State for bulk update loading
  const [updateStatus, setUpdateStatus] = useState(null); // State for bulk update success/error message

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [allUsers, allInspections, allCallLogs] = await Promise.all([
        User.list(),
        (await supabase.from('QCInspection').select('*') /* TODO: restore sorting/limit '-inspectionDate', 1000 */).data, // Fetch last 1000 inspections
        (await supabase.from('CallLog').select('*') /* TODO: restore sorting/limit '-callDate', 1000 */).data // Fetch last 1000 call logs
      ]);

      const contractors = allUsers.filter(user =>
        user.active && user.email && (
          user.email.toLowerCase().includes('.contractor@m2fleetcom.com') ||
          user.email.toLowerCase().includes('.contractor@smcinstallations.com')
        )
      );
      setUsers(contractors);
      setInspections(allInspections);
      setCallLogs(allCallLogs);
    } catch (err) {
      console.error('Error loading users:', err);
      setError('Failed to load performance data.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBulkUpdate = async () => {
    setIsUpdatingScores(true);
    setUpdateStatus(null); // Clear previous status
    try {
      // Assuming bulkUpdateScores is a function that makes an API call
      // and returns a promise resolving to { data: { success: boolean, message?: string, error?: string } }
      const { data } = await bulkUpdateScores();
      if (data.success) {
        setUpdateStatus({ type: 'success', message: data.message || 'Scores updated successfully.' });
        await loadUsers(); // Refresh the data after successful update
      } else {
        throw new Error(data.error || 'An unknown error occurred during update.');
      }
    } catch (err) {
      console.error('Failed to bulk update scores:', err);
      // Ensure err.message is accessible; if not, provide a fallback.
      setUpdateStatus({ type: 'error', message: err.message || 'Failed to update scores. Please try again.' });
    } finally {
      setIsUpdatingScores(false);
    }
  };

  const projects = useMemo(() => {
    const projectList = users.map(u => u.project).filter(Boolean);
    return ['all', ...new Set(projectList)].sort();
  }, [users]);

  const getScoreColor = (score) => {
    if (score >= 90) return 'bg-green-100 text-green-800';
    if (score >= 70) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  const filteredUsers = useMemo(() => {
    let sortedUsers = users.filter(user => {
      const searchLower = searchTerm.toLowerCase();
      const searchMatch = (user.full_name || '').toLowerCase().includes(searchLower) ||
                          (user.email || '').toLowerCase().includes(searchLower);

      const projectMatch = projectFilter === 'all' || user.project === projectFilter;

      return searchMatch && projectMatch;
    });

    const [key, direction] = sortConfig.split('_');
    sortedUsers.sort((a, b) => {
      let valA, valB;

      if (key === 'name') {
        valA = a.displayName || a.full_name || a.email || '';
        valB = b.displayName || b.full_name || b.email || '';
      } else {
        valA = a[key] || 0;
        valB = b[key] || 0;
      }

      const comparison = valA > valB ? 1 : valA < valB ? -1 : 0;
      return direction === 'asc' ? comparison : -comparison;
    });

    return sortedUsers;
  }, [users, searchTerm, projectFilter, sortConfig]);

  const scoreDistribution = useMemo(() => {
    const ranges = { '0-69': 0, '70-89': 0, '90-100': 0 };
    filteredUsers.forEach(user => {
      const score = user.velocitiScore || 0;
      if (score >= 90) ranges['90-100']++;
      else if (score >= 70) ranges['70-89']++;
      else ranges['0-69']++;
    });
    return [
      { name: '0-69', techs: ranges['0-69'], fill: '#fecaca' },
      { name: '70-89', techs: ranges['70-89'], fill: '#fef08a' },
      { name: '90-100', techs: ranges['90-100'], fill: '#bbf7d0' },
    ];
  }, [filteredUsers]);

  if (error) {
    return (
      <div className="p-6 text-center text-red-600">
        <AlertCircle className="w-8 h-8 mx-auto mb-2" />
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
          <TrendingUp className="w-8 h-8" />
          <span>Performance Dashboard</span>
        </h1>
        <p className="text-gray-600 mt-1">Review technician performance scores and metrics.</p>
      </div>

      {updateStatus && (
        <Alert variant={updateStatus.type === 'error' ? 'destructive' : 'default'}>
          {updateStatus.type === 'success' && <CheckCircle className="h-4 w-4" />}
          {updateStatus.type === 'error' && <AlertCircle className="h-4 w-4" />}
          <AlertDescription>{updateStatus.message}</AlertDescription>
        </Alert>
      )}

      {/* Key Metrics Cards */}
      <div className="grid md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-gray-500">Avg QC Score (All Time)</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold flex items-center gap-2">
              {inspections.length > 0 
                ? Math.round(inspections.reduce((sum, i) => sum + (i.score || 0), 0) / inspections.length) 
                : 0}%
              <Activity className="h-4 w-4 text-green-500" />
            </div>
            <p className="text-xs text-gray-500 mt-1">{inspections.length} total inspections</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-gray-500">Total Inspections</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{inspections.length}</div>
            <p className="text-xs text-gray-500 mt-1">Across all technicians</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-gray-500">Calls Logged</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{callLogs.length}</div>
            <p className="text-xs text-gray-500 mt-1">Total support calls</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-gray-500">Top Performer</CardTitle></CardHeader>
          <CardContent>
             {filteredUsers.length > 0 ? (
                <div>
                    <p className="font-bold truncate" title={filteredUsers[0].displayName || filteredUsers[0].full_name}>
                      {filteredUsers[0].displayName || filteredUsers[0].full_name?.split(' ')[0]}
                    </p>
                    <p className={`text-xl font-bold ${getScoreColor(filteredUsers[0].velocitiScore).replace('bg-', 'text-')}`}>
                      {filteredUsers[0].velocitiScore} Score
                    </p>
                </div>
             ) : <p>No data</p>}
          </CardContent>
        </Card>
      </div>

      {/* Performance Trends Charts */}
      <PerformanceTrends inspections={inspections} callLogs={callLogs} />

      {/* Monthly Summary */}
      <MonthlySummary users={users} inspections={inspections} callLogs={callLogs} />

      <h2 className="text-xl font-bold text-gray-900 mt-8 mb-4">Technician Roster</h2>

      <div className="bg-white p-4 rounded-lg shadow-md border flex flex-col lg:flex-row gap-4 flex-wrap items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
          <Input placeholder="Search by name or email..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9" />
        </div>
        <div className="w-full lg:w-auto lg:min-w-[180px]">
          <Select value={projectFilter} onValueChange={setProjectFilter}>
            <SelectTrigger><SelectValue placeholder="Filter by project" /></SelectTrigger>
            <SelectContent>
              {projects.map(p => <SelectItem key={p} value={p}>{p === 'all' ? 'All Projects' : p}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="w-full lg:w-auto lg:min-w-[180px]">
          <Select value={sortConfig} onValueChange={setSortConfig}>
            <SelectTrigger><SelectValue placeholder="Sort by..." /></SelectTrigger>
            <SelectContent>
              <SelectItem value="velocitiScore_desc">Velociti Score (High-Low)</SelectItem>
              <SelectItem value="velocitiScore_asc">Velociti Score (Low-High)</SelectItem>
              <SelectItem value="name_asc">Name (A-Z)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button
          onClick={handleBulkUpdate}
          disabled={isUpdatingScores}
          className="bg-indigo-600 hover:bg-indigo-700 text-white"
        >
          {isUpdatingScores ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Sparkles className="w-4 h-4 mr-2" />
          )}
          Set Baseline Scores
        </Button>
      </div>

      <div className="bg-white rounded-lg shadow-md border overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center"><Loader2 className="w-8 h-8 mx-auto animate-spin text-blue-600" /></div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-gray-50">
                <TableRow>
                  <TableHead>Contractor</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead className="text-center">Velociti Score</TableHead>
                  <TableHead className="text-center">Avg QC Score</TableHead>
                  <TableHead className="text-center">Absences</TableHead>
                  <TableHead className="text-center">Late Arrivals</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.length > 0 ? filteredUsers.map(user => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <p className="font-medium">{user.displayName || user.full_name || user.email}</p>
                      <p className="text-sm text-gray-500">{user.email}</p>
                    </TableCell>
                    <TableCell>{user.project || 'N/A'}</TableCell>
                    <TableCell className="text-center"><Badge className={getScoreColor(user.velocitiScore)}>{user.velocitiScore || 0}</Badge></TableCell>
                    <TableCell className="text-center">{user.avgQcScore || 0}</TableCell>
                    <TableCell className="text-center">{user.absences || 0}</TableCell>
                    <TableCell className="text-center">{user.lateArrivals || 0}</TableCell>
                    <TableCell>
                      <Link to={createPageUrl(`ContractorProfile?id=${user.id}`)}>
                        <Button variant="outline" size="sm">View Profile</Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                )) : (
                  <TableRow><TableCell colSpan={7} className="text-center h-24">No contractors found.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}