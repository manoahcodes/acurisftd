import { CASHIER_PAGES } from "@/lib/cashier/pages";
import { printBrandingOf } from "@/lib/print";
import { cashier } from "@/server/repositories";
import { getCashierSession } from "@/server/cashier-context";
import { getResolvedTheme } from "@/server/queries/theme";
import { CashUpView } from "./cash-up-view";
import { CollectPaymentView } from "./collect-payment-view";
import { FindStudentView } from "./find-student-view";
import { PaymentMethodsView } from "./payment-methods-view";
import { PrintReceiptView } from "./print-receipt-view";
import { TransactionsView } from "./transactions-view";

export { CASHIER_PAGES };

/** One Cashier page. Reads cookies and the session, so render it inside <Suspense>. */
export async function CashierSection({ slug }: { slug: string }) {
  const { ctx, terms } = await getCashierSession();
  const branding = printBrandingOf((await getResolvedTheme("cashier")).branding);

  if (slug === "collect-payment") {
    const [students, receipts] = await Promise.all([cashier.listStudents(ctx), cashier.listReceipts(ctx)]);
    return <CollectPaymentView students={students} receipts={receipts} terms={terms} branding={branding} />;
  }

  if (slug === "find-student") {
    const [students, receipts] = await Promise.all([cashier.listStudents(ctx), cashier.listReceipts(ctx)]);
    return <FindStudentView students={students} receipts={receipts} terms={terms} timezone={branding.timezone} />;
  }

  if (slug === "print-receipt") {
    const receipts = await cashier.listReceipts(ctx);
    return <PrintReceiptView receipts={receipts} terms={terms} branding={branding} />;
  }

  if (slug === "today-s-transactions") {
    const [receipts, day] = await Promise.all([cashier.listReceipts(ctx), cashier.getDay(ctx, ctx.today)]);
    return <TransactionsView receipts={receipts} day={day} today={ctx.today} terms={terms} branding={branding} />;
  }

  if (slug === "cash-up") {
    const [day, history] = await Promise.all([cashier.getDay(ctx, ctx.today), cashier.listCashUps(ctx)]);
    return <CashUpView day={day} history={history.filter((h) => h.date !== ctx.today)} today={ctx.today} branding={branding} />;
  }

  if (slug === "payment-methods") {
    return <PaymentMethodsView day={await cashier.getDay(ctx, ctx.today)} />;
  }

  return null;
}
