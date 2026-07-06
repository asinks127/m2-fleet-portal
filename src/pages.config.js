/**
 * pages.config.js - Page routing configuration
 *
 * This file is AUTO-GENERATED. Do not add imports or modify PAGES manually.
 * Pages are auto-registered when you create files in the ./pages/ folder.
 *
 * THE ONLY EDITABLE VALUE: mainPage
 * This controls which page is the landing page (shown when users visit the app).
 */
import AdminDashboard from './pages/AdminDashboard';
import AlertLog from './pages/AlertLog';
import AnnouncementManager from './pages/AnnouncementManager';
import AtRiskDashboard from './pages/AtRiskDashboard';
import AuditAnalyticsDashboard from './pages/AuditAnalyticsDashboard';
import AuditExecution from './pages/AuditExecution';
import AuditList from './pages/AuditList';
import AuditSettings from './pages/AuditSettings';
import AuditTemplateBuilder from './pages/AuditTemplateBuilder';
import AuditTemplates from './pages/AuditTemplates';
import AuditingDashboard from './pages/AuditingDashboard';
import AutoApprovedInvoices from './pages/AutoApprovedInvoices';
import AutomationSettings from './pages/AutomationSettings';
import BulkInvite from './pages/BulkInvite';
import Calendar from './pages/Calendar';
import CallLogsReport from './pages/CallLogsReport';
import ComplianceDashboard from './pages/ComplianceDashboard';
import ContractorAccounting from './pages/ContractorAccounting';
import ContractorDashboard from './pages/ContractorDashboard';
import ContractorProfile from './pages/ContractorProfile';
import CorrectiveActions from './pages/CorrectiveActions';
import DebugDashboard from './pages/DebugDashboard';
import DiagnosticReport from './pages/DiagnosticReport';
import DocumentSigningDashboard from './pages/DocumentSigningDashboard';
import DocusignDashboard from './pages/DocusignDashboard';
import EmergencyContactReport from './pages/EmergencyContactReport';
import ExecutiveComplianceDashboard from './pages/ExecutiveComplianceDashboard';
import OnsiteSafetyCheckForm from './pages/OnsiteSafetyCheckForm';
import OnsiteSafetyChecksDashboard from './pages/OnsiteSafetyChecksDashboard';
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
import MySafetyReports from './pages/MySafetyReports';
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
import SafetyHome from './pages/SafetyHome';
import ReportsHub from './pages/ReportsHub';
import ResourceAdmin from './pages/ResourceAdmin';
import ResourceBrowse from './pages/ResourceBrowse';
import ResourceContacts from './pages/ResourceContacts';
import ResourceInsights from './pages/ResourceInsights';
import ResourceInstallGuides from './pages/ResourceInstallGuides';
import ResourceSafety from './pages/ResourceSafety';
import ResourceSearch from './pages/ResourceSearch';
import ResourceTraining from './pages/ResourceTraining';
import SafetyAdmin from './pages/SafetyAdmin';
import ShadowingChecklistResponse from './pages/ShadowingChecklistResponse';
import ShadowingDashboard from './pages/ShadowingDashboard';
import SignDocument from './pages/SignDocument';
import SubmitInvoice from './pages/SubmitInvoice';
import Survey from './pages/Survey';
import TechRoster from './pages/TechRoster';
import WarrantyManagement from './pages/WarrantyManagement';
import VeloSurveyDashboard from './pages/VeloSurveyDashboard';
import VeloSurveyPortal from './pages/VeloSurveyPortal';
import WeeklyApprovedInvoices from './pages/WeeklyApprovedInvoices';
import __Layout from './Layout.jsx';

export const PAGES = {
    "AdminDashboard": AdminDashboard,
    "AlertLog": AlertLog,
    "AnnouncementManager": AnnouncementManager,
    "AtRiskDashboard": AtRiskDashboard,
    "AuditAnalyticsDashboard": AuditAnalyticsDashboard,
    "AuditExecution": AuditExecution,
    "AuditList": AuditList,
    "AuditSettings": AuditSettings,
    "AuditTemplateBuilder": AuditTemplateBuilder,
    "AuditTemplates": AuditTemplates,
    "AuditingDashboard": AuditingDashboard,
    "AutoApprovedInvoices": AutoApprovedInvoices,
    "AutomationSettings": AutomationSettings,
    "BulkInvite": BulkInvite,
    "Calendar": Calendar,
    "CallLogsReport": CallLogsReport,
    "ComplianceDashboard": ComplianceDashboard,
    "ContractorAccounting": ContractorAccounting,
    "ContractorDashboard": ContractorDashboard,
    "ContractorProfile": ContractorProfile,
    "CorrectiveActions": CorrectiveActions,
    "DebugDashboard": DebugDashboard,
    "DiagnosticReport": DiagnosticReport,
    "DocumentSigningDashboard": DocumentSigningDashboard,
    "DocusignDashboard": DocusignDashboard,
    "EmergencyContactReport": EmergencyContactReport,
    "ExecutiveComplianceDashboard": ExecutiveComplianceDashboard,
    "OnsiteSafetyCheckForm": OnsiteSafetyCheckForm,
    "OnsiteSafetyChecksDashboard": OnsiteSafetyChecksDashboard,
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
    "MySafetyReports": MySafetyReports,
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
    "SafetyHome": SafetyHome,
    "ReportsHub": ReportsHub,
    "ResourceAdmin": ResourceAdmin,
    "ResourceBrowse": ResourceBrowse,
    "ResourceContacts": ResourceContacts,
    "ResourceInsights": ResourceInsights,
    "ResourceInstallGuides": ResourceInstallGuides,
    "ResourceSafety": ResourceSafety,
    "ResourceSearch": ResourceSearch,
    "ResourceTraining": ResourceTraining,
    "SafetyAdmin": SafetyAdmin,
    "ShadowingChecklistResponse": ShadowingChecklistResponse,
    "ShadowingDashboard": ShadowingDashboard,
    "SignDocument": SignDocument,
    "SubmitInvoice": SubmitInvoice,
    "Survey": Survey,
    "TechRoster": TechRoster,
    "VeloSurveyDashboard": VeloSurveyDashboard,
    "VeloSurveyPortal": VeloSurveyPortal,
    "WarrantyManagement": WarrantyManagement,
    "WeeklyApprovedInvoices": WeeklyApprovedInvoices,
}

export const pagesConfig = {
    mainPage: "PortalAccess",
    Pages: PAGES,
    Layout: __Layout,
};
