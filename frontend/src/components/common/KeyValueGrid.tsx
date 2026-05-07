import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export type KeyValueItem = {
  label: string;
  value: ReactNode;
};

type KeyValueGridProps = {
  className?: string;
  columns?: 1 | 2 | 3;
  items: KeyValueItem[];
};

const columnStyles: Record<NonNullable<KeyValueGridProps["columns"]>, string> = {
  1: "grid-cols-1",
  2: "grid-cols-1 md:grid-cols-2",
  3: "grid-cols-1 md:grid-cols-2 xl:grid-cols-3",
};

export function KeyValueGrid({ className, columns = 2, items }: KeyValueGridProps) {
  return (
    <dl className={cn("grid gap-3", columnStyles[columns], className)}>
      {items.map((item) => (
        <div key={item.label} className="rounded-2xl border border-slate-100 bg-slate-50/80 px-4 py-3">
          <dt className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{item.label}</dt>
          <dd className="mt-2 text-sm leading-6 text-slate-900 break-words [overflow-wrap:anywhere]">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
