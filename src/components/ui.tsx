import React, { type ReactNode, useState, useRef, useEffect, useId } from "react"
import { useTranslation } from "../i18n"
import {
  formatDateTime,
  fromDateTimeLocal,
  nowIso,
  toDateTimeLocal,
} from "../core/text"
import type { RecordType, Source, Content, Analysis } from "../types"
import {
  Check,
  ChevronD,
  ChevronL,
  ChevronR,
  ChevronU,
  ChevronsL,
  ChevronsR,
  Close,
  ErrorIcon,
  More,
  Pencil,
  Search,
  SearchNo,
  Spinner,
  Success,
  Trash,
  EmptyFile,
  Warning,
  InfoIcon,
  type AppIconProps,
  CalendarSmall,
  MinusSmall,
} from "./icons"

/* ============================================================================
   BUTTON
   The icon slot is rendered through `[&_svg]` size locks so an icon component
   arriving from ./icons always aligns with the label at the size appropriate
   for the button, regardless of the size prop it was passed.
   ========================================================================== */
interface BtnProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "success" | "subtle"
  size?: "xs" | "sm" | "md"
  icon?: ReactNode
  loading?: boolean
}

export function Btn({
  variant = "secondary",
  size = "sm",
  icon,
  loading,
  className = "",
  children,
  disabled,
  ...rest
}: BtnProps) {
  const base =
    "inline-flex items-center justify-center gap-1.5 font-medium transition-all duration-150 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed whitespace-nowrap select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-0 active:scale-[0.985] disabled:active:scale-100"
  const radii = {
    xs: "rounded-[var(--radius-sm)]",
    sm: "rounded-[var(--radius)]",
    md: "rounded-[var(--radius)]",
  }
  const sizes = {
    xs: "h-[26px] px-2 text-[0.72rem] tracking-wide [&_svg]:!size-3.5",
    sm: "h-[30px] px-3 text-[0.8rem] [&_svg]:!size-3.5",
    md: "h-[34px] px-4 text-[0.86rem] [&_svg]:!size-4",
  }
  const vars: Record<string, string> = {
    primary:
      "bg-[var(--primary)] text-[var(--primary-fg)] shadow-[0_1px_2px_rgba(15,23,42,0.22)] hover:brightness-[1.14] hover:shadow-[0_3px_12px_-5px_var(--primary)] active:brightness-95",
    secondary:
      "border border-[var(--border-strong)] bg-[var(--surface)] text-[var(--fg)] hover:bg-[var(--surface-2)] hover:border-[color-mix(in_srgb,var(--primary)_38%,var(--border-strong))] active:bg-[var(--surface-3)]",
    ghost:
      "text-[var(--fg-soft)] hover:bg-[var(--surface-3)] active:bg-[var(--surface-2)]",
    subtle:
      "bg-[var(--surface-2)] text-[var(--fg-soft)] border border-[var(--border)] hover:bg-[var(--surface-3)]",
    danger:
      "bg-[var(--error)] text-white hover:brightness-110 active:brightness-95 shadow-sm",
    success:
      "bg-[var(--success)] text-[var(--primary-fg)] hover:brightness-110 active:brightness-95 shadow-sm",
  }
  return (
    <button
      className={`${base} ${radii[size]} ${sizes[size]} ${vars[variant]} ${className}`}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? <Spinner size="xs" className="animate-spin-slow" /> : icon}
      {children}
    </button>
  )
}

/** Accessible icon-only button — label is mandatory, tooltip mirrors it. */
export function IconButton({
  label,
  onClick,
  children,
  danger,
  active,
  disabled,
  size = 28,
  className = "",
}: {
  label: string
  onClick?: (e: React.MouseEvent) => void
  children: ReactNode
  danger?: boolean
  active?: boolean
  disabled?: boolean
  size?: number
  className?: string
}) {
  const color = disabled
    ? "var(--muted-fg-2)"
    : danger
      ? "var(--error)"
      : active
        ? "var(--primary)"
        : "var(--muted-fg)"
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      type="button"
      className={`inline-flex items-center justify-center rounded-[var(--radius-sm)] transition-all duration-150 hover:bg-[var(--surface-3)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] ${className}`}
      style={{
        color,
        width: size,
        height: size,
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      {children}
    </button>
  )
}

/* ============================================================================
   FIELD + INPUTS
   ========================================================================== */
interface FieldProps {
  label: string
  required?: boolean
  hint?: string
  error?: string
  children: ReactNode
}

export function Field({ label, required, hint, error, children }: FieldProps) {
  return (
    <div className="flex flex-col gap-1">
      <label className="field-label">
        {label}
        {required && (
          <span
            className="ms-1 font-bold"
            style={{ color: "var(--error)" }}
            aria-hidden="true"
          >
            *
          </span>
        )}
      </label>
      {children}
      {hint && (
        <p
          className="text-[11px] leading-snug"
          style={{ color: "var(--muted-fg-2)" }}
        >
          {hint}
        </p>
      )}
      {error && (
        <p
          className="text-[11px] leading-snug font-medium flex items-center gap-1"
          style={{ color: "var(--error)" }}
          role="alert"
        >
          <ErrorIcon size="xs" />
          {error}
        </p>
      )}
    </div>
  )
}

export function Input({
  className = "",
  error,
  ...rest
}: React.InputHTMLAttributes<HTMLInputElement> & { error?: boolean }) {
  return (
    <input
      className={`ctrl w-full ${className}`}
      data-error={error ? "true" : undefined}
      {...rest}
    />
  )
}

export function Textarea({
  className = "",
  ...rest
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`ctrl w-full ${className}`} {...rest} />
}

/**
 * Native select restyled with the design tokens. The chevron is a real Lucide
 * icon (no CSS background-image glyphs); call sites keep passing width
 * classes through `className`, which now lands on the wrapper.
 */
export function Select({
  options,
  placeholder,
  className = "",
  selectClassName = "",
  ...rest
}: React.SelectHTMLAttributes<HTMLSelectElement> & {
  options: { value: string; label: string }[]
  placeholder?: string
  selectClassName?: string
}) {
  return (
    <div className={`relative inline-flex items-center ${className}`}>
      <select
        className={`ctrl w-full appearance-none cursor-pointer ${selectClassName}`}
        {...rest}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <span
        className="pointer-events-none absolute end-2 inline-flex"
        style={{ color: "var(--muted-fg)" }}
        aria-hidden="true"
      >
        <ChevronD size="xs" />
      </span>
    </div>
  )
}

/** Pill toggle used for dense boolean controls in toolbars/filters. */
export function ToggleChip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[var(--radius-sm)] text-[10px] font-semibold uppercase tracking-[0.06em] transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
      style={{
        background: active ? "var(--primary)" : "var(--surface-2)",
        color: active ? "var(--primary-fg)" : "var(--muted-fg)",
        border: `1px solid ${active ? "var(--primary)" : "var(--border)"}`,
      }}
    >
      {children}
    </button>
  )
}

/* ============================================================================
   BADGES / TAGS / RECORD-TYPE
   ========================================================================== */
export function Badge({
  children,
  color,
  size = "sm",
  className = "",
}: {
  children: ReactNode
  color?: string
  size?: "xs" | "sm"
  className?: string
}) {
  const sz =
    size === "xs"
      ? "h-[16px] px-1.5 text-[9.5px]"
      : "h-[19px] px-2 text-[10.5px]"
  return (
    <span
      className={`inline-flex max-w-full items-center gap-1 overflow-hidden rounded-full font-semibold ${sz} ${className}`}
      style={{
        background: color ? `color-mix(in srgb, ${color} 9%, transparent)` : "var(--surface-2)",
        color: color ?? "var(--fg-soft)",
        border: `1px solid ${color ? `color-mix(in srgb, ${color} 24%, transparent)` : "var(--border)"}`,
        fontFamily: "var(--font-display)",
        letterSpacing: "0.01em",
        lineHeight: 1,
      }}
    >
      {children}
    </span>
  )
}

