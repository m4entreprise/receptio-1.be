interface CoachingTipProps {
  tip: string;
}

export default function CoachingTip({ tip }: CoachingTipProps) {
  if (!tip) return null;

  return (
    <div className="rounded-[24px] border border-[#E6A817]/20 bg-[#E6A817]/10 p-5">
      <p className="text-[11px] uppercase tracking-[0.24em] text-[#8D6A00]" style={{ fontFamily: 'var(--font-mono)' }}>
        Recommandation
      </p>
      <p className="mt-3 text-sm font-medium leading-7 text-[#141F28]">
        La prochaine fois : {tip}
      </p>
    </div>
  );
}
