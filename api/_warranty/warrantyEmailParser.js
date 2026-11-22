// Shared warranty email parsing logic, ported from the warranty app's
// base44/shared/warrantyEmailParser.ts (runs server-side on Node).
// The original used the Gmail REST API payload format; this port adds
// parseRawEmail() so IMAP-fetched RFC822 messages feed the same pipeline.

const PLACEHOLDER_NAMES = new Set(['john doe', 'john smith', 'jane doe', 'technician', 'unknown', 'not specified', 'pending', 'tbd', 'n/a', 'na']);

export function normalizeName(name) {
  return (name || '').toLowerCase().replace(/[^a-z\s]/g, '').trim().replace(/\s+/g, ' ');
}

export function isPlaceholderName(name) {
  if (!name) return true;
  const n = normalizeName(name);
  return PLACEHOLDER_NAMES.has(n) || n.length < 3;
}

export function extractFromSubject(subject) {
  const result = { subject_asset_number: '', subject_vendor: '' };
  const colonMatch = subject.match(/:\s*(\d+)\s*-\s*([^|]+)/);
  if (colonMatch) {
    result.subject_asset_number = colonMatch[1].trim();
    result.subject_vendor = colonMatch[2].trim();
  }
  return result;
}

export function formatDate(dateStr) {
  const match = dateStr?.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (match) {
    const [, m, d, y] = match;
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }
  return '';
}

export function extractFromBody(text) {
  const result = {
    work_order_name: '', technician_name: '', asset_number: '', install_service_date: '',
    make: '', model: '', year: '', installed_vin: '', equip_vin: '',
    remote_qc_notes: '', post_install_notes: '', case_number: '', site_location: '', project_manager: '',
    asset_type: ''
  };

  const techMatch = text.match(/Greetings\s+([^,\n]+)/i);
  if (techMatch) result.technician_name = techMatch[1].trim();

  const woMatch = text.match(/Work Order Name:\s*([^\n]+)/i);
  if (woMatch) result.work_order_name = woMatch[1].trim();

  const assetMatch = text.match(/Asset Number:\s*(\S+)/i);
  if (assetMatch) result.asset_number = assetMatch[1].trim();

  const makeMatch = text.match(/Make:\s*([^\t\n]+)/i);
  if (makeMatch) result.make = makeMatch[1].trim();

  const installMatch = text.match(/Install\/Service Date:\s*(\d{1,2}\/\d{1,2}\/\d{4})/i);
  if (installMatch) result.install_service_date = formatDate(installMatch[1]);

  const modelMatch = text.match(/Model:\s*([^\t\n]+)/i);
  if (modelMatch) result.model = modelMatch[1].trim();

  const installedVinMatch = text.match(/Installed VIN:\s*([^\t\n]+)/i);
  if (installedVinMatch) result.installed_vin = installedVinMatch[1].trim();

  const yearMatch = text.match(/Year:\s*(\d{4})/i);
  if (yearMatch) result.year = yearMatch[1].trim();

  const assetTypeMatch = text.match(/Asset Type:\s*(.*?)(?=\s*Equip VIN:|\n|$)/i);
  if (assetTypeMatch) result.asset_type = assetTypeMatch[1].trim();

  const equipVinMatch = text.match(/Equip VIN:[ \t]*([^\n\r]*)/i);
  if (equipVinMatch) result.equip_vin = equipVinMatch[1].trim();

  const qcMatch = text.match(/Remote QC Notes:\s*([\s\S]*?)(?=\nAsset Number:|\nPost Install Notes:|\nPlease coordinate|$)/i);
  if (qcMatch) result.remote_qc_notes = qcMatch[1].trim();

  const postMatch = text.match(/Post Install Notes:[ \t]*\r?\n?([\s\S]*?)(?=\n+Please coordinate|\n+Thanks|$)/i);
  if (postMatch) result.post_install_notes = postMatch[1].trim();

  const caseMatch = text.match(/Case Number:\s*(\S+)/i);
  if (caseMatch) result.case_number = caseMatch[1].trim();

  const siteMatch = text.match(/Site Location:\s*([^\n]+)/i);
  if (siteMatch) result.site_location = siteMatch[1].trim();

  const pmMatch = text.match(/Project Manager:\s*([^\n]+)/i);
  if (pmMatch) result.project_manager = pmMatch[1].trim();

  return result;
}

export function resolveFields(subjectData, bodyData) {
  let customer = '';
  if (bodyData.work_order_name && bodyData.work_order_name.includes(' - ')) {
    customer = bodyData.work_order_name.split(' - ')[0].trim();
  } else if (subjectData.subject_vendor) {
    customer = subjectData.subject_vendor;
  }
  const project = bodyData.work_order_name || '';
  const assetNumber = bodyData.asset_number || subjectData.subject_asset_number || '';
  const installDate = bodyData.install_service_date || '';
  const technician = bodyData.technician_name || '';
  return { customer, project, assetNumber, installDate, technician };
}

export function detectCategory(notes) {
  const n = (notes || '').toLowerCase();
  if (n.includes('camera')) return 'camera_positioning';
  if (n.includes('mirror')) return 'mirror_adjustment';
  if (n.includes('mount')) return 'mounting';
  if (n.includes('connection') || n.includes('bugged')) return 'connection_issue';
  if (n.includes('missing') || n.includes('not on vehicle')) return 'equipment_missing';
  return 'installation_quality';
}

