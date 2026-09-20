import { docTypeMetadata, type FieldMetadata } from "./framework"
import type { EntityName } from "./schema"

export type FilterOperator = "equals" | "notEquals" | "contains" | "startsWith" | "isEmpty" | "isNotEmpty" | "greaterThan" | "lessThan"
export type FilterCondition = { field: string; operator: FilterOperator; value?: string }
export type FilterGroup = { logic: "and" | "or"; conditions: FilterCondition[] }

export function filterFields(entity: EntityName): FieldMetadata[] {
  return docTypeMetadata(entity).fields.filter((field) => field.filter)
}

const compare = (raw: unknown, condition: FilterCondition): boolean => {
  const value = String(raw ?? "")
  const target = String(condition.value ?? "")
  switch (condition.operator) {
    case "equals": return value.toLowerCase() === target.toLowerCase()
    case "notEquals": return value.toLowerCase() !== target.toLowerCase()
    case "contains": return value.toLowerCase().includes(target.toLowerCase())
    case "startsWith": return value.toLowerCase().startsWith(target.toLowerCase())
    case "isEmpty": return value.trim() === ""
    case "isNotEmpty": return value.trim() !== ""
    case "greaterThan": return value.localeCompare(target, undefined, { numeric: true }) > 0
    case "lessThan": return value.localeCompare(target, undefined, { numeric: true }) < 0
  }
}

export function matchesFilter<T extends Record<string, unknown>>(row: T, group: FilterGroup): boolean {
  const results = group.conditions.map((condition) => compare(row[condition.field], condition))
  return group.logic === "or" ? results.some(Boolean) : results.every(Boolean)
}

export function applyFilterGroups<T extends Record<string, unknown>>(rows: T[], groups: FilterGroup[]): T[] {
  return groups.reduce((result, group) => result.filter((row) => matchesFilter(row, group)), rows)
}

export function validateFilter(entity: EntityName, condition: FilterCondition): string | null {
  const field = filterFields(entity).find((item) => item.key === condition.field)
  if (!field) return `Field ${condition.field} is not filterable`
  if (!["isEmpty", "isNotEmpty"].includes(condition.operator) && !String(condition.value ?? "").trim()) return "This operator requires a value"
  return null
}
