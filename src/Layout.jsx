import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils/index.js';
import { supabase } from '@/lib/supabaseClient.js';
import { useAuth } from '@/lib/AuthContext.jsx';
import {
  LayoutDashboard, LogOut, FileText, Users, Briefcase, Shield, CheckSquare,
  Truck, UserCheck, FileSearch, DollarSign, BarChart3, ChevronDown,
  ChevronRight, Menu, X, Calendar, UserCog, AlertTriangle, Phone,
  Star, TrendingUp, Megaphone, KanbanSquare, FileSignature, UserSquare, Settings, Zap, Home, Sparkles, UserX, MessageSquare, ShieldAlert
} from 'lucide-react';
import { Button } from '@/components/ui/button.jsx';

const NavLink = ({ href, children, icon: Icon }) => {
  const location = useLocation();
  const isActive = location.pathname === href;
  return (
    <Link
      to={href}
      className={`flex items-center px-3 py-2.5 text-sm rounded-lg transition-all duration-200 ${
        isActive
          ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md'
          : 'text-gray-200 hover:bg-white/10 hover:text-white'
      }`}
    >
      <Icon className="w-5 h-5 mr-3 flex-shrink-0" />
      <span className="flex-1">{children}</span>
      {isActive && (
        <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></div>
      )}
    </Link>
  );
};

const CollapsibleNavSection = ({ title, icon: Icon, children }) => {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full px-3 py-2.5 text-sm text-gray-200 rounded-lg hover:bg-white/10 hover:text-white transition-all duration-200"
      >
        <div className="flex items-center">
          <Icon className="w-5 h-5 mr-3 flex-shrink-0" />
          <span className="flex-1 text-left">{title}</span>
        </div>
        {isOpen ? <ChevronDown className="w-4 h-4 flex-shrink-0" /> : <ChevronRight className="w-4 h-4 flex-shrink-0" />}
      </button>
      {isOpen && <div className="pl-6 mt-1 space-y-1 animate-slide-in-right">{children}</div>}
    </div>
  );
};

const adminNavLinks = [
  { href: createPageUrl('AdminDashboard'), label: '🏠 Home', icon: Home },
  { href: createPageUrl('Messaging'), label: '💬 Team Messaging', icon: MessageSquare },
  { href: createPageUrl('InvoicesHub'), label: '⚡ Invoices Hub', icon: Zap },
  { href: createPageUrl('TechRoster'), label: 'Team Roster', icon: Users },
  { href: createPageUrl('QCBoard'), label: 'QC Board', icon: CheckSquare },
  { href: createPageUrl('ProjectKanbanBoard'), label: 'Project Board', icon: KanbanSquare },
  {
    title: 'Performance & Analytics',
    icon: TrendingUp,
    children: [
      { href: createPageUrl('Performance'), label: 'Performance Dashboard', icon: TrendingUp },
      { href: createPageUrl('VeloSurveyDashboard'), label: 'Velo Surveys', icon: Star },
      { href: createPageUrl('CallLogsReport'), label: 'Call Logs', icon: Phone },
    ],
  },
  {
    title: 'Safety & Compliance',
    icon: Shield,
    children: [
      { href: createPageUrl('ComplianceDashboard'), label: 'Dashboard', icon: LayoutDashboard },
      { href: createPageUrl('SafetyAdmin'), label: 'Safety Admin', icon: Shield },
      { href: createPageUrl('EmergencyContactReport'), label: 'Emergency Contacts', icon: AlertTriangle },
      { href: createPageUrl('MissingEmergencyContacts'), label: 'Missing Emergency Info', icon: UserX },
    ],
  },
  {
    title: 'More Tools',
    icon: Settings,
    children: [
      { href: createPageUrl('ReportsHub'), label: 'Reports Hub', icon: BarChart3 },
      { href: createPageUrl('Calendar'), label: 'Calendar', icon: Calendar },
      { href: createPageUrl('ShadowingDashboard'), label: 'Shadowing Dashboard', icon: UserCheck },
      { href: createPageUrl('RecruitingDashboard'), label: 'Recruiting', icon: Briefcase },
      { href: createPageUrl('InactiveTechs'), label: 'Inactive Techs', icon: UserCog },
      { href: createPageUrl('DocumentSigningDashboard'), label: 'E-Signatures', icon: FileSignature },
      { href: createPageUrl('PaymentLedger'), label: 'Payment Ledger', icon: DollarSign },
      { href: createPageUrl('AnnouncementManager'), label: 'Announcements', icon: Megaphone },
      { href: createPageUrl('AutomationSettings'), label: 'Automation', icon: Settings },
      { href: createPageUrl('AlertLog'), label: 'Alert Log', icon: AlertTriangle },
      { href: createPageUrl('DiagnosticReport'), label: 'Diagnostic Report', icon: AlertTriangle },
    ],
  },
];

