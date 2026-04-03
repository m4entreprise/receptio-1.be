import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Phone, Clock, CheckCircle, AlertCircle, ArrowRight, CalendarClock, Sparkles } from 'lucide-react';
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

export default function Dashboard() {
  const [stats, setStats] = useState<Stats>({ total: 0, today: 0, answered: 0, pending: 0 });
  const [recentCalls, setRecentCalls] = useState<RecentCall[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const [callsRes] = await Promise.all([
        axios.get('/api/calls?limit=5'),
      ]);

      const calls: RecentCall[] = callsRes.data.calls || [];
      setRecentCalls(calls);

      const today = new Date().toDateString();
      const todayCalls = calls.filter((c) => 
        new Date(c.created_at).toDateString() === today
      );

      setStats({
        total: callsRes.data.total || 0,
        today: todayCalls.length,
        answered: calls.filter((c) => c.status === 'completed').length,
        pending: calls.filter((c) => c.status === 'received').length,
      });
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    {
      label: 'Total appels',
      value: stats.total,
      icon: Phone,
      tone: 'bg-[#111118] text-white',
      detail: 'volume cumulé',
    },
    {
      label: 'Aujourd\'hui',
      value: stats.today,
      icon: Clock,
      tone: 'bg-emerald-100 text-emerald-700',
      detail: 'activité du jour',
    },
    {
      label: 'Traités',
      value: stats.answered,
      icon: CheckCircle,
      tone: 'bg-violet-100 text-violet-700',
      detail: 'clôturés proprement',
    },
    {
      label: 'En attente',
      value: stats.pending,
      icon: AlertCircle,
      tone: 'bg-amber-100 text-amber-700',
      detail: 'à reprendre',
    },
  ];

  const completionRate = stats.total === 0 ? 0 : Math.round((stats.answered / stats.total) * 100);

  if (loading) {
    return (
      <Layout>
        <div className="flex h-[50vh] items-center justify-center">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="h-12 w-12 animate-spin rounded-full border-2 border-black/10 border-t-[#111118]" />
            <p className="text-sm font-medium text-[#6f685d]">Préparation du tableau de bord…</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-5 sm:space-y-6">
        <section className="grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
          <div className="overflow-hidden rounded-[28px] border border-black/5 bg-[#111118] p-5 text-white shadow-[0_24px_60px_rgba(17,17,24,0.18)] sm:p-7">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-stone-300">
              <Sparkles className="h-3.5 w-3.5" />
              Vue d'ensemble
            </div>

            <div className="mt-5 space-y-3">
              <h1 className="text-3xl font-semibold tracking-[-0.04em] text-[#f7f2e8] sm:text-4xl">
                Votre activité reste lisible, même sur mobile.
              </h1>
              <p className="max-w-2xl text-sm leading-7 text-stone-300 sm:text-base">
                Retrouvez l’essentiel des appels entrants, leur statut et les derniers échanges dans une interface compacte, claire et pensée d’abord pour petit écran.
              </p>
            </div>
          </div>

          <div className="rounded-[28px] border border-black/5 bg-white/80 p-5 shadow-sm sm:p-6">
            <p className="text-[11px] uppercase tracking-[0.24em] text-[#8b8478]">Rythme du jour</p>
            <div className="mt-5 space-y-5">
              <div>
                <p className="text-4xl font-semibold tracking-[-0.05em] text-[#171821]">{completionRate}%</p>
                <p className="mt-2 text-sm leading-6 text-[#625d55]">des appels affichés sont déjà traités ou clôturés.</p>
              </div>

              <div className="h-2 overflow-hidden rounded-full bg-[#ece6dc]">
                <div className="h-full rounded-full bg-[#111118]" style={{ width: `${completionRate}%` }} />
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-2xl bg-[#f4f1ea] px-4 py-3">
                  <p className="text-[#8b8478]">Aujourd'hui</p>
                  <p className="mt-1 text-lg font-semibold text-[#171821]">{stats.today}</p>
                </div>
                <div className="rounded-2xl bg-[#f4f1ea] px-4 py-3">
                  <p className="text-[#8b8478]">En attente</p>
                  <p className="mt-1 text-lg font-semibold text-[#171821]">{stats.pending}</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {statCards.map((stat) => {
            const Icon = stat.icon;

            return (
              <div key={stat.label} className="rounded-[24px] border border-black/5 bg-white/80 p-4 shadow-sm sm:p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.24em] text-[#8b8478]">{stat.label}</p>
                    <p className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-[#171821]">{stat.value}</p>
                    <p className="mt-2 text-sm text-[#6f685d]">{stat.detail}</p>
                  </div>
                  <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${stat.tone}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                </div>
              </div>
            );
          })}
        </section>

        <section className="rounded-[28px] border border-black/5 bg-white/80 shadow-sm">
          <div className="flex flex-col gap-3 border-b border-black/5 px-4 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div>
              <h2 className="text-xl font-semibold tracking-[-0.03em] text-[#171821]">Appels récents</h2>
              <p className="mt-1 text-sm text-[#6f685d]">Les derniers échanges captés par Receptio.</p>
            </div>

            <Link
              to="/calls"
              className="inline-flex items-center gap-2 self-start rounded-full border border-black/10 bg-[#f7f4ee] px-4 py-2 text-sm font-medium text-[#171821] transition hover:bg-white"
            >
              Tout afficher
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="px-4 py-4 sm:px-6 sm:py-6">
            {recentCalls.length === 0 ? (
              <div className="rounded-[22px] border border-dashed border-black/10 bg-[#f7f4ee] px-6 py-10 text-center">
                <p className="text-base font-medium text-[#171821]">Aucun appel pour le moment</p>
                <p className="mt-2 text-sm text-[#6f685d]">Dès qu’un appel arrive, il apparaîtra ici avec son statut et sa synthèse.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentCalls.map((call) => (
                  <Link
                    key={call.id}
                    to={`/calls/${call.id}`}
                    className="block rounded-[24px] border border-black/8 bg-[#fcfbf8] p-4 transition duration-300 hover:-translate-y-0.5 hover:bg-white hover:shadow-[0_16px_36px_rgba(17,17,24,0.08)] sm:p-5"
                  >
                    <div className="flex flex-col gap-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="flex min-w-0 items-start gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#111118] text-white">
                            <Phone className="h-4 w-4" />
                          </div>

                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-[#171821] sm:text-base">
                              {call.caller_number || 'Numéro inconnu'}
                            </p>
                            <div className="mt-1 flex items-center gap-2 text-xs text-[#7a7267] sm:text-sm">
                              <CalendarClock className="h-4 w-4" />
                              <span>{new Date(call.created_at).toLocaleString('fr-BE')}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          {call.transcription_text && (
                            <span className="inline-flex items-center rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700">
                              Transcrit
                            </span>
                          )}
                          <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${
                            call.status === 'completed' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'
                          }`}>
                            {call.status === 'completed' ? 'Terminé' : 'En cours'}
                          </span>
                        </div>
                      </div>

                      {call.transcription_text && (
                        <p className="text-sm leading-7 text-[#5f5a52] line-clamp-2">
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
