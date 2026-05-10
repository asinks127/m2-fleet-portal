// Client-side function stubs that proxy to Vercel /api/ serverless endpoints
// Each function calls the server via fetch and returns the JSON response

const createFunctionProxy = (funcName) => async (data) => {
  const res = await fetch(`/api/${funcName}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data || {})
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => 'Unknown error');
    throw new Error(`Function ${funcName} failed: ${errText}`);
  }
  // Some endpoints might return non-JSON (e.g. PDF blobs)
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return res.json();
  }
  return res.blob();
};

// Export each function by name so pages can import { functionName } from '@/functions.js'
export const bulkUpdateScores = createFunctionProxy('bulkUpdateScores');
export const sendDocusignDocument = createFunctionProxy('sendDocusignDocument');
export const exportEmergencyContacts = createFunctionProxy('exportEmergencyContacts');
export const getMessages = createFunctionProxy('getMessages');
export const getMyTeamData = createFunctionProxy('getMyTeamData');
export const analyzeAtRiskTechnicians = createFunctionProxy('analyzeAtRiskTechnicians');
export const analyzeNegativeInteractions = createFunctionProxy('analyzeNegativeInteractions');
export const exportPaymentLedger = createFunctionProxy('exportPaymentLedger');
export const getSafetyAdminData = createFunctionProxy('getSafetyAdminData');
export const weeklyAISafetyMessages = createFunctionProxy('weeklyAISafetyMessages');
export const getShadowingChecklistData = createFunctionProxy('getShadowingChecklistData');
export const submitShadowingChecklist = createFunctionProxy('submitShadowingChecklist');
export const sendShadowingChecklist = createFunctionProxy('sendShadowingChecklist');
export const getSignatureRequestData = createFunctionProxy('getSignatureRequestData');
export const generateSignedPdf = createFunctionProxy('generateSignedPdf');
export const proxyPdf = createFunctionProxy('proxyPdf');
export const getVeloSurveyData = createFunctionProxy('getVeloSurveyData');
export const submitVeloSurveyResponse = createFunctionProxy('submitVeloSurveyResponse');
export const exportTechRoster = createFunctionProxy('exportTechRoster');
export const sendSurveyNotification = createFunctionProxy('sendSurveyNotification');
export const testEmail = createFunctionProxy('testEmail');
export const analyzeCallLog = createFunctionProxy('analyzeCallLog');
export const exportContractorReport = createFunctionProxy('exportContractorReport');
export const exportComplianceReport = createFunctionProxy('exportComplianceReport');
export const exportContractorInvoicesReport = createFunctionProxy('exportContractorInvoicesReport');
export const exportWeeklyReport = createFunctionProxy('exportWeeklyReport');
export const downloadWeeklySummary = createFunctionProxy('downloadWeeklySummary');
export const getComplianceDashboardData = createFunctionProxy('getComplianceDashboardData');
export const getContractorDocuments = createFunctionProxy('getContractorDocuments');
export const getQcBoardData = createFunctionProxy('getQcBoardData');
export const sendSignatureRequest = createFunctionProxy('sendSignatureRequest');
export const sendPerformanceAlert = createFunctionProxy('sendPerformanceAlert');
export const sendKanbanAlert = createFunctionProxy('sendKanbanAlert');
export const notifyTaskAssignment = createFunctionProxy('notifyTaskAssignment');
export const processInsuranceDocument = createFunctionProxy('processInsuranceDocument');
export const reassignM2PM = createFunctionProxy('reassignM2PM');
export const sendCorrectedComplianceReport = createFunctionProxy('sendCorrectedComplianceReport');
export const sendTaskReminders = createFunctionProxy('sendTaskReminders');
export const sendTestSummaryReport = createFunctionProxy('sendTestSummaryReport');
export const syncContractorDocuments = createFunctionProxy('syncContractorDocuments');
export const syncContractorDocumentsToDrive = createFunctionProxy('syncContractorDocumentsToDrive');
export const syncInvoicesToDrive = createFunctionProxy('syncInvoicesToDrive');
export const testDriveConnection = createFunctionProxy('testDriveConnection');
export const updatePaymentLedger = createFunctionProxy('updatePaymentLedger');
export const uploadToDrive = createFunctionProxy('uploadToDrive');
export const mondayMorningSummary = createFunctionProxy('mondayMorningSummary');
export const weeklyReminderScheduler = createFunctionProxy('weeklyReminderScheduler');
export const sendVeloSurvey = createFunctionProxy('sendVeloSurvey');
export const cleanupProjectData = createFunctionProxy('cleanupProjectData');
export const docusignWebhook = createFunctionProxy('docusignWebhook');
export const sendToWebhook = createFunctionProxy('sendToWebhook');
