import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import {
  Phone,
  PhoneOff,
  PhoneForwarded,
  Loader2,
  Sparkles,
  UserCheck,
  MicOff,
  Clock,
  FileText,
  ArrowLeft,
} from 'lucide-react';
import Layout from '../components/Layout';
import { getStatusDisplay, isTerminalStatus } from '../utils/callStatus';

interface StaffMember {
  id: string;
  first_name: string;
  last_name: string;
  phone_number: string;
  role?: string;
  enabled: boolean;
}

interface OutboundCallRecord {
  id: string;
  destination_number: string;
  status: string;
  created_at: string;
  ended_at?: string | null;
  duration?: number | null;
  live_transcript?: string | null;
  live_summary?: string | null;
  transcription_text?: string | null;
  transcription_segments?: Array<{ role: 'client' | 'agent'; text: string; ts?: number }> | null;
  ai_summary?: string | null;
  staff_first_name?: string | null;
  staff_last_name?: string | null;
  metadata?: Record<string, unknown>;
  call_sid?: string | null;
  recording_url?: string | null;
}

interface CallEvent {
  id: string;
  event_type: string;
  data: Record<string, any>;
  timestamp: string;
}

const ACTIVE_STATUSES = new Set(['initiated', 'ringing', 'answered', 'in-progress']);

