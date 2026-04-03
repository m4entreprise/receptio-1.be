import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Phone, Search, Filter, ArrowRight, CalendarClock, Sparkles } from 'lucide-react';
import axios from 'axios';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import Layout from '../components/Layout';

interface CallItem {
  id: string;
  caller_number?: string | null;
  transcription_text?: string | null;
  summary?: string | null;
  created_at: string;
  duration?: number;
  status: string;
}

export default function Calls() {
  const [calls, setCalls] = useState<CallItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    fetchCalls();
  }, [statusFilter]);

  const fetchCalls = async () => {
    try {
      const params: Record<string, string | number> = { limit: 100 };
      if (statusFilter !== 'all') {
        params.status = statusFilter;
      }
      const response = await axios.get('/api/calls', { params });
      setCalls(response.data.calls || []);
    } catch (error) {
      console.error('Error fetching calls:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredCalls = calls.filter((call) => {
    if (!searchTerm.trim()) {
      return true;
    }

    const query = searchTerm.toLowerCase();
    const matchesSearch =
      call.caller_number?.toLowerCase().includes(query) ||
      call.transcription_text?.toLowerCase().includes(query) ||
      call.summary?.toLowerCase().includes(query);

    return matchesSearch;
  });

  const completedCount = calls.filter((call) => call.status === 'completed').length;
  const answeredCount = calls.filter((call) => call.status === 'answered').length;
  const receivedCount = calls.filter((call) => call.status === 'received').length;

  if (loading) {
    return (
      <Layout>
        <div className="flex h-[50vh] items-center justify-center">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="h-12 w-12 animate-spin rounded-full border-2 border-black/10 border-t-[#111118]" />
            <p className="text-sm font-medium text-[#6f685d]">Chargement des appels…</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-5 sm:space-y-6">
        <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="overflow-hidden rounded-[28px] border border-black/5 bg-[#111118] p-5 text-white shadow-[0_24px_60px_rgba(17,17,24,0.18)] sm:p-7">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-stone-300">
              <Sparkles className="h-3.5 w-3.5" />
              Registre d'appels
            </div>

            <div className="mt-5 space-y-3">
              <h1 className="text-3xl font-semibold tracking-[-0.04em] text-[#f7f2e8] sm:text-4xl">
                Tous vos appels, dans un flux clair et filtrable.
              </h1>
              <p className="max-w-2xl text-sm leading-7 text-stone-300 sm:text-base">
                Parcourez rapidement l’historique, retrouvez une transcription ou repérez les appels à reprendre depuis une interface compacte, lisible et tactile.
              </p>
            </div>
          </div>

          <div className="rounded-[28px] border border-black/5 bg-white/80 p-5 shadow-sm sm:p-6">
            <p className="text-[11px] uppercase tracking-[0.24em] text-[#8b8478]">État du flux</p>
            <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-2xl bg-[#f4f1ea] px-4 py-3">
                <p className="text-[#8b8478]">Total</p>
                <p className="mt-1 text-2xl font-semibold tracking-[-0.04em] text-[#171821]">{calls.length}</p>
              </div>
              <div className="rounded-2xl bg-[#f4f1ea] px-4 py-3">
                <p className="text-[#8b8478]">Affichés</p>
                <p className="mt-1 text-2xl font-semibold tracking-[-0.04em] text-[#171821]">{filteredCalls.length}</p>
              </div>
              <div className="rounded-2xl bg-[#f4f1ea] px-4 py-3">
                <p className="text-[#8b8478]">Répondu</p>
                <p className="mt-1 text-lg font-semibold text-[#171821]">{answeredCount}</p>
              </div>
              <div className="rounded-2xl bg-[#f4f1ea] px-4 py-3">
                <p className="text-[#8b8478]">À traiter</p>
                <p className="mt-1 text-lg font-semibold text-[#171821]">{receivedCount}</p>
              </div>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-[24px] border border-black/5 bg-white/80 p-4 shadow-sm sm:p-5">
            <p className="text-[11px] uppercase tracking-[0.24em] text-[#8b8478]">Terminés</p>
            <p className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-[#171821]">{completedCount}</p>
            <p className="mt-2 text-sm text-[#6f685d]">déjà clôturés et archivés</p>
          </div>
          <div className="rounded-[24px] border border-black/5 bg-white/80 p-4 shadow-sm sm:p-5">
            <p className="text-[11px] uppercase tracking-[0.24em] text-[#8b8478]">Répondus</p>
            <p className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-[#171821]">{answeredCount}</p>
            <p className="mt-2 text-sm text-[#6f685d]">pris en charge sans clôture finale</p>
          </div>
          <div className="rounded-[24px] border border-black/5 bg-white/80 p-4 shadow-sm sm:p-5">
            <p className="text-[11px] uppercase tracking-[0.24em] text-[#8b8478]">Reçus</p>
            <p className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-[#171821]">{receivedCount}</p>
            <p className="mt-2 text-sm text-[#6f685d]">encore en attente de reprise</p>
          </div>
        </section>

        <section className="rounded-[28px] border border-black/5 bg-white/80 shadow-sm">
          <div className="border-b border-black/5 px-4 py-5 sm:px-6">
            <div className="flex flex-col gap-4">
              <div>
                <h2 className="text-xl font-semibold tracking-[-0.03em] text-[#171821]">Rechercher et filtrer</h2>
                <p className="mt-1 text-sm text-[#6f685d]">Affinez la vue par numéro, transcription ou statut.</p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <div className="relative flex-1">
                  <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8b8478]" />
                  <input
                    type="text"
                    placeholder="Rechercher par numéro, transcription ou résumé..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full rounded-2xl border border-black/10 bg-[#fcfbf8] py-3 pl-11 pr-4 text-sm text-[#171821] outline-none transition placeholder:text-[#9b9387] focus:border-black/20 focus:bg-white"
                  />
                </div>

                <div className="flex items-center gap-2 rounded-2xl border border-black/10 bg-[#fcfbf8] px-4 py-3 text-sm text-[#625d55]">
                  <Filter className="h-4 w-4 shrink-0" />
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="w-full bg-transparent text-sm text-[#171821] outline-none"
                  >
                    <option value="all">Tous les statuts</option>
                    <option value="received">Reçus</option>
                    <option value="completed">Terminés</option>
                    <option value="answered">Répondus</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          <div className="px-4 py-4 sm:px-6 sm:py-6">
            {filteredCalls.length === 0 ? (
              <div className="rounded-[22px] border border-dashed border-black/10 bg-[#f7f4ee] px-6 py-10 text-center">
                <Phone className="mx-auto mb-4 h-12 w-12 text-[#b1aa9f]" />
                <p className="text-base font-medium text-[#171821]">Aucun appel trouvé</p>
                <p className="mt-2 text-sm text-[#6f685d]">Ajustez votre recherche ou votre filtre pour afficher d’autres résultats.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredCalls.map((call) => (
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
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="truncate text-sm font-semibold text-[#171821] sm:text-base">
                                {call.caller_number || 'Numéro inconnu'}
                              </p>
                              {call.transcription_text && (
                                <span className="inline-flex items-center rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700">
                                  Transcrit
                                </span>
                              )}
                              {call.summary && (
                                <span className="inline-flex items-center rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700">
                                  Résumé IA
                                </span>
                              )}
                            </div>

                            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[#7a7267] sm:text-sm">
                              <CalendarClock className="h-4 w-4" />
                              <span>{format(new Date(call.created_at), 'PPpp', { locale: fr })}</span>
                              {call.duration ? <span>• {call.duration}s</span> : null}
                            </div>
                          </div>
                        </div>

                        <span className={`inline-flex w-fit items-center rounded-full px-3 py-1 text-xs font-medium ${
                          call.status === 'completed'
                            ? 'bg-blue-100 text-blue-700'
                            : call.status === 'answered'
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-amber-100 text-amber-700'
                        }`}>
                          {call.status === 'completed' ? 'Terminé' : call.status === 'answered' ? 'Répondu' : 'Reçu'}
                        </span>
                      </div>

                      {call.transcription_text && (
                        <p className="text-sm leading-7 text-[#5f5a52] line-clamp-2">
                          {call.transcription_text}
                        </p>
                      )}

                      {call.summary && (
                        <p className="text-sm italic leading-7 text-[#7a7267] line-clamp-2">
                          {call.summary}
                        </p>
                      )}

                      <div className="inline-flex items-center gap-2 text-sm font-medium text-[#171821]">
                        Ouvrir le détail
                        <ArrowRight className="h-4 w-4" />
                      </div>
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
