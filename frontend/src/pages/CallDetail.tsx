import { useEffect, useState } from 'react';
import { getStatusDisplay } from '../utils/callStatus';
import { useParams, useNavigate } from 'react-router-dom';
import { useRef } from 'react';
import { Phone, Clock, Calendar, ArrowLeft, Trash2, Download, Sparkles, ShieldCheck, Play, Pause, Loader2, Volume2, PhoneOutgoing, PhoneIncoming, ChevronDown, ClipboardCheck } from 'lucide-react';
import axios from 'axios';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import Layout from '../components/Layout';

interface CallAction {
  type: string;
  description: string;
}

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

function parseTranscriptSegments(raw: string | null | undefined): TranscriptSegment[] | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0 && 'role' in parsed[0]) return parsed as TranscriptSegment[];
  } catch { /* plain text */ }
  return null;
}

// Parse text format like "Client: ...\n\nAgent: ..." into segments
function parseTranscriptTextWithPrefixes(text: string | null | undefined): TranscriptSegment[] | null {
  if (!text || !text.trim()) return null;

  const lines = text.split(/\n+/).filter(l => l.trim());
  const segments: TranscriptSegment[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    // Match "Client:" or "Agent:" at the start
    const match = trimmed.match(/^(Client|Agent)\s*:\s*(.+)$/i);
    if (match) {
      const role = match[1].toLowerCase() === 'agent' ? 'agent' : 'client';
      segments.push({ role, text: match[2].trim() });
    }
  }

  return segments.length > 0 ? segments : null;
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function normalizeQaResults(rows: Record<string, unknown>[]) {
  return rows.map(r => ({
    id: r.id as string,
    templateName: (r.template_name ?? r.templateName ?? '—') as string,
    globalScore: Number(r.global_score ?? r.globalScore ?? 0),
    flags: Array.isArray(r.flags) ? r.flags as string[] : [],
    processedAt: (r.processed_at ?? r.processedAt ?? '') as string,
  }));
}

export default function CallDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const isValidCallId = !!id && uuidPattern.test(id);
  const [call, setCall] = useState<CallDetailItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [recordingBlobUrl, setRecordingBlobUrl] = useState<string | null>(null);
  const [recordingLoading, setRecordingLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isVolumeOpen, setIsVolumeOpen] = useState(false);
  const [staff, setStaff] = useState<{ id: string; first_name: string; last_name: string; phone_number: string; role: string }[]>([]);
  const [selectedStaffId, setSelectedStaffId] = useState('');
  const [dialing, setDialing] = useState(false);
  const [dialResult, setDialResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [showDialPanel, setShowDialPanel] = useState(false);

  // QA
  const [qaTemplates, setQaTemplates] = useState<{ id: string; name: string; isActive: boolean }[]>([]);
  const [qaResults, setQaResults] = useState<{ id: string; templateName: string; globalScore: number; flags: string[]; processedAt: string }[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [qaAnalyzing, setQaAnalyzing] = useState(false);
  const [qaMessage, setQaMessage] = useState<{ type: 'success' | 'error'; text: string; canForce?: boolean } | null>(null);

  useEffect(() => {
    axios.get('/api/staff').then((res) => {
      const enabled = (res.data.staff || []).filter((s: any) => s.enabled);
      setStaff(enabled);
      if (enabled.length > 0) setSelectedStaffId(enabled[0].id);
    }).catch(() => {});

    // Charger les templates QA actifs
    axios.get('/api/qa/templates').then((res) => {
      const active = (res.data.templates || []).filter((t: any) => t.isActive);
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

  const handleAnalyze = async (force = false) => {
    if (!id || !selectedTemplateId) return;
    setQaAnalyzing(true);
    setQaMessage(null);
    try {
      await axios.post(`/api/qa/analyze/${id}`, { templateId: selectedTemplateId, force });
      setQaMessage({ type: 'success', text: 'Analyse terminée avec succès.' });
      const res = await axios.get(`/api/qa/results/${id}`);
      setQaResults(normalizeQaResults(res.data.results || []));
    } catch (err: any) {
      if (err?.response?.status === 409) {
        setQaMessage({
          type: 'error',
          text: 'Cet appel a déjà été analysé avec ce template.',
          canForce: true,
        });
      } else {
        setQaMessage({ type: 'error', text: err?.response?.data?.error || 'Erreur lors de l\'analyse.' });
      }
    } finally {
      setQaAnalyzing(false);
    }
  };

  const handleDial = async () => {
    if (!selectedStaffId || !id) return;
    setDialing(true);
    setDialResult(null);
    try {
      await axios.post(`/api/staff/${selectedStaffId}/call/${id}`);
      setDialResult({ type: 'success', message: 'Appel initié. Le client va être contacté et transféré à l\'agent.' });
    } catch (err: any) {
      setDialResult({ type: 'error', message: err?.response?.data?.error || 'Erreur lors du déclenchement de l\'appel.' });
    } finally {
      setDialing(false);
    }
  };

  useEffect(() => {
    if (!isValidCallId) {
      setCall(null);
      setLoading(false);
      return;
    }

    fetchCallDetail();
  }, [id, isValidCallId]);

  useEffect(() => {
    let objectUrl: string | null = null;

    const fetchRecording = async () => {
      if (!call?.recording_url || !id || !isValidCallId) {
        setRecordingBlobUrl(null);
        setRecordingLoading(false);
        setIsPlaying(false);
        setIsVolumeOpen(false);
        setCurrentTime(0);
        setAudioDuration(0);
        return;
      }

      setRecordingLoading(true);

      try {
        const response = await axios.get(`/api/calls/${id}/recording`, {
          responseType: 'blob',
        });

        objectUrl = URL.createObjectURL(response.data);
        setRecordingBlobUrl(objectUrl);
      } catch (error) {
        console.error('Error fetching call recording:', error);
        setRecordingBlobUrl(null);
      } finally {
        setRecordingLoading(false);
      }
    };

    fetchRecording();

    return () => {
      setIsPlaying(false);
      setIsVolumeOpen(false);
      setCurrentTime(0);
      setAudioDuration(0);
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [call?.recording_url, id, isValidCallId]);

  const handleTogglePlayback = async () => {
    if (!audioRef.current) {
      return;
    }

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
      return;
    }

    try {
      await audioRef.current.play();
      setIsPlaying(true);
    } catch (error) {
      console.error('Error playing audio:', error);
      setIsPlaying(false);
    }
  };

  const handleSeek = (value: number) => {
    if (!audioRef.current) {
      return;
    }

    audioRef.current.currentTime = value;
    setCurrentTime(value);
  };

  const handleVolumeChange = (value: number) => {
    const nextVolume = Math.max(0, Math.min(1, value));
    setVolume(nextVolume);

    if (audioRef.current) {
      audioRef.current.volume = nextVolume;
    }
  };

  const fetchCallDetail = async () => {
    if (!id || !isValidCallId) {
      setCall(null);
      setLoading(false);
      return;
    }

    try {
      const response = await axios.get(`/api/calls/${id}`);
      setCall(response.data.call as CallDetailItem);
    } catch (error) {
      console.error('Error fetching call detail:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!id || !isValidCallId) return;
    if (!confirm('Êtes-vous sûr de vouloir supprimer cet appel ?')) return;
    
    setDeleting(true);
    try {
      await axios.delete(`/api/calls/${id}`);
      navigate('/calls');
    } catch (error) {
      console.error('Error deleting call:', error);
      alert('Erreur lors de la suppression');
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex h-[50vh] items-center justify-center">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="h-12 w-12 animate-spin rounded-full border-2 border-[#344453]/10 border-t-[#344453]" />
            <p className="text-sm font-medium text-[#344453]/50">Chargement de l’appel…</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (!call) {
    return (
      <Layout>
        <div className="rounded-[28px] border border-dashed border-[#344453]/15 bg-[#344453]/4 px-6 py-12 text-center">
          <p className="text-lg font-semibold text-[#141F28]">Appel non trouvé</p>
          <p className="mt-2 text-sm text-[#344453]/55">Ce détail n'est plus disponible ou n'existe pas.</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-5 sm:space-y-6">
        <section className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="overflow-hidden rounded-[28px] border border-[#344453]/15 bg-[#141F28] p-5 text-white shadow-[0_24px_60px_rgba(20,31,40,0.18)] sm:p-7">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <button
                  onClick={() => navigate('/calls')}
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/70 transition hover:bg-white/10"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Retour aux appels
                </button>

                <div className="mt-8 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-white/50" style={{ fontFamily: "var(--font-mono)" }}>
                  <Sparkles className="h-3.5 w-3.5" />
                  Détail d'appel
                </div>

                <div className="mt-5 space-y-3">
                  <h1 className="text-3xl font-semibold tracking-[-0.03em] text-white sm:text-4xl" style={{ fontFamily: "var(--font-title)" }}>
                    {call.caller_number || 'Numéro inconnu'}
                  </h1>
                  <p className="max-w-2xl text-sm leading-7 text-white/60 sm:text-base">
                    Consultez le contexte complet de l’échange, sa synthèse, sa transcription et les éventuelles actions associées dans une vue claire et mobile first.
                  </p>
                </div>
              </div>

              <button
                onClick={handleDelete}
                disabled={deleting}
                className="inline-flex items-center justify-center gap-2 rounded-full border border-red-300/40 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
                {deleting ? 'Suppression...' : 'Supprimer'}
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-4">
          {/* Click-to-call panel */}
          <div className="rounded-[28px] border border-[#344453]/10 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-center justify-between">
              <p className="text-[11px] uppercase tracking-[0.24em] text-[#344453]/45" style={{ fontFamily: 'var(--font-mono)' }}>Rappeler ce numéro</p>
              <button
                onClick={() => setShowDialPanel((v) => !v)}
                className="inline-flex items-center gap-1.5 rounded-full border border-[#344453]/15 bg-[#344453]/5 px-3 py-1.5 text-xs font-medium text-[#344453] transition hover:bg-[#344453]/10"
              >
                <PhoneOutgoing className="h-3.5 w-3.5" />
                {showDialPanel ? 'Fermer' : 'Initier un appel'}
                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showDialPanel ? 'rotate-180' : ''}`} />
              </button>
            </div>

            {showDialPanel && (
              <div className="mt-4 space-y-3">
                {staff.length === 0 ? (
                  <p className="rounded-2xl bg-[#344453]/5 px-4 py-3 text-sm text-[#344453]/55">
                    Aucun agent actif. <a href="/staff" className="font-medium text-[#C7601D] hover:underline">Configurer l'équipe →</a>
                  </p>
                ) : (
                  <>
                    <div>
                      <label className="block text-xs font-medium text-[#344453]/60">Transférer vers</label>
                      <div className="mt-1.5 flex items-center gap-2 rounded-2xl border border-[#344453]/12 bg-[#F8F9FB] px-4 py-3 focus-within:border-[#344453]/25 focus-within:bg-white">
                        <Phone className="h-4 w-4 shrink-0 text-[#344453]/35" />
                        <select
                          value={selectedStaffId}
                          onChange={(e) => setSelectedStaffId(e.target.value)}
                          className="w-full bg-transparent text-sm text-[#141F28] outline-none"
                        >
                          {staff.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.first_name} {s.last_name} — {s.role} ({s.phone_number})
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {dialResult && (
                      <div className={`rounded-2xl border px-4 py-3 text-sm font-medium ${
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
                      className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#C7601D] px-5 py-3 text-sm font-semibold text-white shadow-[0_4px_14px_rgba(199,96,29,0.28)] transition hover:bg-[#b35519] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {dialing ? (
                        <><Loader2 className="h-4 w-4 animate-spin" /> Appel en cours…</>
                      ) : (
                        <><PhoneOutgoing className="h-4 w-4" /> Rappeler le client</>
                      )}
                    </button>
                    <p className="text-center text-xs text-[#344453]/40">
                      Twilio appellera {call?.caller_number || 'le numéro'} et le transférera à l'agent choisi.
                    </p>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="rounded-[28px] border border-[#344453]/10 bg-white p-5 shadow-sm sm:p-6">
            <p className="text-[11px] uppercase tracking-[0.24em] text-[#344453]/45" style={{ fontFamily: "var(--font-mono)" }}>Repères rapides</p>
            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-2xl bg-[#344453]/6 px-4 py-4">
                <p className="text-sm text-[#344453]/50">Statut</p>
                <span className={`mt-2 inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${
                  getStatusDisplay(call.status).color
                }`}>
                  {getStatusDisplay(call.status).label}
                </span>
              </div>

              <div className="rounded-2xl bg-[#344453]/6 px-4 py-4">
                <p className="text-sm text-[#344453]/50">Direction</p>
                <span className={`mt-2 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${call.direction === 'outbound' ? 'bg-[#C7601D]/12 text-[#C7601D]' : 'bg-[#344453]/10 text-[#344453]'}`}>
                  {call.direction === 'outbound' ? <PhoneOutgoing className="h-3.5 w-3.5" /> : <PhoneIncoming className="h-3.5 w-3.5" />}
                  {call.direction === 'outbound' ? 'Sortant' : 'Entrant'}
                </span>
              </div>

              <div className="rounded-2xl bg-[#344453]/6 px-4 py-4">
                <p className="text-sm text-[#344453]/50">Durée</p>
                <p className="mt-2 text-base font-semibold text-[#141F28]" style={{ fontFamily: "var(--font-mono)" }}>
                  {call.duration ? `${call.duration} secondes` : 'Indisponible'}
                </p>
              </div>

              <div className="rounded-2xl bg-[#344453]/6 px-4 py-4 sm:col-span-2">
                <p className="text-sm text-[#344453]/50">Date</p>
                <p className="mt-2 text-base font-semibold text-[#141F28]" style={{ fontFamily: "var(--font-mono)" }}>
                  {format(new Date(call.created_at), 'PPpp', { locale: fr })}
                </p>
              </div>

              {(call.language || call.confidence) && (
                <div className="sm:col-span-2 inline-flex items-center gap-2 rounded-full border border-[#2D9D78]/25 bg-[#2D9D78]/8 px-4 py-2 text-sm text-[#2D9D78]">
                  <ShieldCheck className="h-4 w-4" />
                  {call.language ? `langue détectée: ${call.language.toUpperCase()}` : 'analyse disponible'}
                  {call.confidence ? ` • confiance: ${(call.confidence * 100).toFixed(0)}%` : ''}
                </div>
              )}
            </div>
          </div>
          </div>{/* end right column wrapper */}
        </section>

        <section className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="space-y-4">
            <div className="rounded-[28px] border border-[#344453]/10 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#344453]/8 text-[#344453]">
                  <Phone className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-[0.24em] text-[#344453]/45" style={{ fontFamily: "var(--font-mono)" }}>Numéro</p>
                  <p className="mt-2 text-base font-semibold text-[#141F28]">{call.caller_number || 'Inconnu'}</p>
                </div>
              </div>
            </div>

            <div className="rounded-[28px] border border-[#344453]/10 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#344453]/8 text-[#344453]">
                  <Calendar className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-[0.24em] text-[#344453]/45" style={{ fontFamily: "var(--font-mono)" }}>Date complète</p>
                  <p className="mt-2 text-sm leading-7 text-[#141F28]" style={{ fontFamily: "var(--font-mono)" }}>{format(new Date(call.created_at), 'PPpp', { locale: fr })}</p>
                </div>
              </div>
            </div>

            <div className="rounded-[28px] border border-[#344453]/10 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#344453]/8 text-[#344453]">
                  <Clock className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-[0.24em] text-[#344453]/45" style={{ fontFamily: "var(--font-mono)" }}>Durée</p>
                  <p className="mt-2 text-sm leading-7 text-[#141F28]" style={{ fontFamily: "var(--font-mono)" }}>{call.duration ? `${call.duration} secondes` : 'N/A'}</p>
                </div>
              </div>
            </div>

            {call.actions && call.actions.length > 0 && (
              <div className="rounded-[28px] border border-[#344453]/10 bg-white p-5 shadow-sm sm:p-6">
                <h2 className="text-xl font-semibold tracking-[-0.03em] text-[#141F28]" style={{ fontFamily: "var(--font-title)" }}>Actions effectuées</h2>
                <ul className="mt-4 space-y-3">
                  {call.actions.map((action, index) => (
                    <li key={`${action.type}-${index}`} className="rounded-2xl bg-[#344453]/5 px-4 py-3 text-sm leading-7 text-[#344453]/60">
                      <span className="font-semibold text-[#141F28]">{action.type}</span>
                      <span className="text-[#344453]/35"> — </span>
                      <span>{action.description}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="space-y-4">
            {call.summary && (
              <div className="rounded-[28px] border border-[#344453]/15 bg-[#141F28] p-5 shadow-sm sm:p-6">
                <h2 className="text-xl font-semibold tracking-[-0.03em] text-white" style={{ fontFamily: "var(--font-title)" }}>Résumé IA</h2>
                <p className="mt-4 text-sm leading-7 text-white/70">{call.summary}</p>
                {call.intent && (
                  <div className="mt-4">
                    <span className="inline-flex items-center rounded-full bg-[#C7601D]/20 px-3 py-1 text-xs font-medium text-[#e8915a]">
                      Intention: {call.intent}
                    </span>
                  </div>
                )}
              </div>
            )}

            {(() => {
              // Priority: 1) transcription_segments (DB), 2) live_transcript (JSON), 3) transcription_text with prefixes
              const segments = call.transcription_segments
                || parseTranscriptSegments(call.live_transcript)
                || parseTranscriptTextWithPrefixes(call.transcription_text);
              const plainText = call.transcription_text;
              if (!segments && !plainText) return null;
              return (
                <div className="rounded-[28px] border border-[#344453]/10 bg-white p-5 shadow-sm sm:p-6">
                  <h2 className="text-xl font-semibold tracking-[-0.03em] text-[#141F28]" style={{ fontFamily: "var(--font-title)" }}>Transcription</h2>
                  <div className="mt-4">
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
                    ) : (
                      <div className="rounded-[24px] border border-[#344453]/8 bg-[#344453]/4 p-4 sm:p-5">
                        <p className="whitespace-pre-wrap text-sm leading-7 text-[#344453]/65">{plainText}</p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            {call.recording_url && (
              <div className="rounded-[28px] border border-[#344453]/10 bg-white p-5 shadow-sm sm:p-6">
                <h2 className="text-xl font-semibold tracking-[-0.03em] text-[#141F28]" style={{ fontFamily: "var(--font-title)" }}>Enregistrement audio</h2>
                <div className="mt-4 rounded-[24px] border border-[#344453]/8 bg-[#344453]/4 p-4 sm:p-5">
                  {recordingLoading && (
                    <div className="flex items-center gap-3 rounded-2xl border border-[#344453]/8 bg-white px-4 py-4 text-sm text-[#344453]/60">
                      <Loader2 className="h-4 w-4 animate-spin text-[#344453]" />
                      Chargement de l’enregistrement...
                    </div>
                  )}

                  {!recordingLoading && recordingBlobUrl && (
                    <>
                      <audio
                        ref={audioRef}
                        src={recordingBlobUrl}
                        onLoadedData={() => {
                          if (audioRef.current) {
                            audioRef.current.volume = volume;
                          }
                        }}
                        onLoadedMetadata={(event) => {
                          const nextDuration = Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : 0;
                          setAudioDuration(nextDuration);
                        }}
                        onTimeUpdate={(event) => {
                          setCurrentTime(event.currentTarget.currentTime);
                        }}
                        onPause={() => setIsPlaying(false)}
                        onPlay={() => setIsPlaying(true)}
                        onEnded={() => {
                          setIsPlaying(false);
                          setCurrentTime(0);
                          if (audioRef.current) {
                            audioRef.current.currentTime = 0;
                          }
                        }}
                        className="hidden"
                      />

                      <div className="flex flex-col gap-4">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                          <button
                            type="button"
                            onClick={handleTogglePlayback}
                            className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[#344453] text-white shadow-[0_4px_14px_rgba(52,68,83,0.25)] transition hover:bg-[#2a3642]"
                          >
                            {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="ml-0.5 h-5 w-5" />}
                          </button>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-4 text-sm text-[#344453]/50">
                              <span className="font-medium text-[#141F28]">Message vocal</span>
                              <span>
                                {formatAudioTime(currentTime)} / {formatAudioTime(audioDuration)}
                              </span>
                            </div>

                            <div className="mt-3 flex items-center gap-2">
                              <input
                                type="range"
                                min={0}
                                max={audioDuration || 0}
                                step={0.1}
                                value={Math.min(currentTime, audioDuration || 0)}
                                onChange={(event) => handleSeek(Number(event.target.value))}
                                className="h-2 min-w-0 flex-1 cursor-pointer appearance-none rounded-full bg-[#344453]/12 accent-[#344453]"
                              />

                              <div className="relative shrink-0">
                                <button
                                  type="button"
                                  onClick={() => setIsVolumeOpen((current) => !current)}
                                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#344453]/15 bg-white text-[#344453] transition hover:bg-[#344453]/5"
                                  title="Volume"
                                  aria-label="Contrôle du volume"
                                >
                                  <Volume2 className="h-4 w-4" />
                                </button>

                                {isVolumeOpen && (
                                  <div className="absolute bottom-12 right-0 z-10 rounded-2xl border border-[#344453]/12 bg-white px-3 py-4 shadow-lg">
                                    <input
                                      type="range"
                                      min={0}
                                      max={1}
                                      step={0.01}
                                      value={volume}
                                      onChange={(event) => handleVolumeChange(Number(event.target.value))}
                                      className="h-24 w-2 cursor-pointer appearance-none rounded-full bg-[#344453]/12 accent-[#344453]"
                                      style={{ writingMode: 'vertical-lr', direction: 'rtl' }}
                                    />
                                  </div>
                                )}
                              </div>

                              <a
                                href={recordingBlobUrl}
                                download={`appel-${call.id}.mp3`}
                                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#344453]/15 bg-white text-[#344453] transition hover:bg-[#344453]/5"
                                title="Télécharger l'enregistrement"
                                aria-label="Télécharger l'enregistrement"
                              >
                                <Download className="h-4 w-4" />
                              </a>
                            </div>
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* ── Section Analyse QA ── */}
        <section className="rounded-[28px] border border-[#344453]/10 bg-white shadow-sm">
          <div className="flex items-center gap-3 border-b border-[#344453]/8 px-5 py-4 sm:px-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#344453]/8 text-[#344453]">
              <ClipboardCheck className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-[#141F28]" style={{ fontFamily: 'var(--font-title)' }}>
                Analyse qualité (QA)
              </h2>
              <p className="text-xs text-[#344453]/50 mt-0.5">
                Évaluation de l'appel par Mistral selon vos critères configurés.
              </p>
            </div>
          </div>

          <div className="px-5 py-5 sm:px-6 space-y-5">
            {/* Lancer une analyse */}
            {qaTemplates.length === 0 ? (
              <p className="text-sm text-[#344453]/55">
                Aucun template actif.{' '}
                <a href="/settings/qa" className="font-medium text-[#C7601D] hover:underline">
                  Configurer les templates →
                </a>
              </p>
            ) : (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <select
                  value={selectedTemplateId}
                  onChange={e => setSelectedTemplateId(e.target.value)}
                  className="flex-1 rounded-xl border border-[#344453]/15 bg-[#344453]/3 px-3 py-2.5 text-sm text-[#141F28] focus:border-[#344453]/30 focus:outline-none"
                >
                  {qaTemplates.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
                <button
                  onClick={() => handleAnalyze()}
                  disabled={qaAnalyzing || !selectedTemplateId}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#344453] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#2a3848] disabled:opacity-50 transition"
                >
                  {qaAnalyzing ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Analyse en cours…</>
                  ) : (
                    <><ClipboardCheck className="h-4 w-4" /> Lancer l'analyse</>
                  )}
                </button>
              </div>
            )}

            {qaMessage && (
              <div className={`rounded-xl border px-4 py-3 text-sm ${
                qaMessage.type === 'success'
                  ? 'border-[#2D9D78]/25 bg-[#2D9D78]/8 text-[#2D9D78]'
                  : 'border-[#D94052]/20 bg-[#D94052]/6 text-[#D94052]'
              }`}>
                <span className="font-medium">{qaMessage.text}</span>
                {qaMessage.canForce && (
                  <button
                    onClick={() => handleAnalyze(true)}
                    disabled={qaAnalyzing}
                    className="ml-3 underline opacity-70 hover:opacity-100"
                  >
                    Relancer quand même
                  </button>
                )}
              </div>
            )}

            {/* Résultats existants */}
            {qaResults.length > 0 && (
              <div className="space-y-3">
                <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#344453]/45" style={{ fontFamily: 'var(--font-mono)' }}>
                  Analyses précédentes
                </p>
                {qaResults.map(r => (
                  <div key={r.id} className="flex items-center gap-4 rounded-xl border border-[#344453]/10 px-4 py-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[#141F28] truncate">{r.templateName}</p>
                      <p className="text-xs text-[#344453]/45 mt-0.5">
                        {r.processedAt ? new Date(r.processedAt).toLocaleString('fr-BE', { dateStyle: 'short', timeStyle: 'short' }) : '—'}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1 flex-1 justify-end">
                      {(r.flags || []).map(f => (
                        <span key={f} className="rounded-full bg-[#344453]/8 px-2 py-0.5 text-[10px] text-[#344453]/60">
                          {f.replace(/_/g, ' ')}
                        </span>
                      ))}
                    </div>
                    <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${
                      r.globalScore >= 70
                        ? 'bg-[#2D9D78]/10 text-[#2D9D78]'
                        : r.globalScore >= 50
                        ? 'bg-[#C7601D]/10 text-[#C7601D]'
                        : 'bg-[#D94052]/10 text-[#D94052]'
                    }`}>
                      {r.globalScore}/100
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </Layout>
  );
}

function formatAudioTime(value: number): string {
  if (!Number.isFinite(value) || value <= 0) {
    return '0:00';
  }

  const minutes = Math.floor(value / 60);
  const seconds = Math.floor(value % 60);

  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}
