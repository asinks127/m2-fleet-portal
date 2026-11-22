import React, { useState } from "react";
import { base44 } from "@/api/warrantyClient";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { TrendingUp, Calendar, User } from "lucide-react";
import { format, startOfWeek, endOfWeek, isWithinInterval } from "date-fns";

import WeeklyMileageChart from "../components/mileage/WeeklyMileageChart";
import TechMileageTable from "../components/mileage/TechMileageTable";
import MileageSummary from "../components/mileage/MileageSummary";

export default function MileageReports() {
  const [activeTab, setActiveTab] = useState("weekly");

  const { data: serviceCalls = [], isLoading } = useQuery({
    queryKey: ['serviceCalls'],
    queryFn: () => base44.entities.ServiceCall.list('-service_date'),
  });

  const { data: technicians = [] } = useQuery({
    queryKey: ['technicians'],
    queryFn: () => base44.entities.Technician.list(),
  });

  const totalMileage = serviceCalls.reduce((sum, call) => 
    sum + (call.miles_driven || 0), 0
  );

  const thisWeekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const thisWeekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });

  const weeklyMileage = serviceCalls
    .filter(call => {
      const callDate = new Date(call.service_date);
      return isWithinInterval(callDate, { start: thisWeekStart, end: thisWeekEnd });
    })
    .reduce((sum, call) => sum + (call.miles_driven || 0), 0);

  return (
    <div className="p-6 md:p-8 space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Mileage Reports</h1>
          <p className="text-gray-500 mt-1">Track distance driven by your team</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="material-card shadow-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              This Week
            </CardTitle>
            <Calendar className="h-5 w-5 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-900">
              {weeklyMileage.toLocaleString()}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {format(thisWeekStart, 'MMM d')} - {format(thisWeekEnd, 'MMM d')}
            </p>
          </CardContent>
        </Card>

        <Card className="material-card shadow-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              All Time Total
            </CardTitle>
            <TrendingUp className="h-5 w-5 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-900">
              {totalMileage.toLocaleString()}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Total miles driven
            </p>
          </CardContent>
        </Card>

        <Card className="material-card shadow-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Average per Call
            </CardTitle>
            <User className="h-5 w-5 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-900">
              {serviceCalls.length > 0 
                ? (totalMileage / serviceCalls.length).toFixed(1)
                : '0'}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Miles per service call
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-white shadow-sm">
          <TabsTrigger value="weekly">Weekly View</TabsTrigger>
          <TabsTrigger value="technician">By Technician</TabsTrigger>
          <TabsTrigger value="summary">Summary</TabsTrigger>
        </TabsList>

        <TabsContent value="weekly" className="mt-6">
          <WeeklyMileageChart serviceCalls={serviceCalls} />
        </TabsContent>

        <TabsContent value="technician" className="mt-6">
          <TechMileageTable 
            serviceCalls={serviceCalls} 
            technicians={technicians}
          />
        </TabsContent>

        <TabsContent value="summary" className="mt-6">
          <MileageSummary 
            serviceCalls={serviceCalls}
            technicians={technicians}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}