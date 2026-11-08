"use client";

import { ChevronDown } from "lucide-react";
import { setPlatformDivision } from "@/server/actions/platform-tenant";
import { SelectError } from "./select-error";
import { useSelectAction } from "./use-select-action";

export type DivisionOption = { id: string; name: string };

/** Division picker for a school with several divisions. First option is "all". */
export function DivisionSelect({
  options,
  selectedId,
}: {
  options: DivisionOption[];
  selectedId: string;
}) {
  const { optimisticId, pending, failed, change } = useSelectAction(selectedId, setPlatformDivision);

  return (
    <div className="relative mt-2 group-data-[collapsed=true]/sidebar:hidden">
      <label className="relative flex items-center">
        <span className="sr-only">Division</span>
        <select
          value={optimisticId}
          aria-busy={pending}
          onChange={(e) => change(e.target.value)}
          className="h-10 w-full cursor-pointer appearance-none rounded-lg bg-white/10 py-2 pl-3 pr-9 text-sm text-white focus-visible:outline-2 focus-visible:outline-white"
        >
          {options.map((o) => (
            <option key={o.id} value={o.id} className="bg-surface text-ink">
              {o.name}
            </option>
          ))}
        </select>
        <ChevronDown size={14} aria-hidden className="pointer-events-none absolute right-3 text-white/70" />
      </label>
      <SelectError show={failed} light />
    </div>
  );
}
