"use client";

import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/format";
import { setAcademicYear } from "@/server/actions/academic-year";
import type { AcademicYear } from "@/types/directory";
import { SelectError } from "./select-error";
import { useSelectAction } from "./use-select-action";

type Props = {
  years: AcademicYear[];
  selectedId: string;
  /** "bar" sits in the top bar (hidden below md); "drawer" fills the mobile drawer. */
  variant?: "bar" | "drawer";
};

export function AcademicYearSelect({ years, selectedId, variant = "bar" }: Props) {
  const { optimisticId, pending, failed, change } = useSelectAction(
    selectedId,
    setAcademicYear,
  );
  const isDrawer = variant === "drawer";

  return (
    <div className={cn("relative", isDrawer ? "w-full" : "hidden md:block")}>
      <label className="relative flex items-center">
        <span className="sr-only">Academic year</span>
        <select
          value={optimisticId}
          aria-busy={pending}
          onChange={(e) => change(e.target.value)}
          className={cn(
            "h-10 cursor-pointer appearance-none rounded-lg py-2 pl-3 pr-9",
            isDrawer
              ? "w-full bg-white/10 text-sm text-white"
              : "bg-transparent text-[15px] font-medium text-ink hover:bg-canvas",
          )}
        >
          {years.map((y) => (
            <option key={y.id} value={y.id} className="bg-surface text-ink">
              {y.label}
              {y.isCurrent && isDrawer ? " (current)" : ""}
            </option>
          ))}
        </select>
        <ChevronDown
          size={14}
          aria-hidden
          className={cn(
            "pointer-events-none absolute right-3",
            isDrawer ? "text-white/70" : "text-muted",
          )}
        />
      </label>
      <SelectError show={failed} light={isDrawer} />
    </div>
  );
}