interface WeakCriterion {
  label: string;
  avg_note: number;
  avg_max: number;
}

export default function AgentWeakCriteria({ criteria }: { criteria: WeakCriterion[] }) {
  return (
    <div className="space-y-3">
      {criteria.map((criterion) => (
        <div key={criterion.label} className="rounded-[20px] border border-[#344453]/10 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium text-[#141F28]">{criterion.label}</p>
            <p className="text-sm font-semibold text-[#141F28]">{criterion.avg_note}/{criterion.avg_max}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
