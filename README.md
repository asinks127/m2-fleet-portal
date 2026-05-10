# M2 Fleet Portal

A comprehensive fleet management and contractor portal for M2 Communications, rebuilt for Zo Cloud hosting.

## Features

- **Dashboard**: Admin and contractor dashboards with key metrics
- **Invoice Management**: Submit, review, and approve invoices with compliance checks
- **QC Board**: Kanban-style quality control board for managing technician tasks
- **Safety Admin**: Manage certifications, workers comp, and safety messages
- **Messaging**: Team messaging with channels and direct messages
- **Calendar**: Event scheduling and management
- **Document Signing**: DocuSign integration for contractor document signing
- **Reports**: Various compliance, performance, and financial reports
- **Recruiting**: Job posting and candidate management
- **Velo Surveys**: Customer satisfaction surveys

## Tech Stack

- **Frontend**: React 18 + Vite + Tailwind CSS + shadcn/ui
- **Backend**: Bun + Hono server with API routes
- **Database**: Supabase (PostgreSQL + Auth + Realtime)
- **AI**: Gemini API integration
- **Email**: Resend
- **Storage**: Google Drive integration
- **Document Signing**: DocuSign

## Supabase Tables

The app uses these Supabase tables:
- `User` - users, contractors, admins, PMs with performance fields
- `Invoice` - invoice uploads, approval workflow, payment status
- `Project` - project names/descriptions
- `Channel`, `ChannelMember`, `ChatMessage`, `DirectMessageThread` - messaging
- `SafetyCertification`, `WorkersCompRecord`, `SafetyMessage` - compliance
- `QCInspection`, `CallLog`, `PerformanceScore` - QC/performance
- `ContractorDocument`, `SignatureRequest`, `DocusignEnvelope` - documents
- `VeloSurvey`, `VeloSurveyResponse` - surveys
- And many more (see `src/lib/supabaseClient.js`)

## Development

```bash
# Install dependencies
bun install

# Start dev server
bun run dev

# Build for production
bun run build
```

## Environment Variables

Create a `.env.local` file with:

```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_service_role_key
```

## Deployment

This app is configured for deployment on Zo Cloud. The site runs on a managed server with automatic reload.

## GitHub Repository

https://github.com/asinks127/m2-fleet-portal

## License

Private - M2 Communications
