import { supabase } from '../src/lib/supabaseClient';
import { format } from 'npm:date-fns@2.30.0';

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(200).end();    
    try {
        console.log('Starting weekly AI safety message generation...');
        
        // Get current date and context
        const currentDate = new Date();
        const season = getSeason(currentDate);
        const currentMonth = currentDate.toLocaleString('default', { month: 'long' });
        const currentWeek = Math.ceil(currentDate.getDate() / 7);
        
        // Get recent safety messages to avoid repetition
        let recentMessages = [];
        let recentTopics = '';
        try {
            recentMessages = await base44.asServiceRole.entities.SafetyMessage.filter(
                { publishDate: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString() } },
                '-publishDate',
                4
            );
            recentTopics = recentMessages.map(msg => msg.title).join(', ');
        } catch (recentError) {
            console.warn('Could not fetch recent messages:', recentError);
        }
        
        // Get active contractors count for context
        let eligibleContractors = [];
        try {
            // Using null for sort to ensure compatibility
            const allUsers = await base44.asServiceRole.entities.User.list(null, 1000);
            
            eligibleContractors = allUsers.filter(user => 
                user && user.active !== false &&
                user.email && (
                    user.email.toLowerCase().includes('.contractor@m2fleetcom.com') ||
                    user.email.toLowerCase().includes('.contractor@smcinstallations.com')
                )
            );
        } catch (userError) {
            console.warn('Could not fetch users, using fallback:', userError);
            eligibleContractors = []; // Will use fallback count in AI prompt
        }
        
        const contractorCount = eligibleContractors.length || 'several';
        
        // Create fallback content first (in case AI fails)
        const fallbackContent = {
            title: `${season} Safety Focus - Week of ${format(currentDate, 'MMM d, yyyy')}`,
            content: `Team,

This week, let's focus on staying safe in our ${season.toLowerCase()} work environment.

Key Safety Reminders:
• Always wear appropriate PPE for the current conditions
• Be aware of ${getSeasonalHazards(season)}
• Follow proper ladder safety and fall protection procedures
• Take regular breaks and stay hydrated
• Report any safety concerns or near-misses immediately

Remember: Your safety is our top priority. Take the time to work safely, and don't hesitate to speak up if you see something that doesn't look right.

Stay safe out there!

M2 Fleet Safety Team`,
            category: "General Safety"
        };
        
        // Try to generate AI content with rate limit handling
        let aiResponse = fallbackContent; // Default to fallback
        
        try {
            console.log('Attempting AI content generation...');
            
            const aiPrompt = `Generate a comprehensive weekly safety message for field service technicians working on telecommunications and fleet installations.

Current context:
- Date: ${currentDate.toDateString()}
- Season: ${season}
- Month: ${currentMonth}
- Week ${currentWeek} of the month
- Active technicians: ${contractorCount}
- Recent topics covered: ${recentTopics || 'None recently'}

Please create a fresh, engaging safety message that:
1. Has a compelling, specific title
2. Addresses current seasonal safety concerns
3. Includes 3-4 actionable safety tips
4. Contains a relevant real-world scenario
5. Ends with a clear safety commitment
6. Avoids repeating recent topics if any were provided

Focus on ${getSeasonalFocus(season)} safety concerns.

Make it practical, authoritative but approachable, and immediately applicable to field work.`;

            // Add a small delay to help with rate limits
            await new Promise(resolve => setTimeout(resolve, 1000));

            const aiResult = await /* TODO: Implement Google Gemini AI Call */ gemini.generateContent({
                prompt: aiPrompt,
                response_json_schema: {
                    type: "object",
                    properties: {
                        title: { type: "string" },
                        content: { type: "string" },
                        category: { type: "string" }
                    }
                }
            });
            
            // Validate AI response
            if (aiResult && aiResult.title && aiResult.content) {
                aiResponse = {
                    title: aiResult.title,
                    content: aiResult.content,
                    category: aiResult.category || 'General Safety'
                };
                console.log('AI content generated successfully');
            } else {
                console.warn('AI returned incomplete response, using fallback');
            }
            
        } catch (aiError) {
            console.warn('AI generation failed, using fallback content:', aiError.message);
            // aiResponse is already set to fallbackContent
        }
        
        // Save the new message
        let newSafetyMessage;
        try {
            newSafetyMessage = await supabase.from('SafetyMessage').insert({
                title: aiResponse.title,
                content: aiResponse.content,
                publishDate: new Date().toISOString(),
                isMonthly: false,
                isActive: true,
                category: aiResponse.category || 'General Safety'
            });
            
            console.log('Safety message created:', newSafetyMessage.title);
        } catch (createError) {
            console.error('Failed to create safety message:', createError);
            throw new Error(`Could not create safety message: ${createError.message}`);
        }
        
        // Send email to all active contractors
        const contractorEmails = eligibleContractors.map(user => user.email).filter(Boolean);
        let emailsSent = 0;
        let emailErrors = [];
        
        if (contractorEmails.length > 0) {
            console.log(`Sending emails to ${contractorEmails.length} contractors...`);
            
            // Send emails in smaller batches to avoid overwhelming the system
            // Reduced batch size to prevent rate limiting
            const batchSize = 5;
            for (let i = 0; i < contractorEmails.length; i += batchSize) {
                const batch = contractorEmails.slice(i, i + batchSize);
                
                const batchPromises = batch.map(async (email) => {
                    try {
                        const emailBody = `
                            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
                                <div style="background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); color: white; padding: 20px; text-align: center;">
                                    <h1 style="margin: 0; font-size: 24px;">🛡️ Weekly Safety Message</h1>
                                    <p style="margin: 10px 0 0 0; opacity: 0.9;">${format(currentDate, 'MMMM d, yyyy')}</p>
                                </div>
                                
                                <div style="padding: 30px 20px;">
                                    <h2 style="color: #1e3a8a; margin-top: 0;">${aiResponse.title}</h2>
                                    
                                    <div style="background: #f8fafc; border-left: 4px solid #3b82f6; padding: 20px; margin: 20px 0; font-size: 16px; line-height: 1.6;">
                                        ${aiResponse.content.replace(/\n/g, '<br>')}
                                    </div>
                                    
                                    <div style="background: #fff1f2; border: 1px solid #ffdde1; border-radius: 8px; padding: 15px; margin: 20px 0; text-align: center;">
                                        <p style="margin: 0; color: #be123c; font-weight: bold;">
                                            ⚠️ Acknowledgment Required
                                        </p>
                                        <p style="margin: 10px 0 0 0; color: #881337; font-size: 14px;">
                                            Please log into the M2 Fleet Portal to acknowledge you have read and understood this message.
                                        </p>
                                    </div>
                                </div>
                                
                                <div style="background: #f1f5f9; padding: 20px; text-align: center; border-top: 1px solid #e2e8f0;">
                                    <p style="margin: 0; color: #64748b; font-size: 14px;">
                                        Stay safe out there! Your safety is our priority.
                                    </p>
                                    <p style="margin: 10px 0 0 0; color: #64748b; font-size: 12px;">
                                        M2 Fleet Management | Safety Department
                                    </p>
                                </div>
                            </div>
                        `;
                        
                        await /* TODO: Setup Resend */ resend.emails.send({
                            to: email,
                            subject: `🛡️ Weekly Safety Message: ${aiResponse.title}`,
                            body: emailBody,
                            from_name: 'M2 Fleet Safety Team'
                        });
                        
                        return { email, success: true };
                    } catch (emailError) {
                        console.error(`Failed to send email to ${email}:`, emailError);
                        return { email, success: false, error: emailError.message };
                    }
                });
                
                const batchResults = await Promise.allSettled(batchPromises);
                
                batchResults.forEach(result => {
                    if (result.status === 'fulfilled') {
                        if (result.value.success) {
                            emailsSent++;
                        } else {
                            emailErrors.push(result.value);
                        }
                    } else {
                        emailErrors.push({ email: 'unknown', error: result.reason });
                    }
                });
                
                // Increased delay between batches to respect rate limits
                if (i + batchSize < contractorEmails.length) {
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }
            }
            
            console.log(`Email sending complete: ${emailsSent}/${contractorEmails.length} sent successfully`);
            if (emailErrors.length > 0) {
                console.warn(`${emailErrors.length} email failures:`, emailErrors);
            }
        } else {
            console.warn('No contractor emails found to send to');
        }
        
        return new Response(JSON.stringify({
            success: true,
            message: 'Weekly AI safety message generated and sent',
            safetyMessage: {
                title: newSafetyMessage.title,
                category: newSafetyMessage.category,
                recipientCount: emailsSent,
                totalContractors: contractorEmails.length,
                emailErrors: emailErrors.length
            }
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
        
    } catch (error) {
        console.error('Error in weekly AI safety messages:', error);
        return new Response(JSON.stringify({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
});

function getSeason(date) {
    const month = date.getMonth();
    if (month >= 2 && month <= 4) return 'Spring';
    if (month >= 5 && month <= 7) return 'Summer';
    if (month >= 8 && month <= 10) return 'Fall';
    return 'Winter';
}

function getSeasonalFocus(season) {
    const focuses = {
        'Winter': 'cold weather safety, ice hazards, reduced visibility, proper winter gear',
        'Spring': 'wet conditions, equipment maintenance after winter, increased outdoor activity',
        'Summer': 'heat safety, UV protection, hydration, working in high temperatures',
        'Fall': 'variable weather conditions, early darkness, preparation for winter conditions'
    };
    return focuses[season] || 'general field safety';
}

function getSeasonalHazards(season) {
    const hazards = {
        'Winter': 'icy surfaces, cold-related injuries, and reduced daylight hours',
        'Spring': 'wet and slippery surfaces, unpredictable weather changes',
        'Summer': 'heat exhaustion, dehydration, and UV exposure',
        'Fall': 'wet leaves, early darkness, and changing weather patterns'
    };
    return hazards[season] || 'seasonal hazards and changing conditions';
}