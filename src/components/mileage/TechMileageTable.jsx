import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export default function TechMileageTable({ serviceCalls, technicians }) {
  const techMileage = technicians.map(tech => {
    const techCalls = serviceCalls.filter(call => call.technician_id === tech.id);
    const totalMiles = techCalls.reduce((sum, call) => sum + (call.miles_driven || 0), 0);
    const avgMiles = techCalls.length > 0 ? totalMiles / techCalls.length : 0;
    
    return {
      ...tech,
      totalMiles,
      callCount: techCalls.length,
      avgMiles
    };
  }).sort((a, b) => b.totalMiles - a.totalMiles);

  return (
    <Card className="material-card shadow-md">
      <CardHeader>
        <CardTitle>Mileage by Technician</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Technician</TableHead>
              <TableHead className="text-right">Service Calls</TableHead>
              <TableHead className="text-right">Total Miles</TableHead>
              <TableHead className="text-right">Avg per Call</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {techMileage.map((tech) => (
              <TableRow key={tech.id}>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-blue-600 flex items-center justify-center text-white font-bold text-sm">
                      {tech.full_name.charAt(0)}
                    </div>
                    {tech.full_name}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <Badge variant="outline">{tech.callCount}</Badge>
                </TableCell>
                <TableCell className="text-right font-bold text-blue-600">
                  {tech.totalMiles.toLocaleString()}
                </TableCell>
                <TableCell className="text-right text-gray-600">
                  {tech.avgMiles.toFixed(1)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}