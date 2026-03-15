import React from 'react';
import { Card, CardContent } from '@/components/ui/card.jsx';
import { CheckCircle } from 'lucide-react';

export default function WeeklyApprovedTab() {
  return (
    <Card>
      <CardContent className="p-8 text-center">
        <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-gray-900 mb-2">Weekly Approved Invoices</h3>
        <p className="text-gray-600">
          This tab will show invoices approved in the current week with export options.
        </p>
        <p className="text-sm text-gray-500 mt-2">
          (Coming in next update - migrating from WeeklyApprovedInvoices page)
        </p>
      </CardContent>
    </Card>
  );
}