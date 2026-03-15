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
