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
import { UserCheck, Calendar, Clock, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils/index.js';
import { format, differenceInDays } from 'date-fns';

export default function ShadowingModal({ isOpen, onClose, technicians }) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold flex items-center gap-3">
            <UserCheck className="w-6 h-6 text-blue-600" />
            Shadowing In Progress ({technicians.length})
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {technicians.length > 0 ? (
            technicians.map((tech) => {
              const daysInShadowing = tech.shadowingStartDate 
                ? differenceInDays(new Date(), new Date(tech.shadowingStartDate))
                : 0;
              const daysRemaining = 14 - daysInShadowing;
              
              return (
                <Card key={tech.id} className="hover:shadow-md transition-all">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h4 className="font-semibold text-gray-900">
                            {tech.displayName || tech.full_name}
                          </h4>
                          {daysRemaining <= 0 ? (
                            <Badge className="bg-red-100 text-red-800">Overdue</Badge>
                          ) : daysRemaining <= 3 ? (
                            <Badge className="bg-yellow-100 text-yellow-800">
                              <Clock className="w-3 h-3 mr-1" />
                              {daysRemaining} days left
                            </Badge>
                          ) : (
                            <Badge className="bg-blue-100 text-blue-800">
                              {daysRemaining} days remaining
                            </Badge>
                          )}
                        </div>
                        
                        <div className="text-sm text-gray-600 space-y-1">
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4" />
                            <span>
                              Started: {tech.shadowingStartDate ? format(new Date(tech.shadowingStartDate), 'MMM d, yyyy') : 'N/A'}
                            </span>
                          </div>
                          <div>Project: {tech.project || 'Not assigned'}</div>
                          <div>PM: {tech.m2PM || 'Not assigned'}</div>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <Link to={createPageUrl(`ContractorProfile?id=${tech.id}`)}>
                          <Button size="sm" variant="outline">
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
              <UserCheck className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>No technicians currently in shadowing</p>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Link to={createPageUrl('ShadowingDashboard')}>
            <Button>
              Go to Shadowing Dashboard
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </div>
      </DialogContent>
    </Dialog>
  );
}