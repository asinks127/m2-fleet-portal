import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Search, BookOpen, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/components/ui/use-toast';

export default function SafetyBulletins() {
  const { toast } = useToast();
  const [messages, setMessages] = useState([]);
  const [acknowledgments, setAcknowledgments] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [user, setUser] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const me = await base44.auth.me();
      setUser(me);

      const [allMessages, acks] = await Promise.all([
        base44.entities.SafetyMessage.filter({ active: true }, '-published_at'),
        base44.entities.SafetyAcknowledgement.filter({ userId: me.id })
      ]);

      setMessages(allMessages || []);
      setAcknowledgments(new Set(acks.map(a => a.messageId)));
    } catch (error) {
      console.error('Error fetching safety bulletins:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAcknowledge = async (messageId) => {
    try {
      await base44.entities.SafetyAcknowledgement.create({
        messageId,
        userId: user.id,
        userEmail: user.email,
        userName: user.full_name || user.email,
        acknowledgedAt: new Date().toISOString(),
        ipAddress: 'User device',
        deviceInfo: navigator.userAgent
      });
      setAcknowledgments(prev => new Set(prev).add(messageId));
      toast({ title: 'Success', description: 'Acknowledgment recorded.' });
    } catch (error) {
      console.error('Failed to acknowledge:', error);
      toast({ title: 'Error', description: 'Could not record acknowledgment.', variant: 'destructive' });
    }
  };

  const filteredMessages = messages.filter(m => 
    m.title?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    m.category?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.content?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>;
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center">
          <BookOpen className="w-8 h-8 mr-3 text-blue-600" />
          Safety Bulletins
        </h1>
        <p className="text-gray-600 mt-2">
          Review important safety bulletins, alerts, and acknowledge them.
        </p>
      </div>

      <div className="relative max-w-md mb-8">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
        <Input 
          placeholder="Search bulletins..." 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {filteredMessages.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center text-gray-500">
            <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <h3 className="text-xl font-medium text-gray-700">No bulletins found</h3>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6">
          {filteredMessages.map((msg) => (
            <Card key={msg.id} className="overflow-hidden border-t-4 border-t-blue-500">
              <CardHeader className="bg-blue-50/50 pb-4">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-200">
                        {msg.category || 'General Safety'}
                      </Badge>
                      {msg.published_at || msg.publishDate && (
                        <span className="text-xs text-gray-500">
                          Published: {format(new Date(msg.published_at || msg.publishDate), 'MMM d, yyyy')}
                        </span>
                      )}
                    </div>
                    <CardTitle className="text-xl">{msg.title}</CardTitle>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                
                <div>
                  <h4 className="font-semibold text-gray-900 border-b pb-1 mb-2">Bulletin Content</h4>
                  <div className="text-gray-700 whitespace-pre-wrap" dangerouslySetInnerHTML={{__html: msg.content}}></div>
                </div>
                
                <div className="pt-4 border-t mt-6">
                  {acknowledgments.has(msg.id) ? (
                    <div className="flex items-center text-green-600 font-medium bg-green-50 p-3 rounded-lg">
                      <CheckCircle2 className="w-5 h-5 mr-2" />
                      You have acknowledged reading this bulletin.
                    </div>
                  ) : (
                    <div className="bg-orange-50 border border-orange-200 p-4 rounded-lg flex flex-col sm:flex-row items-center justify-between gap-4">
                      <div className="text-orange-900 text-sm font-medium">
                        Please acknowledge that you have read and understood this safety bulletin.
                      </div>
                      <Button 
                        onClick={() => handleAcknowledge(msg.id)}
                        className="bg-blue-600 hover:bg-blue-700 whitespace-nowrap text-white"
                      >
                        I have read and understood
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}