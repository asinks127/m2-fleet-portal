import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Loader2, Search, Filter, FileText, CheckCircle, Clock, AlertCircle, Eye, Send, Download, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function AdminPaperworkDashboard() {
    const [contractors, setContractors] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [filterMissing, setFilterMissing] = useState(false);
    const [filterNeedsReview, setFilterNeedsReview] = useState(false);
    const [filterOnboardingIncomplete, setFilterOnboardingIncomplete] = useState(false);
    const [lastRefresh, setLastRefresh] = useState(null);

    const fetchData = async () => {
        setLoading(true);
        setError(null);
        try {
            const payload = {
                filters: {
                    search: searchTerm,
                    status: statusFilter,
                    missingDocs: filterMissing,
                    needsReview: filterNeedsReview,
                    onboardingIncomplete: filterOnboardingIncomplete
                },
                limit: 200
            };

            const result = await base44.functions.invoke('getPaperworkTracking', payload);
            const data = result.output || result;
            
            if (data.error) {
                setError(data.error);
            } else {
                setContractors(data.contractors || []);
            }
            setLastRefresh(new Date());
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    useEffect(() => {
        const debounce = setTimeout(() => {
            fetchData();
        }, 400);
        return () => clearTimeout(debounce);
    }, [searchTerm, statusFilter, filterMissing, filterNeedsReview, filterOnboardingIncomplete]);

    const filteredContractors = useMemo(() => {
        return contractors;
    }, [contractors]);

    const getStatusBadge = (status) => {
        switch (status) {
            case 'Complete':
                return <Badge className="bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1" />Complete</Badge>;
            case 'Pending':
                return <Badge className="bg-yellow-100 text-yellow-800"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
            case 'Needs Review':
                return <Badge className="bg-orange-100 text-orange-800"><Eye className="w-3 h-3 mr-1" />Needs Review</Badge>;
            case 'Partial':
                return <Badge className="bg-blue-100 text-blue-800"><FileText className="w-3 h-3 mr-1" />Partial</Badge>;
            case 'No Paperwork Sent':
                return <Badge className="bg-gray-100 text-gray-800"><AlertCircle className="w-3 h-3 mr-1" />Not Sent</Badge>;
            default:
                return <Badge variant="outline">{status}</Badge>;
        }
    };

    const getCompletionColor = (pct) => {
        if (pct >= 100) return 'text-green-600';
        if (pct >= 50) return 'text-yellow-600';
        return 'text-red-600';
    };

    return (
        <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">Paperwork Tracking Dashboard</h1>
                    <p className="text-gray-500 text-sm">Track contractor paperwork status across all projects</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
                        <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                        Refresh
                    </Button>
                    <Link to={createPageUrl('SendPaperwork')}>
                        <Button size="sm"><Send className="w-4 h-4 mr-2" />Send Paperwork</Button>
                    </Link>
                </div>
            </div>

            {/* Filters */}
            <Card>
                <CardContent className="p-4">
                    <div className="flex flex-wrap gap-4">
                        <div className="flex-1 min-w-[200px]">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <Input
                                    placeholder="Search by name, email, or project..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="pl-9"
                                />
                            </div>
                        </div>
                        
                        <div className="flex flex-wrap gap-2">
                            <Button
                                variant={statusFilter === 'all' ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => setStatusFilter('all')}
                            >
                                All
                            </Button>
                            <Button
                                variant={statusFilter === 'active' ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => setStatusFilter('active')}
                            >
                                Active
                            </Button>
                            <Button
                                variant={statusFilter === 'inactive' ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => setStatusFilter('inactive')}
                            >
                                Inactive
                            </Button>
                            <Button
                                variant={filterMissing ? 'destructive' : 'outline'}
                                size="sm"
                                onClick={() => setFilterMissing(!filterMissing)}
                            >
                                <AlertCircle className="w-4 h-4 mr-1" />Missing
                            </Button>
                            <Button
                                variant={filterNeedsReview ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => setFilterNeedsReview(!filterNeedsReview)}
                            >
                                <Eye className="w-4 h-4 mr-1" />Needs Review
                            </Button>
                            <Button
                                variant={filterOnboardingIncomplete ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => setFilterOnboardingIncomplete(!filterOnboardingIncomplete)}
                            >
                                Incomplete
                            </Button>
                        </div>
                    </div>
                    
                    {lastRefresh && (
                        <p className="text-xs text-gray-400 mt-2">
                            Last updated: {format(lastRefresh, 'h:mm:ss a')}
                        </p>
                    )}
                </CardContent>
            </Card>

            {/* Stats Summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                    <CardContent className="p-4 text-center">
                        <p className="text-2xl font-bold">{contractors.length}</p>
                        <p className="text-xs text-gray-500">Total Contractors</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4 text-center">
                        <p className="text-2xl font-bold text-green-600">
                            {contractors.filter(c => c.status === 'Complete').length}
                        </p>
                        <p className="text-xs text-gray-500">Complete</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4 text-center">
                        <p className="text-2xl font-bold text-yellow-600">
                            {contractors.filter(c => c.pendingCount > 0).length}
                        </p>
                        <p className="text-xs text-gray-500">With Pending</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4 text-center">
                        <p className="text-2xl font-bold text-orange-600">
                            {contractors.filter(c => c.needsReviewCount > 0).length}
                        </p>
                        <p className="text-xs text-gray-500">Needs Review</p>
                    </CardContent>
                </Card>
            </div>

            {/* Contractor Table */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">Contractor Paperwork Status</CardTitle>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex justify-center py-8">
                            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                        </div>
                    ) : error ? (
                        <div className="text-center py-8 text-red-500">
                            <AlertCircle className="w-6 h-6 mx-auto mb-2" />
                            <p>{error}</p>
                        </div>
                    ) : filteredContractors.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                            <FileText className="w-6 h-6 mx-auto mb-2" />
                            <p>No contractors found matching your filters</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b text-left">
                                        <th className="pb-2 font-medium">Contractor</th>
                                        <th className="pb-2 font-medium">Email</th>
                                        <th className="pb-2 font-medium">Project</th>
                                        <th className="pb-2 font-medium">M2 PM</th>
                                        <th className="pb-2 font-medium text-center">Completion</th>
                                        <th className="pb-2 font-medium text-center">Pending</th>
                                        <th className="pb-2 font-medium text-center">Needs Review</th>
                                        <th className="pb-2 font-medium">Last Sent</th>
                                        <th className="pb-2 font-medium">Last Signed</th>
                                        <th className="pb-2 font-medium">Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredContractors.map((contractor, idx) => (
                                        <tr key={contractor.contractorId || idx} className="border-b hover:bg-gray-50">
                                            <td className="py-2 font-medium">
                                                <Link 
                                                    to={createPageUrl('ContractorProfile') + `?id=${contractor.contractorId}`}
                                                    className="text-blue-600 hover:underline"
                                                >
                                                    {contractor.contractorName}
                                                </Link>
                                            </td>
                                            <td className="py-2 text-gray-600">{contractor.contractorEmail}</td>
                                            <td className="py-2">{contractor.project || '-'}</td>
                                            <td className="py-2">{contractor.m2PM || '-'}</td>
                                            <td className="py-2 text-center">
                                                <span className={`font-bold ${getCompletionColor(contractor.completionPercentage)}`}>
                                                    {contractor.completionPercentage}%
                                                </span>
                                            </td>
                                            <td className="py-2 text-center">
                                                {contractor.pendingCount > 0 ? (
                                                    <Badge variant="outline" className="text-yellow-600 border-yellow-300">
                                                        {contractor.pendingCount}
                                                    </Badge>
                                                ) : '-'}
                                            </td>
                                            <td className="py-2 text-center">
                                                {contractor.needsReviewCount > 0 ? (
                                                    <Badge className="bg-orange-100 text-orange-700">
                                                        {contractor.needsReviewCount}
                                                    </Badge>
                                                ) : '-'}
                                            </td>
                                            <td className="py-2 text-gray-500 text-xs">
                                                {contractor.lastSentDate 
                                                    ? format(new Date(contractor.lastSentDate), 'MM/dd/yy')
                                                    : '-'}
                                            </td>
                                            <td className="py-2 text-gray-500 text-xs">
                                                {contractor.lastSignedDate 
                                                    ? format(new Date(contractor.lastSignedDate), 'MM/dd/yy')
                                                    : '-'}
                                            </td>
                                            <td className="py-2">{getStatusBadge(contractor.status)}</td>
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