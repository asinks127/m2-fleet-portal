import React, { useState, useEffect, useMemo } from 'react';
import { VeloSurvey, VeloSurveyResponse, User, VeloPM } from '@/api/entities.js';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table.jsx';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Label } from '@/components/ui/label.jsx';
import { Textarea } from '@/components/ui/textarea.jsx';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select.jsx';
import { Alert, AlertDescription } from '@/components/ui/alert.jsx';
import {
  Send, Star, Calendar, Mail, CheckCircle, Clock, Plus, Loader2, Eye, Trash2,
  Users, Trophy, UserPlus, Zap, ExternalLink
} from 'lucide-react';
import { format } from 'date-fns';

// Public survey page (PM-facing). The scheduled Zo agent emails this link from scheduling@m2fleetcom.com.
const SURVEY_PAGE_URL = 'https://austin1.zo.space/velo-survey';

// ---- helpers ----
const parseTechIds = (ti) => {
  if (Array.isArray(ti)) return ti.filter(Boolean);
  if (!ti) return [];
  if (typeof ti === 'string') {
    const cleaned = ti.replace(/["'\[\]\s]/g, '');
    return cleaned ? cleaned.split(',').filter(Boolean) : [];
  }
  return [];
};

const isCompleted = (s) => (s?.status || '').toLowerCase() === 'completed';

const StarRatingDisplay = ({ rating }) => (
  <div className="flex items-center">
    {[...Array(5)].map((_, i) => (
      <Star key={i} className={`w-4 h-4 ${i < (rating || 0) ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`} />
    ))}
    <span className="ml-2 text-sm text-gray-600">({rating ?? '—'})</span>
  </div>
);

const StatusBadge = ({ status }) => {
  const s = (status || '').toLowerCase();
  if (s === 'completed') return <Badge className="bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1" />Completed</Badge>;
  if (s === 'stored') return <Badge className="bg-emerald-100 text-emerald-800"><CheckCircle className="w-3 h-3 mr-1" />Stored to Drive</Badge>;
  if (s === 'pending_send') return <Badge className="bg-amber-100 text-amber-800"><Clock className="w-3 h-3 mr-1" />Queued</Badge>;
  if (s === 'sent') return <Badge className="bg-blue-100 text-blue-800"><Mail className="w-3 h-3 mr-1" />Sent</Badge>;
  return <Badge className="bg-gray-100 text-gray-700"><Mail className="w-3 h-3 mr-1" />{status || 'Sent'}</Badge>;
};

const techName = (u) => u?.full_name || u?.displayName || u?.fullName || u?.display_name || u?.email || 'Unknown';

export default function VeloSurveyDashboard() {
  const [tab, setTab] = useState('surveys'); // surveys | ranking | pms
  const [surveys, setSurveys] = useState([]);
  const [responses, setResponses] = useState([]);
  const [contractors, setContractors] = useState([]);
  const [pms, setPms] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionStatus, setActionStatus] = useState(null);

  const [showCreate, setShowCreate] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [showPm, setShowPm] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [selectedSurvey, setSelectedSurvey] = useState(null);
  const [selectedSurveys, setSelectedSurveys] = useState(new Set());
  const [isWorking, setIsWorking] = useState(false);

  const [newSurvey, setNewSurvey] = useState({ projectName: '', pmId: '', selectedTechIds: [] });
  const [bulk, setBulk] = useState({ projectName: '', pmIds: [], selectedTechIds: [] });
  const [newPm, setNewPm] = useState({ name: '', email: '', company: '', notes: '' });

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [surveysData, responsesData, usersData, pmsData] = await Promise.all([
        VeloSurvey.list('-sentDate'),
        VeloSurveyResponse.list('-submittedDate'),
        User.filter({ active: true }),
        VeloPM.list('name'),
      ]);
      setSurveys(surveysData || []);
      setResponses(responsesData || []);
      setPms(pmsData || []);
      setContractors((usersData || []).filter(u => u.email && (
        u.email.toLowerCase().includes('.contractor@m2fleetcom.com') ||
        u.email.toLowerCase().includes('.contractor@smcinstallations.com')
      )));
    } catch (e) {
      console.error('load error', e);
      setActionStatus({ type: 'error', message: 'Failed to load survey data.' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  // ---- PM directory CRUD ----
  const addPm = async () => {
    if (!newPm.name || !newPm.email) { setActionStatus({ type: 'error', message: 'PM name and email are required.' }); return; }
    setIsWorking(true);
    try {
      await VeloPM.create({ name: newPm.name.trim(), email: newPm.email.trim(), company: newPm.company?.trim() || null, notes: newPm.notes?.trim() || null });
      setActionStatus({ type: 'success', message: `Added PM ${newPm.name}.` });
      setNewPm({ name: '', email: '', company: '', notes: '' });
      setShowPm(false);
      loadData();
    } catch (e) { setActionStatus({ type: 'error', message: `Failed to add PM: ${e.message}` }); }
    finally { setIsWorking(false); }
  };

  const deletePm = async (id) => {
    if (!confirm('Remove this Project Manager from the directory?')) return;
    try { await VeloPM.delete(id); loadData(); } catch (e) { setActionStatus({ type: 'error', message: 'Failed to delete PM.' }); }
  };

  const makeToken = () => {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    return `survey_${Date.now()}_${Array.from(array, b => b.toString(16).padStart(2, '0')).join('')}`;
  };

  const buildSurveyRow = (projectName, pm, techIds, surveyType) => {
    const token = makeToken();
    return {
      projectName,
      veloPM: pm.name,
      veloPMEmail: pm.email,
      technicianIds: techIds,            // jsonb array
      surveyToken: token,
      surveyLink: `${SURVEY_PAGE_URL}?token=${token}`,
      status: 'pending_send',
      surveyType,
      autoTriggered: surveyType === 'auto',
      sentDate: new Date().toISOString(),
    };
  };

  // ---- Manual single-PM send ----
  const createSurvey = async () => {
    if (!newSurvey.projectName || !newSurvey.pmId || newSurvey.selectedTechIds.length === 0) {
      setActionStatus({ type: 'error', message: 'Fill all fields and select at least one technician.' }); return;
    }
    const pm = pms.find(p => p.id === newSurvey.pmId);
    if (!pm) { setActionStatus({ type: 'error', message: 'Select a valid Project Manager.' }); return; }
    setIsWorking(true);
    try {
      await VeloSurvey.create(buildSurveyRow(newSurvey.projectName, pm, newSurvey.selectedTechIds, 'manual'));
      setActionStatus({ type: 'success', message: `Survey queued for ${pm.name} (${pm.email}). It will be sent from scheduling@m2fleetcom.com shortly.` });
      setShowCreate(false);
      setNewSurvey({ projectName: '', pmId: '', selectedTechIds: [] });
      loadData();
    } catch (e) { setActionStatus({ type: 'error', message: `Failed to create survey: ${e.message}` }); }
    finally { setIsWorking(false); }
  };

  // ---- Bulk send: one survey per selected PM, same techs/project ----
  const bulkSend = async () => {
    if (!bulk.projectName || bulk.pmIds.length === 0 || bulk.selectedTechIds.length === 0) {
      setActionStatus({ type: 'error', message: 'Fill all fields and select at least one PM and one technician.' }); return;
    }
    setIsWorking(true);
    try {
      const selectedPms = pms.filter(p => bulk.pmIds.includes(p.id));
      let ok = 0;
      for (const pm of selectedPms) {
        try {
          await VeloSurvey.create(buildSurveyRow(bulk.projectName, pm, bulk.selectedTechIds, 'manual')); ok++;
        }
        catch (e) { console.warn('bulk row failed', pm, e); }
      }
      setActionStatus({ type: 'success', message: `Queued ${ok} of ${selectedPms.length} surveys. They will be sent from scheduling@m2fleetcom.com shortly.` });
      setShowBulk(false);
      setBulk({ projectName: '', pmIds: [], selectedTechIds: [] });
      loadData();
    } catch (e) { setActionStatus({ type: 'error', message: `Bulk send failed: ${e.message}` }); }
    finally { setIsWorking(false); }
  };

  // ---- delete ----
  const deleteSurvey = async (id) => {
    setIsWorking(true);
    try {
      for (const r of responses.filter(r => r.surveyId === id || r.surveyId === String(id))) await VeloSurveyResponse.delete(r.id);
      await VeloSurvey.delete(id);
      setActionStatus({ type: 'success', message: 'Survey deleted.' });
      setShowDelete(false); setSelectedSurvey(null); loadData();
    } catch (e) { setActionStatus({ type: 'error', message: 'Failed to delete survey.' }); }
    finally { setIsWorking(false); }
  };
  const bulkDelete = async () => {
    setIsWorking(true);
    try {
      for (const id of selectedSurveys) {
        for (const r of responses.filter(r => r.surveyId === id || r.surveyId === String(id))) await VeloSurveyResponse.delete(r.id);
        await VeloSurvey.delete(id);
      }
      setActionStatus({ type: 'success', message: `Deleted ${selectedSurveys.size} survey(s).` });
      setSelectedSurveys(new Set()); setShowDelete(false); loadData();
    } catch (e) { setActionStatus({ type: 'error', message: 'Failed to delete some surveys.' }); }
    finally { setIsWorking(false); }
  };

  const toggleTech = (list, setter, id) =>
    setter(list.includes(id) ? list.filter(x => x !== id) : [...list, id]);

  // ---- ranking aggregation ----
  const ranking = useMemo(() => {
    const byTech = {};
    for (const r of responses) {
      const key = r.technicianId || r.technicianName;
      if (!key) continue;
      if (!byTech[key]) byTech[key] = { id: r.technicianId, name: r.technicianName, scores: [], count: 0, notes: [] };
      if (typeof r.calculatedScore === 'number') byTech[key].scores.push(r.calculatedScore);
      byTech[key].count++;
      if (r.additionalNotes) byTech[key].notes.push(r.additionalNotes);
    }
    const rows = Object.values(byTech).map(t => {
      const pmAvg = t.scores.length ? t.scores.reduce((a, b) => a + b, 0) / t.scores.length : null; // 1-5
      const pmScore100 = pmAvg != null ? Math.round((pmAvg / 5) * 100) : null; // 0-100
      const contractor = contractors.find(c => c.id === t.id);
      const qcScore = contractor?.velocitiScore ?? contractor?.avgQcScore ?? null;
      // combined: average of available normalized scores (PM 0-100, QC 0-100)
      const parts = [pmScore100, qcScore].filter(v => v != null);
      const combined = parts.length ? Math.round(parts.reduce((a, b) => a + b, 0) / parts.length) : null;
      return { ...t, pmAvg, pmScore100, qcScore, combined, contractor };
    });
    return rows.sort((a, b) => (b.combined ?? -1) - (a.combined ?? -1));
  }, [responses, contractors]);

  const stats = useMemo(() => ({
    total: surveys.length,
    completed: surveys.filter(isCompleted).length,
    pending: surveys.filter(s => !isCompleted(s)).length,
    pms: pms.length,
  }), [surveys, pms]);

  const surveyResponses = (id) => responses.filter(r => r.surveyId === id || r.surveyId === String(id));
  const detailsResponses = selectedSurvey ? surveyResponses(selectedSurvey.id) : [];

  const TechPicker = ({ ids, onToggle }) => (
    <div className="mt-2 max-h-56 overflow-y-auto border rounded-lg p-3 space-y-1">
      {contractors.length === 0 && <p className="text-sm text-gray-500">No contractors loaded.</p>}
      {contractors.map(c => (
        <label key={c.id} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 rounded px-1 py-0.5">
          <input type="checkbox" checked={ids.includes(c.id)} onChange={() => onToggle(c.id)} className="rounded" />
          <span className="text-sm">{techName(c)} <span className="text-gray-400">· {c.project || 'No Project'}</span></span>
        </label>
      ))}
    </div>
  );

  if (isLoading) return <div className="p-6 flex justify-center"><Loader2 className="w-8 h-8 animate-spin" /></div>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-start flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3"><Star className="w-8 h-8 text-yellow-500" />Velo PM Surveys</h1>
          <p className="text-gray-600 mt-1">Send performance surveys to <strong>outside</strong> Project Managers. Sent from scheduling@m2fleetcom.com. M2 techs are never recipients — they are the ones rated.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={() => setShowPm(true)}><UserPlus className="w-4 h-4 mr-2" />Add PM</Button>
          <Button variant="outline" onClick={() => setShowBulk(true)}><Zap className="w-4 h-4 mr-2" />Bulk Send</Button>
          {selectedSurveys.size > 0 && <Button variant="destructive" onClick={() => setShowDelete(true)} disabled={isWorking}><Trash2 className="w-4 h-4 mr-2" />Delete ({selectedSurveys.size})</Button>}
          <Button onClick={() => setShowCreate(true)}><Plus className="w-4 h-4 mr-2" />Assign Survey</Button>
        </div>
      </div>

      {actionStatus && <Alert variant={actionStatus.type === 'error' ? 'destructive' : 'default'}><AlertDescription>{actionStatus.message}</AlertDescription></Alert>}

      {/* tabs */}
      <div className="flex gap-2 border-b">
        {[
          { id: 'surveys', label: 'Survey History', icon: Mail },
          { id: 'ranking', label: 'Tech Ranking', icon: Trophy },
          { id: 'pms', label: 'PM Directory', icon: Users },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-2 -mb-px border-b-2 flex items-center gap-2 text-sm font-medium ${tab === t.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-800'}`}>
            <t.icon className="w-4 h-4" />{t.label}
          </button>
        ))}
      </div>

      {/* stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="p-4 flex items-center justify-between"><div><p className="text-sm text-gray-600">Total Surveys</p><p className="text-2xl font-bold">{stats.total}</p></div><Send className="w-8 h-8 text-blue-500" /></CardContent></Card>
        <Card><CardContent className="p-4 flex items-center justify-between"><div><p className="text-sm text-gray-600">Completed</p><p className="text-2xl font-bold">{stats.completed}</p></div><CheckCircle className="w-8 h-8 text-green-500" /></CardContent></Card>
        <Card><CardContent className="p-4 flex items-center justify-between"><div><p className="text-sm text-gray-600">Pending</p><p className="text-2xl font-bold">{stats.pending}</p></div><Clock className="w-8 h-8 text-orange-500" /></CardContent></Card>
        <Card><CardContent className="p-4 flex items-center justify-between"><div><p className="text-sm text-gray-600">PMs in Directory</p><p className="text-2xl font-bold">{stats.pms}</p></div><Users className="w-8 h-8 text-purple-500" /></CardContent></Card>
      </div>

      {/* ---- Surveys tab ---- */}
      {tab === 'surveys' && (
        <Card>
          <CardHeader><CardTitle>Survey History</CardTitle></CardHeader>
          <CardContent>
            {surveys.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10"><input type="checkbox" checked={selectedSurveys.size === surveys.length && surveys.length > 0} onChange={(e) => setSelectedSurveys(e.target.checked ? new Set(surveys.map(s => s.id)) : new Set())} /></TableHead>
                      <TableHead>Project</TableHead>
                      <TableHead>Outside PM</TableHead>
                      <TableHead>Tech(s)</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Sent</TableHead>
                      <TableHead>Responses</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {surveys.map(s => {
                      const ids = parseTechIds(s.technicianIds);
                      const rs = surveyResponses(s.id);
                      return (
                        <TableRow key={s.id}>
                          <TableCell><input type="checkbox" checked={selectedSurveys.has(s.id)} onChange={(e) => { const n = new Set(selectedSurveys); e.target.checked ? n.add(s.id) : n.delete(s.id); setSelectedSurveys(n); }} /></TableCell>
                          <TableCell className="font-medium">{s.projectName}</TableCell>
                          <TableCell><div className="font-medium">{s.veloPM}</div><div className="text-sm text-gray-500">{s.veloPMEmail}</div></TableCell>
                          <TableCell><Badge variant="outline">{ids.length} tech(s)</Badge></TableCell>
                          <TableCell>{s.surveyType === 'auto' ? <Badge className="bg-purple-100 text-purple-800">Auto</Badge> : <Badge variant="secondary">Manual</Badge>}</TableCell>
                          <TableCell><StatusBadge status={s.status} /></TableCell>
                          <TableCell>{s.sentDate ? <span className="flex items-center gap-1"><Calendar className="w-4 h-4 text-gray-400" />{format(new Date(s.sentDate), 'MMM d, yyyy')}</span> : '—'}</TableCell>
                          <TableCell className="text-sm">{rs.length} / {ids.length}</TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button variant="outline" size="sm" onClick={() => { setSelectedSurvey(s); setShowDetails(true); }}><Eye className="w-4 h-4" /></Button>
                              {s.surveyLink && <a href={s.surveyLink} target="_blank" rel="noreferrer"><Button variant="ghost" size="sm"><ExternalLink className="w-4 h-4" /></Button></a>}
                              <Button variant="destructive" size="sm" onClick={() => { setSelectedSurvey(s); setShowDelete(true); }}><Trash2 className="w-4 h-4" /></Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500"><Star className="w-12 h-12 mx-auto mb-3 opacity-50" /><p>No surveys yet. Click <strong>Assign Survey</strong> to send one to an outside PM.</p></div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ---- Ranking tab ---- */}
      {tab === 'ranking' && (
        <Card>
          <CardHeader><CardTitle>Technician Ranking — PM Survey Scores + QC Scores</CardTitle></CardHeader>
          <CardContent>
            {ranking.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Rank</TableHead>
                      <TableHead>Technician</TableHead>
                      <TableHead>Project</TableHead>
                      <TableHead className="text-center">PM Surveys</TableHead>
                      <TableHead className="text-center">PM Avg (1-5)</TableHead>
                      <TableHead className="text-center">PM Score (0-100)</TableHead>
                      <TableHead className="text-center">QC Score</TableHead>
                      <TableHead className="text-center">Combined</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ranking.map((t, i) => (
                      <TableRow key={t.id || t.name}>
                        <TableCell className="font-bold">{i + 1}</TableCell>
                        <TableCell className="font-medium">{t.name}</TableCell>
                        <TableCell>{t.contractor?.project || '—'}</TableCell>
                        <TableCell className="text-center">{t.count}</TableCell>
                        <TableCell className="text-center">{t.pmAvg != null ? t.pmAvg.toFixed(2) : '—'}</TableCell>
                        <TableCell className="text-center">{t.pmScore100 ?? '—'}</TableCell>
                        <TableCell className="text-center">{t.qcScore ?? '—'}</TableCell>
                        <TableCell className="text-center"><Badge className={t.combined >= 90 ? 'bg-green-100 text-green-800' : t.combined >= 70 ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}>{t.combined ?? '—'}</Badge></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500"><Trophy className="w-12 h-12 mx-auto mb-3 opacity-50" /><p>No survey responses yet. Rankings appear once outside PMs submit surveys.</p></div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ---- PM Directory tab ---- */}
      {tab === 'pms' && (
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle>Outside Project Manager Directory</CardTitle>
            <Button size="sm" onClick={() => setShowPm(true)}><UserPlus className="w-4 h-4 mr-2" />Add PM</Button>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600 mb-4">These are the outside PMs who receive surveys. Add them here so they show up for selection / bulk send. Recipients are never M2 techs.</p>
            {pms.length > 0 ? (
              <Table>
                <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Company</TableHead><TableHead>Notes</TableHead><TableHead></TableHead></TableRow></TableHeader>
                <TableBody>
                  {pms.map(p => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell>{p.email}</TableCell>
                      <TableCell>{p.company || '—'}</TableCell>
                      <TableCell className="text-sm text-gray-600 max-w-xs">{p.notes || '—'}</TableCell>
                      <TableCell><Button variant="ghost" size="sm" onClick={() => deletePm(p.id)}><Trash2 className="w-4 h-4 text-red-500" /></Button></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : <div className="text-center py-8 text-gray-500"><Users className="w-12 h-12 mx-auto mb-3 opacity-50" /><p>No outside PMs added yet. Click <strong>Add PM</strong>.</p></div>}
          </CardContent>
        </Card>
      )}

      {/* ---- Create dialog (single PM) ---- */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Assign Velo PM Survey</DialogTitle><DialogDescription>Sent to one outside PM from scheduling@m2fleetcom.com.</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div><Label>Project Name *</Label><Input value={newSurvey.projectName} onChange={e => setNewSurvey({ ...newSurvey, projectName: e.target.value })} placeholder="Project name" /></div>
            <div>
              <Label>Outside Project Manager *</Label>
              {pms.length === 0 ? <p className="text-sm text-amber-700 mt-1">No PMs yet — add one in the PM Directory tab first.</p> : (
                <Select value={newSurvey.pmId} onValueChange={v => setNewSurvey({ ...newSurvey, pmId: v })}>
                  <SelectTrigger><SelectValue placeholder="Select PM" /></SelectTrigger>
                  <SelectContent>{pms.map(p => <SelectItem key={p.id} value={p.id}>{p.name} — {p.email}</SelectItem>)}</SelectContent>
                </Select>
              )}
            </div>
            <div><Label>Select Technicians to Rate *</Label><TechPicker ids={newSurvey.selectedTechIds} onToggle={id => toggleTech(newSurvey.selectedTechIds, v => setNewSurvey({ ...newSurvey, selectedTechIds: v }), id)} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={createSurvey} disabled={isWorking}>{isWorking ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}Queue Survey</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---- Bulk send dialog ---- */}
      <Dialog open={showBulk} onOpenChange={setShowBulk}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Bulk Send Surveys</DialogTitle><DialogDescription>One survey created per selected PM. Same project + technicians.</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div><Label>Project Name *</Label><Input value={bulk.projectName} onChange={e => setBulk({ ...bulk, projectName: e.target.value })} placeholder="Project name" /></div>
            <div>
              <Label>Select Outside PMs * ({bulk.pmIds.length} selected)</Label>
              {pms.length === 0 ? <p className="text-sm text-amber-700 mt-1">No PMs yet — add PMs first.</p> : (
                <div className="mt-2 max-h-40 overflow-y-auto border rounded-lg p-3 space-y-1">
                  {pms.map(p => (
                    <label key={p.id} className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={bulk.pmIds.includes(p.id)} onChange={() => toggleTech(bulk.pmIds, v => setBulk({ ...bulk, pmIds: v }), p.id)} className="rounded" />
                      <span className="text-sm">{p.name} — {p.email}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
            <div><Label>Select Technicians to Rate *</Label><TechPicker ids={bulk.selectedTechIds} onToggle={id => toggleTech(bulk.selectedTechIds, v => setBulk({ ...bulk, selectedTechIds: v }), id)} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBulk(false)}>Cancel</Button>
            <Button onClick={bulkSend} disabled={isWorking}>{isWorking ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Zap className="w-4 h-4 mr-2" />}Bulk Send</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---- Add PM dialog ---- */}
      <Dialog open={showPm} onOpenChange={setShowPm}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Outside Project Manager</DialogTitle><DialogDescription>This PM will be selectable for manual and bulk survey sends.</DialogDescription></DialogHeader>
          <div className="space-y-3">
            <div><Label>Name *</Label><Input value={newPm.name} onChange={e => setNewPm({ ...newPm, name: e.target.value })} placeholder="e.g. Rob Hyberger" /></div>
            <div><Label>Email *</Label><Input type="email" value={newPm.email} onChange={e => setNewPm({ ...newPm, email: e.target.value })} placeholder="pm@outsidecompany.com" /></div>
            <div><Label>Company</Label><Input value={newPm.company} onChange={e => setNewPm({ ...newPm, company: e.target.value })} placeholder="e.g. Sunbelt" /></div>
            <div><Label>Notes</Label><Textarea value={newPm.notes} onChange={e => setNewPm({ ...newPm, notes: e.target.value })} placeholder="Optional" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPm(false)}>Cancel</Button>
            <Button onClick={addPm} disabled={isWorking}>{isWorking ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <UserPlus className="w-4 h-4 mr-2" />}Add PM</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---- Details dialog ---- */}
      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="max-w-7xl">
          <DialogHeader><DialogTitle>{selectedSurvey?.projectName}</DialogTitle><DialogDescription>Outside PM: {selectedSurvey?.veloPM} ({selectedSurvey?.veloPMEmail})</DialogDescription></DialogHeader>
          {detailsResponses.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow><TableHead>Technician</TableHead><TableHead>Avg</TableHead><TableHead>Comm.</TableHead><TableHead>Avail.</TableHead><TableHead>Install</TableHead><TableHead>Reliab.</TableHead><TableHead>Problem</TableHead><TableHead>Safety</TableHead><TableHead>Overall</TableHead><TableHead>Notes</TableHead></TableRow></TableHeader>
                <TableBody>
                  {detailsResponses.map(r => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.technicianName}</TableCell>
                      <TableCell>{r.calculatedScore?.toFixed(2) ?? '—'}</TableCell>
                      <TableCell><StarRatingDisplay rating={r.communicationSkills} /></TableCell>
                      <TableCell><StarRatingDisplay rating={r.availability} /></TableCell>
                      <TableCell><StarRatingDisplay rating={r.installQuality} /></TableCell>
                      <TableCell><StarRatingDisplay rating={r.reliability} /></TableCell>
                      <TableCell><StarRatingDisplay rating={r.problemSolving} /></TableCell>
                      <TableCell><StarRatingDisplay rating={r.safetyCompliance} /></TableCell>
                      <TableCell><StarRatingDisplay rating={r.overallPerformance} /></TableCell>
                      <TableCell className="text-sm text-gray-600 max-w-xs"><div className="break-words whitespace-pre-wrap">{r.additionalNotes || '—'}</div></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : <div className="text-center py-8 text-gray-500"><Mail className="w-12 h-12 mx-auto mb-3 opacity-50" /><p>No responses yet for this survey.</p></div>}
          <DialogFooter><Button variant="outline" onClick={() => setShowDetails(false)}>Close</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---- Delete confirm ---- */}
      <Dialog open={showDelete} onOpenChange={setShowDelete}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete survey?</DialogTitle><DialogDescription>{selectedSurveys.size > 0 ? `Permanently delete ${selectedSurveys.size} survey(s) and their responses.` : `Permanently delete the survey "${selectedSurvey?.projectName}" and its responses.`}</DialogDescription></DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDelete(false)}>Cancel</Button>
            <Button variant="destructive" onClick={() => selectedSurveys.size > 0 ? bulkDelete() : deleteSurvey(selectedSurvey.id)} disabled={isWorking}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
