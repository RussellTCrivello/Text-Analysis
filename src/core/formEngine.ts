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

export function createFormState(entity: EntityName, mode: FormMode, values: Record<string, unknown> = {}, defaults: Record<string, unknown> = {}): FormState {
  const initial = { ...defaults, ...values }
  return { mode, values: { ...initial }, initial, errors: {}, dirty: false, submitting: false }
}

export function setFormValue(state: FormState, field: string, value: unknown): FormState {
  return { ...state, values: { ...state.values, [field]: value }, dirty: state.initial[field] !== value || state.dirty }
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
