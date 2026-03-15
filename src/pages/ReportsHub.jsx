
import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils/index.js';
import { Card, CardHeader, CardContent } from '@/components/ui/card.jsx';
import { 
  BarChartHorizontal,
  FileText,
  Phone,
  AlertTriangle,
  Users,
  Shield,
  CalendarCheck,
  FileSignature
} from 'lucide-react';

export default function ReportsHub() {
  const reportCategories = [
    {
      title: 'Financial Reports',
      description: 'Invoice and payment tracking reports',
      reports: [
        {
          title: 'Invoice Compliance Report',
          description: 'Track contractor invoice submission compliance by week',
          url: 'InvoiceComplianceReport',
          icon: FileText,
          color: 'bg-blue-500'
        },
        {
          title: 'Weekly Approved Invoices',
          description: 'Review all invoices approved by week',
          url: 'WeeklyApprovedInvoices',
          icon: CalendarCheck,
          color: 'bg-teal-500'
        }
      ]
    },
    {
      title: 'Quality Control Reports',
      description: 'QC inspections and communication tracking',
      reports: [
        {
          title: 'Call Logs Report',
          description: 'Track QC interactions with technicians',
          url: 'CallLogsReport',
          icon: Phone,
          color: 'bg-green-500'
        },
        {
          title: 'Negative Interactions Report',
          description: 'AI analysis of concerning patterns in technician interactions',
          url: 'NegativeInteractionsReport',
          icon: AlertTriangle,
          color: 'bg-red-500'
        }
      ]
    },
    {
      title: 'HR & Compliance Reports',
      description: 'Employee data and compliance tracking',
      reports: [
        {
          title: 'Emergency Contact Report',
          description: 'Export emergency contact information for all technicians',
          url: 'EmergencyContactReport',
          icon: Users,
          color: 'bg-purple-500'
        },
        {
          title: 'Compliance Dashboard',
          description: 'Overview of safety certifications and workers compensation status',
          url: 'ComplianceDashboard',
          icon: Shield,
          color: 'bg-orange-500'
        },
        {
          title: 'E-Signature Status Report',
          description: 'Track the status of all documents sent for signature',
          url: 'DocumentSigningDashboard',
          icon: FileSignature,
          color: 'bg-cyan-500'
        }
      ]
    }
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <BarChartHorizontal className="w-8 h-8 text-gray-800" />
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Reports Hub</h1>
          <p className="text-gray-600 mt-1">Your central place for business intelligence and operational insights.</p>
        </div>
      </div>

      <div className="space-y-8">
        {reportCategories.map((category, categoryIndex) => (
          <div key={categoryIndex} className="space-y-4">
            <h2 className="text-2xl font-semibold text-gray-800">{category.title}</h2>
            <p className="text-gray-600">{category.description}</p>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {category.reports.map((report, reportIndex) => (
                <Link key={reportIndex} to={createPageUrl(report.url)}>
                  <Card className="hover:shadow-lg hover:border-blue-300 transition-all duration-200 h-full">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className={`p-2 rounded-full ${report.color}`}>
                          <report.icon className="w-6 h-6 text-white" />
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <h3 className="text-lg font-semibold text-gray-900">{report.title}</h3>
                      <p className="text-sm text-gray-600 mt-1">{report.description}</p>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
