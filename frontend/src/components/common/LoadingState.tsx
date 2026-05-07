type LoadingStateProps = {
  label?: string;
};

export function LoadingState({ label = "Loading K-Sync data..." }: LoadingStateProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-6 py-8">
      <div className="flex items-center gap-3">
        <div className="h-3 w-3 animate-pulse rounded-full bg-sky-500" />
        <p className="text-sm text-slate-600">{label}</p>
      </div>
    </div>
  );
}
