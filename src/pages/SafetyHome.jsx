import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert, Stethoscope, ClipboardList, BookOpen } from 'lucide-react';
import { createPageUrl } from '@/utils';

export default function SafetyHome() {
  const navigate = useNavigate();

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Safety Center</h1>
        <p className="text-gray-600 mt-2">
          Use this area to report hazards, injuries, accidents, and review important safety lessons learned from past incidents.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="hover-lift cursor-pointer" onClick={() => navigate(createPageUrl('HazardReportForm'))}>
          <CardContent className="p-6 flex flex-col items-center text-center space-y-4">
            <div className="p-4 bg-orange-100 rounded-full text-orange-600">
              <ShieldAlert className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">Report a Hazard</h2>
              <p className="text-sm text-gray-500 mt-1">Identify and report a potential safety risk on site before an incident occurs.</p>
            </div>
            <Button className="w-full mt-4 bg-orange-600 hover:bg-orange-700">Submit Hazard Report</Button>
          </CardContent>
        </Card>

        <Card className="hover-lift cursor-pointer" onClick={() => navigate(createPageUrl('InjuryReportForm'))}>
          <CardContent className="p-6 flex flex-col items-center text-center space-y-4">
            <div className="p-4 bg-red-100 rounded-full text-red-600">
              <Stethoscope className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">Report an Injury / Accident</h2>
              <p className="text-sm text-gray-500 mt-1">Submit a report for an injury, near miss, vehicle accident, or property damage.</p>
            </div>
            <Button className="w-full mt-4 bg-red-600 hover:bg-red-700">Submit Injury/Accident Report</Button>
          </CardContent>
        </Card>

        <Card className="hover-lift cursor-pointer" onClick={() => navigate(createPageUrl('SafetyBulletins'))}>
          <CardContent className="p-6 flex flex-col items-center text-center space-y-4">
            <div className="p-4 bg-blue-100 rounded-full text-blue-600">
              <BookOpen className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">Safety Bulletins</h2>
              <p className="text-sm text-gray-500 mt-1">Review and acknowledge important safety bulletins and alerts.</p>
            </div>
            <Button variant="outline" className="w-full mt-4">View Safety Bulletins</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}