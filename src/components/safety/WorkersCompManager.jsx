import React, { useState } from 'react';
import { WorkersCompRecord } from '@/api/entities.js';
import { UploadFile } from '@/api/integrations.js';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Label } from '@/components/ui/label.jsx';
import { Textarea } from '@/components/ui/textarea.jsx';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select.jsx';
import { Badge } from '@/components/ui/badge.jsx';
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
  DialogTrigger,
} from '@/components/ui/dialog.jsx';
import { PlusCircle, Upload, ExternalLink, Calendar, AlertTriangle } from 'lucide-react';
import { format, isBefore, addDays } from 'date-fns';

export default function WorkersCompManager({ records, contractors, onUpdate }) {
  const [isAddingRecord, setIsAddingRecord] = useState(false);
  const [formData, setFormData] = useState({
    userId: '',
    policyNumber: '',
    provider: '',
    issueDate: '',
    expirationDate: '',
    coverageAmount: '',
    status: 'Active',
    notes: ''
  });
  const [uploadingFile, setUploadingFile] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const selectedContractor = contractors.find(c => c.id === formData.userId);
      await WorkersCompRecord.create({
        ...formData,
        userEmail: selectedContractor.email,
        userName: selectedContractor.name,
        coverageAmount: parseFloat(formData.coverageAmount) || 0
      });
      
      setIsAddingRecord(false);
      setFormData({
        userId: '',
        policyNumber: '',
        provider: '',
        issueDate: '',
        expirationDate: '',
        coverageAmount: '',
        status: 'Active',
        notes: ''
      });
      onUpdate();
    } catch (error) {
      console.error('Error creating workers comp record:', error);
    }
  };

  const handleFileUpload = async (e, recordId) => {
    const file = e.target.files[0];
    if (!file) return;
    
    setUploadingFile(true);
    try {
      const { file_url } = await UploadFile({ file });
      await WorkersCompRecord.update(recordId, { documentUrl: file_url });
      onUpdate();
    } catch (error) {
      console.error('Error uploading file:', error);
    } finally {
      setUploadingFile(false);
    }
  };

  const getStatusBadge = (status, expirationDate) => {
    const isExpiring = isBefore(new Date(expirationDate), addDays(new Date(), 30));
    const isExpired = isBefore(new Date(expirationDate), new Date());
    
    if (isExpired) {
      return <Badge className="bg-red-100 text-red-800">Expired</Badge>;
    }
    if (isExpiring) {
      return <Badge className="bg-yellow-100 text-yellow-800">Expiring Soon</Badge>;
    }
    
    const colors = {
      'Active': 'bg-green-100 text-green-800',
      'Pending Renewal': 'bg-yellow-100 text-yellow-800',
      'Cancelled': 'bg-gray-100 text-gray-800'
    };
    return <Badge className={colors[status] || 'bg-gray-100 text-gray-800'}>{status}</Badge>;
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Workers' Compensation Records</CardTitle>
          <p className="text-sm text-gray-600">Track and manage workers' compensation policies for all contractors.</p>
        </div>
        <Dialog open={isAddingRecord} onOpenChange={setIsAddingRecord}>
          <DialogTrigger asChild>
            <Button>
              <PlusCircle className="w-4 h-4 mr-2" />
              Add Record
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Add Workers' Compensation Record</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="contractor">Contractor</Label>
                  <Select value={formData.userId} onValueChange={(value) => setFormData({...formData, userId: value})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select contractor..." />
                    </SelectTrigger>
                    <SelectContent>
                      {contractors.map(contractor => (
                        <SelectItem key={contractor.id} value={contractor.id}>
                          {contractor.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="provider">Insurance Provider</Label>
                  <Input
                    id="provider"
                    value={formData.provider}
                    onChange={(e) => setFormData({...formData, provider: e.target.value})}
                    required
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="policyNumber">Policy Number</Label>
                  <Input
                    id="policyNumber"
                    value={formData.policyNumber}
                    onChange={(e) => setFormData({...formData, policyNumber: e.target.value})}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="coverageAmount">Coverage Amount ($)</Label>
                  <Input
                    id="coverageAmount"
                    type="number"
                    value={formData.coverageAmount}
                    onChange={(e) => setFormData({...formData, coverageAmount: e.target.value})}
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="issueDate">Issue Date</Label>
                  <Input
                    id="issueDate"
                    type="date"
                    value={formData.issueDate}
                    onChange={(e) => setFormData({...formData, issueDate: e.target.value})}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="expirationDate">Expiration Date</Label>
                  <Input
                    id="expirationDate"
                    type="date"
                    value={formData.expirationDate}
                    onChange={(e) => setFormData({...formData, expirationDate: e.target.value})}
                    required
                  />
                </div>
              </div>
              
              <div>
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({...formData, notes: e.target.value})}
                  rows={3}
                />
              </div>
              
              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={() => setIsAddingRecord(false)}>
                  Cancel
                </Button>
                <Button type="submit">Create Record</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Contractor</TableHead>
              <TableHead>Provider</TableHead>
              <TableHead>Policy Number</TableHead>
              <TableHead>Expiration Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {records.map((record) => (
              <TableRow key={record.id}>
                <TableCell>{record.userName}</TableCell>
                <TableCell>{record.provider}</TableCell>
                <TableCell>{record.policyNumber}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    {format(new Date(record.expirationDate), 'MMM d, yyyy')}
                    {isBefore(new Date(record.expirationDate), addDays(new Date(), 30)) && (
                      <AlertTriangle className="w-4 h-4 text-yellow-500" />
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  {getStatusBadge(record.status, record.expirationDate)}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {record.documentUrl ? (
                      <Button variant="outline" size="sm" onClick={() => window.open(record.documentUrl, '_blank')}>
                        <ExternalLink className="w-4 h-4" />
                      </Button>
                    ) : (
                      <div>
                        <input
                          type="file"
                          id={`upload-${record.id}`}
                          className="hidden"
                          accept=".pdf,.jpg,.jpeg,.png"
                          onChange={(e) => handleFileUpload(e, record.id)}
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => document.getElementById(`upload-${record.id}`).click()}
                          disabled={uploadingFile}
                        >
                          <Upload className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}