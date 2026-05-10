
import React, { useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Card, CardContent } from '@/components/ui/card.jsx';
import {
  Users,
  CheckCircle,
  Star,
  Phone,
  Mail,
  Calendar,
  DollarSign,
  UserCheck,
  ArrowRight
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils/index.js';
import { format, isBefore, differenceInDays } from 'date-fns';

export default function ProjectTeamModal({ 
  isOpen, 
  onClose, 
  projectName, 
  technicians, 
  wcRecords, 
  certRecords // Keep this prop for backwards compatibility but don't use it
}) {
  const projectStats = useMemo(() => {
    if (!technicians || technicians.length === 0) {
      return {
        total: 0,
        avgVelocitiScore: 0,
        avgQCScore: 0,
        compliant: 0,
        atRisk: 0,
        shadowing: 0,
        active: 0
      };
    }

    const today = new Date();
    let compliantCount = 0;
    let atRiskCount = 0;
    let shadowingCount = 0;
    let activeCount = 0;
    let totalVelocitiScore = 0;
    let totalQCScore = 0;

    technicians.forEach(tech => {
      // Compliance check
      const wc = wcRecords.find(r => r.userEmail === tech.email);
      
      const hasCompliance = !!wc; // Only check WC for compliance
      const wcExpired = wc?.expirationDate && isBefore(new Date(wc.expirationDate), today);
      
      if (hasCompliance && !wcExpired) {
        compliantCount++;
      }

      // At risk check
      const lowPerformance = (tech.velocitiScore || 0) < 80 || (tech.avgQcScore || 0) < 80;
      const complianceIssue = !hasCompliance || wcExpired; // Only check WC expiration for compliance issue
      if (lowPerformance || complianceIssue) {
        atRiskCount++;
      }

      // Shadowing status
      if (tech.shadowingStatus === 'in_progress') {
        shadowingCount++;
      }

      // Active status
      if (tech.shadowingStatus === 'completed') {
        activeCount++;
      }

      // Scores
      totalVelocitiScore += (tech.velocitiScore || 0);
      totalQCScore += (tech.avgQcScore || 0);
    });

    return {
      total: technicians.length,
      avgVelocitiScore: Math.round(totalVelocitiScore / technicians.length),
      avgQCScore: Math.round(totalQCScore / technicians.length),
      compliant: compliantCount,
      atRisk: atRiskCount,
      shadowing: shadowingCount,
      active: activeCount
    };
  }, [technicians, wcRecords, certRecords]);

  const getComplianceStatus = (tech) => {
    const today = new Date();
    const wc = wcRecords.find(r => r.userEmail === tech.email);

    // Only check Workers Comp now
    if (!wc) {
      return { status: 'critical', label: 'Missing WC', color: 'bg-red-100 text-red-800' };
    }

    const wcExpDate = wc.expirationDate ? new Date(wc.expirationDate) : null;

    if (wcExpDate && isBefore(wcExpDate, today)) {
      return { status: 'expired', label: 'WC Expired', color: 'bg-red-100 text-red-800' };
    }

    if (wcExpDate && differenceInDays(wcExpDate, today) <= 30) {
      return { status: 'warning', label: 'WC Expiring Soon', color: 'bg-yellow-100 text-yellow-800' };
    }

    return { status: 'good', label: 'Compliant', color: 'bg-green-100 text-green-800' };
  };

  const getPerformanceColor = (score) => {
    if (score >= 90) return 'bg-green-100 text-green-800';
    if (score >= 80) return 'bg-blue-100 text-blue-800';
    if (score >= 70) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold flex items-center gap-3">
            <Users className="w-6 h-6 text-blue-600" />
            {projectName}
          </DialogTitle>
        </DialogHeader>

        {/* Project Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="text-center">
                <div className="text-3xl font-bold text-gray-900">{projectStats.total}</div>
                <div className="text-sm text-gray-600 mt-1">Total Team</div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="text-center">
                <div className="text-3xl font-bold text-green-600">{projectStats.active}</div>
                <div className="text-sm text-gray-600 mt-1">Active</div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="text-center">
                <div className="text-3xl font-bold text-blue-600">{projectStats.avgVelocitiScore}</div>
                <div className="text-sm text-gray-600 mt-1">Avg Velo Score</div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="text-center">
                <div className="text-3xl font-bold text-red-600">{projectStats.atRisk}</div>
                <div className="text-sm text-gray-600 mt-1">At Risk</div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Technicians List */}
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">Team Members</h3>
          
          {technicians && technicians.length > 0 ? (
            technicians.map((tech) => {
              const compliance = getComplianceStatus(tech);
              
              return (
                <Card key={tech.id} className="hover:shadow-md transition-all">
                  <CardContent className="p-4">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      {/* Left Section - Basic Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <h4 className="font-semibold text-gray-900 text-lg">
                              {tech.displayName || tech.full_name}
                            </h4>
                            <p className="text-sm text-gray-600">{tech.business || 'No Business'}</p>
                          </div>
                          
                          {/* Status Badges */}
                          <div className="flex flex-wrap gap-2">
                            {tech.shadowingStatus === 'in_progress' && (
                              <Badge className="bg-blue-100 text-blue-800">
                                <UserCheck className="w-3 h-3 mr-1" />
                                Shadowing
                              </Badge>
                            )}
                            {tech.shadowingStatus === 'completed' && (
                              <Badge className="bg-green-100 text-green-800">
                                <CheckCircle className="w-3 h-3 mr-1" />
                                Active
                              </Badge>
                            )}
                            <Badge className={compliance.color}>
                              {compliance.label}
                            </Badge>
                          </div>
                        </div>

                        {/* Contact Info */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-gray-600 mb-3">
                          <div className="flex items-center gap-2">
                            <Mail className="w-4 h-4" />
                            <span className="truncate">{tech.email}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Phone className="w-4 h-4" />
                            <span>{tech.phone || 'N/A'}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4" />
                            <span>
                              {tech.startDate ? `Started ${format(new Date(tech.startDate), 'MMM d, yyyy')}` : 'Start date N/A'}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <DollarSign className="w-4 h-4" />
                            <span>{tech.weeklyPay ? `$${tech.weeklyPay}/week` : 'Pay N/A'}</span>
                          </div>
                        </div>

                        {/* Performance Metrics */}
                        <div className="flex flex-wrap gap-3">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500">Velociti:</span>
                            <Badge className={getPerformanceColor(tech.velocitiScore || 0)}>
                              {tech.velocitiScore || 0}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500">QC Avg:</span>
                            <Badge className={getPerformanceColor(tech.avgQcScore || 0)}>
                              {tech.avgQcScore || 0}
                            </Badge>
                          </div>
                          {tech.veloSurveyFeedback && (
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-gray-500">Velo Survey:</span>
                              <div className="flex items-center gap-1">
                                <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                                <span className="text-sm font-medium">{tech.veloSurveyFeedback}</span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Right Section - Actions */}
                      <div className="flex flex-col gap-2 lg:w-48">
                        <Link to={createPageUrl(`ContractorProfile?id=${tech.id}`)}>
                          <Button className="w-full" size="sm">
                            View Full Profile
                            <ArrowRight className="w-4 h-4 ml-2" />
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          ) : (
            <Card>
              <CardContent className="p-8 text-center text-gray-500">
                <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No technicians assigned to this project</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Link to={createPageUrl(`TechRoster?project=${encodeURIComponent(projectName)}`)}>
            <Button>
              View in Tech Roster
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </div>
      </DialogContent>
    </Dialog>
  );
}
