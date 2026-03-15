import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Card, CardContent } from '@/components/ui/card.jsx';
import { AlertTriangle, Shield, TrendingDown, FileX, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils/index.js';

export default function CriticalAlertsModal({ isOpen, onClose, alerts }) {
  const getAlertIcon = (type) => {
    switch (type) {
      case 'compliance': return <Shield className="w-5 h-5 text-red-600" />;
      case 'performance': return <TrendingDown className="w-5 h-5 text-orange-600" />;
      case 'task': return <FileX className="w-5 h-5 text-yellow-600" />;
      default: return <AlertTriangle className="w-5 h-5 text-red-600" />;
    }
  };

  const getAlertColor = (severity) => {
    switch (severity) {
      case 'critical': return 'border-l-red-500 bg-red-50';
      case 'high': return 'border-l-orange-500 bg-orange-50';
      case 'medium': return 'border-l-yellow-500 bg-yellow-50';
      default: return 'border-l-gray-500 bg-gray-50';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold flex items-center gap-3">
            <AlertTriangle className="w-6 h-6 text-red-600" />
            Critical Alerts ({alerts.length})
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {alerts.length > 0 ? (
            alerts.map((alert, idx) => (
              <Card key={idx} className={`hover:shadow-md transition-all border-l-4 ${getAlertColor(alert.severity)}`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1">
                      <div className="mt-1">
                        {getAlertIcon(alert.type)}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className="font-semibold text-gray-900">
                            {alert.technicianName}
                          </h4>
                          <Badge className="bg-red-100 text-red-800">
                            {alert.severity.toUpperCase()}
                          </Badge>
                        </div>
                        
                        <p className="text-sm text-gray-700 mb-2">{alert.message}</p>
                        
                        {alert.action && (
                          <div className="text-sm text-gray-600 bg-white p-2 rounded border border-gray-200">
                            <strong>Action Required:</strong> {alert.action}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="ml-4">
                      <Link to={createPageUrl(`ContractorProfile?id=${alert.technicianId}`)}>
                        <Button size="sm">
                          View Profile
                        </Button>
                      </Link>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <div className="text-center py-8 text-gray-500">
              <AlertTriangle className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>No critical alerts at this time</p>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Link to={createPageUrl('AtRiskDashboard')}>
            <Button>
              Go to At-Risk Dashboard
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </div>
      </DialogContent>
    </Dialog>
  );
}