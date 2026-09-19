import { docTypeMetadata, type FieldMetadata } from "./framework"
import type { EntityName } from "./schema"

export type FormMode = "create" | "edit" | "view"
export type FormLayout = { entity: EntityName; order: string[]; hidden: string[]; readOnly: string[] }
export type FormState = { mode: FormMode; values: Record<string, unknown>; initial: Record<string, unknown>; errors: Record<string, string>; dirty: boolean; submitting: boolean }

export function formFields(entity: EntityName, layout?: Partial<FormLayout>): FieldMetadata[] {
  const metadata = docTypeMetadata(entity).fields
  const hidden = new Set(layout?.hidden ?? [])
  const readOnly = new Set(layout?.readOnly ?? [])
  const order = layout?.order ?? metadata.map((field) => field.key)
  return [...metadata].filter((field) => field.form && !hidden.has(field.key)).sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key)).map((field) => ({ ...field, required: field.required, sortable: field.sortable, form: true, export: field.export, filter: field.filter, list: field.list, readOnly: readOnly.has(field.key) } as FieldMetadata & { readOnly: boolean }))
}

export function defaultFormLayout(entity: EntityName): FormLayout {
  return { entity, order: docTypeMetadata(entity).defaults.form, hidden: [], readOnly: [] }
}

/** Repairs persisted form presentation preferences after schema changes. */
export function normalizeFormLayout(entity: EntityName, input?: Partial<FormLayout>): FormLayout {
  const defaults = defaultFormLayout(entity)
  const known = new Set(docTypeMetadata(entity).fields.map((field) => field.key))
  const order = [...(input?.order ?? []), ...defaults.order].filter((key, index, all) => known.has(key) && all.indexOf(key) === index)
  return {
    entity,
    order,
    hidden: (input?.hidden ?? []).filter((key) => known.has(key)),
    readOnly: (input?.readOnly ?? []).filter((key) => known.has(key)),
  }
}

export function createFormState(entity: EntityName, mode: FormMode, values: Record<string, unknown> = {}, defaults: Record<string, unknown> = {}): FormState {
  const initial = { ...defaults, ...values }
  return { mode, values: { ...initial }, initial, errors: {}, dirty: false, submitting: false }
}

export function setFormValue(state: FormState, field: string, value: unknown): FormState {
  const values = { ...state.values, [field]: value }
  const keys = new Set([...Object.keys(state.initial), ...Object.keys(values)])
  const dirty = [...keys].some((key) => values[key] !== state.initial[key])
  return { ...state, values, dirty }
}

export function resetForm(state: FormState): FormState {
  return { ...state, values: { ...state.initial }, errors: {}, dirty: false, submitting: false }
}

export function validateForm(entity: EntityName, state: FormState): Record<string, string> {
  const errors: Record<string, string> = {}
  for (const field of formFields(entity)) {
    const value = state.values[field.key]
    if (field.required && (value == null || String(value).trim() === "")) errors[field.key] = "This field is required"
  }
  return errors
}
