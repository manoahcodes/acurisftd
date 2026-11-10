import { ACURIS_COPYRIGHT_TEXT } from "@/lib/theme/copyright";
import { CopyrightYear } from "./copyright-year";

/**
 * Copyright lines, pinned to the bottom of the sidebar: the school's own line
 * (when it has one) above the fixed ACURIS line. The (c) symbol and year are
 * always added here, so only the name is configurable.
 */
export function SidebarFooter({ copyrightHolder }: { copyrightHolder: string }) {
  return (
    <div className="mt-auto pt-6 group-data-[collapsed=true]/sidebar:hidden">
      <footer className="space-y-1 border-t border-navy-line px-3 pt-3 text-xs text-slate-400">
        {copyrightHolder && (
          <p>
            &copy; <CopyrightYear /> {copyrightHolder}.
          </p>
        )}
        <p>
          &copy; <CopyrightYear /> {ACURIS_COPYRIGHT_TEXT}
        </p>
      </footer>
    </div>
  );
}
