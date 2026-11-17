import { cache } from "react";
import { cookies } from "next/headers";
import type { RoleKey } from "@/config/navigation";
import { CHILD_COOKIE } from "@/lib/child";
import { guardianChildren, notifications } from "@/server/repositories";
import { getTenantContext } from "@/server/request-context";
import { getStudentSession } from "@/server/student-context";
import { getParentSession } from "@/server/parent-context";
import { getCashierSession } from "@/server/cashier-context";
import { cashierNotifications } from "./cashier-queries";
import { parentNotifications } from "./parent-notifications";
import { studentNotifications } from "./student-notifications";
import type { Child, NotificationSummary } from "@/types/topbar";

/** Recent notifications and the unread total for the signed-in user. */
export const getNotifications = cache(
  async (role: RoleKey): Promise<NotificationSummary> => {
    if (role === "student") return studentNotifications(await getStudentSession());
    if (role === "cashier") return cashierNotifications(await getCashierSession());
    if (role === "parent") return parentNotifications(await getParentSession());
    const ctx = await getTenantContext();
    return notifications.list(ctx, role);
  },
);

export type ChildState = {
  list: Child[];
  selected: Child | undefined;
};

/**
 * The guardian's children plus the one they picked.
 * A cookie naming a child who is not linked to this guardian is ignored, so a
 * forged cookie cannot select someone else's child.
 * Reads the cookie, so call it inside a <Suspense> boundary.
 * Dashboard queries should call this to scope their data by child.
 */
export const getChildState = cache(async (): Promise<ChildState> => {
  const ctx = await getTenantContext();
  const list = await guardianChildren.listForGuardian(ctx);
  const saved = (await cookies()).get(CHILD_COOKIE)?.value;

  const selected = list.find((c) => c.id === saved) ?? list[0];
  return { list, selected };
});