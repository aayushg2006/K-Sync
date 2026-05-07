import { KeyValueGrid } from "@/components/common/KeyValueGrid";
import { StructuredValue } from "@/components/common/StructuredValue";
import { formatLabel } from "@/lib/formatters";

type MetadataListProps = {
  emptyMessage?: string;
  metadata?: Record<string, unknown>;
  title?: string;
};

export function MetadataList({
  emptyMessage = "No metadata is available for this record.",
  metadata,
}: MetadataListProps) {
  const entries = Object.entries(metadata ?? {}).map(([key, value]) => ({
    label: formatLabel(key),
    value: <StructuredValue value={value} />,
  }));

  if (entries.length === 0) {
    return <p className="text-sm text-slate-500">{emptyMessage}</p>;
  }

  return <KeyValueGrid columns={2} items={entries} />;
}
