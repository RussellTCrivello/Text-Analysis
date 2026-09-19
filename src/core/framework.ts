/**
 * Internal Frappe-inspired metadata layer.
 *
 * This is deliberately framework-neutral: it describes how a DocType is
 * presented and operated on without coupling the application to Frappe.
 * Forms, lists, filters, exports and reports can all consume the same metadata.
 */
import { ENTITY_ORDER, entitySpec, fieldsOf, type EntityName, type FieldKind, type FieldSpec } from "./schema"

export type ViewSurface = "list" | "form" | "filter" | "export"

export interface FieldMetadata {
  key: string
  label: string
  kind: FieldKind
  required: boolean
  searchable: boolean
  sortable: boolean
  list: boolean
  form: boolean
  filter: boolean
  export: boolean
  relation?: { entity: EntityName; labelField: string }
}

export interface DocTypeMetadata {
  name: EntityName
  titleField: string
  fields: FieldMetadata[]
  defaults: { list: string[]; form: string[]; filter: string[]; export: string[] }
}

const labelFor = (field: FieldSpec) => field.labelKey.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())

export function docTypeMetadata(entity: EntityName): DocTypeMetadata {
  const spec = entitySpec(entity)
  const fields = fieldsOf(entity).map((field) => ({
    key: field.key,
    label: labelFor(field),
    kind: field.kind,
    required: Boolean(field.required),
    searchable: Boolean(field.searchable),
    sortable: field.kind !== "textarea",
    list: Boolean(field.exportDefault || field.kind === "id"),
    form: !field.system && field.kind !== "id",
    filter: field.kind !== "textarea",
    export: field.exportDefault !== false,
    relation: field.ref,
  }))
  return {
    name: entity,
    titleField: spec.titleField,
    fields,
    defaults: {
      list: fields.filter((f) => f.list).map((f) => f.key),
      form: fields.filter((f) => f.form).map((f) => f.key),
      filter: fields.filter((f) => f.filter).map((f) => f.key),
      export: fields.filter((f) => f.export).map((f) => f.key),
    },
  }
}

export function allDocTypes(): DocTypeMetadata[] {
  return ENTITY_ORDER.map(docTypeMetadata)
}

/** Detects incomplete metadata before a newly added schema field reaches UI. */
export function validateDocTypeMetadata(entity: EntityName): string[] {
  const problems: string[] = []
  const metadata = docTypeMetadata(entity)
  for (const field of metadata.fields) {
    if (!field.key) problems.push(`${entity}: field has no key`)
    if (!field.label) problems.push(`${entity}.${field.key}: field has no label`)
    if (field.relation && !field.relation.entity) problems.push(`${entity}.${field.key}: invalid relation`)
  }
  return problems
}

export function validateAllDocTypes(): string[] {
  return ENTITY_ORDER.flatMap(validateDocTypeMetadata)
}

/** Resolves a stored value for presentation while preserving the stored ID. */
export function displayValue(value: unknown, field: FieldMetadata, related?: Record<string, unknown>): string {
  if (value == null || value === "") return "—"
  if (field.relation && related) return String(related[field.relation.labelField] ?? value)
  return String(value)
}
