import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type InfoCardProps = {
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  description?: string;
  title?: string;
};

export function InfoCard({ actions, children, className, description, title }: InfoCardProps) {
  return (
    <section
      className={cn(
        "rounded-[28px] border border-slate-200/80 bg-white/95 p-5 shadow-[0_20px_60px_-40px_rgba(15,23,42,0.45)] backdrop-blur sm:p-6",
        className,
      )}
    >
      {title || description || actions ? (
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            {title ? <h2 className="text-lg font-semibold text-slate-950">{title}</h2> : null}
            {description ? <p className="mt-1 text-sm leading-6 text-slate-600">{description}</p> : null}
          </div>
          {actions ? <div className="shrink-0">{actions}</div> : null}
        </div>
      ) : null}
      <div className={title || description || actions ? "mt-5" : ""}>{children}</div>
    </section>
  );
}
