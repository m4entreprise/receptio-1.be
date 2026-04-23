import { useEffect, useState, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  Phone, PhoneIncoming, PhoneOutgoing, Search, X,
  ChevronLeft, ChevronRight, FileText, Zap,
  Loader2, UserCheck, RefreshCw, ExternalLink, AlertTriangle,
} from 'lucide-react';
import axios from 'axios';
import Layout from '../components/Layout';
import { getStatusDisplay } from '../utils/callStatus';

// ── Types ────────────────────────────────────────────────────────────────────

interface CallRow {
  id: string;
  caller_number?: string | null;
  direction?: string | null;
  status: string;
  duration?: number | null;
  created_at: string;
  summary?: string | null;
  transcription_text?: string | null;
  qa_result_id?: string | null;
  qa_score?: number | null;
}

interface QueuedCall {
  id: string;
  caller_number?: string | null;
  caller_name?: string | null;
  call_sid?: string | null;
  queue_reason?: string | null;
  queued_at: string;
}

interface StaffMember {
  id: string;
  first_name: string;
  last_name: string;
  phone_number: string;
  role?: string;
  enabled: boolean;
}

interface KpiData {
  totalCalls: number;
  inbound: number;
  outbound: number;
  avgDurationSec: number | null;
  transferRate: number;
  abandonRate: number;
}

