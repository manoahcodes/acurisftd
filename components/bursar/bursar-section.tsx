import { BURSAR_PAGES } from "@/lib/bursar/pages";
import { printBrandingOf } from "@/lib/print";
import { bursar } from "@/server/repositories";
import { getBursarSession } from "@/server/bursar-context";
import { getResolvedTheme } from "@/server/queries/theme";
import { DebtorsView } from "./debtors-view";
import { FeeStructuresView } from "./fee-structures-view";
import { InvoicesView } from "./invoices-view";
import { invoiceViews } from "@/lib/bursar/invoices";
import { ReconciliationView } from "./reconciliation-view";
import { RecordPaymentView } from "./record-payment-view";
import { StudentAccountsView } from "./student-accounts-view";

export { BURSAR_PAGES };

/** One Bursar page. Reads cookies and the session, so render it inside <Suspense>. */
export async function BursarSection({ slug }: { slug: string }) {
  const { ctx, terms, feePolicy } = await getBursarSession();
  const branding = printBrandingOf((await getResolvedTheme("bursar")).branding);

  if (slug === "fee-structures") {
    const [fees, groups] = await Promise.all([bursar.listFees(ctx), bursar.listGroups(ctx)]);
    return <FeeStructuresView fees={fees} groups={groups} terms={terms} today={ctx.today} branding={branding} />;
  }

  if (slug === "student-accounts") {
    const [accounts, unallocated, waivers] = await Promise.all([bursar.listAccounts(ctx), bursar.listUnallocated(ctx), bursar.listWaivers(ctx)]);
    return <StudentAccountsView accounts={accounts} unallocated={unallocated} waivers={waivers} terms={terms} today={ctx.today} branding={branding} />;
  }

  if (slug === "record-payment") {
    const [accounts, payments] = await Promise.all([bursar.listAccounts(ctx), bursar.listPayments(ctx)]);
    return <RecordPaymentView accounts={accounts} payments={payments} terms={terms} today={ctx.today} branding={branding} />;
  }

  if (slug === "invoices") {
    const [accounts, invoices, fees, groups] = await Promise.all([bursar.listAccounts(ctx), bursar.listInvoices(ctx), bursar.listFees(ctx), bursar.listGroups(ctx)]);
    const views = invoiceViews(invoices, accounts.map((a) => ({ no: a.no, name: a.name, group: a.group, lines: a.lines })), ctx.today);
    return <InvoicesView views={views} fees={fees} accounts={accounts} groups={groups} terms={terms} today={ctx.today} branding={branding} />;
  }

  if (slug === "debtors") {
    const [accounts, plans, reminders] = await Promise.all([bursar.listAccounts(ctx), bursar.listPlans(ctx), bursar.listReminders(ctx)]);
    return <DebtorsView accounts={accounts} plans={plans} reminders={reminders} terms={terms} today={ctx.today} feePolicy={feePolicy} branding={branding} />;
  }

  if (slug === "reconciliation") {
    const [lines, payments, unallocated, book] = await Promise.all([bursar.listBankLines(ctx), bursar.listPayments(ctx), bursar.listUnallocated(ctx), bursar.listCashUps(ctx)]);
    return <ReconciliationView lines={lines} payments={payments} unallocated={unallocated} book={book} today={ctx.today} branding={branding} />;
  }

  return null;
}
