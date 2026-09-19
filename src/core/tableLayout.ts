import type { EntityName } from "./schema"
import { docTypeMetadata } from "./framework"

export type TableLayout = {
  entity: EntityName
  order: string[]
  hidden: string[]
  widths: Record<string, number>
  pinned: string[]
  density: "compact" | "comfortable" | "expansive"
  sort: Array<{ key: string; dir: "asc" | "desc" }>
  filters: Record<string, string>
  profiles?: Record<string, unknown>
}

export function defaultTableLayout(entity: EntityName): TableLayout {
  const meta = docTypeMetadata(entity)
  return {
    entity,
    order: meta.fields.map((field) => field.key),
    hidden: meta.fields.filter((field) => !field.list).map((field) => field.key),
    widths: {},
    pinned: [],
    density: "comfortable",
    sort: [],
    filters: {},
  }
}

/** Repairs layouts after schema changes without discarding user choices. */
export function normalizeTableLayout(entity: EntityName, input?: Partial<TableLayout>): TableLayout {
  const defaults = defaultTableLayout(entity)
  const known = new Set(defaults.order)
  const order = [...(input?.order ?? []), ...defaults.order].filter((field, index, all) => known.has(field) && all.indexOf(field) === index)
  const hidden = (input?.hidden ?? defaults.hidden).filter((field) => known.has(field))
  const pinned = (input?.pinned ?? []).filter((field) => known.has(field) && !hidden.includes(field))
  const widths = Object.fromEntries(Object.entries(input?.widths ?? {}).filter(([field, width]) => known.has(field) && Number.isFinite(width) && width >= 72))
  const sort = (input?.sort ?? []).filter((item) => known.has(item.key))
  const filters = Object.fromEntries(Object.entries(input?.filters ?? {}).filter(([field]) => known.has(field)))
  return { ...defaults, ...input, entity, order, hidden, pinned, widths, sort, filters }
}

export function resetTableLayout(entity: EntityName): TableLayout {
  return defaultTableLayout(entity)
}
