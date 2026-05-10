// This function is now OBSOLETE as the workflow has changed.
// We will keep it but it's no longer called from the frontend.
// The new workflow assigns the survey and relies on the PM logging into their portal.


Deno.serve((req) => {
    console.log('=== OBSOLETE sendVeloSurvey function called ===');
    console.log('This function is no longer in use. Surveys are assigned via the Velo PM portal.');
    
    return new Response(JSON.stringify({
        success: false,
        error: 'This function is obsolete and should not be called. Please use the new Velo PM portal workflow.'
    }), {
        status: 410, // Gone
        headers: { 'Content-Type': 'application/json' }
    });
}
