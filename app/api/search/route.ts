import { NextResponse, type NextRequest } from "next/server";
import { isRoleKey } from "@/config/navigation";
import { searchIndex } from "@/server/repositories";
import { searchStudent } from "@/server/queries/student-search";
import { getTenantContext } from "@/server/request-context";
import { getStudentSession } from "@/server/student-context";
import { getParentSession } from "@/server/parent-context";
import { searchParent } from "@/server/queries/parent-search";
import { getCashierSession } from "@/server/cashier-context";
import { searchCashier } from "@/server/queries/cashier-queries";

const MIN_CHARS = 2;
const MAX_QUERY_LENGTH = 80;

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;

  // DEV ONLY: the role comes from the client because the role currently comes
  // from the URL. Once auth exists, read the role from the session instead,
  // or any user could request another role's results.
  const role = searchParams.get("role") ?? "";
  if (!isRoleKey(role)) {
    return NextResponse.json({ error: "Unknown role" }, { status: 400 });
  }

  const query = (searchParams.get("q") ?? "").trim().slice(0, MAX_QUERY_LENGTH);
  if (query.length < MIN_CHARS) {
    return NextResponse.json({ results: [] });
  }

  // Students search their own assignments, results, notices and resources.
  // Parents search only their own children, events and conversations.
  // Cashiers search their own desk: students and receipts.
  const results =
    role === "student"
      ? await searchStudent((await getStudentSession()).ctx, query)
      : role === "parent"
        ? await searchParent(await getParentSession(), query)
        : role === "cashier"
          ? await searchCashier(await getCashierSession(), query)
          : await searchIndex.search(await getTenantContext(), role, query);

  return NextResponse.json(
    { results },
    { headers: { "Cache-Control": "no-store" } },
  );
}