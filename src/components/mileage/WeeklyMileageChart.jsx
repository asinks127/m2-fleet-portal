import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { startOfWeek, endOfWeek, eachDayOfInterval, format, isWithinInterval } from "date-fns";

export default function WeeklyMileageChart({ serviceCalls }) {
  const thisWeekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const thisWeekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });
  
  const daysOfWeek = eachDayOfInterval({ start: thisWeekStart, end: thisWeekEnd });
  
  const chartData = daysOfWeek.map(day => {
    const dayMileage = serviceCalls
      .filter(call => {
        const callDate = new Date(call.service_date);
        return format(callDate, 'yyyy-MM-dd') === format(day, 'yyyy-MM-dd');
      })
      .reduce((sum, call) => sum + (call.miles_driven || 0), 0);
    
    return {
      day: format(day, 'EEE'),
      miles: dayMileage
    };
  });

  return (
    <Card className="material-card shadow-md">
      <CardHeader>
        <CardTitle>Weekly Mileage Breakdown</CardTitle>
        <p className="text-sm text-gray-500">
          {format(thisWeekStart, 'MMM d')} - {format(thisWeekEnd, 'MMM d, yyyy')}
        </p>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="day" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="miles" fill="#2563eb" radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}