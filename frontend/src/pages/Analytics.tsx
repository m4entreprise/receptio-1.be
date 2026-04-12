import { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import Layout from '../components/Layout';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { X, Play, Square, CheckCircle, AlertCircle } from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

type Period = 'today' | '7d' | '30d';
type Tab = 'overview' | 'qa';

interface KpiOverview {
  totalCalls: number;
  inbound: number;
  outbound: number;
  avgDurationSec: number | null;
  avgTimeToTransferSec: number | null;
  abandonRate: number;
  transferRate: number;
  appointmentRate: number;
  urgentCount: number;
}

interface VolumePoint {
  slot: string;
  total: number;
  inbound: number;
  outbound: number;
}

interface AgentPoint {
  staffId: string;
  firstName: string;
  lastName: string;
  count: number;
}

interface IntentPoint {
  intent: string;
  count: number;
}

interface OutcomePoint {
  status: string;
  count: number;
}

interface KpiData {
  period: Period;
  overview: KpiOverview;
  charts: {
    volumeBySlot: VolumePoint[];
    callsByAgent: AgentPoint[];
    intentDistribution: IntentPoint[];
    outcomeDistribution: OutcomePoint[];
  };
}

interface QAResult {
  id: string;
  callId: string;
  templateId: string;
  templateVersion: number;
  templateName: string;
  globalScore: number;
  flags: string[];
  processedAt: string;
  agentFirstName: string | null;
  agentLastName: string | null;
}

// ── Constantes ────────────────────────────────────────────────────────────────

const INTENT_COLORS: Record<string, string> = {
  sinistre: '#D94052',
  nouvelle_affaire: '#2D9D78',
  urgence: '#E07B22',
  autre: '#344453',
};

const OUTCOME_LABELS: Record<string, string> = {
  completed: 'Traité',
  transferred: 'Transféré',
  missed: 'Manqué',
  voicemail: 'Messagerie',
  canceled: 'Annulé',
  queued: 'En attente',
  'in-progress': 'En cours',
};

const OUTCOME_COLORS: Record<string, string> = {
  completed: '#2D9D78',
  transferred: '#344453',
  missed: '#D94052',
  voicemail: '#C7601D',
  canceled: '#8B9CAA',
  queued: '#6B7A87',
  'in-progress': '#5B86B5',
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatDuration(sec: number | null): string {
  if (sec === null || sec === 0) return '—';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function formatSlot(slot: string, period: Period): string {
  try {
    const d = parseISO(slot);
    if (period === 'today') return format(d, 'HH:mm', { locale: fr });
    return format(d, 'dd/MM', { locale: fr });
  } catch {
    return slot;
  }
}

function getIntentColor(intent: string): string {
  return INTENT_COLORS[intent] || '#8B9CAA';
}

// ── Composants internes ───────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  sub,
  highlight,
}: {
  label: string;
  value: string | number;
  sub?: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-[20px] border bg-white p-5 shadow-sm ${
        highlight ? 'border-[#D94052]/30 bg-[#D94052]/[0.03]' : 'border-[#344453]/10'
      }`}
    >
      <p className="text-[11px] uppercase tracking-[0.22em] text-[#344453]/45 font-medium">
        {label}
      </p>
      <p
        className={`mt-2 text-2xl font-bold ${
          highlight ? 'text-[#D94052]' : 'text-[#141F28]'
        }`}
        style={{ fontFamily: 'var(--font-title)' }}
      >
        {value}
      </p>
      {sub && <p className="mt-1 text-xs text-[#344453]/50">{sub}</p>}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2
      className="text-sm font-semibold uppercase tracking-[0.18em] text-[#344453]/50 mb-3"
      style={{ fontFamily: 'var(--font-mono)' }}
    >
      {children}
    </h2>
  );
}

// ── Modal batch ───────────────────────────────────────────────────────────────

interface BatchTemplate { id: string; name: string; isActive: boolean }
interface EligibleCall { id: string; callerNumber: string | null; createdAt: string; direction: string }

function BatchAnalysisModal({
  period,
  onClose,
  onDone,
}: {
  period: Period;
  onClose: () => void;
  onDone: () => void;
}) {
  const authHeader = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

  const [templates, setTemplates] = useState<BatchTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [skipExisting, setSkipExisting] = useState(true);
  const [eligible, setEligible] = useState<EligibleCall[] | null>(null);
  const [loadingEligible, setLoadingEligible] = useState(false);

  // État batch
  type BatchStatus = 'idle' | 'running' | 'done' | 'cancelled';
  const [batchStatus, setBatchStatus] = useState<BatchStatus>('idle');
  const [progress, setProgress] = useState(0);
  const [successCount, setSuccessCount] = useState(0);
  const [errorCount, setErrorCount] = useState(0);
  const cancelRef = useRef(false);

  // Charger les templates actifs
  useEffect(() => {
    axios.get('/api/qa/templates', { headers: authHeader() }).then(res => {
      const active = (res.data.templates || []).filter((t: BatchTemplate) => t.isActive);
      setTemplates(active);
      if (active.length > 0) setSelectedTemplate(active[0].id);
    }).catch(() => {});
  }, []);

  // Charger les appels éligibles quand template ou skipExisting change
  useEffect(() => {
    if (!selectedTemplate) return;
    setEligible(null);
    setLoadingEligible(true);
    axios.get(`/api/qa/batch-eligible?templateId=${selectedTemplate}&period=${period}&skipExisting=${skipExisting}`, { headers: authHeader() })
      .then(res => setEligible(res.data.calls || []))
      .catch(() => setEligible([]))
      .finally(() => setLoadingEligible(false));
  }, [selectedTemplate, skipExisting, period]);

  async function handleStart() {
    if (!eligible || eligible.length === 0 || !selectedTemplate) return;
    cancelRef.current = false;
    setBatchStatus('running');
    setProgress(0);
    setSuccessCount(0);
    setErrorCount(0);

    for (let i = 0; i < eligible.length; i++) {
      if (cancelRef.current) {
        setBatchStatus('cancelled');
        break;
      }
      const call = eligible[i];
      try {
        await axios.post(`/api/qa/analyze/${call.id}`, { templateId: selectedTemplate }, { headers: authHeader() });
        setSuccessCount(s => s + 1);
      } catch {
        setErrorCount(e => e + 1);
      }
      setProgress(i + 1);
    }

    if (!cancelRef.current) setBatchStatus('done');
  }

  function handleCancel() {
    cancelRef.current = true;
  }

  const total = eligible?.length ?? 0;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-[24px] border border-[#344453]/10 bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#344453]/10 px-6 py-4">
          <h2 className="text-base font-semibold text-[#141F28]" style={{ fontFamily: 'var(--font-title)' }}>
            Analyse batch
          </h2>
          <button onClick={onClose} className="rounded-full p-1.5 text-[#344453]/50 hover:bg-[#344453]/8 hover:text-[#344453] transition">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Config */}
          {batchStatus === 'idle' && (
            <>
              {templates.length === 0 ? (
                <p className="text-sm text-[#344453]/60">
                  Aucun template actif.{' '}
                  <Link to="/settings/qa" className="text-[#C7601D] hover:underline font-medium">Configurer →</Link>
                </p>
              ) : (
                <>
                  <div>
                    <label className="block text-xs font-medium text-[#344453]/70 mb-1.5">Template</label>
                    <select
                      value={selectedTemplate}
                      onChange={e => setSelectedTemplate(e.target.value)}
                      className="w-full rounded-xl border border-[#344453]/15 bg-[#344453]/3 px-3 py-2.5 text-sm text-[#141F28] focus:border-[#344453]/30 focus:outline-none"
                    >
                      {templates.map(t => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setSkipExisting(v => !v)}
                      className={`relative h-5 w-9 rounded-full transition-colors ${skipExisting ? 'bg-[#2D9D78]' : 'bg-[#344453]/20'}`}
                    >
                      <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${skipExisting ? 'translate-x-4' : 'translate-x-0.5'}`} />
                    </button>
                    <span className="text-sm text-[#344453]/70">Ignorer les appels déjà analysés avec ce template</span>
                  </div>

                  <div className="rounded-xl bg-[#344453]/4 px-4 py-3">
                    {loadingEligible ? (
                      <p className="text-sm text-[#344453]/50">Calcul des appels éligibles…</p>
                    ) : eligible === null ? null : (
                      <p className="text-sm text-[#141F28]">
                        <span className="font-semibold">{total}</span> appel{total !== 1 ? 's' : ''} éligible{total !== 1 ? 's' : ''} sur la période{' '}
                        <span className="text-[#344453]/50">({period === 'today' ? "aujourd'hui" : period === '7d' ? '7 jours' : '30 jours'})</span>
                        {total === 100 && <span className="ml-1 text-[#C7601D]">— limité à 100</span>}
                      </p>
                    )}
                  </div>

                  <div className="flex justify-end gap-3 pt-1">
                    <button onClick={onClose} className="rounded-xl border border-[#344453]/15 px-4 py-2 text-sm text-[#344453]/70 hover:bg-[#344453]/5 transition">
                      Annuler
                    </button>
                    <button
                      onClick={handleStart}
                      disabled={!eligible || total === 0 || loadingEligible}
                      className="inline-flex items-center gap-2 rounded-xl bg-[#344453] px-4 py-2 text-sm font-medium text-white hover:bg-[#2a3848] disabled:opacity-50 transition"
                    >
                      <Play className="h-3.5 w-3.5" />
                      Lancer {total > 0 ? `(${total})` : ''}
                    </button>
                  </div>
                </>
              )}
            </>
          )}

          {/* Progression */}
          {(batchStatus === 'running' || batchStatus === 'cancelled') && (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-[#141F28]">
                  {batchStatus === 'cancelled' ? 'Annulé' : 'Analyse en cours…'}
                </span>
                <span className="text-[#344453]/55">{progress} / {total}</span>
              </div>

              <div className="h-2 w-full rounded-full bg-[#344453]/10 overflow-hidden">
                <div
                  className="h-full rounded-full bg-[#344453] transition-all duration-300"
                  style={{ width: total > 0 ? `${(progress / total) * 100}%` : '0%' }}
                />
              </div>

              <div className="flex gap-4 text-sm">
                <span className="text-[#2D9D78]">✓ {successCount} réussi{successCount !== 1 ? 's' : ''}</span>
                {errorCount > 0 && <span className="text-[#D94052]">✗ {errorCount} erreur{errorCount !== 1 ? 's' : ''}</span>}
              </div>

              {batchStatus === 'running' && (
                <button
                  onClick={handleCancel}
                  className="inline-flex items-center gap-2 rounded-xl border border-[#D94052]/25 px-4 py-2 text-sm text-[#D94052] hover:bg-[#D94052]/5 transition"
                >
                  <Square className="h-3.5 w-3.5" />
                  Arrêter le batch
                </button>
              )}
            </div>
          )}

          {/* Résultats finaux */}
          {batchStatus === 'done' && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 rounded-xl bg-[#2D9D78]/8 border border-[#2D9D78]/20 px-4 py-3">
                <CheckCircle className="h-5 w-5 text-[#2D9D78] shrink-0" />
                <div className="text-sm">
                  <p className="font-semibold text-[#2D9D78]">Batch terminé</p>
                  <p className="text-[#344453]/60 mt-0.5">
                    {successCount} analyse{successCount !== 1 ? 's' : ''} réussie{successCount !== 1 ? 's' : ''}
                    {errorCount > 0 && ` • ${errorCount} erreur${errorCount !== 1 ? 's' : ''}`}
                  </p>
                </div>
              </div>

              {errorCount > 0 && (
                <div className="flex items-start gap-2 text-xs text-[#C7601D]/80">
                  <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  Les erreurs concernent généralement des appels sans transcription utilisable ou des timeouts Mistral.
                </div>
              )}

              <div className="flex justify-end">
                <button
                  onClick={() => { onDone(); onClose(); }}
                  className="rounded-xl bg-[#344453] px-5 py-2 text-sm font-medium text-white hover:bg-[#2a3848] transition"
                >
                  Voir les résultats
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[20px] border border-[#344453]/10 bg-white p-5 shadow-sm">
      <p className="mb-4 text-[11px] uppercase tracking-[0.22em] text-[#344453]/45 font-medium">
        {title}
      </p>
      {children}
    </div>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────

export default function Analytics() {
  const [period, setPeriod] = useState<Period>('today');
  const [tab, setTab] = useState<Tab>('overview');
  const [kpiData, setKpiData] = useState<KpiData | null>(null);
  const [qaResults, setQaResults] = useState<QAResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [qaLoading, setQaLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showBatchModal, setShowBatchModal] = useState(false);

  const loadKpis = useCallback(async (p: Period) => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await axios.get(`/api/analytics/kpis?period=${p}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      setKpiData(data);
    } catch {
      setError('Impossible de charger les statistiques.');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadQaResults = useCallback(async (p: Period) => {
    setQaLoading(true);
    try {
      const { data } = await axios.get(`/api/qa/results?period=${p}&limit=200`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      // L'API retourne du snake_case — on normalise en camelCase
      const normalized = (data.results || []).map((r: Record<string, unknown>) => ({
        id: r.id,
        callId: r.call_id,
        templateId: r.template_id,
        templateVersion: r.template_version,
        templateName: r.template_name,
        globalScore: Number(r.global_score ?? 0),
        flags: Array.isArray(r.flags) ? r.flags : [],
        processedAt: r.processed_at as string,
        agentFirstName: r.agent_first_name as string | null,
        agentLastName: r.agent_last_name as string | null,
      }));
      setQaResults(normalized);
    } catch {
      setQaResults([]);
    } finally {
      setQaLoading(false);
    }
  }, []);

  useEffect(() => {
    loadKpis(period);
    loadQaResults(period);
  }, [period, loadKpis, loadQaResults]);

  const handlePeriod = (p: Period) => setPeriod(p);

  const ov = kpiData?.overview;

  // Agrégation QA côté frontend
  const agentScores = (() => {
    const map = new Map<string, { name: string; scores: number[]; count: number }>();
    for (const r of qaResults) {
      const key = r.agentFirstName && r.agentLastName
        ? `${r.agentFirstName} ${r.agentLastName}`
        : 'Agent inconnu';
      const entry = map.get(key) || { name: key, scores: [], count: 0 };
      entry.scores.push(r.globalScore);
      entry.count += 1;
      map.set(key, entry);
    }
    return Array.from(map.values())
      .map((e) => ({
        name: e.name,
        avgScore: Math.round(e.scores.reduce((a, b) => a + b, 0) / e.scores.length),
        count: e.count,
      }))
      .sort((a, b) => b.avgScore - a.avgScore);
  })();

  const flagFrequency = (() => {
    const map = new Map<string, number>();
    for (const r of qaResults) {
      for (const f of r.flags || []) {
        map.set(f, (map.get(f) || 0) + 1);
      }
    }
    return Array.from(map.entries())
      .map(([flag, count]) => ({ flag, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  })();

  const scoreTrend = (() => {
    const map = new Map<string, number[]>();
    for (const r of qaResults) {
      const key = r.processedAt ? r.processedAt.slice(0, 10) : 'inconnu';
      const arr = map.get(key) || [];
      arr.push(r.globalScore);
      map.set(key, arr);
    }
    return Array.from(map.entries())
      .map(([slot, scores]) => ({
        slot,
        avgScore: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
      }))
      .sort((a, b) => a.slot.localeCompare(b.slot));
  })();

  const periodLabel: Record<Period, string> = {
    today: "Aujourd'hui",
    '7d': '7 jours',
    '30d': '30 jours',
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p
              className="text-[11px] uppercase tracking-[0.28em] text-[#344453]/45"
              style={{ fontFamily: 'var(--font-mono)' }}
            >
              Receptio
            </p>
            <h1
              className="text-xl font-bold text-[#141F28] sm:text-2xl"
              style={{ fontFamily: 'var(--font-title)' }}
            >
              Analytics
            </h1>
          </div>

          {/* Sélecteur de période */}
          <div className="flex gap-2">
            {(['today', '7d', '30d'] as Period[]).map((p) => (
              <button
                key={p}
                onClick={() => handlePeriod(p)}
                className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                  period === p
                    ? 'bg-[#344453] text-white shadow-[0_4px_12px_rgba(52,68,83,0.22)]'
                    : 'border border-[#344453]/15 bg-white text-[#344453]/70 hover:bg-[#344453]/5'
                }`}
              >
                {periodLabel[p]}
              </button>
            ))}
          </div>
        </div>

        {/* Onglets */}
        <div className="flex gap-1 rounded-2xl border border-[#344453]/10 bg-white p-1 w-fit shadow-sm">
          {(['overview', 'qa'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-xl px-5 py-2 text-sm font-medium transition ${
                tab === t
                  ? 'bg-[#344453] text-white'
                  : 'text-[#344453]/60 hover:bg-[#344453]/[0.06]'
              }`}
            >
              {t === 'overview' ? 'Vue d\'ensemble' : 'Qualité IA'}
            </button>
          ))}
        </div>

        {/* Erreur */}
        {error && (
          <div className="rounded-2xl border border-[#D94052]/20 bg-[#D94052]/5 p-4 text-sm text-[#D94052]">
            {error}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#344453]/20 border-t-[#344453]" />
          </div>
        )}

        {/* ── Onglet Vue d'ensemble ── */}
        {!loading && tab === 'overview' && kpiData && (
          <div className="space-y-6">
            {/* KPI Grid */}
            <div>
              <SectionTitle>Indicateurs clés</SectionTitle>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                <KpiCard label="Total appels" value={ov?.totalCalls ?? 0} />
                <KpiCard
                  label="Entrants"
                  value={ov?.inbound ?? 0}
                  sub={ov && ov.totalCalls > 0 ? `${Math.round((ov.inbound / ov.totalCalls) * 100)}%` : undefined}
                />
                <KpiCard
                  label="Sortants"
                  value={ov?.outbound ?? 0}
                  sub={ov && ov.totalCalls > 0 ? `${Math.round((ov.outbound / ov.totalCalls) * 100)}%` : undefined}
                />
                <KpiCard
                  label="Durée moyenne"
                  value={formatDuration(ov?.avgDurationSec ?? null)}
                />
                <KpiCard
                  label="Tps avant transfert"
                  value={formatDuration(ov?.avgTimeToTransferSec ?? null)}
                />
                <KpiCard
                  label="Taux d'abandon"
                  value={`${ov?.abandonRate ?? 0}%`}
                  highlight={(ov?.abandonRate ?? 0) > 20}
                />
                <KpiCard
                  label="Taux de transfert"
                  value={`${ov?.transferRate ?? 0}%`}
                />
                <KpiCard
                  label="Taux de RDV"
                  value={`${ov?.appointmentRate ?? 0}%`}
                />
                <KpiCard
                  label="Appels urgents"
                  value={ov?.urgentCount ?? 0}
                  highlight={(ov?.urgentCount ?? 0) > 0}
                />
              </div>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {/* Volume */}
              <ChartCard title="Volume d'appels">
                {kpiData.charts.volumeBySlot.length === 0 ? (
                  <p className="py-8 text-center text-sm text-[#344453]/40">Aucun appel sur cette période</p>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={kpiData.charts.volumeBySlot.map((d) => ({
                      ...d,
                      slot: formatSlot(d.slot, period),
                    }))}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(52,68,83,0.08)" />
                      <XAxis dataKey="slot" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="inbound" name="Entrants" stroke="#344453" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="outbound" name="Sortants" stroke="#C7601D" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </ChartCard>

              {/* Répartition intent */}
              <ChartCard title="Répartition par intent">
                {kpiData.charts.intentDistribution.length === 0 ||
                kpiData.charts.intentDistribution.every(d => Number(d.count) === 0) ? (
                  <p className="py-8 text-center text-sm text-[#344453]/40">Aucune donnée</p>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie
                        data={kpiData.charts.intentDistribution.map(d => ({
                          ...d,
                          intent: d.intent || 'autre',
                          count: Number(d.count) || 0,
                        }))}
                        dataKey="count"
                        nameKey="intent"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        label={({ intent, percent }: { intent: string; percent: number }) =>
                          percent > 0.04 ? `${intent} (${(percent * 100).toFixed(0)}%)` : ''
                        }
                        labelLine={false}
                      >
                        {kpiData.charts.intentDistribution.map((entry) => (
                          <Cell key={entry.intent || 'autre'} fill={getIntentColor(entry.intent || 'autre')} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number, name: string) => [value, name]} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </ChartCard>

              {/* Appels par agent */}
              <ChartCard title="Appels par agent">
                {kpiData.charts.callsByAgent.length === 0 ? (
                  <p className="py-8 text-center text-sm text-[#344453]/40">Aucune donnée de transfert</p>
                ) : (
                  <ResponsiveContainer width="100%" height={Math.max(180, kpiData.charts.callsByAgent.length * 36)}>
                    <BarChart
                      layout="vertical"
                      data={kpiData.charts.callsByAgent.map((a) => ({
                        name: `${a.firstName} ${a.lastName}`,
                        count: a.count,
                      }))}
                      margin={{ left: 8, right: 16 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(52,68,83,0.08)" />
                      <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={110} />
                      <Tooltip />
                      <Bar dataKey="count" name="Appels" fill="#344453" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </ChartCard>

              {/* Répartition par issue */}
              <ChartCard title="Répartition par issue">
                {kpiData.charts.outcomeDistribution.length === 0 ? (
                  <p className="py-8 text-center text-sm text-[#344453]/40">Aucune donnée</p>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart
                      data={kpiData.charts.outcomeDistribution.map((d) => ({
                        label: OUTCOME_LABELS[d.status] || d.status,
                        count: d.count,
                        status: d.status,
                      }))}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(52,68,83,0.08)" />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="count" name="Appels" radius={[4, 4, 0, 0]}>
                        {kpiData.charts.outcomeDistribution.map((entry) => (
                          <Cell key={entry.status} fill={OUTCOME_COLORS[entry.status] || '#8B9CAA'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </ChartCard>
            </div>
          </div>
        )}

        {/* ── Onglet Qualité IA ── */}
        {tab === 'qa' && (
          <div className="space-y-6">
            {/* Bouton batch */}
            <div className="flex justify-end">
              <button
                onClick={() => setShowBatchModal(true)}
                className="inline-flex items-center gap-2 rounded-full bg-[#344453] px-4 py-2 text-sm font-medium text-white shadow-[0_4px_12px_rgba(52,68,83,0.18)] hover:bg-[#2a3848] transition"
              >
                <Play className="h-3.5 w-3.5" />
                Lancer un batch d'analyses
              </button>
            </div>

            {qaLoading && (
              <div className="flex items-center justify-center py-16">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#344453]/20 border-t-[#344453]" />
              </div>
            )}

            {!qaLoading && qaResults.length === 0 && (
              <div className="rounded-[24px] border border-[#344453]/10 bg-white p-10 text-center shadow-sm">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#344453]/8">
                  <svg className="h-7 w-7 text-[#344453]/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p className="text-base font-semibold text-[#141F28]">Aucune analyse QA disponible</p>
                <p className="mt-2 text-sm text-[#344453]/55">
                  Configurez vos templates d'analyse et lancez des analyses sur vos appels.
                </p>
                <Link
                  to="/settings/qa"
                  className="mt-5 inline-flex items-center gap-2 rounded-full bg-[#344453] px-5 py-2.5 text-sm font-medium text-white shadow-[0_4px_12px_rgba(52,68,83,0.22)] hover:bg-[#2a3844] transition"
                >
                  Configurer les templates QA
                </Link>
              </div>
            )}

            {!qaLoading && qaResults.length > 0 && (
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {/* Score par agent */}
                <ChartCard title="Score qualité par agent">
                  {agentScores.length === 0 ? (
                    <p className="py-8 text-center text-sm text-[#344453]/40">Aucune donnée</p>
                  ) : (
                    <div className="space-y-3">
                      {agentScores.map((a) => (
                        <div key={a.name} className="flex items-center gap-3">
                          <span className="w-28 shrink-0 truncate text-sm text-[#344453]/70">{a.name}</span>
                          <div className="flex-1 rounded-full bg-[#344453]/8 overflow-hidden">
                            <div
                              className="h-2 rounded-full transition-all"
                              style={{
                                width: `${a.avgScore}%`,
                                backgroundColor: a.avgScore >= 70 ? '#2D9D78' : a.avgScore >= 50 ? '#C7601D' : '#D94052',
                              }}
                            />
                          </div>
                          <span className="w-12 shrink-0 text-right text-sm font-semibold text-[#141F28]">
                            {a.avgScore}/100
                          </span>
                          <span className="w-16 shrink-0 text-right text-xs text-[#344453]/45">
                            {a.count} appel{a.count > 1 ? 's' : ''}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </ChartCard>

                {/* Évolution score */}
                <ChartCard title="Évolution du score moyen">
                  {scoreTrend.length === 0 ? (
                    <p className="py-8 text-center text-sm text-[#344453]/40">Aucune donnée</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={220}>
                      <LineChart data={scoreTrend}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(52,68,83,0.08)" />
                        <XAxis dataKey="slot" tick={{ fontSize: 11 }} />
                        <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                        <Tooltip formatter={(v) => [`${v}/100`, 'Score moyen']} />
                        <Line type="monotone" dataKey="avgScore" name="Score moyen" stroke="#2D9D78" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </ChartCard>

                {/* Top flags */}
                {flagFrequency.length > 0 && (
                  <div className="lg:col-span-2">
                    <ChartCard title="Flags de friction les plus fréquents">
                      <div className="flex flex-wrap gap-2">
                        {flagFrequency.map(({ flag, count }) => (
                          <span
                            key={flag}
                            className="inline-flex items-center gap-1.5 rounded-full border border-[#D94052]/20 bg-[#D94052]/5 px-3 py-1 text-xs font-medium text-[#D94052]"
                          >
                            {flag.replace(/_/g, ' ')}
                            <span className="rounded-full bg-[#D94052]/15 px-1.5 py-0.5 text-[10px] font-bold">
                              {count}
                            </span>
                          </span>
                        ))}
                      </div>
                    </ChartCard>
                  </div>
                )}

                {/* Tableau des dernières analyses */}
                <div className="lg:col-span-2">
                  <SectionTitle>Dernières analyses</SectionTitle>
                  <div className="overflow-hidden rounded-[20px] border border-[#344453]/10 bg-white shadow-sm">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-[#344453]/8 text-left">
                          <th className="px-4 py-3 text-[11px] uppercase tracking-[0.18em] text-[#344453]/45 font-medium">Appel</th>
                          <th className="px-4 py-3 text-[11px] uppercase tracking-[0.18em] text-[#344453]/45 font-medium">Agent</th>
                          <th className="px-4 py-3 text-[11px] uppercase tracking-[0.18em] text-[#344453]/45 font-medium">Template</th>
                          <th className="px-4 py-3 text-[11px] uppercase tracking-[0.18em] text-[#344453]/45 font-medium">Score</th>
                          <th className="px-4 py-3 text-[11px] uppercase tracking-[0.18em] text-[#344453]/45 font-medium">Flags</th>
                          <th className="px-4 py-3 text-[11px] uppercase tracking-[0.18em] text-[#344453]/45 font-medium">Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#344453]/5">
                        {qaResults.slice(0, 20).map((r) => (
                          <tr key={r.id} className="hover:bg-[#344453]/[0.02] transition">
                            <td className="px-4 py-3">
                              <Link to={`/calls/${r.callId}`} className="font-mono text-xs text-[#344453]/60 hover:text-[#344453] transition">
                                {r.callId.slice(0, 8)}…
                              </Link>
                            </td>
                            <td className="px-4 py-3 text-[#344453]/70">
                              {r.agentFirstName && r.agentLastName
                                ? `${r.agentFirstName} ${r.agentLastName}`
                                : '—'}
                            </td>
                            <td className="px-4 py-3 text-[#344453]/70">{r.templateName}</td>
                            <td className="px-4 py-3">
                              <span
                                className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-bold ${
                                  r.globalScore >= 70
                                    ? 'bg-[#2D9D78]/10 text-[#2D9D78]'
                                    : r.globalScore >= 50
                                    ? 'bg-[#C7601D]/10 text-[#C7601D]'
                                    : 'bg-[#D94052]/10 text-[#D94052]'
                                }`}
                              >
                                {r.globalScore}/100
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex flex-wrap gap-1">
                                {(r.flags || []).slice(0, 2).map((f) => (
                                  <span key={f} className="rounded-full bg-[#344453]/8 px-2 py-0.5 text-[10px] text-[#344453]/60">
                                    {f.replace(/_/g, ' ')}
                                  </span>
                                ))}
                                {(r.flags || []).length > 2 && (
                                  <span className="rounded-full bg-[#344453]/8 px-2 py-0.5 text-[10px] text-[#344453]/60">
                                    +{r.flags.length - 2}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-xs text-[#344453]/45">
                              {r.processedAt
                                ? format(parseISO(r.processedAt), 'dd/MM HH:mm', { locale: fr })
                                : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      {showBatchModal && (
        <BatchAnalysisModal
          period={period}
          onClose={() => setShowBatchModal(false)}
          onDone={() => loadQaResults(period)}
        />
      )}
    </Layout>
  );
}
