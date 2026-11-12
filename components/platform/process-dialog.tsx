"use client";

import { useActionState, useEffect, useRef } from "react";
import { Download as DownloadIcon, X } from "lucide-react";
import { toCsv } from "@/lib/csv";
import { runProcess } from "@/server/actions/process";
import type { Download, ProcessSpec, ProcessState } from "@/types/process";
import { Field, inputClass } from "./record-form";

const IDLE: ProcessState = { status: "idle" };

/** Hands a generated file to the browser as a download. */
function save({ filename, mime, content }: Download) {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Modal for a job button: asks its questions, takes a CSV if it needs one, shows what happened. */
export function ProcessDialog({ slug, spec, onClose }: { slug: string; spec: ProcessSpec; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [state, action, pending] = useActionState(runProcess, IDLE);
  const formId = `pd-${spec.id}`;
  const done = state.status === "success";

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  // A generated file downloads once, when the job succeeds.
  useEffect(() => {
    if (state.status === "success" && state.download) save(state.download);
  }, [state]);

  const errors = state.errors ?? {};

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={`${formId}-title`}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === dialogRef.current) dialogRef.current?.close();
      }}
      className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-2xl border border-line bg-surface p-0 shadow-xl backdrop:bg-black/50"
    >
      <form action={action} id={formId} className="flex max-h-[85dvh] flex-col">
        <input type="hidden" name="slug" value={slug} />
        <input type="hidden" name="processId" value={spec.id} />

        <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-4">
          <h2 id={`${formId}-title`} className="text-lg font-semibold text-ink">
            {spec.title}
          </h2>
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            aria-label="Close"
            className="rounded-lg p-1.5 text-muted hover:bg-canvas hover:text-ink focus-visible:outline-2 focus-visible:outline-brand"
          >
            <X size={18} aria-hidden />
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto px-6 py-5">
          {state.message && (
            <div
              role={done ? "status" : "alert"}
              className={done ? "rounded-lg bg-canvas px-3 py-2 text-sm text-ink" : "rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger"}
            >
              <p className="font-medium">{state.message}</p>
              {state.problems && state.problems.length > 0 && (
                <ul className="mt-1.5 list-disc space-y-0.5 pl-5">
                  {state.problems.map((p, i) => (
                    <li key={i}>{p}</li>
                  ))}
                </ul>
              )}
              {done && state.download && (
                <button type="button" onClick={() => save(state.download!)} className="mt-2 inline-flex items-center gap-1.5 font-medium underline">
                  <DownloadIcon size={14} aria-hidden /> Download again
                </button>
              )}
            </div>
          )}

          {!done && (
            <>
              {spec.intro && <p className="text-[15px] text-muted">{spec.intro}</p>}

              {spec.csv && (
                <div>
                  <label htmlFor={`${formId}-file`} className="mb-1 block text-sm font-medium text-ink">
                    CSV file <span aria-hidden className="text-danger">*</span>
                  </label>
                  <input id={`${formId}-file`} name="file" type="file" accept=".csv,text/csv" required className={`${inputClass} h-auto py-2`} />
                  <p className="mt-1 text-sm text-muted">Columns: {spec.csv.columns.join(", ")}.</p>
                  <button
                    type="button"
                    onClick={() => save({ filename: `${spec.id}-template.csv`, mime: "text/csv;charset=utf-8", content: toCsv([spec.csv!.columns, ...spec.csv!.sample]) })}
                    className="mt-1 text-sm font-medium text-brand underline"
                  >
                    Download a template
                  </button>
                </div>
              )}

              {spec.fields.map((f) => (
                <Field key={f.name} formId={formId} field={f} value={state.values?.[f.name] ?? f.defaultValue ?? ""} error={errors[f.name]} />
              ))}
            </>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-line px-6 py-4">
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            className="rounded-lg border border-line px-4 py-2 text-[15px] font-medium text-ink hover:bg-canvas focus-visible:outline-2 focus-visible:outline-brand"
          >
            {done || spec.blocked ? "Close" : "Cancel"}
          </button>
          {!done && !spec.blocked && (
            <button
              type="submit"
              disabled={pending}
              className="rounded-lg bg-brand px-4 py-2 text-[15px] font-semibold text-on-brand hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-60"
            >
              {pending ? "Working..." : spec.submitLabel}
            </button>
          )}
        </div>
      </form>
    </dialog>
  );
}
