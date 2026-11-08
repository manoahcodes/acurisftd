import { cn } from "@/lib/format";
import type { Section } from "@/types/dashboard";
import { DataRow } from "./data-row";

export function ListCard({ title, subtitle, rows, span }: Section) {
  return (
    <section
      className={cn(
        "flex min-h-[300px] flex-col rounded-2xl border border-line bg-surface p-6 shadow-card",
        span === "full" && "lg:col-span-2",
      )}
    >
      <h2 className="text-xl font-semibold text-ink">{title}</h2>
      {subtitle && <p className="mt-1 text-[15px] text-muted">{subtitle}</p>}
      <ul className={cn(subtitle ? "mt-5" : "mt-9")}>
        {rows.map((row, i) => (
          <DataRow key={i} row={row} emphasised={i === 0} />
        ))}
      </ul>
    </section>
  );
}
