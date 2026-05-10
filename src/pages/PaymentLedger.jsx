
import React, { useState, useEffect, useMemo } from 'react';
import { exportPaymentLedger } from '@/functions.js';
import { PaymentLedger, User } from '@/api/entities.js';
import { Loader2, ShieldOff, DollarSign, Download } from 'lucide-react';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Alert, AlertDescription } from '@/components/ui/alert.jsx';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs.jsx';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table.jsx';

const authorizedUsers = [
  'austin@m2fleetcom.com',
  'orville@m2fleetcom.com',
  'lena@m2fleetcom.com',
  'adam@m2fleetcom.com' // Assuming Adam might need access based on screenshot
];

const formatCurrency = (value) => {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value || 0);
};

export default function PaymentLedgerPage() {
  const [ledgerEntries, setLedgerEntries] = useState([]);
  const [contractors, setContractors] = useState([]); // Add contractors state
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [editingPayments, setEditingPayments] = useState({});
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        const currentUser = await User.me();
        setUser(currentUser);

        if (authorizedUsers.includes(currentUser.email.toLowerCase())) {
          setIsAuthorized(true);
          const [entries, contractorData] = await Promise.all([
            PaymentLedger.list('-billedDate'),
            User.list() // Load all users to get real names
          ]);
          setLedgerEntries(entries);
          setContractors(contractorData); // Set the loaded contractor data
        } else {
          setIsAuthorized(false);
        }
      } catch (error) {
        console.error("Error loading data:", error);
        setIsAuthorized(false);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, []);

  // Function to get the real contractor name
  const getRealContractorName = (technicianEmail) => {
    // Convert email to lowercase for consistent lookup
    const lowercasedEmail = technicianEmail?.toLowerCase(); 
    const contractor = contractors.find(c => c.email?.toLowerCase() === lowercasedEmail);
    // Prioritize displayName, then full_name, then fallback to email prefix if email is present
    return contractor?.displayName || contractor?.full_name || (technicianEmail ? technicianEmail.split('@')[0].replace('.', ' ') : 'Unknown Contractor');
  };

  const handlePaymentChange = (id, value) => {
    setEditingPayments(prev => ({ ...prev, [id]: value }));
  };

  const handleSavePayment = async (id) => {
    const amount = parseFloat(editingPayments[id]);
    if (isNaN(amount)) return;

    try {
      await PaymentLedger.update(id, { payment: amount, paymentDate: new Date().toISOString() });
      const updatedEntries = await PaymentLedger.list('-billedDate');
      setLedgerEntries(updatedEntries);
      const { [id]: _, ...rest } = editingPayments;
      setEditingPayments(rest);
    } catch (error) {
      console.error("Failed to save payment:", error);
      alert('Error saving payment. Please try again.');
    }
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
        const response = await exportPaymentLedger();
        
        if (response.status === 200) {
            const blob = new Blob([response.data], { type: 'text/csv' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'payment_ledger.csv';
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            a.remove();
        } else {
            console.error("Export failed:", response);
            alert('Failed to export ledger. Please try again.');
        }
    } catch (error) {
        console.error("Error during export:", error);
        alert('An error occurred during export.');
    } finally {
        setIsExporting(false);
    }
  };

  const groupedByTechnicianAndYear = useMemo(() => {
    const groups = ledgerEntries.reduce((acc, entry) => {
      // Use the real contractor name instead of stored technicianName
      // Assumes PaymentLedger entries have a 'technicianEmail' field
      const techName = getRealContractorName(entry.technicianEmail);
      
      // Skip entries that don't have a date, which is necessary for year grouping
      if (!entry.billedDate) return acc;

      const year = new Date(entry.billedDate).getFullYear().toString();

      if (!acc[techName]) {
        acc[techName] = {};
      }
      if (!acc[techName][year]) {
        acc[techName][year] = [];
      }
      acc[techName][year].push(entry);
      return acc;
    }, {});
    
    // Sort invoices within each year for each technician by invoice number
    for (const tech in groups) {
      for (const year in groups[tech]) {
        groups[tech][year].sort((a, b) => a.invoiceNumber - b.invoiceNumber);
      }
    }
    return groups;
  }, [ledgerEntries, contractors]); // Add contractors to dependencies


  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <ShieldOff className="h-4 w-4" />
          <AlertDescription>
            You do not have permission to view this page. Access is restricted.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const sortedTechNames = Object.keys(groupedByTechnicianAndYear).sort();

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
        <h1 className="text-3xl font-bold text-gray-900">Payment Ledger</h1>
        <Button onClick={handleExport} disabled={isExporting} variant="outline">
          {isExporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
          {isExporting ? 'Exporting...' : 'Export to CSV'}
        </Button>
      </div>
      
      <Tabs defaultValue={sortedTechNames.length > 0 ? sortedTechNames[0] : undefined} className="w-full">
        <TabsList className="bg-gray-200 p-1 rounded-lg h-auto flex-wrap">
          {sortedTechNames.map(techName => (
            <TabsTrigger key={techName} value={techName} className="px-4 py-1.5">{techName}</TabsTrigger>
          ))}
        </TabsList>

        {sortedTechNames.map(techName => {
          const yearGroups = groupedByTechnicianAndYear[techName];
          const sortedYears = Object.keys(yearGroups).sort((a, b) => b - a); // Sort years descending

          return (
            <TabsContent key={techName} value={techName} className="mt-4">
              <Tabs defaultValue={sortedYears.length > 0 ? sortedYears[0] : undefined} className="w-full">
                <TabsList>
                  {sortedYears.map(year => (
                    <TabsTrigger key={year} value={year}>{year} Ledger</TabsTrigger>
                  ))}
                </TabsList>
                
                {sortedYears.map(year => {
                  const entries = yearGroups[year];
                  const totalBilled = entries.reduce((sum, entry) => sum + entry.amount, 0);
                  const totalPaid = entries.reduce((sum, entry) => sum + entry.payment, 0);
                  const totalOutstanding = totalBilled - totalPaid;

                  return (
                    <TabsContent key={year} value={year} className="mt-4">
                      <div className="bg-white rounded-lg shadow-md border overflow-hidden">
                        <Table>
                          <TableHeader className="bg-gray-100">
                            <TableRow>
                              <TableHead className="w-[150px]">Contractor</TableHead>
                              <TableHead>Job</TableHead>
                              <TableHead>Invoice #</TableHead>
                              <TableHead>Billed Date</TableHead>
                              <TableHead className="text-right">Amount</TableHead>
                              <TableHead className="w-[200px] text-right">Payment</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {entries.map(entry => (
                              <TableRow key={entry.id}>
                                <TableCell className="font-medium">{getRealContractorName(entry.technicianEmail)}</TableCell>
                                <TableCell>{entry.job}</TableCell>
                                <TableCell>{entry.invoiceNumber}</TableCell>
                                <TableCell>{entry.billedDate ? new Date(entry.billedDate).toLocaleDateString() : 'N/A'}</TableCell>
                                <TableCell className="text-right">{formatCurrency(entry.amount)}</TableCell>
                                <TableCell className="text-right flex items-center gap-2 justify-end">
                                  <DollarSign className="w-4 h-4 text-gray-400" />
                                  <Input
                                    type="number"
                                    className="w-28 text-right"
                                    placeholder="0.00"
                                    value={editingPayments[entry.id] ?? entry.payment}
                                    onChange={(e) => handlePaymentChange(entry.id, e.target.value)}
                                  />
                                   <Button 
                                     size="sm" 
                                     onClick={() => handleSavePayment(entry.id)}
                                     disabled={editingPayments[entry.id] === undefined}
                                   >
                                     Save
                                   </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                          <TableFooter className="bg-gray-100">
                            <TableRow>
                              <TableCell colSpan={4} className="font-bold text-right">Yearly Totals</TableCell>
                              <TableCell className="font-bold text-right">{formatCurrency(totalBilled)}</TableCell>
                              <TableCell className="font-bold text-right">{formatCurrency(totalPaid)}</TableCell>
                            </TableRow>
                            <TableRow>
                              <TableCell colSpan={5} className="font-bold text-right text-red-600">Yearly Outstanding</TableCell>
                              <TableCell className="font-bold text-right text-red-600">{formatCurrency(totalOutstanding)}</TableCell>
                            </TableRow>
                          </TableFooter>
                        </Table>
                      </div>
                    </TabsContent>
                  );
                })}
              </Tabs>
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}
