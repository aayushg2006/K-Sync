export const NAV_ITEMS = [
  { description: "Operational overview of interoperability activity, queue health, and sync outcomes.", label: "Dashboard", to: "/dashboard" },
  { description: "Compare business records across SWS, e-Karmika, and e-Surakshate.", label: "Business Sync", to: "/business-sync" },
  { description: "Inspect canonical events, correlation IDs, and delivery progress.", label: "Events", to: "/events" },
  { description: "Review audit evidence across ingestion, routing, conflict review, and delivery.", label: "Audit", to: "/audit" },
  { description: "Track conflict decisions, authority rules, and manual review items.", label: "Conflicts", to: "/conflicts" },
  { description: "Run deterministic demo flows and reset K-Sync state.", label: "Demo Control", to: "/demo-control" },
] as const;
