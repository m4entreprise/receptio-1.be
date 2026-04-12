import { Link } from 'react-router-dom';

interface CallSample {
  call_id: string;
  score: number;
  date: string;
}

function SampleBlock({ title, calls }: { title: string; calls: CallSample[] }) {
  return (
    <div className="rounded-[24px] border border-[#344453]/10 bg-white p-5 shadow-sm">
      <p className="text-[11px] uppercase tracking-[0.24em] text-[#344453]/45" style={{ fontFamily: 'var(--font-mono)' }}>{title}</p>
      <div className="mt-4 space-y-3">
        {calls.map((call) => (
          <Link key={`${title}-${call.call_id}`} to={`/calls/${call.call_id}`} className="block rounded-2xl border border-[#344453]/10 px-4 py-3 hover:bg-[#F8F9FB] transition">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-[#141F28]">Appel {call.call_id.slice(0, 8)}</p>
                <p className="mt-1 text-xs text-[#344453]/45">{new Date(call.date).toLocaleString('fr-BE')}</p>
              </div>
              <span className="text-sm font-semibold text-[#141F28]">{call.score}/100</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

export default function AgentCallSamples({ bestCalls, worstCalls }: { bestCalls: CallSample[]; worstCalls: CallSample[] }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <SampleBlock title="Meilleurs appels" calls={bestCalls} />
      <SampleBlock title="Appels à reprendre" calls={worstCalls} />
    </div>
  );
}
