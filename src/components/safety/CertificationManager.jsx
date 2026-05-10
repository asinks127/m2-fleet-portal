import React, { useState } from 'react';
import { SafetyCertification } from '@/api/entities.js';
import { UploadFile } from '@/api/integrations.js';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Label } from '@/components/ui/label.jsx';
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
import { PlusCircle, Upload, ExternalLink, Calendar, AlertTriangle, Award } from 'lucide-react';
import { format, isBefore, addDays } from 'date-fns';

const CERTIFICATION_TYPES = [
  'OSHA 10', 'OSHA 30', 'First Aid', 'CPR', 'Confined Space', 
  'Fall Protection', 'Hazmat', 'Other'
];

export default function CertificationManager({ certifications, contractors, onUpdate }) {
  const [isAddingCert, setIsAddingCert] = useState(false);
  const [formData, setFormData] = useState({
    userId: '',
    certificationType: '',
    certificationNumber: '',
    issuingOrganization: '',
    issueDate: '',
    expirationDate: '',
    status: 'Active'
  });
  const [uploadingFile, setUploadingFile] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const selectedContractor = contractors.find(c => c.id === formData.userId);
      await SafetyCertification.create({
        ...formData,
        userEmail: selectedContractor.email,
        userName: selectedContractor.name
      });
      
      setIsAddingCert(false);
      setFormData({
        userId: '',
        certificationType: '',
        certificationNumber: '',
        issuingOrganization: '',
        issueDate: '',
        expirationDate: '',
        status: 'Active'
      });
      onUpdate();
    } catch (error) {
      console.error('Error creating certification:', error);
    }
  };

  const handleFileUpload = async (e, certId) => {
    const file = e.target.files[0];
    if (!file) return;
    
    setUploadingFile(true);
    try {
      const { file_url } = await UploadFile({ file });
      await SafetyCertification.update(certId, { documentUrl: file_url });
      onUpdate();
    } catch (error) {
      console.error('Error uploading file:', error);
    } finally {
      setUploadingFile(false);
    }
  };

  const getStatusBadge = (status, expirationDate) => {
    if (!expirationDate) {
      return <Badge className="bg-green-100 text-green-800">Active</Badge>;
    }
    
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
      'Revoked': 'bg-red-100 text-red-800'
    };
    return <Badge className={colors[status] || 'bg-gray-100 text-gray-800'}>{status}</Badge>;
  };

  const getCertificationIcon = (type) => {
    return <Award className="w-4 h-4 text-blue-500" />;
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Safety Certifications</CardTitle>
          <p className="text-sm text-gray-600">Track OSHA and other safety certifications for all contractors.</p>
        </div>
        <Dialog open={isAddingCert} onOpenChange={setIsAddingCert}>
          <DialogTrigger asChild>
            <Button>
              <PlusCircle className="w-4 h-4 mr-2" />
              Add Certification
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Add Safety Certification</DialogTitle>
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
                  <Label htmlFor="certificationType">Certification Type</Label>
                  <Select value={formData.certificationType} onValueChange={(value) => setFormData({...formData, certificationType: value})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select type..." />
                    </SelectTrigger>
                    <SelectContent>
                      {CERTIFICATION_TYPES.map(type => (
                        <SelectItem key={type} value={type}>{type}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="certificationNumber">Certification Number</Label>
                  <Input
                    id="certificationNumber"
                    value={formData.certificationNumber}
                    onChange={(e) => setFormData({...formData, certificationNumber: e.target.value})}
                  />
                </div>
                <div>
                  <Label htmlFor="issuingOrganization">Issuing Organization</Label>
                  <Input
                    id="issuingOrganization"
                    value={formData.issuingOrganization}
                    onChange={(e) => setFormData({...formData, issuingOrganization: e.target.value})}
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
                  <Label htmlFor="expirationDate">Expiration Date (Optional)</Label>
                  <Input
                    id="expirationDate"
                    type="date"
                    value={formData.expirationDate}
                    onChange={(e) => setFormData({...formData, expirationDate: e.target.value})}
                  />
                </div>
              </div>
              
              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={() => setIsAddingCert(false)}>
                  Cancel
                </Button>
                <Button type="submit">Create Certification</Button>
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
              <TableHead>Certification</TableHead>
              <TableHead>Number</TableHead>
              <TableHead>Issuing Org</TableHead>
              <TableHead>Expiration</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {certifications.map((cert) => (
              <TableRow key={cert.id}>
                <TableCell>{cert.userName}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {getCertificationIcon(cert.certificationType)}
                    {cert.certificationType}
                  </div>
                </TableCell>
                <TableCell>{cert.certificationNumber || 'N/A'}</TableCell>
                <TableCell>{cert.issuingOrganization || 'N/A'}</TableCell>
                <TableCell>
                  {cert.expirationDate ? (
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-gray-400" />
                      {format(new Date(cert.expirationDate), 'MMM d, yyyy')}
                      {isBefore(new Date(cert.expirationDate), addDays(new Date(), 30)) && (
                        <AlertTriangle className="w-4 h-4 text-yellow-500" />
                      )}
                    </div>
                  ) : (
                    <span className="text-gray-500">No expiration</span>
                  )}
                </TableCell>
                <TableCell>
                  {getStatusBadge(cert.status, cert.expirationDate)}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {cert.documentUrl ? (
                      <Button variant="outline" size="sm" onClick={() => window.open(cert.documentUrl, '_blank')}>
                        <ExternalLink className="w-4 h-4" />
                      </Button>
                    ) : (
                      <div>
                        <input
                          type="file"
                          id={`upload-cert-${cert.id}`}
                          className="hidden"
                          accept=".pdf,.jpg,.jpeg,.png"
                          onChange={(e) => handleFileUpload(e, cert.id)}
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => document.getElementById(`upload-cert-${cert.id}`).click()}
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