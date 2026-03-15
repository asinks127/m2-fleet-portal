/**
 * pages.config.js - Page routing configuration
 * 
 * This file is AUTO-GENERATED. Do not add imports or modify PAGES manually.
 * Pages are auto-registered when you create files in the ./pages/ folder.
 * 
 * THE ONLY EDITABLE VALUE: mainPage
 * This controls which page is the landing page (shown when users visit the app).
 * 
 * Example file structure:
 * 
 *   import HomePage from './pages/HomePage';
 *   import Dashboard from './pages/Dashboard';
 *   import Settings from './pages/Settings';
 *   
 *   export const PAGES = {
 *       "HomePage": HomePage,
 *       "Dashboard": Dashboard,
 *       "Settings": Settings,
 *   }
 *   
 *   export const pagesConfig = {
 *       mainPage: "HomePage",
 *       Pages: PAGES,
 *   };
 * 
 * Example with Layout (wraps all pages):
 *
 *   import Home from './pages/Home';
 *   import Settings from './pages/Settings';
 *   import __Layout from './Layout.jsx';
 *
 *   export const PAGES = {
 *       "Home": Home,
 *       "Settings": Settings,
 *   }
 *
 *   export const pagesConfig = {
 *       mainPage: "Home",
 *       Pages: PAGES,
 *       Layout: __Layout,
 *   };
 *
 * To change the main page from HomePage to Dashboard, use find_replace:
 *   Old: mainPage: "HomePage",
 *   New: mainPage: "Dashboard",
 *
 * The mainPage value must match a key in the PAGES object exactly.
 */
import AdminDashboard from './pages/AdminDashboard';
import AlertLog from './pages/AlertLog';
import AnnouncementManager from './pages/AnnouncementManager';
import AtRiskDashboard from './pages/AtRiskDashboard';
import AutoApprovedInvoices from './pages/AutoApprovedInvoices';
import AutomationSettings from './pages/AutomationSettings';
import BulkInvite from './pages/BulkInvite';
import Calendar from './pages/Calendar';
import CallLogsReport from './pages/CallLogsReport';
import ComplianceDashboard from './pages/ComplianceDashboard';
import ContractorAccounting from './pages/ContractorAccounting';
import ContractorDashboard from './pages/ContractorDashboard';
import ContractorProfile from './pages/ContractorProfile';
import DebugDashboard from './pages/DebugDashboard';
import DiagnosticReport from './pages/DiagnosticReport';
import DocumentSigningDashboard from './pages/DocumentSigningDashboard';
import DocusignDashboard from './pages/DocusignDashboard';
import EmergencyContactReport from './pages/EmergencyContactReport';
import Home from './pages/Home';
import InactiveTechs from './pages/InactiveTechs';
import InvoiceComplianceReport from './pages/InvoiceComplianceReport';
import InvoiceHistory from './pages/InvoiceHistory';
import InvoiceManagement from './pages/InvoiceManagement';
import InvoicesDrive from './pages/InvoicesDrive';
import InvoicesHub from './pages/InvoicesHub';
import JobOpeningDetails from './pages/JobOpeningDetails';
import JobPostingGenerator from './pages/JobPostingGenerator';
import Messaging from './pages/Messaging';
import MissingEmergencyContacts from './pages/MissingEmergencyContacts';
import MyTeam from './pages/MyTeam';
import NegativeInteractionsReport from './pages/NegativeInteractionsReport';
import Onboarding from './pages/Onboarding';
import PaymentLedger from './pages/PaymentLedger';
import PendingInvoices from './pages/PendingInvoices';
import Performance from './pages/Performance';
import PortalAccess from './pages/PortalAccess';
import ProjectKanbanBoard from './pages/ProjectKanbanBoard';
import QCBoard from './pages/QCBoard';
import RecruitingDashboard from './pages/RecruitingDashboard';
import ReportsHub from './pages/ReportsHub';
import SafetyAdmin from './pages/SafetyAdmin';
import ShadowingChecklistResponse from './pages/ShadowingChecklistResponse';
import ShadowingDashboard from './pages/ShadowingDashboard';
import SignDocument from './pages/SignDocument';
import SubmitInvoice from './pages/SubmitInvoice';
import Survey from './pages/Survey';
import TechRoster from './pages/TechRoster';
import VeloSurveyDashboard from './pages/VeloSurveyDashboard';
import VeloSurveyPortal from './pages/VeloSurveyPortal';
import WeeklyApprovedInvoices from './pages/WeeklyApprovedInvoices';
import __Layout from './Layout.jsx';


export const PAGES = {
    "AdminDashboard": AdminDashboard,
    "AlertLog": AlertLog,
    "AnnouncementManager": AnnouncementManager,
    "AtRiskDashboard": AtRiskDashboard,
    "AutoApprovedInvoices": AutoApprovedInvoices,
    "AutomationSettings": AutomationSettings,
    "BulkInvite": BulkInvite,
    "Calendar": Calendar,
    "CallLogsReport": CallLogsReport,
    "ComplianceDashboard": ComplianceDashboard,
    "ContractorAccounting": ContractorAccounting,
    "ContractorDashboard": ContractorDashboard,
    "ContractorProfile": ContractorProfile,
    "DebugDashboard": DebugDashboard,
    "DiagnosticReport": DiagnosticReport,
    "DocumentSigningDashboard": DocumentSigningDashboard,
    "DocusignDashboard": DocusignDashboard,
    "EmergencyContactReport": EmergencyContactReport,
    "Home": Home,
    "InactiveTechs": InactiveTechs,
    "InvoiceComplianceReport": InvoiceComplianceReport,
    "InvoiceHistory": InvoiceHistory,
    "InvoiceManagement": InvoiceManagement,
    "InvoicesDrive": InvoicesDrive,
    "InvoicesHub": InvoicesHub,
    "JobOpeningDetails": JobOpeningDetails,
    "JobPostingGenerator": JobPostingGenerator,
    "Messaging": Messaging,
    "MissingEmergencyContacts": MissingEmergencyContacts,
    "MyTeam": MyTeam,
    "NegativeInteractionsReport": NegativeInteractionsReport,
    "Onboarding": Onboarding,
    "PaymentLedger": PaymentLedger,
    "PendingInvoices": PendingInvoices,
    "Performance": Performance,
    "PortalAccess": PortalAccess,
    "ProjectKanbanBoard": ProjectKanbanBoard,
    "QCBoard": QCBoard,
    "RecruitingDashboard": RecruitingDashboard,
    "ReportsHub": ReportsHub,
    "SafetyAdmin": SafetyAdmin,
    "ShadowingChecklistResponse": ShadowingChecklistResponse,
    "ShadowingDashboard": ShadowingDashboard,
    "SignDocument": SignDocument,
    "SubmitInvoice": SubmitInvoice,
    "Survey": Survey,
    "TechRoster": TechRoster,
    "VeloSurveyDashboard": VeloSurveyDashboard,
    "VeloSurveyPortal": VeloSurveyPortal,
    "WeeklyApprovedInvoices": WeeklyApprovedInvoices,
}

export const pagesConfig = {
    mainPage: "PortalAccess",
    Pages: PAGES,
    Layout: __Layout,
};