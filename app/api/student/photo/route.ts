import { NextResponse } from "next/server";
import { student } from "@/server/repositories";
import { getStudentSession } from "@/server/student-context";

/**
 * The signed-in student's profile photo. Only their own photo can be asked
 * for: nothing in the request chooses whose. Sent with a fixed image type, not
 * to be sniffed, and never cached by shared caches.
 */
export async function GET() {
  const { ctx } = await getStudentSession();
  const photo = await student.getPhoto(ctx);
  if (!photo) return new NextResponse(null, { status: 404 });
  return new NextResponse(Buffer.from(photo.data, "base64"), {
    headers: { "Content-Type": photo.type, "X-Content-Type-Options": "nosniff", "Cache-Control": "private, max-age=0, must-revalidate", "Content-Security-Policy": "default-src 'none'; sandbox" },
  });
}
