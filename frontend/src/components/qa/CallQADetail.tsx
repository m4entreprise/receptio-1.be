import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import ScoreBreakdown from './ScoreBreakdown';
import FlagBadge from './FlagBadge';
import CoachingTip from './CoachingTip';

interface DetailResult {
  call_id: string;
  agent: { id: string; name: string } | null;
  template: { id: string; name: string; version: number };
  conversation_mode: 'ai_only' | 'ai_and_human' | 'unknown';
  global_score: number;
  processed_at: string;
  resume: string;
  coaching_tip: string;
  scores: Array<{
    critere_id: string;
    label: string;
    note: number;
    max: number;
    poids: number;
    justification: string;
  }>;
  flags_detail: Array<{
    type: string;
    extrait: string | null;
    position_ms: number | null;
  }>;
}

export default function CallQADetail({ callId, emptyActionHref }: { callId: string; emptyActionHref?: string }) {
  const [data, setData] = useState<DetailResult | null>(null);
  const [loading, setLoading] = useState(true);

  const conversationModeMeta = data?.conversation_mode === 'ai_and_human'
    ? { label: 'IA + agent humain', className: 'bg-[#C7601D]/10 text-[#C7601D]' }
    : data?.conversation_mode === 'ai_only'
      ? { label: 'Réceptionniste IA uniquement', className: 'bg-[#2D9D78]/10 text-[#2D9D78]' }
      : { label: 'Mode indéterminé', className: 'bg-[#344453]/8 text-[#344453]/70' };

  useEffect(() => {
    let active = true;
    setLoading(true);
    axios.get(`/api/qa/results/${callId}`)
      .then((res) => {
        if (!active) return;
        setData(res.data.result || null);
      })
      .catch(() => {
        if (!active) return;
        setData(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [callId]);

  if (loading) {
    return <div className="flex items-center justify-center py-12"><div className="h-8 w-8 animate-spin rounded-full border-4 border-[#344453]/20 border-t-[#344453]" /></div>;
  }

  if (!data) {
    return (
      <div className="rounded-[24px] border border-dashed border-[#344453]/20 bg-white p-8 text-center">
        <p className="text-sm text-[#344453]/50">Aucune analyse disponible pour cet appel.</p>
        {emptyActionHref && (
          <Link to={emptyActionHref} className="mt-4 inline-flex items-center rounded-full bg-[#344453] px-4 py-2 text-sm font-medium text-white hover:bg-[#2a3844] transition">
            Analyser cet appel
          </Link>
        )}
      </div>
    );
  }

  const scoreColor = data.global_score >= 70 ? '#2D9D78' : data.global_score >= 50 ? '#C7601D' : '#D94052';

  return (
    <div className="space-y-5">
      <div className="rounded-[28px] border border-[#344453]/10 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-20 w-20 items-center justify-center rounded-full border-4 text-2xl font-semibold" style={{ borderColor: `${scoreColor}33`, color: scoreColor }}>
              {data.global_score}
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.24em] text-[#344453]/45" style={{ fontFamily: 'var(--font-mono)' }}>Débriefing QA</p>
              <h3 className="mt-2 text-xl font-semibold text-[#141F28]" style={{ fontFamily: 'var(--font-title)' }}>{data.template.name}</h3>
              <p className="mt-1 text-sm text-[#344453]/55">{data.agent?.name || 'Agent inconnu'} · {new Date(data.processed_at).toLocaleString('fr-BE')}</p>
              <div className="mt-3">
                <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${conversationModeMeta.className}`}>
                  {conversationModeMeta.label}
                </span>
              </div>
            </div>
          </div>
          <div className="rounded-2xl bg-[#344453]/6 px-4 py-3 text-sm text-[#344453]/60">v{data.template.version}</div>
        </div>
      </div>

      {data.resume && (
        <div className="rounded-[24px] border border-[#344453]/10 bg-white px-5 py-4 italic leading-7 text-[#344453]/70 shadow-sm">
          {data.resume}
        </div>
      )}

      <ScoreBreakdown scores={data.scores} />

      <div className="rounded-[28px] border border-[#344453]/10 bg-white p-5 shadow-sm sm:p-6">
        <p className="text-[11px] uppercase tracking-[0.24em] text-[#344453]/45" style={{ fontFamily: 'var(--font-mono)' }}>Flags détectés</p>
        <div className="mt-4 space-y-4">
          {data.flags_detail.length === 0 ? (
            <p className="text-sm text-[#344453]/50">Aucun flag remonté par l'analyse.</p>
          ) : data.flags_detail.map((flag, index) => (
            <div key={`${flag.type}-${index}`} className="rounded-[20px] border border-[#344453]/10 bg-[#F8F9FB] p-4">
              <FlagBadge type={flag.type} extrait={flag.extrait} />
              {flag.extrait && <blockquote className="mt-3 border-l-2 border-[#344453]/15 pl-4 text-sm leading-7 text-[#344453]/65">{flag.extrait}</blockquote>}
            </div>
          ))}
        </div>
      </div>

      <CoachingTip tip={data.coaching_tip} />
    </div>
  );
}
