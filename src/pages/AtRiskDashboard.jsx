import React, { useState, useEffect } from 'react';

import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils/index.js';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select.jsx';
import { 
  AlertTriangle, 
  Search, 
  Loader2, 
  Eye, 
  RefreshCw,
  Shield,
  TrendingDown,
  Clock,
  FileX
} from 'lucide-react';

export default function AtRiskDashboard() {
  const [atRiskData, setAtRiskData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [riskFilter, setRiskFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');

  const loadAtRiskData = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/analyzeAtRiskTechnicians', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({})
      });
      const data = await response.json();
      if (data && data.success) {
        setAtRiskData(data.atRiskTechnicians || []);
        setFilteredData(data.atRiskTechnicians || []);
      } else {
        setAtRiskData([]);
        setFilteredData([]);
      }
    } catch (error) {
      console.error('Error loading at-risk data:', error);
      setAtRiskData([]);
      setFilteredData([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAtRiskData();
  }, []);

  useEffect(() => {
    let filtered = atRiskData.filter(tech => {
      const searchMatch = tech.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (tech.project || '').toLowerCase().includes(searchTerm.toLowerCase());
      
      const riskMatch = riskFilter === 'all' || tech.riskLevel === riskFilter;
      
      const typeMatch = typeFilter === 'all' || 
                       tech.riskFactors.some(factor => factor.type === typeFilter);
      
      return searchMatch && riskMatch && typeMatch;
    });
    
    setFilteredData(filtered);
  }, [atRiskData, searchTerm, riskFilter, typeFilter]);

  const getRiskLevelColor = (riskLevel) => {
    switch (riskLevel) {
      case 'critical': return 'text-red-700 bg-red-100 border-red-200';
      case 'high': return 'text-orange-700 bg-orange-100 border-orange-200';
      case 'medium': return 'text-yellow-700 bg-yellow-100 border-yellow-200';
      case 'low': return 'text-blue-700 bg-blue-100 border-blue-200';
      default: return 'text-gray-700 bg-gray-100 border-gray-200';
    }
  };

  const getRiskIcon = (type) => {
    switch (type) {
      case 'compliance': return <Shield className="w-4 h-4" />;
      case 'performance': return <TrendingDown className="w-4 h-4" />;
      case 'process': return <Clock className="w-4 h-4" />;
      case 'administrative': return <FileX className="w-4 h-4" />;
      default: return <AlertTriangle className="w-4 h-4" />;
    }
  };

  const summary = {
    total: atRiskData.length,
    critical: atRiskData.filter(t => t.riskLevel === 'critical').length,
    high: atRiskData.filter(t => t.riskLevel === 'high').length,
    medium: atRiskData.filter(t => t.riskLevel === 'medium').length,
    low: atRiskData.filter(t => t.riskLevel === 'low').length,
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <AlertTriangle className="w-8 h-8 text-orange-500" />
            At-Risk Technicians
          </h1>
          <p className="text-gray-600 mt-1">
            Proactive monitoring of technicians requiring attention
          </p>
        </div>
        <Button onClick={loadAtRiskData} disabled={isLoading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh Analysis
        </Button>
      </div>

      {/* Summary Stats */}
      <div className="grid md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total At-Risk</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.total}</div>
          </CardContent>
        </Card>
        <Card className="border-red-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-red-600">Critical</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{summary.critical}</div>
          </CardContent>
        </Card>
        <Card className="border-orange-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-orange-600">High</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{summary.high}</div>
          </CardContent>
        </Card>
        <Card className="border-yellow-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-yellow-600">Medium</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{summary.medium}</div>
          </CardContent>
        </Card>
        <Card className="border-blue-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-blue-600">Low</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{summary.low}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search technicians..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={riskFilter} onValueChange={setRiskFilter}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Filter by risk level" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Risk Levels</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Filter by type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="compliance">Compliance</SelectItem>
            <SelectItem value="performance">Performance</SelectItem>
            <SelectItem value="process">Process</SelectItem>
            <SelectItem value="administrative">Administrative</SelectItem>
            <SelectItem value="attendance">Attendance</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* At-Risk List */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : filteredData.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <AlertTriangle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No at-risk technicians found</h3>
              <p className="text-gray-600">
                {atRiskData.length === 0 
                  ? "Great news! All technicians are performing well." 
                  : "Try adjusting your search filters."}
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredData.map((tech) => (
            <Card key={tech.id} className={`border-l-4 ${getRiskLevelColor(tech.riskLevel).includes('red') ? 'border-l-red-500' : 
              getRiskLevelColor(tech.riskLevel).includes('orange') ? 'border-l-orange-500' :
              getRiskLevelColor(tech.riskLevel).includes('yellow') ? 'border-l-yellow-500' : 'border-l-blue-500'}`}>
              <CardContent className="p-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <Badge className={getRiskLevelColor(tech.riskLevel)}>
                        {tech.riskLevel.toUpperCase()}
                      </Badge>
                      <div>
                        <h3 className="font-semibold text-gray-900">{tech.name}</h3>
                        <div className="flex items-center gap-4 text-sm text-gray-600">
                          <span>{tech.project || 'No project assigned'}</span>
                          {tech.m2PM && <span>PM: {tech.m2PM}</span>}
                          <span>{tech.totalRiskFactors} issue{tech.totalRiskFactors > 1 ? 's' : ''}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      {tech.riskFactors.map((factor, index) => (
                        <div key={index} className="flex items-start gap-2 p-2 bg-gray-50 rounded-md">
                          {getRiskIcon(factor.type)}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900">{factor.message}</p>
                            {factor.actionable && (
                              <p className="text-xs text-gray-600 mt-1">
                                <strong>Action:</strong> {factor.action}
                              </p>
                            )}
                          </div>
                          <Badge variant="outline" className="text-xs">
                            {factor.type}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="text-right">
                    <Link to={createPageUrl(`ContractorProfile?id=${tech.id}`)}>
                      <Button className="bg-blue-600 hover:bg-blue-700">
                        <Eye className="w-4 h-4 mr-1" />
                        Review Profile
                      </Button>
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}