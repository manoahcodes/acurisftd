"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { OPEN_PARAM } from "@/config/navigation";
import type { FormSpec } from "@/types/forms";
import type { ProcessSpec } from "@/types/process";
import { Tooltip } from "@/components/ui/tooltip";
import { ProcessDialog } from "./process-dialog";
import { RecordForm } from "./record-form";

/** The screen's action buttons. A form button opens its form, a job button (import, generate, publish) opens its dialog; any other is not built yet. */
export function ScreenActions({
  slug,
  actions,
  forms,
  processes = {},
}: {
  slug: string;
  actions: string[];
  forms: Record<string, FormSpec>;
  processes?: Record<string, ProcessSpec>;
}) {
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const wanted = params.get(OPEN_PARAM);
  // Arriving from a quick action (?new=Add tenant) opens that form once.
  const [open, setOpen] = useState<string | null>(wanted && forms[wanted] ? wanted : null);

  useEffect(() => {
    if (wanted) router.replace(pathname, { scroll: false });
  }, [wanted, pathname, router]);
  const spec = open ? forms[open] : undefined;
  const processSpec = open && !spec ? processes[open] : undefined;

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {actions.map((label) =>
          forms[label] || processes[label] ? (
            <button
              key={label}
              type="button"
              onClick={() => setOpen(label)}
              className="rounded-lg bg-brand px-4 py-2 text-[15px] font-semibold text-on-brand hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              {label}
            </button>
          ) : (
            <Tooltip key={label} label="Not built yet">
              <button
                type="button"
                disabled
                className="rounded-lg bg-brand px-4 py-2 text-[15px] font-semibold text-on-brand opacity-50"
              >
                {label}
              </button>
            </Tooltip>
          ),
        )}
      </div>
      {processSpec && <ProcessDialog key={processSpec.id} slug={slug} spec={processSpec} onClose={() => setOpen(null)} />}
      {spec && <RecordForm slug={slug} spec={spec} target={{ mode: "create" }} onClose={() => setOpen(null)} />}
    </>
  );
}
