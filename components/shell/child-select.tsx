"use client";

import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/format";
import { setChild } from "@/server/actions/child";
import type { Child } from "@/types/topbar";
import { SelectError } from "./select-error";
import { useSelectAction } from "./use-select-action";

type Props = {
  learners: Child[];
  selectedId: string;
  /** "bar" sits in the top bar (hidden below md); "drawer" fills the mobile drawer. */
  variant?: "bar" | "drawer";
};

/** "Chisomo Banda" + "Grade 10A" becomes "Chisomo · 10A" to keep the select narrow. */
function shortLabel(child: Child) {
  const first = child.name.split(" ")[0];
  return `${first} · ${child.grade.replace(/^Grade\s+/i, "")}`;
}

export function ChildSelect({ learners, selectedId, variant = "bar" }: Props) {
  const { optimisticId, pending, failed, change } = useSelectAction(selectedId, setChild);
  const isDrawer = variant === "drawer";

  return (
    <div className={cn("relative", isDrawer ? "w-full" : "hidden md:block")}>
      <label className="relative flex items-center">
        <span className="sr-only">Child</span>
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
          {learners.map((c) => (
            <option key={c.id} value={c.id} className="bg-surface text-ink">
              {isDrawer ? `${c.name} · ${c.grade}` : shortLabel(c)}
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