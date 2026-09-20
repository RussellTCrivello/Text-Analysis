import React from "react"
import { Field, Input, Textarea, DateTimeInput } from "./ui"
import { ComboField } from "./ComboField"
import type { FieldMetadata } from "../core/framework"
import type { VocabularyEntry } from "../core/vocabulary"

export interface MetadataFieldProps {
  field: FieldMetadata & { readOnly?: boolean }
  value: unknown
  onChange: (value: unknown) => void
  error?: string
  options?: VocabularyEntry[]
  relationshipOptions?: VocabularyEntry[]
}

/** The single field-control dispatch used by metadata-driven forms. */
export function MetadataField({ field, value, onChange, error, options = [], relationshipOptions = [] }: MetadataFieldProps) {
  const disabled = Boolean(field.readOnly)
  const label = field.label
  const common = { disabled, "aria-invalid": Boolean(error), "aria-describedby": error ? `${field.key}-error` : undefined }
  let control: React.ReactNode
  if (field.relation) {
    control = <ComboField id={`field-${field.key}`} value={String(value ?? "")} onChange={onChange as (value: string) => void} options={relationshipOptions} allowCreate={false} disabled={disabled} placeholder={`Search ${label}…`} error={Boolean(error)} />
  } else if (field.kind === "textarea" || field.kind === "list") {
    control = <Textarea {...common} value={String(value ?? "")} onChange={(event) => onChange(event.target.value)} />
  } else if (field.kind === "date") {
    control = <DateTimeInput value={String(value ?? "")} onChange={(next) => onChange(next)} />
  } else if (options.length) {
    control = <ComboField id={`field-${field.key}`} value={String(value ?? "")} onChange={onChange as (value: string) => void} options={options} disabled={disabled} />
  } else {
    control = <Input {...common} type={field.kind === "number" ? "number" : field.kind === "url" ? "url" : "text"} value={String(value ?? "")} onChange={(event) => onChange(event.target.value)} />
  }
  return <Field label={label} required={field.required} error={error}>{control}</Field>
}
