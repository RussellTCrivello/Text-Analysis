import { docTypeMetadata, type FieldMetadata } from "./framework"
import { fold, isBlank, toNumber } from "./text"
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
    case "equals": return fold(value) === fold(target)
    case "notEquals": return fold(value) !== fold(target)
    case "contains": return fold(value).includes(fold(target))
    case "startsWith": return fold(value).startsWith(fold(target))
    case "isEmpty": return isBlank(raw)
    case "isNotEmpty": return !isBlank(raw)
    case "greaterThan": return compareOrdered(value, target) > 0
    case "lessThan": return compareOrdered(value, target) < 0
  }
}

/** Numeric-aware ordering: numbers compare numerically, everything else
 *  falls back to numeric-aware string comparison (ISO dates order correctly). */
function compareOrdered(a: string, b: string): number {
  const na = toNumber(a)
  const nb = toNumber(b)
  if (na !== null && nb !== null) return na - nb
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" })
}

export function matchesFilter<T extends Record<string, unknown>>(row: T, group: FilterGroup): boolean {
  const results = group.conditions.map((condition) => compare(row[condition.field], condition))
  return group.logic === "or" ? results.some(Boolean) : results.every(Boolean)
}

export function applyFilterGroups<T extends Record<string, unknown>>(rows: T[], groups: FilterGroup[]): T[] {
  return groups.reduce((result, group) => result.filter((row) => matchesFilter(row, group)), rows)
}

export interface FilterValidationMessages {
  notFilterable?: (field: string) => string
  requiresValue?: () => string
}

/**
 * Optional localized message factory (the UI layer passes the active
 * locale's strings); the English literals are the framework-free fallback.
 */
export function validateFilter(
  entity: EntityName,
  condition: FilterCondition,
  messages: FilterValidationMessages = {},
): string | null {
  const field = filterFields(entity).find((item) => item.key === condition.field)
  if (!field) return messages.notFilterable ? messages.notFilterable(condition.field) : `Field ${condition.field} is not filterable`
  if (!["isEmpty", "isNotEmpty"].includes(condition.operator) && !String(condition.value ?? "").trim()) return messages.requiresValue ? messages.requiresValue() : "This operator requires a value"
  return null
}
