import React from 'react';
import { Card, CardContent } from '@/components/ui/card.jsx';
import { Shield } from 'lucide-react';

export default function ComplianceTab() {
  return (
    <Card>
      <CardContent className="p-8 text-center">
        <Shield className="w-16 h-16 text-purple-500 mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-gray-900 mb-2">Invoice Compliance Report</h3>
        <p className="text-gray-600">
          This tab will show which contractors submitted/missed invoices each week.
        </p>
        <p className="text-sm text-gray-500 mt-2">
          (Coming in next update - migrating from InvoiceComplianceReport page)
        </p>
      </CardContent>
    </Card>
  );
}