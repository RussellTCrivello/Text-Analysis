/**
 * ComboField — an expandable option picker.
 *
 * Unlike a fixed <select>, the option list belongs to the workspace: the user
 * can add a value while filling in a form, values already stored on records are
 * always offered, and user-added values that nothing references can be removed
 * again. Keyboard operable and RTL aware.
 */
import React, { useEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "../i18n"
import { ChevronD, Close, Plus } from "./icons"
import type { VocabularyEntry } from "../core/vocabulary"

export interface ComboFieldProps {
  value: string
  onChange: (value: string) => void
  options: VocabularyEntry[]
  /** Usage counts keyed by lower-cased value; shown as a hint per option. */
  usage?: Record<string, number>
  placeholder?: string
  error?: boolean
  allowCreate?: boolean
  createLabel?: (typed: string) => string
  onCreate?: (value: string) => void
  onRemove?: (value: string) => void
  disabled?: boolean
  id?: string
}

function fold(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ")
}

export function ComboField({
  value,
  onChange,
  options,
  usage = {},
  placeholder,
  error,
  allowCreate = true,
  createLabel,
  onCreate,
  onRemove,
  disabled,
  id,
}: ComboFieldProps) {
  const [open, setOpen] = useState(false)
  const { t } = useTranslation()
  const [typed, setTyped] = useState(value)
  const [active, setActive] = useState(0)
  const boxRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) setTyped(value)
  }, [value, open])

  useEffect(() => {
    if (!open) return
    const onDocDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node))
        setOpen(false)
    }
    document.addEventListener("mousedown", onDocDown)
    return () => document.removeEventListener("mousedown", onDocDown)
  }, [open])

  const query = fold(typed)
  const filtered = useMemo(
    () =>
      query
        ? options.filter(
            (o) =>
              fold(o.value).includes(query) ||
              fold(o.label ?? "").includes(query),
          )
        : options,
    [options, query],
  )
  const exactMatch = options.some((o) => fold(o.value) === query)
  const canCreate = allowCreate && typed.trim().length > 0 && !exactMatch

  const rows = useMemo(
    () => [
      ...filtered.map((entry) => ({ kind: "option" as const, entry })),
      ...(canCreate
        ? [
            {
              kind: "create" as const,
              entry: { value: typed.trim() } as VocabularyEntry,
            },
          ]
        : []),
    ],
    [filtered, canCreate, typed],
  )

  useEffect(() => {
    setActive(0)
  }, [query, open])

  const commit = (next: string) => {
    onChange(next)
    setTyped(next)
    setOpen(false)
    inputRef.current?.blur()
  }

  const pick = (index: number) => {
    const row = rows[index]
    if (!row) return
    if (row.kind === "create") {
      onCreate?.(row.entry.value)
      commit(row.entry.value)
      return
    }
    commit(row.entry.value)
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault()
      if (!open) setOpen(true)
      else setActive((a) => Math.min(rows.length - 1, a + 1))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setActive((a) => Math.max(0, a - 1))
    } else if (e.key === "Enter") {
      if (open && rows[active]) {
        e.preventDefault()
        pick(active)
      }
    } else if (e.key === "Escape") {
      setOpen(false)
      setTyped(value)
    } else if (e.key === "Tab") {
      setOpen(false)
    }
  }

  const borderColor = error
    ? "var(--error)"
    : open
      ? "var(--ring)"
      : "var(--border)"

  return (
    <div ref={boxRef} className="relative" style={{ minWidth: 0 }}>
      <div
        className="fgroup gap-1"
        style={{
          borderColor,
          background: "var(--surface)",
          boxShadow: error && !open ? "0 0 0 2px var(--error-soft)" : undefined,
        }}
      >
        <input
          id={id}
          ref={inputRef}
          role="combobox"
          aria-expanded={open}
          aria-controls={id ? `${id}-list` : undefined}
          aria-autocomplete="list"
          autoComplete="off"
          disabled={disabled}
          value={typed}
          placeholder={placeholder}
          onChange={(e) => {
            setTyped(e.target.value)
            onChange(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          className="w-full outline-none"
          style={{
            background: "transparent",
            color: "var(--fg)",
            fontFamily: "var(--font-body)",
            fontSize: "0.86rem",
            minWidth: 0,
          }}
        />
        <button
          type="button"
          tabIndex={-1}
          aria-label={open ? "Collapse options" : "Expand options"}
          disabled={disabled}
          onClick={() => {
            setOpen((o) => !o)
            inputRef.current?.focus()
          }}
          className="inline-flex h-full shrink-0 items-center rounded-e-[7px] px-1.5 transition-colors hover:bg-[var(--surface-3)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
          style={{ color: "var(--muted-fg)" }}
        >
          <ChevronD
            size="xs"
            style={{
              transform: open ? "rotate(180deg)" : "none",
              transition: "transform .12s",
            }}
          />
        </button>
      </div>

      {open && rows.length > 0 && (
        <ul
          id={id ? `${id}-list` : undefined}
          role="listbox"
          className="absolute z-30 mt-1 w-full overflow-y-auto"
          style={{
            background: "var(--card-bg)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius)",
            maxHeight: 240,
            boxShadow: "0 8px 24px rgba(15, 23, 42, 0.14)",
          }}
        >
          {rows.map((row, index) => {
            const isActive = index === active
            const isCreate = row.kind === "create"
            const count = usage[fold(row.entry.value)] ?? 0
            return (
              <li
                key={`${row.kind}:${row.entry.value}`}
                role="option"
                aria-selected={isActive}
                onMouseEnter={() => setActive(index)}
                onClick={() => pick(index)}
                className="flex items-center gap-2 px-2.5 py-1.5 text-[0.82rem] cursor-pointer"
                style={{
                  background: isActive ? "var(--secondary-bg)" : "transparent",
                  color: isCreate ? "var(--primary)" : "var(--fg)",
                }}
              >
                {isCreate && <Plus size="xs" />}
                <span className="truncate" style={{ flex: "1 1 auto" }}>
                  {isCreate
                    ? createLabel
                      ? createLabel(row.entry.value)
                      : `${t.actions.addNew} “${row.entry.value}”`
                    : (row.entry.label ?? row.entry.value)}
                </span>
                {!isCreate && row.entry.builtin && (
                  <span
                    className="text-[9px] uppercase tracking-wide shrink-0"
                    style={{ color: "var(--muted-fg)" }}
                  >
                    {t.sections.dictionary.builtIn}
                  </span>
                )}
                {!isCreate && count > 0 && (
                  <span
                    className="text-[10px] shrink-0"
                    style={{
                      color: "var(--muted-fg)",
                      fontFamily: "var(--font-mono)",
                    }}
                  >
                    {count}
                  </span>
                )}
                {!isCreate && !row.entry.builtin && onRemove && count === 0 && (
                  <button
                    type="button"
                    aria-label={`Remove ${row.entry.value}`}
                    title={`Remove ${row.entry.value}`}
                    className="w-5 h-5 shrink-0 inline-flex items-center justify-center rounded-[var(--radius-sm)] transition-colors hover:bg-[var(--error-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
                    style={{ color: "var(--error)" }}
                    onClick={(e) => {
                      e.stopPropagation()
                      onRemove(row.entry.value)
                      if (fold(value) === fold(row.entry.value)) onChange("")
                    }}
                  >
                    <Close size="xs" />
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {open && rows.length === 0 && (
        <div
          className="absolute z-30 mt-1 w-full rounded px-3 py-2 text-xs"
          style={{
            background: "var(--card-bg)",
            border: "1px solid var(--border)",
            color: "var(--muted-fg)",
          }}
        >
          {t.messages.noRecords}
        </div>
      )}
    </div>
  )
}

/** Lower-cased usage map helper for ComboField consumers. */
export function usageMap(
  rows: Record<string, unknown>[],
  field: string,
): Record<string, number> {
  const out: Record<string, number> = {}
  for (const row of rows) {
    const key = fold(String(row[field] ?? ""))
    if (!key) continue
    out[key] = (out[key] ?? 0) + 1
  }
  return out
}