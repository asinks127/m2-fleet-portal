-- Supabase Schema for M2 Fleet Portal
-- This file contains the table definitions extracted from the application logic.
-- You can run this in the Supabase SQL Editor to set up your database.

-- 1. Users table (Extends Supabase Auth)
CREATE TABLE IF NOT EXISTS public."User" (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email text UNIQUE NOT NULL,
    display_name text,
    full_name text,
    m2PM text,
    "velocitiScore" numeric DEFAULT 100,
    "avgQcScore" numeric DEFAULT 100,
    active boolean DEFAULT true,
    project text,
    "shadowingStatus" text,
    "shadowingStartDate" timestamp with time zone,
    "endDate" timestamp with time zone,
    absences integer DEFAULT 0,
    "lateArrivals" integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- 2. Invoices
CREATE TABLE IF NOT EXISTS public."Invoice" (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "contractorName" text,
    "contractorEmail" text,
    "businessName" text,
    "fileName" text,
    "fileUrl" text,
    "mimeType" text,
    "invoiceDate" timestamp with time zone DEFAULT now(),
    "weekEndingDate" date,
    "totalAmount" numeric,
    "daysWorked" numeric,
    status text DEFAULT 'pending',
    "autoApproved" boolean DEFAULT false,
    "approvedBy" text,
    "approvedDate" timestamp with time zone,
    "approvalNotes" text,
    "pendingReason" text,
    "rejectionReason" text,
    "paymentStatus" text DEFAULT 'unpaid',
    "paymentDate" timestamp with time zone,
    "paymentMethod" text,
    "paymentReference" text,
    notes text,
    "driveFileId" text,
    "driveLink" text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- 3. Messaging - Channels
CREATE TABLE IF NOT EXISTS public."Channel" (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    description text,
    type text DEFAULT 'public',
    "createdByEmail" text,
    "isArchived" boolean DEFAULT false,
    "createdBy" uuid REFERENCES public."User"(id),
    created_at timestamp with time zone DEFAULT now()
);

-- 4. Channel Members
CREATE TABLE IF NOT EXISTS public."ChannelMember" (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "channelId" uuid REFERENCES public."Channel"(id) ON DELETE CASCADE,
    "userEmail" text,
    "userName" text,
    role text DEFAULT 'member',
    created_at timestamp with time zone DEFAULT now()
);

-- 5. Chat Messages
CREATE TABLE IF NOT EXISTS public."ChatMessage" (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "channelId" uuid REFERENCES public."Channel"(id) ON DELETE CASCADE,
    "dmThreadId" uuid,
    "userEmail" text,
    "userName" text,
    content text,
    "fileName" text,
    "fileUrl" text,
    created_at timestamp with time zone DEFAULT now()
);

-- 6. Direct Message Threads
CREATE TABLE IF NOT EXISTS public."DirectMessageThread" (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "participantEmails" text[],
    "participantNames" text[],
    created_at timestamp with time zone DEFAULT now()
);

-- 7. Channel Tasks
CREATE TABLE IF NOT EXISTS public."ChannelTask" (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "channelId" uuid REFERENCES public."Channel"(id) ON DELETE CASCADE,
    title text NOT NULL,
    "assignedToEmail" text,
    "assignedToName" text,
    status text DEFAULT 'open',
    "createdByEmail" text,
    "createdByName" text,
    "dueDate" timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- 8. DocuSign Templates
CREATE TABLE IF NOT EXISTS public."DocusignTemplate" (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text,
    "docusignTemplateId" text,
    created_at timestamp with time zone DEFAULT now()
);

-- 9. DocuSign Envelopes
CREATE TABLE IF NOT EXISTS public."DocusignEnvelope" (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "templateId" uuid REFERENCES public."DocusignTemplate"(id),
    "templateName" text,
    "recipientEmail" text,
    "recipientName" text,
    "docusignEnvelopeId" text,
    status text,
    "sentDate" timestamp with time zone,
    created_at timestamp with time zone DEFAULT now()
);

-- 10. Signature Requests
CREATE TABLE IF NOT EXISTS public."SignatureRequest" (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    status text DEFAULT 'Pending',
    "signedAt" timestamp with time zone,
    "signedPdfUrl" text,
    "signatureData" text,
    "typedName" text,
    "viewedAt" timestamp with time zone,
    created_at timestamp with time zone DEFAULT now()
);

-- 11. Compliance Records
CREATE TABLE IF NOT EXISTS public."WorkersCompRecord" (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "userEmail" text,
    "expirationDate" date,
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."SafetyCertification" (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "userEmail" text,
    "expirationDate" date,
    created_at timestamp with time zone DEFAULT now()
);

-- 12. Shadowing Checklists
CREATE TABLE IF NOT EXISTS public."ShadowingChecklist" (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "trainerEmail" text,
    "trainerName" text,
    "checklistToken" text,
    "workflowStatus" text DEFAULT 'draft',
    "sentToTrainerDate" timestamp with time zone,
    "contractorId" uuid REFERENCES public."User"(id),
    "data" jsonb,
    created_at timestamp with time zone DEFAULT now()
);

-- 13. Surveys
CREATE TABLE IF NOT EXISTS public."VeloSurvey" (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    status text DEFAULT 'Pending',
    "completedDate" timestamp with time zone,
    "surveyToken" text,
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."VeloSurveyResponse" (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "surveyId" uuid REFERENCES public."VeloSurvey"(id),
    "technicianId" uuid,
    "technicianName" text,
    "communicationSkills" integer,
    availability integer,
    comments text,
    created_at timestamp with time zone DEFAULT now()
);

-- 14. Contractor Documents
CREATE TABLE IF NOT EXISTS public."ContractorDocument" (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "contractorId" uuid REFERENCES public."User"(id),
    "driveFileId" text,
    "driveLink" text,
    "lastSyncedAt" timestamp with time zone,
    "uploadDate" timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now()
);

-- 15. Announcements
CREATE TABLE IF NOT EXISTS public."Announcement" (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "isActive" boolean DEFAULT true,
    title text NOT NULL,
    content text,
    created_at timestamp with time zone DEFAULT now()
);

-- 16. Automation Settings
CREATE TABLE IF NOT EXISTS public."AutomationSetting" (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    key text UNIQUE NOT NULL,
    value text,
    created_at timestamp with time zone DEFAULT now()
);

-- 17. Projects
CREATE TABLE IF NOT EXISTS public."Project" (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text UNIQUE NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now()
);

-- 18. Call Logs
CREATE TABLE IF NOT EXISTS public."CallLog" (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "technicianId" uuid REFERENCES public."User"(id),
    "callDate" timestamp with time zone DEFAULT now(),
    duration interval,
    notes text,
    created_at timestamp with time zone DEFAULT now()
);

-- Enable Row Level Security (RLS) as a best practice, though the app uses Service Role for many operations
-- ALTER TABLE public."User" ENABLE ROW LEVEL SECURITY;
-- ... add policies as needed

-- ============================================================
-- TABLES ADDED FROM ZIP SYNC (missing from original schema)
-- ============================================================

-- CorrectiveAction (auditing module)
CREATE TABLE IF NOT EXISTS public."CorrectiveAction" (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "auditId" uuid,
    "itemId" uuid,
    title text,
    description text,
    "ownerEmail" text,
    "assignedToEmail" text,
    status text DEFAULT 'Open',
    priority text DEFAULT 'Medium',
    "dueDate" timestamp with time zone,
    "completedDate" timestamp with time zone,
    "completionNotes" text,
    "createdByEmail" text,
    "createdAt" timestamp with time zone DEFAULT now(),
    "updatedAt" timestamp with time zone DEFAULT now()
);

-- SafetyHazardReport
CREATE TABLE IF NOT EXISTS public."SafetyHazardReport" (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "reportId" text,
    "submittedByName" text,
    "submittedByEmail" text,
    "contractorId" uuid,
    "assignedPmName" text,
    "assignedPmEmail" text,
    "projectName" text,
    "siteLocation" text,
    "hazardDate" date,
    "hazardTime" text,
    "hazardCategory" text,
    "hazardSeverity" text,
    "responseNeeded" text,
    description text,
    "activityAtTime" text,
    "immediateActionTaken" text,
    "workNeedsToStop" boolean DEFAULT false,
    "immediateDanger" boolean DEFAULT false,
    "workCanContinueSafely" text,
    "siteLeadershipNotified" boolean DEFAULT false,
    "whoWasNotified" text,
    witnesses text,
    "recommendedFix" text,
    "photoUrls" text[],
    "attachmentUrls" text[],
    "contractorAcknowledged" boolean DEFAULT false,
    "signatureName" text,
    status text DEFAULT 'Open - Standard',
    "adminNotes" text,
    "qcNotes" text,
    "followUpOwner" text,
    "correctiveActionRequired" boolean DEFAULT false,
    "correctiveActionDueDate" date,
    "rootCauseSummary" text,
    "resolutionSummary" text,
    "finalClosedDate" timestamp with time zone,
    "createdAt" timestamp with time zone DEFAULT now(),
    "updatedAt" timestamp with time zone DEFAULT now()
);

-- SafetyInjuryReport
CREATE TABLE IF NOT EXISTS public."SafetyInjuryReport" (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "reportId" text,
    "submittedByName" text,
    "submittedByEmail" text,
    "contractorId" uuid,
    "assignedPmName" text,
    "assignedPmEmail" text,
    "projectName" text,
    "siteLocation" text,
    "incidentDate" date,
    "incidentTime" text,
    "incidentType" text,
    injured boolean,
    "injuryType" text,
    "bodyPartAffected" text,
    "medicalTreatmentNeeded" boolean DEFAULT false,
    "emergencyCareNeeded" boolean DEFAULT false,
    "workStopped" boolean DEFAULT false,
    "incidentDescription" text,
    "taskBeingPerformed" text,
    "equipmentInvolved" text,
    "ppeUsed" boolean DEFAULT false,
    "ppeDetails" text,
    witnesses text,
    "supervisorNotified" boolean DEFAULT false,
    "timeReported" text,
    "immediateCorrectiveAction" text,
    "anyoneElseInvolved" boolean DEFAULT false,
    "propertyDamageInvolved" boolean DEFAULT false,
    "lostTimeExpected" text,
    "followUpNeeded" text,
    "photoUrls" text[],
    "attachmentUrls" text[],
    "contractorAcknowledged" boolean DEFAULT false,
    "signatureName" text,
    status text DEFAULT 'Submitted - Needs Review',
    "investigationNotes" text,
    "followUpOwner" text,
    "correctiveActionRequired" boolean DEFAULT false,
    "correctiveActionDueDate" date,
    "rootCauseSummary" text,
    "resolutionSummary" text,
    "finalClosedDate" timestamp with time zone,
    "createdAt" timestamp with time zone DEFAULT now(),
    "updatedAt" timestamp with time zone DEFAULT now()
);

-- SafetyLessonLearned
CREATE TABLE IF NOT EXISTS public."SafetyLessonLearned" (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "lessonId" text,
    title text NOT NULL,
    category text,
    "relatedProject" text,
    "relatedReportId" text,
    "incidentDate" date,
    "whatHappened" text,
    "howItHappened" text,
    "whatShouldHaveBeenDoneDifferently" text,
    "preventiveAction" text,
    "correctiveActionImplemented" text,
    "requiredPpeOrTrainingReminder" text,
    audience text DEFAULT 'All Contractors',
    "specificProjectName" text,
    status text DEFAULT 'Draft',
    "acknowledgmentRequired" boolean DEFAULT false,
    "addedBy" text,
    "updatedBy" text,
    "createdAt" timestamp with time zone DEFAULT now(),
    "updatedAt" timestamp with time zone DEFAULT now()
);

-- SafetyLessonAcknowledgment
CREATE TABLE IF NOT EXISTS public."SafetyLessonAcknowledgment" (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "lessonId" uuid REFERENCES public."SafetyLessonLearned"(id) ON DELETE CASCADE,
    "contractorId" uuid,
    "contractorEmail" text,
    "contractorName" text,
    "acknowledgedAt" timestamp with time zone DEFAULT now(),
    "createdAt" timestamp with time zone DEFAULT now()
);

-- SafetyCorrectiveAction
CREATE TABLE IF NOT EXISTS public."SafetyCorrectiveAction" (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "correctiveActionId" text,
    "linkedReportId" uuid,
    "linkedReportType" text,
    "projectName" text,
    "assignedTo" text,
    "actionRequired" text,
    "dueDate" date,
    priority text DEFAULT 'Medium',
    status text DEFAULT 'Open',
    "completionNotes" text,
    "completedDate" timestamp with time zone,
    "createdAt" timestamp with time zone DEFAULT now(),
    "updatedAt" timestamp with time zone DEFAULT now()
);

-- SafetySettings
CREATE TABLE IF NOT EXISTS public."SafetySettings" (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "qcUser1Email" text,
    "qcUser2Email" text,
    "adminNotificationEmail" text DEFAULT 'orville@m2fleetcom.com',
    "createdAt" timestamp with time zone DEFAULT now(),
    "updatedAt" timestamp with time zone DEFAULT now()
);

-- OnboardingCompletionRecord
CREATE TABLE IF NOT EXISTS public."OnboardingCompletionRecord" (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "contractorId" uuid REFERENCES public."User"(id),
    "contractorEmail" text,
    "documentId" uuid,
    "documentTitle" text,
    "acknowledgedAt" timestamp with time zone DEFAULT now(),
    "createdAt" timestamp with time zone DEFAULT now()
);

-- OnboardingDocument
CREATE TABLE IF NOT EXISTS public."OnboardingDocument" (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title text NOT NULL,
    description text,
    "fileUrl" text,
    "fileName" text,
    type text DEFAULT 'contractor_facing',
    "isRequired" boolean DEFAULT true,
    "sortOrder" numeric DEFAULT 0,
    "uploadedBy" text,
    "uploadDate" timestamp with time zone DEFAULT now(),
    "createdAt" timestamp with time zone DEFAULT now(),
    "updatedAt" timestamp with time zone DEFAULT now()
);

-- TechnicianMaster (aggregated view of User table for workforce)
CREATE TABLE IF NOT EXISTS public."TechnicianMaster" (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "technicianId" uuid REFERENCES public."User"(id),
    "technicianName" text,
    "technicianEmail" text,
    business text,
    project text,
    "qcAssignment" text,
    active boolean DEFAULT true,
    "createdAt" timestamp with time zone DEFAULT now(),
    "updatedAt" timestamp with time zone DEFAULT now()
);

-- Insert default safety settings if not exists
INSERT INTO public."SafetySettings" (id) 
SELECT gen_random_uuid() 
WHERE NOT EXISTS (SELECT 1 FROM public."SafetySettings" LIMIT 1);
