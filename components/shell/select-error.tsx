import { cn } from "@/lib/format";

/** Short message under a select when saving the choice failed. */
export function SelectError({
  show,
  light = false,
}: {
  show: boolean;
  /** Dark text on a light chip, for use on the navy drawer. */
  light?: boolean;
}) {
  if (!show) return null;

  return (
    <span
      role="alert"
      className={cn(
        "absolute right-0 top-full z-50 mt-1 whitespace-nowrap rounded-md px-2 py-1 text-xs shadow-md",
        light ? "bg-surface text-ink" : "bg-ink text-white",
      )}
    >
      Could not save. Try again.
    </span>
  );
}