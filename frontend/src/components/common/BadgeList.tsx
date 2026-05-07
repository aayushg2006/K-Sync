import { formatLabel } from "@/lib/formatters";

type BadgeListProps = {
  emptyLabel?: string;
  values: string[];
};

export function BadgeList({ emptyLabel = "None", values }: BadgeListProps) {
  if (values.length === 0) {
    return <span className="text-sm text-slate-500">{emptyLabel}</span>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {values.map((value) => (
        <span
          key={value}
          className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700"
        >
          {formatLabel(value)}
        </span>
      ))}
    </div>
  );
}
