
import React, { useState, useEffect, useMemo } from 'react';
import { analyzeNegativeInteractions } from '@/functions.js';
import { CallLog, QCInspection, User } from '@/api/entities.js';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table.jsx';
import { 
  AlertTriangle, 
  Download, 
  Search,
  Calendar,
  Phone,
  ClipboardCheck,
  FileText,
  Loader2,
  Brain
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { Alert, AlertDescription } from '@/components/ui/alert.jsx';

export default function NegativeInteractionsReport() {
  const [interactions, setInteractions] = useState([]);
  const [aiInteractions, setAiInteractions] = useState([]); // New state for AI-generated interactions
  const [contractors, setContractors] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRunningAI, setIsRunningAI] = useState(false); // New state for AI analysis loading
  const [aiStatus, setAiStatus] = useState(null); // New state for AI analysis status messages
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedContractor, setSelectedContractor] = useState('all');
  const [dateRange, setDateRange] = useState('this_month');
  const [interactionType, setInteractionType] = useState('all');

  useEffect(() => {
    loadData();
  }, []);

  const runAIAnalysis = async () => {
    setIsRunningAI(true);
    setAiStatus(null); // Clear previous status
    
    try {
      const { data } = await analyzeNegativeInteractions();
      
      if (data.success) {
        // AI interactions are already formatted correctly by the function
        setAiInteractions(data.analysisResults || []);
        setAiStatus({
          type: 'success',
          message: `AI analysis complete! Found ${data.issuesFound} potential issues across ${data.contractorsAnalyzed} contractors.`
        });
      } else {
        throw new Error(data.error || 'Unknown AI analysis error');
      }
    } catch (error) {
      console.error('AI analysis failed:', error);
      setAiStatus({
        type: 'error',
        message: `AI analysis failed: ${error.message}. Please try again later.`
      });
    } finally {
      setIsRunningAI(false);
    }
  };

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [callLogs, inspections, users] = await Promise.all([
        CallLog.list('-callDate'),
        QCInspection.list('-inspectionDate'),
        User.list()
      ]);

      const contractorList = users.filter(user => 
        user.email && (
          user.email.toLowerCase().includes('.contractor@m2fleetcom.com') ||
          user.email.toLowerCase().includes('.contractor@smcinstallations.com')
        )
      );
      setContractors(contractorList);

      // Process and combine all negative interactions
      const allInteractions = [];

      // Add negative call logs (filter for complaint-related keywords)
      const negativeKeywords = [
        'complaint', 'issue', 'problem', 'late', 'absent', 'missing', 'failed',
        'poor', 'bad', 'terrible', 'angry', 'upset', 'unsatisfied', 'dissatisfied',
        'wrong', 'error', 'mistake', 'concern', 'worried', 'frustrated', 'rework',
        'redo', 'fix', 'repair', 'damage', 'broken', 'defective', 'quality',
        'subpar', 'unacceptable', 'disappointing', 'delayed', 'behind', 'slow'
      ];

      callLogs.forEach(log => {
        const hasNegativeContent = log.note && 
          negativeKeywords.some(keyword => 
            log.note.toLowerCase().includes(keyword)
          );
        
        if (hasNegativeContent) {
          const contractor = contractorList.find(c => c.id === log.technicianId);
          allInteractions.push({
            id: `call_${log.id}`,
            type: 'Call Log',
            contractorName: contractor?.displayName || contractor?.full_name || 'Unknown',
            contractorId: log.technicianId,
            date: log.callDate,
            content: log.note,
            loggedBy: log.loggedBy,
            severity: 'medium' // Could be enhanced with AI sentiment analysis
          });
        }
      });

      // Add low-scoring inspections (score < 70)
      inspections.forEach(inspection => {
        if (inspection.score < 70) {
          const contractor = contractorList.find(c => c.id === inspection.technicianId);
          allInteractions.push({
            id: `inspection_${inspection.id}`,
            type: 'QC Inspection',
            contractorName: contractor?.displayName || contractor?.full_name || 'Unknown',
            contractorId: inspection.technicianId,
            date: inspection.inspectionDate,
            content: `Score: ${inspection.score}/100. Notes: ${inspection.notes || 'No additional notes'}`,
            loggedBy: inspection.qcUserName,
            severity: inspection.score < 50 ? 'high' : 'medium'
          });
        }
      });

      // Add contractors with negative status
      contractorList.forEach(contractor => {
        if (contractor.qcStatus === 'needs_coaching' || contractor.qcStatus === 'minor_issues') {
          allInteractions.push({
            id: `status_${contractor.id}`,
            type: 'QC Status',
            contractorName: contractor.displayName || contractor.full_name,
            contractorId: contractor.id,
            date: new Date().toISOString(), // Current date since we don't track when status was changed
            content: contractor.qcStatus === 'needs_coaching' ? 'Needs Coaching Status' : 'Minor Issues Status',
            loggedBy: 'System',
            severity: contractor.qcStatus === 'needs_coaching' ? 'high' : 'medium'
          });
        }
      });

      // Sort by date (newest first) - initial sort for manual interactions
      allInteractions.sort((a, b) => new Date(b.date) - new Date(a.date));
      setInteractions(allInteractions);

    } catch (error) {
      console.error('Error loading negative interactions:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getDateRange = () => {
    const now = new Date();
    switch (dateRange) {
      case 'this_month':
        return { start: startOfMonth(now), end: endOfMonth(now) };
      case 'last_month':
        const lastMonth = subMonths(now, 1);
        return { start: startOfMonth(lastMonth), end: endOfMonth(lastMonth) };
      case 'last_3_months':
        return { start: subMonths(now, 3), end: now };
      case 'all_time':
        return { start: new Date(2020, 0, 1), end: now };
      default:
        return { start: startOfMonth(now), end: endOfMonth(now) };
    }
  };

  const allInteractionsCombined = useMemo(() => {
    // Combine manual interactions with AI-generated ones
    return [...interactions, ...aiInteractions].sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [interactions, aiInteractions]);

  const filteredInteractions = useMemo(() => {
    const { start, end } = getDateRange();
    
    return allInteractionsCombined.filter(interaction => { // Use combined interactions
      const interactionDate = new Date(interaction.date);
      const dateInRange = interactionDate >= start && interactionDate <= end;
      
      const contractorMatch = selectedContractor === 'all' || interaction.contractorId === selectedContractor;
      
      const typeMatch = interactionType === 'all' || interaction.type === interactionType;
      
      const searchMatch = !searchTerm || 
        interaction.contractorName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        interaction.content?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        interaction.loggedBy?.toLowerCase().includes(searchTerm.toLowerCase());
      
      return dateInRange && contractorMatch && typeMatch && searchMatch;
    });
  }, [allInteractionsCombined, selectedContractor, interactionType, searchTerm, dateRange]);

  const exportToCsv = () => {
    const headers = ['Date', 'Contractor', 'Type', 'Severity', 'Logged By', 'Details'];
    const csvData = filteredInteractions.map(interaction => [
      format(new Date(interaction.date), 'MM/dd/yyyy HH:mm'),
      interaction.contractorName,
      interaction.type,
      interaction.severity,
      interaction.loggedBy,
      `"${interaction.content?.replace(/"/g, '""') || ''}"` // Escape quotes for CSV
    ]);

    const csvContent = [headers.join(','), ...csvData.map(row => row.join(','))].join('\n'); // Join headers and rows
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `negative-interactions-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    a.remove();
  };

  const getSeverityBadge = (severity) => {
    const colors = {
      high: 'bg-red-100 text-red-800',
      medium: 'bg-yellow-100 text-yellow-800',
      low: 'bg-blue-100 text-blue-800'
    };
    return <Badge className={colors[severity]}>{severity.toUpperCase()}</Badge>;
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'Call Log': return <Phone className="w-4 h-4" />;
      case 'QC Inspection': return <ClipboardCheck className="w-4 h-4" />;
      case 'QC Status': return <AlertTriangle className="w-4 h-4" />;
      case 'AI Analysis': return <Brain className="w-4 h-4 text-blue-500" />; // Added AI Analysis icon
      default: return <FileText className="w-4 h-4" />;
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 flex justify-center items-center">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Negative Interactions Report</h1>
          <p className="text-gray-600 mt-1">Track all complaints, issues, and AI-detected performance concerns</p> {/* Updated description */}
        </div>
        <div className="flex gap-3"> {/* Group buttons */}
          <Button onClick={runAIAnalysis} disabled={isRunningAI} variant="outline">
            {isRunningAI ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Brain className="w-4 h-4 mr-2" />
                Run AI Analysis
              </>
            )}
          </Button>
          <Button onClick={exportToCsv} disabled={filteredInteractions.length === 0}>
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {aiStatus && (
        <Alert variant={aiStatus.type === 'error' ? 'destructive' : 'default'}>
          <Brain className="h-4 w-4" /> {/* Brain icon for alert */}
          <AlertDescription>{aiStatus.message}</AlertDescription>
        </Alert>
      )}

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                <Input
                  placeholder="Search interactions..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Date Range</label>
              <Select value={dateRange} onValueChange={setDateRange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="this_month">This Month</SelectItem>
                  <SelectItem value="last_month">Last Month</SelectItem>
                  <SelectItem value="last_3_months">Last 3 Months</SelectItem>
                  <SelectItem value="all_time">All Time</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Contractor</label>
              <Select value={selectedContractor} onValueChange={setSelectedContractor}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Contractors</SelectItem>
                  {contractors.map(contractor => (
                    <SelectItem key={contractor.id} value={contractor.id}>
                      {contractor.displayName || contractor.business || contractor.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Interaction Type</label>
              <Select value={interactionType} onValueChange={setInteractionType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="Call Log">Call Logs</SelectItem>
                  <SelectItem value="QC Inspection">QC Inspections</SelectItem>
                  <SelectItem value="QC Status">QC Status Issues</SelectItem>
                  <SelectItem value="AI Analysis">AI Analysis</SelectItem> {/* Added AI Analysis type */}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Stats */}
      <div className="grid md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Issues</p>
                <p className="text-2xl font-bold">{filteredInteractions.length}</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">High Severity</p>
                <p className="text-2xl font-bold text-red-600">
                  {filteredInteractions.filter(i => i.severity === 'high').length}
                </p>
              </div>
              <AlertTriangle className="w-8 h-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Call Issues</p>
                <p className="text-2xl font-bold">
                  {filteredInteractions.filter(i => i.type === 'Call Log').length}
                </p>
              </div>
              <Phone className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Poor Inspections</p>
                <p className="text-2xl font-bold">
                  {filteredInteractions.filter(i => i.type === 'QC Inspection').length}
                </p>
              </div>
              <ClipboardCheck className="w-8 h-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Interactions Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            Negative Interactions ({filteredInteractions.length} records)
            {aiInteractions.length > 0 && (
              <Badge className="ml-2 bg-blue-100 text-blue-800">
                {aiInteractions.length} AI-Detected
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredInteractions.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Contractor</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Severity</TableHead>
                    <TableHead>Logged By</TableHead>
                    <TableHead>Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredInteractions.map((interaction) => (
                    <TableRow key={interaction.id} className={interaction.type === 'AI Analysis' ? 'bg-blue-50' : ''}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-gray-400" />
                          {format(new Date(interaction.date), 'MM/dd/yyyy HH:mm')}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{interaction.contractorName}</div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getTypeIcon(interaction.type)}
                          {interaction.type}
                        </div>
                      </TableCell>
                      <TableCell>
                        {getSeverityBadge(interaction.severity)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {interaction.type === 'AI Analysis' && (
                            <Brain className="w-3 h-3 text-blue-500" />
                          )}
                          {interaction.loggedBy}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="max-w-md">
                          <p className="text-sm text-gray-900 whitespace-pre-line">
                            {interaction.content}
                          </p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <AlertTriangle className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No negative interactions found for the selected criteria.</p>
              <p className="text-sm">This is actually good news!</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
