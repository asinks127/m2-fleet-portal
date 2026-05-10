import { supabase } from '../src/lib/supabaseClient';

// Helper to escape CSV fields
const escapeCsvField = (field) => {
    const str = String(field === null || field === undefined ? '' : field);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
};

// Helper to calculate tenure
const calculateTenure = (startDate) => {
    if (!startDate) return '';
    const start = new Date(startDate);
    const now = new Date();
    const diffTime = now - start;
    if (diffTime < 0) return 'Not Started'; 
    
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    const years = Math.floor(diffDays / 365);
    const months = Math.floor((diffDays % 365) / 30);
    
    if (years > 0) return `${years}y ${months}m`;
    if (months > 0) return `${months}m`;
    return `${diffDays}d`;
};

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(200).end();    
    try {
        if (!(await base44.auth.isAuthenticated())) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), {
                status: 401, headers: { 'Content-Type': 'application/json' }
            });
        }

        console.log('Exporting tech roster data...');

        const allUsers = await supabase.from('User').select('*');
        
        // Filter for contractors (active and inactive)
        const contractors = allUsers.filter(user => 
            user.email && (
                user.email.toLowerCase().includes('.contractor@m2fleetcom.com') ||
                user.email.toLowerCase().includes('.contractor@smcinstallations.com')
            )
        );

        console.log(`Found ${contractors.length} contractors to export`);

        // Define CSV headers - comprehensive list of all contractor fields
        const headers = [
            'Display Name',
            'Full Name',
            'Email',
            'Business Name',
            'Phone',
            'Location',
            'Project',
            'M2 PM',
            'Velo PM',
            'QC Assignment',
            'Weekly Pay',
            'Start Date',
            'Tenure',
            'End Date',
            'Active Status',
            'Inactive Date',
            'Inactive Reason',
            'Shadowing Status',
            'Shadowing Start Date',
            'Shadowing End Date',
            'Shadowing Notes',
            'Sunbelt Certification Status',
            'Sunbelt Cert Start Date',
            'Sunbelt Cert End Date',
            'Sunbelt Cert Notes',
            'Emergency Contact Name',
            'Emergency Contact Phone',
            'Emergency Contact Email',
            'Velociti Score',
            'Average QC Score',
            'Velo Survey Feedback',
            'Profile Complete',
            'Needs Invoice Review',
            'Invoice Review Reason',
            'Created Date',
            'Updated Date'
        ];

        // Map contractor data to CSV rows
        const csvRows = contractors.map(contractor => {
            const row = [
                contractor.displayName || '',
                contractor.full_name || '',
                contractor.email || '',
                contractor.business || '',
                contractor.phone || '',
                contractor.location || '',
                contractor.project || '',
                contractor.m2PM || '',
                contractor.veloPM || '',
                contractor.qcAssignment || '',
                contractor.weeklyPay || '',
                contractor.startDate ? new Date(contractor.startDate).toLocaleDateString() : '',
                calculateTenure(contractor.startDate),
                contractor.endDate ? new Date(contractor.endDate).toLocaleDateString() : '',
                contractor.active !== false ? 'Active' : 'Inactive',
                contractor.inactiveDate ? new Date(contractor.inactiveDate).toLocaleDateString() : '',
                contractor.inactiveReason || '',
                contractor.shadowingStatus || 'not_started',
                contractor.shadowingStartDate ? new Date(contractor.shadowingStartDate).toLocaleDateString() : '',
                contractor.shadowingEndDate ? new Date(contractor.shadowingEndDate).toLocaleDateString() : '',
                contractor.shadowingNotes || '',
                contractor.sunbeltCertificationStatus || 'not_required',
                contractor.sunbeltCertificationStartDate ? new Date(contractor.sunbeltCertificationStartDate).toLocaleDateString() : '',
                contractor.sunbeltCertificationEndDate ? new Date(contractor.sunbeltCertificationEndDate).toLocaleDateString() : '',
                contractor.sunbeltCertificationNotes || '',
                contractor.emergencyContactName || '',
                contractor.emergencyContactPhone || '',
                contractor.emergencyContactEmail || '',
                contractor.velocitiScore || '',
                contractor.avgQcScore || '',
                contractor.veloSurveyFeedback || '',
                contractor.profileComplete ? 'Yes' : 'No',
                contractor.needsInvoiceReview ? 'Yes' : 'No',
                contractor.invoiceReviewReason || '',
                contractor.created_date ? new Date(contractor.created_date).toLocaleDateString() : '',
                contractor.updated_date ? new Date(contractor.updated_date).toLocaleDateString() : ''
            ];
            
            return row.map(escapeCsvField).join(',');
        });

        // Combine headers and rows
        const csvContent = [headers.join(','), ...csvRows].join('\n');

        // Generate filename with current date
        const today = new Date().toISOString().split('T')[0];
        const filename = `tech-roster-${today}.csv`;

        return new Response(csvContent, {
            status: 200,
            headers: {
                'Content-Type': 'text/csv',
                'Content-Disposition': `attachment; filename="${filename}"`
            }
        });

    } catch (error) {
        console.error('Error exporting tech roster:', error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500, headers: { 'Content-Type': 'application/json' }
        });
    }
}
