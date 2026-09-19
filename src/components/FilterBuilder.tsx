import React, { useMemo, useState } from "react"
import { Btn, Input, Select } from "./ui"
import { filterFields, type FilterCondition, type FilterGroup, validateFilter } from "../core/filterBuilder"
import type { EntityName } from "../core/schema"

const operators = [
  { value: "contains", label: "Contains" },
  { value: "equals", label: "Equals" },
  { value: "notEquals", label: "Does not equal" },
  { value: "startsWith", label: "Starts with" },
  { value: "isEmpty", label: "Is empty" },
  { value: "isNotEmpty", label: "Is not empty" },
  { value: "greaterThan", label: "Greater than" },
  { value: "lessThan", label: "Less than" },
]

export function FilterBuilder({ entity, onApply, onClear }: { entity: EntityName; onApply: (groups: FilterGroup[]) => void; onClear?: () => void }) {
  const fields = useMemo(() => filterFields(entity).map((field) => ({ value: field.key, label: field.label })), [entity])
  const [groups, setGroups] = useState<FilterGroup[]>([{ logic: "and", conditions: [{ field: fields[0]?.value ?? "", operator: "contains", value: "" }] }])
  const update = (groupIndex: number, conditionIndex: number, patch: Partial<FilterCondition>) => setGroups((current) => current.map((group, gi) => gi !== groupIndex ? group : { ...group, conditions: group.conditions.map((condition, ci) => ci !== conditionIndex ? condition : { ...condition, ...patch }) }))
  const apply = () => {
    const errors = groups.flatMap((group) => group.conditions.map((condition) => validateFilter(entity, condition))).filter(Boolean)
    if (errors.length) return
    onApply(groups)
  }
  return <div className="flex flex-col gap-2 rounded p-2" style={{ border: "1px solid var(--border)", background: "var(--surface-2)" }}>
    {groups.map((group, gi) => <div key={gi} className="flex flex-col gap-1">
      {gi > 0 && <Select value={group.logic} onChange={(event) => setGroups((current) => current.map((item, index) => index === gi ? { ...item, logic: event.target.value as "and" | "or" } : item))} options={[{ value: "and", label: "AND" }, { value: "or", label: "OR" }]} className="w-20" />}
      {group.conditions.map((condition, ci) => <div key={ci} className="flex flex-wrap items-center gap-1">
        <Select value={condition.field} onChange={(event) => update(gi, ci, { field: event.target.value })} options={fields} className="min-w-32" />
        <Select value={condition.operator} onChange={(event) => update(gi, ci, { operator: event.target.value as FilterCondition["operator"] })} options={operators} className="min-w-32" />
        {!(["isEmpty", "isNotEmpty"] as string[]).includes(condition.operator) && <Input value={condition.value ?? ""} onChange={(event) => update(gi, ci, { value: event.target.value })} placeholder="Value" className="min-w-32" />}
        <Btn size="xs" variant="ghost" onClick={() => setGroups((current) => current.map((item, index) => index === gi ? { ...item, conditions: item.conditions.filter((_, index) => index !== ci) } : item))}>Remove</Btn>
      </div>)}
      <Btn size="xs" variant="ghost" onClick={() => setGroups((current) => current.map((item, index) => index === gi ? { ...item, conditions: [...item.conditions, { field: fields[0]?.value ?? "", operator: "contains", value: "" }] } : item))}>Add condition</Btn>
    </div>)}
    <div className="flex gap-2"><Btn size="xs" onClick={() => setGroups((current) => [...current, { logic: "and", conditions: [{ field: fields[0]?.value ?? "", operator: "contains", value: "" }] }])}>Add group</Btn><Btn size="xs" variant="primary" onClick={apply}>Apply filters</Btn>{onClear && <Btn size="xs" variant="ghost" onClick={onClear}>Clear</Btn>}</div>
  </div>
}
