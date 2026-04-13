import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ClipboardCheck } from 'lucide-react';
import axios from 'axios';
import Layout from '../components/Layout';
import CallQADetail from '../components/qa/CallQADetail';

interface CallHeader {
  id: string;
  caller_number?: string | null;
  created_at: string;
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default function CallQAReport() {
  const { id } = useParams();
  const isValidCallId = !!id && uuidPattern.test(id);
  const [call, setCall] = useState<CallHeader | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id || !isValidCallId) {
      setCall(null);
      setLoading(false);
      return;
    }

    axios.get(`/api/calls/${id}`)
      .then((res) => {
        setCall(res.data.call as CallHeader);
      })
      .catch(() => {
        setCall(null);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [id, isValidCallId]);

  if (loading) {
    return (
      <Layout>
        <div className="flex h-[50vh] items-center justify-center">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="h-12 w-12 animate-spin rounded-full border-2 border-[#344453]/10 border-t-[#344453]" />
            <p className="text-sm font-medium text-[#344453]/50">Chargement du rapport QA…</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (!id || !isValidCallId || !call) {
    return (
      <Layout>
        <div className="space-y-5">
          <div className="rounded-[28px] border border-dashed border-[#344453]/15 bg-[#344453]/4 px-6 py-12 text-center">
            <p className="text-lg font-semibold text-[#141F28]">Rapport QA introuvable</p>
            <p className="mt-2 text-sm text-[#344453]/55">Cet appel n'existe pas ou n'est plus accessible.</p>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
              <Link to="/calls" className="inline-flex items-center rounded-full border border-[#344453]/15 bg-white px-4 py-2 text-sm font-medium text-[#344453] hover:bg-[#344453]/5 transition">
                Retour aux appels
              </Link>
              <Link to="/analytics" className="inline-flex items-center rounded-full bg-[#344453] px-4 py-2 text-sm font-medium text-white hover:bg-[#2a3844] transition">
                Voir Analytics
              </Link>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <section className="overflow-hidden rounded-[28px] border border-[#344453]/15 bg-[#141F28] p-5 text-white shadow-[0_24px_60px_rgba(20,31,40,0.18)] sm:p-7">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <Link
                to={`/calls/${id}`}
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/70 transition hover:bg-white/10"
              >
                <ArrowLeft className="h-4 w-4" />
                Retour à la fiche d'appel
              </Link>

              <div className="mt-8 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-white/50" style={{ fontFamily: 'var(--font-mono)' }}>
                <ClipboardCheck className="h-3.5 w-3.5" />
                Qualité IA
              </div>

              <div className="mt-5 space-y-3">
                <h1 className="text-3xl font-semibold tracking-[-0.03em] text-white sm:text-4xl" style={{ fontFamily: 'var(--font-title)' }}>
                  Rapport QA de l'appel
                </h1>
                <p className="max-w-2xl text-sm leading-7 text-white/60 sm:text-base">
                  Consultez le débrief complet, les flags détectés et les axes de coaching dans une page dédiée, sans panneau latéral.
                </p>
              </div>
            </div>

            <div className="rounded-[24px] border border-white/10 bg-white/5 px-5 py-4 text-right">
              <p className="text-[11px] uppercase tracking-[0.24em] text-white/45" style={{ fontFamily: 'var(--font-mono)' }}>Appel</p>
              <p className="mt-2 text-lg font-semibold text-white">{call.caller_number || 'Numéro inconnu'}</p>
              <p className="mt-1 text-sm text-white/50">
                {new Date(call.created_at).toLocaleString('fr-BE', { dateStyle: 'short', timeStyle: 'short' })}
              </p>
            </div>
          </div>
        </section>

        <div className="flex flex-wrap items-center justify-end gap-3">
          <Link
            to="/analytics"
            className="inline-flex items-center rounded-full border border-[#344453]/15 bg-white px-4 py-2 text-sm font-medium text-[#344453] hover:bg-[#344453]/5 transition"
          >
            Ouvrir Analytics
          </Link>
          <Link
            to={`/calls/${id}`}
            className="inline-flex items-center rounded-full bg-[#344453] px-4 py-2 text-sm font-medium text-white hover:bg-[#2a3844] transition"
          >
            Voir la fiche complète
          </Link>
        </div>

        <CallQADetail callId={id} emptyActionHref={`/calls/${id}`} />
      </div>
    </Layout>
  );
}