const RECORD_COLORS: Record<RecordType, string> = {
  source: "#16A34A",
  content: "#EA580C",
  analysis: "#2563EB",
}

const RECORD_LABELS: Record<RecordType, string> = {
  source: "SRC",
  content: "CNT",
  analysis: "ANL",
}

export function RecordTypeBadge({ type }: { type: RecordType }) {
  const color = RECORD_COLORS[type]
  return (
    <span
      className="inline-flex items-center px-1.5 py-px text-[10px] font-bold tracking-widest"
      style={{
        background: color + "1A",
        color,
        border: `1px solid ${color}3D`,
        borderRadius: "var(--radius-sm)",
        fontFamily: "var(--font-mono)",
        letterSpacing: "0.1em",
      }}
    >
      {RECORD_LABELS[type]}
    </span>
  )
}

export function recordTypeColor(type: RecordType): string {
  return RECORD_COLORS[type]
}

export function Tag({
  children,
  color,
  onRemove,
}: {
  children: ReactNode
  color?: string
  onRemove?: () => void
}) {
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium"
      style={{
        background: color ? color + "16" : "var(--surface-3)",
        color: color ?? "var(--fg-soft)",
        border: `1px solid ${color ? color + "3a" : "var(--border)"}`,
        borderRadius: "var(--radius-full)",
        fontFamily: "var(--font-body)",
      }}
    >
      {children}
      {onRemove && (
        <IconButton
          label="Remove"
          onClick={onRemove}
          size={16}
          className="!rounded-full opacity-60 hover:opacity-100"
        >
          <Close size="xs" />
        </IconButton>
      )}
    </span>
  )
}

/* ============================================================================
   IMPORTANCE
   ========================================================================== */
export function ImportanceBar({ value }: { value: number }) {
  const v = Math.max(0, Math.min(1, value || 0))
  const pct = (v * 100).toFixed(1)
  const color =
    v >= 0.85
      ? "var(--error)"
      : v >= 0.6
        ? "var(--warning)"
        : v >= 0.35
          ? "var(--primary)"
          : "var(--muted-fg-2)"
  return (
    <div
      className="flex items-center gap-2"
      role="img"
      aria-label={`Importance ${pct}%`}
    >
      <span
        className="h-1 w-14 shrink-0 overflow-hidden rounded-full"
        style={{
          background: "var(--surface-3)",
          boxShadow: "inset 0 0 0 1px var(--border)",
        }}
        aria-hidden="true"
      >
        <span
          className="block h-full rounded-full transition-[width] duration-300"
          style={{ width: `${v * 100}%`, background: color }}
        />
      </span>
      <span
        className="tnum"
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "0.7rem",
          color: "var(--fg-soft)",
        }}
      >
        {pct}%
      </span>
    </div>
  )
}

export const ImportanceStars = ImportanceBar

/**
 * Unified importance control: one grouped field for the numeric value and
 * `%`, a live slider, and a monospaced readout — all three always agree
 * because they share a single percent-string state.
 */
export function ImportanceControl({
  value,
  onChange,
  error,
}: {
  value: string
  onChange: (v: string) => void
  error?: boolean
}) {
  const n = parseFloat(value)
  const v = Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : 0
  return (
    <div className="flex w-full items-center gap-3">
      <div className="fgroup" style={{ width: 104, paddingInlineEnd: 10 }} data-error={error ? "true" : undefined}>
        <input
          type="number"
          min={0}
          max={100}
          step={0.01}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-label="Importance percent"
          style={{ textAlign: "center" }}
        />
        <span
          className="flex-none text-[0.78rem]"
          style={{ color: "var(--muted-fg-2)" }}
          aria-hidden="true"
        >
          %
        </span>
      </div>
      <input
        type="range"
        className="imp-range"
        min={0}
        max={100}
        step={0.01}
        value={v}
        onChange={(e) => onChange(String(parseFloat(e.target.value)))}
        aria-label="Importance slider"
        style={{ "--fill": `${v}%` } as React.CSSProperties}
      />
      <span
        className="tnum flex-none text-[0.78rem]"
        style={{
          fontFamily: "var(--font-mono)",
          color: "var(--fg-soft)",
          minWidth: 52,
          textAlign: "end",
        }}
      >
        {Number.isFinite(n) ? n.toFixed(2) : "0.00"}%
      </span>
    </div>
  )
}

/* ============================================================================
   SEARCH / DATE INPUTS
   ========================================================================== */
export function SearchInput({
  value,
  onChange,
  placeholder = "Search…",
  autoFocus,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  autoFocus?: boolean
}) {
  return (
    <div className="relative flex items-center" style={{ minWidth: 220 }}>
      <span
        className="pointer-events-none absolute start-2.5 inline-flex"
        style={{ color: "var(--muted-fg)" }}
        aria-hidden="true"
      >
        <Search size="xs" />
      </span>
      <input
        type="text"
        role="searchbox"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        aria-label={placeholder}
        className="ctrl w-full ps-8 pe-7"
      />
      {value && (
        <button
          onClick={() => onChange("")}
          aria-label="Clear search"
          title="Clear search"
          type="button"
          className="absolute end-1.5 flex items-center justify-center rounded-full transition-colors hover:bg-[var(--surface-3)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
          style={{ color: "var(--muted-fg)", width: 18, height: 18 }}
        >
          <Close size="xs" />
        </button>
      )}
    </div>
  )
}

export function DateTimeInput({
  label,
  value,
  onChange,
  required,
  error,
  hint,
  showNow = true,
  className = "",
}: {
  label?: string
  value: string
  onChange: (v: string) => void
  required?: boolean
  error?: boolean
  hint?: string
  showNow?: boolean
  className?: string
}) {
  const { t } = useTranslation()
  const local = toDateTimeLocal(value)
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      {label && (
        <span className="field-label">
          {label}
          {required && (
            <span
              className="ms-1 font-bold"
              style={{ color: "var(--error)" }}
              aria-hidden="true"
            >
              *
            </span>
          )}
        </span>
      )}
      <div className="fgroup" data-error={error ? "true" : undefined}>
        <span
          className="pointer-events-none inline-flex shrink-0"
          style={{ color: "var(--muted-fg)" }}
          aria-hidden="true"
        >
          <CalendarSmall />
        </span>
        <input
          type="datetime-local"
          aria-label={label ?? "Date and time"}
          value={local}
          onChange={(e) => onChange(fromDateTimeLocal(e.target.value) ?? "")}
        />
        {showNow && (
          <button
            type="button"
            onClick={() => onChange(nowIso())}
            title={t.actions.now}
            className="fgroup-act"
          >
            {t.actions.now}
          </button>
        )}
        {value && (
          <button
            type="button"
            onClick={() => onChange("")}
            aria-label="Clear date"
            title="Clear date"
            className="fgroup-x"
          >
            <Close size="xs" />
          </button>
        )}
      </div>
      {hint && (
        <span className="text-[11px]" style={{ color: "var(--muted-fg-2)" }}>
          {hint}
        </span>
      )}
      {value && (
        <span
          className="tnum text-[10px]"
          style={{ color: "var(--muted-fg)", fontFamily: "var(--font-mono)" }}
        >
          {formatDateTime(value)}
        </span>
      )}
    </div>
  )
}

