import { useEffect, useState, useRef } from 'react';
import { getStatusDisplay } from '../utils/callStatus';
import { Link, useParams, useNavigate } from 'react-router-dom';
import {
  Phone, ArrowLeft, Trash2, Download, ShieldCheck, Play, Pause,
  Loader2, Volume2, PhoneOutgoing, PhoneIncoming, ClipboardCheck,
  FileText, Zap, Calendar, Clock, Globe,
} from 'lucide-react';
import axios from 'axios';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import Layout from '../components/Layout';

// ── Types ─────────────────────────────────────────────────────────────────────

interface CallAction { type: string; description: string }

interface CallDetailItem {
  id: string;
  caller_number?: string | null;
  created_at: string;
  duration?: number | null;
  status: string;
  summary?: string | null;
  intent?: string | null;
  transcription_text?: string | null;
  transcription_segments?: Array<{ role: 'client' | 'agent'; text: string; ts?: number }> | null;
  live_transcript?: string | null;
  language?: string | null;
  confidence?: number | null;
  recording_url?: string | null;
  actions?: CallAction[];
  direction?: string | null;
}

type TranscriptSegment = { role: 'client' | 'agent'; text: string; ts?: number };

// ── Helpers ───────────────────────────────────────────────────────────────────

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function parseTranscriptSegments(raw: string | null | undefined): TranscriptSegment[] | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0 && 'role' in parsed[0]) return parsed as TranscriptSegment[];
  } catch { /* plain text */ }
  return null;
}

function parseTranscriptTextWithPrefixes(text: string | null | undefined): TranscriptSegment[] | null {
  if (!text || !text.trim()) return null;
  const lines = text.split(/\n+/).filter(l => l.trim());
  const segments: TranscriptSegment[] = [];
  for (const line of lines) {
    const match = line.trim().match(/^(Client|Agent)\s*:\s*(.+)$/i);
    if (match) {
      segments.push({ role: match[1].toLowerCase() === 'agent' ? 'agent' : 'client', text: match[2].trim() });
    }
  }
  return segments.length > 0 ? segments : null;
}

function normalizeQaResults(rows: Record<string, unknown>[]) {
  return rows.map(r => ({
    id: r.id as string,
    templateName: (r.template_name ?? r.templateName ?? '—') as string,
    globalScore: Number(r.global_score ?? r.globalScore ?? 0),
    flags: Array.isArray(r.flags) ? r.flags as string[] : [],
    processedAt: (r.processed_at ?? r.processedAt ?? '') as string,
  }));
}