const pmNavLinks = [
    { href: createPageUrl('MyTeam'), label: 'My Team', icon: UserSquare },
    { href: createPageUrl('Messaging'), label: '💬 Team Messaging', icon: MessageSquare },
    { href: createPageUrl('TechRoster'), label: 'Full Roster', icon: Users },
    { href: createPageUrl('ProjectKanbanBoard'), label: 'Project Kanban Board', icon: KanbanSquare },
    { href: createPageUrl('QCBoard'), label: 'QC Board', icon: CheckSquare },
    { href: createPageUrl('InvoiceHistory'), label: 'Invoice History', icon: FileSearch },
    { href: createPageUrl('ReportsHub'), label: 'Reports Hub', icon: BarChart3 },
];

const contractorNavLinks = [
  { href: createPageUrl('ContractorDashboard') + '?v=2.4', label: 'Dashboard', icon: LayoutDashboard },
  { href: createPageUrl('SubmitInvoice'), label: 'Submit Invoice', icon: FileText },
  { href: createPageUrl('ContractorProfile'), label: 'My Profile', icon: UserCheck },
];

const qcNavLinks = [
  { href: createPageUrl('QCBoard'), label: 'QC Board', icon: CheckSquare },
  { href: createPageUrl('Messaging'), label: '💬 Team Messaging', icon: MessageSquare },
  { href: createPageUrl('TechRoster'), label: 'Tech Roster', icon: Users },
  { href: createPageUrl('ShadowingDashboard'), label: 'Shadowing Dashboard', icon: UserCheck },
  { href: createPageUrl('CallLogsReport'), label: 'Call Logs Report', icon: Phone },
  {
    title: 'Safety & Compliance',
    icon: Shield,
    children: [
      { href: createPageUrl('ComplianceDashboard'), label: 'Dashboard', icon: LayoutDashboard },
      { href: createPageUrl('SafetyAdmin'), label: 'Safety Admin', icon: Shield },
      { href: createPageUrl('EmergencyContactReport'), label: 'Emergency Contacts', icon: AlertTriangle },
      { href: createPageUrl('InvoiceComplianceReport'), label: 'Invoice Compliance', icon: FileText },
    ],
  },
  { href: createPageUrl('SubmitInvoice'), label: 'Submit Invoice', icon: FileText },
  { href: createPageUrl('ContractorProfile'), label: 'My Profile', icon: UserCheck },
];

const veloNavLinks = [
    { href: createPageUrl('VeloSurveyPortal'), label: 'Survey Portal', icon: Star },
];

const adminOnlyPages = [
  'AdminDashboard', 'PendingInvoices',
  'RecruitingDashboard', 'InvoicesDrive', 'PaymentLedger', 'DocusignDashboard',
  'DocumentSigningDashboard', 'InvoiceManagement', 'ContractorAccounting',
  'WeeklyApprovedInvoices', 'AutoApprovedInvoices', 'InactiveTechs', 'Calendar',
  'Performance', 'BulkInvite', 'AlertLog', 'VeloSurveyDashboard',
  'ProjectKanbanBoard', 'AutomationSettings', 'DiagnosticReport',
  'AnnouncementManager', 'InvoicesHub', 'MissingEmergencyContacts', 'Messaging'
];

const veloRestrictedPages = [
  ...adminOnlyPages,
  'ContractorDashboard', 'SubmitInvoice', 'ContractorProfile', 'TechRoster',
  'QCBoard', 'ShadowingDashboard', 'CallLogsReport', 'MyTeam', 'ComplianceDashboard',
  'SafetyAdmin', 'EmergencyContactReport', 'InvoiceComplianceReport', 'InvoiceHistory',
  'ReportsHub'
];

const publicPages = ['Survey', 'SignDocument', 'ShadowingChecklistResponse'];

