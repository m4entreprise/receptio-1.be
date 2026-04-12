interface FlagItem {
  type: string;
  count: number;
}

export default function AgentFlagBreakdown({ flags }: { flags: FlagItem[] }) {
  const max = Math.max(...flags.map((flag) => flag.count), 1);

  return (
    <div className="space-y-3">
      {flags.map((flag) => (
        <div key={flag.type} className="rounded-[20px] border border-[#344453]/10 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="font-medium text-[#141F28]">{flag.type}</span>
            <span className="text-[#344453]/55">{flag.count}</span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#344453]/8">
            <div className="h-full rounded-full bg-[#C7601D]" style={{ width: `${Math.max(8, Math.round((flag.count / max) * 100))}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}
