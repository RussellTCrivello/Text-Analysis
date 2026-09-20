import React, { useMemo, useState } from "react"
import { Btn, Input, Select } from "./ui"
import { ErrorIcon } from "./icons"
import { useTranslation } from "../i18n"
import { filterFields, type FilterCondition, type FilterGroup, validateFilter } from "../core/filterBuilder"
import type { EntityName } from "../core/schema"

export function FilterBuilder({
  entity,
  onApply,
  onClear,
}: {
  entity: EntityName
  onApply: (groups: FilterGroup[]) => void
  onClear?: () => void
}) {
  const { t } = useTranslation()
  const fields = useMemo(
    // Active-locale field names; the framework metadata label is the
    // English fallback for keys missing from the dictionary.
    () =>
      filterFields(entity).map((field) => ({
        value: field.key,
        label: (t.fields as Record<string, string>)[field.key] ?? field.label,
      })),
    [entity, t],
  )
  const operators = [
    { value: "contains", label: t.messages.fbContains },
    { value: "equals", label: t.messages.fbEquals },
    { value: "notEquals", label: t.messages.fbNotEquals },
    { value: "startsWith", label: t.messages.fbStartsWith },
    { value: "isEmpty", label: t.messages.fbIsEmpty },
    { value: "isNotEmpty", label: t.messages.fbIsNotEmpty },
    { value: "greaterThan", label: t.messages.fbGreaterThan },
    { value: "lessThan", label: t.messages.fbLessThan },
  ]
  const [groups, setGroups] = useState<FilterGroup[]>([
    {
      logic: "and",
      conditions: [
        { field: fields[0]?.value ?? "", operator: "contains", value: "" },
      ],
    },
  ])
  const [invalid, setInvalid] = useState<boolean[][]>([])

  const update = (
    groupIndex: number,
    conditionIndex: number,
    patch: Partial<FilterCondition>,
  ) => {
    setGroups((current) =>
      current.map((group, gi) =>
        gi !== groupIndex
          ? group
          : {
              ...group,
              conditions: group.conditions.map((condition, ci) =>
                ci !== conditionIndex ? condition : { ...condition, ...patch },
              ),
            },
      ),
    )
    // Editing a row clears its stale validation marker.
    setInvalid((prev) =>
      prev.map((row, gi) =>
        gi === groupIndex
          ? row.map((v, ci) => (ci === conditionIndex ? false : v))
          : row,
      ),
    )
  }

  const apply = () => {
    // Show the offending rows inline instead of failing silently.
    const bad = groups.map((group) =>
      group.conditions.map((condition) =>
        validateFilter(entity, condition, {
          notFilterable: (f) =>
            t.messages.fbNotFilterable.replace("{f}", f),
          requiresValue: () => t.messages.fbRequiresValue,
        }) !== null,
      ),
    )
    setInvalid(bad)
    if (bad.flat().some(Boolean)) return
    onApply(groups)
  }

  return (
    <div
      className="flex flex-col gap-2 rounded p-2"
      style={{ border: "1px solid var(--border)", background: "var(--surface-2)" }}
    >
      {groups.map((group, gi) => (
        <div key={gi} className="flex flex-col gap-1">
          {gi > 0 && (
            <Select
              value={group.logic}
              onChange={(event) =>
                setGroups((current) =>
                  current.map((item, index) =>
                    index === gi
                      ? { ...item, logic: event.target.value as "and" | "or" }
                      : item,
                  ),
                )
              }
              options={[
                { value: "and", label: "AND" },
                { value: "or", label: "OR" },
              ]}
              className="w-20"
            />
          )}
          {group.conditions.map((condition, ci) => (
            <div key={ci} className="flex flex-wrap items-center gap-1">
              <Select
                value={condition.field}
                onChange={(event) => update(gi, ci, { field: event.target.value })}
                options={fields}
                className="min-w-32"
              />
              <Select
                value={condition.operator}
                onChange={(event) =>
                  update(gi, ci, { operator: event.target.value as FilterCondition["operator"] })
                }
                options={operators}
                className="min-w-32"
              />
              {!(["isEmpty", "isNotEmpty"] as string[]).includes(condition.operator) && (
                <Input
                  value={condition.value ?? ""}
                  onChange={(event) => update(gi, ci, { value: event.target.value })}
                  placeholder={t.messages.fbValue}
                  className="min-w-32"
                />
              )}
              <Btn
                size="xs"
                variant="ghost"
                onClick={() =>
                  setGroups((current) =>
                    current.map((item, index) =>
                      index === gi
                        ? {
                            ...item,
                            conditions: item.conditions.filter(
                              (_, index) => index !== ci,
                            ),
                          }
                        : item,
                    ),
                  )
                }
              >
                {t.messages.fbRemove}
              </Btn>
              {invalid[gi]?.[ci] && (
                <span
                  role="alert"
                  className="flex items-center gap-1 text-[11px] font-medium"
                  style={{ color: "var(--error)", width: "100%", paddingLeft: 8 }}
                >
                  <ErrorIcon size="xs" />
                  {validateFilter(entity, condition, {
                    notFilterable: (f) => t.messages.fbNotFilterable.replace("{f}", f),
                    requiresValue: () => t.messages.fbRequiresValue,
                  })}
                </span>
              )}
            </div>
          ))}
          <Btn
            size="xs"
            variant="ghost"
            onClick={() =>
              setGroups((current) =>
                current.map((item, index) =>
                  index === gi
                    ? {
                        ...item,
                        conditions: [
                          ...item.conditions,
                          { field: fields[0]?.value ?? "", operator: "contains", value: "" },
                        ],
                      }
                    : item,
                ),
              )
            }
          >
            {t.messages.fbAddCondition}
          </Btn>
        </div>
      ))}
      <div className="flex gap-2">
        <Btn
          size="xs"
          onClick={() =>
            setGroups((current) => [
              ...current,
              {
                logic: "and",
                conditions: [
                  { field: fields[0]?.value ?? "", operator: "contains", value: "" },
                ],
              },
            ])
          }
        >
          {t.messages.fbAddGroup}
        </Btn>
        <Btn size="xs" variant="primary" onClick={apply}>
          {t.messages.fbApply}
        </Btn>
        {onClear && (
          <Btn size="xs" variant="ghost" onClick={onClear}>
            {t.shared.clear}
          </Btn>
        )}
      </div>
    </div>
  )
}
