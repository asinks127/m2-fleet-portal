import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import ChecklistItem from './ChecklistItem';

export default function ChecklistSection({ sectionName, items, responses, onResponse, onCreateCA, disabled }) {
  const completedCount = useMemo(() => 
    items.filter(item => responses[item.id]?.responseValue).length,
    [items, responses]
  );

  const failedItems = useMemo(() =>
    items.filter(item => {
      const val = responses[item.id]?.responseValue?.toLowerCase();
      return val === 'fail' || val === 'no';
    }),
    [items, responses]
  );

  const pct = items.length > 0 ? Math.round((completedCount / items.length) * 100) : 0;

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-3 bg-gradient-to-r from-gray-50 to-white border-b">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold text-gray-800">{sectionName}</CardTitle>
          <div className="flex items-center gap-3">
            {failedItems.length > 0 && (
              <span className="text-xs text-red-600 font-medium bg-red-50 px-2 py-0.5 rounded-full border border-red-100">
                {failedItems.length} failed
              </span>
            )}
            <span className="text-xs text-gray-500">
              {completedCount}/{items.length} completed
            </span>
            <div className="w-24 bg-gray-200 rounded-full h-1.5">
              <div
                className={`h-1.5 rounded-full transition-all duration-300 ${pct === 100 ? 'bg-green-500' : 'bg-blue-500'}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="divide-y p-0">
        {items.map((item, idx) => (
          <ChecklistItem
            key={item.id}
            item={item}
            response={responses[item.id] || {}}
            onResponse={(field, value) => onResponse(item.id, field, value)}
            onCreateCA={() => onCreateCA(item.id)}
            disabled={disabled}
            index={idx + 1}
          />
        ))}
      </CardContent>
    </Card>
  );
}