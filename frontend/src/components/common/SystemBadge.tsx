import type { SystemName } from "@/types/event.types";

import { cn } from "@/lib/utils";

const systemStyles: Record<SystemName, string> = {
  EKARMIKA: "border-emerald-200 bg-emerald-50 text-emerald-700",
  ESURAKSHATE: "border-orange-200 bg-orange-50 text-orange-700",
  KSYNC: "border-sky-200 bg-sky-50 text-sky-700",
  SWS: "border-indigo-200 bg-indigo-50 text-indigo-700",
};

type SystemBadgeProps = {
  system: SystemName;
  className?: string;
};

export function SystemBadge({ system, className }: SystemBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em]",
        systemStyles[system],
        className,
      )}
    >
      {system}
    </span>
  );
}
