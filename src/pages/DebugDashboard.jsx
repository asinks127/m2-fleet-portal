import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient.js';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Link, useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils/index.js';
import {
  Upload,
  History,
  CheckCircle,
  Clock,
  FileText,
  DollarSign,
  AlertCircle,
  Loader2,
  XCircle,
  FileSignature,
  PenTool
} from 'lucide-react';
import SafetyMessageModal from '../components/safety/SafetyMessageModal';
import AnnouncementBanner from '../components/AnnouncementBanner';

// INLINED COMPONENT TO ENSURE VISIBILITY
function InlineDocumentsToSignTab({ user }) {
    const [documents, setDocuments] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchDocuments = async () => {
            if (!user) return;
            setIsLoading(true);
            try {
                // Use backend function to ensure we get all documents regardless of entity permissions
                const response = await (await fetch('/api/getContractorDocuments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
                    targetUserId: user.id,
                    targetUserEmail: user.email
                }) })).json();

                const allRequests = response.data.signatureRequests || [];
                
                // Filter locally for status 'Sent' or 'Viewed'
                const pendingDocs = allRequests.filter(req => 
                    req.status === 'Sent' || req.status === 'Viewed'
                ).sort((a, b) => new Date(b.created_date) - new Date(a.created_date));

                setDocuments(pendingDocs);
            } catch (error) {
                console.error('Error fetching documents to sign:', error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchDocuments();
    }, [user]);

    const handleSign = (requestId) => {
        // Navigate to SignDocument page with internal ID
        window.location.href = `/SignDocument?id=${requestId}`;
    };

    // Always show the card so users know where to look
    return (
        <Card className="border-blue-200 bg-blue-50/30 mb-6">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2 text-blue-800">
                    <FileSignature className="w-5 h-5" />
                    Documents Requiring Your Signature
                </CardTitle>
                <Button variant="ghost" size="sm" onClick={() => window.location.reload()} className="h-8 w-8 p-0">
                     <Loader2 className={`w-4 h-4 text-blue-600 ${isLoading ? 'animate-spin' : ''}`} />
                </Button>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <div className="flex justify-center p-8">
                        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                    </div>
                ) : documents.length === 0 ? (
                    <div className="text-center py-6 bg-white/50 rounded-lg border border-dashed border-blue-200">
                        <p className="text-gray-500 text-sm">No documents currently waiting for your signature.</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {documents.map(doc => (
                            <div key={doc.id} className="bg-white p-4 rounded-lg shadow-sm border border-blue-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                <div>
                                    <h3 className="font-medium text-gray-900">{doc.documentTitle}</h3>
                                    <p className="text-sm text-gray-500">
                                        Received: {formatCentralTime(doc.created_date)}
                                    </p>
                                </div>
                                <div className="flex items-center gap-3">
                                    {doc.status === 'Viewed' && (
                                        <Badge variant="outline" className="text-blue-600 border-blue-200">
                                            Viewed
                                        </Badge>
                                    )}
                                    <Button 
                                        onClick={() => handleSign(doc.id)}
                                        className="bg-blue-600 hover:bg-blue-700 text-white"
                                        size="sm"
                                    >
                                        <PenTool className="w-4 h-4 mr-2" />
                                        Sign Now
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

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

export default function DebugDashboard() {
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
      const contractorInvoices = await (await supabase.from('Invoice').select('*').match(
        { contractorEmail: currentUser.email },
        '-created_date',
        100
      )).data;

      console.log('Loaded invoices:', contractorInvoices.length);
      setInvoices(contractorInvoices);

      const pendingCount = contractorInvoices.filter(inv => inv.status === 'pending').length;
      const approvedCount = contractorInvoices.filter(inv => inv.status === 'approved').length;
      const totalAmount = contractorInvoices
        .filter(inv => inv.status === 'approved')
        .reduce((sum, inv) => sum + (parseFloat(inv.totalAmount) || 0), 0);

      setStats({
        totalInvoices: contractorInvoices.length,
        pendingInvoices: pendingCount,
        approvedInvoices: approvedCount,
        totalAmount
      });

      try {
        const latestMessages = await (await supabase.from('SafetyMessage').select('*').match(
          { active: true },
          '-published_at',
          1
        )).data;

        if (latestMessages.length > 0) {
          const message = latestMessages[0];
          const acks = await (await supabase.from('SafetyAcknowledgement').select('*').match({
            messageId: message.id,
            userId: currentUser.id
          })).data;

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
      await (await supabase.from('SafetyAcknowledgement').insert({
        messageId: currentSafetyMessage.id,
        userId: user.id,
        userEmail: user.email,
        userName: user.displayName || user.full_name || user.email,
        acknowledgedAt: new Date().toISOString()
      }));

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
      {/* FORCE VISIBILITY TEST BANNER */}
      <div className="bg-purple-600 text-white p-4 text-center font-bold text-xl mb-6 rounded-lg shadow-lg">
          DEBUG DASHBOARD - IF YOU SEE THIS, YOU ARE ON THE CORRECT PAGE
      </div>
      
      <AnnouncementBanner />

      <div className="max-w-7xl mx-auto space-y-6">
        {/* Documents to Sign Section - MOVED TO TOP AND FORCED VISIBLE */}
        <div className="border-4 border-purple-500 rounded-xl p-2 bg-white">
            <h2 className="text-purple-500 font-bold p-2">DEBUG: SIGNATURE SECTION CONTAINER</h2>
            <InlineDocumentsToSignTab user={user} />
        </div>

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Welcome back! (Debug Mode)</h1>
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
            <Link to={createPageUrl('InvoiceHistory')}>
              <Button variant="outline">
                <History className="w-4 h-4 mr-2" />
                View All
              </Button>
            </Link>
          </div>
        </div>

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
                            Week ending: {invoice.weekEndingDate ? new Date(invoice.weekEndingDate).toLocaleDateString() : 'N/A'}
                          </span>
                          {invoice.totalAmount && (
                            <span className="font-medium text-gray-700">
                              ${parseFloat(invoice.totalAmount).toFixed(2)}
                            </span>
                          )}
                          <span>
                            Submitted: {formatCentralTime(invoice.created_date)}
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