interface Template {
  id: string;
  name: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const PAGE_SIZE = 25;

const PERIOD_OPTIONS = [
  { value: 'today', label: "Aujourd'hui" },
  { value: '7d', label: '7 jours' },
  { value: '30d', label: '30 jours' },
  { value: 'custom', label: 'Personnalisé' },
] as const;

const STATUS_OPTIONS = [
  { value: '', label: 'Tous les statuts' },
  { value: 'completed', label: 'Terminé' },
  { value: 'transferred', label: 'Transféré' },
  { value: 'queued', label: 'En attente' },
  { value: 'answered', label: 'En cours' },
  { value: 'missed', label: 'Manqué' },
  { value: 'failed', label: 'Échoué' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDuration(seconds?: number | null): string {
  if (!seconds || seconds === 0) return '—';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function formatAvgDuration(seconds: number | null): string {
  if (!seconds) return '—';
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function formatTime(isoDate: string, period: string): string {
  const d = new Date(isoDate);
  if (period === 'today') {
    return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function formatElapsed(isoDate: string, now: number): string {
  const secs = Math.floor((now - new Date(isoDate).getTime()) / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins} min`;
  return `${Math.floor(mins / 60)}h${String(mins % 60).padStart(2, '0')}`;
}

function getPeriodParams(period: string, customFrom: string, customTo: string): Record<string, string> {
  const now = new Date();
  if (period === 'today') {
    const start = new Date(now); start.setHours(0, 0, 0, 0);
    return { from: start.toISOString(), to: now.toISOString() };
  }
  if (period === '7d') {
    const start = new Date(now); start.setDate(start.getDate() - 7);
    return { from: start.toISOString(), to: now.toISOString() };
  }
  if (period === '30d') {
    const start = new Date(now); start.setDate(start.getDate() - 30);
    return { from: start.toISOString(), to: now.toISOString() };
  }
  if (period === 'custom' && customFrom && customTo) {
    return {
      from: new Date(customFrom).toISOString(),
      to: new Date(customTo + 'T23:59:59').toISOString(),
    };
  }
  return {};
}

function qaScoreClass(score: number): string {
  if (score >= 70) return 'bg-[#2D9D78]/12 text-[#2D9D78] hover:bg-[#2D9D78]/20';
  if (score >= 50) return 'bg-[#E6A817]/15 text-[#E6A817] hover:bg-[#E6A817]/25';
  return 'bg-[#D94052]/12 text-[#D94052] hover:bg-[#D94052]/20';
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function Dashboard() {
  // Data
  const [kpis, setKpis] = useState<KpiData | null>(null);
  const [calls, setCalls] = useState<CallRow[]>([]);
  const [total, setTotal] = useState(0);
  const [queuedCalls, setQueuedCalls] = useState<QueuedCall[]>([]);
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);

  // Filters
  const [period, setPeriod] = useState<string>('today');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [directionFilter, setDirectionFilter] = useState('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Pagination
  const [page, setPage] = useState(0);

  // UI state
  const [tableLoading, setTableLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [now, setNow] = useState(Date.now());

  // Queue actions
  const [selectedStaff, setSelectedStaff] = useState<Record<string, string>>({});
  const [transferring, setTransferring] = useState<Record<string, boolean>>({});
  const [transferResult, setTransferResult] = useState<Record<string, string>>({});
  const [abandoning, setAbandoning] = useState<Record<string, boolean>>({});

  // Modals
  const [summaryCall, setSummaryCall] = useState<CallRow | null>(null);
  const [analyzeCallId, setAnalyzeCallId] = useState<string | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState('');

  // Debounce search
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setDebouncedSearch(search), 400);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [search]);

  // Reset page when filters change
  useEffect(() => { setPage(0); }, [period, statusFilter, directionFilter, debouncedSearch]);

  // ── Fetch functions ─────────────────────────────────────────────────────────

  const fetchKpis = useCallback(async () => {
    try {
      const kpiPeriod = period === 'custom' ? '30d' : period;
      const res = await axios.get(`/api/analytics/kpis?period=${kpiPeriod}`);
      setKpis(res.data);
    } catch { /* silently ignore */ }
  }, [period]);

  const fetchCalls = useCallback(async (showLoader = true) => {
    if (showLoader) setTableLoading(true);
    try {
      const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(page * PAGE_SIZE) });
      const periodParams = getPeriodParams(period, customFrom, customTo);
      if (periodParams.from) params.set('from', periodParams.from);
      if (periodParams.to) params.set('to', periodParams.to);
      if (statusFilter) params.set('status', statusFilter);
      if (directionFilter) params.set('direction', directionFilter);
      if (debouncedSearch) params.set('search', debouncedSearch);

      const res = await axios.get(`/api/calls?${params.toString()}`);
      setCalls(res.data.calls || []);
      setTotal(res.data.total || 0);
      setLastRefresh(new Date());
    } catch { /* keep previous data */ }
    finally { if (showLoader) setTableLoading(false); }
  }, [page, period, customFrom, customTo, statusFilter, directionFilter, debouncedSearch]);

  const fetchQueue = useCallback(async () => {
    try {
      const res = await axios.get('/api/calls/queued').catch(() => ({ data: { calls: [] } }));
      setQueuedCalls(res.data.calls || []);
    } catch { /* ignore */ }
  }, []);

  const fetchStatic = useCallback(async () => {
    try {
      const [staffRes, templatesRes] = await Promise.allSettled([
        axios.get('/api/staff'),
        axios.get('/api/qa/templates'),
      ]);
      if (staffRes.status === 'fulfilled') {
        setStaffList((staffRes.value.data.staff || []).filter((s: StaffMember) => s.enabled));
      }
      if (templatesRes.status === 'fulfilled') {
        setTemplates(templatesRes.value.data.templates || []);
      }
    } catch { /* ignore */ }
  }, []);

  // Initial load
  useEffect(() => {
    void fetchStatic();
    void fetchQueue();
    // Tick for queue timers
    const tick = window.setInterval(() => setNow(Date.now()), 10000);
    return () => window.clearInterval(tick);
  }, [fetchStatic, fetchQueue]);

  // Reload calls + kpis when filters/page change
  useEffect(() => {
    void fetchKpis();
    void fetchCalls(true);
  }, [fetchKpis, fetchCalls]);

  // Auto-refresh (calls every 30s, queue every 10s)
  useEffect(() => {
    const callsInterval = window.setInterval(() => {
      void fetchCalls(false);
      void fetchKpis();
    }, 30000);
    const queueInterval = window.setInterval(() => void fetchQueue(), 10000);
    return () => { window.clearInterval(callsInterval); window.clearInterval(queueInterval); };
  }, [fetchCalls, fetchKpis, fetchQueue]);

  // ── Queue handlers ──────────────────────────────────────────────────────────

  const handleTransfer = async (callId: string) => {
    const phone = selectedStaff[callId];
    if (!phone) return;
    setTransferring((p) => ({ ...p, [callId]: true }));
    setTransferResult((p) => ({ ...p, [callId]: '' }));
    try {
      await axios.post(`/api/calls/${callId}/transfer`, { staffPhone: phone });
      setTransferResult((p) => ({ ...p, [callId]: 'Transféré ✓' }));
      setTimeout(() => { void fetchQueue(); void fetchCalls(false); }, 1500);
    } catch {
      setTransferResult((p) => ({ ...p, [callId]: 'Erreur lors du transfert' }));
    } finally {
      setTransferring((p) => ({ ...p, [callId]: false }));
    }
  };

  const handleAbandon = async (callId: string) => {
    setAbandoning((p) => ({ ...p, [callId]: true }));
    try {
      await axios.post(`/api/calls/${callId}/abandon`);
      await fetchQueue();
      await fetchCalls(false);
    } catch {
      setAbandoning((p) => ({ ...p, [callId]: false }));
    }
  };

  // ── Analyze handler ─────────────────────────────────────────────────────────

  const handleAnalyze = async () => {
    if (!analyzeCallId || !selectedTemplateId) return;
    setAnalyzing(true);
    setAnalyzeError('');
    try {
      await axios.post(`/api/qa/analyze/${analyzeCallId}`, { templateId: selectedTemplateId });
      setAnalyzeCallId(null);
      setSelectedTemplateId('');
      await fetchCalls(false);
    } catch {
      setAnalyzeError("Erreur lors de l'analyse. Réessayez.");
    } finally {
      setAnalyzing(false);
    }
  };

  // ── Derived ─────────────────────────────────────────────────────────────────

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasActiveFilters = statusFilter !== '' || directionFilter !== '' || debouncedSearch !== '';

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <Layout>
      <div className="space-y-4">

        {/* ── KPI Band ─────────────────────────────────────────────────────── */}
        <div className="rounded-2xl border border-[#344453]/10 bg-white shadow-sm">

          {/* Period tabs */}
          <div className="flex items-center justify-between border-b border-[#344453]/8 px-4 py-3 gap-4 flex-wrap">
            <div className="flex items-center gap-1 rounded-xl bg-[#344453]/6 p-1">
              {PERIOD_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setPeriod(opt.value)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    period === opt.value
                      ? 'bg-[#344453] text-white shadow-sm'
                      : 'text-[#344453]/60 hover:text-[#344453]'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {period === 'custom' && (
              <div className="flex items-center gap-2 text-xs text-[#344453]/60">
                <input
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="rounded-lg border border-[#344453]/20 px-2 py-1.5 text-xs text-[#141F28] outline-none focus:border-[#344453]/40"
                />
                <span>→</span>
                <input
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="rounded-lg border border-[#344453]/20 px-2 py-1.5 text-xs text-[#141F28] outline-none focus:border-[#344453]/40"
                />
              </div>
            )}

            <div className="flex items-center gap-1.5 text-[10px] text-[#344453]/35" style={{ fontFamily: 'var(--font-mono)' }}>
              <RefreshCw className="h-3 w-3" />
              {lastRefresh.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </div>
          </div>

          {/* KPI numbers */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 divide-x divide-[#344453]/8">
            {[
              { label: 'Total appels', value: kpis?.totalCalls ?? '—', mono: true },
              { label: 'Entrants', value: kpis?.inbound ?? '—', mono: true },
              { label: 'Sortants', value: kpis?.outbound ?? '—', mono: true },
              {
                label: 'File d\'attente',
                value: queuedCalls.length,
                mono: true,
                alert: queuedCalls.length > 0,
              },
              { label: 'Durée moy.', value: kpis ? formatAvgDuration(kpis.avgDurationSec) : '—', mono: false },
              { label: 'Taux transfert', value: kpis ? `${Math.round(kpis.transferRate)}%` : '—', mono: false },
            ].map((kpi) => (
              <div key={kpi.label} className="px-4 py-3">
                <p className="text-[10px] uppercase tracking-[0.2em] text-[#344453]/40" style={{ fontFamily: 'var(--font-mono)' }}>
                  {kpi.label}
                </p>
                <p
                  className={`mt-1 text-xl font-semibold tracking-tight ${kpi.alert ? 'text-[#D94052]' : 'text-[#141F28]'}`}
                  style={kpi.mono ? { fontFamily: 'var(--font-mono)' } : {}}
                >
                  {String(kpi.value)}
                  {kpi.alert && queuedCalls.length > 0 && (
                    <span className="ml-1.5 inline-block h-2 w-2 rounded-full bg-[#D94052] animate-pulse" />
                  )}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Queue Panel ───────────────────────────────────────────────────── */}
        {queuedCalls.length > 0 && (
          <div className="rounded-2xl border border-[#E6A817]/30 bg-white shadow-sm overflow-hidden">
            <div className="flex items-center gap-3 border-b border-[#E6A817]/15 bg-[#E6A817]/5 px-4 py-3">
              <AlertTriangle className="h-4 w-4 text-[#E6A817] shrink-0" />
              <span className="text-sm font-semibold text-[#141F28]">
                {queuedCalls.length} appel{queuedCalls.length > 1 ? 's' : ''} en attente de transfert
              </span>
            </div>

            <div className="divide-y divide-[#344453]/8">
              {queuedCalls.map((call) => (
                <div key={call.id} className="flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-3">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#E6A817]/15 text-[#E6A817]">
                      <Phone className="h-3.5 w-3.5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[#141F28]">{call.caller_number || 'Numéro inconnu'}</p>
                      <p className="text-xs text-[#344453]/45" style={{ fontFamily: 'var(--font-mono)' }}>
                        {call.queued_at ? `En attente depuis ${formatElapsed(call.queued_at, now)}` : ''}
                        {call.queue_reason ? ` · ${call.queue_reason}` : ''}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    {staffList.length > 0 ? (
                      <>
                        <select
                          value={selectedStaff[call.id] || ''}
                          onChange={(e) => setSelectedStaff((p) => ({ ...p, [call.id]: e.target.value }))}
                          className="rounded-lg border border-[#344453]/15 bg-white px-2.5 py-1.5 text-xs text-[#141F28] outline-none focus:border-[#344453]/30"
                        >
                          <option value="">— Agent —</option>
                          {staffList.map((s) => (
                            <option key={s.id} value={s.phone_number}>
                              {s.first_name} {s.last_name}
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={() => handleTransfer(call.id)}
                          disabled={!selectedStaff[call.id] || transferring[call.id]}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-[#344453] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#2a3642] disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          {transferring[call.id] ? <Loader2 className="h-3 w-3 animate-spin" /> : <UserCheck className="h-3 w-3" />}
                          Transférer
                        </button>
                      </>
                    ) : (
                      <span className="text-xs text-[#344453]/40">Aucun agent configuré</span>
                    )}
                    {transferResult[call.id] && (
                      <span className={`text-xs font-medium ${transferResult[call.id].includes('✓') ? 'text-[#2D9D78]' : 'text-[#D94052]'}`}>
                        {transferResult[call.id]}
                      </span>
                    )}
                    <button
                      onClick={() => handleAbandon(call.id)}
                      disabled={abandoning[call.id]}
                      title="Terminer l'attente"
                      className="rounded-lg border border-[#D94052]/20 px-2.5 py-1.5 text-xs text-[#D94052] hover:bg-[#D94052]/8 transition disabled:opacity-40"
                    >
                      {abandoning[call.id] ? <Loader2 className="h-3 w-3 animate-spin inline" /> : <X className="h-3 w-3 inline" />}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Filter Toolbar ────────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Search */}
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#344453]/35" />
            <input
              type="text"
              placeholder="Numéro, résumé…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-[#344453]/15 bg-white pl-8 pr-3 py-2 text-sm text-[#141F28] outline-none placeholder:text-[#344453]/35 focus:border-[#344453]/30 focus:ring-2 focus:ring-[#344453]/8"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#344453]/35 hover:text-[#344453]/60">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Status */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-xl border border-[#344453]/15 bg-white px-3 py-2 text-sm text-[#141F28] outline-none focus:border-[#344453]/30"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>

          {/* Direction */}
          <div className="flex items-center rounded-xl border border-[#344453]/15 bg-white overflow-hidden">
            {[
              { value: '', label: 'Tous' },
              { value: 'inbound', label: 'Entrant', icon: PhoneIncoming },
              { value: 'outbound', label: 'Sortant', icon: PhoneOutgoing },
            ].map((opt) => (
              <button
                key={opt.value}
                onClick={() => setDirectionFilter(opt.value)}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors ${
                  directionFilter === opt.value
                    ? 'bg-[#344453] text-white'
                    : 'text-[#344453]/55 hover:bg-[#344453]/6'
                }`}
              >
                {opt.icon && <opt.icon className="h-3 w-3" />}
                {opt.label}
              </button>
            ))}
          </div>

          {/* Reset */}
          {hasActiveFilters && (
            <button
              onClick={() => { setSearch(''); setStatusFilter(''); setDirectionFilter(''); }}
              className="flex items-center gap-1.5 rounded-xl border border-[#344453]/15 bg-white px-3 py-2 text-xs font-medium text-[#344453]/55 hover:text-[#344453] hover:bg-[#344453]/6 transition-colors"
            >
              <X className="h-3.5 w-3.5" />
              Réinitialiser
            </button>
          )}

          <div className="ml-auto text-xs text-[#344453]/40" style={{ fontFamily: 'var(--font-mono)' }}>
            {total} résultat{total !== 1 ? 's' : ''}
          </div>
        </div>

        {/* ── Table ─────────────────────────────────────────────────────────── */}
        <div className="rounded-2xl border border-[#344453]/10 bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#344453]/8 bg-[#344453]/3">
                  <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.18em] text-[#344453]/45 whitespace-nowrap" style={{ fontFamily: 'var(--font-mono)' }}>Heure</th>
                  <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.18em] text-[#344453]/45">Numéro</th>
                  <th className="hidden sm:table-cell px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.18em] text-[#344453]/45">Direction</th>
                  <th className="hidden md:table-cell px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.18em] text-[#344453]/45 whitespace-nowrap" style={{ fontFamily: 'var(--font-mono)' }}>Durée</th>
                  <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.18em] text-[#344453]/45">Statut</th>
                  <th className="hidden lg:table-cell px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.18em] text-[#344453]/45">Résumé IA</th>
                  <th className="hidden lg:table-cell px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.18em] text-[#344453]/45">Score QA</th>
                  <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#344453]/45 text-right">→</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#344453]/6">
                {tableLoading ? (
                  <tr>
                    <td colSpan={8} className="py-16 text-center">
                      <div className="flex flex-col items-center gap-3 text-[#344453]/40">
                        <Loader2 className="h-6 w-6 animate-spin" />
                        <span className="text-xs">Chargement…</span>
                      </div>
                    </td>
                  </tr>
                ) : calls.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-16 text-center">
                      <div className="flex flex-col items-center gap-2 text-[#344453]/40">
                        <Phone className="h-8 w-8 opacity-30" />
                        <p className="text-sm font-medium text-[#344453]/50">Aucun appel trouvé</p>
                        {hasActiveFilters && (
                          <p className="text-xs">Essayez de modifier vos filtres.</p>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : calls.map((call) => {
                  const status = getStatusDisplay(call.status);
                  const isInbound = !call.direction || call.direction === 'inbound';
                  return (
                    <tr key={call.id} className="hover:bg-[#344453]/3 transition-colors group">

                      {/* Heure */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-xs text-[#344453]/60" style={{ fontFamily: 'var(--font-mono)' }}>
                          {formatTime(call.created_at, period)}
                        </span>
                      </td>

                      {/* Numéro */}
                      <td className="px-4 py-3">
                        <span className="text-sm font-medium text-[#141F28]">
                          {call.caller_number || 'Inconnu'}
                        </span>
                      </td>

                      {/* Direction */}
                      <td className="hidden sm:table-cell px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
                          isInbound
                            ? 'bg-[#344453]/8 text-[#344453]/70'
                            : 'bg-[#C7601D]/10 text-[#C7601D]'
                        }`}>
                          {isInbound
                            ? <PhoneIncoming className="h-3 w-3" />
                            : <PhoneOutgoing className="h-3 w-3" />
                          }
                          {isInbound ? 'Entrant' : 'Sortant'}
                        </span>
                      </td>

                      {/* Durée */}
                      <td className="hidden md:table-cell px-4 py-3">
                        <span className="text-xs text-[#344453]/55" style={{ fontFamily: 'var(--font-mono)' }}>
                          {formatDuration(call.duration)}
                        </span>
                      </td>

                      {/* Statut */}
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${status.color}`}>
                          {status.label}
                        </span>
                      </td>

                      {/* Résumé IA */}
                      <td className="hidden lg:table-cell px-4 py-3">
                        {call.summary ? (
                          <button
                            onClick={() => setSummaryCall(call)}
                            className="inline-flex items-center gap-1.5 rounded-full bg-[#2D9D78]/8 px-2.5 py-1 text-xs font-medium text-[#2D9D78] hover:bg-[#2D9D78]/15 transition-colors"
                          >
                            <FileText className="h-3 w-3" />
                            Voir
                          </button>
                        ) : (
                          <span className="text-[#344453]/20 text-xs">—</span>
                        )}
                      </td>

                      {/* Score QA */}
                      <td className="hidden lg:table-cell px-4 py-3">
                        {call.qa_score !== null && call.qa_score !== undefined ? (
                          <Link
                            to={`/calls/${call.id}/qa`}
                            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold transition-colors ${qaScoreClass(call.qa_score)}`}
                          >
                            <Zap className="h-3 w-3" />
                            {call.qa_score}/100
                          </Link>
                        ) : (
                          <button
                            onClick={() => { setAnalyzeCallId(call.id); setAnalyzeError(''); setSelectedTemplateId(''); }}
                            className="inline-flex items-center rounded-full border border-dashed border-[#344453]/20 px-2.5 py-1 text-xs font-medium text-[#344453]/40 hover:border-[#344453]/35 hover:text-[#344453]/60 transition-colors"
                          >
                            Analyser
                          </button>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 text-right">
                        <Link
                          to={`/calls/${call.id}`}
                          className="inline-flex items-center justify-center h-7 w-7 rounded-lg text-[#344453]/35 hover:bg-[#344453]/8 hover:text-[#344453] transition-colors"
                          title="Voir le détail"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {!tableLoading && total > PAGE_SIZE && (
            <div className="flex items-center justify-between border-t border-[#344453]/8 px-4 py-3">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#344453]/15 px-3 py-1.5 text-xs font-medium text-[#344453]/60 hover:bg-[#344453]/6 disabled:opacity-35 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Précédent
              </button>
              <span className="text-xs text-[#344453]/45" style={{ fontFamily: 'var(--font-mono)' }}>
                Page {page + 1} / {totalPages} · {total} appels
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#344453]/15 px-3 py-1.5 text-xs font-medium text-[#344453]/60 hover:bg-[#344453]/6 disabled:opacity-35 disabled:cursor-not-allowed transition-colors"
              >
                Suivant
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Summary Modal ──────────────────────────────────────────────────── */}
      {summaryCall && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setSummaryCall(null)}>
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-[#344453]/8 px-5 py-4">
              <div>
                <p className="text-sm font-semibold text-[#141F28]">Résumé IA</p>
                <p className="text-xs text-[#344453]/45 mt-0.5">
                  {summaryCall.caller_number || 'Inconnu'} · {new Date(summaryCall.created_at).toLocaleString('fr-FR')}
                </p>
              </div>
              <button onClick={() => setSummaryCall(null)} className="p-1.5 rounded-lg text-[#344453]/40 hover:bg-[#344453]/8 hover:text-[#344453] transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="px-5 py-4 max-h-96 overflow-y-auto">
              <p className="text-sm leading-7 text-[#344453]/75 whitespace-pre-wrap">{summaryCall.summary}</p>
            </div>
            <div className="border-t border-[#344453]/8 px-5 py-3 flex justify-end">
              <Link
                to={`/calls/${summaryCall.id}`}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#344453] px-4 py-2 text-xs font-semibold text-white hover:bg-[#2a3642] transition-colors"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Voir le détail complet
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* ── Analyze Modal ──────────────────────────────────────────────────── */}
      {analyzeCallId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => !analyzing && setAnalyzeCallId(null)}>
          <div className="w-full max-w-sm rounded-2xl bg-white shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-[#344453]/8 px-5 py-4">
              <div>
                <p className="text-sm font-semibold text-[#141F28]">Analyser cet appel</p>
                <p className="text-xs text-[#344453]/45 mt-0.5">Sélectionnez un template d'évaluation QA</p>
              </div>
              <button disabled={analyzing} onClick={() => setAnalyzeCallId(null)} className="p-1.5 rounded-lg text-[#344453]/40 hover:bg-[#344453]/8 hover:text-[#344453] transition-colors disabled:opacity-40">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="px-5 py-4 space-y-3">
              {templates.length === 0 ? (
                <p className="text-sm text-[#344453]/50">Aucun template disponible. Configurez-en un dans Paramètres → QA.</p>
              ) : (
                <div className="space-y-2">
                  {templates.map((t) => (
                    <label key={t.id} className={`flex items-center gap-3 rounded-xl border px-4 py-3 cursor-pointer transition-colors ${
                      selectedTemplateId === t.id
                        ? 'border-[#344453] bg-[#344453]/5'
                        : 'border-[#344453]/15 hover:border-[#344453]/30'
                    }`}>
                      <input
                        type="radio"
                        name="template"
                        value={t.id}
                        checked={selectedTemplateId === t.id}
                        onChange={() => setSelectedTemplateId(t.id)}
                        className="sr-only"
                      />
                      <div className={`h-3.5 w-3.5 rounded-full border-2 shrink-0 ${selectedTemplateId === t.id ? 'border-[#344453] bg-[#344453]' : 'border-[#344453]/30'}`} />
                      <span className="text-sm font-medium text-[#141F28]">{t.name}</span>
                    </label>
                  ))}
                </div>
              )}
              {analyzeError && (
                <p className="text-xs text-[#D94052] font-medium">{analyzeError}</p>
              )}
            </div>
            <div className="border-t border-[#344453]/8 px-5 py-3 flex gap-2 justify-end">
              <button
                disabled={analyzing}
                onClick={() => setAnalyzeCallId(null)}
                className="rounded-xl border border-[#344453]/15 px-4 py-2 text-xs font-medium text-[#344453]/60 hover:bg-[#344453]/6 transition-colors disabled:opacity-40"
              >
                Annuler
              </button>
              <button
                disabled={!selectedTemplateId || analyzing}
                onClick={handleAnalyze}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#344453] px-4 py-2 text-xs font-semibold text-white hover:bg-[#2a3642] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {analyzing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
                {analyzing ? 'Analyse en cours…' : 'Lancer l\'analyse'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
