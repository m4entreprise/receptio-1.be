import { useEffect, useState } from 'react';
import { getStatusDisplay } from '../utils/callStatus';
import { Link } from 'react-router-dom';
import { Phone, PhoneIncoming, PhoneOutgoing, Search, Filter, ArrowRight, CalendarClock, Sparkles, X } from 'lucide-react';
import axios from 'axios';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import Layout from '../components/Layout';
import CallQADetail from '../components/qa/CallQADetail';

interface CallItem {
  id: string;
  caller_number?: string | null;
  transcription_text?: string | null;
  summary?: string | null;
  created_at: string;
  duration?: number;
  status: string;
  direction?: string | null;
}

export default function Calls() {
  const [calls, setCalls] = useState<CallItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedCallId, setSelectedCallId] = useState<string | null>(null);

  useEffect(() => {
    fetchCalls();

    const intervalId = window.setInterval(() => {
      fetchCalls(false);
    }, 10000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [statusFilter]);

  const fetchCalls = async (showLoader: boolean = true) => {
    if (showLoader) {
      setLoading(true);
    }

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
      if (showLoader) {
        setLoading(false);
      }
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
            <div className="h-12 w-12 animate-spin rounded-full border-2 border-[#344453]/10 border-t-[#344453]" />
            <p className="text-sm font-medium text-[#344453]/50">Chargement des appels…</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-5 sm:space-y-6">
        <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="overflow-hidden rounded-[28px] border border-[#344453]/15 bg-[#141F28] p-5 text-white shadow-[0_24px_60px_rgba(20,31,40,0.18)] sm:p-7">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-white/50" style={{ fontFamily: "var(--font-mono)" }}>
              <Sparkles className="h-3.5 w-3.5" />
              Registre d'appels
            </div>

            <div className="mt-5 space-y-3">
              <h1 className="text-3xl font-semibold tracking-[-0.03em] text-white sm:text-4xl" style={{ fontFamily: "var(--font-title)" }}>
                Tous vos appels, dans un flux clair et filtrable.
              </h1>
              <p className="max-w-2xl text-sm leading-7 text-white/60 sm:text-base">
                Parcourez rapidement l’historique, retrouvez une transcription ou repérez les appels à reprendre depuis une interface compacte, lisible et tactile.
              </p>
            </div>
          </div>

          <div className="rounded-[28px] border border-[#344453]/10 bg-white p-5 shadow-sm sm:p-6">
            <p className="text-[11px] uppercase tracking-[0.24em] text-[#344453]/45" style={{ fontFamily: "var(--font-mono)" }}>État du flux</p>
            <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-2xl bg-[#344453]/6 px-4 py-3">
                <p className="text-[#344453]/50">Total</p>
                <p className="mt-1 text-2xl font-semibold tracking-[-0.04em] text-[#141F28]" style={{ fontFamily: "var(--font-mono)" }}>{calls.length}</p>
              </div>
              <div className="rounded-2xl bg-[#344453]/6 px-4 py-3">
                <p className="text-[#344453]/50">Affichés</p>
                <p className="mt-1 text-2xl font-semibold tracking-[-0.04em] text-[#141F28]" style={{ fontFamily: "var(--font-mono)" }}>{filteredCalls.length}</p>
              </div>
              <div className="rounded-2xl bg-[#344453]/6 px-4 py-3">
                <p className="text-[#344453]/50">Répondu</p>
                <p className="mt-1 text-lg font-semibold text-[#141F28]" style={{ fontFamily: "var(--font-mono)" }}>{answeredCount}</p>
              </div>
              <div className="rounded-2xl bg-[#344453]/6 px-4 py-3">
                <p className="text-[#344453]/50">À traiter</p>
                <p className="mt-1 text-lg font-semibold text-[#141F28]" style={{ fontFamily: "var(--font-mono)" }}>{receivedCount}</p>
              </div>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-[24px] border border-[#344453]/10 bg-white p-4 shadow-sm sm:p-5">
            <p className="text-[11px] uppercase tracking-[0.24em] text-[#344453]/45" style={{ fontFamily: "var(--font-mono)" }}>Terminés</p>
            <p className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-[#141F28]" style={{ fontFamily: "var(--font-mono)" }}>{completedCount}</p>
            <p className="mt-2 text-sm text-[#344453]/50">déjà clôturés et archivés</p>
          </div>
          <div className="rounded-[24px] border border-[#344453]/10 bg-white p-4 shadow-sm sm:p-5">
            <p className="text-[11px] uppercase tracking-[0.24em] text-[#344453]/45" style={{ fontFamily: "var(--font-mono)" }}>Répondus</p>
            <p className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-[#141F28]" style={{ fontFamily: "var(--font-mono)" }}>{answeredCount}</p>
            <p className="mt-2 text-sm text-[#344453]/50">pris en charge sans clôture finale</p>
          </div>
          <div className="rounded-[24px] border border-[#344453]/10 bg-white p-4 shadow-sm sm:p-5">
            <p className="text-[11px] uppercase tracking-[0.24em] text-[#344453]/45" style={{ fontFamily: "var(--font-mono)" }}>Reçus</p>
            <p className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-[#141F28]" style={{ fontFamily: "var(--font-mono)" }}>{receivedCount}</p>
            <p className="mt-2 text-sm text-[#344453]/50">encore en attente de reprise</p>
          </div>
        </section>

        <section className="rounded-[28px] border border-[#344453]/10 bg-white shadow-sm">
          <div className="border-b border-[#344453]/8 px-4 py-5 sm:px-6">
            <div className="flex flex-col gap-4">
              <div>
                <h2 className="text-xl font-semibold tracking-[-0.03em] text-[#141F28]" style={{ fontFamily: "var(--font-title)" }}>Rechercher et filtrer</h2>
                <p className="mt-1 text-sm text-[#344453]/55">Affinez la vue par numéro, transcription ou statut.</p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <div className="relative flex-1">
                  <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#344453]/35" />
                  <input
                    type="text"
                    placeholder="Rechercher par numéro, transcription ou résumé..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full rounded-2xl border border-[#344453]/12 bg-[#F8F9FB] py-3 pl-11 pr-4 text-sm text-[#141F28] outline-none transition placeholder:text-[#344453]/30 focus:border-[#344453]/25 focus:bg-white"
                  />
                </div>

                <div className="flex items-center gap-2 rounded-2xl border border-[#344453]/12 bg-[#F8F9FB] px-4 py-3 text-sm text-[#344453]/60">
                  <Filter className="h-4 w-4 shrink-0" />
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="w-full bg-transparent text-sm text-[#141F28] outline-none"
                  >
                    <option value="all">Tous les statuts</option>
                    <option value="received">Reçus</option>
                    <option value="answered">En cours</option>
                    <option value="queued">En attente</option>
                    <option value="transferred">Transférés</option>
                    <option value="completed">Terminés</option>
                    <option value="missed">Manqués</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          <div className="px-4 py-4 sm:px-6 sm:py-6">
            {filteredCalls.length === 0 ? (
              <div className="rounded-[22px] border border-dashed border-[#344453]/15 bg-[#344453]/4 px-6 py-10 text-center">
                <Phone className="mx-auto mb-4 h-12 w-12 text-[#344453]/25" />
                <p className="text-base font-medium text-[#141F28]">Aucun appel trouvé</p>
                <p className="mt-2 text-sm text-[#344453]/55">Ajustez votre recherche ou votre filtre pour afficher d'autres résultats.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredCalls.map((call) => (
                  <div
                    key={call.id}
                    onClick={() => setSelectedCallId(call.id)}
                    className="cursor-pointer rounded-[24px] border border-[#344453]/8 bg-[#F8F9FB] p-4 transition duration-300 hover:-translate-y-0.5 hover:bg-white hover:shadow-[0_16px_36px_rgba(52,68,83,0.10)] sm:p-5"
                  >
                    <div className="flex flex-col gap-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="flex min-w-0 items-start gap-3">
                          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-white ${call.direction === 'outbound' ? 'bg-[#C7601D]' : 'bg-[#344453]'}`}>
                            {call.direction === 'outbound'
                              ? <PhoneOutgoing className="h-4 w-4" />
                              : <PhoneIncoming className="h-4 w-4" />
                            }
                          </div>

                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="truncate text-sm font-semibold text-[#141F28] sm:text-base">
                                {call.caller_number || 'Numéro inconnu'}
                              </p>
                              <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${call.direction === 'outbound' ? 'bg-[#C7601D]/10 text-[#C7601D]' : 'bg-[#344453]/8 text-[#344453]/70'}`}>
                                {call.direction === 'outbound' ? <PhoneOutgoing className="h-3 w-3" /> : <PhoneIncoming className="h-3 w-3" />}
                                {call.direction === 'outbound' ? 'Sortant' : 'Entrant'}
                              </span>
                              {call.transcription_text && (
                                <span className="inline-flex items-center rounded-full bg-[#2D9D78]/12 px-3 py-1 text-xs font-medium text-[#2D9D78]">
                                  Transcrit
                                </span>
                              )}
                              {call.summary && (
                                <span className="inline-flex items-center rounded-full bg-[#344453]/10 px-3 py-1 text-xs font-medium text-[#344453]">
                                  Résumé IA
                                </span>
                              )}
                            </div>

                            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[#344453]/45 sm:text-sm">
                              <CalendarClock className="h-4 w-4" />
                              <span style={{ fontFamily: "var(--font-mono)" }}>{format(new Date(call.created_at), 'PPpp', { locale: fr })}</span>
                              {call.duration ? <span style={{ fontFamily: "var(--font-mono)" }}>• {call.duration}s</span> : null}
                            </div>
                          </div>
                        </div>

                        <span className={`inline-flex w-fit items-center rounded-full px-3 py-1 text-xs font-medium ${
                          getStatusDisplay(call.status).color
                        }`}>
                          {getStatusDisplay(call.status).label}
                        </span>
                      </div>

                      {call.transcription_text && (
                        <p className="text-sm leading-7 text-[#344453]/60 line-clamp-2">
                          {call.transcription_text}
                        </p>
                      )}

                      {call.summary && (
                        <p className="text-sm italic leading-7 text-[#344453]/50 line-clamp-2">
                          {call.summary}
                        </p>
                      )}

                      <div className="flex items-center justify-between gap-3">
                        <div className="inline-flex items-center gap-2 text-sm font-medium text-[#344453]">
                          Ouvrir le débrief QA
                          <ArrowRight className="h-4 w-4" />
                        </div>
                        <Link
                          to={`/calls/${call.id}`}
                          onClick={(event) => event.stopPropagation()}
                          className="text-sm font-medium text-[#C7601D] hover:underline"
                        >
                          Voir la fiche complète
                        </Link>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {selectedCallId && (
          <div className="fixed inset-0 z-50 bg-[#141F28]/25 backdrop-blur-[2px]" onClick={() => setSelectedCallId(null)}>
            <div className="absolute inset-y-0 right-0 h-full w-full max-w-2xl overflow-y-auto border-l border-[#344453]/10 bg-[#F8F9FB] shadow-2xl" onClick={(event) => event.stopPropagation()}>
              <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#344453]/10 bg-[#F8F9FB]/95 px-5 py-4 backdrop-blur-xl sm:px-6">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.24em] text-[#344453]/45" style={{ fontFamily: 'var(--font-mono)' }}>Qualité IA</p>
                  <h2 className="mt-1 text-lg font-semibold text-[#141F28]" style={{ fontFamily: 'var(--font-title)' }}>Débriefing d'appel</h2>
                </div>
                <button onClick={() => setSelectedCallId(null)} className="rounded-full p-2 text-[#344453]/50 hover:bg-[#344453]/8 hover:text-[#344453] transition">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="p-5 sm:p-6">
                <CallQADetail callId={selectedCallId} emptyActionHref={`/calls/${selectedCallId}`} />
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
