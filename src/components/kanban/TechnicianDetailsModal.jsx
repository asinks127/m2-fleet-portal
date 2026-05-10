
import React, { useState, useEffect, useCallback } from 'react';
import { User, WorkersCompRecord, SafetyCertification } from '@/api/entities.js';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Label } from '@/components/ui/label.jsx';
import { Textarea } from '@/components/ui/textarea.jsx';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select.jsx';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Loader2, Save, User as UserIcon, Shield } from 'lucide-react';
import { format } from 'date-fns';

export default function TechnicianDetailsModal({ technician, isOpen, onClose, onUpdate }) {
  const [formData, setFormData] = useState({});
  const [complianceData, setComplianceData] = useState({ wc: null, certs: [] });
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const loadComplianceData = useCallback(async () => {
    if (!technician) return; // This check is crucial for useCallback's dependency array.
    setIsLoading(true);
    try {
      const [wcRecords, certRecords] = await Promise.all([
        WorkersCompRecord.filter({ userEmail: technician.email }),
        SafetyCertification.filter({ userEmail: technician.email })
      ]);
      
      setComplianceData({
        wc: wcRecords[0] || null,
        certs: certRecords
      });
    } catch (error) {
      console.error('Error loading compliance data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [technician]); // technician is a dependency because technician.email is used inside.

  useEffect(() => {
    if (isOpen && technician) {
      setFormData({
        displayName: technician.displayName || '',
        business: technician.business || '',
        phone: technician.phone || '',
        location: technician.location || '',
        project: technician.project || '',
        m2PM: technician.m2PM || '',
        veloPM: technician.veloPM || '',
        qcAssignment: technician.qcAssignment || '',
        weeklyPay: technician.weeklyPay || '',
        startDate: technician.startDate || '',
        endDate: technician.endDate || '',
        shadowingStatus: technician.shadowingStatus || 'not_started',
        shadowingStartDate: technician.shadowingStartDate || '',
        shadowingEndDate: technician.shadowingEndDate || '',
        shadowingNotes: technician.shadowingNotes || '',
        sunbeltCertificationStatus: technician.sunbeltCertificationStatus || 'not_required',
        needsInsuranceSetup: technician.needsInsuranceSetup || false,
        needsContractSetup: technician.needsContractSetup || false,
        active: technician.active !== false
      });
      
      loadComplianceData();
    }
  }, [isOpen, technician, loadComplianceData]);

  const handleInputChange = (e) => {
    const { id, value } = e.target;
    setFormData(prev => ({ ...prev, [id]: value }));
  };

  const handleSelectChange = (id, value) => {
    setFormData(prev => ({ ...prev, [id]: value }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await User.update(technician.id, formData);
      onUpdate();
      onClose();
    } catch (error) {
      console.error('Error updating technician:', error);
    } finally {
      setIsSaving(false);
    }
  };

  if (!technician) return null;

  const getComplianceStatus = () => {
    const { wc, certs } = complianceData;
    if (!wc || certs.length === 0) return { status: 'missing', text: 'Missing Documents', color: 'bg-red-100 text-red-800' };
    
    const today = new Date();
    const wcExpired = wc.expirationDate && new Date(wc.expirationDate) < today;
    const certsExpired = certs.some(cert => cert.expirationDate && new Date(cert.expirationDate) < today);
    
    if (wcExpired || certsExpired) return { status: 'expired', text: 'Documents Expired', color: 'bg-red-100 text-red-800' };
    
    const wcExpiring = wc.expirationDate && new Date(wc.expirationDate) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const certsExpiring = certs.some(cert => cert.expirationDate && new Date(cert.expirationDate) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000));
    
    if (wcExpiring || certsExpiring) return { status: 'expiring', text: 'Documents Expiring Soon', color: 'bg-yellow-100 text-yellow-800' };
    
    return { status: 'compliant', text: 'Compliant', color: 'bg-green-100 text-green-800' };
  };

  const complianceStatus = getComplianceStatus();
  const isSunbeltProject = (formData.project || technician.project || '').toLowerCase().includes('sunbelt');

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <UserIcon className="w-6 h-6" />
            {technician.displayName || technician.full_name} - Edit Profile
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="profile" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="shadowing">Shadowing</TabsTrigger>
            <TabsTrigger value="compliance">Compliance</TabsTrigger>
            <TabsTrigger value="project">Project Info</TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="displayName">Display Name</Label>
                <Input id="displayName" value={formData.displayName} onChange={handleInputChange} />
              </div>
              <div>
                <Label htmlFor="business">Business Name</Label>
                <Input id="business" value={formData.business} onChange={handleInputChange} />
              </div>
              <div>
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" value={formData.phone} onChange={handleInputChange} />
              </div>
              <div>
                <Label htmlFor="location">Location</Label>
                <Input id="location" value={formData.location} onChange={handleInputChange} />
              </div>
              <div>
                <Label htmlFor="weeklyPay">Weekly Pay Target</Label>
                <Input id="weeklyPay" type="number" value={formData.weeklyPay} onChange={handleInputChange} />
              </div>
              <div>
                <Label htmlFor="active">Status</Label>
                <Select value={String(formData.active)} onValueChange={(val) => handleSelectChange('active', val === 'true')}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">Active</SelectItem>
                    <SelectItem value="false">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="shadowing" className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="shadowingStatus">Shadowing Status</Label>
                <Select value={formData.shadowingStatus} onValueChange={(val) => handleSelectChange('shadowingStatus', val)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="not_started">Not Started</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {isSunbeltProject && (
                <div>
                  <Label htmlFor="sunbeltCertificationStatus">Sunbelt Certification Status</Label>
                  <Select value={formData.sunbeltCertificationStatus} onValueChange={(val) => handleSelectChange('sunbeltCertificationStatus', val)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="not_required">Not Required</SelectItem>
                      <SelectItem value="not_started">Not Started</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="failed">Failed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="flex items-center gap-4 pt-6 col-span-2 md:col-span-1">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.needsInsuranceSetup}
                    onChange={(e) => handleSelectChange('needsInsuranceSetup', e.target.checked)}
                  />
                  <span className="text-sm">Needs Insurance Setup</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.needsContractSetup}
                    onChange={(e) => handleSelectChange('needsContractSetup', e.target.checked)}
                  />
                  <span className="text-sm">Needs Contract Setup</span>
                </label>
              </div>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="shadowingStartDate">Shadowing Start Date</Label>
                <Input id="shadowingStartDate" type="date" value={formData.shadowingStartDate} onChange={handleInputChange} />
              </div>
              <div>
                <Label htmlFor="shadowingEndDate">Shadowing End Date</Label>
                <Input id="shadowingEndDate" type="date" value={formData.shadowingEndDate} onChange={handleInputChange} />
              </div>
            </div>
            <div>
              <Label htmlFor="shadowingNotes">Shadowing Notes</Label>
              <Textarea id="shadowingNotes" value={formData.shadowingNotes} onChange={handleInputChange} rows={3} />
            </div>
          </TabsContent>

          <TabsContent value="compliance" className="space-y-4">
            <div className="flex items-center gap-3 p-4 border rounded-lg">
              <Shield className="w-6 h-6" />
              <div>
                <h4 className="font-semibold">Compliance Status</h4>
                <Badge className={complianceStatus.color}>{complianceStatus.text}</Badge>
              </div>
            </div>
            
            {isLoading ? (
              <div className="flex justify-center py-4">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2">Workers Compensation</h4>
                  {complianceData.wc ? (
                    <div className="p-3 border rounded-lg bg-gray-50">
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <span>Provider: {complianceData.wc.provider}</span>
                        <span>Policy #: {complianceData.wc.policyNumber}</span>
                        <span>Expires: {complianceData.wc.expirationDate ? format(new Date(complianceData.wc.expirationDate), 'MMM d, yyyy') : 'N/A'}</span>
                        <span>Status: <Badge variant="outline">{complianceData.wc.status}</Badge></span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-gray-500">No workers compensation record found.</p>
                  )}
                </div>

                <div>
                  <h4 className="font-semibold mb-2">Safety Certifications</h4>
                  {complianceData.certs.length > 0 ? (
                    <div className="space-y-2">
                      {complianceData.certs.map(cert => (
                        <div key={cert.id} className="p-3 border rounded-lg bg-gray-50">
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <span>Type: {cert.certificationType}</span>
                            <span>Number: {cert.certificationNumber || 'N/A'}</span>
                            <span>Expires: {cert.expirationDate ? format(new Date(cert.expirationDate), 'MMM d, yyyy') : 'N/A'}</span>
                            <span>Status: <Badge variant="outline">{cert.status}</Badge></span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500">No safety certifications found.</p>
                  )}
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="project" className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="project">Project</Label>
                <Input id="project" value={formData.project} onChange={handleInputChange} />
              </div>
              <div>
                <Label htmlFor="qcAssignment">QC Assignment</Label>
                <Select value={formData.qcAssignment || ''} onValueChange={(val) => handleSelectChange('qcAssignment', val)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select QC Manager" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={null}>No Assignment</SelectItem>
                    <SelectItem value="Ryan Miller">Ryan Miller</SelectItem>
                    <SelectItem value="Chance Hoffman">Chance Hoffman</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="m2PM">M2 Project Manager</Label>
                <Input id="m2PM" value={formData.m2PM} onChange={handleInputChange} />
              </div>
              <div>
                <Label htmlFor="veloPM">Velo Project Manager</Label>
                <Input id="veloPM" value={formData.veloPM} onChange={handleInputChange} />
              </div>
              <div>
                <Label htmlFor="startDate">Contract Start Date</Label>
                <Input id="startDate" type="date" value={formData.startDate} onChange={handleInputChange} />
              </div>
              <div>
                <Label htmlFor="endDate">Contract End Date</Label>
                <Input id="endDate" type="date" value={formData.endDate} onChange={handleInputChange} />
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            <Save className="w-4 h-4 mr-2" />
            Save Changes
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
