
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
import { Shield, AlertTriangle, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils/index.js';
import { format, differenceInDays } from 'date-fns';

export default function ExpiringComplianceModal({ isOpen, onClose, technicians, wcRecords }) {
  const getExpiringItems = (tech) => {
    const today = new Date();
    const items = [];
    
    const wc = wcRecords.find(r => r.userEmail === tech.email);

    if (!wc) {
      items.push({ type: 'Workers Comp', status: 'missing', label: 'Missing', color: 'bg-red-100 text-red-800' });
    } else {
      const wcExpDate = wc.expirationDate ? new Date(wc.expirationDate) : null;
      if (wcExpDate) {
        const daysUntil = differenceInDays(wcExpDate, today);
        if (daysUntil < 0) {
          items.push({ 
            type: 'Workers Comp', 
            status: 'expired', 
            label: `Expired ${Math.abs(daysUntil)} days ago`, 
            date: wcExpDate,
            color: 'bg-red-100 text-red-800' 
          });
        } else if (daysUntil <= 30) {
          items.push({ 
            type: 'Workers Comp', 
            status: 'expiring', 
            label: `Expires in ${daysUntil} days`, 
            date: wcExpDate,
            color: 'bg-yellow-100 text-yellow-800' 
          });
        }
      }
    }

    return items;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold flex items-center gap-3">
            <Shield className="w-6 h-6 text-orange-600" />
            Compliance Expiring Soon ({technicians.length})
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {technicians.length > 0 ? (
            technicians.map((tech) => {
              const expiringItems = getExpiringItems(tech);
              
              if (expiringItems.length === 0) return null; // Only show technicians with expiring items

              return (
                <Card key={tech.id} className="hover:shadow-md transition-all border-l-4 border-l-orange-500">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="font-semibold text-gray-900 mb-2">
                          {tech.displayName || tech.full_name}
                        </h4>
                        
                        <div className="space-y-2">
                          {expiringItems.map((item, idx) => (
                            <div key={idx} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                              <div className="flex items-center gap-2">
                                <AlertTriangle className="w-4 h-4 text-orange-500" />
                                <span className="text-sm font-medium">{item.type}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                {item.date && (
                                  <span className="text-xs text-gray-600">
                                    {format(item.date, 'MMM d, yyyy')}
                                  </span>
                                )}
                                <Badge className={item.color}>
                                  {item.label}
                                </Badge>
                              </div>
                            </div>
                          ))}
                        </div>

                        <div className="text-sm text-gray-600 mt-2">
                          <div>Project: {tech.project || 'Not assigned'}</div>
                          <div>Email: {tech.email}</div>
                        </div>
                      </div>

                      <div className="ml-4">
                        <Link to={createPageUrl(`ContractorProfile?id=${tech.id}`)}>
                          <Button size="sm">
                            View Profile
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          ) : (
            <div className="text-center py-8 text-gray-500">
              <Shield className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>No compliance items expiring soon</p>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Link to={createPageUrl('ComplianceDashboard')}>
            <Button>
              Go to Compliance Dashboard
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </div>
      </DialogContent>
    </Dialog>
  );
}
