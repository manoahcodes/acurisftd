import Link from "next/link";
import { ROLES, ROLE_KEYS } from "@/config/navigation";

/** Dev-only role picker. Replace with real login + role-based redirect. */
export default function Home() {
  return (
    <main className="mx-auto max-w-md px-6 py-20">
      <h1 className="text-3xl font-bold">ACURIS</h1>
      <p className="mt-2 text-muted">Pick a role to preview its dashboard.</p>
      <p className="mt-2 text-sm">
        <Link href="/sign-in" className="font-medium text-brand underline">Open the branded sign-in page</Link>
      </p>
      <ul className="mt-8 space-y-2">
        {ROLE_KEYS.map((key) => (
          <li key={key}>
            <Link
              href={`/${key}`}
              className="block rounded-xl border border-line bg-surface px-4 py-3 font-medium hover:border-brand"
            >
              {ROLES[key].label}
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
