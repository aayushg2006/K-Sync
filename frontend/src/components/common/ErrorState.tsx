type ErrorStateProps = {
  description: string;
  title?: string;
};

export function ErrorState({ description, title = "Something needs attention" }: ErrorStateProps) {
  return (
    <div className="rounded-2xl border border-rose-200 bg-rose-50 px-6 py-6">
      <h3 className="text-lg font-semibold text-rose-900">{title}</h3>
      <p className="mt-2 text-sm text-rose-700">{description}</p>
    </div>
  );
}
