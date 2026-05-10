import { supabase, getAuthUser } from './_lib/supabaseServer.js';
import { format, parseISO, isWithinInterval, endOfDay } from 'date-fns';

// Helper to escape CSV fields
const escapeCsvField = (field) => {
    const str = String(field === null || field === undefined ? '' : field);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
};

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });    
    try {
        if (!(await getAuthUser(req))) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { startDate, endDate } = req.body;

        if (!startDate || !endDate) {
            return res.status(400).json({ error: 'Start date and end date are required.' });
        }

        // Parse the date range and set time correctly
        const rangeStart = parseISO(startDate);
        const rangeEnd = endOfDay(parseISO(endDate)); // FIX: Set to the end of the specified day

        console.log(`Reporting for submission date range: ${format(rangeStart, 'MMM d, yyyy HH:mm:ss')} to ${format(rangeEnd, 'MMM d, yyyy HH:mm:ss')}`);
        
        // Fetch data
        const [allUsers, allInvoices] = await Promise.all([
            supabase.from('User').select('*'),
            supabase.from('Invoice').select('*').order('created_date', { ascending: false }).limit(5000).then(r => r.data || []) // Get a large set for filtering
        ]);

        // Get active contractors
        const activeContractors = allUsers.filter(user => 
            user.active !== false && 
            user.email && 
            (user.email.toLowerCase().includes('.contractor@m2fleetcom.com') || 
             user.email.toLowerCase().includes('.contractor@smcinstallations.com'))
        );

        // FIXED: Filter invoices by SUBMISSION DATE (created_date) not weekEndingDate
        const submittedInvoices = allInvoices.filter(invoice => {
            if (!invoice.created_date) return false;
            try {
                const invoiceSubmissionDate = parseISO(invoice.created_date);
                return isWithinInterval(invoiceSubmissionDate, { start: rangeStart, end: rangeEnd });
            } catch (error) {
                console.warn(`Invalid created_date for invoice ${invoice.id}: ${invoice.created_date}`);
                return false;
            }
        });

        console.log(`Found ${activeContractors.length} active contractors, ${submittedInvoices.length} invoices submitted in the date range`);

        // Create a map of submitted invoices by contractor email
        const invoicesByContractor = new Map();
        submittedInvoices.forEach(invoice => { // Use submittedInvoices here
            const email = invoice.contractorEmail?.toLowerCase().trim(); // MODIFIED LINE
            if (email) {
                if (!invoicesByContractor.has(email)) {
                    invoicesByContractor.set(email, []);
                }
                invoicesByContractor.get(email).push(invoice);
            }
        });

        // NEW: Separate contractors by company and then by business
        const contractorsByCompanyAndBusiness = {
            'SMC INSTALLATIONS': {},
            'M2 FLEET COMMUNICATIONS': {}
        };

        activeContractors.forEach(contractor => {
            const business = contractor.business || 'Unknown Business';
            
            // FIXED: Determine company based on project field OR email domain
            let isSmcContractor = false;
            
            // Check if project is VLOCAL first (highest priority)
            if (contractor.project?.toLowerCase().includes('vlocal')) {
                isSmcContractor = true;
            }
            // Specific exception: Andres Arguello goes to M2 Fleet
            else if (contractor.email?.toLowerCase() === 'aarguello.contractor@smcinstallations.com') {
                isSmcContractor = false; // Force to M2 Fleet
            }
            // Check specific email exceptions
            else if (contractor.email?.toLowerCase() === 'mmclaughlin.contractor@m2fleetcom.com') {
                isSmcContractor = true;
            }
            // Fall back to email domain check
            else {
                isSmcContractor = contractor.email?.toLowerCase().includes('.contractor@smcinstallations.com');
            }
            
            const companySection = isSmcContractor ? 'SMC INSTALLATIONS' : 'M2 FLEET COMMUNICATIONS';
            
            if (!contractorsByCompanyAndBusiness[companySection][business]) {
                contractorsByCompanyAndBusiness[companySection][business] = [];
            }
            contractorsByCompanyAndBusiness[companySection][business].push(contractor);
        });

        // Prepare CSV data
        const csvData = [];
        
        // Header row
        csvData.push([
            'Business Name',
            'Contractor Name', 
            'Invoice Number',
            'Submission Date', // Changed from 'Invoice Date'
            'Invoice Amount',
            'Status',
            'Week Ending Date'
        ]);

        let invoiceNumber = 1; // Sequential invoice numbering

        // Process each company section (SMC first, then M2)
        const companySections = ['SMC INSTALLATIONS', 'M2 FLEET COMMUNICATIONS'];
        
        companySections.forEach((companyName, companyIndex) => {
            const businessesInCompany = contractorsByCompanyAndBusiness[companyName];
            
            if (Object.keys(businessesInCompany).length === 0) return; // Skip if no contractors in this company
            
            // Add company header
            csvData.push(['', '', '', '', '', '', '']);
            csvData.push([`=== ${companyName} ===`, '', '', '', '', '', '']);
            csvData.push(['', '', '', '', '', '', '']);

            // Sort businesses alphabetically within the company
            const sortedBusinesses = Object.keys(businessesInCompany).sort();

            sortedBusinesses.forEach(business => {
                // Add business header row
                csvData.push([business.toUpperCase(), '', '', '', '', '', '']);
                
                // Sort contractors within business
                const contractors = businessesInCompany[business].sort((a, b) => 
                    (a.displayName || a.full_name || '').localeCompare(b.displayName || b.full_name || '')
                );

                contractors.forEach(contractor => {
                    const contractorInvoices = invoicesByContractor.get(contractor.email?.toLowerCase()) || [];
                    
                    if (contractorInvoices.length > 0) {
                        // Show each submitted invoice
                        contractorInvoices.forEach(invoice => {
                            csvData.push([
                                '', // Empty business name for contractor rows
                                contractor.displayName || contractor.full_name || 'Unknown',
                                invoiceNumber.toString(),
                                format(parseISO(invoice.created_date), 'MM/dd/yyyy'), // Always Submission date
                                `$${(invoice.totalAmount || 0).toFixed(2)}`,
                                invoice.status || 'pending',
                                invoice.weekEndingDate ? format(parseISO(invoice.weekEndingDate), 'MM/dd/yyyy') : 'N/A'
                            ]);
                            invoiceNumber++;
                        });
                    } else {
                        // Show missing contractor with $0.00
                        csvData.push([
                            '', // Empty business name for contractor rows
                            contractor.displayName || contractor.full_name || 'Unknown',
                            'N/A',
                            'NOT SUBMITTED',
                            '$0.00',
                            'missing',
                            'N/A'
                        ]);
                    }
                });
                
                // Add empty row between businesses for readability
                csvData.push(['', '', '', '', '', '', '']);
            });
        });

        // Calculate totals
        const totalSubmitted = submittedInvoices.reduce((sum, inv) => sum + (inv.totalAmount || 0), 0);
        const submittedCount = submittedInvoices.length;
        const contractorsWhoSubmitted = Array.from(invoicesByContractor.keys()).length;
        const missingCount = activeContractors.length - contractorsWhoSubmitted;

        // Count contractors by company for summary
        const smcContractors = activeContractors.filter(c => 
            (c.project?.toLowerCase().includes('vlocal')) || // VLOCAL always SMC
            (c.email?.toLowerCase() === 'mmclaughlin.contractor@m2fleetcom.com') || // Specific email exception
            (c.email?.toLowerCase() !== 'aarguello.contractor@smcinstallations.com' && // Andres exception
             c.email?.toLowerCase().includes('.contractor@smcinstallations.com'))
        ).length;
        const m2Contractors = activeContractors.filter(c => 
            !(c.project?.toLowerCase().includes('vlocal')) && // If not VLOCAL
            !(c.email?.toLowerCase() === 'mmclaughlin.contractor@m2fleetcom.com') && // And not specific email exception
            (c.email?.toLowerCase() === 'aarguello.contractor@smcinstallations.com' || // Andres exception OR
             c.email?.toLowerCase().includes('.contractor@m2fleetcom.com')) // M2 email
        ).length;

        // Add summary at the end
        csvData.push(['', '', '', '', '', '', '']);
        csvData.push(['SUMMARY', '', '', '', '', '', '']);
        csvData.push(['Report Period', `${format(rangeStart, 'MMM d, yyyy')} - ${format(rangeEnd, 'MMM d, yyyy')}`, '', '', '', '', '']);
        csvData.push(['SMC Installations Contractors', smcContractors.toString(), '', '', '', '', '']);
        csvData.push(['M2 Fleet Communications Contractors', m2Contractors.toString(), '', '', '', '', '']);
        csvData.push(['Total Active Contractors', activeContractors.length.toString(), '', '', '', '', '']);
        csvData.push(['Contractors Who Submitted', contractorsWhoSubmitted.toString(), '', '', '', '', '']);
        csvData.push(['Contractors Missing', missingCount.toString(), '', '', '', '', '']);
        csvData.push(['Total Invoices Submitted', submittedCount.toString(), '', '', '', '', '']);
        csvData.push(['Total Amount Submitted', `$${totalSubmitted.toFixed(2)}`, '', '', '', '', '']);
        csvData.push(['Report Generated', format(new Date(), 'MM/dd/yyyy h:mm a'), '', '', '', '', '']);

        // Convert to CSV format
        const csvContent = csvData.map(row => 
            row.map(field => escapeCsvField(field)).join(',')
        ).join('\n');

        return new Response(csvContent, {
            status: 200,
            headers: {
                'Content-Type': 'text/csv',
                'Content-Disposition': `attachment; filename="invoice-report-submission-${startDate}-to-${endDate}.csv"`
            }
        });

    } catch (error) {
        console.error('Error generating invoice report:', error);
        return res.status(500).json({ error: "An unexpected error occurred. Please try again later." });
    }
}
