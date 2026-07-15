import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient.js';
import {
  getTemplates, createTemplate, deleteTemplate, getTemplate,
  getDocuments, createDocument, getDocument, voidDocument, resendToRecipient,
  getAuditLog, getSettings, updateSettings, uploadSignedPdf, getPdfBytes,
  getContractors, getSignedPdfUrl,
} from '@/lib/documentSigning/esignService.js';
import { FIELD_TYPES, DOCUMENT_STATUS, SIGNER_STATUS } from '@/lib/documentSigning/models.js';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import {
  FileText, Upload, Send, Trash2, Eye, Plus, X, Clock, CheckCircle2,
  AlertCircle, Ban, Mail, RefreshCw, Download, User, Settings as SettingsIcon,
  Layers, Loader2, Search,
} from 'lucide-react';

const STATUS_BADGE = {
  [DOCUMENT_STATUS.DRAFT]:     { label: 'Draft',     cls: 'bg-gray-100 text-gray-700' },
  [DOCUMENT_STATUS.SENT]:      { label: 'Sent',      cls: 'bg-blue-100 text-blue-700' },
  [DOCUMENT_STATUS.COMPLETED]: { label: 'Completed', cls: 'bg-green-100 text-green-700' },
  [DOCUMENT_STATUS.VOIDED]:    { label: 'Voided',    cls: 'bg-red-100 text-red-700' },
  [DOCUMENT_STATUS.DECLINED]:  { label: 'Declined',  cls: 'bg-orange-100 text-orange-700' },
};

const RECIPIENT_BADGE = {
  [SIGNER_STATUS.PENDING]:   { label: 'Pending',   cls: 'bg-gray-100 text-gray-600' },
  [SIGNER_STATUS.SENT]:      { label: 'Sent',      cls: 'bg-blue-100 text-blue-700' },
  [SIGNER_STATUS.VIEWED]:    { label: 'Viewed',    cls: 'bg-yellow-100 text-yellow-700' },
  [SIGNER_STATUS.SIGNED]:    { label: 'Signed',    cls: 'bg-green-100 text-green-700' },
  [SIGNER_STATUS.DECLINED]:  { label: 'Declined',  cls: 'bg-red-100 text-red-700' },
};

const SIGNING_PAGE_BASE = window.location.origin + '/sign';

