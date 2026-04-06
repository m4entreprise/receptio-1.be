import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { format, subDays } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  Activity,
  AlertTriangle,
  Bot,
  Gauge,
  Phone,
  RefreshCw,
  Sparkles,
  Waves,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import Layout from '../components/Layout';

interface MonitoringOverview {
  totalCalls: number;
  totalTurns: number;
  avgSttMs: number | null;
  avgLlmMs: number | null;
  avgTtsMs: number | null;
  avgTotalMs: number | null;
  p95TotalMs: number | null;
  errorRate: number;
  noTranscriptRate: number;
  transferRate: number;
  bargeInRate: number;
}

interface MonitoringCallItem {
  callId: string;
  callerNumber: string;
  createdAt: string;
  duration: number;
  endedAt: string | null;
  status: string;
  summary: string | null;
  intent: string | null;
  totalTurns: number;
  completedTurns: number;
  failedTurns: number;
  noTranscriptTurns: number;
  bargeInCount: number;
  transferCount: number;
  avgSttMs: number | null;
  avgLlmMs: number | null;
  avgTtsMs: number | null;
  avgTotalMs: number | null;
  avgInputAudioMs: number | null;
  avgSpeechMs: number | null;
  avgSilenceMs: number | null;
  avgConfidence: number | null;
  maxTotalMs: number | null;
  p95TotalMs: number | null;
  errorRate: number;
  noTranscriptRate: number;
  bargeInRate: number;
  transferRate: number;
}

interface MonitoringChartPoint {
  date: string;
  calls?: number;
  turns?: number;
  errors?: number;
  avgTotalMs?: number | null;
  avgSttMs?: number | null;
  avgLlmMs?: number | null;
  avgTtsMs?: number | null;
}

interface StageAveragePoint {
  stage: string;
  value: number | null;
}

interface MonitoringTurn {
  eventType: string;
  timestamp: string;
  turnIndex: number;
  actionType: string | null;
  turnIntent: string | null;
  transcriptText: string;
  transcriptLength: number;
  replyText: string;
  replyLength: number;
  sttDurationMs: number | null;
  llmDurationMs: number | null;
  ttsDurationMs: number | null;
  totalDurationMs: number | null;
  audioDurationMs: number | null;
  inputAudioMs: number | null;
  speechDurationMs: number | null;
  silenceDurationMs: number | null;
  sttConfidence: number | null;
  sttModel: string | null;
  llmModel: string | null;
  ttsModel: string | null;
  ttsVoice: string | null;
  providerStt: string | null;
  providerLlm: string | null;
  providerTts: string | null;
  transferRequested: boolean;
  bargeInTriggered: boolean;
  errorStage: string | null;
  errorMessage: string | null;
  source: string | null;
}

interface MonitoringDetailResponse {
  call: {
    id: string;
    caller_number?: string | null;
    created_at: string;
    duration?: number | null;
    status: string;
    ended_at?: string | null;
    transcription_text?: string | null;
    summary?: string | null;
    intent?: string | null;
    language?: string | null;
    confidence?: number | null;
  };
  metrics: MonitoringCallItem;
  turns: MonitoringTurn[];
}

interface MonitoringResponse {
  filters: {
    from: string;
    to: string;
    limit: number;
  };
  overview: MonitoringOverview;
  charts: {
    volumeByDay: MonitoringChartPoint[];
    latencyByDay: MonitoringChartPoint[];
    stageAverages: StageAveragePoint[];
  };
  calls: MonitoringCallItem[];
}

function toDateInputValue(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function formatMs(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '—';
  }

  return `${Math.round(value)} ms`;
}

function formatPercent(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '—';
  }

  return `${value.toFixed(1)}%`;
}

function formatShortDate(value: string): string {
  return format(new Date(value), 'dd MMM', { locale: fr });
}

