import React, { useState, useEffect, useCallback } from 'react';
import { getSafetyAdminData, weeklyAISafetyMessages } from '@/functions.js';
import { SafetyMessage } from '@/api/entities.js';
import { Button } from '@/components/ui/button.jsx';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card.jsx';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs.jsx';
import { PlusCircle, ShieldCheck, Eye, Loader2, AlertTriangle, Sparkles, Trash2 } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Alert, AlertDescription } from '@/components/ui/alert.jsx';
import NewSafetyMessageForm from '../components/safety/NewSafetyMessageForm';
import AcknowledgementList from '../components/safety/AcknowledgementList';
import WorkersCompManager from '../components/safety/WorkersCompManager';
import CertificationManager from '../components/safety/CertificationManager';
import { format, isAfter, isBefore, addDays } from 'date-fns';

export default function SafetyAdmin() {
  const [messages, setMessages] = useState([]);
  const [workersCompRecords, setWorkersCompRecords] = useState([]);
  const [certifications, setCertifications] = useState([]);
  const [contractors, setContractors] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isAcknowledgementsOpen, setIsAcknowledgementsOpen] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [actionStatus, setActionStatus] = useState(null);
  const [isSending, setIsSending] = useState(false);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setActionStatus(null);
    try {
      const { data: result, error } = await getSafetyAdminData();
      if (error || !result) {
        throw new Error(error?.message || 'Failed to fetch safety data from the server.');
      }
      
      const { messages: messageData, users: allUsers, workersCompRecords: workersCompData, certifications: certData } = result;

      const activeContractors = allUsers.filter(user => user && user.active !== false);
      
      setMessages(messageData);
      setContractors(activeContractors);
      setWorkersCompRecords(workersCompData);
      setCertifications(certData);
      
      checkExpirations(workersCompData, certData);
      
    } catch (error) {
      console.error("Failed to load safety data:", error);
      setActionStatus({ type: 'error', message: 'Failed to load safety data.' });
    } finally {
      setIsLoading(false);
    }
  }, []);

  const checkExpirations = (workersComp, certs) => {
    const alertList = [];
    const thirtyDaysFromNow = addDays(new Date(), 30);
    
    workersComp.forEach(record => {
      const expDate = new Date(record.expirationDate);
      if (isBefore(expDate, thirtyDaysFromNow) && isAfter(expDate, new Date())) {
        alertList.push({
          type: 'workerscomp',
          message: `${record.userName}'s Workers' Comp expires on ${format(expDate, 'MMM d, yyyy')}`,
          severity: 'warning'
        });
      } else if (isBefore(expDate, new Date())) {
        alertList.push({
          type: 'workerscomp',
          message: `${record.userName}'s Workers' Comp EXPIRED on ${format(expDate, 'MMM d, yyyy')}`,
          severity: 'error'
        });
      }
    });
    
    certs.forEach(cert => {
      if (cert.expirationDate) {
        const expDate = new Date(cert.expirationDate);
        if (isBefore(expDate, thirtyDaysFromNow) && isAfter(expDate, new Date())) {
          alertList.push({
            type: 'certification',
            message: `${cert.userName}'s ${cert.certificationType} expires on ${format(expDate, 'MMM d, yyyy')}`,
            severity: 'warning'
          });
        } else if (isBefore(expDate, new Date())) {
          alertList.push({
            type: 'certification',
            message: `${cert.userName}'s ${cert.certificationType} EXPIRED on ${format(expDate, 'MMM d, yyyy')}`,
            severity: 'error'
          });
        }
      }
    });
    
    setAlerts(alertList);
  };

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleShowAcks = (message) => {
    setSelectedMessage(message);
    setIsAcknowledgementsOpen(true);
  };

  const handleSendAIMessage = async () => {
    setIsSending(true);
    setActionStatus(null);
    try {
      const { data: result } = await weeklyAISafetyMessages();
      if (result.success) {
        setActionStatus({ type: 'success', message: `AI safety message sent to ${result.safetyMessage.recipientCount} technicians!` });
        loadData();
      } else {
        throw new Error(result.error || 'An unknown error occurred.');
      }
    } catch (error) {
      console.error('Error sending AI safety message:', error);
      setActionStatus({ type: 'error', message: `Failed to send AI safety message: ${error.message}` });
    } finally {
      setIsSending(false);
    }
  };

  const handleDeleteMessage = async (messageId) => {
    if (!window.confirm('Are you sure you want to delete this message? This action cannot be undone.')) {
      return;
    }
    setActionStatus(null);
    try {
      await SafetyMessage.delete(messageId);
      setActionStatus({ type: 'success', message: 'Safety message deleted successfully.' });
      loadData();
    } catch (error) {
      console.error('Error deleting message:', error);
      setActionStatus({ type: 'error', message: `Failed to delete message: ${error.message}` });
    }
  };
  
  const getStatusBadge = (status) => {
    const colors = {
      'Active': 'bg-green-100 text-green-800',
      'Expired': 'bg-red-100 text-red-800',
      'Pending Renewal': 'bg-yellow-100 text-yellow-800',
      'Cancelled': 'bg-gray-100 text-gray-800',
      'Revoked': 'bg-red-100 text-red-800'
    };
    return <Badge className={colors[status] || 'bg-gray-100 text-gray-800'}>{status}</Badge>;
  };
  
  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <ShieldCheck className="w-8 h-8 text-green-600" />
            <span>Safety Management</span>
          </h1>
          <p className="text-gray-600 mt-1">Comprehensive safety compliance tracking and management with AI-powered automation.</p>
        </div>
        <div className="flex gap-3">
          <Button 
            onClick={() => setIsFormOpen(true)}
            variant="outline"
          >
            <PlusCircle className="w-4 h-4 mr-2" />
            Manual Message
          </Button>
          <Button 
            onClick={handleSendAIMessage}
            disabled={isSending}
            className="bg-purple-600 hover:bg-purple-700 text-white"
          >
            {isSending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4 mr-2" />
            )}
            {isSending ? 'Sending...' : 'Send AI Message Now'}
          </Button>
        </div>
      </div>

      {actionStatus && (
        <Alert variant={actionStatus.type === 'error' ? 'destructive' : 'default'}>
          {actionStatus.type === 'error' ? <AlertTriangle className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
          <AlertDescription>{actionStatus.message}</AlertDescription>
        </Alert>
      )}

      <Card className="border-purple-200 bg-gradient-to-r from-purple-50 to-blue-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-purple-800">
            <Sparkles className="w-5 h-5" />
            AI-Powered Weekly Safety Messages
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-semibold mb-2">Automation Status</h4>
              <p className="text-sm text-gray-600 mb-3">
                AI automatically generates and sends contextual safety messages every Monday morning based on:
              </p>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Current season and weather conditions</li>
                <li>• Industry-specific hazards and best practices</li>
                <li>• Recent safety topics to avoid repetition</li>
                <li>• Relevant OSHA guidelines and updates</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Next Scheduled</h4>
              <p className="text-lg font-medium text-purple-700">
                {format(addDays(new Date(), (8 - new Date().getDay()) % 7 || 7), 'EEEE, MMMM d, yyyy')}
              </p>
              <p className="text-sm text-gray-600 mt-1">
                Every Monday at 8:00 AM
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((alert, index) => (
            <Alert key={index} variant={alert.severity === 'error' ? 'destructive' : 'default'}>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{alert.message}</AlertDescription>
            </Alert>
          ))}
        </div>
      )}
      
      <Tabs defaultValue="safety_messages" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="safety_messages">Safety Messages</TabsTrigger>
          <TabsTrigger value="workers_comp">Workers' Comp</TabsTrigger>
          <TabsTrigger value="certifications">Certifications</TabsTrigger>
          <TabsTrigger value="compliance_overview">Compliance Overview</TabsTrigger>
        </TabsList>

        <TabsContent value="safety_messages">
          <Card>
            <CardHeader>
              <CardTitle>Safety Messages & Monthly Memos</CardTitle>
              <CardDescription>Manage OSHA safety messages and automated monthly compliance memos.</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center p-8">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Date Published</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {messages.map((msg) => (
                      <TableRow key={msg.id}>
                        <TableCell className="font-medium">{msg.title}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{msg.category || 'General Safety'}</Badge>
                        </TableCell>
                        <TableCell>{format(new Date(msg.publishDate), 'MMM d, yyyy')}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={() => handleShowAcks(msg)}>
                              <Eye className="w-4 h-4 mr-1" />
                              Acknowledgements
                            </Button>
                            <Button variant="destructive" size="sm" onClick={() => handleDeleteMessage(msg.id)}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="workers_comp">
          <WorkersCompManager 
            records={workersCompRecords} 
            contractors={contractors}
            onUpdate={loadData}
          />
        </TabsContent>

        <TabsContent value="certifications">
          <CertificationManager 
            certifications={certifications}
            contractors={contractors}
            onUpdate={loadData}
          />
        </TabsContent>

        <TabsContent value="compliance_overview">
          <div className="grid lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Monthly Safety Memo Status</CardTitle>
                <CardDescription>Track monthly safety memo acknowledgements by contractor.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {contractors.map(contractor => {
                    const currentMonth = format(new Date(), 'yyyy-MM');
                    const monthlyMessage = messages.find(m => 
                      m.isMonthly && 
                      m.scheduledFor && 
                      m.scheduledFor.startsWith(currentMonth)
                    );
                    
                    const hasAcknowledged = false;
                    
                    return (
                      <div key={contractor.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div>
                          <p className="font-medium">{contractor.name}</p>
                          <p className="text-sm text-gray-500">{contractor.project}</p>
                        </div>
                        <Badge className={hasAcknowledged ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                          {hasAcknowledged ? 'Acknowledged' : 'Pending'}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Compliance Summary</CardTitle>
                <CardDescription>Overview of safety compliance status across all contractors.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center p-4 bg-green-50 rounded-lg">
                      <div className="text-2xl font-bold text-green-600">{workersCompRecords.filter(r => r.status === 'Active').length}</div>
                      <div className="text-sm text-gray-600">Active Workers' Comp</div>
                    </div>
                    <div className="text-center p-4 bg-blue-50 rounded-lg">
                      <div className="text-2xl font-bold text-blue-600">{certifications.filter(c => c.status === 'Active').length}</div>
                      <div className="text-sm text-gray-600">Active Certifications</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center p-4 bg-yellow-50 rounded-lg">
                      <div className="text-2xl font-bold text-yellow-600">{alerts.filter(a => a.severity === 'warning').length}</div>
                      <div className="text-sm text-gray-600">Expiring Soon</div>
                    </div>
                    <div className="text-center p-4 bg-red-50 rounded-lg">
                      <div className="text-2xl font-bold text-red-600">{alerts.filter(a => a.severity === 'error').length}</div>
                      <div className="text-sm text-gray-600">Expired</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Create New Safety Message</DialogTitle>
          </DialogHeader>
          <NewSafetyMessageForm
            onSuccess={() => {
              setIsFormOpen(false);
              loadData();
            }}
          />
        </DialogContent>
      </Dialog>
      
      {selectedMessage && (
        <AcknowledgementList 
          isOpen={isAcknowledgementsOpen}
          onClose={() => setIsAcknowledgementsOpen(false)}
          messageId={selectedMessage.id}
          messageTitle={selectedMessage.title}
          messageContent={selectedMessage.content}
        />
      )}
    </div>
  );
}