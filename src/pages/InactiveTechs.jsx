
import React, { useState, useEffect } from 'react';
import { User } from '@/api/entities.js';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select.jsx';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table.jsx';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog.jsx';
import { Textarea } from '@/components/ui/textarea.jsx';
import { Label } from '@/components/ui/label.jsx';
import { Alert, AlertDescription } from '@/components/ui/alert.jsx';
import { 
  UserX, 
  UserCheck, 
  Search, 
  Calendar,
  FileText,
  Phone,
  MapPin,
  Loader2,
  RotateCcw // Add ExternalLink import
} from 'lucide-react';
import { format } from 'date-fns';
import { createPageUrl } from '@/utils/index.js'; // Add createPageUrl import

export default function InactiveTechs() {
  const [inactiveTechs, setInactiveTechs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [reasonFilter, setReasonFilter] = useState('all');
  const [isReactivating, setIsReactivating] = useState(false);
  const [selectedTech, setSelectedTech] = useState(null);
  const [reactivationReason, setReactivationReason] = useState('');
  const [showReactivateDialog, setShowReactivateDialog] = useState(false);
  const [actionStatus, setActionStatus] = useState(null);

  useEffect(() => {
    loadInactiveTechs();
  }, []);

  const loadInactiveTechs = async () => {
    setIsLoading(true);
    try {
      const allUsers = await User.list();
      const inactive = allUsers.filter(user => 
        user.active === false && 
        user.email && (
          user.email.toLowerCase().includes('.contractor@m2fleetcom.com') ||
          user.email.toLowerCase().includes('.contractor@smcinstallations.com')
        )
      );
      setInactiveTechs(inactive);
    } catch (error) {
      console.error('Error loading inactive techs:', error);
      setActionStatus({ type: 'error', message: 'Failed to load inactive technicians.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleReactivate = async () => {
    if (!selectedTech || !reactivationReason.trim()) {
      setActionStatus({ type: 'error', message: 'Please provide a reason for reactivation.' });
      return;
    }

    setIsReactivating(true);
    try {
      await User.update(selectedTech.id, {
        active: true,
        reactivatedDate: new Date().toISOString(),
        reactivationReason: reactivationReason.trim(),
        // Clear the inactive reason when reactivating
        inactiveReason: null,
        inactiveDate: null
      });

      setActionStatus({ 
        type: 'success', 
        message: `${selectedTech.displayName || selectedTech.full_name} has been reactivated and moved back to the active roster.` 
      });
      
      setShowReactivateDialog(false);
      setSelectedTech(null);
      setReactivationReason('');
      loadInactiveTechs();
    } catch (error) {
      console.error('Error reactivating tech:', error);
      setActionStatus({ type: 'error', message: 'Failed to reactivate technician.' });
    } finally {
      setIsReactivating(false);
    }
  };

  const handleViewInvoices = (tech) => {
    // Navigate to Invoice History with contractor filter pre-set
    window.open(createPageUrl('InvoiceHistory') + `?contractor=${encodeURIComponent(tech.email)}`, '_blank');
  };

  const filteredTechs = inactiveTechs.filter(tech => {
    const searchMatch = !searchTerm || 
      (tech.displayName || tech.full_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (tech.business || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (tech.email || '').toLowerCase().includes(searchTerm.toLowerCase());

    const reasonMatch = reasonFilter === 'all' || tech.inactiveReason === reasonFilter;

    return searchMatch && reasonMatch;
  });

  const reasons = [...new Set(inactiveTechs.map(tech => tech.inactiveReason).filter(Boolean))];

  if (isLoading) {
    return (
      <div className="p-6 flex justify-center items-center">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <UserX className="w-8 h-8 text-red-600" />
            Inactive Technicians
          </h1>
          <p className="text-gray-600 mt-1">Manage and track inactive contractor records.</p>
        </div>
        <Badge variant="secondary" className="text-lg px-3 py-1">
          {inactiveTechs.length} Inactive
        </Badge>
      </div>

      {actionStatus && (
        <Alert variant={actionStatus.type === 'error' ? 'destructive' : 'default'}>
          <AlertDescription>{actionStatus.message}</AlertDescription>
        </Alert>
      )}

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow-sm border flex flex-col lg:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
          <Input
            placeholder="Search by name, business, or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="w-full lg:w-auto lg:min-w-[200px]">
          <Select value={reasonFilter} onValueChange={setReasonFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Filter by reason" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Reasons</SelectItem>
              {reasons.map(reason => (
                <SelectItem key={reason} value={reason}>{reason}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Inactive Techs Table */}
      <Card>
        <CardHeader>
          <CardTitle>Inactive Technician Records ({filteredTechs.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredTechs.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Technician</TableHead>
                    <TableHead>Project</TableHead>
                    <TableHead>Inactive Since</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTechs.map(tech => {
                    const inactiveDate = tech.inactiveDate ? new Date(tech.inactiveDate) : null;
                    const startDate = tech.startDate ? new Date(tech.startDate) : null;
                    
                    return (
                      <TableRow key={tech.id}>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="font-medium text-gray-900">
                              {tech.displayName || tech.full_name || tech.email}
                            </div>
                            <div className="text-sm text-gray-500">{tech.business || 'No Business Name'}</div>
                            <div className="flex items-center gap-4 text-xs text-gray-400">
                              <div className="flex items-center gap-1">
                                <Phone className="w-3 h-3" />
                                {tech.phone || 'N/A'}
                              </div>
                              <div className="flex items-center gap-1">
                                <MapPin className="w-3 h-3" />
                                {tech.location || 'N/A'}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{tech.project || 'N/A'}</div>
                            <div className="text-sm text-gray-500">
                              M2 PM: {tech.m2PM || 'N/A'}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-gray-400" />
                            <div>
                              {inactiveDate ? format(inactiveDate, 'MMM d, yyyy') : 'Unknown'}
                              {startDate && inactiveDate && (
                                <div className="text-xs text-gray-500">
                                  Started: {format(startDate, 'MMM d, yyyy')}
                                </div>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="max-w-xs">
                            <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                              {tech.inactiveReason || 'No reason provided'}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell>
                          {startDate && inactiveDate ? (
                            <div className="text-sm">
                              {Math.floor((inactiveDate - startDate) / (1000 * 60 * 60 * 24))} days
                            </div>
                          ) : 'N/A'}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleViewInvoices(tech)}
                              className="text-blue-600 border-blue-200 hover:bg-blue-50"
                            >
                              <FileText className="w-4 h-4 mr-2" />
                              View Invoices
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedTech(tech);
                                setShowReactivateDialog(true);
                              }}
                              className="text-green-600 border-green-200 hover:bg-green-50"
                            >
                              <RotateCcw className="w-4 h-4 mr-2" />
                              Reactivate
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <UserCheck className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No inactive technicians found.</p>
              {searchTerm && <p className="text-sm">Try adjusting your search criteria.</p>}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Reactivation Dialog */}
      <Dialog open={showReactivateDialog} onOpenChange={setShowReactivateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reactivate Technician</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-gray-600">
              You are about to reactivate <strong>{selectedTech?.displayName || selectedTech?.full_name}</strong>. 
              They will be moved back to the active tech roster.
            </p>
            <div>
              <Label htmlFor="reactivationReason">Reason for Reactivation *</Label>
              <Textarea
                id="reactivationReason"
                placeholder="Please provide a reason for reactivating this technician..."
                value={reactivationReason}
                onChange={(e) => setReactivationReason(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setShowReactivateDialog(false);
                setSelectedTech(null);
                setReactivationReason('');
              }}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleReactivate}
              disabled={isReactivating || !reactivationReason.trim()}
              className="bg-green-600 hover:bg-green-700"
            >
              {isReactivating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Reactivating...
                </>
              ) : (
                <>
                  <UserCheck className="w-4 h-4 mr-2" />
                  Reactivate Technician
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
