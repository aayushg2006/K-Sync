import { ReactNode } from "react";

type MetricCardProps = {
  description: string;
  icon?: ReactNode;
  title: string;
  value: string | number;
};

export function MetricCard({ description, icon, title, value }: MetricCardProps) {
  return (
    <article className="rounded-[28px] border border-slate-200/80 bg-white/95 p-5 shadow-[0_20px_60px_-40px_rgba(15,23,42,0.45)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.16em] text-slate-500">{title}</p>
          <p className="mt-3 text-3xl font-semibold text-slate-950">{value}</p>
        </div>
        {icon ? <div className="rounded-2xl bg-slate-100 p-3 text-slate-700">{icon}</div> : null}
      </div>
      <p className="mt-4 text-sm leading-6 text-slate-600">{description}</p>
    </article>
  );
}
