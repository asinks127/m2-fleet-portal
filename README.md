# M2 Fleet Communications Portal

A comprehensive fleet management and contractor portal for managing technicians, invoices, compliance, safety, and communications.

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

- **Frontend**: React + Vite + Tailwind CSS + shadcn/ui
- **Backend**: Supabase (PostgreSQL + Auth + Realtime)
- **AI**: Gemini API integration
- **Email**: Resend
- **Storage**: Google Drive integration
- **Document Signing**: DocuSign

## Environment Variables

Copy `.env.example` to `.env.local` and fill in your values:

```bash
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
RESEND_API_KEY=your_resend_key
GOOGLE_SERVICE_ACCOUNT_KEY=your_google_key
DOCUSIGN_INTEGRATION_KEY=your_docusign_key
GEMINI_API_KEY=your_gemini_key
```

## Development

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build
```

## Deployment

This app is configured for deployment on Zo Space. The Supabase connection handles:
- Authentication
- Database (PostgreSQL)
- Realtime subscriptions
- Storage

## Database Schema

See `supabase_schema.sql` for the complete database schema including:
- Users and roles
- Contractors and technicians
- Invoices and payments
- QC tasks and call logs
- Safety certifications
- Messages and channels
- Documents and signatures

## License

Private - M2 Communications
