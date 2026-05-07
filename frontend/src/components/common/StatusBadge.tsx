import { ReactNode } from "react";
import { cva } from "class-variance-authority";

import { cn } from "@/lib/utils";

const statusBadgeVariants = cva(
  "inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em]",
  {
    defaultVariants: {
      variant: "neutral",
    },
    variants: {
      variant: {
        active: "border-emerald-200 bg-emerald-50 text-emerald-700",
        neutral: "border-slate-200 bg-white text-slate-700",
        pending: "border-amber-200 bg-amber-50 text-amber-700",
      },
    },
  },
);

type StatusBadgeProps = {
  children: ReactNode;
  className?: string;
  variant?: "active" | "neutral" | "pending";
};

export function StatusBadge({ children, className, variant = "neutral" }: StatusBadgeProps) {
  return <span className={cn(statusBadgeVariants({ variant }), className)}>{children}</span>;
}
