import { hrefForNavLabel, type RoleKey } from "@/config/navigation";
import type { NotificationItem } from "@/types/topbar";
import type { ChildRepository, NotificationRepository } from "./topbar-types";

type Seed = {
  id: string;
  title: string;
  detail: string;
  /** Label of the nav item this notification opens. */
  navLabel: string;
  unread: boolean;
};

const DATA: Record<RoleKey, Seed[]> = {
  platform: [
    { id: "n1", title: "Storage approaching limit", detail: "Lusaka Hills Academy", navLabel: "Usage & capacity", unread: true },
    { id: "n2", title: "Subscription renewal due in 5 days", detail: "Northview Primary", navLabel: "Subscriptions", unread: true },
    { id: "n3", title: "Failed nightly sync", detail: "2 tenants need investigation", navLabel: "Audit trail", unread: true },
    { id: "n4", title: "New tenant awaiting verification", detail: "1 request", navLabel: "Tenants & schools", unread: true },
  ],
  "school-admin": [
    { id: "n1", title: "Student registrations awaiting approval", detail: "Registrations", navLabel: "Admitted students", unread: true },
    { id: "n2", title: "Room allocations to confirm", detail: "Hostels", navLabel: "Room allocations", unread: true },
    { id: "n3", title: "Nightly sync failed on one campus", detail: "Review in the audit trail", navLabel: "Audit trail", unread: true },
  ],
  teacher: [
    { id: "n1", title: "28 assessments to mark", detail: "Due by Friday", navLabel: "Assessments", unread: true },
    { id: "n2", title: "Week 4 quiz needs marking", detail: "Tionenji Phiri", navLabel: "Assessments", unread: true },
    { id: "n3", title: "Grade 11A register not started", detail: "31 learners", navLabel: "Class register", unread: true },
  ],
  bursar: [
    { id: "n1", title: "3 unallocated payments", detail: "K 2,350 needs matching", navLabel: "Student accounts", unread: true },
    { id: "n2", title: "Daily cash-up not submitted", detail: "Reconciliation is pending", navLabel: "Reconciliation", unread: true },
    { id: "n3", title: "24 accounts overdue", detail: "K 186,450 outstanding", navLabel: "Debtors", unread: true },
  ],
  cashier: [
    { id: "n1", title: "2 receipts pending", detail: "Check payment status", navLabel: "Today's transactions", unread: true },
    { id: "n2", title: "Cash-up not submitted", detail: "Expected cash K 2,500", navLabel: "Cash-up", unread: true },
  ],
  parent: [
    { id: "n1", title: "Parent-teacher meeting", detail: "24 Oct · RSVP requested", navLabel: "School calendar", unread: true },
    { id: "n2", title: "Fee reminder", detail: "K 1,250 due 31 Oct", navLabel: "Fee statements", unread: true },
    { id: "n3", title: "Grade 10 assessment schedule published", detail: "Chisomo", navLabel: "Academic progress", unread: true },
  ],
  student: [
    { id: "n1", title: "Algebra practice due tomorrow", detail: "Mathematics · 22 Oct", navLabel: "Assignments", unread: true },
    { id: "n2", title: "Grade 10 revision session", detail: "Thursday after school", navLabel: "School notices", unread: true },
    { id: "n3", title: "Sports day sign-ups are open", detail: "Register by 28 Oct", navLabel: "School notices", unread: true },
  ],
};

export const mockNotificationRepository: NotificationRepository = {
  // The mock ignores ctx because all mock data belongs to one school.
  async list(_ctx, role) {
    const items: NotificationItem[] = DATA[role].map((s) => ({
      id: s.id,
      title: s.title,
      detail: s.detail,
      href: hrefForNavLabel(role, s.navLabel, "Notification mock"),
      unread: s.unread,
    }));

    return {
      unreadCount: items.filter((i) => i.unread).length,
      items,
    };
  },
};

export const mockChildRepository: ChildRepository = {
  async listForGuardian() {
    return [
      { id: "chisomo", name: "Chisomo Banda", grade: "Grade 10A" },
      { id: "natasha", name: "Natasha Banda", grade: "Grade 5B" },
    ];
  },
};