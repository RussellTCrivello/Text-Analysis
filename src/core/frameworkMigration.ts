import { docTypeMetadata, type EntityName } from "./framework"
import { normalizeTableLayout, type TableLayout } from "./tableLayout"

export type LegacyTablePreferences = {
  visible?: string[]
  hidden?: string[]
  widths?: Record<string, number>
  order?: string[]
  density?: TableLayout["density"]
  sort?: Array<{ key: string; dir: "asc" | "desc" }>
}

/** Converts old table preferences without losing user layout choices. */
export function migrateTablePreferences(entity: EntityName, legacy?: LegacyTablePreferences): TableLayout {
  const metadata = docTypeMetadata(entity)
  const visible = new Set(legacy?.visible ?? [])
  const hidden = legacy?.hidden ?? metadata.fields.filter((field) => !field.list).map((field) => field.key)
  return normalizeTableLayout(entity, {
    ...legacy,
    order: legacy?.order ?? [...visible, ...metadata.fields.map((field) => field.key)],
    hidden: hidden.filter((field) => !visible.has(field)),
  })
}

/** Reports duplicate view configuration that should be removed during migration. */
export function findLegacyColumns(entity: EntityName, configuredKeys: string[]): string[] {
  const known = new Set(docTypeMetadata(entity).fields.map((field) => field.key))
  return configuredKeys.filter((key) => known.has(key))
}

/** Ensures a legacy payload cannot introduce unknown fields into the framework. */
export function sanitizeImportedFields(entity: EntityName, payload: Record<string, unknown>): Record<string, unknown> {
  const known = new Set(docTypeMetadata(entity).fields.map((field) => field.key))
  return Object.fromEntries(Object.entries(payload).filter(([key]) => known.has(key)))
}
