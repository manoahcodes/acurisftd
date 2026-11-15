import { hrefForNavLabel } from "@/config/navigation";
import { prettyDate } from "@/lib/teacher/dates";
import type { NotificationSummary } from "@/types/topbar";
import { student } from "../repositories";
import type { StudentSession } from "../student-context";
import { getStudentFeeView } from "./student-fees";
import { feeNotice } from "@/lib/student/fees";

const MAX_ITEMS = 6;

/**
 * The bell for a student: notices not read yet, then assignments with nothing
 * handed in (soonest due first). The count is every one of those, which can be
 * more than the items listed. It follows the same records as the sidebar badges.
 */
export async function studentNotifications(s: Pick<StudentSession, "ctx" | "feePolicy" | "terms">): Promise<NotificationSummary> {
  const { ctx } = s;
  const [notices, assignments, feeView] = await Promise.all([student.listNotices(ctx), student.listAssignments(ctx), getStudentFeeView(s)]);
  const fee = feeNotice(s.terms, feeView.fee, feeView.policy, feeView.withheld);
  const feeHref = hrefForNavLabel("student", feeView.withheld.examCard ? "Exam card" : feeView.withheld.results ? "Results & grades" : "School notices", "Student notifications");
  const unread = notices.filter((n) => !n.read).sort((a, b) => b.postedOn.localeCompare(a.postedOn));
  const todo = assignments.filter((a) => !a.submission).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const noticesHref = hrefForNavLabel("student", "School notices", "Student notifications");
  const assignmentsHref = hrefForNavLabel("student", "Assignments", "Student notifications");
  return {
    unreadCount: unread.length + todo.length + (fee ? 1 : 0),
    items: [
      ...(fee ? [{ id: "fee-balance", title: fee.title, detail: fee.detail, href: feeHref, unread: true }] : []),
      ...unread.map((n) => ({ id: `notice-${n.id}`, title: n.title, detail: `${n.category} · ${prettyDate(n.postedOn)}`, href: noticesHref, unread: true })),
      ...todo.map((a) => ({ id: `assignment-${a.id}`, title: `${a.title}`, detail: `${a.courseName} · Due ${prettyDate(a.dueDate)}`, href: assignmentsHref, unread: true })),
    ].slice(0, MAX_ITEMS),
  };
}
