import Link from "next/link";
import { ROLES, hrefFor, type RoleKey } from "@/config/navigation";
import type { Branding } from "@/types/theme";
import { RailTooltip } from "./rail-tooltip";

/** The parts of a school's branding the shell shows. */
export type ShellBrand = Pick<Branding, "name" | "shortName" | "logoUrl" | "copyrightHolder" | "timezone">;

/** School name and logo, and the signed-in user. Links to the role's overview page. */
export function SidebarBrand({ role, userName, brand }: { role: RoleKey; userName: string; brand: ShellBrand }) {
  return (
    <RailTooltip label={brand.name} detail={userName}>
      <Link
        href={hrefFor(role, "")}
        aria-label={`${brand.name}, ${userName}. Go to ${ROLES[role].label} overview`}
        className="block min-w-0 rounded-lg px-3 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white group-data-[collapsed=true]/sidebar:px-0 group-data-[collapsed=true]/sidebar:text-center"
      >
        <div className="flex items-center gap-2 group-data-[collapsed=true]/sidebar:justify-center">
          {brand.logoUrl && (
            // The logo is a validated data: URL, so next/image has nothing to optimise.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={brand.logoUrl} alt="" className="size-8 shrink-0 rounded-md bg-white object-contain p-0.5" />
          )}
          <span className="min-w-0 truncate text-xl font-bold leading-tight tracking-wide text-white">
            {/* In the collapsed rail only the logo, or else the first letter, fits. */}
            <span className="group-data-[collapsed=true]/sidebar:hidden">
              {brand.shortName}
            </span>
            {!brand.logoUrl && (
              <span aria-hidden className="hidden group-data-[collapsed=true]/sidebar:inline">
                {brand.shortName.slice(0, 1)}
              </span>
            )}
          </span>
        </div>
        <div className="truncate text-sm leading-snug text-slate-300 group-data-[collapsed=true]/sidebar:hidden">
          {userName}
        </div>
      </Link>
    </RailTooltip>
  );
}