const getPageNameFromPath = (pathname) => {
  const segments = pathname.replace(/^\//, '').split('/');
  return segments[0] || 'AdminDashboard';
};

const isPublicPage = (pathname) => {
  const pageName = getPageNameFromPath(pathname);
  return publicPages.includes(pageName);
};

function PrivateLayout({ children, currentPageName }) {
  const { user: contextUser, roleOverride, isDebugUser, toggleDebugRole } = useAuth();
  const [user, setUser] = useState(contextUser || null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const checkUser = async () => {
      try {
        const { data: { user: currentUser }, error } = await supabase.auth.getUser();
        if (error) throw error;
        
        const effectiveUser = currentUser || contextUser;
        setUser(effectiveUser);

        if (!effectiveUser) {
          const currentPath = window.location.pathname;
          if (!isPublicPage(currentPath) && currentPath !== createPageUrl('PortalAccess')) {
            navigate(createPageUrl('PortalAccess'), { replace: true });
            return;
          }
        }

        if (effectiveUser && effectiveUser.email) {
          const userEmail = effectiveUser.email.toLowerCase();

          const adminEmails = [
                    'lena@m2fleetcom.com', 'orville@m2fleetcom.com', 'steve@m2fleetcom.com',
                    'austin@m2fleetcom.com', 'adam@m2fleetcom.com', 'jason@m2fleetcom.com', 'erica@m2fleetcom.com',
                    'lowell@m2fleetcom.com', 'secretary@m2fleetcom.com', 'tjserota@gmail.com', 'zo-test@m2fleetcom.com'
                  ];
          const qcEmails = [ 'rmiller.contractor@m2fleetcom.com', 'choffman.contractor@m2fleetcom.com' ];
          const specialContractorEmails = ['tjserota@gmail.com'];

          const isVeloPM = userEmail.endsWith('@velociti.com') || userEmail === 'omcvay@gmail.com';
          const isAdmin = effectiveUser?.user_metadata?.role === 'admin' || adminEmails.includes(userEmail);
          const isQC = qcEmails.includes(userEmail);
          const isContractor = !isVeloPM && (
            userEmail.includes('.contractor@m2fleetcom.com') || 
            userEmail.includes('.contractor@smcinstallations.com') ||
            specialContractorEmails.includes(userEmail)
          );
          const isM2PM = userEmail.endsWith('@m2fleetcom.com') && !isAdmin && !isQC && !isContractor && !isVeloPM;

          const currentPath = window.location.pathname;
          const profilePageUrl = createPageUrl('ContractorProfile');
          const surveyPortalUrl = createPageUrl('VeloSurveyPortal');

          if (isVeloPM && currentPath !== surveyPortalUrl) {
            navigate(surveyPortalUrl, { replace: true });
            return;
          }

          if (isContractor && !isAdmin && !isQC && !isVeloPM) {
            const hasRequiredFields = 
              effectiveUser.displayName && 
              effectiveUser.business && 
              effectiveUser.phone &&
              effectiveUser.emergencyContactName &&
              effectiveUser.emergencyContactPhone;
            
            const isOnProfilePage = currentPath === profilePageUrl;
            
            if (!hasRequiredFields && !isOnProfilePage) {
              navigate(profilePageUrl, { replace: true });
              return;
            }
          }

          if (currentPath === '/' || currentPath.endsWith('/AdminDashboard')) {
             if (isM2PM) {
                navigate(createPageUrl('MyTeam'), { replace: true });
                return;
             }
             if (isContractor && !isAdmin && !isQC && !isVeloPM) {
                navigate(createPageUrl('ContractorDashboard'), { replace: true });
                return;
             }
          }

          if (isContractor && !isAdmin && !isQC && !isVeloPM) {
            const currentPage = currentPath.split('/').pop() || 'AdminDashboard';

            if (adminOnlyPages.includes(currentPage) || currentPage === '' || currentPage === 'AdminDashboard') {
              navigate(createPageUrl('ContractorDashboard'), { replace: true });
              return;
            }
          }
        }
      } catch (error) {
        console.error('Authentication error, falling back to demo user:', error);
        setUser(contextUser || null);
      } finally {
        setLoading(false);
      }
    };
    checkUser();
  }, [navigate, location, currentPageName, contextUser]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.reload();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
        <div className="text-center">
           <div className="relative">
             <Truck className="w-16 h-16 text-blue-600 animate-bounce mx-auto mb-4" />
             <Sparkles className="w-8 h-8 text-indigo-500 absolute -top-2 -right-2 animate-pulse" />
           </div>
           <span className="text-xl font-semibold text-gray-700">Loading M2 Fleet Portal...</span>
           <div className="mt-4 h-2 w-48 bg-gray-200 rounded-full overflow-hidden mx-auto">
             {/* The 'loading' animation must be defined in tailwind.config.js or a global CSS file for this to work */}
             <div className="h-full bg-gradient-to-r from-blue-600 to-indigo-600 animate-[loading_1.5s_ease-in-out_infinite]"></div>
           </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
        <div className="flex items-center justify-center h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
             <div className="flex items-center space-x-2">
                <Truck className="w-8 h-8 text-blue-600 animate-pulse" />
                <span className="text-xl font-semibold text-gray-700">Redirecting to sign in...</span>
             </div>
        </div>
    );
  }

  const userEmail = user.email?.toLowerCase() || '';

  const adminEmails = [
                'lena@m2fleetcom.com', 'orville@m2fleetcom.com', 'steve@m2fleetcom.com',
                'austin@m2fleetcom.com', 'adam@m2fleetcom.com', 'jason@m2fleetcom.com', 'erica@m2fleetcom.com',
                'lowell@m2fleetcom.com', 'secretary@m2fleetcom.com', 'tjserota@gmail.com', 'zo-test@m2fleetcom.com'
              ];
  const qcEmails = [ 'rmiller.contractor@m2fleetcom.com', 'choffman.contractor@m2fleetcom.com' ];
  const specialContractorEmails = ['tjserota@gmail.com']; // Special case contractors

  const isVeloPM = userEmail.endsWith('@velociti.com') ||
                  userEmail === 'omcvay@gmail.com';
  const isAdmin = user?.user_metadata?.role === 'admin' || adminEmails.includes(userEmail);
  const isQC = qcEmails.includes(userEmail);
  const isContractor = !isVeloPM && (
    userEmail.includes('.contractor@m2fleetcom.com') || 
    userEmail.includes('.contractor@smcinstallations.com') ||
    specialContractorEmails.includes(userEmail)
  );
  const isM2PM = userEmail.endsWith('@m2fleetcom.com') && !isAdmin && !isQC && !isContractor && !isVeloPM;

  // Apply role override for debug user
  const isDebugMode = isDebugUser && roleOverride !== null;
  const effectiveIsAdmin = isDebugMode ? roleOverride === 'admin' : isAdmin;
  const effectiveIsContractor = isDebugMode ? roleOverride === 'contractor' : isContractor;
  const effectiveIsM2PM = isDebugMode ? false : isM2PM;
  const effectiveIsQC = isDebugMode ? false : isQC;
  const effectiveIsVeloPM = isDebugMode ? false : isVeloPM;

  let navLinks;
  if (effectiveIsAdmin && !effectiveIsVeloPM) {
    navLinks = adminNavLinks;
  } else if (effectiveIsVeloPM) {
    navLinks = veloNavLinks;
  } else if (effectiveIsM2PM) {
    navLinks = pmNavLinks;
  } else if (effectiveIsQC) {
    navLinks = qcNavLinks;
  } else if (effectiveIsContractor) {
    navLinks = contractorNavLinks;
  } else {
    navLinks = contractorNavLinks;
  }

  const allowedPaths = new Set();
  navLinks.forEach(link => {
    if (link.children) {
      link.children.forEach(child => allowedPaths.add(child.href));
    } else {
      allowedPaths.add(link.href);
    }
  });

  const currentPathFull = location.pathname;
  const currentPageNameFromPath = currentPathFull.split('/').pop() || 'AdminDashboard';

  if (isVeloPM && veloRestrictedPages.includes(currentPageNameFromPath)) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
        <div className="text-center p-8 bg-white rounded-2xl shadow-2xl max-w-md animate-scale-in">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
            <Star className="w-8 h-8 text-blue-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Restricted</h2>
          <p className="text-gray-600 mb-6">
            Velo PMs only have access to the Survey Portal. Redirecting you now...
          </p>
          <Button
            onClick={() => navigate(createPageUrl('VeloSurveyPortal'), { replace: true })}
            className="btn-primary"
          >
            Go to Survey Portal
          </Button>
        </div>
      </div>
    );
  }

  const isAccessDeniedCandidate = !effectiveIsAdmin && !effectiveIsQC && !effectiveIsVeloPM && !effectiveIsM2PM; // SECURITY FIX: Unknown users denied from admin pages
  const isPageAdminRestricted = adminOnlyPages.includes(currentPageNameFromPath) || currentPageNameFromPath === '' || currentPageNameFromPath === 'AdminDashboard';
  const isPageAllowedByNav = allowedPaths.has(currentPathFull);

  // Allow DebugDashboard for contractors
  if (currentPageNameFromPath === 'DebugDashboard') {
    return (
      <PrivateLayout currentPageName={currentPageName}>
        {children}
      </PrivateLayout>
    );
  }

  if (isAccessDeniedCandidate && isPageAdminRestricted && !isPageAllowedByNav) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-red-50 via-orange-50 to-yellow-50">
        <div className="text-center p-8 bg-white rounded-2xl shadow-2xl max-w-md animate-scale-in">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mb-4">
            <AlertTriangle className="w-8 h-8 text-red-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-600 mb-6">
            You don't have permission to access this page. Redirecting to your dashboard...
          </p>
          <Button
            onClick={() => navigate(createPageUrl('ContractorDashboard'), { replace: true })}
            className="btn-primary"
          >
            Go to My Dashboard
          </Button>
        </div>
      </div>
    );
  }

  const Sidebar = () => (
    <div className="flex flex-col h-full bg-gradient-to-br from-gray-900 via-blue-900 to-indigo-900 text-white relative overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 bg-dots opacity-10"></div>
      
      <div className="relative z-10 p-4 border-b border-white/10 flex items-center justify-between">
         <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg shadow-lg">
              <Truck className="w-6 h-6" />
            </div>
            <div>
              <span className="text-lg font-bold bg-gradient-to-r from-white to-blue-200 bg-clip-text text-transparent">
                M2 Fleet Portal
              </span>
              <div className="flex items-center gap-1 text-xs text-blue-200">
                <Sparkles className="w-3 h-3" />
                <span>v2.0</span>
              </div>
            </div>
         </div>
         <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-white hover:bg-white/10 p-2 rounded-lg transition-colors">
            <X className="w-5 h-5" />
         </button>
      </div>
      
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto relative z-10">
        {navLinks.map((link, index) =>
          link.children ? (
            <CollapsibleNavSection key={index} title={link.label || link.title} icon={link.icon}>
              {link.children.map((child, childIndex) => (
                <NavLink key={childIndex} href={child.href} icon={child.icon}>
                  {child.label}
                </NavLink>
              ))}
            </CollapsibleNavSection>
          ) : (
            <NavLink key={index} href={link.href} icon={link.icon}>
              {link.label}
            </NavLink>
          )
        )}
      </nav>
      
      <div className="relative z-10 p-4 border-t border-white/10 bg-black/20 backdrop-blur-sm">
        {isDebugUser && (
          <div className="mb-3 p-2 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600">
            <div className="flex items-center justify-between">
              <div className="text-xs">
                <ShieldAlert className="w-4 h-4 inline mr-1" />
                <span className="font-semibold">DEBUG MODE</span>
              </div>
              <button
                onClick={toggleDebugRole}
                className="px-2 py-1 text-xs font-bold rounded bg-white/20 hover:bg-white/30 transition-colors"
              >
                {roleOverride === 'admin' ? 'Switch to Contractor' : roleOverride === 'contractor' ? 'Exit Debug' : 'Switch to Admin'}
              </button>
            </div>
            <div className="text-xs mt-1 opacity-80">
              Current: {roleOverride || 'Real Role'}
            </div>
          </div>
        )}
        <div className="text-sm text-gray-300 mb-3">
            <div className="font-semibold text-white">{user?.user_metadata?.full_name || user.email}</div>
            <div className="text-xs text-blue-200 mt-1">
              {isVeloPM && "Velo PM Survey Portal"}
              {isM2PM && "Project Manager Portal"}
              {isContractor && !isAdmin && !isQC && !isVeloPM && "Contractor Portal"}
              {isQC && "QC Manager Portal"}
              {isAdmin && !isM2PM && !isVeloPM && "Admin Portal"}
            </div>
        </div>
        <Button
          onClick={handleLogout}
          variant="ghost"
          className="w-full justify-start text-gray-200 hover:bg-red-500/20 hover:text-white transition-all"
        >
          <LogOut className="w-5 h-5 mr-3" />
          Logout
        </Button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-gray-50">
       <div className={`fixed inset-0 z-30 bg-black/50 lg:hidden ${sidebarOpen ? 'block' : 'hidden'}`} onClick={() => setSidebarOpen(false)}></div>
      <div className={`fixed lg:static lg:translate-x-0 z-40 h-full w-72 transition-transform transform ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} shadow-2xl`}>
        <Sidebar />
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white shadow-sm p-4 flex items-center lg:hidden border-b">
            <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(true)} className="hover:bg-gray-100">
                <Menu className="w-6 h-6"/>
            </Button>
            <h1 className="text-lg font-semibold ml-4">{currentPageName}</h1>
        </header>
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gradient-to-br from-gray-50 via-blue-50/30 to-indigo-50/30">
          {children}
        </main>
      </div>
    </div>
  );
}

export default function Layout({ children, currentPageName }) {
  const location = useLocation();
  const isCurrentPagePublic = publicPages.includes(currentPageName) || isPublicPage(location.pathname);

  if (isCurrentPagePublic) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-indigo-50/30">
        {children}
      </div>
    );
  }

  return (
    <PrivateLayout currentPageName={currentPageName}>
      {children}
    </PrivateLayout>
  );
}