// ---------------------------------------------------------------------------
// Initiation panel — shown when no callId in URL
// ---------------------------------------------------------------------------
function InitiatePanel({ staff, onCallStarted }: { staff: StaffMember[]; onCallStarted: (id: string) => void }) {
  const [destinationNumber, setDestinationNumber] = useState('');
  const [staffId, setStaffId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (staff.length > 0 && !staffId) {
      setStaffId(staff[0].id);
    }
  }, [staff]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!destinationNumber.trim() || !staffId) return;
    setError('');
    setLoading(true);
    try {
      const res = await axios.post('/api/outbound-calls', { destinationNumber: destinationNumber.trim(), staffId });
      onCallStarted(res.data.callId);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Erreur lors de l\'initiation de l\'appel.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-xl">
      <div className="overflow-hidden rounded-[28px] border border-[#344453]/15 bg-[#141F28] p-6 text-white shadow-[0_24px_60px_rgba(20,31,40,0.18)] sm:p-8">
        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-white/50" style={{ fontFamily: 'var(--font-mono)' }}>
          <Phone className="h-3.5 w-3.5" />
          Appel sortant
        </div>
        <h1 className="mt-5 text-2xl font-semibold tracking-[-0.03em] text-white sm:text-3xl" style={{ fontFamily: 'var(--font-title)' }}>
          Passer un appel
        </h1>
        <p className="mt-2 text-sm leading-7 text-white/55">
          Entrez le numéro à appeler et choisissez le membre de l'équipe qui sera mis en relation.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="mt-5 space-y-4 rounded-[28px] border border-[#344453]/10 bg-white p-6 shadow-sm sm:p-7">
        <div>
          <label className="block text-[11px] uppercase tracking-[0.22em] text-[#344453]/45 mb-2" style={{ fontFamily: 'var(--font-mono)' }}>
            Numéro de destination
          </label>
          <input
            type="tel"
            value={destinationNumber}
            onChange={(e) => setDestinationNumber(e.target.value)}
            placeholder="+32 470 12 34 56"
            required
            className="w-full rounded-2xl border border-[#344453]/12 bg-[#F8F9FB] px-4 py-3 text-base text-[#141F28] outline-none transition placeholder:text-[#344453]/30 focus:border-[#344453]/30 focus:bg-white"
          />
        </div>

        <div>
          <label className="block text-[11px] uppercase tracking-[0.22em] text-[#344453]/45 mb-2" style={{ fontFamily: 'var(--font-mono)' }}>
            Agent mis en relation
          </label>
          {staff.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-[#344453]/15 px-4 py-3 text-sm text-[#344453]/55">
              Aucun agent disponible — ajoutez du staff dans l'onglet Équipe.
            </p>
          ) : (
            <select
              value={staffId}
              onChange={(e) => setStaffId(e.target.value)}
              required
              className="w-full rounded-2xl border border-[#344453]/12 bg-[#F8F9FB] px-4 py-3 text-sm text-[#141F28] outline-none transition focus:border-[#344453]/30 focus:bg-white"
            >
              <option value="">— Choisir un agent —</option>
              {staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.first_name} {s.last_name} {s.role ? `(${s.role})` : ''}
                </option>
              ))}
            </select>
          )}
        </div>

        {error && (
          <p className="rounded-2xl bg-[#D94052]/8 px-4 py-3 text-sm font-medium text-[#D94052]">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading || !destinationNumber.trim() || !staffId}
          className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#C7601D] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#a84e17] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Phone className="h-4 w-4" />}
          {loading ? 'Initiation en cours…' : 'Lancer l\'appel'}
        </button>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Active call view — live status, transcript, summary, transfer
// ---------------------------------------------------------------------------
function ActiveCallView({
  callId,
  staff,
  onBack,
}: {
  callId: string;
  staff: StaffMember[];
  onBack: () => void;
}) {
  const [call, setCall] = useState<OutboundCallRecord | null>(null);
  const [events, setEvents] = useState<CallEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [hangingUp, setHangingUp] = useState(false);
  const [transferStaffId, setTransferStaffId] = useState('');
  const [transferring, setTransferring] = useState(false);
  const [transferResult, setTransferResult] = useState('');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [nowMs, setNowMs] = useState(Date.now());

  useEffect(() => {
    const tick = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(tick);
  }, []);

  const fetchCall = async (showLoader = false) => {
    if (showLoader) setLoading(true);
    try {
      const res = await axios.get(`/api/outbound-calls/${callId}`);
      setCall(res.data.call);
      setEvents(res.data.events || []);
    } catch {
    } finally {
      if (showLoader) setLoading(false);
    }
  };

  useEffect(() => {
    fetchCall(true);
    intervalRef.current = setInterval(() => fetchCall(), 3000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [callId]);

  useEffect(() => {
    if (call && isTerminalStatus(call.status) && intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, [call?.status]);

  const handleHangup = async () => {
    setHangingUp(true);
    try {
      await axios.post(`/api/outbound-calls/${callId}/hangup`);
      await fetchCall();
    } catch {
    } finally {
      setHangingUp(false);
    }
  };

  const handleTransfer = async () => {
    if (!transferStaffId) return;
    setTransferring(true);
    setTransferResult('');
    try {
      await axios.post(`/api/outbound-calls/${callId}/transfer`, { staffId: transferStaffId });
      setTransferResult('Transfert effectué ✓');
      await fetchCall();
    } catch (err: any) {
      setTransferResult(err?.response?.data?.error || 'Erreur lors du transfert');
    } finally {
      setTransferring(false);
    }
  };

  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  const elapsedSecs = call?.duration != null
    ? call.duration
    : call
      ? Math.floor((nowMs - new Date(call.created_at).getTime()) / 1000)
      : 0;
  const isActive = call ? ACTIVE_STATUSES.has(call.status) : false;
  type TranscriptSegment = { role: 'client' | 'agent'; text: string; ts?: number };
  const parseTranscript = (raw: string | null | undefined): TranscriptSegment[] | null => {
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0 && 'role' in parsed[0]) return parsed as TranscriptSegment[];
    } catch { /* plain text */ }
    return null;
  };
  // Parse text format like "Client: ...\n\nAgent: ..." into segments
  const parseTranscriptTextWithPrefixes = (text: string | null | undefined): TranscriptSegment[] | null => {
    if (!text || !text.trim()) return null;
    const lines = text.split(/\n+/).filter(l => l.trim());
    const segments: TranscriptSegment[] = [];
    for (const line of lines) {
      const trimmed = line.trim();
      const match = trimmed.match(/^(Client|Agent)\s*:\s*(.+)$/i);
      if (match) {
        const role = match[1].toLowerCase() === 'agent' ? 'agent' : 'client';
        segments.push({ role, text: match[2].trim() });
      }
    }
    return segments.length > 0 ? segments : null;
  };
  // Priority: 1) transcription_segments (DB), 2) live_transcript (JSON), 3) transcription_text with prefixes
  const transcriptSegments = call?.transcription_segments
    || parseTranscript(call?.live_transcript)
    || parseTranscriptTextWithPrefixes(call?.transcription_text);
  const transcriptFallbackText = !transcriptSegments ? (call?.live_transcript || call?.transcription_text || '') : '';
  const liveSummary = call?.live_summary || call?.ai_summary || '';

  const statusEventLabel: Record<string, string> = {
    'outbound.initiated': 'Appel initié',
    'outbound.answered': 'Décroché — agent connecté',
    'outbound.transferred': 'Transféré',
    'outbound.hangup_by_agent': 'Raccroché par l\'agent',
    'outbound.completed': 'Terminé',
    'outbound.no-answer': 'Pas de réponse',
    'outbound.busy': 'Occupé',
    'outbound.failed': 'Échec',
    'outbound.voicemail_sent': 'Message vocal envoyé',
    'outbound.recording.completed': 'Enregistrement disponible',
  };

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-2 border-[#344453]/10 border-t-[#344453]" />
          <p className="text-sm font-medium text-[#344453]/50">Chargement de l'appel…</p>
        </div>
      </div>
    );
  }

  if (!call) {
    return (
      <div className="rounded-[28px] border border-[#D94052]/20 bg-white p-8 text-center shadow-sm">
        <p className="text-base font-medium text-[#D94052]">Appel introuvable.</p>
        <button onClick={onBack} className="mt-4 inline-flex items-center gap-2 text-sm text-[#344453] underline">
          <ArrowLeft className="h-4 w-4" /> Retour
        </button>
      </div>
    );
  }

  const statusDisplay = getStatusDisplay(call.status);

  return (
    <div className="space-y-5">
      {/* Header card */}
      <div className="overflow-hidden rounded-[28px] border border-[#344453]/15 bg-[#141F28] p-5 text-white shadow-[0_24px_60px_rgba(20,31,40,0.18)] sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-white/50" style={{ fontFamily: 'var(--font-mono)' }}>
              {isActive ? (
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#C7601D] opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-[#C7601D]" />
                </span>
              ) : (
                <Phone className="h-3.5 w-3.5" />
              )}
              {isActive ? 'En cours' : 'Appel terminé'}
            </div>
            <p className="mt-4 text-2xl font-semibold tracking-[-0.03em] text-white sm:text-3xl" style={{ fontFamily: 'var(--font-title)' }}>
              {call.destination_number}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-white/55">
              {call.staff_first_name && (
                <span>Agent : {call.staff_first_name} {call.staff_last_name}</span>
              )}
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {isActive ? `${formatDuration(elapsedSecs)} écoulées` : call.duration ? formatDuration(call.duration) : '—'}
              </span>
            </div>
          </div>
          <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${statusDisplay.color}`}>
            {statusDisplay.label}
          </span>
        </div>

        {isActive && (
          <div className="mt-5 flex flex-wrap gap-3">
            <button
              onClick={handleHangup}
              disabled={hangingUp}
              className="inline-flex items-center gap-2 rounded-full bg-[#D94052] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#b73040] disabled:opacity-40"
            >
              {hangingUp ? <Loader2 className="h-4 w-4 animate-spin" /> : <PhoneOff className="h-4 w-4" />}
              Raccrocher
            </button>
          </div>
        )}
      </div>

      {/* Transcription */}
      <div className="rounded-[28px] border border-[#344453]/10 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[#344453]/8 text-[#344453]">
            <MicOff className="h-4 w-4" />
          </div>
          <p className="text-sm font-semibold text-[#141F28]">Transcription</p>
        </div>
        {transcriptSegments ? (
          <div className="space-y-2">
            {transcriptSegments.map((seg, i) => (
              <div key={i} className={`flex gap-2 ${seg.role === 'agent' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-6 ${
                  seg.role === 'agent'
                    ? 'bg-[#344453] text-white rounded-br-md'
                    : 'bg-[#F8F9FB] text-[#344453]/80 rounded-bl-md border border-[#344453]/8'
                }`}>
                  <p className={`mb-0.5 text-[10px] font-semibold uppercase tracking-widest ${
                    seg.role === 'agent' ? 'text-white/50' : 'text-[#344453]/40'
                  }`}>
                    {seg.role === 'agent' ? (call?.staff_first_name || 'Agent') : 'Client'}
                  </p>
                  {seg.text}
                </div>
              </div>
            ))}
          </div>
        ) : transcriptFallbackText ? (
          <p className="rounded-2xl bg-[#F8F9FB] px-4 py-4 text-sm leading-7 text-[#344453]/75 whitespace-pre-wrap">
            {transcriptFallbackText}
          </p>
        ) : isActive ? (
          <div className="space-y-3 animate-pulse">
            <div className="flex justify-start">
              <div className="h-10 w-2/3 rounded-2xl bg-[#344453]/8" />
            </div>
            <div className="flex justify-end">
              <div className="h-10 w-1/2 rounded-2xl bg-[#344453]/12" />
            </div>
            <div className="flex justify-start">
              <div className="h-10 w-3/5 rounded-2xl bg-[#344453]/8" />
            </div>
            <p className="text-center text-xs text-[#344453]/35 pt-1">Disponible en fin d'appel</p>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-[#344453]/12 px-4 py-6 text-center">
            <p className="text-sm text-[#344453]/40">Aucune transcription disponible.</p>
          </div>
        )}
      </div>

      {/* Résumé */}
      <div className="rounded-[28px] border border-[#344453]/10 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[#C7601D]/10 text-[#C7601D]">
            <Sparkles className="h-4 w-4" />
          </div>
          <p className="text-sm font-semibold text-[#141F28]">Résumé</p>
        </div>
        {liveSummary ? (
          <p className="rounded-2xl bg-[#C7601D]/5 px-4 py-4 text-sm leading-7 text-[#344453]/75">
            {liveSummary}
          </p>
        ) : isActive ? (
          <div className="space-y-2.5 animate-pulse">
            <div className="h-3.5 w-full rounded-full bg-[#C7601D]/10" />
            <div className="h-3.5 w-4/5 rounded-full bg-[#C7601D]/10" />
            <div className="h-3.5 w-2/3 rounded-full bg-[#C7601D]/10" />
            <p className="text-center text-xs text-[#344453]/35 pt-1">Disponible en fin d'appel</p>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-[#344453]/12 px-4 py-6 text-center">
            <p className="text-sm text-[#344453]/40">Résumé non disponible.</p>
          </div>
        )}
      </div>

      {/* Transfer panel — only when active */}
      {isActive && staff.length > 0 && (
        <div className="rounded-[28px] border border-[#E6A817]/25 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[#E6A817]/15 text-[#E6A817]">
              <PhoneForwarded className="h-4 w-4" />
            </div>
            <p className="text-sm font-semibold text-[#141F28]">Transférer l'appel</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <label className="block text-[11px] uppercase tracking-[0.22em] text-[#344453]/45 mb-1.5" style={{ fontFamily: 'var(--font-mono)' }}>
                Nouvel agent
              </label>
              <select
                value={transferStaffId}
                onChange={(e) => setTransferStaffId(e.target.value)}
                className="w-full rounded-2xl border border-[#344453]/12 bg-[#F8F9FB] px-3 py-2.5 text-sm text-[#141F28] outline-none focus:border-[#344453]/25"
              >
                <option value="">— Choisir un agent —</option>
                {staff.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.first_name} {s.last_name} {s.role ? `(${s.role})` : ''}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={handleTransfer}
              disabled={!transferStaffId || transferring}
              className="inline-flex items-center gap-2 rounded-full bg-[#344453] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#2a3642] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {transferring ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserCheck className="h-4 w-4" />}
              Transférer
            </button>
          </div>
          {transferResult && (
            <p className={`mt-3 text-sm font-medium ${transferResult.includes('✓') ? 'text-[#2D9D78]' : 'text-[#D94052]'}`}>
              {transferResult}
            </p>
          )}
        </div>
      )}

      {/* Event timeline */}
      {events.length > 0 && (
        <div className="rounded-[28px] border border-[#344453]/10 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[#344453]/8 text-[#344453]">
              <FileText className="h-4 w-4" />
            </div>
            <p className="text-sm font-semibold text-[#141F28]">Chronologie</p>
          </div>
          <ol className="relative space-y-0 border-l-2 border-[#344453]/8 pl-5">
            {events.map((ev, idx) => {
              const isFirst = idx === 0;
              const isLast = idx === events.length - 1;
              const isError = ['outbound.no-answer', 'outbound.busy', 'outbound.failed'].includes(ev.event_type);
              const isSuccess = ['outbound.completed', 'outbound.answered'].includes(ev.event_type);
              const dotColor = isError
                ? 'bg-[#D94052]'
                : isSuccess
                ? 'bg-[#2D9D78]'
                : isFirst
                ? 'bg-[#C7601D]'
                : 'bg-[#344453]/30';
              const ts = new Date(ev.timestamp);
              return (
                <li key={ev.id} className={`relative pb-5 ${isLast ? 'pb-0' : ''}`}>
                  <div className={`absolute -left-[21px] top-[3px] h-3 w-3 rounded-full border-2 border-white ${dotColor}`} />
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                    <p className="text-sm font-semibold text-[#141F28]">
                      {statusEventLabel[ev.event_type] || ev.event_type}
                    </p>
                    <p className="text-[11px] text-[#344453]/40 tabular-nums" style={{ fontFamily: 'var(--font-mono)' }}>
                      {ts.toLocaleDateString('fr-BE', { day: '2-digit', month: '2-digit' })} · {ts.toLocaleTimeString('fr-BE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </p>
                  </div>
                  {ev.data?.staffName && (
                    <p className="mt-0.5 text-xs text-[#344453]/55">→ {ev.data.staffName}</p>
                  )}
                </li>
              );
            })}
          </ol>
        </div>
      )}

      <button
        onClick={onBack}
        className="inline-flex items-center gap-2 text-sm font-medium text-[#344453]/60 transition hover:text-[#344453]"
      >
        <ArrowLeft className="h-4 w-4" />
        Nouveau appel sortant
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page root — routes between initiation and active call view
// ---------------------------------------------------------------------------
export default function OutboundCall() {
  const { id: urlCallId } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [activeCallId, setActiveCallId] = useState<string | null>(urlCallId ?? null);

  useEffect(() => {
    axios.get('/api/staff').then((res) => {
      setStaff((res.data.staff || []).filter((s: StaffMember) => s.enabled));
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (urlCallId) setActiveCallId(urlCallId);
  }, [urlCallId]);

  const handleCallStarted = (id: string) => {
    setActiveCallId(id);
    navigate(`/outbound/${id}`, { replace: true });
  };

  const handleBack = () => {
    setActiveCallId(null);
    navigate('/outbound', { replace: true });
  };

  return (
    <Layout>
      <div className="space-y-5 sm:space-y-6">
        {activeCallId ? (
          <ActiveCallView callId={activeCallId} staff={staff} onBack={handleBack} />
        ) : (
          <InitiatePanel staff={staff} onCallStarted={handleCallStarted} />
        )}
      </div>
    </Layout>
  );
}
