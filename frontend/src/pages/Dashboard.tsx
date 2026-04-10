import { useEffect, useState } from 'react';
import { getStatusDisplay, isTerminalStatus } from '../utils/callStatus';
import { Link } from 'react-router-dom';
import { Phone, Clock, CheckCircle, AlertCircle, ArrowRight, CalendarClock, Sparkles, PhoneForwarded, Loader2, UserCheck, X, PhoneOutgoing } from 'lucide-react';
import axios from 'axios';
import Layout from '../components/Layout';

interface Stats {
  total: number;
  today: number;
  answered: number;
  pending: number;
}

interface RecentCall {
  id: string;
  caller_number?: string | null;
  created_at: string;
  transcription_text?: string | null;
  status: string;
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

export default function Dashboard() {
  const [stats, setStats] = useState<Stats>({ total: 0, today: 0, answered: 0, pending: 0 });
  const [recentCalls, setRecentCalls] = useState<RecentCall[]>([]);
  const [queuedCalls, setQueuedCalls] = useState<QueuedCall[]>([]);
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [selectedStaff, setSelectedStaff] = useState<Record<string, string>>({});
  const [transferring, setTransferring] = useState<Record<string, boolean>>({});
  const [transferResult, setTransferResult] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [abandoning, setAbandoning] = useState<Record<string, boolean>>({});
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    fetchDashboardData();
    fetchStaff();

    const intervalId = window.setInterval(() => {
      fetchDashboardData(false);
    }, 5000);

    const tickId = window.setInterval(() => setNow(Date.now()), 10000);

    return () => {
      window.clearInterval(intervalId);
      window.clearInterval(tickId);
    };
  }, []);

  const fetchStaff = async () => {
    try {
      const res = await axios.get('/api/staff');
      setStaffList((res.data.staff || []).filter((s: StaffMember) => s.enabled));
    } catch {
    }
  };

  const formatElapsed = (isoDate: string): string => {
    const secs = Math.floor((now - new Date(isoDate).getTime()) / 1000);
    if (secs < 60) return `${secs}s`;
    const mins = Math.floor(secs / 60);
    if (mins < 60) return `${mins} min`;
    return `${Math.floor(mins / 60)}h${String(mins % 60).padStart(2, '0')}`;
  };

  const handleAbandon = async (callId: string) => {
    setAbandoning((p) => ({ ...p, [callId]: true }));
    try {
      await axios.post(`/api/calls/${callId}/abandon`);
      await fetchDashboardData(false);
    } catch {
      setAbandoning((p) => ({ ...p, [callId]: false }));
    }
  };

  const handleTransfer = async (callId: string) => {
    const phone = selectedStaff[callId];
    if (!phone) return;
    setTransferring((p) => ({ ...p, [callId]: true }));
    setTransferResult((p) => ({ ...p, [callId]: '' }));
    try {
      await axios.post(`/api/calls/${callId}/transfer`, { staffPhone: phone });
      setTransferResult((p) => ({ ...p, [callId]: 'Transféré ✓' }));
      setTimeout(() => fetchDashboardData(false), 1500);
    } catch {
      setTransferResult((p) => ({ ...p, [callId]: 'Erreur lors du transfert' }));
    } finally {
      setTransferring((p) => ({ ...p, [callId]: false }));
    }
  };

  const fetchDashboardData = async (showLoader: boolean = true) => {
    if (showLoader) {
      setLoading(true);
    }

    try {
      const [callsRes, queuedRes] = await Promise.all([
        axios.get('/api/calls?limit=5'),
        axios.get('/api/calls/queued').catch(() => ({ data: { calls: [] } })),
      ]);

      const calls: RecentCall[] = callsRes.data.calls || [];
      setRecentCalls(calls);
      setQueuedCalls(queuedRes.data.calls || []);

      const today = new Date().toDateString();
      const todayCalls = calls.filter((c) => 
        new Date(c.created_at).toDateString() === today
      );

      setStats({
        total: callsRes.data.total || 0,
        today: todayCalls.length,
        answered: calls.filter((c) => c.status === 'completed' || c.status === 'transferred').length,
        pending: calls.filter((c) => !isTerminalStatus(c.status)).length,
      });
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      if (showLoader) {
        setLoading(false);
      }
    }
  };

  const statCards = [
    {
      label: 'Total appels',
      value: stats.total,
      icon: Phone,
      tone: 'bg-[#344453] text-white',
      detail: 'volume cumulé',
    },
    {
      label: 'Aujourd\'hui',
      value: stats.today,
      icon: Clock,
      tone: 'bg-[#2D9D78]/15 text-[#2D9D78]',
      detail: 'activité du jour',
    },
    {
      label: 'Traités',
      value: stats.answered,
      icon: CheckCircle,
      tone: 'bg-[#C7601D]/12 text-[#C7601D]',
      detail: 'clôturés proprement',
    },
    {
      label: 'En attente',
      value: stats.pending,
      icon: AlertCircle,
      tone: 'bg-[#E6A817]/15 text-[#E6A817]',
      detail: 'à reprendre',
    },
  ];

  const completionRate = stats.total === 0 ? 0 : Math.round((stats.answered / stats.total) * 100);

  if (loading) {
    return (
      <Layout>
        <div className="flex h-[50vh] items-center justify-center">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="h-12 w-12 animate-spin rounded-full border-2 border-[#344453]/10 border-t-[#344453]" />
            <p className="text-sm font-medium text-[#344453]/50">Préparation du tableau de bord…</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-5 sm:space-y-6">
        <section className="grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
          <div className="overflow-hidden rounded-[28px] border border-[#344453]/15 bg-[#141F28] p-5 text-white shadow-[0_24px_60px_rgba(20,31,40,0.18)] sm:p-7">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-white/50" style={{ fontFamily: "var(--font-mono)" }}>
              <Sparkles className="h-3.5 w-3.5" />
              Vue d'ensemble
            </div>

            <div className="mt-5 space-y-3">
              <h1 className="text-3xl font-semibold tracking-[-0.03em] text-white sm:text-4xl" style={{ fontFamily: "var(--font-title)" }}>
                Votre activité reste lisible, même sur mobile.
              </h1>
              <p className="max-w-2xl text-sm leading-7 text-white/60 sm:text-base">
                Retrouvez l’essentiel des appels entrants, leur statut et les derniers échanges dans une interface compacte, claire et pensée d’abord pour petit écran.
              </p>
              <div className="pt-2">
                <Link
                  to="/outbound"
                  className="inline-flex items-center gap-2 rounded-full bg-[#C7601D] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#a84e17]"
                >
                  <PhoneOutgoing className="h-4 w-4" />
                  Passer un appel sortant
                </Link>
              </div>
            </div>
          </div>

          <div className="rounded-[28px] border border-[#344453]/10 bg-white p-5 shadow-sm sm:p-6">
            <p className="text-[11px] uppercase tracking-[0.24em] text-[#344453]/45" style={{ fontFamily: "var(--font-mono)" }}>Rythme du jour</p>
            <div className="mt-5 space-y-5">
              <div>
                <p className="text-4xl font-semibold tracking-[-0.05em] text-[#141F28]" style={{ fontFamily: "var(--font-mono)" }}>{completionRate}%</p>
                <p className="mt-2 text-sm leading-6 text-[#344453]/55">des appels affichés sont déjà traités ou clôturés.</p>
              </div>

              <div className="h-2 overflow-hidden rounded-full bg-[#344453]/12">
                <div className="h-full rounded-full bg-[#344453]" style={{ width: `${completionRate}%` }} />
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-2xl bg-[#344453]/6 px-4 py-3">
                  <p className="text-[#344453]/50">Aujourd'hui</p>
                  <p className="mt-1 text-lg font-semibold text-[#141F28]" style={{ fontFamily: "var(--font-mono)" }}>{stats.today}</p>
                </div>
                <div className="rounded-2xl bg-[#344453]/6 px-4 py-3">
                  <p className="text-[#344453]/50">En attente</p>
                  <p className="mt-1 text-lg font-semibold text-[#141F28]" style={{ fontFamily: "var(--font-mono)" }}>{stats.pending}</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {statCards.map((stat) => {
            const Icon = stat.icon;

            return (
              <div key={stat.label} className="rounded-[24px] border border-[#344453]/10 bg-white p-4 shadow-sm sm:p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.24em] text-[#344453]/45" style={{ fontFamily: "var(--font-mono)" }}>{stat.label}</p>
                    <p className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-[#141F28]" style={{ fontFamily: "var(--font-mono)" }}>{stat.value}</p>
                    <p className="mt-2 text-sm text-[#344453]/50">{stat.detail}</p>
                  </div>
                  <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${stat.tone}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                </div>
              </div>
            );
          })}
        </section>

        {queuedCalls.length > 0 && (
          <section className="rounded-[28px] border border-[#E6A817]/25 bg-white shadow-sm">
            <div className="flex items-center gap-3 border-b border-[#E6A817]/15 px-4 py-5 sm:px-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#E6A817]/15 text-[#E6A817]">
                <PhoneForwarded className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-semibold tracking-[-0.03em] text-[#141F28]" style={{ fontFamily: "var(--font-title)" }}>
                  En attente de transfert
                </h2>
                <p className="mt-1 text-sm text-[#344453]/55">{queuedCalls.length} appel{queuedCalls.length > 1 ? 's' : ''} en file — transférez-les vers le bon agent.</p>
              </div>
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#E6A817] text-xs font-bold text-white">
                {queuedCalls.length}
              </span>
            </div>

            <div className="space-y-3 px-4 py-4 sm:px-6 sm:py-5">
              {queuedCalls.map((call) => (
                <div key={call.id} className="rounded-[22px] border border-[#E6A817]/20 bg-[#E6A817]/5 p-4 sm:p-5">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#E6A817]/20 text-[#E6A817]">
                        <Phone className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-[#141F28]">
                          {call.caller_number || 'Numéro inconnu'}
                        </p>
                        <p className="mt-0.5 text-xs text-[#344453]/45" style={{ fontFamily: "var(--font-mono)" }}>
                          {call.queued_at ? `En attente depuis ${formatElapsed(call.queued_at)}` : ''}
                        </p>
                        {call.queue_reason && (
                          <p className="mt-2 text-sm italic text-[#344453]/60">
                            « {call.queue_reason} »
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 sm:items-end">
                      <button
                        onClick={() => handleAbandon(call.id)}
                        disabled={abandoning[call.id]}
                        title="Mettre fin à l'attente"
                        className="self-start rounded-full border border-[#D94052]/20 bg-[#D94052]/8 px-3 py-1 text-xs font-medium text-[#D94052] transition hover:bg-[#D94052]/15 disabled:opacity-40 sm:self-end"
                      >
                        {abandoning[call.id] ? <Loader2 className="inline h-3 w-3 animate-spin" /> : <X className="inline h-3 w-3" />}
                        {' '}Terminer l'attente
                      </button>
                      {staffList.length > 0 ? (
                        <>
                          <select
                            value={selectedStaff[call.id] || ''}
                            onChange={(e) => setSelectedStaff((p) => ({ ...p, [call.id]: e.target.value }))}
                            className="w-full rounded-xl border border-[#344453]/15 bg-white px-3 py-2 text-sm text-[#141F28] outline-none focus:border-[#344453]/30 sm:w-56"
                          >
                            <option value="">— Choisir un agent —</option>
                            {staffList.map((s) => (
                              <option key={s.id} value={s.phone_number}>
                                {s.first_name} {s.last_name} {s.role ? `(${s.role})` : ''}
                              </option>
                            ))}
                          </select>
                          <button
                            onClick={() => handleTransfer(call.id)}
                            disabled={!selectedStaff[call.id] || transferring[call.id]}
                            className="inline-flex items-center gap-2 rounded-full bg-[#344453] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#2a3642] disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            {transferring[call.id] ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <UserCheck className="h-4 w-4" />
                            )}
                            Transférer
                          </button>
                          {transferResult[call.id] && (
                            <p className={`text-xs font-medium ${transferResult[call.id].includes('✓') ? 'text-[#2D9D78]' : 'text-[#D94052]'}`}>
                              {transferResult[call.id]}
                            </p>
                          )}
                        </>
                      ) : (
                        <p className="text-xs text-[#344453]/50">Aucun agent disponible — ajoutez du staff dans l'onglet Équipe.</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="rounded-[28px] border border-[#344453]/10 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-[#344453]/8 px-4 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div>
              <h2 className="text-xl font-semibold tracking-[-0.03em] text-[#141F28]" style={{ fontFamily: "var(--font-title)" }}>Appels récents</h2>
              <p className="mt-1 text-sm text-[#344453]/55">Les derniers échanges captés par Receptio.</p>
            </div>

            <Link
              to="/calls"
              className="inline-flex items-center gap-2 self-start rounded-full border border-[#344453]/15 bg-[#344453]/5 px-4 py-2 text-sm font-medium text-[#344453] transition hover:bg-[#344453]/10"
            >
              Tout afficher
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="px-4 py-4 sm:px-6 sm:py-6">
            {recentCalls.length === 0 ? (
              <div className="rounded-[22px] border border-dashed border-[#344453]/15 bg-[#344453]/4 px-6 py-10 text-center">
                <p className="text-base font-medium text-[#141F28]">Aucun appel pour le moment</p>
                <p className="mt-2 text-sm text-[#344453]/55">Dès qu'un appel arrive, il apparaîtra ici avec son statut et sa synthèse.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentCalls.map((call) => (
                  <Link
                    key={call.id}
                    to={`/calls/${call.id}`}
                    className="block rounded-[24px] border border-[#344453]/8 bg-[#F8F9FB] p-4 transition duration-300 hover:-translate-y-0.5 hover:bg-white hover:shadow-[0_16px_36px_rgba(52,68,83,0.10)] sm:p-5"
                  >
                    <div className="flex flex-col gap-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="flex min-w-0 items-start gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#344453] text-white">
                            <Phone className="h-4 w-4" />
                          </div>

                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-[#141F28] sm:text-base">
                              {call.caller_number || 'Numéro inconnu'}
                            </p>
                            <div className="mt-1 flex items-center gap-2 text-xs text-[#344453]/45 sm:text-sm">
                              <CalendarClock className="h-4 w-4" />
                              <span style={{ fontFamily: "var(--font-mono)" }}>{new Date(call.created_at).toLocaleString('fr-BE')}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          {call.transcription_text && (
                            <span className="inline-flex items-center rounded-full bg-[#2D9D78]/12 px-3 py-1 text-xs font-medium text-[#2D9D78]">
                              Transcrit
                            </span>
                          )}
                          <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${getStatusDisplay(call.status).color}`}>
                            {getStatusDisplay(call.status).label}
                          </span>
                        </div>
                      </div>

                      {call.transcription_text && (
                        <p className="text-sm leading-7 text-[#344453]/60 line-clamp-2">
                          {call.transcription_text}
                        </p>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </Layout>
  );
}
