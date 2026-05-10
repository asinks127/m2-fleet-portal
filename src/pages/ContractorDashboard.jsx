import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient.js';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Link, useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils/index.js';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs.jsx';
import {
  Upload,
  CheckCircle,
  Clock,
  FileText,
  DollarSign,
  AlertCircle,
  Loader2,
  XCircle,
  LayoutDashboard,
  FileSignature
} from 'lucide-react';
import SafetyMessageModal from '../components/safety/SafetyMessageModal';
import AnnouncementBanner from '../components/AnnouncementBanner';
import ReviewDocumentsTab from '../components/dashboard/ReviewDocumentsTab';

// Helper to convert UTC to Central Time for display using browser Intl API
function formatCentralTime(utcDateString) {
  if (!utcDateString) return 'N/A';
  try {
    const utcDate = new Date(utcDateString);
    if (isNaN(utcDate.getTime())) {
      return 'Invalid Date';
    }

    const options = {
      timeZone: 'America/Chicago',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    };
    
    const centralString = utcDate.toLocaleString('en-US', options);
    return centralString + ' CT';
  } catch (error) {
    console.error('Error formatting date:', error);
    return 'Invalid Date';
  }
}

export default function ContractorDashboard() {
  const [user, setUser] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [stats, setStats] = useState({
    totalInvoices: 0,
    pendingInvoices: 0,
    approvedInvoices: 0,
    totalAmount: 0
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentSafetyMessage, setCurrentSafetyMessage] = useState(null);
  const [showSafetyModal, setShowSafetyModal] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      const currentUser = (await supabase.auth.getUser()).data.user;

      if (!currentUser) {
        setError('Please log in to continue');
        setIsLoading(false);
        return;
      }

      setUser(currentUser);

      console.log('Loading invoices for:', currentUser.email);
      const { data: contractorInvoicesRaw = [] } = await supabase.from('Invoice').select('*').eq('contractorEmail', currentUser.email).order('created_at', { ascending: false }).limit(100);
      const contractorInvoices = contractorInvoicesRaw || [];

      console.log('Loaded invoices:', contractorInvoices.length);
      setInvoices(contractorInvoices);

      const pendingCount = contractorInvoices.filter(inv => (inv.status || '').toLowerCase() === 'pending').length;
      const approvedCount = contractorInvoices.filter(inv => (inv.status || '').toLowerCase() === 'approved').length;
      const totalAmount = contractorInvoices
        .filter(inv => (inv.status || '').toLowerCase() === 'approved')
        .reduce((sum, inv) => sum + (parseFloat(inv.totalAmount) || 0), 0);

      setStats({
        totalInvoices: contractorInvoices.length,
        pendingInvoices: pendingCount,
        approvedInvoices: approvedCount,
        totalAmount
      });

      try {
        const { data: latestMessages = [] } = await supabase.from('SafetyMessage').select('*').eq('active', true).order('created_at', { ascending: false }).limit(1);

        if (latestMessages.length > 0) {
          const message = latestMessages[0];
          const { data: acks = [] } = await supabase.from('SafetyAcknowledgement').select('*').match({ messageId: message.id, userId: currentUser.id });

          if (acks.length === 0) {
            setCurrentSafetyMessage(message);
            setTimeout(() => setShowSafetyModal(true), 100);
          }
        }
      } catch (safetyError) {
        console.error('Error checking safety messages (non-blocking):', safetyError);
      }

    } catch (err) {
      console.error('Error loading dashboard data:', err);
      setError(err.message || 'Failed to load dashboard data.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSafetyAcknowledgment = async () => {
    if (!currentSafetyMessage || !user) return;

    try {
      await supabase.from('SafetyAcknowledgement').insert({
        messageId: currentSafetyMessage.id,
        userId: user.id,
        userEmail: user.email,
        userName: user.displayName || user.full_name || user.email,
          acknowledgedAt: new Date().toISOString()
      });

      setShowSafetyModal(false);
      setCurrentSafetyMessage(null);
    } catch (error) {
      console.error('Error acknowledging safety message:', error);
      setShowSafetyModal(false);
    }
  };

  const handleDownloadInvoice = (fileUrl) => {
    if (fileUrl) {
      window.open(fileUrl, '_blank');
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center h-64">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-gray-900">Loading Dashboard</h2>
          <p className="text-gray-600">Please wait...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <Card className="max-w-md mx-auto">
          <CardContent className="p-8 text-center">
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-gray-900 mb-2">Dashboard Error</h2>
            <p className="text-red-600 mb-4">{error}</p>
            <Button onClick={() => window.location.reload()}>
              Refresh Page
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="p-6">
        <Card className="max-w-md mx-auto">
          <CardContent className="p-8 text-center">
            <AlertCircle className="w-16 h-16 text-orange-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-gray-900 mb-2">Please Log In</h2>
            <p className="text-gray-600 mb-4">Please log in to access your dashboard.</p>
            <Button onClick={() => window.location.reload()}>
              Refresh to Log In
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const recentInvoices = invoices.slice(0, 5);

  const StatCard = ({ title, value, icon: Icon, color, subtitle }) => (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-gray-600">{title}</CardTitle>
        <Icon className={`w-5 h-5 ${color.replace('bg-', 'text-')}`} />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-gray-900">{value}</div>
        {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
      </CardContent>
    </Card>
  );

  const getStatusColor = (status) => {
    switch (status) {
      case 'approved':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-orange-100 text-orange-800';
      case 'rejected':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'approved':
        return <CheckCircle className="w-3 h-3 mr-1" />;
      case 'pending':
        return <Clock className="w-3 h-3 mr-1" />;
      case 'rejected':
        return <XCircle className="w-3 h-3 mr-1" />;
      default:
        return <FileText className="w-3 h-3 mr-1" />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-6">
      <AnnouncementBanner />

      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Welcome back!</h1>
            <p className="text-gray-600 mt-1">
              {user?.displayName || user?.business || user?.full_name || user?.email}
            </p>
          </div>

          <div className="flex gap-2">
            <Link to={createPageUrl('SubmitInvoice')}>
              <Button className="bg-green-600 hover:bg-green-700">
                <Upload className="w-4 h-4 mr-2" />
                Submit Invoice
              </Button>
            </Link>
          </div>
        </div>

        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-2 lg:w-[400px]">
            <TabsTrigger value="overview">
              <LayoutDashboard className="w-4 h-4 mr-2" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="documents">
              <FileSignature className="w-4 h-4 mr-2" />
              Review Documents
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6 mt-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
              <StatCard
                title="Total Submitted"
                value={stats.totalInvoices}
                icon={FileText}
                color="bg-blue-500"
                subtitle="All time"
              />
              <StatCard
                title="Pending Review"
                value={stats.pendingInvoices}
                icon={Clock}
                color="bg-orange-500"
                subtitle="Awaiting approval"
              />
              <StatCard
                title="Approved"
                value={stats.approvedInvoices}
                icon={CheckCircle}
                color="bg-green-500"
                subtitle="Ready for payment"
              />
              <StatCard
                title="Total Approved"
                value={`$${stats.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                icon={DollarSign}
                color="bg-purple-500"
                subtitle="Invoice amounts"
              />
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <FileText className="w-5 h-5" />
                    Recent Invoices
                  </span>
                  <Link to={createPageUrl('InvoiceHistory')}>
                    <Button variant="outline" size="sm">View All</Button>
                  </Link>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {recentInvoices.length === 0 ? (
                  <div className="text-center py-8">
                    <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500">No invoices submitted yet.</p>
                    <Link to={createPageUrl('SubmitInvoice')}>
                      <Button className="mt-4 bg-green-600 hover:bg-green-700">
                        <Upload className="w-4 h-4 mr-2" />
                        Submit Your First Invoice
                      </Button>
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {recentInvoices.map((invoice) => (
                      <div key={invoice.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-4">
                          <FileText className="w-8 h-8 text-blue-500" />
                          <div>
                            <p className="font-medium text-gray-900">{invoice.fileName}</p>
                            <div className="flex flex-wrap items-center gap-2 text-sm text-gray-500 mt-1">
                              <span>
                                Week ending: {(() => { const d = invoice.weekEndingDate ? new Date(invoice.weekEndingDate) : null; return d && !isNaN(d.getTime()) ? d.toLocaleDateString() : 'N/A'; })()}
                              </span>
                              {invoice.totalAmount && (
                                <span className="font-medium text-gray-700">
                                  ${parseFloat(invoice.totalAmount).toFixed(2)}
                                </span>
                              )}
                              <span>
                                Submitted: {(() => { const d = invoice.created_at || invoice.invoiceDate; return d ? formatCentralTime(d) : 'N/A'; })()}
                              </span>
                            </div>
                          </div>
                        </div>
                        <Badge className={getStatusColor(invoice.status)}>
                          {getStatusIcon(invoice.status)}
                          {invoice.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="documents" className="mt-6">
            <ReviewDocumentsTab user={user} />
          </TabsContent>
        </Tabs>

        {showSafetyModal && currentSafetyMessage && (
          <SafetyMessageModal
            message={currentSafetyMessage}
            user={user}
            onAcknowledged={handleSafetyAcknowledgment}
          />
        )}
      </div>
    </div>
  );
}