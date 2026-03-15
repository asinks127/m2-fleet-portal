import React, { useState } from 'react';
import { Invoice } from '@/api/entities.js';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Label } from '@/components/ui/label.jsx';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select.jsx';
import { Alert, AlertDescription } from '@/components/ui/alert.jsx';
import { AlertCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function MoveInvoiceDialog({ invoice, isOpen, onClose, onUpdate, contractors, currentPath = [] }) {
  const [targetContractorId, setTargetContractorId] = useState('');
  const [targetYear, setTargetYear] = useState('');
  const [moveType, setMoveType] = useState('contractor'); // 'contractor' or 'year'
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);

  // Detect if we're in a year subfolder
  const isInYearFolder = currentPath && currentPath.length >= 2;
  const currentContractorName = currentPath && currentPath.length > 0 ? currentPath[0] : invoice.contractorName;
  const currentYear = isInYearFolder ? currentPath[1] : null;

  const handleMove = async () => {
    setError(null);
    setIsProcessing(true);
    try {
      if (moveType === 'contractor') {
        if (!targetContractorId) {
          setError("Please select a target contractor.");
          return;
        }

        const selectedContractor = contractors.find(c => c.id === targetContractorId);
        if (!selectedContractor) {
          throw new Error("Selected contractor not found.");
        }

        await Invoice.update(invoice.id, {
          contractorEmail: selectedContractor.email,
          contractorName: selectedContractor.name,
          businessName: selectedContractor.businessName || selectedContractor.name,
        });
      } else if (moveType === 'year') {
        if (!targetYear) {
          setError("Please select a target year.");
          setIsProcessing(false);
          return;
        }

        // Update the invoice date to match the target year (January 1st of that year)
        const newInvoiceDate = `${targetYear}-01-01T00:00:00.000Z`;
        console.log('Moving invoice to year:', targetYear, 'Date:', newInvoiceDate);
        await Invoice.update(invoice.id, {
          invoiceDate: newInvoiceDate
        });
        console.log('Invoice updated successfully');
      }

      toast.success(`Moved ${invoice.fileName} successfully`);
      onUpdate();
      onClose();
    } catch (err) {
      console.error('Failed to move invoice:', err);
      setError('Failed to move invoice. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };
  
  const filteredContractors = contractors.filter(c => c.name !== currentContractorName);
  const currentYearNum = new Date().getFullYear();
  const availableYears = [
    (currentYearNum - 1).toString(),
    currentYearNum.toString(),
    (currentYearNum + 1).toString(),
    (currentYearNum + 2).toString()
  ].filter(year => year !== currentYear);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Move Invoice</DialogTitle>
          <DialogDescription>
            Move "{invoice.fileName}" to a different location.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-4">
          {isInYearFolder && (
            <div>
              <Label>Move To</Label>
              <Select onValueChange={setMoveType} value={moveType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="year">Different Year Folder (same contractor)</SelectItem>
                  <SelectItem value="contractor">Different Contractor</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {moveType === 'year' && isInYearFolder && (
            <div>
              <Label htmlFor="year-select">Target Year</Label>
              <Select onValueChange={setTargetYear} value={targetYear}>
                <SelectTrigger id="year-select">
                  <SelectValue placeholder="Select a year..." />
                </SelectTrigger>
                <SelectContent>
                  {availableYears.map(year => (
                    <SelectItem key={year} value={year}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {moveType === 'contractor' && (
            <div>
              <Label htmlFor="contractor-select">New Contractor</Label>
              <Select onValueChange={setTargetContractorId} value={targetContractorId}>
                <SelectTrigger id="contractor-select">
                  <SelectValue placeholder="Select a contractor..." />
                </SelectTrigger>
                <SelectContent>
                  {filteredContractors.map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isProcessing}>
            Cancel
          </Button>
          <Button 
            onClick={handleMove} 
            disabled={(moveType === 'contractor' && !targetContractorId) || (moveType === 'year' && !targetYear) || isProcessing}
          >
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Moving...
              </>
            ) : (
              'Move Invoice'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}