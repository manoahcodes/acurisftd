"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { askedFields, resolveSpec } from "@/lib/forms/spec";
import { cn } from "@/lib/format";
import { submitRecord } from "@/server/actions/records";
import type { FieldDef, FormSpec, FormState, FormValues } from "@/types/forms";

export type RecordTarget = {
  mode: "create" | "edit";
  /** Edit: the row's key and its current values, to pre-fill. */
  rowKey?: string;
  values?: FormValues;
  /** Edit in an all-divisions table: the division the row belongs to. */
  divisionId?: string;
};

export const inputClass =
  "h-11 w-full rounded-lg border border-line bg-surface px-3 text-[15px] text-ink placeholder:text-muted focus-visible:outline-2 focus-visible:outline-brand disabled:bg-canvas disabled:text-muted aria-[invalid=true]:border-danger";

const IDLE: FormState = { status: "idle" };

/** Modal form for creating or editing one record. Mount it to open, unmount to close. */
export function RecordForm({
  slug,
  spec: baseSpec,
  target,
  onClose,
}: {
  slug: string;
  spec: FormSpec;
  target: RecordTarget;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [state, action, pending] = useActionState(submitRecord, IDLE);
  const [divisionId, setDivisionId] = useState(target.divisionId ?? baseSpec.divisionChoices?.[0]?.id ?? "");

  const spec = resolveSpec(baseSpec, divisionId);
  const editing = target.mode === "edit";
  const fields = askedFields(spec, target.mode);
  const autoFields = spec.fields.filter((f) => f.auto);
  const locked = editing ? spec.fields.filter((f) => f.lockedOnEdit && !f.auto) : [];
  const formId = `rf-${spec.id}`;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || dialog.open) return;
    dialog.showModal();
  }, []);

  useEffect(() => {
    if (state.status === "success") onClose();
  }, [state, onClose]);

  const errors = state.errors ?? {};
  const initial = (f: FieldDef): string | string[] => {
    const submitted = state.values?.[f.name];
    if (submitted !== undefined) return submitted;
    if (editing) return target.values?.[f.name] ?? "";
    return f.type === "multiselect" ? [] : (f.defaultValue ?? "");
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={`${formId}-title`}
      onClose={onClose}
      onClick={(e) => {
        // A click on the backdrop (outside the panel) closes it.
        if (e.target === dialogRef.current) dialogRef.current?.close();
      }}
      className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-2xl border border-line bg-surface p-0 shadow-xl backdrop:bg-black/50"
    >
      <form action={action} id={formId} className="flex max-h-[85dvh] flex-col">
        <input type="hidden" name="slug" value={slug} />
        <input type="hidden" name="formId" value={spec.id} />
        <input type="hidden" name="mode" value={target.mode} />
        {editing && <input type="hidden" name="rowKey" value={target.rowKey ?? ""} />}

        <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-4">
          <div className="min-w-0">
            <h2 id={`${formId}-title`} className="text-lg font-semibold text-ink">
              {editing ? `Edit ${spec.title}` : `Add ${spec.title}`}
            </h2>
            {editing && target.rowKey && (
              <p className="mt-0.5 truncate text-sm text-muted" title={target.rowKey}>
                {target.rowKey}
              </p>
            )}
          </div>
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
          {state.status === "error" && state.message && (
            <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
              {state.message}
            </p>
          )}

          {baseSpec.divisionChoices && baseSpec.divisionChoices.length > 0 && (
            <div>
              <label htmlFor={`${formId}-division`} className="mb-1 block text-sm font-medium text-ink">
                Division
              </label>
              {editing ? (
                <>
                  <input type="hidden" name="division" value={divisionId} />
                  <input
                    id={`${formId}-division`}
                    disabled
                    value={baseSpec.divisionChoices.find((d) => d.id === divisionId)?.name ?? ""}
                    className={inputClass}
                  />
                </>
              ) : (
                <select
                  id={`${formId}-division`}
                  name="division"
                  value={divisionId}
                  onChange={(e) => setDivisionId(e.target.value)}
                  aria-invalid={Boolean(errors.division)}
                  className={inputClass}
                >
                  {baseSpec.divisionChoices.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              )}
              {errors.division && <p className="mt-1 text-sm text-danger">{errors.division}</p>}
            </div>
          )}

          {!editing &&
            autoFields.map((f) => (
              <div key={f.name}>
                <span className="mb-1 block text-sm font-medium text-ink">{f.label}</span>
                <p className="text-sm text-muted">Generated when you save.</p>
              </div>
            ))}

          {locked.map((f) => (
            <div key={f.name}>
              <span className="mb-1 block text-sm font-medium text-ink">{f.label}</span>
              <p className="text-[15px] text-muted">{String(target.values?.[f.name] ?? "")}</p>
            </div>
          ))}

          {fields.map((f) => (
            <Field key={`${divisionId}-${f.name}`} formId={formId} field={f} value={initial(f)} error={errors[f.name]} />
          ))}
        </div>

        <div className="flex justify-end gap-2 border-t border-line px-6 py-4">
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            className="rounded-lg border border-line px-4 py-2 text-[15px] font-medium text-ink hover:bg-canvas focus-visible:outline-2 focus-visible:outline-brand"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-brand px-4 py-2 text-[15px] font-semibold text-on-brand hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-60"
          >
            {pending ? "Saving..." : spec.submitLabel}
          </button>
        </div>
      </form>
    </dialog>
  );
}

export function Field({
  formId,
  field,
  value,
  error,
}: {
  formId: string;
  field: FieldDef;
  value: string | string[];
  error?: string;
}) {
  const id = `${formId}-${field.name}`;
  const common = {
    id,
    name: field.name,
    "aria-invalid": Boolean(error),
    "aria-describedby": error ? `${id}-error` : field.help ? `${id}-help` : undefined,
  };

  let control: React.ReactNode;
  switch (field.type) {
    case "select":
      control = (
        <select {...common} defaultValue={String(value)} className={inputClass}>
          <option value="">Choose...</option>
          {field.options?.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      );
      break;
    case "multiselect":
      control = (
        <fieldset aria-describedby={common["aria-describedby"]} className="space-y-1.5">
          {field.options?.map((o) => (
            <label key={o} className="flex items-center gap-2 text-[15px] text-ink">
              <input
                type="checkbox"
                name={field.name}
                value={o}
                defaultChecked={Array.isArray(value) && value.includes(o)}
                className="size-4 accent-[var(--color-brand)]"
              />
              {o}
            </label>
          ))}
        </fieldset>
      );
      break;
    case "textarea":
      control = (
        <textarea {...common} defaultValue={String(value)} rows={3} maxLength={field.maxLength} className={cn(inputClass, "h-auto py-2")} />
      );
      break;
    default: {
      const numeric = field.type === "number" || field.type === "money";
      control = (
        <input
          {...common}
          type={numeric ? "text" : field.type}
          inputMode={numeric ? (field.type === "money" ? "decimal" : "numeric") : undefined}
          defaultValue={String(value)}
          placeholder={field.placeholder}
          maxLength={field.maxLength}
          autoComplete="off"
          className={inputClass}
        />
      );
    }
  }

  return (
    <div>
      {field.type === "multiselect" ? (
        <p className="mb-1 text-sm font-medium text-ink">{field.label}</p>
      ) : (
        <label htmlFor={id} className="mb-1 block text-sm font-medium text-ink">
          {field.label}
          {field.required && <span aria-hidden className="text-danger"> *</span>}
        </label>
      )}
      {control}
      {field.help && !error && (
        <p id={`${id}-help`} className="mt-1 text-sm text-muted">
          {field.help}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="mt-1 text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
