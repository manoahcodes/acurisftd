import type { Kpi } from "@/types/dashboard";

export function KpiCard({ title, caption, value, note }: Kpi) {
  return (
    <section className="rounded-2xl border border-line bg-surface p-5 shadow-card">
      <h2 className="text-lg font-semibold text-ink">{title}</h2>
      <p className="mt-1 text-[15px] text-muted">{caption}</p>
      <p className="mt-1 text-4xl font-bold tracking-tight text-ink">{value}</p>
      {note && <p className="mt-3 text-[15px] text-positive">{note}</p>}
    </section>
  );
}
