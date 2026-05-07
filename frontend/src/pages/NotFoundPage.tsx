import { Link } from "react-router-dom";

import { ErrorState } from "@/components/common/ErrorState";

export function NotFoundPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-xl rounded-3xl border border-white/70 bg-white/85 p-8 shadow-sm backdrop-blur">
        <ErrorState description="The page you tried to open does not exist in this K-Sync workspace." title="Page not found" />
        <Link
          className="mt-6 inline-flex rounded-full bg-slate-950 px-5 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
          to="/dashboard"
        >
          Go to dashboard
        </Link>
      </div>
    </div>
  );
}
