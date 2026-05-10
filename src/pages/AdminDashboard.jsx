import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabaseClient.js';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Link, useLocation } from 'react-router-dom';
import { createPageUrl } from '@/utils/index.js';
import {
  FileText, Users, Clock, CheckCircle, TrendingUp, AlertTriangle,
  Calendar, Shield, ArrowRight, Activity, Zap, Home, UserCheck,
  Target, Award, Briefcase, Bell
} from 'lucide-react';
import { startOfWeek, endOfWeek, format, addDays, differenceInDays, isBefore } from 'date-fns';
import AnnouncementBanner from '../components/AnnouncementBanner';
import { MobileBottomNav } from '../components/MobileOptimized';
import ClockInOut from '../components/ClockInOut';
import { LiveDashboard, MetricCard, LiveLineChart, LiveBarChart, LivePieChart } from '../components/LiveDashboard';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from 'recharts';
import ProjectTeamModal from '../components/dashboard/ProjectTeamModal';
import ShadowingModal from '../components/dashboard/ShadowingModal';
import ExpiringComplianceModal from '../components/dashboard/ExpiringComplianceModal';
import PendingTasksModal from '../components/dashboard/PendingTasksModal';
import CriticalAlertsModal from '../components/dashboard/CriticalAlertsModal';

export default function AdminDashboard() {
  const location = useLocation();
  const safeDate = (value) => {
    if (!value) return null;
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  };

  const safeFormatDateTime = (value) => {
    const d = safeDate(value);
    return d ? format(d, 'MMM d, yyyy h:mm a') : 'Unknown';
  };

  const [teamMetrics, setTeamMetrics] = useState({
    teamHealthScore: 0,
    atRiskCount: 0,
    complianceExpiringSoon: 0,
    avgQCScore: 0,
    shadowingInProgress: 0,
    activeContractors: 0,
    pendingTasks: 0,
    criticalAlerts: 0
  });

  const [performanceDistribution, setPerformanceDistribution] = useState([]);
  const [complianceTimeline, setComplianceTimeline] = useState([]);
  const [projectDistribution, setProjectDistribution] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);

  // NEW: Modal states
  const [selectedProject, setSelectedProject] = useState(null);
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [showShadowingModal, setShowShadowingModal] = useState(false);
  const [showExpiringModal, setShowExpiringModal] = useState(false);
  const [showTasksModal, setShowTasksModal] = useState(false);
  const [showAlertsModal, setShowAlertsModal] = useState(false);

  const { data: contractors = [] } = useQuery({
    queryKey: ['contractors'],
    queryFn: async () => {
      const { data } = await supabase.from('User').select('*');
      return data || [];
    },
    initialData: [],
    refetchInterval: 30000,
  });

  const { data: newUsers = [] } = useQuery({
    queryKey: ['newUsers'],
    queryFn: async () => {
      const { data } = await supabase.from('User').select('*');
      return data || [];
    },
    initialData: [],
    refetchInterval: 30000,
  });

  const { data: wcRecords = [] } = useQuery({
    queryKey: ['wcRecords'],
    queryFn: async () => {
      const { data } = await supabase.from('WorkersCompRecord').select('*');
      return data || [];
    },
    initialData: [],
    refetchInterval: 30000,
  });

  const { data: certRecords = [] } = useQuery({
    queryKey: ['certRecords'],
    queryFn: async () => {
      const { data } = await supabase.from('SafetyCertification').select('*');
      return data || [];
    },
    initialData: [],
    refetchInterval: 30000,
  });

  const { data: inspections = [] } = useQuery({
    queryKey: ['inspections'],
    queryFn: async () => {
      const { data } = await supabase.from('QCInspection').select('*');
      return data || [];
    },
    initialData: [],
    refetchInterval: 30000,
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ['tasks'],
    queryFn: async () => {
      const { data } = await supabase.from('Task').select('*');
      return data || [];
    },
    initialData: [],
    refetchInterval: 30000,
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ['invoices'],
    queryFn: async () => {
      const { data } = await supabase.from('Invoice').select('*');
      return data || [];
    },
    initialData: [],
    refetchInterval: 30000,
  });

  const safeContractors = Array.isArray(contractors) ? contractors : [];
  const safeWCRecords = Array.isArray(wcRecords) ? wcRecords : [];
  const safeCertRecords = Array.isArray(certRecords) ? certRecords : [];
  const safeInspections = Array.isArray(inspections) ? inspections : [];
  const safeTasks = Array.isArray(tasks) ? tasks : [];
  const safeInvoices = Array.isArray(invoices) ? invoices : [];

  const activeContractors = useMemo(() =>
    safeContractors.filter(c =>
      c.active !== false &&
      c.email &&
      (c.email.toLowerCase().includes('.contractor@m2fleetcom.com') ||
       c.email.toLowerCase().includes('.contractor@smcinstallations.com'))
    ), [safeContractors]
  );

  useEffect(() => {
    // FIX: Only calculate metrics if there are active contractors to prevent running on empty/stale data.
    if (activeContractors.length > 0) {
      calculateTeamMetrics();
    }
  }, [activeContractors, wcRecords, certRecords, inspections, tasks, invoices]);

  const calculateTeamMetrics = () => {
    const today = new Date();
    const thirtyDaysOut = addDays(today, 30);

    // Calculate compliance expiring soon
    const expiringSoon = activeContractors.filter(contractor => {
      const wc = safeWCRecords.find(r => r.userEmail === contractor.email);
      const cert = safeCertRecords.find(r => r.userEmail === contractor.email);

      if (!wc && !cert) return false; // Neither record exists, not expiring soon from compliance perspective

      const wcExpDate = wc?.expirationDate ? new Date(wc.expirationDate) : null;
      const certExpDate = cert?.expirationDate ? new Date(cert.expirationDate) : null;

      return (wcExpDate && wcExpDate <= thirtyDaysOut && wcExpDate >= today) ||
             (certExpDate && certExpDate <= thirtyDaysOut && certExpDate >= today);
    }).length;

    // Calculate average QC score
    const recentInspections = safeInspections.filter(i => {
      const inspDate = safeDate(i.inspection_date || i.inspectionDate);
      return inspDate ? differenceInDays(today, inspDate) <= 90 : false;
    });
    const avgQC = recentInspections.length > 0
      ? Math.round(recentInspections.reduce((sum, i) => sum + (i.score || 0), 0) / recentInspections.length)
      : 0;

    // Count shadowing in progress
    const shadowingCount = activeContractors.filter(c => c.shadowingStatus === 'in_progress').length;

    // Count at-risk contractors (low performance or compliance issues)
    const atRisk = activeContractors.filter(contractor => {
      const qcScore = contractor.avgQcScore || 0;
      const velocitiScore = contractor.velocitiScore || 100;
      const wc = safeWCRecords.find(r => r.userEmail === contractor.email);
      const cert = safeCertRecords.find(r => r.userEmail === contractor.email);

      const wcExpDate = safeDate(wc?.expirationDate);
      const certExpDate = safeDate(cert?.expirationDate);

      const hasComplianceIssue =
        (wcExpDate && isBefore(wcExpDate, today)) ||
        (certExpDate && isBefore(certExpDate, today)) ||
        (!wc || !cert); // Also consider missing docs as an issue

      return qcScore < 80 || velocitiScore < 80 || hasComplianceIssue;
    }).length;

    // Calculate team health score (0-100)
    // Avoid division by zero if no active contractors
    const complianceRate = activeContractors.length > 0 ? ((activeContractors.length - expiringSoon - atRisk) / activeContractors.length) * 100 : 0; // Adjusted to factor in at-risk contractors
    const performanceRate = avgQC; // Assuming avgQC is already 0-100 scale
    const teamHealth = Math.round((complianceRate + performanceRate) / 2);

    // Pending tasks
    const pendingTasksCount = safeTasks.filter(t => !['done','completed','closed'].includes((t.status || '').toLowerCase())).length;

    // Critical alerts
    const criticalCount = atRisk + pendingTasksCount; // Sum of at-risk contractors and pending tasks

    setTeamMetrics({
      teamHealthScore: teamHealth,
      atRiskCount: atRisk,
      complianceExpiringSoon: expiringSoon,
      avgQCScore: avgQC,
      shadowingInProgress: shadowingCount,
      activeContractors: activeContractors.length,
      pendingTasks: pendingTasksCount,
      criticalAlerts: criticalCount
    });

    // Performance distribution
    const perfDist = [
      { name: 'Excellent (90-100)', count: activeContractors.filter(c => (c.velocitiScore || 0) >= 90).length, fill: '#22c55e' },
      { name: 'Good (70-89)', count: activeContractors.filter(c => (c.velocitiScore || 0) >= 70 && (c.velocitiScore || 0) < 90).length, fill: '#3b82f6' },
      { name: 'Needs Improvement (<70)', count: activeContractors.filter(c => (c.velocitiScore || 0) < 70).length, fill: '#ef4444' },
    ];
    setPerformanceDistribution(perfDist);

    // Project distribution
    const projects = {};
    activeContractors.forEach(c => {
      const proj = c.project || 'Unassigned';
      projects[proj] = (projects[proj] || 0) + 1;
    });
    const projDist = Object.entries(projects).map(([name, value]) => ({ name, value }));
    setProjectDistribution(projDist);

    // Compliance timeline (next 90 days)
    const timeline = [];
    for (let i = 0; i < 90; i += 30) {
      const rangeStart = addDays(today, i);
      const rangeEnd = addDays(today, i + 30);
      const expiringInRange = activeContractors.filter(contractor => {
        const wc = safeWCRecords.find(r => r.userEmail === contractor.email);
        const cert = safeCertRecords.find(r => r.userEmail === contractor.email);

        const wcExpDate = wc?.expirationDate ? new Date(wc.expirationDate) : null;
        const certExpDate = cert?.expirationDate ? new Date(cert.expirationDate) : null;

        return (wcExpDate && wcExpDate >= rangeStart && wcExpDate <= rangeEnd) ||
               (certExpDate && certExpDate >= rangeStart && certExpDate <= rangeEnd);
      }).length;

      timeline.push({
        period: i === 0 ? 'Next 30 days' : i === 30 ? '30-60 days' : '60-90 days',
        expiring: expiringInRange
      });
    }
    setComplianceTimeline(timeline);

    // Recent activity
    const recent = [];

    // Recent inspections
    recentInspections.slice(0, 3).forEach(insp => {
      const tech = activeContractors.find(c => c.id === insp.technicianId);
      const inspDate = safeDate(insp.inspection_date || insp.inspectionDate);
      if (tech && inspDate) {
        recent.push({
          type: 'inspection',
          text: `QC Inspection: ${tech.display_name || tech.full_name || tech.email} scored ${insp.score}`,
          date: inspDate,
          score: insp.score
        });
      }
    });

    // Recent completions
    const recentCompletions = activeContractors
      .filter(c => c.shadowingStatus === 'completed')
      .sort((a, b) => {
        const aDate = safeDate(a.updated_at || a.created_at || a.shadowingEndDate);
        const bDate = safeDate(b.updated_at || b.created_at || b.shadowingEndDate);
        return (bDate?.getTime() || 0) - (aDate?.getTime() || 0);
      })
      .slice(0, 2);

    recentCompletions.forEach(tech => {
      const techDate = safeDate(tech.updated_at || tech.created_at || tech.shadowingEndDate);
      if (!techDate) return;
      recent.push({
        type: 'completion',
        text: `${tech.display_name || tech.full_name || tech.email} completed shadowing`,
        date: techDate
      });
    });

    recent.sort((a, b) => b.date - a.date);
    setRecentActivity(recent.slice(0, 5));
  };

  const handleProjectClick = (projectName) => {
    setSelectedProject(projectName);
    setShowProjectModal(true);
  };

  const getProjectTechnicians = (projectName) => {
    return activeContractors.filter(c => (c.project || 'Unassigned') === projectName);
  };

  // NEW: Helper functions to get filtered data for modals
  const getShadowingTechs = () => {
    return activeContractors.filter(c => c.shadowingStatus === 'in_progress');
  };

  const getExpiringComplianceTechs = () => {
    const today = new Date();
    const thirtyDaysOut = addDays(today, 30);

    return activeContractors.filter(contractor => {
      const wc = safeWCRecords.find(r => r.userEmail === contractor.email);
      const cert = safeCertRecords.find(r => r.userEmail === contractor.email);

      // We only care about expiring, not missing (missing is handled by critical alerts)
      if (!wc && !cert) return false;

      const wcExpDate = wc?.expirationDate ? new Date(wc.expirationDate) : null;
      const certExpDate = cert?.expirationDate ? new Date(cert.expirationDate) : null;

      // Contractor has an expiring document within the next 30 days and not already expired
      return (wcExpDate && wcExpDate <= thirtyDaysOut && wcExpDate >= today) ||
             (certExpDate && certExpDate <= thirtyDaysOut && certExpDate >= today);
    });
  };

  const getPendingTasks = () => {
    return safeTasks.filter(t => !['done','completed','closed'].includes((t.status || '').toLowerCase()));
  };

  const getCriticalAlerts = () => {
    const alerts = [];
    const today = new Date();

    // Compliance and Performance Alerts for Contractors
    activeContractors.forEach(contractor => {
      const wc = safeWCRecords.find(r => r.userEmail === contractor.email);
      const cert = safeCertRecords.find(r => r.userEmail === contractor.email);
      const contractorDisplayName = contractor.displayName || contractor.full_name || contractor.email;

      // 1. Missing Compliance Documents
      if (!wc || !cert) {
        alerts.push({
          id: `${contractor.id}-missing-compliance`, // Unique ID for key
          technicianId: contractor.id,
          technicianName: contractorDisplayName,
          type: 'compliance',
          severity: 'critical',
          message: `Missing critical compliance documents for ${contractorDisplayName} (WC/Cert)`,
          action: 'Upload Workers Comp and Safety Certification documents',
          link: createPageUrl('ComplianceDashboard') // Example link
        });
      } else {
        // 2. Expired Compliance Documents
        const wcExpDate = wc.expirationDate ? new Date(wc.expirationDate) : null;
        const certExpDate = cert.expirationDate ? new Date(cert.expirationDate) : null;

        if ((wcExpDate && isBefore(wcExpDate, today)) || (certExpDate && isBefore(certExpDate, today))) {
          let message = 'Compliance documents expired';
          if (wcExpDate && isBefore(wcExpDate, today) && (!certExpDate || !isBefore(certExpDate, today))) {
            message = 'Workers Comp expired';
          } else if (certExpDate && isBefore(certExpDate, today) && (!wcExpDate || !isBefore(wcExpDate, today))) {
            message = 'Safety Certification expired';
          } else if (wcExpDate && isBefore(wcExpDate, today) && certExpDate && isBefore(certExpDate, today)) {
            message = 'Workers Comp & Safety Certification expired';
          }

          alerts.push({
            id: `${contractor.id}-expired-compliance`,
            technicianId: contractor.id,
            technicianName: contractorDisplayName,
            type: 'compliance',
            severity: 'critical',
            message: `${contractorDisplayName}: ${message}`,
            action: 'Renew expired documents immediately',
            link: createPageUrl('ComplianceDashboard')
          });
        }
      }

      // 3. Low Performance Scores (using 70 as per outline)
      const qcScore = contractor.avgQcScore || 0;
      const velocitiScore = contractor.velocitiScore || 0;

      if (qcScore < 70 || velocitiScore < 70) {
        let severity = 'medium'; // Default
        let message = `Performance concern for ${contractorDisplayName}: `;
        if (qcScore < 70 && velocitiScore < 70) {
          severity = 'critical';
          message += `QC (${qcScore}) & Velo (${velocitiScore}) scores are low`;
        } else if (qcScore < 70) {
          severity = 'high';
          message += `QC score (${qcScore}) is low`;
        } else {
          severity = 'high';
          message += `Velo score (${velocitiScore}) is low`;
        }

        alerts.push({
          id: `${contractor.id}-low-performance`,
          technicianId: contractor.id,
          technicianName: contractorDisplayName,
          type: 'performance',
          severity: severity,
          message: message,
          action: 'Schedule performance review and remediation plan',
          link: createPageUrl('Performance')
        });
      }
    });

    // Overdue Urgent Tasks Alerts
    safeTasks.filter(t => !['done','completed','closed'].includes((t.status || '').toLowerCase())).forEach(task => {
      if (task.dueDate && isBefore(new Date(task.dueDate), today) && task.priority === 'Urgent') {
        // Find the technician name if available, otherwise use a generic label
        const taskTechnician = activeContractors.find(c => c.id === task.technicianId);
        const taskTechnicianName = taskTechnician ? (taskTechnician.displayName || taskTechnician.full_name) : 'Unassigned/Unknown';

        alerts.push({
          id: `${task.id}-overdue-task`,
          technicianId: task.technicianId,
          technicianName: taskTechnicianName,
          type: 'task',
          severity: 'high',
          message: `Urgent task overdue: "${task.title}" (assigned to ${taskTechnicianName})`,
          action: 'Complete or reassign urgent task',
          link: createPageUrl('QCBoard') // Assuming tasks might be managed here, or a dedicated task board
        });
      }
    });

    // Sort by severity (critical first)
    const severityOrder = { 'critical': 0, 'high': 1, 'medium': 2, 'low': 3 };
    alerts.sort((a, b) => {
      const orderA = severityOrder[a.severity] !== undefined ? severityOrder[a.severity] : 99;
      const orderB = severityOrder[b.severity] !== undefined ? severityOrder[b.severity] : 99;
      return orderA - orderB;
    });

    return alerts;
  };

  const QuickActionCard = ({ title, description, href, icon: Icon, color = "blue", count }) => (
    <Link to={href}>
      <Card className="group hover:shadow-lg transition-all duration-200 hover:border-blue-300 cursor-pointer h-full">
        <CardContent className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div className={`p-3 rounded-lg bg-${color}-100`}>
              <Icon className={`w-6 h-6 text-${color}-600`} />
            </div>
            {count !== undefined && count > 0 && (
              <Badge variant="destructive" className="text-lg px-3 py-1">
                {count}
              </Badge>
            )}
          </div>
          <h3 className="font-semibold text-lg text-gray-900 mb-1 group-hover:text-blue-600 transition-colors">
            {title}
          </h3>
          <p className="text-sm text-gray-600 mb-3">{description}</p>
          <div className="flex items-center text-blue-600 text-sm font-medium">
            View details
            <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );

  const mobileNavItems = [
    { href: createPageUrl('AdminDashboard'), label: 'Home', icon: Home },
    { href: createPageUrl('InvoicesHub'), label: 'Invoices', icon: FileText },
    { href: createPageUrl('TechRoster'), label: 'Team', icon: Users },
    { href: createPageUrl('QCBoard'), label: 'QC', icon: CheckCircle },
    { href: createPageUrl('ReportsHub'), label: 'Reports', icon: Activity },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50/30 p-4 md:p-6 space-y-4 md:space-y-6 pb-20 md:pb-6">
      {/* Announcements Banner */}
      <AnnouncementBanner />

      {/* Header with Clock In/Out */}
      <div className="flex flex-col lg:flex-row gap-6">
        <div className="flex-1">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl md:text-4xl font-bold text-gray-900 mb-2">
                Welcome back! 👋
              </h1>
              <p className="text-gray-600 text-base md:text-lg">
                Here's your team's performance overview
              </p>
            </div>
            <div className="flex gap-3">
              <Link to={createPageUrl('InvoicesHub')}>
                <Button size="lg" className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 w-full md:w-auto">
                  <Zap className="w-5 h-5 mr-2" />
                  Invoices Hub
                </Button>
              </Link>
            </div>
          </div>
        </div>
        
        {/* Clock In/Out Widget - Visible on larger screens */}
        <div className="w-full lg:w-96">
          <ClockInOut />
        </div>
      </div>

      {/* Live Dashboard with Auto-Refresh */}
      <LiveDashboard refreshInterval={30000}>
        {/* Key Team Health Metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
          <MetricCard
            title="Team Health"
            value={`${teamMetrics.teamHealthScore}%`}
            icon={Target}
            color={teamMetrics.teamHealthScore >= 85 ? "green" : teamMetrics.teamHealthScore >= 70 ? "yellow" : "red"}
          />
          <MetricCard
            title="At Risk"
            value={teamMetrics.atRiskCount}
            icon={AlertTriangle}
            color="red"
          />
          <MetricCard
            title="Active Team"
            value={teamMetrics.activeContractors}
            icon={Users}
            color="blue"
          />
          <MetricCard
            title="Avg QC Score"
            value={teamMetrics.avgQCScore}
            icon={Award}
            color={teamMetrics.avgQCScore >= 85 ? "green" : teamMetrics.avgQCScore >= 70 ? "yellow" : "orange"}
          />
        </div>

        {/* Secondary Metrics - NOW CLICKABLE */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
          <Card
            className="cursor-pointer hover:shadow-lg transition-all"
            onClick={() => setShowShadowingModal(true)}
          >
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1">Shadowing</p>
                  <p className="text-2xl font-bold text-gray-900">{teamMetrics.shadowingInProgress}</p>
                  <p className="text-xs text-gray-500 mt-1">In progress</p>
                </div>
                <div className="p-3 rounded-lg bg-purple-100">
                  <UserCheck className="w-6 h-6 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card
            className="cursor-pointer hover:shadow-lg transition-all"
            onClick={() => setShowExpiringModal(true)}
          >
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1">Expiring Soon</p>
                  <p className="text-2xl font-bold text-gray-900">{teamMetrics.complianceExpiringSoon}</p>
                  <p className="text-xs text-gray-500 mt-1">Next 30 days</p>
                </div>
                <div className="p-3 rounded-lg bg-orange-100">
                  <Shield className="w-6 h-6 text-orange-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card
            className="cursor-pointer hover:shadow-lg transition-all"
            onClick={() => setShowTasksModal(true)}
          >
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1">Pending Tasks</p>
                  <p className="text-2xl font-bold text-gray-900">{teamMetrics.pendingTasks}</p>
                  <p className="text-xs text-gray-500 mt-1">Need attention</p>
                </div>
                <div className="p-3 rounded-lg bg-blue-100">
                  <Clock className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card
            className="cursor-pointer hover:shadow-lg transition-all"
            onClick={() => setShowAlertsModal(true)}
          >
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1">Critical Alerts</p>
                  <p className="text-2xl font-bold text-gray-900">{teamMetrics.criticalAlerts}</p>
                  <p className="text-xs text-gray-500 mt-1">Requires action</p>
                </div>
                <div className="p-3 rounded-lg bg-red-100">
                  <Bell className="w-6 h-6 text-red-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts Section */}
        <div className="grid lg:grid-cols-2 gap-4 md:gap-6">
          {/* Performance Distribution */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-blue-600" />
                Performance Distribution
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={performanceDistribution}>
                  <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" radius={[8, 8, 0, 0]}>
                    {performanceDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Compliance Timeline */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-orange-600" />
                Compliance Expirations Timeline
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={complianceTimeline}>
                  <XAxis dataKey="period" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="expiring" fill="#f59e0b" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Project Distribution & Recent Activity */}
        <div className="grid lg:grid-cols-3 gap-4 md:gap-6">
          {/* Project Distribution - NOW CLICKABLE */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-purple-600" />
                Team by Project
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {projectDistribution.map((proj, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleProjectClick(proj.name)}
                    className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors group cursor-pointer border border-transparent hover:border-blue-200"
                  >
                    <span className="text-sm font-medium text-gray-700 group-hover:text-blue-600 transition-colors">
                      {proj.name}
                    </span>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="group-hover:bg-blue-100 group-hover:text-blue-800 transition-colors">
                        {proj.value}
                      </Badge>
                      <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
                    </div>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-green-600" />
                Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {recentActivity.map((activity, idx) => (
                  <div key={idx} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                    <div className={`p-2 rounded-full ${
                      activity.type === 'inspection'
                        ? activity.score >= 85 ? 'bg-green-100' : activity.score >= 70 ? 'bg-yellow-100' : 'bg-red-100'
                        : 'bg-blue-100'
                    }`}>
                      {activity.type === 'inspection' ? (
                        <CheckCircle className={`w-4 h-4 ${
                          activity.score >= 85 ? 'text-green-600' : activity.score >= 70 ? 'text-yellow-600' : 'text-red-600'
                        }`} />
                      ) : (
                        <UserCheck className="w-4 h-4 text-blue-600" />
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">{activity.text}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {safeFormatDateTime(activity.date)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </LiveDashboard>

      {/* Quick Actions Grid */}
      <div>
        <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-6">
          <QuickActionCard
            title="At-Risk Contractors"
            description="Review contractors needing attention"
            href={createPageUrl('AtRiskDashboard')}
            icon={AlertTriangle}
            color="red"
            count={teamMetrics.atRiskCount}
          />
          <QuickActionCard
            title="Manage Team Roster"
            description="View and update contractor information"
            href={createPageUrl('TechRoster')}
            icon={Users}
            color="blue"
          />
          <QuickActionCard
            title="Performance Dashboard"
            description="Track QC scores and Velo surveys"
            href={createPageUrl('Performance')}
            icon={TrendingUp}
            color="green"
          />
          <QuickActionCard
            title="QC Board"
            description="Manage quality control and inspections"
            href={createPageUrl('QCBoard')}
            icon={CheckCircle}
            color="purple"
          />
          <QuickActionCard
            title="Safety & Compliance"
            description="Review expiring certifications"
            href={createPageUrl('ComplianceDashboard')}
            icon={Shield}
            color="orange"
            count={teamMetrics.complianceExpiringSoon}
          />
          <QuickActionCard
            title="Project Board"
            description="Kanban view of all projects"
            href={createPageUrl('ProjectKanbanBoard')}
            icon={Briefcase}
            color="indigo"
          />
          <QuickActionCard
            title="System Alert Log"
            description="View system errors and logs"
            href={createPageUrl('AlertLog')}
            icon={AlertTriangle}
            color="gray"
          />
        </div>
      </div>

      {/* Mobile Bottom Navigation */}
      <MobileBottomNav items={mobileNavItems} currentPath={location.pathname} />

      {/* All Modals */}
      {selectedProject && (
        <ProjectTeamModal
          isOpen={showProjectModal}
          onClose={() => {
            setShowProjectModal(false);
            setSelectedProject(null);
          }}
          projectName={selectedProject}
          technicians={getProjectTechnicians(selectedProject)}
          wcRecords={wcRecords}
          certRecords={certRecords}
        />
      )}

      <ShadowingModal
        isOpen={showShadowingModal}
        onClose={() => setShowShadowingModal(false)}
        technicians={getShadowingTechs()}
      />

      <ExpiringComplianceModal
        isOpen={showExpiringModal}
        onClose={() => setShowExpiringModal(false)}
        technicians={getExpiringComplianceTechs()}
        wcRecords={wcRecords}
        certRecords={certRecords}
      />

      <PendingTasksModal
        isOpen={showTasksModal}
        onClose={() => setShowTasksModal(false)}
        tasks={getPendingTasks()}
      />

      <CriticalAlertsModal
        isOpen={showAlertsModal}
        onClose={() => setShowAlertsModal(false)}
        alerts={getCriticalAlerts()}
      />
    </div>
  );
}