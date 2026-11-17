import { Card, Chip } from "@/components/teacher/shared";
import { PAYMENT_METHODS } from "@/lib/cashier/methods";
import { formatKwacha } from "@/lib/money";
import type { DaySummary } from "@/types/cashier";

const GROUP_LABEL = { cash: "Cash", mobile: "Mobile money", bank: "Bank" } as const;

/** What the school accepts, with today's confirmed total for each. Read-only: the school sets the methods, not the cashier. */
export function PaymentMethodsView({ day }: { day: DaySummary }) {
  return (
    <div className="mt-6 space-y-6">
      <p className="rounded-lg bg-canvas px-4 py-3 text-[15px] text-muted">These are set by the school. If a method is missing or a number is wrong, tell the Bursar; it cannot be changed from the desk.</p>
      <div className="grid gap-6 md:grid-cols-2">
        {PAYMENT_METHODS.map((m) => (
          <Card key={m.id}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 className="text-lg font-semibold text-ink">{m.label}</h2>
                <p className="text-sm text-muted">{GROUP_LABEL[m.group]}</p>
              </div>
              <Chip tone={m.enabled ? "good" : "info"}>{m.enabled ? "Accepted" : "Not accepted"}</Chip>
            </div>
            <p className="mt-3 text-2xl font-bold text-ink">{formatKwacha(day.byMethod[m.id])}</p>
            <p className="text-sm text-muted">Confirmed today</p>
            {m.details.length > 0 && (
              <dl className="mt-4 grid grid-cols-[9rem_1fr] gap-x-4 gap-y-1.5 text-[15px]">
                {m.details.map(([k, v]) => (
                  <div key={k} className="contents"><dt className="text-muted">{k}</dt><dd className="font-medium text-ink">{v}</dd></div>
                ))}
              </dl>
            )}
            <h3 className="mt-4 text-sm font-semibold text-ink">Before you issue the receipt</h3>
            <ol className="mt-1 list-decimal space-y-1 pl-5 text-[15px] text-muted">
              {m.instructions.map((i) => <li key={i}>{i}</li>)}
            </ol>
          </Card>
        ))}
      </div>
    </div>
  );
}
