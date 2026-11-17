"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Printer, Search } from "lucide-react";
import { Card, Chip, Dialog, Field, buttonClass, inputClass, primaryClass } from "@/components/teacher/shared";
import { DetailsList } from "@/components/platform/print-sheet";
import { hrefForNavLabel } from "@/config/navigation";
import { collectPayment } from "@/server/actions/cashier";
import { enabledMethods, METHOD_LABELS, startsPending, methodOf } from "@/lib/cashier/methods";
import { ngweeToInput } from "@/lib/cashier/format";
import { ACCOUNT_LABELS, type CashierTerms } from "@/lib/cashier/terms";
import { checkPayment, parseKwacha } from "@/lib/cashier/validate";
import { formatKwacha } from "@/lib/money";
import type { PrintBranding } from "@/lib/print";
import type { AccountKind, MethodId, Receipt, StudentAccount } from "@/types/cashier";
import { ReceiptSheet } from "./receipt-sheet";

const MAX_MATCHES = 6;

export function CollectPaymentView({ students, receipts, terms, branding }: { students: StudentAccount[]; receipts: Receipt[]; terms: CashierTerms; branding: PrintBranding }) {
  const params = useSearchParams();
  const fromLink = params.get("student") ?? "";
  const [query, setQuery] = useState("");
  const [studentNo, setStudentNo] = useState(() => (students.some((s) => s.no === fromLink) ? fromLink : ""));
  const student = students.find((s) => s.no === studentNo);
  const owing = useMemo(() => student?.lines.filter((l) => l.owed > 0) ?? [], [student]);

  const [account, setAccount] = useState<AccountKind | "">("");
  const [method, setMethod] = useState<MethodId>("cash");
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [doneId, setDoneId] = useState<string | null>(null);
  const [printing, setPrinting] = useState<Receipt | null>(null);
  const [pending, start] = useTransition();

  const chosenAccount = account && owing.some((l) => l.kind === account) ? account : (owing[0]?.kind ?? "");
  const owed = owing.find((l) => l.kind === chosenAccount)?.owed ?? 0;
  const group = methodOf(method)?.group;

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return students.filter((s) => `${s.no} ${s.name} ${s.group}`.toLowerCase().includes(q)).slice(0, MAX_MATCHES);
  }, [students, query]);

  const choose = (no: string) => {
    setStudentNo(no);
    setQuery("");
    setAccount("");
    setAmount("");
    setErrors({});
    setError(null);
  };

  const reset = () => {
    setStudentNo("");
    setQuery("");
    setAccount("");
    setMethod("cash");
    setAmount("");
    setReference("");
    setNote("");
    setErrors({});
    setError(null);
    setDoneId(null);
  };

  const review = () => {
    const ngwee = parseKwacha(amount);
    if (ngwee === undefined) {
      setErrors({ amount: "Enter an amount, for example 850 or 850.50." });
      setError("Enter the amount received.");
      return;
    }
    const checked = checkPayment({ studentNo, account: chosenAccount, method, amount: ngwee, reference, note }, { owed: Object.fromEntries(owing.map((l) => [l.kind, l.owed])) });
    if (!checked.ok) {
      setErrors(checked.fields ?? {});
      setError(checked.error);
      return;
    }
    setErrors({});
    setError(null);
    setReviewing(true);
  };

  const issue = () => {
    start(async () => {
      const r = await collectPayment({ studentNo, account: chosenAccount, method, amount, reference, note });
      setReviewing(false);
      if (r.ok) {
        setDoneId(r.id ?? null);
        setError(null);
      } else {
        setErrors(r.fields ?? {});
        setError(r.error);
      }
    });
  };

  const issued = doneId ? receipts.find((r) => r.id === doneId) : undefined;

  if (doneId) {
    return (
      <div className="mt-6 space-y-6">
        <Card>
          <div className="flex items-start gap-3">
            <CheckCircle2 size={28} aria-hidden className="mt-0.5 text-positive" />
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-ink">{issued?.status === "pending" ? "Payment recorded, waiting to be confirmed" : "Payment received"}</h2>
              {issued ? (
                <p className="mt-1 text-[15px] text-muted">
                  Receipt {issued.no} · {issued.studentName} · {formatKwacha(issued.amount)} · {METHOD_LABELS[issued.method]}
                </p>
              ) : (
                <p className="mt-1 text-[15px] text-muted">The receipt is being added to today&apos;s list.</p>
              )}
              {issued?.status === "pending" && (
                <p className="mt-2 text-sm text-muted">
                  The balance changes once you confirm it in <Link href={hrefForNavLabel("cashier", "Today's transactions")} className="font-medium text-brand underline">Today&apos;s transactions</Link>, after you have checked the money arrived.
                </p>
              )}
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            {issued?.status === "success" && (
              <button type="button" onClick={() => setPrinting(issued)} className={primaryClass}>
                <Printer size={16} aria-hidden /> Print receipt
              </button>
            )}
            <button type="button" onClick={reset} className={issued?.status === "success" ? buttonClass : primaryClass}>Take another payment</button>
          </div>
        </Card>
        {printing && <ReceiptSheet receipt={printing} branding={branding} terms={terms} onClose={() => setPrinting(null)} />}
      </div>
    );
  }

  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-[2fr_3fr]">
      <Card>
        <h2 className="text-lg font-semibold text-ink">1. Who is paying?</h2>
        <div className="relative mt-3">
          <Search size={16} aria-hidden className="pointer-events-none absolute left-3 top-3 text-muted" />
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`${terms.member} number or name`} aria-label={`Search for a ${terms.member.toLowerCase()}`} className={`${inputClass} pl-9`} />
        </div>
        {query.trim() && matches.length === 0 && <p className="mt-3 text-sm text-muted">No {terms.member.toLowerCase()} matches &quot;{query.trim()}&quot;.</p>}
        {matches.length > 0 && (
          <ul className="mt-3 divide-y divide-line rounded-lg border border-line">
            {matches.map((s) => (
              <li key={s.no}>
                <button type="button" onClick={() => choose(s.no)} className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-canvas focus-visible:outline-2 focus-visible:outline-brand">
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-ink">{s.name}</span>
                    <span className="block truncate text-sm text-muted">{s.no} · {s.group}</span>
                  </span>
                  <span className="shrink-0 text-sm text-muted">{s.total > 0 ? `${formatKwacha(s.total)} owed` : "Cleared"}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {errors.student && <p className="mt-2 text-sm text-danger">{errors.student}</p>}
        {student && (
          <div className="mt-4 rounded-xl bg-canvas p-4">
            <p className="font-semibold text-ink">{student.name}</p>
            <p className="text-sm text-muted">{student.no} · {student.group}</p>
            <ul className="mt-3 space-y-1 text-[15px]">
              {student.lines.map((l) => (
                <li key={l.kind} className="flex justify-between gap-3">
                  <span className="text-muted">{ACCOUNT_LABELS[l.kind]}</span>
                  <span className={l.owed > 0 ? "font-medium text-ink" : "text-muted"}>{l.owed > 0 ? formatKwacha(l.owed) : "Nothing owed"}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 border-t border-line pt-2 text-[15px] font-semibold text-ink">Total owed: {formatKwacha(student.total)}</p>
          </div>
        )}
      </Card>

      <Card>
        <h2 className="text-lg font-semibold text-ink">2. Payment</h2>
        {!student ? (
          <p className="mt-3 text-[15px] text-muted">Choose a {terms.member.toLowerCase()} first.</p>
        ) : owing.length === 0 ? (
          <p className="mt-3 text-[15px] text-muted">{student.name} has nothing owed, so there is nothing to collect. Advance payments are handled by the Bursar.</p>
        ) : (
          <form
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              review();
            }}
            className="mt-3 space-y-4"
          >
            <Field label="Pay into" error={errors.account} required>
              {(p) => (
                <select {...p} value={chosenAccount} onChange={(e) => { setAccount(e.target.value as AccountKind); setAmount(""); }} className={inputClass}>
                  {owing.map((l) => <option key={l.kind} value={l.kind}>{ACCOUNT_LABELS[l.kind]} ({formatKwacha(l.owed)} owed)</option>)}
                </select>
              )}
            </Field>

            <fieldset>
              <legend className="mb-1 block text-sm font-medium text-ink">Payment method <span aria-hidden className="text-danger">*</span></legend>
              <div className="flex flex-wrap gap-2">
                {enabledMethods().map((m) => (
                  <label key={m.id} className={`cursor-pointer rounded-lg border px-3 py-2 text-[15px] has-[:checked]:border-brand has-[:checked]:bg-canvas has-[:checked]:font-semibold has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-brand ${method === m.id ? "border-brand" : "border-line"}`}>
                    <input type="radio" name="method" value={m.id} checked={method === m.id} onChange={() => setMethod(m.id)} className="sr-only" />
                    {m.label}
                  </label>
                ))}
              </div>
              {errors.method && <p className="mt-1 text-sm text-danger">{errors.method}</p>}
            </fieldset>

            <Field label="Amount received (K)" error={errors.amount} required help={`At most ${formatKwacha(owed)}, what is owed on this account.`}>
              {(p) => (
                <div className="flex gap-2">
                  <input {...p} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" className={inputClass} />
                  <button type="button" onClick={() => setAmount(ngweeToInput(owed))} className={`${buttonClass} shrink-0`}>Full balance</button>
                </div>
              )}
            </Field>

            {group !== "cash" && (
              <Field label={group === "bank" ? "Deposit slip or transfer reference" : "Transaction ID"} error={errors.reference} required>
                {(p) => <input {...p} value={reference} onChange={(e) => setReference(e.target.value)} maxLength={80} className={inputClass} />}
              </Field>
            )}

            <Field label="Note (optional)" error={errors.note}>
              {(p) => <input {...p} value={note} onChange={(e) => setNote(e.target.value)} maxLength={220} className={inputClass} />}
            </Field>

            {error && <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}
            <button type="submit" className={primaryClass}>Review payment</button>
          </form>
        )}
      </Card>

      {reviewing && student && (
        <Dialog title="Review payment" subtitle="Check the details, then issue the receipt." onClose={() => !pending && setReviewing(false)}>
          <div className="space-y-4 px-6 py-5">
            <DetailsList
              details={[
                [terms.member, `${student.name} (${student.no})`],
                ["Pay into", ACCOUNT_LABELS[chosenAccount as AccountKind]],
                ["Method", METHOD_LABELS[method]],
                ["Reference", group === "cash" ? "" : reference.trim()],
                ["Amount", formatKwacha(parseKwacha(amount) ?? 0)],
              ]}
            />
            {startsPending(method) && <p className="text-sm text-muted"><Chip tone="warn">Pending</Chip> The balance changes when you confirm the money arrived.</p>}
            {error && <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setReviewing(false)} disabled={pending} className={buttonClass}>Back</button>
              <button type="button" onClick={issue} disabled={pending} className={primaryClass}>{pending ? "Issuing…" : "Issue receipt"}</button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
}
