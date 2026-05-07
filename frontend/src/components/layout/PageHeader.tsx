import { ReactNode } from "react";

type PageHeaderProps = {
  description: string;
  eyebrow?: string;
  title: string;
  trailing?: ReactNode;
};

export function PageHeader({ description, eyebrow = "K-Sync", title, trailing }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-4 rounded-[26px] border border-slate-200/80 bg-slate-50/90 px-5 py-5 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-sky-700">{eyebrow}</p>
        <h1 className="mt-2 text-xl font-semibold text-slate-950 sm:text-2xl">{title}</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{description}</p>
      </div>
      {trailing ? <div className="shrink-0">{trailing}</div> : null}
    </div>
  );
}