export default function DocumentsAdmin() {
  const [tab, setTab] = useState('documents');
  const [templates, setTemplates] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [contractors, setContractors] = useState([]);
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showSendModal, setShowSendModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(null);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (type, message) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [tmpls, docs, ctrs, sett] = await Promise.all([
        getTemplates().catch(() => []),
        getDocuments().catch(() => []),
        getContractors().catch(() => []),
        getSettings().catch(() => ({})),
      ]);
      setTemplates(tmpls);
      setDocuments(docs);
      setContractors(ctrs);
      setSettings(sett);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const filteredDocs = useMemo(() => {
    return documents.filter((d) => {
      if (statusFilter !== 'all' && d.status !== statusFilter) return false;
      if (search && !d.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [documents, statusFilter, search]);

  const stats = useMemo(() => ({
    total: documents.length,
    sent: documents.filter((d) => d.status === DOCUMENT_STATUS.SENT).length,
    completed: documents.filter((d) => d.status === DOCUMENT_STATUS.COMPLETED).length,
    pending: documents.filter((d) => d.status === DOCUMENT_STATUS.SENT).reduce((acc, d) =>
      acc + (d.esign_recipients || []).filter((r) => r.status !== SIGNER_STATUS.SIGNED).length, 0),
  }), [documents]);

  // ---- Handlers ----
  const handleVoid = async (docId, reason) => {
    setBusy(true);
    try {
      await voidDocument(docId, reason);
      showToast('success', 'Document voided.');
      await refresh();
    } catch (e) { showToast('error', e.message); }
    finally { setBusy(false); }
  };

  const handleResend = async (recipientId) => {
    setBusy(true);
    try {
      const recip = await resendToRecipient(recipientId);
      const signingUrl = `${SIGNING_PAGE_BASE}/${recip.document_id}/${recip.token_hash}`;
      const resp = await fetch('https://austin1.zo.space/api/esign-send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({
          to: recip.email,
          subject: `Reminder: ${recip.esign_documents?.name || 'Document'} needs your signature`,
          fromName: settings.default_from_name || 'M2 Fleet',
          signingUrl,
          recipientName: recip.name,
          message: recip.esign_documents?.email_message || '',
        }),
      });
      if (!resp.ok) throw new Error('Email send failed');
      showToast('success', `Reminder sent to ${recip.email}`);
    } catch (e) { showToast('error', e.message); }
    finally { setBusy(false); }
  };

  const handleDownloadSigned = async (docId) => {
    setBusy(true);
    try {
      const url = await getSignedPdfUrl(docId);
      if (!url) throw new Error('No signed PDF available yet');
      const a = document.createElement('a');
      a.href = url; a.download = 'signed-document.pdf'; a.target = '_blank';
      a.click();
    } catch (e) { showToast('error', e.message); }
    finally { setBusy(false); }
  };

  const handleGenerateSignedPdf = async (docId) => {
    setBusy(true);
    try {
      const doc = await getDocument(docId);
      if (!doc.pdf_storage_path) throw new Error('No original PDF found');
      const pdfBytes = await getPdfBytes(doc.pdf_storage_path);
      const pdfDoc = await PDFDocument.load(pdfBytes);
      const helv = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const helvBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

      const pages = pdfDoc.getPages();
      const fieldValues = doc.esign_field_values || [];

      for (const fv of fieldValues) {
        const field = (doc.template_fields || []).find((f) => f.id === fv.field_id) || fv;
        const pageIdx = Math.min((field.page || 1) - 1, pages.length - 1);
        const page = pages[pageIdx];
        if (!page) continue;

        const x = field.x || 0;
        const y = page.getHeight() - (field.y || 0) - (field.height || 20);
        const value = fv.value || '';

        if (field.type === FIELD_TYPES.SIGNATURE || field.type === FIELD_TYPES.INITIALS) {
          page.drawRectangle({
            x, y, width: field.width || 200, height: field.height || 40,
            color: rgb(0.85, 0.85, 0.95), borderColor: rgb(0.4, 0.4, 0.6), borderWidth: 1,
          });
          const font = field.type === FIELD_TYPES.SIGNATURE ? helvBold : helv;
          const fontSize = (field.height || 40) * 0.6;
          page.drawText(value, { x: x + 8, y: y + (field.height || 40) * 0.25, size: fontSize, font, color: rgb(0.1, 0.1, 0.3) });
        } else if (field.type === FIELD_TYPES.CHECKBOX) {
          if (value === 'true' || value === true) {
            page.drawText('✓', { x: x + 4, y: y + 2, size: 16, font: helvBold, color: rgb(0, 0, 0) });
          }
        } else {
          page.drawText(String(value).substring(0, 80), { x: x + 4, y: y + 4, size: 11, font: helv, color: rgb(0, 0, 0) });
        }
      }

      // Add completion certificate page
      const certPage = pdfDoc.addPage([612, 792]);
      certPage.drawText('Electronic Signature Completion Record', { x: 100, y: 720, size: 18, font: helvBold, color: rgb(0, 0, 0) });
      certPage.drawText(`Document: ${doc.name}`, { x: 100, y: 680, size: 12, font: helv, color: rgb(0.3, 0.3, 0.3) });
      certPage.drawText(`Completed: ${new Date().toLocaleString()}`, { x: 100, y: 660, size: 12, font: helv, color: rgb(0.3, 0.3, 0.3) });
      certPage.drawText(`Document ID: ${doc.id}`, { x: 100, y: 640, size: 10, font: helv, color: rgb(0.5, 0.5, 0.5) });

      let certY = 600;
      for (const r of (doc.esign_recipients || [])) {
        certPage.drawText(`${r.name} (${r.email}) — ${r.status} — ${r.signed_at ? new Date(r.signed_at).toLocaleString() : 'N/A'}`,
          { x: 100, y: certY, size: 11, font: helv, color: rgb(0.2, 0.2, 0.2) });
        certY -= 20;
      }

      certPage.drawText('This document was electronically signed via the M2 Fleet Portal e-Signature system.', {
        x: 100, y: 100, size: 10, font: helv, color: rgb(0.5, 0.5, 0.5),
      });

      const finalizedBytes = await pdfDoc.save();
      const blob = new Blob([finalizedBytes], { type: 'application/pdf' });
      const { path, url } = await uploadSignedPdf(docId, blob, `signed-${doc.name || 'document'}.pdf`);
      await supabase.from('esign_documents').update({
        completed_pdf_path: path,
        completed_at: new Date().toISOString(),
      }).eq('id', docId);

      showToast('success', 'Signed PDF generated and saved.');
      await refresh();
    } catch (e) { showToast('error', e.message); console.error(e); }
    finally { setBusy(false); }
  };

  // ---- Render ----
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <FileText className="w-8 h-8 text-blue-600" /> E-Signature System
          </h1>
          <p className="text-gray-600 mt-1">M2 Fleet internal document signing — templates, tracking, and completion.</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total Documents', value: stats.total, icon: FileText, color: 'text-blue-600' },
          { label: 'Out for Signature', value: stats.sent, icon: Send, color: 'text-orange-600' },
          { label: 'Completed', value: stats.completed, icon: CheckCircle2, color: 'text-green-600' },
          { label: 'Pending Signatures', value: stats.pending, icon: Clock, color: 'text-purple-600' },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-lg border p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">{s.label}</p>
              <p className="text-2xl font-bold mt-1">{s.value}</p>
            </div>
            <s.icon className={`w-8 h-8 ${s.color}`} />
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {[
          { key: 'documents', label: 'Documents', icon: FileText },
          { key: 'templates', label: 'Templates', icon: Layers },
          { key: 'settings', label: 'Settings', icon: SettingsIcon },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 font-medium text-sm border-b-2 transition flex items-center gap-2 ${
              tab === t.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <t.icon className="w-4 h-4" /> {t.label}
          </button>
        ))}
      </div>

      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 ${
          toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
        }`}>
          {toast.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          {toast.message}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>
      ) : tab === 'documents' ? (
        <DocumentsTab
          documents={filteredDocs}
          search={search} setSearch={setSearch}
          statusFilter={statusFilter} setStatusFilter={setStatusFilter}
          templates={templates}
          contractors={contractors}
          settings={settings}
          busy={busy}
          onSend={() => setShowSendModal(true)}
          onView={(d) => setShowDetailsModal(d)}
          onVoid={handleVoid}
          onResend={handleResend}
          onDownloadSigned={handleDownloadSigned}
          onGenerateSigned={handleGenerateSignedPdf}
          onRefresh={refresh}
        />
      ) : tab === 'templates' ? (
        <TemplatesTab
          templates={templates}
          onNew={() => setShowTemplateModal(true)}
          onDelete={async (id) => {
            if (!confirm('Delete this template?')) return;
            setBusy(true);
            try { await deleteTemplate(id); showToast('success', 'Template deleted.'); await refresh(); }
            catch (e) { showToast('error', e.message); }
            finally { setBusy(false); }
          }}
          busy={busy}
        />
      ) : (
        <SettingsTab settings={settings} onSave={async (s) => {
          setBusy(true);
          try { await updateSettings(s); showToast('success', 'Settings saved.'); await refresh(); }
          catch (e) { showToast('error', e.message); }
          finally { setBusy(false); }
        }} busy={busy} />
      )}

      {/* Modals */}
      {showTemplateModal && (
        <TemplateModal
          onClose={() => setShowTemplateModal(false)}
          onCreated={() => { setShowTemplateModal(false); refresh(); }}
          showToast={showToast}
        />
      )}
      {showSendModal && (
        <SendModal
          templates={templates}
          contractors={contractors}
          settings={settings}
          onClose={() => setShowSendModal(false)}
          onSent={() => { setShowSendModal(false); refresh(); }}
          showToast={showToast}
        />
      )}
      {showDetailsModal && (
        <DetailsModal
          document={showDetailsModal}
          onClose={() => setShowDetailsModal(null)}
          onVoid={handleVoid}
          onResend={handleResend}
          onDownloadSigned={handleDownloadSigned}
          onGenerateSigned={handleGenerateSignedPdf}
          busy={busy}
          signingBaseUrl={SIGNING_PAGE_BASE}
        />
      )}
    </div>
  );
}

// ===========================================================================
// DOCUMENTS TAB
// ===========================================================================
function DocumentsTab({ documents, search, setSearch, statusFilter, setStatusFilter,
  templates, contractors, settings, busy, onSend, onView, onVoid, onResend,
  onDownloadSigned, onGenerateSigned, onRefresh }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 flex-1">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
            <input
              type="text" placeholder="Search documents..." value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm">
            <option value="all">All Status</option>
            <option value="draft">Draft</option>
            <option value="sent">Sent</option>
            <option value="completed">Completed</option>
            <option value="voided">Voided</option>
            <option value="declined">Declined</option>
          </select>
        </div>
        <div className="flex gap-2">
          <button onClick={onRefresh} className="p-2 border rounded-lg hover:bg-gray-50" title="Refresh">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button onClick={onSend} disabled={busy || templates.length === 0}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2">
            <Send className="w-4 h-4" /> Send Document
          </button>
        </div>
      </div>

      {templates.length === 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm text-yellow-800">
          No templates yet. Create a template first (Templates tab) before sending documents.
        </div>
      )}

      {documents.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No documents yet. Click "Send Document" to get started.</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Document</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Recipients</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Created</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {documents.map((doc) => (
                <tr key={doc.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{doc.name}</p>
                    <p className="text-xs text-gray-400">{doc.id}</p>
                  </td>
                  <td className="px-4 py-3">
                    <div className="space-y-1">
                      {(doc.esign_recipients || []).map((r) => (
                        <div key={r.id} className="flex items-center gap-2 text-xs">
                          <span className={`px-1.5 py-0.5 rounded ${RECIPIENT_BADGE[r.status]?.cls || 'bg-gray-100'}`}>
                            {RECIPIENT_BADGE[r.status]?.label || r.status}
                          </span>
                          <span className="text-gray-600">{r.name}</span>
                        </div>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${STATUS_BADGE[doc.status]?.cls || 'bg-gray-100'}`}>
                      {STATUS_BADGE[doc.status]?.label || doc.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {new Date(doc.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => onView(doc)} className="p-1.5 hover:bg-gray-100 rounded" title="View Details">
                        <Eye className="w-4 h-4 text-gray-600" />
                      </button>
                      {doc.status === 'completed' && (
                        <>
                          <button onClick={() => onDownloadSigned(doc.id)} className="p-1.5 hover:bg-gray-100 rounded" title="Download Signed PDF">
                            <Download className="w-4 h-4 text-green-600" />
                          </button>
                          {!doc.completed_pdf_path && (
                            <button onClick={() => onGenerateSigned(doc.id)} className="p-1.5 hover:bg-gray-100 rounded text-xs" title="Generate Signed PDF">
                              <FileText className="w-4 h-4 text-blue-600" />
                            </button>
                          )}
                        </>
                      )}
                      {doc.status === 'sent' && (
                        <button onClick={() => { const reason = prompt('Reason for voiding?'); if (reason !== null) onVoid(doc.id, reason); }}
                          className="p-1.5 hover:bg-gray-100 rounded" title="Void">
                          <Ban className="w-4 h-4 text-red-500" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ===========================================================================
// TEMPLATES TAB
// ===========================================================================
function TemplatesTab({ templates, onNew, onDelete, busy }) {
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={onNew} disabled={busy}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2">
          <Plus className="w-4 h-4" /> New Template
        </button>
      </div>

      {templates.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Layers className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No templates yet. Click "New Template" to upload a PDF and add signature fields.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((t) => (
            <div key={t.id} className="bg-white rounded-lg border p-4 hover:shadow-md transition">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <FileText className="w-10 h-10 text-blue-400" />
                  <div>
                    <p className="font-medium text-gray-900">{t.name}</p>
                    <p className="text-xs text-gray-400">{(t.fields || []).length} fields</p>
                  </div>
                </div>
                <button onClick={() => onDelete(t.id)} className="p-1.5 hover:bg-red-50 rounded" title="Delete">
                  <Trash2 className="w-4 h-4 text-red-500" />
                </button>
              </div>
              {t.description && <p className="text-sm text-gray-500 mt-2">{t.description}</p>}
              <p className="text-xs text-gray-400 mt-3">Created {new Date(t.created_at).toLocaleDateString()}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ===========================================================================
// SETTINGS TAB
// ===========================================================================
function SettingsTab({ settings, onSave, busy }) {
  const [form, setForm] = useState({
    default_from_name: settings.default_from_name || 'M2 Fleet',
    default_expiration_days: settings.default_expiration_days || 30,
    default_reminder_interval_days: settings.default_reminder_interval_days || 3,
    reminder_enabled: settings.reminder_enabled ?? true,
  });

  return (
    <div className="max-w-lg space-y-4">
      <div className="bg-white rounded-lg border p-6 space-y-4">
        <h3 className="font-semibold text-gray-900">E-Signature Settings</h3>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Default From Name</label>
          <input type="text" value={form.default_from_name}
            onChange={(e) => setForm({ ...form, default_from_name: e.target.value })}
            className="w-full border rounded-lg px-3 py-2 text-sm" />
          <p className="text-xs text-gray-400 mt-1">Appears in the "from" name of signing emails.</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Default Expiration (days)</label>
          <input type="number" value={form.default_expiration_days}
            onChange={(e) => setForm({ ...form, default_expiration_days: parseInt(e.target.value) || 30 })}
            className="w-full border rounded-lg px-3 py-2 text-sm" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Reminder Interval (days)</label>
          <input type="number" value={form.default_reminder_interval_days}
            onChange={(e) => setForm({ ...form, default_reminder_interval_days: parseInt(e.target.value) || 3 })}
            className="w-full border rounded-lg px-3 py-2 text-sm" />
        </div>

        <div className="flex items-center gap-2">
          <input type="checkbox" id="reminder_enabled" checked={form.reminder_enabled}
            onChange={(e) => setForm({ ...form, reminder_enabled: e.target.checked })} />
          <label htmlFor="reminder_enabled" className="text-sm text-gray-700">Enable automatic reminders</label>
        </div>

        <button onClick={() => onSave(form)} disabled={busy}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
          {busy ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
}

// ===========================================================================
// TEMPLATE MODAL — upload PDF + place fields
// ===========================================================================
function TemplateModal({ onClose, onCreated, showToast }) {
  const [step, setStep] = useState('upload'); // upload -> fields
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [pdfFile, setPdfFile] = useState(null);
  const [pdfUrl, setPdfUrl] = useState(null);
  const [pageCount, setPageCount] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [fields, setFields] = useState([]);
  const [selectedFieldType, setSelectedFieldType] = useState(FIELD_TYPES.SIGNATURE);
  const [busy, setBusy] = useState(false);

  const handleFile = async (file) => {
    if (!file || file.type !== 'application/pdf') {
      showToast('error', 'Please select a PDF file.');
      return;
    }
    setPdfFile(file);
    setName(name || file.name.replace(/\.pdf$/i, ''));
    const url = URL.createObjectURL(file);
    setPdfUrl(url);

    // Get page count
    try {
      const buf = await file.arrayBuffer();
      const doc = await PDFDocument.load(buf);
      setPageCount(doc.getPageCount());
    } catch (e) { /* default to 1 */ }
  };

  const handlePdfClick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setFields([...fields, {
      id: `field_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      type: selectedFieldType,
      page: currentPage,
      x, y,
      width: selectedFieldType === FIELD_TYPES.SIGNATURE ? 200 : selectedFieldType === FIELD_TYPES.CHECKBOX ? 20 : 150,
      height: selectedFieldType === FIELD_TYPES.SIGNATURE ? 40 : 20,
      label: '',
      required: true,
    }]);
  };

  const handleSave = async () => {
    if (!pdfFile) { showToast('error', 'Upload a PDF first.'); return; }
    if (!name.trim()) { showToast('error', 'Enter a template name.'); return; }
    setBusy(true);
    try {
      await createTemplate({
        name: name.trim(),
        description: description.trim(),
        fields,
        createdBy: (await supabase.auth.getUser()).data?.user?.email || null,
      }, pdfFile);
      showToast('success', 'Template created successfully.');
      onCreated();
    } catch (e) { showToast('error', e.message); }
    finally { setBusy(false); }
  };

  const FIELD_BUTTONS = [
    { type: FIELD_TYPES.SIGNATURE, label: 'Signature', icon: '✍️' },
    { type: FIELD_TYPES.INITIALS, label: 'Initials', icon: 'I' },
    { type: FIELD_TYPES.TEXT, label: 'Text', icon: 'T' },
    { type: FIELD_TYPES.DATE, label: 'Date', icon: '📅' },
    { type: FIELD_TYPES.CHECKBOX, label: 'Checkbox', icon: '☑️' },
    { type: FIELD_TYPES.FULL_NAME, label: 'Full Name', icon: '👤' },
    { type: FIELD_TYPES.EMAIL, label: 'Email', icon: '✉️' },
    { type: FIELD_TYPES.COMPANY, label: 'Company', icon: '🏢' },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-xl font-bold">New Template</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-4 overflow-y-auto flex-1">
          {step === 'upload' ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Template Name *</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="e.g. Contractor Agreement" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <input type="text" value={description} onChange={(e) => setDescription(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Optional" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Upload PDF *</label>
                <div
                  onClick={() => document.getElementById('tmpl-pdf-input').click()}
                  className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-blue-500 hover:bg-blue-50"
                >
                  {pdfFile ? (
                    <div>
                      <FileText className="w-12 h-12 mx-auto mb-2 text-blue-500" />
                      <p className="font-medium">{pdfFile.name}</p>
                      <p className="text-sm text-gray-500">{pageCount} page(s)</p>
                    </div>
                  ) : (
                    <div>
                      <Upload className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                      <p className="text-gray-500">Click to upload a PDF</p>
                    </div>
                  )}
                </div>
                <input id="tmpl-pdf-input" type="file" accept="application/pdf" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
              </div>
              {pdfFile && (
                <button onClick={() => setStep('fields')}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
                  Next: Place Fields →
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-2 flex-wrap">
                {FIELD_BUTTONS.map((fb) => (
                  <button key={fb.type} onClick={() => setSelectedFieldType(fb.type)}
                    className={`px-3 py-1.5 rounded-lg text-sm border transition ${
                      selectedFieldType === fb.type ? 'bg-blue-600 text-white border-blue-600' : 'bg-white hover:bg-gray-50'
                    }`}>
                    {fb.icon} {fb.label}
                  </button>
                ))}
                <div className="ml-auto flex items-center gap-2">
                  <span className="text-sm text-gray-500">Page</span>
                  <select value={currentPage} onChange={(e) => setCurrentPage(parseInt(e.target.value))} className="border rounded px-2 py-1 text-sm">
                    {Array.from({ length: pageCount }, (_, i) => (
                      <option key={i + 1} value={i + 1}>{i + 1}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="border rounded-lg overflow-hidden bg-gray-100 relative" style={{ height: 500 }}>
                {pdfUrl && (
                  <iframe src={`${pdfUrl}#page=${currentPage}&toolbar=0`} className="w-full h-full"
                    style={{ pointerEvents: 'none' }} title="PDF Preview" />
                )}
                <div className="absolute inset-0 cursor-crosshair" onClick={handlePdfClick}>
                  {fields.filter((f) => f.page === currentPage).map((f, i) => (
                    <div key={f.id}
                      className="absolute border-2 border-blue-500 bg-blue-100/40 flex items-center justify-center text-xs"
                      style={{
                        left: f.x, top: f.y, width: f.width, height: f.height,
                        cursor: 'move',
                      }}
                      onClick={(e) => { e.stopPropagation(); }}
                    >
                      <span className="bg-white px-1 rounded text-blue-600 pointer-events-none">
                        {f.type} {i + 1}
                      </span>
                      <button
                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs"
                        onClick={(e) => { e.stopPropagation(); setFields(fields.filter((x) => x.id !== f.id)); }}
                      >×</button>
                    </div>
                  ))}
                </div>
              </div>

              <p className="text-sm text-gray-500">
                Click on the document to place a <strong>{selectedFieldType}</strong> field.
                {fields.length > 0 && ` ${fields.length} field(s) placed.`}
              </p>

              <div className="flex justify-between">
                <button onClick={() => setStep('upload')} className="px-4 py-2 border rounded-lg text-sm">
                  ← Back
                </button>
                <button onClick={handleSave} disabled={busy}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                  {busy ? 'Saving...' : 'Save Template'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ===========================================================================
// SEND MODAL — create document from template + assign recipients
// ===========================================================================
function SendModal({ templates, contractors, settings, onClose, onSent, showToast }) {
  const [templateId, setTemplateId] = useState('');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [expirationDays, setExpirationDays] = useState(settings.default_expiration_days || 30);
  const [recipients, setRecipients] = useState([]);
  const [busy, setBusy] = useState(false);
  const [recipientSource, setRecipientSource] = useState('contractor'); // contractor | external

  const selectedTemplate = templates.find((t) => t.id === templateId);

  const addContractorRecipient = (contractorId) => {
    const c = contractors.find((x) => x.id === contractorId);
    if (!c) return;
    if (recipients.find((r) => r.email === c.email)) return;
    setRecipients([...recipients, {
      name: c.full_name || c.email,
      email: c.email,
      role: 'Signer',
      contractorId: c.id,
      fields: (selectedTemplate?.fields || []).map((f) => ({ fieldId: f.id, assigned: true })),
    }]);
  };

  const addExternalRecipient = () => {
    setRecipients([...recipients, {
      name: '',
      email: '',
      role: 'Signer',
      fields: (selectedTemplate?.fields || []).map((f) => ({ fieldId: f.id, assigned: true })),
    }]);
  };

  const removeRecipient = (idx) => setRecipients(recipients.filter((_, i) => i !== idx));

  const handleSend = async () => {
    if (!templateId) { showToast('error', 'Select a template.'); return; }
    if (!title.trim()) { showToast('error', 'Enter a document title.'); return; }
    if (recipients.length === 0) { showToast('error', 'Add at least one recipient.'); return; }
    for (const r of recipients) {
      if (!r.email || !r.name) { showToast('error', 'Each recipient needs a name and email.'); return; }
    }
    setBusy(true);
    try {
      const tmpl = await getTemplate(templateId);
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + (expirationDays || 30));

      const doc = await createDocument({
        title: title.trim(),
        templateId,
        templateFields: tmpl.fields || [],
        message: message.trim(),
        expiresAt: expiresAt.toISOString(),
        recipients: recipients.map((r) => ({
          ...r,
          routingOrder: recipients.indexOf(r) + 1,
        })),
        createdBy: (await supabase.auth.getUser()).data?.user?.email || null,
      }, await (await fetch(tmpl.pdf_url)).blob()
        .then((b) => new File([b], tmpl.name + '.pdf', { type: 'application/pdf' }))
        .catch(() => {
          throw new Error('Could not load template PDF. The template may need to be recreated.');
        })
      );

      // Send emails to each recipient
      const signingBase = window.location.origin + '/sign';
      for (let i = 0; i < recipients.length; i++) {
        const recip = doc; // Need to get recipient IDs from the created doc
      }

      // Fetch the document with recipients to get their tokens
      const fullDoc = await getDocument(doc.id);
      for (const recip of (fullDoc.esign_recipients || [])) {
        const signingUrl = `${signingBase}/${doc.id}/${recip.token_hash}`;
        try {
          await fetch('https://austin1.zo.space/api/esign-send-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify({
              to: recip.email,
              subject: `${title}: Please review and sign`,
              fromName: settings.default_from_name || 'M2 Fleet',
              signingUrl,
              recipientName: recip.name,
              message: message.trim(),
            }),
          });
        } catch (e) { console.error('Email send failed for', recip.email, e); }
      }

      // Update document status to sent
      await supabase.from('esign_documents').update({ status: 'sent' }).eq('id', doc.id);

      showToast('success', `Document sent to ${recipients.length} recipient(s).`);
      onSent();
    } catch (e) { showToast('error', e.message); console.error(e); }
    finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-xl font-bold">Send Document for Signature</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-4 overflow-y-auto flex-1 space-y-4">
          {/* Template selection */}
          <div>
            <label className="block text-sm font-medium mb-1">Template *</label>
            <select value={templateId} onChange={(e) => { setTemplateId(e.target.value); const t = templates.find(x => x.id === e.target.value); if (t && !title) setTitle(t.name); }}
              className="w-full border rounded-lg px-3 py-2 text-sm">
              <option value="">Select a template...</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>{t.name} ({(t.fields || []).length} fields)</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Document Title *</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="e.g. Service Agreement — John Smith" />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Message to Recipients</label>
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3}
              className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Optional message included in the email..." />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Expiration (days)</label>
            <input type="number" value={expirationDays} onChange={(e) => setExpirationDays(parseInt(e.target.value) || 30)}
              className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>

          {/* Recipients */}
          <div>
            <label className="block text-sm font-medium mb-2">Recipients *</label>
            <div className="flex gap-2 mb-3">
              <div className="flex-1">
                <select value="" onChange={(e) => { if (e.target.value) addContractorRecipient(e.target.value); e.target.value = ''; }}
                  className="w-full border rounded-lg px-3 py-2 text-sm">
                  <option value="">+ Add from contractor roster...</option>
                  {contractors.filter((c) => c.email).map((c) => (
                    <option key={c.id} value={c.id}>{c.full_name} — {c.email}</option>
                  ))}
                </select>
              </div>
              <button onClick={addExternalRecipient} className="px-3 py-2 border rounded-lg text-sm hover:bg-gray-50 flex items-center gap-1">
                <Plus className="w-4 h-4" /> External
              </button>
            </div>

            {recipients.map((r, idx) => (
              <div key={idx} className="flex items-center gap-2 mb-2">
                <span className="w-6 h-6 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xs font-bold">{idx + 1}</span>
                <input type="text" value={r.name} placeholder="Name"
                  onChange={(e) => { const rs = [...recipients]; rs[idx].name = e.target.value; setRecipients(rs); }}
                  className="flex-1 border rounded px-2 py-1.5 text-sm" />
                <input type="email" value={r.email} placeholder="Email"
                  onChange={(e) => { const rs = [...recipients]; rs[idx].email = e.target.value; setRecipients(rs); }}
                  className="flex-1 border rounded px-2 py-1.5 text-sm" />
                <button onClick={() => removeRecipient(idx)} className="p-1 hover:bg-red-50 rounded">
                  <X className="w-4 h-4 text-red-500" />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2 p-4 border-t">
          <button onClick={onClose} className="px-4 py-2 border rounded-lg text-sm">Cancel</button>
          <button onClick={handleSend} disabled={busy}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {busy ? 'Sending...' : 'Send for Signature'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ===========================================================================
// DETAILS MODAL — view document details, audit trail, recipient status
// ===========================================================================
function DetailsModal({ document, onClose, onVoid, onResend, onDownloadSigned, onGenerateSigned, busy, signingBaseUrl }) {
  const [audit, setAudit] = useState(null);
  const [tab, setTab] = useState('recipients');

  useEffect(() => {
    getAuditLog(document.id).then(setAudit).catch(() => setAudit([]));
  }, [document.id]);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <div>
            <h2 className="text-xl font-bold">{document.name}</h2>
            <p className="text-xs text-gray-400">{document.id}</p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-4 overflow-y-auto flex-1">
          <div className="flex gap-1 mb-4 border-b">
            <button onClick={() => setTab('recipients')} className={`px-3 py-1.5 text-sm border-b-2 ${tab === 'recipients' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500'}`}>Recipients</button>
            <button onClick={() => setTab('audit')} className={`px-3 py-1.5 text-sm border-b-2 ${tab === 'audit' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500'}`}>Audit Trail</button>
          </div>

          {tab === 'recipients' && (
            <div className="space-y-3">
              {(document.esign_recipients || []).map((r) => (
                <div key={r.id} className="border rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">{r.name}</p>
                      <p className="text-xs text-gray-500">{r.email}</p>
                    </div>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${RECIPIENT_BADGE[r.status]?.cls || 'bg-gray-100'}`}>
                      {RECIPIENT_BADGE[r.status]?.label || r.status}
                    </span>
                  </div>
                  {r.signed_at && <p className="text-xs text-gray-400 mt-1">Signed: {new Date(r.signed_at).toLocaleString()}</p>}
                  {r.viewed_at && <p className="text-xs text-gray-400">Viewed: {new Date(r.viewed_at).toLocaleString()}</p>}
                  {r.status === 'sent' || r.status === 'viewed' ? (
                    <div className="flex gap-2 mt-2">
                      <button onClick={() => onResend(r.id)} disabled={busy}
                        className="px-2 py-1 border rounded text-xs hover:bg-gray-50 flex items-center gap-1">
                        <Mail className="w-3 h-3" /> Resend
                      </button>
                      <a href={`${signingBaseUrl}/${document.id}/${r.token_hash}`} target="_blank" rel="noreferrer"
                        className="px-2 py-1 border rounded text-xs hover:bg-gray-50 flex items-center gap-1 text-blue-600">
                        <ExternalLink className="w-3 h-3" /> Open Signing Link
                      </a>
                    </div>
                  ) : null}
                </div>
              ))}

              {document.status === 'completed' && (
                <div className="flex gap-2 pt-2">
                  {document.completed_pdf_path ? (
                    <button onClick={() => onDownloadSigned(document.id)} disabled={busy}
                      className="px-3 py-1.5 bg-green-600 text-white rounded text-sm flex items-center gap-1">
                      <Download className="w-4 h-4" /> Download Signed PDF
                    </button>
                  ) : (
                    <button onClick={() => onGenerateSigned(document.id)} disabled={busy}
                      className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm flex items-center gap-1">
                      <FileText className="w-4 h-4" /> Generate Signed PDF
                    </button>
                  )}
                </div>
              )}

              {document.status === 'sent' && (
                <button onClick={() => { const reason = prompt('Reason for voiding?'); if (reason !== null) onVoid(document.id, reason); }}
                  disabled={busy}
                  className="px-3 py-1.5 bg-red-50 text-red-600 border border-red-200 rounded text-sm flex items-center gap-1">
                  <Ban className="w-4 h-4" /> Void Document
                </button>
              )}
            </div>
          )}

          {tab === 'audit' && (
            <div className="space-y-2">
              {(audit || []).map((a) => (
                <div key={a.id} className="flex gap-3 text-sm border-l-2 border-blue-200 pl-3 py-1">
                  <div>
                    <p className="font-medium">{a.action.replace(/_/g, ' ')}</p>
                    <p className="text-xs text-gray-400">{new Date(a.created_at).toLocaleString()}</p>
                  </div>
                </div>
              ))}
              {(!audit || audit.length === 0) && <p className="text-sm text-gray-400">No audit entries yet.</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
