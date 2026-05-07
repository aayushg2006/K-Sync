import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";

type DebugDisclosureProps = {
  children?: ReactNode;
  data?: unknown;
  title: string;
};

export function DebugDisclosure({ children, data, title }: DebugDisclosureProps) {
  return (
    <details className="group rounded-2xl border border-slate-200 bg-slate-950/98">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium text-slate-200">
        <span>{title}</span>
        <ChevronDown className="h-4 w-4 transition group-open:rotate-180" />
      </summary>
      <div className="border-t border-slate-800 px-4 py-4">
        {children ?? (
          <pre className="overflow-x-auto text-sm leading-6 text-slate-300">
            <code>{JSON.stringify(data, null, 2)}</code>
          </pre>
        )}
      </div>
    </details>
  );
}
