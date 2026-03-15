import React from 'react';
import { Card, CardContent } from '@/components/ui/card.jsx';
import { History } from 'lucide-react';

export default function HistoryTab() {
  return (
    <Card>
      <CardContent className="p-8 text-center">
        <History className="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-gray-900 mb-2">Invoice History</h3>
        <p className="text-gray-600">
          This tab will show all invoice history with advanced filters.
        </p>
        <p className="text-sm text-gray-500 mt-2">
          (Full history view coming in next update - we're migrating from the old InvoiceHistory page)
        </p>
      </CardContent>
    </Card>
  );
}