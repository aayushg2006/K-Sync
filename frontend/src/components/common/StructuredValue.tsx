import { formatAddress, formatDateTime, formatLabel, formatStatusText } from "@/lib/formatters";

type StructuredValueProps = {
  compact?: boolean;
  value: unknown;
};

function isDateLikeKey(key: string) {
  return key.endsWith("At") || key.toLowerCase().includes("date");
}

function formatPrimitive(value: string | number | boolean) {
  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  if (typeof value === "number") {
    return value.toLocaleString();
  }

  if (
    value.includes("T") &&
    value.includes(":") &&
    !Number.isNaN(new Date(value).getTime())
  ) {
    return formatDateTime(value);
  }

  if (/^[A-Z0-9_]+$/.test(value)) {
    return formatStatusText(value);
  }

  return value;
}

export function StructuredValue({ compact = false, value }: StructuredValueProps) {
  if (value === undefined || value === null) {
    return <span className="text-slate-500">Not available</span>;
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return (
      <span className={compact ? "text-sm text-slate-700 [overflow-wrap:anywhere]" : "[overflow-wrap:anywhere]"}>
        {formatPrimitive(value)}
      </span>
    );
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return <span className="text-slate-500">None</span>;
    }

    const primitivesOnly = value.every(
      (entry) =>
        typeof entry === "string" ||
        typeof entry === "number" ||
        typeof entry === "boolean",
    );

    if (primitivesOnly) {
      return (
        <div className="flex flex-wrap gap-2">
          {value.map((entry, index) => (
            <span
              key={`${String(entry)}-${index}`}
              className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700"
            >
              {formatPrimitive(entry as string | number | boolean)}
            </span>
          ))}
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {value.map((entry, index) => (
          <div key={index} className="rounded-2xl border border-white bg-white px-4 py-3">
            <StructuredValue compact value={entry} />
          </div>
        ))}
      </div>
    );
  }

  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record);

    if (
      "line1" in record &&
      "city" in record &&
      "state" in record &&
      "postalCode" in record
    ) {
      return (
        <span className={compact ? "text-sm text-slate-700" : ""}>
          {formatAddress(record as never)}
        </span>
      );
    }

    if (keys.length === 0) {
      return <span className="text-slate-500">None</span>;
    }

    return (
      <div className="space-y-2">
        {keys.map((key) => (
          <div key={key} className="rounded-2xl border border-white bg-white px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              {formatLabel(key)}
            </p>
            <div className="mt-2 text-sm leading-6 text-slate-800">
              <StructuredValue
                compact
                value={
                  typeof record[key] === "string" && isDateLikeKey(key)
                    ? formatDateTime(record[key] as string)
                    : record[key]
                }
              />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return <span className="[overflow-wrap:anywhere]">{String(value)}</span>;
}
