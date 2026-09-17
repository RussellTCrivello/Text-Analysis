/**
 * Bulk operations: multi-select delete and schema-driven bulk edit. Every
 * operation runs through the Repository, so validation, audit entries and undo
 * history apply exactly as they do for single-record writes.
 */
import React, { useEffect, useMemo, useState } from "react"
import { InfoModal } from "./FormModal"
import { Btn, Field, Input, Select, Textarea, EmptyState } from "./ui"
import { Check, CircleXIcon, Close, Pencil, Trash } from "./icons"
import { useTranslation } from "../i18n"
import { useAppData } from "../store/AppContext"
import { editableFields, type EntityName, type FieldSpec } from "../core/schema"
import { hasErrors, type ValidationIssue } from "../core/validation"

interface BulkOperationsProps {
  isOpen: boolean
  onClose: () => void
  selectedIds: string[]
  data: { id: string; label: string }[]
  /** Entity these ids belong to; enables schema-driven bulk edit. */
  entity?: EntityName
  onBulkDelete: (ids: string[]) => void
  onToast?: (message: string) => void
}

type Mode = "delete" | "edit"

export function BulkOperations({
  isOpen,
  onClose,
  selectedIds,
  data,
  entity = "sources",
  onBulkDelete,
  onToast,
}: BulkOperationsProps) {
  const { t } = useTranslation()
  const { bulkUpdate, validate, data: appData } = useAppData()

  const [mode, setMode] = useState<Mode>("delete")
  const [checked, setChecked] = useState<Set<string>>(new Set(selectedIds))
  const [fieldKey, setFieldKey] = useState("")
  const [value, setValue] = useState("")
  const [issues, setIssues] = useState<ValidationIssue[]>([])
  const [done, setDone] = useState<{ count: number; message: string } | null>(
    null,
  )

  useEffect(() => {
    if (isOpen) {
      setChecked(new Set(selectedIds))
      setDone(null)
      setIssues([])
      setMode("delete")
    }
  }, [isOpen, selectedIds])

  const fields = useMemo(() => editableFields(entity), [entity])
  const field = fields.find((f) => f.key === fieldKey)

  useEffect(() => {
    if (!fieldKey && fields.length) setFieldKey(fields[0].key)
  }, [fieldKey, fields])

  const toggle = (id: string) =>
    setChecked((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const patch = useMemo(() => {
    if (!field) return {}
    const raw: Record<string, unknown> = { [field.key]: value }
    if (field.kind === "number" && field.format === "percent") {
      const n = Number(value)
      if (!Number.isNaN(n)) raw[field.key] = n > 1 ? n / 100 : n
    } else if (field.kind === "number") {
      const n = Number(value)
      if (!Number.isNaN(n)) raw[field.key] = n
    }
    return raw
  }, [field, value])

  const previewIssues = useMemo(() => {
    if (mode !== "edit" || !field || !checked.size) return []
    const sample = data.find((d) => checked.has(d.id))
    if (!sample) return []
    return validate(entity, { id: sample.id, ...patch })
  }, [mode, field, value, checked, data, entity, validate, patch])

  const execute = () => {
    if (!checked.size) return
    if (mode === "delete") {
      if (
        !window.confirm(
          t.dialogs.bulkOps.confirmDelete.replace("{n}", String(checked.size)),
        )
      )
        return
      onBulkDelete([...checked])
      setDone({
        count: checked.size,
        message: t.dialogs.bulkOps.done.replace("{n}", String(checked.size)),
      })
      return
    }
    const blocking = previewIssues.filter((i) => i.level === "error")
    if (blocking.length) {
      setIssues(blocking)
      return
    }
    const result = bulkUpdate(entity, [...checked], patch)
    if (!result.ok) {
      setIssues(result.issues)
      return
    }
    const warnings = result.issues.filter((i) => i.level === "warning")
    if (warnings.length)
      onToast?.(`${warnings.length} warning(s) during bulk update`)
    setIssues([])
    setDone({
      count: checked.size,
      message: `${checked.size} record(s) updated · ${field?.labelKey ?? fieldKey}`,
    })
  }

  const reset = () => {
    setDone(null)
    setChecked(new Set(selectedIds))
    setIssues([])
    onClose()
  }

  const renderInput = (f: FieldSpec | undefined) => {
    if (!f) return null
    if (f.kind === "textarea")
      return (
        <Textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          rows={3}
        />
      )
    if (f.kind === "date")
      return (
        <Input
          type="date"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
      )
    if (f.kind === "number")
      return (
        <Input
          type="number"
          step={f.format === "percent" ? "0.1" : "1"}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={f.format === "percent" ? "percent, e.g. 75" : ""}
        />
      )
    if (f.kind === "ref") {
      const target = f.ref?.entity
      const options =
        target === "sources"
          ? appData.sources.map((r) => ({ value: r.id, label: r.name }))
          : target === "contents"
            ? appData.contents.map((r) => ({ value: r.id, label: r.title }))
            : []
      return (
        <Select
          value={value}
          onChange={(e) => setValue(e.target.value)}
          options={options}
          placeholder="Select…"
        />
      )
    }
    return <Input value={value} onChange={(e) => setValue(e.target.value)} />
  }

  return (
    <InfoModal
      isOpen={isOpen}
      title={t.dialogs.bulkOps.title}
      onClose={reset}
      size="md"
    >
      <div className="flex flex-col gap-4" style={{ minHeight: 320 }}>
        <div className="flex gap-2">
          {(["delete", "edit"] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => {
                setMode(m)
                setIssues([])
                setDone(null)
              }}
              aria-pressed={mode === m}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius)] text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
              style={{
                background:
                  mode === m
                    ? m === "delete"
                      ? "var(--error)"
                      : "var(--primary)"
                    : "var(--surface-2)",
                color: mode === m ? "var(--primary-fg)" : "var(--fg-soft)",
                border: `1px solid ${
                  mode === m
                    ? m === "delete"
                      ? "var(--error)"
                      : "var(--primary)"
                    : "var(--border)"
                }`,
              }}
            >
              {m === "delete" ? <Trash size="xs" /> : <Pencil size="xs" />}
              {m === "delete"
                ? t.dialogs.bulkOps.modeDelete
                : t.dialogs.bulkOps.modeEdit}
            </button>
          ))}
        </div>

        {!done ? (
          <>
            <p className="text-xs" style={{ color: "var(--muted-fg)" }}>
              {t.dialogs.bulkOps.selectedCount.replace(
                "{n}",
                String(checked.size),
              )}
            </p>
            <div
              className="border rounded overflow-y-auto"
              style={{ borderColor: "var(--border)", maxHeight: 200 }}
            >
              {data.map((item) => (
                <label
                  key={item.id}
                  className="flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-[var(--secondary-bg)]"
                >
                  <input
                    type="checkbox"
                    checked={checked.has(item.id)}
                    onChange={() => toggle(item.id)}
                  />
                  <span className="text-xs truncate">{item.label}</span>
                </label>
              ))}
            </div>

            {mode === "edit" && (
              <div
                className="rounded-lg p-3 flex flex-col gap-2"
                style={{ background: "var(--secondary-bg)" }}
              >
                <Field label="Field to set">
                  <Select
                    value={fieldKey}
                    onChange={(e) => {
                      setFieldKey(e.target.value)
                      setValue("")
                    }}
                    options={fields.map((f) => ({
                      value: f.key,
                      label:
                        (t.fields as Record<string, string>)[f.labelKey] ??
                        f.labelKey,
                    }))}
                  />
                </Field>
                <Field
                  label="New value"
                  hint={
                    field?.format === "percent"
                      ? "Enter a percentage; stored as a 0–1 fraction"
                      : undefined
                  }
                  error={issues.find((i) => i.field === fieldKey)?.message}
                >
                  {renderInput(field)}
                </Field>
                {previewIssues.length > 0 && (
                  <div className="text-[11px]" style={{ color: "#b45309" }}>
                    {previewIssues
                      .map((i) => `${i.level}: ${i.message}`)
                      .join(" · ")}
                  </div>
                )}
                <div
                  className="text-[11px]"
                  style={{ color: "var(--muted-fg)" }}
                >
                  Applies to {checked.size} record(s). Every change is audited
                  and can be undone.
                </div>
              </div>
            )}

            {issues.length > 0 && (
              <div
                className="text-xs rounded p-2"
                style={{ background: "#fef2f2", color: "#b91c1c" }}
              >
                {issues.map((i) => (
                  <div
                    key={`${i.field}-${i.code}`}
                    className="inline-flex items-center gap-1.5"
                  >
                    <CircleXIcon size="xs" /> {i.message}
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center gap-2 justify-between">
              <div className="flex items-center gap-2">
                <Btn
                  size="xs"
                  onClick={() => setChecked(new Set(data.map((d) => d.id)))}
                >
                  {t.actions.selectAll}
                </Btn>
                <Btn
                  size="xs"
                  onClick={() => setChecked(new Set())}
                  icon={<Close size="xs" />}
                >
                  {t.actions.clearSelection}
                </Btn>
              </div>
              <Btn
                variant={mode === "delete" ? "danger" : "primary"}
                onClick={execute}
                disabled={
                  checked.size === 0 ||
                  (mode === "edit" && (!field || !value.trim()))
                }
              >
                {mode === "delete"
                  ? `Delete ${checked.size} records`
                  : `Update ${checked.size} records`}
              </Btn>
            </div>
          </>
        ) : (
          <EmptyState
            variant="success"
            title={done.message}
            action={
              <Btn variant="primary" onClick={reset} icon={<Check size="sm" />}>
                {t.actions.close}
              </Btn>
            }
          />
        )}
      </div>
    </InfoModal>
  )
}