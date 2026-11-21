import { getPortalEditorState } from "@/server/queries/portal";
import { PortalEditor } from "./portal-editor";

/** Portal pages editor for the settings pages. Reads cookies: render inside <Suspense>. */
export async function PortalSection({ area }: { area: "platform" | "school" }) {
  const s = await getPortalEditorState(area);
  return (
    <PortalEditor
      // A new key resets the editor's local state when the workspace changes.
      key={`${s.schoolId ?? "platform"}:${s.inherited}`}
      scopeLabel={s.scopeLabel}
      isTenant={s.isTenant}
      area={area}
      inherited={s.inherited}
      schoolId={s.schoolId}
      content={s.content}
    />
  );
}
