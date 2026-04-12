import { useEffect, useState } from 'react';
import axios from 'axios';
import AgentScoreTrend from './AgentScoreTrend';
import AgentFlagBreakdown from './AgentFlagBreakdown';
import AgentWeakCriteria from './AgentWeakCriteria';
import AgentCallSamples from './AgentCallSamples';

interface ProfileData {
  agent: { id: string; name: string };
  period: string;
  call_count: number;
  avg_score: number;
  score_trend: Array<{ date: string; score: number }>;
  top_flag: { type: string; count: number } | null;
  flag_breakdown: Array<{ type: string; count: number }>;
  weak_criteria: Array<{ label: string; avg_note: number; avg_max: number }>;
  best_calls: Array<{ call_id: string; score: number; date: string }>;
  worst_calls: Array<{ call_id: string; score: number; date: string }>;
  coaching_focus: string;
}

export default function AgentCoachingProfile({ staffId, period = '30d' }: { staffId: string; period?: '7d' | '30d' }) {
  const [data, setData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    axios.get(`/api/qa/agents/${staffId}/profile?period=${period}`)
      .then((res) => {
        if (active) setData(res.data);
      })
      .catch(() => {
        if (active) setData(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [staffId, period]);

  if (loading) {
    return <div className="flex items-center justify-center py-12"><div className="h-8 w-8 animate-spin rounded-full border-4 border-[#344453]/20 border-t-[#344453]" /></div>;
  }

  if (!data) {
    return <div className="rounded-[24px] border border-dashed border-[#344453]/20 bg-white p-8 text-center text-sm text-[#344453]/50">Aucune donnée de coaching disponible.</div>;
  }

  return (
    <div className="space-y-5">
      <div className="rounded-[28px] border border-[#344453]/10 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.24em] text-[#344453]/45" style={{ fontFamily: 'var(--font-mono)' }}>Coaching QA</p>
            <h3 className="mt-2 text-xl font-semibold text-[#141F28]" style={{ fontFamily: 'var(--font-title)' }}>{data.agent.name}</h3>
            <p className="mt-1 text-sm text-[#344453]/55">{data.call_count} appel{data.call_count > 1 ? 's' : ''} · période {data.period}</p>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm sm:min-w-[220px]">
            <div className="rounded-2xl bg-[#344453]/6 px-4 py-3">
              <p className="text-[#344453]/50">Score moyen</p>
              <p className="mt-1 text-2xl font-semibold text-[#141F28]">{data.avg_score}</p>
            </div>
            <div className="rounded-2xl bg-[#C7601D]/10 px-4 py-3">
              <p className="text-[#344453]/50">Flag dominant</p>
              <p className="mt-1 text-sm font-semibold text-[#141F28]">{data.top_flag?.type || '—'}</p>
            </div>
          </div>
        </div>
        <p className="mt-4 text-sm leading-7 text-[#344453]/65">{data.coaching_focus}</p>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <AgentScoreTrend data={data.score_trend} />
        <div className="rounded-[24px] border border-[#344453]/10 bg-white p-5 shadow-sm">
          <p className="text-[11px] uppercase tracking-[0.24em] text-[#344453]/45" style={{ fontFamily: 'var(--font-mono)' }}>Répartition flags</p>
          <div className="mt-4">
            <AgentFlagBreakdown flags={data.flag_breakdown} />
          </div>
        </div>
      </div>

      <div className="rounded-[24px] border border-[#344453]/10 bg-white p-5 shadow-sm">
        <p className="text-[11px] uppercase tracking-[0.24em] text-[#344453]/45" style={{ fontFamily: 'var(--font-mono)' }}>Critères faibles</p>
        <div className="mt-4">
          <AgentWeakCriteria criteria={data.weak_criteria} />
        </div>
      </div>

      <AgentCallSamples bestCalls={data.best_calls} worstCalls={data.worst_calls} />
    </div>
  );
}
