import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { google } = require('googleapis');
const { createClient } = require('@supabase/supabase-js');
const { Readable } = require('node:stream');
const { Buffer } = require('node:buffer');

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const ROOT_FOLDER_ID = '0AG5XubOTYKLFUk9PVA';
const INVOICE_FOLDER = 'Contractor Invoices';

function getDriveClient() {
    let key = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
    if (!key) throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY missing');
    key = key.trim();
    if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) key = key.slice(1, -1);
    const credentials = JSON.parse(key);
    if (credentials.private_key) credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');
    return google.drive({ version: 'v3', auth: new google.auth.GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/drive'] }) });
}

const folderCache = {};
async function getOrCreateFolder(drive, name, parentId) {
    const ck = `${parentId}_${name}`;
    if (folderCache[ck]) return folderCache[ck];
    const q = `name='${name.replace(/'/g, "\\'")}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;
    const r = await drive.files.list({ q, fields: 'files(id)', spaces: 'drive', includeItemsFromAllDrives: true, supportsAllDrives: true });
    if (r.data.files.length) { folderCache[ck] = r.data.files[0].id; return r.data.files[0].id; }
    const c = await drive.files.create({ requestBody: { name, mimeType: 'application/vnd.google-apps.folder', parents: [parentId] }, fields: 'id', supportsAllDrives: true });
    folderCache[ck] = c.data.id;
    return c.data.id;
}

function webToNodeStream(ws) {
    if (!ws) return new Readable({ read() { this.push(null); } });
    const reader = ws.getReader();
    return new Readable({ async read() { try { const { done, value } = await reader.read(); done ? this.push(null) : this.push(Buffer.from(value)); } catch (e) { this.destroy(e); } } });
}

async function main() {
    const drive = getDriveClient();
    let synced = 0, failed = 0, skipped = 0;
    let offset = 0, total = 0;
    const typeFolderId = await getOrCreateFolder(drive, INVOICE_FOLDER, ROOT_FOLDER_ID);

    while (true) {
        const { data: page } = await supabase.from('Invoice').select('id, contractorName, invoiceDate, fileName, fileUrl, driveFileId')
            .match({ status: 'approved' }).order('created_date', { ascending: false }).range(offset, offset + 199);
        if (!page || page.length === 0) break;
        offset += 200;
        for (const inv of page) {
            total++;
            if (inv.driveFileId || !inv.fileUrl) { skipped++; continue; }
            try {
                const contractor = inv.contractorName || 'Unknown Contractor';
                const year = inv.invoiceDate ? new Date(inv.invoiceDate).getFullYear().toString() : new Date().getFullYear().toString();
                const contractorFolderId = await getOrCreateFolder(drive, contractor, typeFolderId);
                const yearFolderId = await getOrCreateFolder(drive, year, contractorFolderId);

                const fr = await fetch(inv.fileUrl);
                if (!fr.ok) throw new Error(`download ${fr.status}`);
                const buf = Buffer.from(await fr.arrayBuffer());

                const up = await drive.files.create({
                    requestBody: { name: inv.fileName || `invoice-${inv.id}.pdf`, parents: [yearFolderId] },
                    media: { mimeType: fr.headers.get('content-type') || 'application/octet-stream', body: Readable.from(buf) },
                    fields: 'id, webViewLink', supportsAllDrives: true
                });
                await supabase.from('Invoice').update({ driveFileId: up.data.id, driveLink: up.data.webViewLink }).eq('id', inv.id);
                synced++;
            } catch (e) {
                failed++;
                console.error(`FAIL ${inv.id}: ${e.message}`);
            }
        }
        console.log(`... scanned ${total} (synced ${synced}, failed ${failed}, skipped ${skipped})`);
    }
    console.log(`DONE total=${total} synced=${synced} failed=${failed} skipped(already-or-no-file)=${skipped}`);
}

main().catch(e => { console.error('FATAL', e); process.exit(1); });
