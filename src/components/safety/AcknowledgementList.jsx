import React, { useState, useEffect, useCallback } from 'react';
import { SafetyAcknowledgement } from '@/api/entities.js';
import { Loader2, FileSpreadsheet, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button.jsx';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog.jsx';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { format } from 'date-fns';

export default function AcknowledgementList({ isOpen, onClose, messageId, messageTitle, messageContent }) {
  const [list, setList] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadAcknowledgements = useCallback(async () => {
    setIsLoading(true);
    try {
      const acks = await SafetyAcknowledgement.filter({ messageId }, '-acknowledgedAt');
      
      // Deduplicate by email - keep the most recent acknowledgement per person
      const uniqueAcks = [];
      const seenEmails = new Set();
      
      acks.forEach(ack => {
        const email = ack.userEmail?.toLowerCase();
        if (email && !seenEmails.has(email)) {
          seenEmails.add(email);
          uniqueAcks.push(ack);
        }
      });
      
      setList(uniqueAcks);
    } catch (error) {
      console.error("Failed to load acknowledgements:", error);
    } finally {
      setIsLoading(false);
    }
  }, [messageId]);

  useEffect(() => {
    if (isOpen && messageId) {
      loadAcknowledgements();
    }
  }, [isOpen, messageId, loadAcknowledgements]);

  const exportToCSV = () => {
    if (list.length === 0) return;

    // Include the message content at the top
    const messageSection = [
      'SAFETY MESSAGE',
      `"${messageTitle || ''}"`,
      '',
      'MESSAGE CONTENT:',
      `"${(messageContent || '').replace(/"/g, '""')}"`,
      '',
      'ACKNOWLEDGEMENTS:'
    ].join('\n');

    const headers = ['Technician Name', 'Email', 'Acknowledged Date', 'Acknowledged Time'];
    const csvContent = [
      messageSection,
      headers.join(','),
      ...list.map(ack => [
        `"${ack.userName || ''}"`,
        `"${ack.userEmail || ''}"`,
        `"${format(new Date(ack.acknowledgedAt), 'MMM d, yyyy')}"`,
        `"${format(new Date(ack.acknowledgedAt), 'h:mm a')}"`,
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `safety-acknowledgements-${messageTitle?.replace(/[^a-zA-Z0-9]/g, '-') || 'message'}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    a.remove();
  };

  const exportToPDF = () => {
    if (list.length === 0) return;

    // Clean HTML tags from message content for better PDF display
    const cleanContent = (messageContent || '')
      .replace(/<[^>]*>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>');

    // Create a printable HTML page with the message content
    const printContent = `
      <html>
        <head>
          <title>Safety Message Acknowledgements</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 40px; }
            h1 { color: #333; border-bottom: 2px solid #eee; padding-bottom: 10px; }
            h2 { color: #666; margin-top: 30px; }
            .message-box { 
              background-color: #f0f9ff; 
              padding: 20px; 
              border-radius: 8px; 
              margin: 20px 0;
              border-left: 4px solid #3b82f6;
            }
            .message-content {
              white-space: pre-wrap;
              line-height: 1.6;
              color: #374151;
            }
            table { border-collapse: collapse; width: 100%; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
            th { background-color: #f5f5f5; font-weight: bold; }
            tr:nth-child(even) { background-color: #f9f9f9; }
            .summary { background-color: #e8f4fd; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
          </style>
        </head>
        <body>
          <h1>Safety Message Acknowledgements</h1>
          
          <div class="summary">
            <h2>Message: ${messageTitle || 'Safety Message'}</h2>
            <p><strong>Total Unique Recipients:</strong> ${list.length}</p>
            <p><strong>Report Generated:</strong> ${format(new Date(), 'MMMM d, yyyy \'at\' h:mm a')}</p>
          </div>

          <div class="message-box">
            <h3 style="margin-top: 0; color: #1e40af;">Full Message Content:</h3>
            <div class="message-content">${cleanContent}</div>
          </div>

          <h2>Acknowledgements (${list.length} unique recipients)</h2>
          <table>
            <thead>
              <tr>
                <th>Technician Name</th>
                <th>Email</th>
                <th>Acknowledged Date</th>
                <th>Acknowledged Time</th>
              </tr>
            </thead>
            <tbody>
              ${list.map(ack => `
                <tr>
                  <td>${ack.userName || ''}</td>
                  <td>${ack.userEmail || ''}</td>
                  <td>${format(new Date(ack.acknowledgedAt), 'MMM d, yyyy')}</td>
                  <td>${format(new Date(ack.acknowledgedAt), 'h:mm a')}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Safety Message Acknowledgements</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={exportToCSV} disabled={list.length === 0}>
                <FileSpreadsheet className="w-4 h-4 mr-2" />
                Export CSV
              </Button>
              <Button variant="outline" size="sm" onClick={exportToPDF} disabled={list.length === 0}>
                <FileText className="w-4 h-4 mr-2" />
                Export PDF
              </Button>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="bg-blue-50 p-4 rounded-lg">
            <h3 className="font-semibold text-blue-900">Message: {messageTitle}</h3>
            <p className="text-sm text-blue-700 mt-1">
              Total Unique Recipients: <span className="font-semibold">{list.length}</span>
            </p>
          </div>

          {isLoading ? (
            <div className="flex justify-center items-center p-8">
              <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
              <span className="ml-2">Loading acknowledgements...</span>
            </div>
          ) : list.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">No acknowledgements yet for this message.</p>
            </div>
          ) : (
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Technician</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Date Acknowledged</TableHead>
                    <TableHead>Time Acknowledged</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {list.map((ack) => (
                    <TableRow key={ack.id}>
                      <TableCell className="font-medium">{ack.userName}</TableCell>
                      <TableCell>{ack.userEmail}</TableCell>
                      <TableCell>{format(new Date(ack.acknowledgedAt), 'MMM d, yyyy')}</TableCell>
                      <TableCell>{format(new Date(ack.acknowledgedAt), 'h:mm a')}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}