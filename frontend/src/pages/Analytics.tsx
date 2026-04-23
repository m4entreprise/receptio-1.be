import { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
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
import {
  X,
  Play,
  Square,
  CheckCircle,
  AlertCircle,
  Phone,
  PhoneIncoming,
  PhoneOutgoing,
  Clock,
  TrendingDown,
  ArrowRightLeft,
  Calendar,
  AlertTriangle,
  Shield,
  BarChart3,
} from 'lucide-react';

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

interface ScoreDistributionPoint {
  bucket: string;
  count: number;
}

interface WeakCriterionPoint {
  critere_id: string;
  label: string;
  avg: number;
  avg_max: number;
  stddev: number;
  weight: number;
}

interface FlagTrendPoint {
  date: string;
  count: number;
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

function scoreColor(score: number): string {
  return score >= 70 ? '#2D9D78' : score >= 50 ? '#C7601D' : '#D94052';
}

function scoreLabel(score: number): string {
  return score >= 70 ? 'Bon' : score >= 50 ? 'Moyen' : 'Faible';
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

// ── Composants internes ───────────────────────────────────────────────────────

function KpiHeroCard({
  label,
  value,
  sub,
  highlight,
  icon,
}: {
  label: string;
  value: string | number;
  sub?: string;
  highlight?: boolean;
  icon: React.ReactNode;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border bg-white p-6 shadow-sm ${
        highlight ? 'border-[#D94052]/30' : 'border-[#344453]/10'
      }`}
    >
      <div
        className="absolute inset-x-0 top-0 h-[3px] rounded-t-2xl"
        style={{
          background: highlight
            ? 'linear-gradient(90deg, #D94052, #E07B22)'
            : 'linear-gradient(90deg, #344453, #5B86B5)',
        }}
      />
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-[#344453]/45 font-medium">
            {label}
          </p>
          <p
            className={`mt-3 text-3xl font-bold tracking-tight ${
              highlight ? 'text-[#D94052]' : 'text-[#141F28]'
            }`}
            style={{ fontFamily: 'var(--font-title)' }}
          >
            {value}
          </p>
          {sub && <p className="mt-1 text-xs text-[#344453]/45">{sub}</p>}
        </div>
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
            highlight ? 'bg-[#D94052]/8 text-[#D94052]' : 'bg-[#344453]/7 text-[#344453]/60'
          }`}
        >
          {icon}
        </div>
      </div>
    </div>
  );
}

function KpiSmallCard({
  label,
  value,
  sub,
  highlight,
  icon,
}: {
  label: string;
  value: string | number;
  sub?: string;
  highlight?: boolean;
  icon: React.ReactNode;
}) {
  return (
    <div
      className={`rounded-2xl border bg-white p-4 shadow-sm ${
        highlight ? 'border-[#D94052]/25 bg-[#D94052]/[0.02]' : 'border-[#344453]/10'
      }`}
    >
      <div className="flex items-center gap-2.5">
        <div
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
            highlight ? 'bg-[#D94052]/8 text-[#D94052]' : 'bg-[#344453]/6 text-[#344453]/50'
          }`}
        >
          {icon}
        </div>
        <p className="text-[11px] uppercase tracking-[0.18em] text-[#344453]/45 font-medium truncate">
          {label}
        </p>
      </div>
      <p
        className={`mt-2.5 text-xl font-bold ${highlight ? 'text-[#D94052]' : 'text-[#141F28]'}`}
        style={{ fontFamily: 'var(--font-title)' }}
      >
        {value}
      </p>
      {sub && <p className="mt-0.5 text-xs text-[#344453]/40">{sub}</p>}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2
      className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#344453]/45 mb-3"
      style={{ fontFamily: 'var(--font-mono)' }}
    >
      {children}
    </h2>
  );
}

function ChartCard({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-[#344453]/10 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-2">
        <p className="text-[11px] uppercase tracking-[0.22em] text-[#344453]/45 font-medium">
          {title}
        </p>
        {action}
      </div>
      {children}
    </div>
  );
}

function QaSummaryCard({
  label,
  value,
  sub,
  color,
  icon,
}: {
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-[#344453]/10 bg-white px-5 py-4 shadow-sm">
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
        style={{ backgroundColor: color ? `${color}14` : 'rgba(52,68,83,0.06)', color: color || '#344453' }}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-[0.2em] text-[#344453]/40 font-medium">{label}</p>
        <p
          className="mt-0.5 text-2xl font-bold tracking-tight"
          style={{ fontFamily: 'var(--font-title)', color: color || '#141F28' }}
        >
          {value}
        </p>
        {sub && <p className="text-[11px] text-[#344453]/40">{sub}</p>}
      </div>
    </div>
  );
}

// ── Modal batch ───────────────────────────────────────────────────────────────

interface BatchTemplate { id: string; name: string; isActive: boolean }
interface EligibleCall { id: string; callerNumber: string | null; createdAt: string; direction: string }

type BatchStatus = 'idle' | 'running' | 'done' | 'cancelled';

interface BatchProgressState {
  status: BatchStatus;
  progress: number;
  successCount: number;
  errorCount: number;
  total: number;
}

function BatchAnalysisModal({
  period,
  templates,
  selectedTemplate,
  onSelectTemplate,
  skipExisting,
  onToggleSkipExisting,
  eligible,
  loadingEligible,
  batchState,
  onStart,
  onCancel,
  onClose,
  onDone,
}: {
  period: Period;
  templates: BatchTemplate[];
  selectedTemplate: string;
  onSelectTemplate: (value: string) => void;
  skipExisting: boolean;
  onToggleSkipExisting: () => void;
  eligible: EligibleCall[] | null;
  loadingEligible: boolean;
  batchState: BatchProgressState;
  onStart: () => void;
  onCancel: () => void;
  onClose: () => void;
  onDone: () => void;
}) {
  const total = eligible?.length ?? 0;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-[24px] border border-[#344453]/10 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#344453]/10 px-6 py-4">
          <h2 className="text-base font-semibold text-[#141F28]" style={{ fontFamily: 'var(--font-title)' }}>
            Analyse batch
          </h2>
          <button onClick={onClose} className="rounded-full p-1.5 text-[#344453]/50 hover:bg-[#344453]/8 hover:text-[#344453] transition">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {batchState.status === 'idle' && (
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
                      onChange={e => onSelectTemplate(e.target.value)}
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
                      onClick={onToggleSkipExisting}
                      className={`relative h-5 w-9 rounded-full transition-colors ${skipExisting ? 'bg-[#2D9D78]' : 'bg-[#344453]/20'}`}
                    >
                      <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${skipExisting ? 'translate-x-4' : 'translate-x-0.5'}`} />
                    </button>
                    <span className="text-sm text-[#344453]/70">Ignorer les appels déjà analysés</span>
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
                      onClick={onStart}
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

          {(batchState.status === 'running' || batchState.status === 'cancelled') && (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-[#141F28]">
                  {batchState.status === 'cancelled' ? 'Annulé' : 'Analyse en cours…'}
                </span>
                <span className="text-[#344453]/55">{batchState.progress} / {batchState.total}</span>
              </div>

              <div className="h-2 w-full rounded-full bg-[#344453]/10 overflow-hidden">
                <div
                  className="h-full rounded-full bg-[#344453] transition-all duration-300"
                  style={{ width: batchState.total > 0 ? `${(batchState.progress / batchState.total) * 100}%` : '0%' }}
                />
              </div>

              <div className="flex gap-4 text-sm">
                <span className="text-[#2D9D78]">✓ {batchState.successCount} réussi{batchState.successCount !== 1 ? 's' : ''}</span>
                {batchState.errorCount > 0 && <span className="text-[#D94052]">✗ {batchState.errorCount} erreur{batchState.errorCount !== 1 ? 's' : ''}</span>}
              </div>

              {batchState.status === 'running' && (
                <button
                  onClick={onCancel}
                  className="inline-flex items-center gap-2 rounded-xl border border-[#D94052]/25 px-4 py-2 text-sm text-[#D94052] hover:bg-[#D94052]/5 transition"
                >
                  <Square className="h-3.5 w-3.5" />
                  Arrêter le batch
                </button>
              )}
            </div>
          )}

          {batchState.status === 'done' && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 rounded-xl bg-[#2D9D78]/8 border border-[#2D9D78]/20 px-4 py-3">
                <CheckCircle className="h-5 w-5 text-[#2D9D78] shrink-0" />
                <div className="text-sm">
                  <p className="font-semibold text-[#2D9D78]">Batch terminé</p>
                  <p className="text-[#344453]/60 mt-0.5">
                    {batchState.successCount} analyse{batchState.successCount !== 1 ? 's' : ''} réussie{batchState.successCount !== 1 ? 's' : ''}
                    {batchState.errorCount > 0 && ` • ${batchState.errorCount} erreur${batchState.errorCount !== 1 ? 's' : ''}`}
                  </p>
                </div>
              </div>

              {batchState.errorCount > 0 && (
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

// ── Page principale ───────────────────────────────────────────────────────────

export default function Analytics() {
  const [period, setPeriod] = useState<Period>('today');
  const [tab, setTab] = useState<Tab>('overview');
  const [kpiData, setKpiData] = useState<KpiData | null>(null);
  const [qaResults, setQaResults] = useState<QAResult[]>([]);
  const [scoreDistribution, setScoreDistribution] = useState<ScoreDistributionPoint[]>([]);
  const [weakCriteria, setWeakCriteria] = useState<WeakCriterionPoint[]>([]);
  const [flagTrend, setFlagTrend] = useState<FlagTrendPoint[]>([]);
  const [selectedFlagType, setSelectedFlagType] = useState('');
  const [reviewThreshold, setReviewThreshold] = useState(40);
  const [loading, setLoading] = useState(false);
  const [qaLoading, setQaLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showBatchModal, setShowBatchModal] = useState(false);

  const [batchTemplates, setBatchTemplates] = useState<BatchTemplate[]>([]);
  const [batchSelectedTemplate, setBatchSelectedTemplate] = useState('');
  const [batchSkipExisting, setBatchSkipExisting] = useState(true);
  const [batchEligible, setBatchEligible] = useState<EligibleCall[] | null>(null);
  const [batchLoadingEligible, setBatchLoadingEligible] = useState(false);
  const [batchState, setBatchState] = useState<BatchProgressState>({
    status: 'idle',
    progress: 0,
    successCount: 0,
    errorCount: 0,
    total: 0,
  });
  const [batchControlHovered, setBatchControlHovered] = useState(false);
  const batchCancelRef = useRef(false);
  const authHeader = useCallback(() => ({ Authorization: `Bearer ${localStorage.getItem('token')}` }), []);

  const loadKpis = useCallback(async (p: Period) => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await axios.get(`/api/analytics/kpis?period=${p}`, {
        headers: authHeader(),
      });
      setKpiData(data);
    } catch {
      setError('Impossible de charger les statistiques.');
    } finally {
      setLoading(false);
    }
  }, [authHeader]);

  const loadQaResults = useCallback(async (p: Period) => {
    setQaLoading(true);
    try {
      const { data } = await axios.get(`/api/qa/results?period=${p}&limit=200`, {
        headers: authHeader(),
      });
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
  }, [authHeader]);

  const loadQaAdvanced = useCallback(async (p: Period, nextFlagType?: string) => {
    try {
      const headers = { Authorization: `Bearer ${localStorage.getItem('token')}` };
      const [distributionRes, weakCriteriaRes, flagTrendRes] = await Promise.all([
        axios.get(`/api/analytics/qa/score-distribution?period=${p}`, { headers }),
        axios.get(`/api/analytics/qa/weak-criteria?period=${p}`, { headers }),
        axios.get(`/api/analytics/qa/flags/trend?period=${p}${nextFlagType ? `&flagType=${encodeURIComponent(nextFlagType)}` : ''}`, { headers }),
      ]);

      setScoreDistribution((distributionRes.data.distribution || []).map((entry: Record<string, unknown>) => ({
        bucket: String(entry.bucket || ''),
        count: Number(entry.count || 0),
      })));
      setWeakCriteria((weakCriteriaRes.data.criteria || []).map((entry: Record<string, unknown>) => ({
        critere_id: String(entry.critere_id || ''),
        label: String(entry.label || ''),
        avg: Number(entry.avg || 0),
        avg_max: Number(entry.avg_max || 0),
        stddev: Number(entry.stddev || 0),
        weight: Number(entry.weight || 0),
      })));
      setFlagTrend((flagTrendRes.data.trend || []).map((entry: Record<string, unknown>) => ({
        date: String(entry.date || ''),
        count: Number(entry.count || 0),
      })));
    } catch {
      setScoreDistribution([]);
      setWeakCriteria([]);
      setFlagTrend([]);
    }
  }, [authHeader]);

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

  const effectiveSelectedFlagType = selectedFlagType || flagFrequency[0]?.flag || '';

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

  const callsToReview = qaResults
    .filter((result: QAResult) => result.globalScore < reviewThreshold || result.flags.some((flag: string) => ['prospect_chaud', 'promesse_non_tenue', 'transfert_rate'].includes(flag)))
    .sort((a: QAResult, b: QAResult) => a.globalScore - b.globalScore)
    .slice(0, 20);

  const avgGlobalScore =
    qaResults.length > 0
      ? Math.round(qaResults.reduce((sum, r) => sum + r.globalScore, 0) / qaResults.length)
      : null;
  const callsWithFlagsCount = qaResults.filter((r) => r.flags.length > 0).length;

  useEffect(() => {
    void loadQaAdvanced(period, effectiveSelectedFlagType);
  }, [period, effectiveSelectedFlagType, loadQaAdvanced]);

  useEffect(() => {
    if (tab !== 'qa') return;
    if (batchTemplates.length > 0) return;

    axios.get('/api/qa/templates', { headers: authHeader() }).then((res) => {
      const active = (res.data.templates || []).filter((t: BatchTemplate) => t.isActive);
      setBatchTemplates(active);
      if (active.length > 0) {
        setBatchSelectedTemplate((current) => current || active[0].id);
      }
    }).catch(() => {});
  }, [tab, batchTemplates.length, authHeader]);

  useEffect(() => {
    if (tab !== 'qa') return;
    if (!batchSelectedTemplate) return;

    setBatchEligible(null);
    setBatchLoadingEligible(true);

    axios.get(`/api/qa/batch-eligible?templateId=${batchSelectedTemplate}&period=${period}&skipExisting=${batchSkipExisting}`, {
      headers: authHeader(),
    })
      .then((res) => setBatchEligible(res.data.calls || []))
      .catch(() => setBatchEligible([]))
      .finally(() => setBatchLoadingEligible(false));
  }, [tab, batchSelectedTemplate, batchSkipExisting, period, authHeader]);

  const handleStartBatch = useCallback(async () => {
    if (!batchEligible || batchEligible.length === 0 || !batchSelectedTemplate) return;

    batchCancelRef.current = false;
    setBatchState({
      status: 'running',
      progress: 0,
      successCount: 0,
      errorCount: 0,
      total: batchEligible.length,
    });

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < batchEligible.length; i++) {
      if (batchCancelRef.current) {
        setBatchState({
          status: 'cancelled',
          progress: i,
          successCount,
          errorCount,
          total: batchEligible.length,
        });
        return;
      }

      const call = batchEligible[i];

      try {
        await axios.post(`/api/qa/analyze/${call.id}`, { templateId: batchSelectedTemplate }, {
          headers: authHeader(),
        });
        successCount += 1;
      } catch {
        errorCount += 1;
      }

      setBatchState({
        status: 'running',
        progress: i + 1,
        successCount,
        errorCount,
        total: batchEligible.length,
      });
    }

    setBatchState({
      status: 'done',
      progress: batchEligible.length,
      successCount,
      errorCount,
      total: batchEligible.length,
    });
    void loadQaResults(period);
  }, [batchEligible, batchSelectedTemplate, authHeader, loadQaResults, period]);

  const handleCancelBatch = useCallback(() => {
    batchCancelRef.current = true;
  }, []);

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
              {t === 'overview' ? "Vue d'ensemble" : 'Qualité IA'}
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
            {/* Hero KPIs */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <KpiHeroCard
                label="Total appels"
                value={ov?.totalCalls ?? 0}
                sub={`${ov?.inbound ?? 0} entrants · ${ov?.outbound ?? 0} sortants`}
                icon={<Phone className="h-5 w-5" />}
              />
              <KpiHeroCard
                label="Durée moyenne"
                value={formatDuration(ov?.avgDurationSec ?? null)}
                sub={ov?.avgTimeToTransferSec ? `Transfert en ${formatDuration(ov.avgTimeToTransferSec)}` : undefined}
                icon={<Clock className="h-5 w-5" />}
              />
              <KpiHeroCard
                label="Appels urgents"
                value={ov?.urgentCount ?? 0}
                sub={(ov?.urgentCount ?? 0) > 0 ? 'Nécessitent une attention' : 'Aucun signalement'}
                highlight={(ov?.urgentCount ?? 0) > 0}
                icon={<AlertTriangle className="h-5 w-5" />}
              />
            </div>

            {/* KPIs secondaires */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <KpiSmallCard
                label="Entrants"
                value={ov?.inbound ?? 0}
                sub={ov && ov.totalCalls > 0 ? `${Math.round((ov.inbound / ov.totalCalls) * 100)}%` : undefined}
                icon={<PhoneIncoming className="h-3.5 w-3.5" />}
              />
              <KpiSmallCard
                label="Sortants"
                value={ov?.outbound ?? 0}
                sub={ov && ov.totalCalls > 0 ? `${Math.round((ov.outbound / ov.totalCalls) * 100)}%` : undefined}
                icon={<PhoneOutgoing className="h-3.5 w-3.5" />}
              />
              <KpiSmallCard
                label="Taux d'abandon"
                value={`${ov?.abandonRate ?? 0}%`}
                highlight={(ov?.abandonRate ?? 0) > 20}
                icon={<TrendingDown className="h-3.5 w-3.5" />}
              />
              <KpiSmallCard
                label="Taux de transfert"
                value={`${ov?.transferRate ?? 0}%`}
                icon={<ArrowRightLeft className="h-3.5 w-3.5" />}
              />
              <KpiSmallCard
                label="Taux de RDV"
                value={`${ov?.appointmentRate ?? 0}%`}
                icon={<Calendar className="h-3.5 w-3.5" />}
              />
              <KpiSmallCard
                label="Tps avant transfert"
                value={formatDuration(ov?.avgTimeToTransferSec ?? null)}
                icon={<Clock className="h-3.5 w-3.5" />}
              />
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {/* Volume — Area chart */}
              <ChartCard title="Volume d'appels">
                {kpiData.charts.volumeBySlot.length === 0 ? (
                  <p className="py-8 text-center text-sm text-[#344453]/40">Aucun appel sur cette période</p>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <AreaChart data={kpiData.charts.volumeBySlot.map((d) => ({
                      ...d,
                      slot: formatSlot(d.slot, period),
                    }))}>
                      <defs>
                        <linearGradient id="gradInbound" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#344453" stopOpacity={0.12} />
                          <stop offset="95%" stopColor="#344453" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="gradOutbound" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#C7601D" stopOpacity={0.12} />
                          <stop offset="95%" stopColor="#C7601D" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(52,68,83,0.06)" />
                      <XAxis dataKey="slot" tick={{ fontSize: 11, fill: 'rgba(52,68,83,0.45)' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: 'rgba(52,68,83,0.45)' }} axisLine={false} tickLine={false} allowDecimals={false} />
                      <Tooltip
                        contentStyle={{ borderRadius: 12, border: '1px solid rgba(52,68,83,0.1)', boxShadow: '0 4px 20px rgba(52,68,83,0.12)', fontSize: 12 }}
                        cursor={{ stroke: 'rgba(52,68,83,0.08)', strokeWidth: 1 }}
                      />
                      <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                      <Area type="monotone" dataKey="inbound" name="Entrants" stroke="#344453" strokeWidth={2} fill="url(#gradInbound)" dot={false} />
                      <Area type="monotone" dataKey="outbound" name="Sortants" stroke="#C7601D" strokeWidth={2} fill="url(#gradOutbound)" dot={false} />
                    </AreaChart>
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
                        innerRadius={52}
                        outerRadius={80}
                        paddingAngle={2}
                        label={({ intent, percent }: { intent: string; percent: number }) =>
                          percent > 0.06 ? `${intent} (${(percent * 100).toFixed(0)}%)` : ''
                        }
                        labelLine={false}
                      >
                        {kpiData.charts.intentDistribution.map((entry) => (
                          <Cell key={entry.intent || 'autre'} fill={getIntentColor(entry.intent || 'autre')} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ borderRadius: 12, border: '1px solid rgba(52,68,83,0.1)', fontSize: 12 }}
                        formatter={(value: number, name: string) => [value, name]}
                      />
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
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(52,68,83,0.06)" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 11, fill: 'rgba(52,68,83,0.45)' }} axisLine={false} tickLine={false} allowDecimals={false} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: 'rgba(52,68,83,0.6)' }} axisLine={false} tickLine={false} width={110} />
                      <Tooltip
                        contentStyle={{ borderRadius: 12, border: '1px solid rgba(52,68,83,0.1)', fontSize: 12 }}
                      />
                      <Bar dataKey="count" name="Appels" fill="#344453" radius={[0, 6, 6, 0]} />
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
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(52,68,83,0.06)" vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'rgba(52,68,83,0.45)' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: 'rgba(52,68,83,0.45)' }} axisLine={false} tickLine={false} allowDecimals={false} />
                      <Tooltip
                        contentStyle={{ borderRadius: 12, border: '1px solid rgba(52,68,83,0.1)', fontSize: 12 }}
                      />
                      <Bar dataKey="count" name="Appels" radius={[6, 6, 0, 0]}>
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
            {/* Actions QA */}
            <div className="flex items-center justify-end gap-3">
              <Link
                to="/settings/qa"
                className="inline-flex items-center gap-2 rounded-full border border-[#344453]/20 bg-white px-4 py-2 text-sm font-medium text-[#344453] hover:bg-[#344453]/5 transition"
              >
                Configurer les templates
              </Link>
              {batchState.status === 'running' ? (
                <button
                  onClick={handleCancelBatch}
                  onMouseEnter={() => setBatchControlHovered(true)}
                  onMouseLeave={() => setBatchControlHovered(false)}
                  className={`group relative flex h-11 w-full max-w-[320px] items-center overflow-hidden rounded-full border px-4 text-sm font-medium transition sm:w-[320px] ${
                    batchControlHovered
                      ? 'border-[#D94052]/30 bg-[#D94052]/8 text-[#D94052]'
                      : 'border-[#344453]/15 bg-white text-[#344453] shadow-[0_4px_12px_rgba(52,68,83,0.12)]'
                  }`}
                >
                  {batchControlHovered ? (
                    <span className="mx-auto inline-flex items-center gap-2">
                      <Square className="h-3.5 w-3.5" />
                      Stopper l'analyse
                    </span>
                  ) : (
                    <>
                      <div className="absolute inset-0 bg-[#344453]/6" />
                      <div
                        className="absolute inset-y-0 left-0 bg-[#344453] transition-all duration-300"
                        style={{ width: batchState.total > 0 ? `${(batchState.progress / batchState.total) * 100}%` : '0%' }}
                      />
                      <span className="relative z-10 flex w-full items-center justify-between gap-3 text-white">
                        <span className="truncate">Analyse en cours…</span>
                        <span className="shrink-0" style={{ fontFamily: 'var(--font-mono)' }}>
                          {batchState.progress} / {batchState.total}
                        </span>
                      </span>
                    </>
                  )}
                </button>
              ) : (
                <button
                  onClick={() => setShowBatchModal(true)}
                  className="inline-flex items-center gap-2 rounded-full bg-[#344453] px-4 py-2 text-sm font-medium text-white shadow-[0_4px_12px_rgba(52,68,83,0.18)] hover:bg-[#2a3848] transition"
                >
                  <Play className="h-3.5 w-3.5" />
                  Lancer un batch d'analyses
                </button>
              )}
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
              <div className="space-y-6">
                {/* Résumé QA */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <QaSummaryCard
                    label="Score moyen global"
                    value={avgGlobalScore !== null ? `${avgGlobalScore}/100` : '—'}
                    sub={avgGlobalScore !== null ? scoreLabel(avgGlobalScore) : undefined}
                    color={avgGlobalScore !== null ? scoreColor(avgGlobalScore) : undefined}
                    icon={<Shield className="h-5 w-5" />}
                  />
                  <QaSummaryCard
                    label="Appels analysés"
                    value={qaResults.length}
                    sub="sur la période sélectionnée"
                    icon={<BarChart3 className="h-5 w-5" />}
                  />
                  <QaSummaryCard
                    label="Avec flags"
                    value={callsWithFlagsCount}
                    sub={qaResults.length > 0 ? `${Math.round((callsWithFlagsCount / qaResults.length) * 100)}% des analyses` : undefined}
                    color={callsWithFlagsCount > 0 ? '#D94052' : undefined}
                    icon={<AlertTriangle className="h-5 w-5" />}
                  />
                </div>

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  {/* Score par agent */}
                  <ChartCard title="Score qualité par agent">
                    {agentScores.length === 0 ? (
                      <p className="py-8 text-center text-sm text-[#344453]/40">Aucune donnée</p>
                    ) : (
                      <div className="space-y-5">
                        {agentScores.map((a, idx) => (
                          <div key={a.name} className="flex items-center gap-3">
                            <span className="w-4 shrink-0 text-center text-xs font-semibold text-[#344453]/25" style={{ fontFamily: 'var(--font-mono)' }}>
                              {idx + 1}
                            </span>
                            <div
                              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                              style={{
                                backgroundColor: `${scoreColor(a.avgScore)}18`,
                                color: scoreColor(a.avgScore),
                              }}
                            >
                              {getInitials(a.name)}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="mb-1.5 flex items-center justify-between gap-2">
                                <span className="truncate text-sm font-medium text-[#141F28]">{a.name}</span>
                                <span
                                  className="shrink-0 text-sm font-bold"
                                  style={{ color: scoreColor(a.avgScore) }}
                                >
                                  {a.avgScore}/100
                                </span>
                              </div>
                              <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#344453]/8">
                                <div
                                  className="h-full rounded-full transition-all"
                                  style={{
                                    width: `${a.avgScore}%`,
                                    backgroundColor: scoreColor(a.avgScore),
                                  }}
                                />
                              </div>
                              <p className="mt-1 text-[10px] text-[#344453]/40">
                                {a.count} appel{a.count > 1 ? 's' : ''}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </ChartCard>

                  {/* Critères les plus faibles */}
                  <ChartCard title="Critères les plus faibles">
                    {weakCriteria.length === 0 ? (
                      <p className="py-8 text-center text-sm text-[#344453]/40">Aucune donnée</p>
                    ) : (
                      <div>
                        {weakCriteria.slice(0, 8).map((criterion, idx) => {
                          const ratio = criterion.avg_max > 0 ? criterion.avg / criterion.avg_max : 0;
                          const color = ratio >= 0.7 ? '#2D9D78' : ratio >= 0.5 ? '#C7601D' : '#D94052';
                          return (
                            <div
                              key={criterion.critere_id}
                              className="flex items-center gap-3 border-b border-[#344453]/6 py-3 last:border-0"
                            >
                              <span className="w-4 shrink-0 text-center text-xs font-semibold text-[#344453]/25" style={{ fontFamily: 'var(--font-mono)' }}>
                                {idx + 1}
                              </span>
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-medium text-[#141F28]">{criterion.label}</p>
                                <p className="mt-0.5 text-[10px] text-[#344453]/40">Poids {criterion.weight}%</p>
                                <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-[#344453]/8">
                                  <div
                                    className="h-full rounded-full"
                                    style={{ width: `${ratio * 100}%`, backgroundColor: color }}
                                  />
                                </div>
                              </div>
                              <div className="shrink-0 text-right">
                                <span className="text-sm font-bold" style={{ color }}>
                                  {criterion.avg.toFixed(1)}
                                </span>
                                <span className="text-xs text-[#344453]/40">/{criterion.avg_max}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </ChartCard>

                  {/* Top flags — liste avec barres */}
                  {flagFrequency.length > 0 && (
                    <ChartCard title="Flags de friction les plus fréquents">
                      <div className="space-y-3">
                        {flagFrequency.map(({ flag, count }) => {
                          const maxCount = flagFrequency[0]?.count || 1;
                          return (
                            <div key={flag} className="flex items-center gap-3">
                              <div className="min-w-0 flex-1">
                                <div className="mb-1 flex items-center justify-between gap-2">
                                  <span className="truncate text-sm text-[#141F28]">
                                    {flag.replace(/_/g, ' ')}
                                  </span>
                                  <span className="shrink-0 text-sm font-bold text-[#D94052]">{count}</span>
                                </div>
                                <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#344453]/8">
                                  <div
                                    className="h-full rounded-full bg-[#D94052]/55"
                                    style={{ width: `${(count / maxCount) * 100}%` }}
                                  />
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </ChartCard>
                  )}

                  {/* Distribution des scores */}
                  <ChartCard title="Distribution des scores">
                    {scoreDistribution.length === 0 ? (
                      <p className="py-8 text-center text-sm text-[#344453]/40">Aucune donnée</p>
                    ) : (
                      <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={scoreDistribution}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(52,68,83,0.06)" vertical={false} />
                          <XAxis dataKey="bucket" tick={{ fontSize: 11, fill: 'rgba(52,68,83,0.45)' }} axisLine={false} tickLine={false} />
                          <YAxis tick={{ fontSize: 11, fill: 'rgba(52,68,83,0.45)' }} axisLine={false} tickLine={false} allowDecimals={false} />
                          <Tooltip
                            contentStyle={{ borderRadius: 12, border: '1px solid rgba(52,68,83,0.1)', fontSize: 12 }}
                          />
                          <Bar dataKey="count" name="Appels" fill="#344453" radius={[6, 6, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </ChartCard>

                  {/* Évolution du score moyen */}
                  <ChartCard title="Évolution du score moyen">
                    {scoreTrend.length === 0 ? (
                      <p className="py-8 text-center text-sm text-[#344453]/40">Aucune donnée</p>
                    ) : (
                      <ResponsiveContainer width="100%" height={220}>
                        <LineChart data={scoreTrend}>
                          <defs>
                            <linearGradient id="gradScore" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#2D9D78" stopOpacity={0.15} />
                              <stop offset="95%" stopColor="#2D9D78" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(52,68,83,0.06)" />
                          <XAxis dataKey="slot" tick={{ fontSize: 11, fill: 'rgba(52,68,83,0.45)' }} axisLine={false} tickLine={false} />
                          <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: 'rgba(52,68,83,0.45)' }} axisLine={false} tickLine={false} />
                          <Tooltip
                            contentStyle={{ borderRadius: 12, border: '1px solid rgba(52,68,83,0.1)', fontSize: 12 }}
                            formatter={(v) => [`${v}/100`, 'Score moyen']}
                          />
                          <Line type="monotone" dataKey="avgScore" name="Score moyen" stroke="#2D9D78" strokeWidth={2} dot={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    )}
                  </ChartCard>

                  {/* Évolution d'un flag */}
                  <ChartCard
                    title="Évolution d'un flag"
                    action={
                      flagFrequency.length > 0 ? (
                        <select
                          value={effectiveSelectedFlagType}
                          onChange={(event) => setSelectedFlagType(event.target.value)}
                          className="rounded-lg border border-[#344453]/12 bg-[#F8F9FB] px-2.5 py-1.5 text-xs text-[#141F28] outline-none hover:border-[#344453]/25 transition"
                        >
                          {flagFrequency.map((entry) => (
                            <option key={entry.flag} value={entry.flag}>{entry.flag.replace(/_/g, ' ')}</option>
                          ))}
                        </select>
                      ) : undefined
                    }
                  >
                    {flagTrend.length === 0 ? (
                      <p className="py-8 text-center text-sm text-[#344453]/40">Aucune donnée</p>
                    ) : (
                      <ResponsiveContainer width="100%" height={200}>
                        <AreaChart data={flagTrend}>
                          <defs>
                            <linearGradient id="gradFlag" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#D94052" stopOpacity={0.12} />
                              <stop offset="95%" stopColor="#D94052" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(52,68,83,0.06)" />
                          <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'rgba(52,68,83,0.45)' }} axisLine={false} tickLine={false} />
                          <YAxis tick={{ fontSize: 11, fill: 'rgba(52,68,83,0.45)' }} axisLine={false} tickLine={false} allowDecimals={false} />
                          <Tooltip
                            contentStyle={{ borderRadius: 12, border: '1px solid rgba(52,68,83,0.1)', fontSize: 12 }}
                          />
                          <Area type="monotone" dataKey="count" stroke="#D94052" strokeWidth={2} fill="url(#gradFlag)" dot={false} />
                        </AreaChart>
                      </ResponsiveContainer>
                    )}
                  </ChartCard>
                </div>

                {/* Appels à relire */}
                <div>
                  <div className="mb-3 flex items-center justify-between gap-4">
                    <SectionTitle>Appels à relire</SectionTitle>
                    <div className="flex items-center gap-2.5">
                      <label className="text-xs text-[#344453]/55">Seuil</label>
                      <div className="flex items-center gap-2 rounded-xl border border-[#344453]/15 bg-white px-3 py-1.5">
                        <input
                          type="range"
                          min={0}
                          max={100}
                          step={5}
                          value={reviewThreshold}
                          onChange={(event) => setReviewThreshold(Number(event.target.value))}
                          className="w-24 accent-[#344453]"
                        />
                        <span className="w-12 text-right text-sm font-semibold text-[#141F28]" style={{ fontFamily: 'var(--font-mono)' }}>
                          {reviewThreshold}/100
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="overflow-hidden rounded-2xl border border-[#344453]/10 bg-white shadow-sm">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-[#344453]/8 bg-[#344453]/[0.02] text-left">
                          <th className="px-4 py-3 text-[10px] uppercase tracking-[0.18em] text-[#344453]/40 font-semibold">Appel</th>
                          <th className="px-4 py-3 text-[10px] uppercase tracking-[0.18em] text-[#344453]/40 font-semibold">Agent</th>
                          <th className="px-4 py-3 text-[10px] uppercase tracking-[0.18em] text-[#344453]/40 font-semibold">Score</th>
                          <th className="px-4 py-3 text-[10px] uppercase tracking-[0.18em] text-[#344453]/40 font-semibold">Flags</th>
                          <th className="px-4 py-3"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#344453]/5">
                        {callsToReview.map((r) => (
                          <tr key={`review-${r.id}`} className="hover:bg-[#344453]/[0.018] transition">
                            <td className="px-4 py-3">
                              <Link to={`/calls/${r.callId}/qa`} className="font-mono text-xs text-[#344453]/55 hover:text-[#344453] transition">
                                {r.callId.slice(0, 8)}…
                              </Link>
                            </td>
                            <td className="px-4 py-3 text-sm text-[#344453]/70">
                              {r.agentFirstName && r.agentLastName ? `${r.agentFirstName} ${r.agentLastName}` : '—'}
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className="inline-block rounded-lg px-2.5 py-1 text-xs font-bold"
                                style={{
                                  backgroundColor: `${scoreColor(r.globalScore)}18`,
                                  color: scoreColor(r.globalScore),
                                }}
                              >
                                {r.globalScore}/100
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex flex-wrap items-center gap-1.5">
                                {r.flags.map((flag) => (
                                  <span key={`${r.id}-${flag}`} className="rounded-md bg-[#D94052]/8 px-2 py-0.5 text-[10px] font-medium text-[#D94052]">
                                    {flag.replace(/_/g, ' ')}
                                  </span>
                                ))}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <Link to={`/calls/${r.callId}/qa`} className="text-xs font-semibold text-[#C7601D] hover:underline">
                                Voir →
                              </Link>
                            </td>
                          </tr>
                        ))}
                        {callsToReview.length === 0 && (
                          <tr>
                            <td colSpan={5} className="px-4 py-8 text-center text-sm text-[#344453]/40">
                              Aucun appel sous le seuil ou avec flag critique.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Dernières analyses */}
                <div>
                  <SectionTitle>Dernières analyses</SectionTitle>
                  <div className="overflow-hidden rounded-2xl border border-[#344453]/10 bg-white shadow-sm">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-[#344453]/8 bg-[#344453]/[0.02] text-left">
                          <th className="px-4 py-3 text-[10px] uppercase tracking-[0.18em] text-[#344453]/40 font-semibold">Appel</th>
                          <th className="px-4 py-3 text-[10px] uppercase tracking-[0.18em] text-[#344453]/40 font-semibold">Agent</th>
                          <th className="px-4 py-3 text-[10px] uppercase tracking-[0.18em] text-[#344453]/40 font-semibold">Template</th>
                          <th className="px-4 py-3 text-[10px] uppercase tracking-[0.18em] text-[#344453]/40 font-semibold">Score</th>
                          <th className="px-4 py-3 text-[10px] uppercase tracking-[0.18em] text-[#344453]/40 font-semibold">Flags</th>
                          <th className="px-4 py-3 text-[10px] uppercase tracking-[0.18em] text-[#344453]/40 font-semibold">Date</th>
                          <th className="px-4 py-3"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#344453]/5">
                        {qaResults.slice(0, 20).map((r) => (
                          <tr key={r.id} className="hover:bg-[#344453]/[0.018] transition">
                            <td className="px-4 py-3">
                              <Link to={`/calls/${r.callId}/qa`} className="font-mono text-xs text-[#344453]/55 hover:text-[#344453] transition">
                                {r.callId.slice(0, 8)}…
                              </Link>
                            </td>
                            <td className="px-4 py-3 text-[#344453]/70">
                              {r.agentFirstName && r.agentLastName
                                ? `${r.agentFirstName} ${r.agentLastName}`
                                : '—'}
                            </td>
                            <td className="px-4 py-3 text-[#344453]/55 text-xs">{r.templateName}</td>
                            <td className="px-4 py-3">
                              <span
                                className="inline-block rounded-lg px-2.5 py-1 text-xs font-bold"
                                style={{
                                  backgroundColor: `${scoreColor(r.globalScore)}18`,
                                  color: scoreColor(r.globalScore),
                                }}
                              >
                                {r.globalScore}/100
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex flex-wrap gap-1">
                                {(r.flags || []).slice(0, 2).map((f) => (
                                  <span key={f} className="rounded-md bg-[#344453]/8 px-2 py-0.5 text-[10px] text-[#344453]/60">
                                    {f.replace(/_/g, ' ')}
                                  </span>
                                ))}
                                {(r.flags || []).length > 2 && (
                                  <span className="rounded-md bg-[#344453]/6 px-2 py-0.5 text-[10px] text-[#344453]/45">
                                    +{r.flags.length - 2}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-xs text-[#344453]/40">
                              {r.processedAt
                                ? format(parseISO(r.processedAt), 'dd/MM/yy HH:mm', { locale: fr })
                                : '—'}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <Link to={`/calls/${r.callId}/qa`} className="text-xs font-semibold text-[#C7601D] hover:underline">
                                Ouvrir →
                              </Link>
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
          templates={batchTemplates}
          selectedTemplate={batchSelectedTemplate}
          onSelectTemplate={setBatchSelectedTemplate}
          skipExisting={batchSkipExisting}
          onToggleSkipExisting={() => setBatchSkipExisting((value) => !value)}
          eligible={batchEligible}
          loadingEligible={batchLoadingEligible}
          batchState={batchState}
          onStart={() => { void handleStartBatch(); }}
          onCancel={handleCancelBatch}
          onClose={() => setShowBatchModal(false)}
          onDone={() => loadQaResults(period)}
        />
      )}
    </Layout>
  );
}
