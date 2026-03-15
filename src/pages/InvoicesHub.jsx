import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient.js';
import { Button } from '@/components/ui/button.jsx';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { 
  FileText, 
  Clock, 
  CheckCircle, 
  DollarSign, 
  Users,
  BarChart3,
  FolderOpen,
  AlertCircle,
  Loader2,
  AlertTriangle,
  FileSignature
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils/index.js';

// Import existing page components to reuse their logic
import PendingInvoices from './PendingInvoices';
import InvoiceManagement from './InvoiceManagement';
import ContractorAccounting from './ContractorAccounting';
import WeeklyApprovedInvoices from './WeeklyApprovedInvoices';
import InvoicesDrive from './InvoicesDrive';
import ContractorReportTab from '@/components/invoices/ContractorReportTab';

export default function InvoicesHub() {
  const [activeTab, setActiveTab] = useState('pending');
  const [stats, setStats] = useState({
    pending: 0,
    approved: 0,
    totalAmount: 0,
    openBalance: 0,
    contractorsWithInvoices: 0
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [invoices, users] = await Promise.all([
        (await supabase.from('Invoice').select('*') /* TODO: restore sorting/limit '-created_date', 2000 */).data,
        (await supabase.from('User').select('*')).data
      ]);

      // Get list of inactive contractor emails to exclude them
      const inactiveEmails = new Set(
        users
          .filter(u => u.active === false)
          .map(u => u.email?.toLowerCase())
          .filter(Boolean)
      );

      // Filter out invoices from inactive contractors
      const activeInvoices = invoices.filter(inv => 
        !inactiveEmails.has(inv.contractorEmail?.toLowerCase())
      );

      const pending = activeInvoices.filter(inv => inv.status === 'pending').length;
      const approved = activeInvoices.filter(inv => inv.status === 'approved').length;
      const totalAmount = activeInvoices
        .filter(inv => inv.status === 'approved')
        .reduce((sum, inv) => sum + (inv.totalAmount || 0), 0);
      
      const openBalance = activeInvoices
        .filter(inv => 
          inv.status === 'approved' && 
          inv.paymentStatus !== 'paid'
        )
        .reduce((sum, inv) => sum + (inv.totalAmount || 0), 0);

      const contractorsWithInvoices = new Set(
        activeInvoices.map(inv => inv.contractorEmail)
      ).size;

      setStats({
        pending,
        approved,
        totalAmount,
        openBalance,
        contractorsWithInvoices
      });
    } catch (error) {
      console.error('Error loading stats:', error);
      setError('Failed to load invoice statistics. Please refresh the page.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <FileText className="w-8 h-8 text-blue-600" />
              Invoices Hub
            </h1>
            <p className="text-gray-600 mt-1">Centralized invoice management and payment tracking</p>
          </div>
          <div className="flex gap-3">
            <Link to={createPageUrl('AlertLog')}>
              <Button variant="outline" className="gap-2 text-red-600 border-red-200 hover:bg-red-50">
                <AlertTriangle className="w-4 h-4" />
                System Alert Log
              </Button>
            </Link>
            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 px-4 py-2 text-sm">
              🧪 New Unified Interface
            </Badge>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
          {/* Tabs Navigation */}
          <div className="bg-white border-b px-6">
            <TabsList className="w-full justify-start h-auto p-0 bg-transparent flex flex-wrap">
              <TabsTrigger 
                value="overview" 
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:bg-transparent px-6 py-4"
              >
                <BarChart3 className="w-4 h-4 mr-2" />
                Overview
              </TabsTrigger>
              <TabsTrigger 
                value="pending"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:bg-transparent px-6 py-4"
              >
                <Clock className="w-4 h-4 mr-2" />
                Pending Review
                {stats.pending > 0 && (
                  <Badge className="ml-2 bg-orange-100 text-orange-800">{stats.pending}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger 
                value="management"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:bg-transparent px-6 py-4"
              >
                <Users className="w-4 h-4 mr-2" />
                By Contractor
              </TabsTrigger>
              <TabsTrigger 
                value="accounting"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:bg-transparent px-6 py-4"
              >
                <DollarSign className="w-4 h-4 mr-2" />
                Accounting
              </TabsTrigger>
              <TabsTrigger 
                value="weekly"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:bg-transparent px-6 py-4"
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                Weekly Report
              </TabsTrigger>
              <TabsTrigger 
                value="drive"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:bg-transparent px-6 py-4"
              >
                <FolderOpen className="w-4 h-4 mr-2" />
                Drive
              </TabsTrigger>
              <TabsTrigger 
                value="report"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:bg-transparent px-6 py-4"
              >
                <FileText className="w-4 h-4 mr-2" />
                Contractor Report
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Tab Contents */}
          <div className="flex-1 overflow-auto bg-gray-50">
            {/* Overview Tab */}
            <TabsContent value="overview" className="m-0">
              <div className="p-6 space-y-6">
                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2">
                    <AlertCircle className="w-5 h-5" />
                    {error}
                  </div>
                )}

                {/* Key Metrics */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-gray-600 mb-1">Pending Review</p>
                          <p className="text-3xl font-bold text-orange-600">
                            {isLoading ? '...' : stats.pending}
                          </p>
                        </div>
                        <Clock className="w-8 h-8 text-orange-300" />
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-gray-600 mb-1">Approved</p>
                          <p className="text-3xl font-bold text-green-600">
                            {isLoading ? '...' : stats.approved}
                          </p>
                        </div>
                        <CheckCircle className="w-8 h-8 text-green-300" />
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-gray-600 mb-1">Active Contractors</p>
                          <p className="text-3xl font-bold text-gray-900">
                            {isLoading ? '...' : stats.contractorsWithInvoices}
                          </p>
                        </div>
                        <Users className="w-8 h-8 text-gray-300" />
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Quick Info Cards */}
                <div className="grid md:grid-cols-2 gap-6">
                  <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
                    <CardHeader>
                      <CardTitle className="text-blue-900">📋 Quick Actions</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <button
                        onClick={() => setActiveTab('pending')}
                        className="w-full text-left p-3 bg-white rounded-lg hover:bg-blue-50 transition-colors flex items-center justify-between group"
                      >
                        <span className="font-medium text-gray-900">Review Pending Invoices</span>
                        <Badge className="bg-orange-100 text-orange-800 group-hover:bg-orange-200">
                          {stats.pending} waiting
                        </Badge>
                      </button>
                      <button
                        onClick={() => setActiveTab('accounting')}
                        className="w-full text-left p-3 bg-white rounded-lg hover:bg-blue-50 transition-colors flex items-center justify-between"
                      >
                        <span className="font-medium text-gray-900">Record Payments</span>
                        <span className="text-sm text-gray-500">→</span>
                      </button>
                      <button
                        onClick={() => setActiveTab('weekly')}
                        className="w-full text-left p-3 bg-white rounded-lg hover:bg-blue-50 transition-colors flex items-center justify-between"
                      >
                        <span className="font-medium text-gray-900">Generate Weekly Report</span>
                        <span className="text-sm text-gray-500">→</span>
                      </button>
                      <button
                        onClick={() => setActiveTab('report')}
                        className="w-full text-left p-3 bg-white rounded-lg hover:bg-blue-50 transition-colors flex items-center justify-between"
                      >
                        <span className="font-medium text-gray-900">Contractor Report</span>
                        <span className="text-sm text-gray-500">→</span>
                      </button>
                    </CardContent>
                  </Card>

                  <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
                    <CardHeader>
                      <CardTitle className="text-green-900">💡 Tips & Info</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                        <p className="text-gray-700">
                          All contractor invoices now require manual approval. Check the <strong>Pending Review</strong> tab regularly.
                        </p>
                      </div>
                      <div className="flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                        <p className="text-gray-700">
                          Use <strong>Accounting</strong> tab to track payments and outstanding balances per contractor.
                        </p>
                      </div>
                      <div className="flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                        <p className="text-gray-700">
                          The <strong>Drive</strong> organizes all approved invoices by contractor and year automatically.
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Feature Comparison */}
                <Card>
                  <CardHeader>
                    <CardTitle>🆕 What's New in Invoices Hub</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid md:grid-cols-3 gap-4">
                      <div className="p-4 bg-blue-50 rounded-lg">
                        <h4 className="font-semibold text-blue-900 mb-2">Unified Interface</h4>
                        <p className="text-sm text-blue-800">
                          All invoice operations in one place - no more jumping between 5 different pages.
                        </p>
                      </div>
                      <div className="p-4 bg-green-50 rounded-lg">
                        <h4 className="font-semibold text-green-900 mb-2">Faster Workflows</h4>
                        <p className="text-sm text-green-800">
                          Switch between pending, accounting, and reports instantly with tabs.
                        </p>
                      </div>
                      <div className="p-4 bg-purple-50 rounded-lg">
                        <h4 className="font-semibold text-purple-900 mb-2">Better Overview</h4>
                        <p className="text-sm text-purple-800">
                          See key metrics at a glance without navigating multiple dashboards.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Pending Review Tab */}
            <TabsContent value="pending" className="m-0 data-[state=active]:flex data-[state=active]:flex-col h-full">
              {activeTab === 'pending' ? (
                <PendingInvoices />
              ) : (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                </div>
              )}
            </TabsContent>

            {/* Invoice Management Tab */}
            <TabsContent value="management" className="m-0 data-[state=active]:flex data-[state=active]:flex-col h-full">
              {activeTab === 'management' ? (
                <InvoiceManagement />
              ) : (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                </div>
              )}
            </TabsContent>

            {/* Contractor Accounting Tab */}
            <TabsContent value="accounting" className="m-0 data-[state=active]:flex data-[state=active]:flex-col h-full">
              {activeTab === 'accounting' ? (
                <ContractorAccounting />
              ) : (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                </div>
              )}
            </TabsContent>

            {/* Weekly Report Tab */}
            <TabsContent value="weekly" className="m-0 data-[state=active]:flex data-[state=active]:flex-col h-full">
              {activeTab === 'weekly' ? (
                <WeeklyApprovedInvoices />
              ) : (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                </div>
              )}
            </TabsContent>

            {/* Drive Tab */}
            <TabsContent value="drive" className="m-0 data-[state=active]:flex data-[state=active]:flex-col h-full">
              {activeTab === 'drive' ? (
                <InvoicesDrive />
              ) : (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                </div>
              )}
            </TabsContent>

            {/* Contractor Report Tab */}
            <TabsContent value="report" className="m-0 data-[state=active]:flex data-[state=active]:flex-col h-full">
              {activeTab === 'report' ? (
                <ContractorReportTab />
              ) : (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                </div>
              )}
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
}