export function DateInput({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="fgroup" style={{ width: 216 }}>
      <span className="fgroup-tag">{label}</span>
      <span
        className="pointer-events-none inline-flex shrink-0"
        style={{ color: "var(--muted-fg)" }}
        aria-hidden="true"
      >
        <CalendarSmall />
      </span>
      <input
        type="datetime-local"
        aria-label={label}
        value={toDateTimeLocal(value)}
        onChange={(e) => onChange(fromDateTimeLocal(e.target.value) ?? "")}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label={`Clear ${label}`}
          title={`Clear ${label}`}
          className="fgroup-x"
        >
          <Close size="xs" />
        </button>
      )}
    </div>
  )
}

/* ============================================================================
   TOOLBARS / FILTERS
   ========================================================================== */
export function Toolbar({
  children,
  className = "",
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={`flex items-center gap-1.5 px-3 py-1.5 shrink-0 flex-wrap ${className}`}
      style={{
        background: "var(--surface)",
        borderBottom: "1px solid var(--border)",
      }}
    >
      {children}
    </div>
  )
}

export function ToolbarSep() {
  return (
    <div
      className="w-px mx-0.5 self-stretch my-1"
      style={{ background: "var(--border)" }}
      aria-hidden="true"
    />
  )
}

export function FilterRow({ children }: { children: ReactNode }) {
  return (
    <div
      className="flex items-center gap-2 px-3 py-1.5 shrink-0 flex-wrap"
      style={{
        background: "var(--surface-2)",
        borderBottom: "1px solid var(--border)",
      }}
      role="search"
    >
      {children}
    </div>
  )
}

/* ============================================================================
   RESULTS / SELECTION / PAGINATION
   ========================================================================== */
export function ResultsStrip({
  total,
  filtered,
  selected,
  recordsLabel = "records",
  totalLabel = "total",
  selectedLabel = "selected",
}: {
  total: number
  filtered: number
  selected: number
  recordsLabel?: string
  totalLabel?: string
  selectedLabel?: string
}) {
  return (
    <div
      className="flex items-center gap-2 px-3 shrink-0"
      style={{
        background: "var(--surface-2)",
        borderBottom: "1px solid var(--border)",
        height: 26,
        color: "var(--muted-fg)",
        fontFamily: "var(--font-mono)",
        fontSize: "0.68rem",
        letterSpacing: "0.02em",
      }}
    >
      <span>
        <strong style={{ color: "var(--fg)", fontWeight: 600 }}>
          {filtered}
        </strong>{" "}
        <span className="ms-0.5">{recordsLabel}</span>
      </span>
      {filtered !== total && (
        <span style={{ opacity: 0.7 }}>
          · <strong style={{ color: "var(--fg)" }}>{total}</strong> {totalLabel}
        </span>
      )}
      {selected > 0 && (
        <span style={{ color: "var(--primary)", fontWeight: 600 }}>
          · {selected} {selectedLabel}
        </span>
      )}
    </div>
  )
}

