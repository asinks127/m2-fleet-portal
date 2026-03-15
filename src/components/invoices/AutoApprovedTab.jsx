import React from 'react';
import { Card, CardContent } from '@/components/ui/card.jsx';
import { Zap } from 'lucide-react';

export default function AutoApprovedTab() {
  return (
    <Card>
      <CardContent className="p-8 text-center">
        <Zap className="w-16 h-16 text-blue-500 mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-gray-900 mb-2">Auto-Approved Invoices</h3>
        <p className="text-gray-600">
          This tab will show all invoices that were automatically approved by the AI system.
        </p>
        <p className="text-sm text-gray-500 mt-2">
          (Coming in next update - migrating from AutoApprovedInvoices page)
        </p>
      </CardContent>
    </Card>
  );
}