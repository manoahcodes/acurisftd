import { NextResponse, type NextRequest } from "next/server";
import { safeFileName } from "@/lib/student/files";
import { student } from "@/server/repositories";
import { getStudentSession } from "@/server/student-context";

const ID = /^[A-Za-z0-9_-]{1,80}$/;

/**
 * Downloads the file a student handed in. It is always sent as an attachment
 * with a type fixed when it was checked on upload, never one the browser
 * chose, so an uploaded file can never run as a page.
 */
export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("assignment") ?? "";
  if (!ID.test(id)) return NextResponse.json({ error: "Unknown assignment" }, { status: 400 });

  const { ctx } = await getStudentSession();
  const file = await student.getSubmissionFile(ctx, id);
  if (!file) return NextResponse.json({ error: "No file" }, { status: 404 });

  const name = safeFileName(file.name);
  return new NextResponse(Buffer.from(file.data, "base64"), {
    headers: {
      "Content-Type": file.type,
      "Content-Disposition": `attachment; filename="${name.replace(/"/g, "")}"; filename*=UTF-8''${encodeURIComponent(name)}`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
}
