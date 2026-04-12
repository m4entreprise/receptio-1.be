interface FlagBadgeProps {
  type: string;
  extrait?: string | null;
}

export default function FlagBadge({ type, extrait }: FlagBadgeProps) {
  return (
    <span
      className="inline-flex items-center rounded-full border border-[#D94052]/15 bg-[#D94052]/8 px-3 py-1 text-xs font-medium text-[#D94052]"
      title={extrait || type}
    >
      {type}
    </span>
  );
}