export function SelectionBar({
  count,
  onClear,
  onBulkDelete,
  onBulkEdit,
  label = "selected",
}: {
  count: number
  onClear: () => void
  onBulkDelete?: () => void
  onBulkEdit?: () => void
  label?: string
}) {
  return (
    <div
      className="flex items-center gap-2 px-3 py-1.5 shrink-0"
      style={{
        background: "var(--primary-soft)",
        borderTop: "1px solid var(--primary-soft-2)",
        borderBottom: "1px solid var(--primary-soft-2)",
      }}
    >
      <span
        className="text-[11px] font-semibold tnum flex items-center gap-1.5"
        style={{ color: "var(--primary)", fontFamily: "var(--font-mono)" }}
      >
        <span
          className="inline-flex items-center justify-center w-4.5 h-4.5 rounded-full text-[9px] px-1"
          style={{ background: "var(--primary)", color: "var(--primary-fg)" }}
        >
          {count}
        </span>
        {count} {label}
      </span>
      <div className="flex-1" />
      {onBulkEdit && (
        <button
          onClick={onBulkEdit}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium rounded-[var(--radius-sm)] transition-colors hover:bg-[var(--surface-3)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
          style={{
            color: "var(--primary)",
            border: "1px solid var(--primary-soft-2)",
          }}
        >
          <Pencil size="xs" />
          Edit All
        </button>
      )}
      {onBulkDelete && (
        <button
          onClick={onBulkDelete}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium rounded-[var(--radius-sm)] transition-colors hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
          style={{ background: "var(--error)", color: "#fff" }}
        >
          <Trash size="xs" />
          Delete All
        </button>
      )}
      <button
        onClick={onClear}
        aria-label="Clear selection"
        className="inline-flex items-center gap-1 px-2 py-1 text-[11px] rounded-[var(--radius-sm)] transition-colors hover:bg-[var(--surface-3)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
        style={{ color: "var(--primary)", fontFamily: "var(--font-mono)" }}
      >
        <Close size="xs" />
        Clear
      </button>
    </div>
  )
}

const PAGE_SIZES = [25, 50, 100, 200, 500]

export function PaginationBar({
  total,
  page,
  pageSize,
  onPage,
  onPageSize,
  perPageLabel = "per page",
  pageLabel = "Page",
  ofLabel = "of",
  showingLabel = "Showing",
}: {
  total: number
  page: number
  pageSize: number
  onPage: (p: number) => void
  onPageSize: (s: number) => void
  perPageLabel?: string
  pageLabel?: string
  ofLabel?: string
  showingLabel?: string
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const start = Math.min(total, (page - 1) * pageSize + 1)
  const end = Math.min(total, page * pageSize)

  const getPages = (): (number | "ellipsis")[] => {
    if (totalPages <= 7)
      return Array.from({ length: totalPages }, (_, i) => i + 1)
    const pages: (number | "ellipsis")[] = [1]
    if (page > 3) pages.push("ellipsis")
    for (
      let i = Math.max(2, page - 1);
      i <= Math.min(totalPages - 1, page + 1);
      i++
    )
      pages.push(i)
    if (page < totalPages - 2) pages.push("ellipsis")
    pages.push(totalPages)
    return pages
  }

  const cell =
    "flex h-[26px] min-w-[26px] items-center justify-center rounded-[var(--radius-sm)] px-1.5 text-[0.74rem] font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"

  const navBtn = (
    label: string,
    target: number,
    disabled: boolean,
    icon: ReactNode,
  ) => (
    <button
      key={label}
      type="button"
      onClick={() => !disabled && onPage(target)}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`${cell} hover:enabled:bg-[var(--surface-3)] disabled:cursor-not-allowed disabled:opacity-30`}
      style={{ color: "var(--muted-fg)" }}
    >
      {icon}
    </button>
  )

  const pgBtn = (label: number, target: number, active = false) => (
    <button
      key={`p-${target}`}
      type="button"
      onClick={() => onPage(target)}
      aria-current={active ? "page" : undefined}
      className={`${cell} ${active ? "hover:!bg-[var(--primary)]" : "hover:bg-[var(--surface-3)]"}`}
      style={
        active
          ? {
              background: "var(--primary)",
              color: "var(--primary-fg)",
              fontFamily: "var(--font-mono)",
              fontWeight: 600,
            }
          : { color: "var(--muted-fg)" }
      }
    >
      {label}
    </button>
  )

  return (
    <div
      className="flex items-center gap-2.5 px-3 py-1.5 shrink-0 flex-wrap"
      style={{
        background: "var(--surface-2)",
        borderTop: "1px solid var(--border)",
        minHeight: 38,
      }}
    >
      <span
        className="tnum text-[0.76rem]"
        style={{ color: "var(--muted-fg)" }}
      >
        {showingLabel}{" "}
        <span style={{ color: "var(--fg)", fontWeight: 600 }}>
          {start}–{end}
        </span>{" "}
        {ofLabel}{" "}
        <span style={{ color: "var(--fg)", fontWeight: 600 }}>{total}</span>{" "}
        {total > 0 ? "" : ""}
      </span>
      <div className="flex-1" />
      <div
        className="flex items-center gap-0.5 p-[2px]"
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border-strong)",
          borderRadius: "var(--radius)",
        }}
      >
        <nav aria-label={`${pageLabel} ${page} ${ofLabel} ${totalPages}`}>
          <div className="flex items-center gap-0.5">
            {navBtn("First page", 1, page === 1, <ChevronsL size="xs" />)}
            {navBtn("Previous page", page - 1, page === 1, <ChevronL size="xs" />)}
            {getPages().map((p, i) =>
              p === "ellipsis" ? (
                <span
                  key={`e${i}`}
                  className="px-1 text-xs tracking-widest"
                  style={{ color: "var(--muted-fg-2)" }}
                  aria-hidden="true"
                >
                  ···
                </span>
              ) : (
                pgBtn(p, p as number, p === page)
              ),
            )}
            {navBtn(
              "Next page",
              page + 1,
              page === totalPages,
              <ChevronR size="xs" />,
            )}
            {navBtn(
              "Last page",
              totalPages,
              page === totalPages,
              <ChevronsR size="xs" />,
            )}
          </div>
        </nav>
        <span
          aria-hidden="true"
          className="mx-1 self-stretch"
          style={{ width: 1, background: "var(--border)" }}
        />
        <label
          className="flex items-center gap-1.5 px-1 text-[0.72rem]"
          style={{ color: "var(--muted-fg)" }}
        >
          {perPageLabel}
          <select
            aria-label="Rows per page"
            value={String(pageSize)}
            onChange={(e) => {
              onPageSize(Number(e.target.value))
              onPage(1)
            }}
            className="tnum cursor-pointer rounded-[var(--radius-sm)] border border-transparent bg-transparent px-1 py-0.5 text-[0.74rem] transition-colors hover:border-[var(--border)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
            style={{
              color: "var(--fg)",
              fontFamily: "var(--font-mono)",
              background: "transparent",
            }}
          >
            {PAGE_SIZES.map((s) => (
              <option key={s} value={String(s)}>
                {s}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  )
}

/* ============================================================================
   FULL TEXT PREVIEW (collapsible detail strip shared across workspaces)
   ========================================================================== */
type AnyRecord = Source | Content | Analysis

export function FullTextPreview({
  record,
  recordType,
  sources = [],
  contents = [],
  label = "Full Text Preview",
  emptyLabel = "Select a record to preview its content here.",
}: {
  record: AnyRecord | null
  recordType: RecordType | null
  sources?: Source[]
  contents?: Content[]
  label?: string
  emptyLabel?: string
}) {
  const [expanded, setExpanded] = useState(false)

  const getTitle = (): string => {
    if (!record) return ""
    if (recordType === "source") return (record as Source).name
    if (recordType === "content") return (record as Content).title
    if (recordType === "analysis") {
      const a = record as Analysis
      const c = contents.find((x) => x.id === a.content_id)
      return c?.title ?? a.classification
    }
    return ""
  }

  const getPrimaryText = (): string => {
    if (!record) return ""
    if (recordType === "source") return (record as Source).description
    if (recordType === "content") return (record as Content).content_data
    if (recordType === "analysis") {
      const a = record as Analysis
      return [a.list_names_people, a.list_names_places, a.list_sides]
        .filter(Boolean)
        .join("\n")
    }
    return ""
  }

  const getFields = (): [string, string][] => {
    if (!record) return []
    if (recordType === "source") {
      const s = record as Source
      return [
        ["Type", s.type],
        ["Importance", `${(s.importance * 100).toFixed(2)}%`],
        ["Location", [s.city, s.country].filter(Boolean).join(", ")],
        ["Entry Date", s.date_entry],
        ["Accounts", s.accounts],
        ["Ownership", s.ownership],
      ].filter(([, v]) => v) as [string, string][]
    }
    if (recordType === "content") {
      const c = record as Content
      const src = sources.find((s) => s.id === c.sources_id)
      return [
        ["Source", src?.name ?? c.sources_id],
        ["Importance", `${(c.importance * 100).toFixed(2)}%`],
        ["Content Date", c.date_content],
        ["Attachments", c.attachments],
      ].filter(([, v]) => v) as [string, string][]
    }
    if (recordType === "analysis") {
      const a = record as Analysis
      return [
        ["Classification", a.classification],
        ["Sides", a.list_sides],
        ["Coordinates", a.list_coordinates],
        ["Analysis Date", a.date_analysis],
      ].filter(([, v]) => v) as [string, string][]
    }
    return []
  }

  return (
    <div
      className="shrink-0 overflow-hidden transition-all duration-200"
      style={{
        height: expanded ? 280 : 36,
        borderTop: "1px solid var(--border-strong)",
        background: "var(--surface)",
      }}
    >
      <button
        onClick={() => setExpanded((e) => !e)}
        aria-expanded={expanded}
        aria-controls="full-text-preview-body"
        className="group/ftp w-full flex items-center gap-2.5 px-3 h-9 text-start transition-colors hover:bg-[var(--surface-2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--ring)]"
      >
        <span
          className="text-[10px] font-bold uppercase tracking-[0.1em]"
          style={{ color: "var(--primary)", fontFamily: "var(--font-display)" }}
        >
          <span
            aria-hidden="true"
            style={{
              width: 5,
              height: 5,
              borderRadius: 999,
              background: "var(--primary)",
              display: "inline-block",
            }}
          />
          {label}
        </span>
        {record && recordType && (
          <>
            <RecordTypeBadge type={recordType} />
            <span
              className="text-xs font-medium truncate"
              style={{ color: "var(--fg)" }}
            >
              {getTitle()}
            </span>
          </>
        )}
        <span
          className="ms-auto inline-flex h-[22px] w-[22px] items-center justify-center rounded-[6px] transition-colors group-hover/ftp:bg-[var(--surface-3)]"
          style={{ color: "var(--muted-fg)", border: "1px solid var(--border)" }}
          aria-hidden="true"
        >
          {expanded ? <ChevronU size="xs" /> : <ChevronD size="xs" />}
        </span>
      </button>
      {expanded && (
        <div
          id="full-text-preview-body"
          className="flex"
          style={{ height: "calc(100% - 36px)" }}
        >
          {!record ? (
            <div
              className="flex w-full flex-col items-center justify-center gap-1.5 text-xs"
              style={{ color: "var(--muted-fg)" }}
            >
              <span style={{ color: "var(--muted-fg-2)", opacity: 0.55 }}>
                <EmptyFile size="lg" />
              </span>
              {emptyLabel}
            </div>
          ) : (
            <>
              <div
                className="min-w-0 flex-1 overflow-y-auto p-4 text-xs leading-relaxed"
                style={{
                  color: "var(--fg)",
                  borderRight: "1px solid var(--border)",
                  whiteSpace: "pre-wrap",
                  fontFamily: "var(--font-body)",
                }}
              >
                <div className="max-w-[78ch]">
                {getPrimaryText() || (
                  <span style={{ color: "var(--muted-fg)" }}>—</span>
                )}
                </div>
              </div>
              <div
                className="w-56 shrink-0 overflow-y-auto py-0.5"
                style={{ background: "var(--surface-2)" }}
              >
                {getFields().map(([k, v]) => (
                  <div
                    key={k}
                    className="px-3 py-1.5"
                    style={{ borderBottom: "1px solid var(--border)" }}
                  >
                    <div
                      className="mb-0.5 text-[0.68rem] font-semibold"
                      style={{
                        color: "var(--muted-fg)",
                        fontFamily: "var(--font-display)",
                        letterSpacing: "0.01em",
                      }}
                    >
                      {k}
                    </div>
                    <div
                      className="text-xs break-words"
                      style={{ color: "var(--fg)" }}
                    >
                      {v}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

/* ============================================================================
   MORE MENU (overflow actions) — icons are real components, never glyphs
   ========================================================================== */
export interface MenuItem {
  label: string
  onClick: () => void
  icon?: ReactNode
  danger?: boolean
  disabled?: boolean
  divider?: boolean
}

export function MoreMenu({
  items,
  label = "More options",
}: {
  items: MenuItem[]
  label?: string
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", h)
    return () => document.removeEventListener("mousedown", h)
  }, [])
  useEffect(() => {
    if (!open) return
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("keydown", h)
    return () => document.removeEventListener("keydown", h)
  }, [open])
  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={label}
        title={label}
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex h-[30px] items-center gap-1 px-2 text-xs font-medium rounded-[var(--radius)] transition-colors hover:bg-[var(--surface-2)] hover:border-[var(--muted-fg-2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
        style={{
          border: "1px solid var(--border-strong)",
          background: open ? "var(--surface-3)" : "var(--surface)",
          color: "var(--fg)",
        }}
      >
        <More size="sm" />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute end-0 top-full mt-1.5 z-50 overflow-hidden min-w-[190px] animate-[popIn_0.12s_ease-out]"
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-lg)",
            boxShadow: "var(--shadow-pop)",
          }}
        >
          <div className="py-1">
            {items.map((item, i) =>
              item.divider ? (
                <div
                  key={`div-${i}`}
                  className="mx-2 my-1"
                  role="separator"
                  style={{ height: 1, background: "var(--border)" }}
                />
              ) : (
                <button
                  key={`mi-${i}`}
                  role="menuitem"
                  disabled={item.disabled}
                  onClick={() => {
                    item.onClick()
                    setOpen(false)
                  }}
                  className="w-full flex items-center gap-2.5 text-start px-3.5 py-2 text-xs transition-colors disabled:opacity-40 hover:bg-[var(--surface-3)] focus-visible:outline-none focus-visible:bg-[var(--surface-3)] [&_svg]:text-current"
                  style={{
                    color: item.danger ? "var(--error)" : "var(--fg)",
                    fontFamily: "var(--font-body)",
                  }}
                >
                  {item.icon && (
                    <span className="inline-flex items-center shrink-0 opacity-80 w-4 justify-center">
                      {item.icon}
                    </span>
                  )}
                  {item.label}
                </button>
              ),
            )}
          </div>
        </div>
      )}
    </div>
  )
}

/* ============================================================================
   SECTION HEADER / STAT CARD / TABS / SEGMENTED
   ========================================================================== */
export function SectionHeader({
  title,
  subtitle,
  actions,
}: {
  title: string
  subtitle?: string
  actions?: ReactNode
}) {
  return (
    <div
      className="px-4 py-2.5 shrink-0 flex items-center gap-3"
      style={{
        borderBottom: "1px solid var(--border)",
        background: "var(--surface)",
      }}
    >
      <div className="min-w-0">
        <h2
          className="text-sm font-bold leading-tight"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {title}
        </h2>
        {subtitle && (
          <p
            className="text-[11px] mt-0.5 truncate"
            style={{ color: "var(--muted-fg)" }}
          >
            {subtitle}
          </p>
        )}
      </div>
      {actions && (
        <div className="ms-auto flex items-center gap-1.5">{actions}</div>
      )}
    </div>
  )
}

export function StatCard({
  label,
  value,
  sub,
  color,
}: {
  label: string
  value: string | number
  sub?: string
  color?: string
}) {
  return (
    <div
      className="flex flex-col gap-1 p-3"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)",
        borderTop: color ? `2px solid ${color}` : "2px solid var(--border)",
      }}
    >
      <span
        className="text-[10px] font-bold uppercase tracking-[0.08em]"
        style={{
          color: color ?? "var(--muted-fg)",
          fontFamily: "var(--font-display)",
        }}
      >
        {label}
      </span>
      <span
        className="text-2xl font-bold leading-none tnum"
        style={{ fontFamily: "var(--font-mono)", color: color ?? "var(--fg)" }}
      >
        {value}
      </span>
      {sub && (
        <span className="text-[11px]" style={{ color: "var(--muted-fg)" }}>
          {sub}
        </span>
      )}
    </div>
  )
}

export function StatTile({
  label,
  value,
  hint,
  color,
  icon,
}: {
  label: string
  value: ReactNode
  hint?: string
  color?: string
  icon?: ReactNode
}) {
  return (
    <div
      className="flex items-center gap-2.5 px-3 py-1.5 rounded-[var(--radius)]"
      style={{ background: "var(--surface-2)" }}
    >
      {icon && (
        <span
          className="shrink-0 inline-flex"
          style={{ color: color ?? "var(--muted-fg)" }}
        >
          {icon}
        </span>
      )}
      <div className="flex items-baseline gap-1.5 min-w-0">
        <span
          className="text-sm font-bold tnum"
          style={{
            fontFamily: "var(--font-mono)",
            color: color ?? "var(--fg)",
          }}
        >
          {value}
        </span>
        <span className="text-xs truncate" style={{ color: "var(--muted-fg)" }}>
          {label}
        </span>
      </div>
      {hint && (
        <span
          className="ms-auto text-[11px] truncate"
          style={{ color: "var(--muted-fg-2)" }}
        >
          {hint}
        </span>
      )}
    </div>
  )
}

export interface TabItem {
  id: string
  label: string
  icon?: ReactNode
}
export function InlineTabs({
  tabs,
  active,
  onChange,
}: {
  tabs: TabItem[]
  active: string
  onChange: (id: string) => void
}) {
  return (
    <div
      role="tablist"
      className="inline-flex p-0.5 rounded-[var(--radius)]"
      style={{
        background: "var(--surface-2)",
        border: "1px solid var(--border)",
      }}
    >
      {tabs.map((tab) => (
        <button
          key={tab.id}
          role="tab"
          aria-selected={active === tab.id}
          onClick={() => onChange(tab.id)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold transition-colors rounded-[5px] relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] [&_svg]:opacity-80"
          style={{
            color: active === tab.id ? "var(--primary)" : "var(--muted-fg)",
            background: active === tab.id ? "var(--surface)" : "transparent",
            fontFamily: "var(--font-display)",
            letterSpacing: "0.02em",
            boxShadow: active === tab.id ? "var(--shadow-1)" : "none",
          }}
        >
          {tab.icon}
          {tab.label}
        </button>
      ))}
    </div>
  )
}

export function Segmented({
  options,
  value,
  onChange,
  size = "sm",
  ariaLabel,
}: {
  options: { value: string; label: string }[]
  value: string
  onChange: (v: string) => void
  size?: "sm" | "xs"
  ariaLabel?: string
}) {
  const pad = size === "xs" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs"
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="inline-flex p-0.5 rounded-[var(--radius)]"
      style={{
        background: "var(--surface-2)",
        border: "1px solid var(--border)",
      }}
    >
      {options.map((o) => (
        <button
          key={o.value}
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={`${pad} font-semibold uppercase tracking-[0.04em] rounded-[5px] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]`}
          style={{
            color: value === o.value ? "var(--primary)" : "var(--muted-fg)",
            background: value === o.value ? "var(--surface)" : "transparent",
            fontFamily: "var(--font-display)",
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/* ============================================================================
   CHECKBOX / SWITCH / SLIDER / KBD
   ========================================================================== */
export function Checkbox({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label?: ReactNode
  disabled?: boolean
}) {
  return (
    <label
      className={`inline-flex items-center gap-2 text-xs cursor-pointer select-none ${
        disabled ? "opacity-40 pointer-events-none" : ""
      }`}
      style={{ color: "var(--fg-soft)" }}
    >
      <span
        className="relative inline-flex items-center justify-center w-4 h-4 rounded-[5px] shrink-0 transition-all"
        style={{
          background: checked ? "var(--primary)" : "var(--surface)",
          border: `1.5px solid ${
            checked ? "var(--primary)" : "var(--border-strong)"
          }`,
          boxShadow: checked ? "0 0 0 3px var(--primary-soft)" : "none",
        }}
        aria-hidden="true"
      >
        {checked && <Check size="xs" style={{ color: "var(--primary-fg)" }} />}
      </span>
      <input
        type="checkbox"
        className="sr-only"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      {label}
    </label>
  )
}

/**
 * Table checkbox: 16px rounded box, hover/focus affordances and a real
 * indeterminate state — driven by a hidden native input so keyboard and
 * screen readers behave exactly like a checkbox.
 */
export function RowCheckbox({
  checked,
  mixed,
  label,
  disabled,
  onChange,
}: {
  checked: boolean
  mixed?: boolean
  label: string
  disabled?: boolean
  onChange: (v: boolean) => void
}) {
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = !!mixed && !checked
  }, [mixed, checked])
  const on = checked || !!mixed
  return (
    <label
      className="relative inline-flex cursor-pointer items-center justify-center align-middle"
      style={{ width: 16, height: 16 }}
    >
      <input
        ref={ref}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        aria-label={label}
        onChange={(e) => onChange(e.target.checked)}
        className="peer absolute inset-0 m-0 cursor-pointer opacity-0"
        style={{ width: 16, height: 16 }}
      />
      <span
        aria-hidden="true"
        className="row-cb pointer-events-none absolute inset-0"
        data-on={on ? "true" : undefined}
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 flex items-center justify-center"
      >
        {checked ? (
          <Check size="xs" style={{ color: "var(--primary-fg)" }} />
        ) : mixed ? (
          <MinusSmall style={{ color: "var(--primary-fg)" }} />
        ) : null}
      </span>
    </label>
  )
}

export function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label?: ReactNode
}) {
  return (
    <span
      className="inline-flex items-center gap-2 text-xs cursor-pointer select-none"
      style={{ color: "var(--fg-soft)" }}
    >
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className="relative inline-flex items-center w-8 h-[18px] rounded-full transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] shrink-0"
        style={{
          background: checked ? "var(--primary)" : "var(--border-strong)",
        }}
      >
        <span
          className="absolute w-3.5 h-3.5 rounded-full bg-white transition-all duration-200"
          style={{
            insetInlineStart: checked ? "calc(100% - 15px)" : "2px",
            boxShadow: "0 1px 2px rgba(0,0,0,0.3)",
          }}
        />
      </button>
      {label}
    </span>
  )
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd
      className="inline-flex items-center justify-center px-1.5 py-0.5 rounded text-[10px] font-semibold"
      style={{
        background: "var(--surface-2)",
        border: "1px solid var(--border-strong)",
        borderBottomWidth: 2,
        color: "var(--fg-soft)",
        fontFamily: "var(--font-mono)",
      }}
    >
      {children}
    </kbd>
  )
}

export function Divider({
  orientation = "h",
  label,
}: {
  orientation?: "h" | "v"
  label?: string
}) {
  if (orientation === "v")
    return (
      <div
        className="w-px self-stretch"
        style={{ background: "var(--border)" }}
        aria-hidden="true"
      />
    )
  if (label) {
    return (
      <div
        className="flex items-center gap-2"
        style={{ color: "var(--muted-fg)" }}
      >
        <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
        <span className="text-[10px] uppercase tracking-[0.08em] font-semibold">
          {label}
        </span>
        <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
      </div>
    )
  }
  return (
    <div
      className="w-full h-px"
      style={{ background: "var(--border)" }}
      aria-hidden="true"
    />
  )
}

/* ============================================================================
   CARD / PANEL
   ========================================================================== */
export function Card({
  children,
  className = "",
  padding = "p-4",
  style,
}: {
  children: ReactNode
  className?: string
  padding?: string
  style?: React.CSSProperties
}) {
  return (
    <div className={`surface-card ${padding} ${className}`} style={style}>
      {children}
    </div>
  )
}

export function Panel({
  title,
  subtitle,
  icon,
  actions,
  children,
  className = "",
  bodyClassName = "",
}: {
  title?: ReactNode
  subtitle?: ReactNode
  icon?: ReactNode
  actions?: ReactNode
  children: ReactNode
  className?: string
  bodyClassName?: string
}) {
  return (
    <section
      className={`surface-card overflow-hidden flex flex-col ${className}`}
    >
      {(title || actions) && (
        <header
          className="flex items-center gap-2 px-3 py-2 shrink-0"
          style={{
            borderBottom: "1px solid var(--border)",
            background: "var(--surface-2)",
          }}
        >
          {icon && (
            <span
              className="inline-flex items-center"
              style={{ color: "var(--primary)" }}
            >
              {icon}
            </span>
          )}
          <div className="min-w-0">
            {title && (
              <div
                className="text-xs font-bold"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {title}
              </div>
            )}
            {subtitle && (
              <div className="text-[11px]" style={{ color: "var(--muted-fg)" }}>
                {subtitle}
              </div>
            )}
          </div>
          {actions && (
            <div className="ms-auto flex items-center gap-1.5">{actions}</div>
          )}
        </header>
      )}
      <div className={`flex-1 min-h-0 ${bodyClassName}`}>{children}</div>
    </section>
  )
}

/* ============================================================================
   PROGRESS BAR (real, bound to actual work state — never decorative)
   ========================================================================== */
export function ProgressBar({
  value,
  indeterminate,
  label,
}: {
  value?: number
  indeterminate?: boolean
  label?: string
}) {
  return (
    <div
      role="progressbar"
      aria-valuenow={indeterminate ? undefined : Math.round((value ?? 0) * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className="w-full h-1.5 rounded-full overflow-hidden"
      style={{ background: "var(--surface-3)" }}
    >
      <div
        className="h-full rounded-full transition-[width] duration-200"
        style={{
          width: indeterminate
            ? "40%"
            : `${Math.round(Math.min(1, Math.max(0, value ?? 0)) * 100)}%`,
          background:
            "linear-gradient(90deg, var(--primary), var(--accent-violet))",
          boxShadow: "0 0 8px var(--primary-soft-2)",
          ...(indeterminate
            ? { animation: "indeterminateSlide 1.1s ease-in-out infinite" }
            : {}),
        }}
      />
      <style>{`@keyframes indeterminateSlide { 0% { margin-inline-start: -40%; } 100% { margin-inline-start: 100%; } }`}</style>
    </div>
  )
}

/* ============================================================================
   CALLOT / BANNER
   ========================================================================== */
export function Callout({
  variant = "info",
  title,
  children,
  icon,
  action,
  onClose,
}: {
  variant?: "info" | "success" | "warning" | "error"
  title?: ReactNode
  children?: ReactNode
  icon?: ReactNode
  action?: ReactNode
  onClose?: () => void
}) {
  const map = {
    info: { c: "var(--info)", bg: "var(--info-soft)" },
    success: { c: "var(--success)", bg: "var(--success-soft)" },
    warning: { c: "var(--warning)", bg: "var(--warning-soft)" },
    error: { c: "var(--error)", bg: "var(--error-soft)" },
  }[variant]
  const defaultIcon = {
    info: <InfoIcon size="sm" />,
    success: <Success size="sm" />,
    warning: <Warning size="sm" />,
    error: <ErrorIcon size="sm" />,
  }[variant]
  return (
    <div
      className="flex items-start gap-2.5 px-3 py-2 rounded-[var(--radius)] text-xs"
      style={{
        background: map.bg,
        border: `1px solid ${map.c}40`,
        color: "var(--fg-soft)",
      }}
      role={variant === "error" ? "alert" : "status"}
    >
      <span className="shrink-0 mt-0.5 inline-flex" style={{ color: map.c }}>
        {icon ?? defaultIcon}
      </span>
      <div className="min-w-0 flex-1">
        {title && (
          <div className="font-semibold mb-0.5" style={{ color: map.c }}>
            {title}
          </div>
        )}
        {children && <div style={{ color: "var(--fg-soft)" }}>{children}</div>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
      {onClose && (
        <IconButton label="Dismiss" onClick={onClose} size={20}>
          <Close size="xs" />
        </IconButton>
      )}
    </div>
  )
}

/* ============================================================================
   EMPTY / STATE PANEL — covers empty, no-results, loading, error, success
   ========================================================================== */
export function EmptyState({
  title,
  description,
  icon,
  action,
  variant = "empty",
  compact,
}: {
  title: string
  description?: ReactNode
  icon?: ReactNode
  action?: ReactNode
  variant?: "empty" | "noResults" | "error" | "success" | "loading"
  compact?: boolean
}) {
  const color =
    variant === "error"
      ? "var(--error)"
      : variant === "success"
        ? "var(--success)"
        : "var(--muted-fg-2)"
  const autoIcon =
    variant === "loading" ? (
      <Spinner size="hero" className="animate-spin-slow" />
    ) : variant === "error" ? (
      <ErrorIcon size="hero" />
    ) : variant === "success" ? (
      <Success size="hero" />
    ) : variant === "noResults" ? (
      <SearchNo size="hero" />
    ) : (
      <EmptyFile size="hero" />
    )
  return (
    <div
      className={`flex flex-col items-center justify-center text-center ${
        compact ? "py-10" : "py-20"
      } px-6 gap-3 animate-[fadeIn_0.2s_ease-out]`}
    >
      <div
        className="w-16 h-16 rounded-[var(--radius-xl)] flex items-center justify-center"
        style={{
          color,
          background: "var(--brand-grad-soft)",
          border: "1px solid var(--border)",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.35), var(--shadow-1)",
          animation: "popIn 0.45s var(--ease-spring) both",
        }}
      >
        {icon ?? autoIcon}
      </div>
      <div
        className="text-sm font-bold"
        style={{ fontFamily: "var(--font-display)", color: "var(--fg)" }}
      >
        {title}
      </div>
      {description && (
        <div
          className="text-xs max-w-sm leading-relaxed"
          style={{ color: "var(--muted-fg)" }}
        >
          {description}
        </div>
      )}
      {action && <div className="mt-1">{action}</div>}
    </div>
  )
}

/* ============================================================================
   STEPPER — workflow progress representation for wizards
   ========================================================================== */
export interface StepDef {
  title: string
  description?: string
  icon?: ReactNode
}
export function Stepper({
  steps,
  current,
  onStepClick,
}: {
  steps: StepDef[]
  current: number
  onStepClick?: (i: number) => void
}) {
  return (
    <ol className="flex items-center gap-1 w-full" aria-label="Progress">
      {steps.map((s, i) => {
        const done = i < current
        const active = i === current
        const clickable = !!onStepClick && done
        return (
          <li
            key={s.title}
            className="flex items-center gap-1 flex-1 min-w-0 last:flex-none"
          >
            <button
              type="button"
              disabled={!clickable}
              onClick={() => clickable && onStepClick?.(i)}
              aria-current={active ? "step" : undefined}
              className={`flex items-center gap-2 min-w-0 rounded-[var(--radius)] px-1.5 py-1 text-start transition-colors ${
                clickable
                  ? "cursor-pointer hover:bg-[var(--surface-3)]"
                  : "cursor-default"
              } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]`}
              title={s.description ?? s.title}
            >
              <span
                className="inline-flex items-center justify-center shrink-0 rounded-full"
                style={{
                  width: 22,
                  height: 22,
                  background: done
                    ? "var(--success)"
                    : active
                      ? "var(--primary)"
                      : "var(--surface-3)",
                  color:
                    done || active ? "var(--primary-fg)" : "var(--muted-fg)",
                  border: `1px solid ${
                    done
                      ? "var(--success)"
                      : active
                        ? "var(--primary)"
                        : "var(--border-strong)"
                  }`,
                  fontFamily: "var(--font-mono)",
                  fontSize: 10,
                  fontWeight: 700,
                }}
              >
                {done ? (
                  <Check size="xs" style={{ color: "var(--primary-fg)" }} />
                ) : (
                  (s.icon ?? i + 1)
                )}
              </span>
              <span className="hidden sm:block min-w-0">
                <span
                  className="block text-[11px] font-bold leading-tight truncate"
                  style={{
                    color: active
                      ? "var(--fg)"
                      : done
                        ? "var(--fg-soft)"
                        : "var(--muted-fg)",
                    fontFamily: "var(--font-display)",
                  }}
                >
                  {s.title}
                </span>
                {s.description && (
                  <span
                    className="block text-[10px] leading-tight truncate"
                    style={{ color: "var(--muted-fg-2)" }}
                  >
                    {s.description}
                  </span>
                )}
              </span>
            </button>
            {i < steps.length - 1 && (
              <span
                aria-hidden="true"
                className="flex-1 h-px min-w-2"
                style={{
                  background: done ? "var(--success)" : "var(--border-strong)",
                }}
              />
            )}
          </li>
        )
      })}
    </ol>
  )
}

/* ============================================================================
   PAGE HEADER — the consistent workspace title bar
   ========================================================================== */
export function PageHeader({
  title,
  subtitle,
  eyebrow,
  icon,
  count,
  actions,
  meta,
}: {
  title: ReactNode
  subtitle?: ReactNode
  eyebrow?: ReactNode
  icon?: ReactNode
  count?: { value: number | string; label?: string }
  actions?: ReactNode
  meta?: ReactNode
}) {
  return (
    <header
      className="flex items-center gap-3 px-4 shrink-0 rule-grad"
      style={{
        background:
          "linear-gradient(180deg, var(--surface) 60%, var(--surface-2))",
        borderBottom: "1px solid var(--border)",
        minHeight: 56,
        paddingTop: 10,
        paddingBottom: 10,
      }}
    >
      {icon && (
        <div
          className="w-9 h-9 shrink-0 rounded-[var(--radius)] flex items-center justify-center"
          style={{
            background: "var(--brand-grad)",
            color: "var(--primary-fg)",
            boxShadow: "var(--glow-brand-sm), inset 0 1px 0 rgba(255,255,255,0.25)",
          }}
        >
          {icon}
        </div>
      )}
      <div className="min-w-0">
        {eyebrow && (
          <div
            className="text-[10px] font-bold uppercase tracking-[0.12em] mb-0.5"
            style={{
              color: "var(--muted-fg-2)",
              fontFamily: "var(--font-display)",
            }}
          >
            {eyebrow}
          </div>
        )}
        <div className="flex items-center gap-2.5 min-w-0">
          <h1
            className="text-[15px] font-bold leading-none truncate"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {title}
          </h1>
          {count && (
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold tnum shrink-0"
              style={{
                background: "var(--surface-2)",
                border: "1px solid var(--border)",
                color: "var(--muted-fg)",
                fontFamily: "var(--font-mono)",
              }}
            >
              {count.value}
              {count.label && (
                <span style={{ color: "var(--muted-fg-2)" }}>
                  {count.label}
                </span>
              )}
            </span>
          )}
        </div>
        {subtitle && (
          <p
            className="text-[11.5px] mt-1 truncate"
            style={{ color: "var(--muted-fg)" }}
          >
            {subtitle}
          </p>
        )}
      </div>
      {meta && (
        <div className="ms-auto hidden md:flex items-center gap-2 shrink-0">
          {meta}
        </div>
      )}
      {actions && (
        <div className="ms-auto md:ms-3 flex items-center gap-1.5 shrink-0">
          {actions}
        </div>
      )}
    </header>
  )
}

/* ============================================================================
   BREADCRUMBS
   ========================================================================== */
export function Breadcrumbs({
  items,
}: {
  items: { label: ReactNode; onClick?: () => void }[]
}) {
  return (
    <nav
      aria-label="Breadcrumb"
      className="flex items-center gap-1 text-[11px]"
      style={{ fontFamily: "var(--font-display)" }}
    >
      {items.map((it, i) => (
        <React.Fragment key={i}>
          {i > 0 && (
            <ChevronR size="xs" style={{ color: "var(--muted-fg-2)" }} />
          )}
          {it.onClick ? (
            <button
              onClick={it.onClick}
              className="hover:underline transition-colors"
              style={{ color: "var(--muted-fg)" }}
            >
              {it.label}
            </button>
          ) : (
            <span
              style={{
                color:
                  i === items.length - 1 ? "var(--fg-soft)" : "var(--muted-fg)",
                fontWeight: i === items.length - 1 ? 600 : 400,
              }}
            >
              {it.label}
            </span>
          )}
        </React.Fragment>
      ))}
    </nav>
  )
}

/* ============================================================================
   MODAL — shared, accessible dialog surface used by FormModal/InfoModal/
   ConfirmDialog so every overlay in the app is visually identical.
   ========================================================================== */
function useFocusTrap(
  isOpen: boolean,
  ref: React.RefObject<HTMLElement | null>,
) {
  useEffect(() => {
    if (!isOpen || !ref.current) return
    const el = ref.current
    const focusable = el.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    )
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    first?.focus()
    const h = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault()
          last?.focus()
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault()
          first?.focus()
        }
      }
    }
    el.addEventListener("keydown", h)
    return () => el.removeEventListener("keydown", h)
  }, [isOpen, ref])
}

const MODAL_WIDTHS = {
  sm: "max-w-md",
  md: "max-w-2xl",
  lg: "max-w-4xl",
  xl: "max-w-6xl",
  form: "max-w-[720px]",
}

export function Modal({
  isOpen,
  onClose,
  title,
  subtitle,
  icon,
  size = "md",
  children,
  footer,
  accent,
  headerExtra,
}: {
  isOpen: boolean
  onClose: () => void
  title: ReactNode
  subtitle?: ReactNode
  icon?: ReactNode
  size?: "sm" | "md" | "lg" | "xl" | "form"
  children: ReactNode
  footer?: ReactNode
  accent?: "danger" | "primary"
  headerExtra?: ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  const titleId = React.useId()
  useFocusTrap(isOpen, ref)
  useEffect(() => {
    if (!isOpen) return
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", h)
    return () => document.removeEventListener("keydown", h)
  }, [isOpen, onClose])
  if (!isOpen) return null
  const barColor =
    accent === "danger"
      ? "var(--error)"
      : accent === "primary"
        ? "var(--primary)"
        : undefined
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-[fadeIn_0.12s_ease-out]"
      style={{ background: "rgba(8,11,18,0.55)", backdropFilter: "blur(3px)" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      aria-hidden="false"
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`w-full ${MODAL_WIDTHS[size]} flex flex-col overflow-hidden animate-[popIn_0.14s_ease-out]`}
        style={{
          background: "var(--surface)",
          color: "var(--fg)",
          maxHeight: "90vh",
          borderRadius: "var(--radius-lg)",
          border: "1px solid var(--border)",
          boxShadow: "var(--shadow-pop)",
        }}
      >
        {barColor && (
          <div
            style={{
              height: 3,
              background: barColor,
              borderTopLeftRadius: "var(--radius-lg)",
              borderTopRightRadius: "var(--radius-lg)",
            }}
            aria-hidden="true"
          />
        )}
        <div
          className="flex items-center gap-2.5 px-4 py-3 shrink-0"
          style={{
            borderBottom: "1px solid var(--border)",
            background: "var(--surface)",
          }}
        >
          {icon && (
            <span
              className="inline-flex w-7 h-7 shrink-0 items-center justify-center rounded-[var(--radius-sm)]"
              style={{
                background:
                  accent === "danger"
                    ? "var(--error-soft)"
                    : "var(--primary-soft)",
                color: accent === "danger" ? "var(--error)" : "var(--primary)",
              }}
            >
              {icon}
            </span>
          )}
          <div className="min-w-0">
            <h2
              id={titleId}
              className="font-bold text-[13.5px] tracking-tight"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {title}
            </h2>
            {subtitle && (
              <p
                className="text-[11px] truncate"
                style={{ color: "var(--muted-fg)" }}
              >
                {subtitle}
              </p>
            )}
          </div>
          {headerExtra && (
            <div className="ms-auto flex items-center gap-1.5">
              {headerExtra}
            </div>
          )}
          <div
            className={
              headerExtra
                ? "flex items-center gap-1"
                : "ms-auto flex items-center gap-1"
            }
          >
            <IconButton label="Close" onClick={onClose}>
              <Close size="sm" />
            </IconButton>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <div
            className="flex items-center gap-2 px-4 py-3 shrink-0"
            style={{
              borderTop: "1px solid var(--border)",
              background: "var(--surface-2)",
            }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}

export type { AppIconProps }
export interface ColumnFilterProps {
  value: string
  onChange: (value: string) => void
  /** Accessible name of the column this input filters. */
  label: string
  /** Suggestions shown while typing (searchable-dropdown behaviour). */
  options?: string[]
}

/**
 * Compact per-column search box. With `options` it behaves like a searchable
 * dropdown (native datalist: suggestions filter as you type, free text also
 * accepted); without, a plain contains-filter input. Escape clears.
 */
export function ColumnFilter({ value, onChange, label, options }: ColumnFilterProps) {
  const listId = useId()
  return (
    <>
      <div className="relative min-w-0">
        <span
          className="pointer-events-none absolute start-1.5 top-1/2 inline-flex -translate-y-1/2"
          style={{ color: "var(--muted-fg-2)" }}
          aria-hidden="true"
        >
          <Search size="xs" />
        </span>
        <input
          type="search"
          list={options && options.length ? listId : undefined}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") onChange("")
          }}
          aria-label={label}
          placeholder="Filter…"
          title={label}
          className="ctrl ctrl-sm w-full"
        />
      </div>
      {options && options.length > 0 && (
        <datalist id={listId}>
          {options.slice(0, 300).map((o) => (
            <option key={o} value={o} />
          ))}
        </datalist>
      )}
    </>
  )
}