function formatDuration(seconds?: number | null): string {
  if (!seconds || seconds === 0) return '—';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function formatAudioTime(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '0:00';
  const minutes = Math.floor(value / 60);
  const seconds = Math.floor(value % 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function qaScoreClass(score: number): string {
  if (score >= 70) return 'bg-[#2D9D78]/10 text-[#2D9D78]';
  if (score >= 50) return 'bg-[#E6A817]/12 text-[#E6A817]';
  return 'bg-[#D94052]/10 text-[#D94052]';
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function CallDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const isValidCallId = !!id && uuidPattern.test(id);

  const [call, setCall] = useState<CallDetailItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  // Audio
  const [recordingBlobUrl, setRecordingBlobUrl] = useState<string | null>(null);
  const [recordingLoading, setRecordingLoading] = useState(false);
  const [recordingError, setRecordingError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isVolumeOpen, setIsVolumeOpen] = useState(false);

  // Click-to-call
  const [staff, setStaff] = useState<{ id: string; first_name: string; last_name: string; phone_number: string; role: string }[]>([]);
  const [selectedStaffId, setSelectedStaffId] = useState('');
  const [dialing, setDialing] = useState(false);
  const [dialResult, setDialResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // QA
  const [qaTemplates, setQaTemplates] = useState<{ id: string; name: string; isActive: boolean }[]>([]);
  const [qaResults, setQaResults] = useState<{ id: string; templateName: string; globalScore: number; flags: string[]; processedAt: string }[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [qaAnalyzing, setQaAnalyzing] = useState(false);
  const [qaMessage, setQaMessage] = useState<{ type: 'success' | 'error'; text: string; canForce?: boolean } | null>(null);

  // ── Effects ────────────────────────────────────────────────────────────────

  useEffect(() => {
    axios.get('/api/staff').then((res) => {
      const enabled = (res.data.staff || []).filter((s: { enabled: boolean }) => s.enabled);
      setStaff(enabled);
      if (enabled.length > 0) setSelectedStaffId(enabled[0].id);
    }).catch(() => {});
    axios.get('/api/qa/templates').then((res) => {
      const active = (res.data.templates || []).filter((t: { isActive: boolean }) => t.isActive);
      setQaTemplates(active);
      if (active.length > 0) setSelectedTemplateId(active[0].id);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!isValidCallId || !id) return;
    axios.get(`/api/qa/results/${id}`).then((res) => {
      setQaResults(normalizeQaResults(res.data.results || []));
    }).catch(() => {});
  }, [id, isValidCallId]);

  useEffect(() => {
    if (!isValidCallId || !id) { setCall(null); setLoading(false); return; }
    axios.get(`/api/calls/${id}`)
      .then((res) => setCall(res.data.call as CallDetailItem))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id, isValidCallId]);

  useEffect(() => {
    let objectUrl: string | null = null;
    const fetchRecording = async () => {
      if (!call?.recording_url || !id || !isValidCallId) {
        setRecordingBlobUrl(null); setRecordingLoading(false); setIsPlaying(false);
        setIsVolumeOpen(false); setCurrentTime(0); setAudioDuration(0);
        return;
      }
      setRecordingLoading(true);
      try {
        setRecordingError(null);
        const response = await axios.get(`/api/calls/${id}/recording`, { responseType: 'blob' });
        objectUrl = URL.createObjectURL(response.data);
        setRecordingBlobUrl(objectUrl);
      } catch (error: unknown) {
        const msg = (error as { response?: { data?: { error?: string } }; message?: string })?.response?.data?.error
          || (error as { message?: string })?.message || 'Erreur de chargement';
        setRecordingError(msg);
        setRecordingBlobUrl(null);
      } finally { setRecordingLoading(false); }
    };
    void fetchRecording();
    return () => {
      setIsPlaying(false); setIsVolumeOpen(false); setCurrentTime(0); setAudioDuration(0);
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [call?.recording_url, id, isValidCallId]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleTogglePlayback = async () => {
    if (!audioRef.current) return;
    if (isPlaying) { audioRef.current.pause(); return; }
    try { await audioRef.current.play(); } catch { setIsPlaying(false); }
  };

  const handleSeek = (value: number) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = value;
    setCurrentTime(value);
  };

  const handleVolumeChange = (value: number) => {
    const v = Math.max(0, Math.min(1, value));
    setVolume(v);
    if (audioRef.current) audioRef.current.volume = v;
  };

  const handleAnalyze = async (force = false) => {
    if (!id || !selectedTemplateId) return;
    setQaAnalyzing(true); setQaMessage(null);
    try {
      await axios.post(`/api/qa/analyze/${id}`, { templateId: selectedTemplateId, force });
      setQaMessage({ type: 'success', text: 'Analyse terminée avec succès.' });
      const res = await axios.get(`/api/qa/results/${id}`);
      setQaResults(normalizeQaResults(res.data.results || []));
    } catch (err: unknown) {
      const e = err as { response?: { status?: number; data?: { error?: string } } };
      if (e?.response?.status === 409) {
        setQaMessage({ type: 'error', text: 'Déjà analysé avec ce template.', canForce: true });
      } else {
        setQaMessage({ type: 'error', text: e?.response?.data?.error || "Erreur lors de l'analyse." });
      }
    } finally { setQaAnalyzing(false); }
  };

  const handleDial = async () => {
    if (!selectedStaffId || !id) return;
    setDialing(true); setDialResult(null);
    try {
      await axios.post(`/api/staff/${selectedStaffId}/call/${id}`);
      setDialResult({ type: 'success', message: "Appel initié. Le client va être contacté et transféré à l'agent." });
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      setDialResult({ type: 'error', message: e?.response?.data?.error || "Erreur lors du déclenchement de l'appel." });
    } finally { setDialing(false); }
  };

  const handleDelete = async () => {
    if (!id || !isValidCallId) return;
    if (!confirm('Supprimer définitivement cet appel ?')) return;
    setDeleting(true);
    try {
      await axios.delete(`/api/calls/${id}`);
      navigate('/dashboard');
    } catch { alert('Erreur lors de la suppression'); }
    finally { setDeleting(false); }
  };

  // ── Loading / error states ──────────────────────────────────────────────────

  if (loading) {
    return (
      <Layout>
        <div className="flex h-[50vh] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-[#344453]/30" />
        </div>
      </Layout>
    );
  }

  if (!call) {
    return (
      <Layout>
        <div className="rounded-2xl border border-dashed border-[#344453]/15 bg-[#344453]/4 px-6 py-12 text-center">
          <p className="text-base font-medium text-[#141F28]">Appel non trouvé</p>
          <p className="mt-1 text-sm text-[#344453]/50">Ce détail n'est plus disponible.</p>
          <Link to="/dashboard" className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-[#344453] hover:underline">
            <ArrowLeft className="h-4 w-4" /> Retour aux opérations
          </Link>
        </div>
      </Layout>
    );
  }

  const status = getStatusDisplay(call.status);
  const isInbound = !call.direction || call.direction === 'inbound';
  const segments = call.transcription_segments
    || parseTranscriptSegments(call.live_transcript)
    || parseTranscriptTextWithPrefixes(call.transcription_text);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <Layout>
      <div className="space-y-4">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-[#344453]/10 bg-white px-4 py-3 shadow-sm">
          <button
            onClick={() => navigate('/dashboard')}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#344453]/15 px-3 py-1.5 text-xs font-medium text-[#344453]/60 hover:bg-[#344453]/6 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Opérations
          </button>

          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#344453]/8 text-[#344453]">
              {isInbound ? <PhoneIncoming className="h-4 w-4" /> : <PhoneOutgoing className="h-4 w-4" />}
            </div>
            <p className="text-sm font-semibold text-[#141F28] truncate">
              {call.caller_number || 'Numéro inconnu'}
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${status.color}`}>
              {status.label}
            </span>
            <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${
              isInbound ? 'bg-[#344453]/8 text-[#344453]/65' : 'bg-[#C7601D]/10 text-[#C7601D]'
            }`}>
              {isInbound ? <PhoneIncoming className="h-3 w-3" /> : <PhoneOutgoing className="h-3 w-3" />}
              {isInbound ? 'Entrant' : 'Sortant'}
            </span>
            {qaResults.length > 0 && (
              <Link
                to={`/calls/${id}/qa`}
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${qaScoreClass(qaResults[0].globalScore)}`}
              >
                <Zap className="h-3 w-3" />
                {qaResults[0].globalScore}/100
              </Link>
            )}
          </div>

          <div className="flex items-center gap-2 ml-auto">
            {qaResults.length > 0 && (
              <Link
                to={`/calls/${id}/qa`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#344453]/15 px-3 py-1.5 text-xs font-medium text-[#344453]/60 hover:bg-[#344453]/6 transition-colors"
              >
                <ClipboardCheck className="h-3.5 w-3.5" />
                Rapport QA
              </Link>
            )}
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#D94052]/20 px-3 py-1.5 text-xs font-medium text-[#D94052] hover:bg-[#D94052]/8 transition-colors disabled:opacity-40"
            >
              {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              Supprimer
            </button>
          </div>
        </div>

        {/* ── Body ───────────────────────────────────────────────────────── */}
        <div className="grid gap-4 lg:grid-cols-[280px_1fr]">

          {/* ── Left column: metadata + tools ─────────────────────────── */}
          <div className="space-y-4">

            {/* Metadata table */}
            <div className="rounded-2xl border border-[#344453]/10 bg-white shadow-sm overflow-hidden">
              <div className="border-b border-[#344453]/8 px-4 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#344453]/40" style={{ fontFamily: 'var(--font-mono)' }}>
                  Informations
                </p>
              </div>
              <div className="divide-y divide-[#344453]/6">
                {[
                  {
                    icon: Phone,
                    label: 'Numéro',
                    value: call.caller_number || 'Inconnu',
                  },
                  {
                    icon: Calendar,
                    label: 'Date',
                    value: format(new Date(call.created_at), 'dd/MM/yyyy HH:mm', { locale: fr }),
                  },
                  {
                    icon: Clock,
                    label: 'Durée',
                    value: formatDuration(call.duration),
                  },
                  ...(call.language ? [{
                    icon: Globe,
                    label: 'Langue',
                    value: call.language.toUpperCase() + (call.confidence ? ` · ${(call.confidence * 100).toFixed(0)}%` : ''),
                  }] : []),
                ].map((row) => {
                  const Icon = row.icon;
                  return (
                    <div key={row.label} className="flex items-center gap-3 px-4 py-2.5">
                      <Icon className="h-3.5 w-3.5 shrink-0 text-[#344453]/30" />
                      <span className="text-xs text-[#344453]/45 w-14 shrink-0">{row.label}</span>
                      <span className="text-xs font-medium text-[#141F28] truncate" style={{ fontFamily: 'var(--font-mono)' }}>
                        {row.value}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Click-to-call */}
            <div className="rounded-2xl border border-[#344453]/10 bg-white shadow-sm overflow-hidden">
              <div className="border-b border-[#344453]/8 px-4 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#344453]/40" style={{ fontFamily: 'var(--font-mono)' }}>
                  Rappeler ce numéro
                </p>
              </div>
              <div className="p-4 space-y-3">
                {staff.length === 0 ? (
                  <p className="text-xs text-[#344453]/50">
                    Aucun agent actif.{' '}
                    <Link to="/staff" className="text-[#C7601D] hover:underline">Configurer l'équipe →</Link>
                  </p>
                ) : (
                  <>
                    <select
                      value={selectedStaffId}
                      onChange={(e) => setSelectedStaffId(e.target.value)}
                      className="w-full rounded-xl border border-[#344453]/15 bg-white px-3 py-2 text-xs text-[#141F28] outline-none focus:border-[#344453]/30"
                    >
                      {staff.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.first_name} {s.last_name} — {s.role}
                        </option>
                      ))}
                    </select>
                    {dialResult && (
                      <div className={`rounded-xl border px-3 py-2 text-xs font-medium ${
                        dialResult.type === 'success'
                          ? 'border-[#2D9D78]/25 bg-[#2D9D78]/8 text-[#2D9D78]'
                          : 'border-[#D94052]/20 bg-[#D94052]/6 text-[#D94052]'
                      }`}>
                        {dialResult.message}
                      </div>
                    )}
                    <button
                      onClick={handleDial}
                      disabled={dialing || !selectedStaffId}
                      className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#344453] px-4 py-2 text-xs font-semibold text-white hover:bg-[#2a3642] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      {dialing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PhoneOutgoing className="h-3.5 w-3.5" />}
                      {dialing ? 'Appel en cours…' : 'Rappeler le client'}
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* QA */}
            <div className="rounded-2xl border border-[#344453]/10 bg-white shadow-sm overflow-hidden">
              <div className="flex items-center justify-between border-b border-[#344453]/8 px-4 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#344453]/40" style={{ fontFamily: 'var(--font-mono)' }}>
                  Analyse QA
                </p>
                {qaResults.length > 0 && (
                  <Link
                    to={`/calls/${id}/qa`}
                    className="text-[10px] font-medium text-[#344453]/50 hover:text-[#344453] transition-colors"
                  >
                    Rapport complet →
                  </Link>
                )}
              </div>
              <div className="p-4 space-y-3">
                {qaTemplates.length === 0 ? (
                  <p className="text-xs text-[#344453]/50">
                    Aucun template actif.{' '}
                    <Link to="/settings/qa" className="text-[#C7601D] hover:underline">Configurer →</Link>
                  </p>
                ) : (
                  <div className="flex flex-col gap-2">
                    <select
                      value={selectedTemplateId}
                      onChange={e => setSelectedTemplateId(e.target.value)}
                      className="w-full rounded-xl border border-[#344453]/15 bg-white px-3 py-2 text-xs text-[#141F28] outline-none focus:border-[#344453]/30"
                    >
                      {qaTemplates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                    <button
                      onClick={() => handleAnalyze()}
                      disabled={qaAnalyzing || !selectedTemplateId}
                      className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#344453] px-4 py-2 text-xs font-semibold text-white hover:bg-[#2a3642] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      {qaAnalyzing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ClipboardCheck className="h-3.5 w-3.5" />}
                      {qaAnalyzing ? 'Analyse…' : "Lancer l'analyse"}
                    </button>
                  </div>
                )}

                {qaMessage && (
                  <div className={`rounded-xl border px-3 py-2 text-xs ${
                    qaMessage.type === 'success'
                      ? 'border-[#2D9D78]/25 bg-[#2D9D78]/8 text-[#2D9D78]'
                      : 'border-[#D94052]/20 bg-[#D94052]/6 text-[#D94052]'
                  }`}>
                    {qaMessage.text}
                    {qaMessage.canForce && (
                      <button
                        onClick={() => handleAnalyze(true)}
                        disabled={qaAnalyzing}
                        className="ml-2 underline opacity-70 hover:opacity-100"
                      >
                        Relancer quand même
                      </button>
                    )}
                  </div>
                )}

                {qaResults.length > 0 && (
                  <div className="space-y-2 pt-1">
                    {qaResults.map(r => (
                      <Link
                        key={r.id}
                        to={`/calls/${id}/qa`}
                        className="flex items-center justify-between gap-3 rounded-xl border border-[#344453]/10 px-3 py-2.5 hover:border-[#344453]/20 hover:bg-[#344453]/2 transition-colors"
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-[#141F28] truncate">{r.templateName}</p>
                          <p className="text-[10px] text-[#344453]/40 mt-0.5" style={{ fontFamily: 'var(--font-mono)' }}>
                            {r.processedAt ? new Date(r.processedAt).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : '—'}
                          </p>
                        </div>
                        <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${qaScoreClass(r.globalScore)}`}>
                          {r.globalScore}/100
                        </span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Actions */}
            {call.actions && call.actions.length > 0 && (
              <div className="rounded-2xl border border-[#344453]/10 bg-white shadow-sm overflow-hidden">
                <div className="border-b border-[#344453]/8 px-4 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#344453]/40" style={{ fontFamily: 'var(--font-mono)' }}>
                    Actions effectuées
                  </p>
                </div>
                <div className="divide-y divide-[#344453]/6">
                  {call.actions.map((action, i) => (
                    <div key={i} className="px-4 py-2.5">
                      <p className="text-xs font-semibold text-[#141F28]">{action.type}</p>
                      <p className="text-xs text-[#344453]/55 mt-0.5">{action.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ── Right column: content ──────────────────────────────────── */}
          <div className="space-y-4">

            {/* Résumé IA */}
            {call.summary && (
              <div className="rounded-2xl border border-[#344453]/10 bg-white shadow-sm overflow-hidden">
                <div className="flex items-center gap-2 border-b border-[#344453]/8 px-4 py-3">
                  <FileText className="h-3.5 w-3.5 text-[#2D9D78]" />
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#344453]/40" style={{ fontFamily: 'var(--font-mono)' }}>
                    Résumé IA
                  </p>
                  {call.intent && (
                    <span className="ml-auto inline-flex items-center rounded-full bg-[#C7601D]/10 px-2.5 py-1 text-[10px] font-medium text-[#C7601D]">
                      {call.intent}
                    </span>
                  )}
                </div>
                <div className="px-4 py-4">
                  <p className="text-sm leading-7 text-[#344453]/70 whitespace-pre-wrap">{call.summary}</p>
                </div>
                {call.language && (
                  <div className="border-t border-[#344453]/8 px-4 py-2 flex items-center gap-1.5 text-xs text-[#2D9D78]">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Langue : {call.language.toUpperCase()}
                    {call.confidence ? ` · Confiance : ${(call.confidence * 100).toFixed(0)}%` : ''}
                  </div>
                )}
              </div>
            )}

            {/* Transcription */}
            {(segments || call.transcription_text !== undefined) && (
              <div className="rounded-2xl border border-[#344453]/10 bg-white shadow-sm overflow-hidden">
                <div className="border-b border-[#344453]/8 px-4 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#344453]/40" style={{ fontFamily: 'var(--font-mono)' }}>
                    Transcription
                  </p>
                </div>
                <div className="px-4 py-4 max-h-[500px] overflow-y-auto">
                  {segments ? (
                    <div className="space-y-2">
                      {segments.map((seg, i) => (
                        <div key={i} className={`flex gap-2 ${seg.role === 'agent' ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-6 ${
                            seg.role === 'agent'
                              ? 'bg-[#344453] text-white rounded-br-md'
                              : 'bg-[#F8F9FB] text-[#344453]/80 rounded-bl-md border border-[#344453]/8'
                          }`}>
                            <p className={`mb-0.5 text-[10px] font-semibold uppercase tracking-widest ${
                              seg.role === 'agent' ? 'text-white/50' : 'text-[#344453]/40'
                            }`}>
                              {seg.role === 'agent' ? 'Agent' : 'Client'}
                            </p>
                            {seg.text}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : call.transcription_text?.trim() ? (
                    <p className="whitespace-pre-wrap text-sm leading-7 text-[#344453]/65">{call.transcription_text}</p>
                  ) : (
                    <p className="text-sm italic text-[#344453]/40">Aucune parole détectée dans l'enregistrement.</p>
                  )}
                </div>
              </div>
            )}

            {/* Audio */}
            {call.recording_url && (
              <div className="rounded-2xl border border-[#344453]/10 bg-white shadow-sm overflow-hidden">
                <div className="border-b border-[#344453]/8 px-4 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#344453]/40" style={{ fontFamily: 'var(--font-mono)' }}>
                    Enregistrement audio
                  </p>
                </div>
                <div className="px-4 py-4">
                  {recordingLoading && (
                    <div className="flex items-center gap-2 text-xs text-[#344453]/50">
                      <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
                    </div>
                  )}
                  {!recordingLoading && recordingError && (
                    <div className="rounded-xl border border-[#D94052]/20 bg-[#D94052]/6 px-3 py-2 text-xs text-[#D94052]">
                      <p className="font-medium">Erreur de chargement</p>
                      <p className="mt-0.5 opacity-80">{recordingError}</p>
                    </div>
                  )}
                  {!recordingLoading && !recordingError && recordingBlobUrl && (
                    <>
                      <audio
                        ref={audioRef}
                        src={recordingBlobUrl}
                        onLoadedData={() => { if (audioRef.current) audioRef.current.volume = volume; }}
                        onLoadedMetadata={(e) => {
                          const d = Number.isFinite(e.currentTarget.duration) ? e.currentTarget.duration : 0;
                          setAudioDuration(d);
                        }}
                        onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
                        onPause={() => setIsPlaying(false)}
                        onPlay={() => setIsPlaying(true)}
                        onEnded={() => {
                          setIsPlaying(false); setCurrentTime(0);
                          if (audioRef.current) audioRef.current.currentTime = 0;
                        }}
                        className="hidden"
                      />
                      <div className="flex items-center gap-3">
                        <button
                          onClick={handleTogglePlayback}
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#344453] text-white shadow-sm hover:bg-[#2a3642] transition-colors"
                        >
                          {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="ml-0.5 h-4 w-4" />}
                        </button>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between text-xs text-[#344453]/45 mb-1.5" style={{ fontFamily: 'var(--font-mono)' }}>
                            <span>{formatAudioTime(currentTime)}</span>
                            <span>{formatAudioTime(audioDuration)}</span>
                          </div>
                          <input
                            type="range" min={0} max={audioDuration || 0} step={0.1}
                            value={Math.min(currentTime, audioDuration || 0)}
                            onChange={(e) => handleSeek(Number(e.target.value))}
                            className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-[#344453]/12 accent-[#344453]"
                          />
                        </div>
                        <div className="relative shrink-0">
                          <button
                            onClick={() => setIsVolumeOpen(v => !v)}
                            className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#344453]/15 text-[#344453]/50 hover:bg-[#344453]/6 transition-colors"
                          >
                            <Volume2 className="h-3.5 w-3.5" />
                          </button>
                          {isVolumeOpen && (
                            <div className="absolute bottom-10 right-0 z-10 rounded-xl border border-[#344453]/12 bg-white p-3 shadow-lg">
                              <input
                                type="range" min={0} max={1} step={0.01} value={volume}
                                onChange={(e) => handleVolumeChange(Number(e.target.value))}
                                className="h-20 w-1.5 cursor-pointer appearance-none rounded-full bg-[#344453]/12 accent-[#344453]"
                                style={{ writingMode: 'vertical-lr', direction: 'rtl' }}
                              />
                            </div>
                          )}
                        </div>
                        <a
                          href={recordingBlobUrl}
                          download={`appel-${call.id}.mp3`}
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#344453]/15 text-[#344453]/50 hover:bg-[#344453]/6 transition-colors"
                          title="Télécharger"
                        >
                          <Download className="h-3.5 w-3.5" />
                        </a>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
