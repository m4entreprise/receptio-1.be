interface ScoreRow {
  critere_id: string;
  label: string;
  note: number;
  max: number;
  poids: number;
  justification: string;
}

interface ScoreBreakdownProps {
  scores: ScoreRow[];
}

export default function ScoreBreakdown({ scores }: ScoreBreakdownProps) {
  return (
    <div className="space-y-3">
      {scores.map((score) => {
        const ratio = score.max > 0 ? Math.max(0, Math.min(100, Math.round((score.note / score.max) * 100))) : 0;
        const color = ratio >= 70 ? '#2D9D78' : ratio >= 50 ? '#C7601D' : '#D94052';
        return (
          <div key={score.critere_id} className="rounded-[20px] border border-[#344453]/10 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-[#141F28]">{score.label}</p>
                <p className="mt-1 text-xs text-[#344453]/45">Poids {score.poids}%</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-[#141F28]">{score.note}/{score.max}</p>
              </div>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#344453]/8">
              <div className="h-full rounded-full" style={{ width: `${ratio}%`, backgroundColor: color }} />
            </div>
            {score.justification && (
              <p className="mt-3 text-sm leading-7 text-[#344453]/55">{score.justification}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
