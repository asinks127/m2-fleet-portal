
import React, { useState, useEffect } from 'react';
import { getMyTeamData, analyzeAtRiskTechnicians } from '@/functions.js';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils/index.js';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card.jsx'; // Added CardDescription
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Loader2, Users, TrendingUp, AlertTriangle, ClipboardList, FileWarning, CalendarClock, Eye } from 'lucide-react';

const StatCard = ({ title, value, icon }) => (
  <Card>
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium">{title}</CardTitle>
      {icon}
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-bold">{value}</div>
    </CardContent>
  </Card>
);

const AlertItem = ({ alert, type }) => (
  <div className="flex items-center justify-between p-2 rounded-md hover:bg-gray-50">
    <div className="flex items-center gap-3">
        {type === 'contract' ? <CalendarClock className="w-5 h-5 text-orange-500" /> : <FileWarning className="w-5 h-5 text-red-500" />}
        <div>
            <p className="font-medium text-sm">{alert.name}</p>
            <p className="text-xs text-gray-500">
                {type === 'contract' ? `Expires in ${alert.daysLeft} days` : alert.reason}
            </p>
        </div>
    </div>
    <Link to={createPageUrl(`ContractorProfile?id=${alert.id}`)}>
        <Button variant="ghost" size="sm">View</Button>
    </Link>
  </div>
);

export default function MyTeam() {
  const [data, setData] = useState(null);
  const [atRiskData, setAtRiskData] = useState([]); // Added this state
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        // Fetch team data and at-risk technician data concurrently
        const [teamResult, riskResult] = await Promise.all([
          getMyTeamData(),
          analyzeAtRiskTechnicians()
        ]);

        if (teamResult.error || !teamResult.data) {
          throw new Error(teamResult.error?.message || 'Failed to fetch team data.');
        }
        setData(teamResult.data);

        // Filter at-risk data to only include this PM's technicians
        if (riskResult.data && riskResult.data.success) {
          const myAtRiskTechs = riskResult.data.atRiskTechnicians.filter(tech => 
            teamResult.data.myTechnicians.some(myTech => myTech.id === tech.id)
          );
          setAtRiskData(myAtRiskTechs);
        } else {
            console.warn('Failed to fetch at-risk technician data:', riskResult.error);
            setAtRiskData([]); // Ensure atRiskData is empty if fetch failed
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  const getRiskLevelColor = (riskLevel) => {
    switch (riskLevel) {
      case 'critical': return 'text-red-700 bg-red-100';
      case 'high': return 'text-orange-700 bg-orange-100';
      case 'medium': return 'text-yellow-700 bg-yellow-100';
      case 'low': return 'text-blue-700 bg-blue-100';
      default: return 'text-gray-700 bg-gray-100';
    }
  };

  if (isLoading) {
    return <div className="flex h-full items-center justify-center"><Loader2 className="w-8 h-8 animate-spin" /></div>;
  }

  if (error) {
    return <div className="p-6 text-center text-red-500">{error}</div>;
  }

  const { stats, alerts, myTechnicians, myTasks } = data;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">My Team Dashboard</h1>
        <p className="text-gray-600">A quick overview of your assigned technicians and tasks.</p>
      </div>

      {/* At-Risk Alert Banner */}
      {atRiskData.length > 0 && (
        <Card className="border-orange-200 bg-orange-50">
          <CardHeader>
            <CardTitle className="text-orange-800 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              At-Risk Team Members ({atRiskData.length})
            </CardTitle>
            <CardDescription className="text-orange-600">
              Your technicians that need attention
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {atRiskData.slice(0, 3).map((tech) => (
                <div key={tech.id} className="flex items-center justify-between py-2 px-3 bg-white rounded-lg border">
                  <div className="flex items-center gap-3">
                    <Badge className={getRiskLevelColor(tech.riskLevel)}>
                      {tech.riskLevel}
                    </Badge>
                    <div>
                      <p className="font-medium text-gray-900">{tech.name}</p>
                      <p className="text-sm text-orange-700">{tech.riskFactors[0]?.message}</p>
                    </div>
                  </div>
                  <Link to={createPageUrl(`ContractorProfile?id=${tech.id}`)}>
                    <Button size="sm" variant="outline">Review</Button>
                  </Link>
                </div>
              ))}
            </div>
            {atRiskData.length > 3 && (
              <p className="text-sm text-orange-600 mt-2">
                +{atRiskData.length - 3} more at-risk technician{(atRiskData.length - 3) > 1 ? 's' : ''}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard title="My Technicians" value={stats.totalTechnicians} icon={<Users className="h-4 w-4 text-muted-foreground" />} />
        <StatCard title="Avg. Team Performance" value={`${stats.avgPerfScore}%`} icon={<TrendingUp className="h-4 w-4 text-muted-foreground" />} />
        <StatCard title="Open Tasks" value={stats.pendingTasks} icon={<ClipboardList className="h-4 w-4 text-muted-foreground" />} />
        <StatCard title="Compliance Issues" value={stats.complianceIssuesCount} icon={<AlertTriangle className="h-4 w-4 text-muted-foreground" />} />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Action Items</CardTitle></CardHeader>
          <CardContent>
            {alerts.expiringContracts.length === 0 && alerts.complianceIssues.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">No immediate action items.</p>
            ) : (
              <div className="space-y-2">
                {alerts.complianceIssues.map(alert => <AlertItem key={alert.id} alert={alert} type="compliance" />)}
                {alerts.expiringContracts.map(alert => <AlertItem key={alert.id} alert={alert} type="contract" />)}
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>My Open Tasks</CardTitle></CardHeader>
          <CardContent>
            {myTasks.filter(t => t.status !== 'Done').length > 0 ? (
              myTasks.filter(t => t.status !== 'Done').map(task => (
                <div key={task.id} className="flex items-center justify-between p-2 rounded-md hover:bg-gray-50">
                  <div>
                    <p className="text-sm font-medium">{task.title}</p>
                    <p className="text-xs text-gray-500">For: {task.technicianName}</p>
                  </div>
                  <Badge variant="secondary">{task.status}</Badge>
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-500 text-center py-4">No open tasks assigned to you.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>My Technicians ({myTechnicians.length})</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Project</TableHead>
                <TableHead>Velociti Score</TableHead>
                <TableHead>Avg. QC Score</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {myTechnicians.length > 0 ? myTechnicians.map(tech => (
                <TableRow key={tech.id}>
                  <TableCell>
                    <div className="font-medium">{tech.displayName || tech.full_name}</div>
                    <div className="text-sm text-muted-foreground">{tech.business}</div>
                  </TableCell>
                  <TableCell>{tech.project || 'N/A'}</TableCell>
                  <TableCell><Badge variant={tech.velocitiScore >= 85 ? 'default' : 'destructive'}>{tech.velocitiScore || 0}</Badge></TableCell>
                  <TableCell>{tech.avgQcScore || 0}</TableCell>
                  <TableCell>
                    <Link to={createPageUrl(`ContractorProfile?id=${tech.id}`)}>
                      <Button variant="outline" size="sm"><Eye className="w-4 h-4 mr-2" />View Profile</Button>
                    </Link>
                  </TableCell>
                </TableRow>
              )) : (
                <TableRow>
                  <TableCell colSpan={5} className="text-center h-24">You have no technicians assigned to you.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