export default function MonitoringBbis() {
  const [filters, setFilters] = useState({
    from: toDateInputValue(subDays(new Date(), 7)),
    to: toDateInputValue(new Date()),
    limit: '60',
  });
  const [data, setData] = useState<MonitoringResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedCallId, setSelectedCallId] = useState<string | null>(null);
  const [detail, setDetail] = useState<MonitoringDetailResponse | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const fetchMonitoring = async (nextSelectedCallId?: string | null) => {
    setLoading(true);
    try {
      const response = await axios.get('/api/monitoring/bbis', {
        params: {
          from: filters.from ? `${filters.from}T00:00:00.000Z` : undefined,
          to: filters.to ? `${filters.to}T23:59:59.999Z` : undefined,
          limit: Number(filters.limit || 60),
        },
      });

      const nextData = response.data as MonitoringResponse;
      setData(nextData);

      const resolvedCallId = nextSelectedCallId
        ?? selectedCallId
        ?? nextData.calls[0]?.callId
        ?? null;

      setSelectedCallId(resolvedCallId);

      if (resolvedCallId) {
        await fetchCallDetail(resolvedCallId);
      } else {
        setDetail(null);
      }
    } catch (error) {
      console.error('Error fetching Bbis monitoring:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCallDetail = async (callId: string) => {
    setDetailLoading(true);
    try {
      const response = await axios.get(`/api/monitoring/bbis/calls/${callId}`);
      setDetail(response.data as MonitoringDetailResponse);
    } catch (error) {
      console.error('Error fetching Bbis call detail:', error);
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    void fetchMonitoring();
  }, []);

  const stageAverages = useMemo(() => data?.charts.stageAverages || [], [data]);
  const selectedCall = useMemo(
    () => data?.calls.find((call) => call.callId === selectedCallId) || null,
    [data, selectedCallId]
  );

  const kpis = [
    {
      label: 'Latence totale moyenne',
      value: formatMs(data?.overview.avgTotalMs),
      detail: `p95 ${formatMs(data?.overview.p95TotalMs)}`,
      icon: Gauge,
      tone: 'bg-[#111118] text-white',
    },
    {
      label: 'STT moyen',
      value: formatMs(data?.overview.avgSttMs),
      detail: 'Deepgram écoute',
      icon: Waves,
      tone: 'bg-blue-100 text-blue-700',
    },
    {
      label: 'LLM moyen',
      value: formatMs(data?.overview.avgLlmMs),
      detail: 'Génération réponse',
      icon: Bot,
      tone: 'bg-violet-100 text-violet-700',
    },
    {
      label: 'TTS moyen',
      value: formatMs(data?.overview.avgTtsMs),
      detail: `barge-in ${formatPercent(data?.overview.bargeInRate)}`,
      icon: Activity,
      tone: 'bg-emerald-100 text-emerald-700',
    },
  ];

  if (loading && !data) {
    return (
      <Layout>
        <div className="flex h-[50vh] items-center justify-center">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="h-12 w-12 animate-spin rounded-full border-2 border-black/10 border-t-[#111118]" />
            <p className="text-sm font-medium text-[#6f685d]">Chargement du monitoring Bbis…</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-5 sm:space-y-6">
        <section className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="overflow-hidden rounded-[28px] border border-black/5 bg-[#111118] p-5 text-white shadow-[0_24px_60px_rgba(17,17,24,0.18)] sm:p-7">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-stone-300">
              <Sparkles className="h-3.5 w-3.5" />
              Monitoring Bbis
            </div>

            <div className="mt-5 space-y-3">
              <h1 className="text-3xl font-semibold tracking-[-0.04em] text-[#f7f2e8] sm:text-4xl">
                Pipeline Deepgram / Twilio / LLM sous microscope.
              </h1>
              <p className="max-w-2xl text-sm leading-7 text-stone-300 sm:text-base">
                Suis les latences par lot d’appels, repère les pics de STT, LLM et TTS, puis ouvre chaque appel pour lire chaque tour en détail.
              </p>
            </div>
          </div>

          <div className="rounded-[28px] border border-black/5 bg-white/80 p-5 shadow-sm sm:p-6">
            <p className="text-[11px] uppercase tracking-[0.24em] text-[#8b8478]">Fenêtre d’analyse</p>
            <div className="mt-5 space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-2 text-sm text-[#625d55]">
                  <span>Du</span>
                  <input
                    type="date"
                    value={filters.from}
                    onChange={(event) => setFilters((current) => ({ ...current, from: event.target.value }))}
                    className="w-full rounded-2xl border border-black/10 bg-[#fcfbf8] px-4 py-3 text-sm text-[#171821] outline-none"
                  />
                </label>
                <label className="space-y-2 text-sm text-[#625d55]">
                  <span>Au</span>
                  <input
                    type="date"
                    value={filters.to}
                    onChange={(event) => setFilters((current) => ({ ...current, to: event.target.value }))}
                    className="w-full rounded-2xl border border-black/10 bg-[#fcfbf8] px-4 py-3 text-sm text-[#171821] outline-none"
                  />
                </label>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <label className="flex-1 space-y-2 text-sm text-[#625d55]">
                  <span>Nombre d’appels</span>
                  <select
                    value={filters.limit}
                    onChange={(event) => setFilters((current) => ({ ...current, limit: event.target.value }))}
                    className="w-full rounded-2xl border border-black/10 bg-[#fcfbf8] px-4 py-3 text-sm text-[#171821] outline-none"
                  >
                    <option value="30">30 appels</option>
                    <option value="60">60 appels</option>
                    <option value="100">100 appels</option>
                    <option value="150">150 appels</option>
                  </select>
                </label>
                <button
                  onClick={() => void fetchMonitoring(selectedCallId)}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-[#111118] px-5 py-3 text-sm font-medium text-white transition hover:bg-[#222430]"
                >
                  <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                  Actualiser
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-2xl bg-[#f4f1ea] px-4 py-3">
                  <p className="text-[#8b8478]">Appels</p>
                  <p className="mt-1 text-2xl font-semibold tracking-[-0.04em] text-[#171821]">{data?.overview.totalCalls || 0}</p>
                </div>
                <div className="rounded-2xl bg-[#f4f1ea] px-4 py-3">
                  <p className="text-[#8b8478]">Tours</p>
                  <p className="mt-1 text-2xl font-semibold tracking-[-0.04em] text-[#171821]">{data?.overview.totalTurns || 0}</p>
                </div>
                <div className="rounded-2xl bg-[#f4f1ea] px-4 py-3">
                  <p className="text-[#8b8478]">Erreurs</p>
                  <p className="mt-1 text-lg font-semibold text-[#171821]">{formatPercent(data?.overview.errorRate)}</p>
                </div>
                <div className="rounded-2xl bg-[#f4f1ea] px-4 py-3">
                  <p className="text-[#8b8478]">Sans transcript</p>
                  <p className="mt-1 text-lg font-semibold text-[#171821]">{formatPercent(data?.overview.noTranscriptRate)}</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {kpis.map((kpi) => {
            const Icon = kpi.icon;
            return (
              <div key={kpi.label} className="rounded-[24px] border border-black/5 bg-white/80 p-4 shadow-sm sm:p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.24em] text-[#8b8478]">{kpi.label}</p>
                    <p className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-[#171821]">{kpi.value}</p>
                    <p className="mt-2 text-sm text-[#6f685d]">{kpi.detail}</p>
                  </div>
                  <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${kpi.tone}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                </div>
              </div>
            );
          })}
        </section>

        <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-[28px] border border-black/5 bg-white/80 p-5 shadow-sm sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold tracking-[-0.03em] text-[#171821]">Latence par jour</h2>
                <p className="mt-1 text-sm text-[#6f685d]">Moyennes journalières pour repérer les dérives de pipeline.</p>
              </div>
            </div>
            <div className="mt-6 h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data?.charts.latencyByDay || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e7e1d8" />
                  <XAxis dataKey="date" tickFormatter={formatShortDate} stroke="#8b8478" fontSize={12} />
                  <YAxis stroke="#8b8478" fontSize={12} width={64} />
                  <Tooltip formatter={(value: number) => formatMs(value)} labelFormatter={(value) => formatShortDate(String(value))} />
                  <Line type="monotone" dataKey="avgTotalMs" name="Total" stroke="#111118" strokeWidth={3} dot={false} />
                  <Line type="monotone" dataKey="avgSttMs" name="STT" stroke="#2563eb" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="avgLlmMs" name="LLM" stroke="#7c3aed" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="avgTtsMs" name="TTS" stroke="#059669" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-[28px] border border-black/5 bg-white/80 p-5 shadow-sm sm:p-6">
            <h2 className="text-xl font-semibold tracking-[-0.03em] text-[#171821]">Mix des étapes</h2>
            <p className="mt-1 text-sm text-[#6f685d]">Comparaison instantanée des durées moyennes par composant.</p>
            <div className="mt-6 h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stageAverages}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e7e1d8" />
                  <XAxis dataKey="stage" stroke="#8b8478" fontSize={12} />
                  <YAxis stroke="#8b8478" fontSize={12} width={60} />
                  <Tooltip formatter={(value: number) => formatMs(value)} />
                  <Bar dataKey="value" radius={[12, 12, 0, 0]}>
                    {stageAverages.map((entry) => (
                      <Cell
                        key={entry.stage}
                        fill={entry.stage === 'TOTAL' ? '#111118' : entry.stage === 'STT' ? '#2563eb' : entry.stage === 'LLM' ? '#7c3aed' : '#059669'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-[28px] border border-black/5 bg-white/80 p-5 shadow-sm sm:p-6">
            <h2 className="text-xl font-semibold tracking-[-0.03em] text-[#171821]">Volume et erreurs</h2>
            <p className="mt-1 text-sm text-[#6f685d]">Appels, tours et incidents par journée.</p>
            <div className="mt-6 h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data?.charts.volumeByDay || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e7e1d8" />
                  <XAxis dataKey="date" tickFormatter={formatShortDate} stroke="#8b8478" fontSize={12} />
                  <YAxis stroke="#8b8478" fontSize={12} width={60} />
                  <Tooltip labelFormatter={(value) => formatShortDate(String(value))} />
                  <Area type="monotone" dataKey="calls" name="Appels" stroke="#111118" fill="#111118" fillOpacity={0.12} strokeWidth={2} />
                  <Area type="monotone" dataKey="turns" name="Tours" stroke="#7c3aed" fill="#7c3aed" fillOpacity={0.18} strokeWidth={2} />
                  <Area type="monotone" dataKey="errors" name="Erreurs" stroke="#dc2626" fill="#dc2626" fillOpacity={0.12} strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-[28px] border border-black/5 bg-white/80 p-5 shadow-sm sm:p-6">
            <h2 className="text-xl font-semibold tracking-[-0.03em] text-[#171821]">Lecture rapide</h2>
            <div className="mt-5 space-y-3">
              <QuickStat label="Taux de transfert" value={formatPercent(data?.overview.transferRate)} tone="bg-amber-100 text-amber-700" />
              <QuickStat label="Barge-in" value={formatPercent(data?.overview.bargeInRate)} tone="bg-violet-100 text-violet-700" />
              <QuickStat label="Total appels" value={String(data?.overview.totalCalls || 0)} tone="bg-blue-100 text-blue-700" />
              <QuickStat label="Total tours" value={String(data?.overview.totalTurns || 0)} tone="bg-emerald-100 text-emerald-700" />
            </div>
          </div>
        </section>

        <section className="grid gap-4 2xl:grid-cols-[0.95fr_1.05fr]">
          <div className="rounded-[28px] border border-black/5 bg-white/80 shadow-sm">
            <div className="border-b border-black/5 px-5 py-5 sm:px-6">
              <h2 className="text-xl font-semibold tracking-[-0.03em] text-[#171821]">Appels Bbis analysés</h2>
              <p className="mt-1 text-sm text-[#6f685d]">Clique un appel pour ouvrir le niveau tour par tour.</p>
            </div>
            <div className="max-h-[760px] overflow-y-auto px-4 py-4 sm:px-6 sm:py-6">
              <div className="space-y-3">
                {(data?.calls || []).map((call) => {
                  const isActive = call.callId === selectedCallId;

                  return (
                    <button
                      key={call.callId}
                      type="button"
                      onClick={() => {
                        setSelectedCallId(call.callId);
                        void fetchCallDetail(call.callId);
                      }}
                      className={`w-full rounded-[24px] border p-4 text-left transition duration-300 sm:p-5 ${
                        isActive
                          ? 'border-[#111118] bg-[#111118] text-white shadow-[0_18px_42px_rgba(17,17,24,0.18)]'
                          : 'border-black/8 bg-[#fcfbf8] hover:-translate-y-0.5 hover:bg-white hover:shadow-[0_16px_36px_rgba(17,17,24,0.08)]'
                      }`}
                    >
                      <div className="flex flex-col gap-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <Phone className={`h-4 w-4 ${isActive ? 'text-stone-300' : 'text-[#7a7267]'}`} />
                              <p className="truncate text-sm font-semibold sm:text-base">{call.callerNumber}</p>
                            </div>
                            <p className={`mt-2 text-xs sm:text-sm ${isActive ? 'text-stone-300' : 'text-[#7a7267]'}`}>
                              {format(new Date(call.createdAt), 'PPpp', { locale: fr })}
                            </p>
                          </div>
                          <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${
                            isActive ? 'bg-white/10 text-white' : call.errorRate > 0 ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'
                          }`}>
                            {call.errorRate > 0 ? `${formatPercent(call.errorRate)} erreurs` : 'Stable'}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                          <MiniMetric label="Tours" value={String(call.totalTurns)} active={isActive} />
                          <MiniMetric label="Total" value={formatMs(call.avgTotalMs)} active={isActive} />
                          <MiniMetric label="STT" value={formatMs(call.avgSttMs)} active={isActive} />
                          <MiniMetric label="LLM" value={formatMs(call.avgLlmMs)} active={isActive} />
                        </div>

                        <div className="flex flex-wrap gap-2 text-xs">
                          <span className={`rounded-full px-3 py-1 ${isActive ? 'bg-white/10 text-stone-200' : 'bg-violet-100 text-violet-700'}`}>
                            p95 {formatMs(call.p95TotalMs)}
                          </span>
                          <span className={`rounded-full px-3 py-1 ${isActive ? 'bg-white/10 text-stone-200' : 'bg-amber-100 text-amber-700'}`}>
                            barge-in {formatPercent(call.bargeInRate)}
                          </span>
                          <span className={`rounded-full px-3 py-1 ${isActive ? 'bg-white/10 text-stone-200' : 'bg-blue-100 text-blue-700'}`}>
                            confidence {call.avgConfidence !== null ? `${call.avgConfidence}%` : '—'}
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-[28px] border border-black/5 bg-white/80 p-5 shadow-sm sm:p-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-xl font-semibold tracking-[-0.03em] text-[#171821]">Détail appel</h2>
                  <p className="mt-1 text-sm text-[#6f685d]">
                    {selectedCall ? `${selectedCall.callerNumber} · ${format(new Date(selectedCall.createdAt), 'PPpp', { locale: fr })}` : 'Sélectionne un appel'}
                  </p>
                </div>
                {detailLoading && <RefreshCw className="h-5 w-5 animate-spin text-[#8b8478]" />}
              </div>

              {selectedCall && (
                <div className="mt-5 grid grid-cols-2 gap-3 text-sm xl:grid-cols-4">
                  <MiniCard label="Tours" value={String(selectedCall.totalTurns)} />
                  <MiniCard label="Avg total" value={formatMs(selectedCall.avgTotalMs)} />
                  <MiniCard label="Max total" value={formatMs(selectedCall.maxTotalMs)} />
                  <MiniCard label="Transferts" value={String(selectedCall.transferCount)} />
                </div>
              )}

              {detail?.turns && detail.turns.length > 0 ? (
                <div className="mt-6 h-[240px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={detail.turns}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e7e1d8" />
                      <XAxis dataKey="turnIndex" stroke="#8b8478" fontSize={12} />
                      <YAxis stroke="#8b8478" fontSize={12} width={60} />
                      <Tooltip formatter={(value: number) => formatMs(value)} />
                      <Line type="monotone" dataKey="sttDurationMs" name="STT" stroke="#2563eb" strokeWidth={2} />
                      <Line type="monotone" dataKey="llmDurationMs" name="LLM" stroke="#7c3aed" strokeWidth={2} />
                      <Line type="monotone" dataKey="ttsDurationMs" name="TTS" stroke="#059669" strokeWidth={2} />
                      <Line type="monotone" dataKey="totalDurationMs" name="TOTAL" stroke="#111118" strokeWidth={3} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="mt-6 rounded-[22px] border border-dashed border-black/10 bg-[#f7f4ee] px-6 py-8 text-center text-sm text-[#6f685d]">
                  Aucune métrique tour par tour disponible pour cet appel.
                </div>
              )}
            </div>

            <div className="rounded-[28px] border border-black/5 bg-white/80 p-5 shadow-sm sm:p-6">
              <h3 className="text-lg font-semibold tracking-[-0.03em] text-[#171821]">Timeline des tours</h3>
              <div className="mt-5 max-h-[520px] space-y-3 overflow-y-auto pr-1">
                {(detail?.turns || []).map((turn) => (
                  <div key={`${turn.turnIndex}-${turn.timestamp}`} className="rounded-[24px] border border-black/8 bg-[#fcfbf8] p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="inline-flex rounded-full bg-[#111118] px-3 py-1 text-xs font-medium text-white">
                            Tour {turn.turnIndex}
                          </span>
                          <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${
                            turn.eventType === 'bbis.turn.failed'
                              ? 'bg-red-100 text-red-700'
                              : turn.eventType === 'bbis.turn.no_transcript'
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-emerald-100 text-emerald-700'
                          }`}>
                            {turn.eventType === 'bbis.turn.failed' ? 'Erreur' : turn.eventType === 'bbis.turn.no_transcript' ? 'Sans transcript' : 'Complet'}
                          </span>
                          {turn.bargeInTriggered && (
                            <span className="inline-flex rounded-full bg-violet-100 px-3 py-1 text-xs font-medium text-violet-700">barge-in</span>
                          )}
                          {turn.transferRequested && (
                            <span className="inline-flex rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700">transfert</span>
                          )}
                        </div>
                        <p className="mt-2 text-xs text-[#7a7267]">{format(new Date(turn.timestamp), 'PPpp', { locale: fr })}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                        <StatChip label="STT" value={formatMs(turn.sttDurationMs)} />
                        <StatChip label="LLM" value={formatMs(turn.llmDurationMs)} />
                        <StatChip label="TTS" value={formatMs(turn.ttsDurationMs)} />
                        <StatChip label="Total" value={formatMs(turn.totalDurationMs)} strong />
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 lg:grid-cols-[0.9fr_1.1fr]">
                      <div className="rounded-2xl bg-white px-4 py-3">
                        <p className="text-[11px] uppercase tracking-[0.24em] text-[#8b8478]">Client</p>
                        <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-[#171821]">
                          {turn.transcriptText || 'Aucun texte exploitable'}
                        </p>
                      </div>
                      <div className="rounded-2xl bg-white px-4 py-3">
                        <p className="text-[11px] uppercase tracking-[0.24em] text-[#8b8478]">Assistant</p>
                        <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-[#171821]">
                          {turn.replyText || turn.errorMessage || 'Pas de réponse générée'}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2 text-xs text-[#5f5a52]">
                      <MetadataChip label="Intent" value={turn.turnIntent || '—'} />
                      <MetadataChip label="STT model" value={turn.sttModel || '—'} />
                      <MetadataChip label="LLM model" value={turn.llmModel || '—'} />
                      <MetadataChip label="TTS voice" value={turn.ttsVoice || turn.ttsModel || '—'} />
                      <MetadataChip label="Input audio" value={formatMs(turn.inputAudioMs)} />
                      <MetadataChip label="Speech" value={formatMs(turn.speechDurationMs)} />
                      <MetadataChip label="Silence" value={formatMs(turn.silenceDurationMs)} />
                      <MetadataChip label="Confidence" value={turn.sttConfidence !== null ? `${Math.round(turn.sttConfidence * 100)}%` : '—'} />
                    </div>

                    {turn.errorStage && (
                      <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-red-50 px-3 py-1 text-xs font-medium text-red-700">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        Échec au stage {turn.errorStage}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>
    </Layout>
  );
}

function QuickStat({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="flex items-center justify-between rounded-2xl bg-[#f7f4ee] px-4 py-4">
      <p className="text-sm text-[#625d55]">{label}</p>
      <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${tone}`}>{value}</span>
    </div>
  );
}

function MiniMetric({ label, value, active }: { label: string; value: string; active: boolean }) {
  return (
    <div className={`rounded-2xl px-3 py-3 ${active ? 'bg-white/10 text-white' : 'bg-[#f4f1ea] text-[#171821]'}`}>
      <p className={`text-[11px] uppercase tracking-[0.24em] ${active ? 'text-stone-300' : 'text-[#8b8478]'}`}>{label}</p>
      <p className="mt-2 text-sm font-semibold">{value}</p>
    </div>
  );
}

function MiniCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-[#f4f1ea] px-4 py-3">
      <p className="text-[11px] uppercase tracking-[0.24em] text-[#8b8478]">{label}</p>
      <p className="mt-2 text-sm font-semibold text-[#171821]">{value}</p>
    </div>
  );
}

function StatChip({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`rounded-2xl px-3 py-2 ${strong ? 'bg-[#111118] text-white' : 'bg-[#f4f1ea] text-[#171821]'}`}>
      <p className={`text-[10px] uppercase tracking-[0.22em] ${strong ? 'text-stone-300' : 'text-[#8b8478]'}`}>{label}</p>
      <p className="mt-1 text-xs font-semibold">{value}</p>
    </div>
  );
}

function MetadataChip({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center rounded-full bg-[#f4f1ea] px-3 py-1">
      <span className="font-medium text-[#8b8478]">{label}</span>
      <span className="mx-1 text-[#b2ab9e]">·</span>
      <span className="text-[#171821]">{value}</span>
    </span>
  );
}