export function getISOWeek(date) {
  const d = new Date(date);
  const jan1 = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil(((d - jan1) / 86400000 + jan1.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${String(week).padStart(2, '0')}`;
}

export function generateDedupeKey(customer, assetNumber, installDate, techName) {
  const c = (customer || '').toLowerCase().trim();
  const a = (assetNumber || '').toLowerCase().trim();
  const d = (installDate || '').trim();
  const t = (techName || '').toLowerCase().trim();
  const validFields = [c, a, d, t].filter(Boolean);
  if (validFields.length < 2) return null;
  return [c, a, d, t].filter(Boolean).join('|');
}

// Heuristic classifier, ported from the warranty app's backfillClassification
// priority rules. Used when GEMINI_API_KEY is not configured.
export function classifyNotes(notes) {
  const n = (notes || '').toLowerCase();
  if (!n) return { qc_category: 'Installation Quality', severity: 'medium', issue_weight: 1.75, is_documentation_only: false };
  const physical = /camera|mirror|mount|cable|rout|loose|secure|angle|position|wire|fuse|termination|connector/.test(n);
  const functional = /not working|not triggering|not detected|not reading|no data|not communicating|not activated|device missing/.test(n);
  const verification = /serial number mismatch|retest|re-verify|reverify|doesn'?t match|correct in app/.test(n);
  const photoOnly = /photo|image|screenshot|picture/.test(n) && !physical && !functional;
  if (functional) return { qc_category: 'Functional Failure', severity: 'critical', issue_weight: 3.0, is_documentation_only: false };
  if (physical) return { qc_category: 'Installation Quality', severity: 'high', issue_weight: 1.75, is_documentation_only: false };
  if (verification) return { qc_category: 'Verification Failure', severity: 'medium', issue_weight: 1.0, is_documentation_only: false };
  if (/fuse not visible|termination not shown|unclear wiring|adapter/.test(n)) return { qc_category: 'Install Risk', severity: 'medium', issue_weight: 0.75, is_documentation_only: false };
  if (photoOnly) return { qc_category: 'Documentation', severity: 'low', issue_weight: 0.25, is_documentation_only: true };
  return { qc_category: 'Installation Quality', severity: 'medium', issue_weight: 1.75, is_documentation_only: false };
}

export const REQUIRED_BODY_MARKERS = [
  'While reviewing your service we have found the following issue:',
  'Remote QC Notes:',
  'Asset Number:',
  'Install/Service Date:',
  'Work Order Name:',
  'Please coordinate with your Scheduler or Project Manager for repair.'
];

export function isOriginalWarrantyEmail(subject, body) {
  if (!subject.includes('Warranty Return Required:')) return false;
  for (const marker of REQUIRED_BODY_MARKERS) {
    if (!body.includes(marker)) return false;
  }
  return true;
}

export function isReplyOrForward(subject) {
  const s = (subject || '').trim().toLowerCase();
  return s.startsWith('re:') || s.startsWith('fw:') || s.startsWith('fwd:');
}

export function buildWarrantyTitle(assetNumber, techName, workOrderName) {
  if (assetNumber && techName) return `${assetNumber} - ${techName} - Warranty Return`;
  if (assetNumber && workOrderName) return `${assetNumber} - ${workOrderName} - Warranty Return`;
  return `Warranty Return - ${assetNumber || workOrderName || 'Unknown'}`;
}

export function detectStatusUpdate(body) {
  const b = body.toLowerCase();
  if (b.includes('repaired') || b.includes('repair complete') || b.includes('has been repaired')) return 'repaired';
  if (b.includes('approved') || b.includes('approval complete')) return 'repaired';
  if (b.includes('image review complete') || b.includes('images approved')) return 'repaired';
  if (b.includes('closed') || b.includes('issue closed')) return 'closed';
  return null;
}

// Convert an IMAP-fetched raw RFC822 message into the Gmail-API-shaped object
// the parser pipeline expects: { id, threadId, payload: { headers: [...], body... } }
export async function parseRawEmail(rawBuffer) {
  const { simpleParser } = await import('mailparser');
  const parsed = await simpleParser(rawBuffer);
  const headers = Object.entries(parsed.headers || {}).map(([name, value]) => ({
    name,
    value: Array.isArray(value) ? value.map(String).join(', ') : String(value?.text ?? value ?? ''),
  }));
  let text = parsed.text || '';
  if (!text && parsed.html) text = String(parsed.html).replace(/<[^>]+>/g, ' ');
  // Expose the extracted text via the same shape extractEmailText() would produce
  const message = {
    id: parsed.messageId || '',
    threadId: (parsed.headers.get('thread-index') || parsed.messageId || '').toString(),
    payload: {
      headers,
      mimeType: 'text/plain',
      body: { data: Buffer.from(text).toString('base64') },
      parts: [],
    },
  };
  const getHeader = (name) => headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || '';
  return { message, subject: parsed.subject || getHeader('subject'), from: getHeader('from'), date: getHeader('date'), messageId: parsed.messageId || getHeader('message-id'), text };
}
