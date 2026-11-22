import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp } from "lucide-react";

export default function TopPerformers({ serviceCalls, technicians }) {
  const techPerformance = technicians.map(tech => {
    const techCalls = serviceCalls.filter(call => call.technician_id === tech.id);
    const totalMiles = techCalls.reduce((sum, call) => sum + (call.miles_driven || 0), 0);
    return {
      ...tech,
      callCount: techCalls.length,
      totalMiles
    };
  }).sort((a, b) => b.callCount - a.callCount).slice(0, 5);

  return (
    <Card className="material-card shadow-md">
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-green-600" />
          Top Performers
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4">
        <div className="space-y-4">
          {techPerformance.map((tech, index) => (
            <div key={tech.id} className="flex items-center gap-4">
              <div className="flex-shrink-0">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white ${
                  index === 0 ? 'bg-gradient-to-r from-yellow-400 to-yellow-500' :
                  index === 1 ? 'bg-gradient-to-r from-gray-300 to-gray-400' :
                  index === 2 ? 'bg-gradient-to-r from-orange-400 to-orange-500' :
                  'bg-gradient-to-r from-blue-500 to-blue-600'
                }`}>
                  {index + 1}
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 truncate">{tech.full_name}</p>
                <div className="flex items-center gap-3 text-sm text-gray-500">
                  <span>{tech.callCount} calls</span>
                  <span>•</span>
                  <span>{tech.totalMiles} miles</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}