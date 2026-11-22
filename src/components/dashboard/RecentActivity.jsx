import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, MapPin } from "lucide-react";
import { format } from "date-fns";

const statusColors = {
  scheduled: "bg-blue-100 text-blue-800 border-blue-200",
  in_progress: "bg-orange-100 text-orange-800 border-orange-200",
  completed: "bg-green-100 text-green-800 border-green-200",
  cancelled: "bg-gray-100 text-gray-800 border-gray-200"
};

export default function RecentActivity({ serviceCalls }) {
  return (
    <Card className="material-card shadow-md">
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-blue-600" />
          Recent Activity
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y">
          {serviceCalls.map((call) => (
            <div key={call.id} className="p-4 hover:bg-gray-50 transition-colors duration-200">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="font-medium text-gray-900">{call.customer_name}</p>
                  <div className="flex items-center gap-2 text-sm text-gray-500 mt-1">
                    <MapPin className="w-3 h-3" />
                    <span>{call.service_address}</span>
                  </div>
                </div>
                <Badge variant="secondary" className={statusColors[call.status]}>
                  {call.status.replace('_', ' ')}
                </Badge>
              </div>
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>{call.technician_name}</span>
                <span>{format(new Date(call.service_date), 'MMM d, yyyy')}</span>
              </div>
              {call.miles_driven > 0 && (
                <div className="mt-2 text-sm font-medium text-blue-600">
                  {call.miles_driven} miles
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}