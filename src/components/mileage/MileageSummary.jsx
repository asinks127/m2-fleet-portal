import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { startOfWeek, endOfWeek, subWeeks, isWithinInterval } from "date-fns";

export default function MileageSummary({ serviceCalls, technicians }) {
  const thisWeekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const thisWeekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });
  const lastWeekStart = startOfWeek(subWeeks(new Date(), 1), { weekStartsOn: 1 });
  const lastWeekEnd = endOfWeek(subWeeks(new Date(), 1), { weekStartsOn: 1 });

  const thisWeekMiles = serviceCalls
    .filter(call => isWithinInterval(new Date(call.service_date), { start: thisWeekStart, end: thisWeekEnd }))
    .reduce((sum, call) => sum + (call.miles_driven || 0), 0);

  const lastWeekMiles = serviceCalls
    .filter(call => isWithinInterval(new Date(call.service_date), { start: lastWeekStart, end: lastWeekEnd }))
    .reduce((sum, call) => sum + (call.miles_driven || 0), 0);

  const percentChange = lastWeekMiles > 0 
    ? ((thisWeekMiles - lastWeekMiles) / lastWeekMiles) * 100 
    : 0;

  const totalMiles = serviceCalls.reduce((sum, call) => sum + (call.miles_driven || 0), 0);
  const avgPerCall = serviceCalls.length > 0 ? totalMiles / serviceCalls.length : 0;

  return (
    <div className="space-y-6">
      <Card className="material-card shadow-md">
        <CardHeader>
          <CardTitle>Week-over-Week Comparison</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <p className="text-sm text-gray-500 mb-1">This Week</p>
              <p className="text-3xl font-bold text-blue-600">{thisWeekMiles.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 mb-1">Last Week</p>
              <p className="text-3xl font-bold text-gray-600">{lastWeekMiles.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 mb-1">Change</p>
              <div className="flex items-center gap-2">
                {percentChange > 0 ? (
                  <TrendingUp className="w-6 h-6 text-green-600" />
                ) : percentChange < 0 ? (
                  <TrendingDown className="w-6 h-6 text-red-600" />
                ) : (
                  <Minus className="w-6 h-6 text-gray-400" />
                )}
                <p className={`text-3xl font-bold ${
                  percentChange > 0 ? 'text-green-600' : 
                  percentChange < 0 ? 'text-red-600' : 'text-gray-600'
                }`}>
                  {Math.abs(percentChange).toFixed(1)}%
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="material-card shadow-md">
        <CardHeader>
          <CardTitle>Overall Statistics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-gray-600 mb-1">Total Miles (All Time)</p>
              <p className="text-2xl font-bold text-blue-600">{totalMiles.toLocaleString()}</p>
            </div>
            <div className="p-4 bg-green-50 rounded-lg">
              <p className="text-sm text-gray-600 mb-1">Average per Service Call</p>
              <p className="text-2xl font-bold text-green-600">{avgPerCall.toFixed(1)}</p>
            </div>
            <div className="p-4 bg-purple-50 rounded-lg">
              <p className="text-sm text-gray-600 mb-1">Total Service Calls</p>
              <p className="text-2xl font-bold text-purple-600">{serviceCalls.length}</p>
            </div>
            <div className="p-4 bg-orange-50 rounded-lg">
              <p className="text-sm text-gray-600 mb-1">Active Technicians</p>
              <p className="text-2xl font-bold text-orange-600">
                {technicians.filter(t => t.status === 'active').length}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}