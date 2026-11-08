"use client";

import { useState } from "react";
import type { FormSpec } from "@/types/forms";
import { RecordForm } from "./record-form";

/** The screen's action buttons. Those with a form open it; the rest are not built yet. */
export function ScreenActions({
  slug,
  actions,
  forms,
}: {
  slug: string;
  actions: string[];
  forms: Record<string, FormSpec>;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const spec = open ? forms[open] : undefined;

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {actions.map((label) =>
          forms[label] ? (
            <button
              key={label}
              type="button"
              onClick={() => setOpen(label)}
              className="rounded-lg bg-brand px-4 py-2 text-[15px] font-semibold text-white hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              {label}
            </button>
          ) : (
            <button
              key={label}
              type="button"
              disabled
              title="Not built yet"
              className="rounded-lg bg-brand px-4 py-2 text-[15px] font-semibold text-white opacity-50"
            >
              {label}
            </button>
          ),
        )}
      </div>
      {spec && <RecordForm slug={slug} spec={spec} target={{ mode: "create" }} onClose={() => setOpen(null)} />}
    </>
  );
}
