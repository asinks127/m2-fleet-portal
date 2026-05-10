import fs from 'fs';
import path from 'path';

const filesToFix = [
  'analyzeNegativeInteractions.js',
  'bulkUpdateScores.js',
  'cleanupProjectData.js',
  'downloadWeeklySummary.js',
  'exportEmergencyContacts.js',
  'exportTechRoster.js',
  'extractData.js',
  'generateImage.js',
  'generateSignedPdf.js',
  'getContractorDocuments.js',
  'getSignatureRequestData.js',
  'invokeLLM.js',
  'mondayMorningSummary.js',
  'notifyTaskAssignment.js',
  'processInsuranceDocument.js',
  'proxyPdf.js',
  'sendCorrectedComplianceReport.js',
  'sendDocusignDocument.js',
  'sendEmail.js',
  'sendKanbanAlert.js',
  'sendPerformanceAlert.js',
  'sendSMS.js',
  'sendShadowingChecklist.js',
  'sendSurveyNotification.js',
  'sendTestSummaryReport.js',
  'sendToWebhook.js',
  'sendVeloSurvey.js',
  'syncContractorDocumentsToDrive.js',
  'weeklyAISafetyMessages.js',
  'weeklyReminderScheduler.js'
];

const authImport = `import { getAuthUser } from './_lib/supabaseServer.js';\n`;
const authCheck = `  const user = await getAuthUser(req);\n  if (!user) return res.status(401).json({ error: 'Unauthorized' });\n\n`;

let fixed = 0;
let skipped = 0;

for (const file of filesToFix) {
  const filePath = path.join('/home/workspace/M23FOR3-15', file);
  
  try {
    let content = fs.readFileSync(filePath, 'utf-8');
    
    // Skip if already has auth
    if (content.includes('getAuthUser')) {
      console.log(`✓ ${file} - already has auth`);
      skipped++;
      continue;
    }
    
    // Add import at top if not present
    if (!content.includes("from './_lib/supabaseServer.js'")) {
      // Find first import line
      const importMatch = content.match(/^import .* from .*;$/m);
      if (importMatch) {
        content = content.replace(importMatch[0], authImport + importMatch[0]);
      } else {
        content = authImport + content;
      }
    }
    
    // Add auth check after OPTIONS check
    if (content.includes('if (req.method === "OPTIONS")') || content.includes("if (req.method === 'OPTIONS')")) {
      // Find the line after OPTIONS check
      const lines = content.split('\n');
      let insertIndex = -1;
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('OPTIONS') && lines[i].includes('return res.status(200)')) {
          insertIndex = i + 1;
          // Skip blank lines and other early returns
          while (insertIndex < lines.length && (lines[insertIndex].trim() === '' || lines[insertIndex].includes('if (req.method'))) {
            insertIndex++;
          }
          break;
        }
      }
      
      if (insertIndex > 0) {
        lines.splice(insertIndex, 0, authCheck);
        content = lines.join('\n');
      }
    } else if (content.includes('export default async function handler')) {
      // Insert after function declaration
      const handlerStart = content.indexOf('export default async function handler');
      const braceIndex = content.indexOf('{', handlerStart);
      const insertPos = braceIndex + 1;
      content = content.slice(0, insertPos) + '\n' + authCheck + content.slice(insertPos);
    }
    
    fs.writeFileSync(filePath, content);
    console.log(`✅ ${file} - FIXED`);
    fixed++;
    
  } catch (err) {
    console.log(`❌ ${file} - ERROR: ${err.message}`);
  }
}

console.log(`\n=== SUMMARY ===`);
console.log(`Fixed: ${fixed}`);
console.log(`Skipped: ${skipped}`);
