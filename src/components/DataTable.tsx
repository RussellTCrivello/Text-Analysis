import React, { useState, useCallback } from "react"
import { Sort, SortAsc, SortDesc, EmptyFile } from "./icons"
import { RowCheckbox } from "./ui"
import { fieldsOf, type EntityName } from "../core/schema"
import { docTypeMetadata } from "../core/framework"
import { normalizeTableLayout } from "../core/tableLayout"

export interface Column<T> {
  key: keyof T | string
  header: string
  width?: string
  sortable?: boolean
  render?: (row: T, idx: number) => React.ReactNode
  align?: "left" | "right" | "center"
  /**
   * Optional control (usually a ColumnFilter input) rendered in a dedicated
   * row under the header. Filtering itself lives in the owning view so the
   * row objects, display labels and sort/search stay a single story.
   */
  filter?: React.ReactNode
}

interface DataTableProps<T extends { id: string }> {
  columns: Column<T>[]
  data: T[]
  selectedId?: string
  selectedIds?: string[]
  onSelect?: (row: T | null) => void
  onSelectionChange?: (ids: string[]) => void
  onDoubleClick?: (row: T) => void
  emptyText?: string
  rowNumberOffset?: number
  density?: "compact" | "comfortable" | "expansive"
  /** Schema entity enables every database field to be opted into the display. */
  entity?: EntityName
}

export function DataTable<T extends { id: string }>({
  columns: configuredColumns,
  data,
  selectedId,
  selectedIds = [],
  onSelect,
  onSelectionChange,
  onDoubleClick,
  emptyText = "No records.",
  rowNumberOffset = 0,
  density = "comfortable",
  entity,
}: DataTableProps<T>) {
  const schemaColumns = entity
    ? fieldsOf(entity).map((field) => ({
        key: field.key,
        header: docTypeMetadata(entity).fields.find((item) => item.key === field.key)?.label ?? field.key,
        sortable: field.kind !== "textarea",
        render: (row: T) => <span className="truncate" title={String((row as Record<string, unknown>)[field.key] ?? "")}>{String((row as Record<string, unknown>)[field.key] ?? "—")}</span>,
      })) as Column<T>[]
    : []
  const configuredKeys = new Set(configuredColumns.map((column) => String(column.key)))
  const completeColumns = [...configuredColumns, ...schemaColumns.filter((column) => !configuredKeys.has(String(column.key)))]
  const columns = completeColumns
  const preferenceKey = `text-analysis.table.${columns.map((column) => String(column.key)).join(",")}`
  const [sortRules, setSortRules] = useState<Array<{ key: string; dir: "asc" | "desc" }>>(() => {
    try { return JSON.parse(localStorage.getItem(`${preferenceKey}.sort`) ?? "[]") } catch { return [] }
  })
  const savedLayout = entity ? normalizeTableLayout(entity) : null
  const [hiddenColumns, setHiddenColumns] = useState<string[]>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(`${preferenceKey}.hidden`) ?? "null")
      return Array.isArray(saved) ? saved : (savedLayout?.hidden ?? [])
    } catch { return savedLayout?.hidden ?? [] }
  })
  const [tableDensity, setTableDensity] = useState<"compact" | "comfortable" | "expansive">(() => {
    try { return (localStorage.getItem(`${preferenceKey}.density`) as "compact" | "comfortable" | "expansive") || density } catch { return density }
  })
  const [columnQuery, setColumnQuery] = useState("")
  const [profileName, setProfileName] = useState("")
  const [profiles, setProfiles] = useState<Record<string, { hidden: string[]; widths: Record<string, number>; pinned: string[]; order: string[]; density: "compact" | "comfortable" | "expansive"; sort: Array<{ key: string; dir: "asc" | "desc" }> }>>(() => {
    try { return JSON.parse(localStorage.getItem(`${preferenceKey}.profiles`) ?? "{}") } catch { return {} }
  })
  const [pinnedColumns, setPinnedColumns] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(`${preferenceKey}.pinned`) ?? "[]") } catch { return [] }
  })
  const [columnOrder, setColumnOrder] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(`${preferenceKey}.order`) ?? "[]") } catch { return [] }
  })
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() => {
    try { return JSON.parse(localStorage.getItem(`${preferenceKey}.widths`) ?? "{}") } catch { return {} }
  })
  const orderedColumns = [...columns].sort((a, b) => {
    const ai = columnOrder.indexOf(String(a.key))
    const bi = columnOrder.indexOf(String(b.key))
    return (ai < 0 ? columns.length : ai) - (bi < 0 ? columns.length : bi)
  })
  const visibleColumns = orderedColumns.filter((column) => !hiddenColumns.includes(String(column.key)))
  const pinStyle = (key: string): React.CSSProperties => {
    const position = pinnedColumns.indexOf(key)
    if (position < 0) return {}
    const left = pinnedColumns.slice(0, position).reduce((total, item) => total + (columnWidths[item] ?? 160), 0) + 72
    return { position: "sticky", left, zIndex: 3, background: "var(--card-bg)", boxShadow: "2px 0 4px rgba(0,0,0,.08)" }
  }
  const resizeColumn = (key: string, startX: number, startWidth: number) => {
    const move = (event: MouseEvent) => setColumnWidths((current) => ({ ...current, [key]: Math.max(72, Math.round(startWidth + event.clientX - startX)) }))
    const stop = () => { window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", stop) }
    window.addEventListener("mousemove", move)
    window.addEventListener("mouseup", stop)
  }

  // Global application density remains authoritative; the table menu can
  // temporarily refine it and the preference is kept per table.
  React.useEffect(() => { setTableDensity(density) }, [density])

  React.useEffect(() => {
    try {
      localStorage.setItem(`${preferenceKey}.hidden`, JSON.stringify(hiddenColumns))
      localStorage.setItem(`${preferenceKey}.density`, tableDensity)
      localStorage.setItem(`${preferenceKey}.widths`, JSON.stringify(columnWidths))
      localStorage.setItem(`${preferenceKey}.sort`, JSON.stringify(sortRules))
      localStorage.setItem(`${preferenceKey}.pinned`, JSON.stringify(pinnedColumns))
      localStorage.setItem(`${preferenceKey}.order`, JSON.stringify(columnOrder))
    } catch { /* private browsing or SSR */ }
  }, [preferenceKey, hiddenColumns, tableDensity, columnWidths, sortRules, pinnedColumns, columnOrder])

  const handleSort = useCallback((key: string, additive = false) => {
    setSortRules((current) => {
      const found = current.find((rule) => rule.key === key)
      const nextDir = found ? (found.dir === "asc" ? "desc" : "asc") : "asc"
      const next = additive ? current.filter((rule) => rule.key !== key) : []
      return [...next, { key, dir: nextDir }]
    })
  }, [])

  const sorted = React.useMemo(() => {
    if (!sortRules.length) return data
    return [...data].sort((a, b) => {
      for (const rule of sortRules) {
        const av = String((a as Record<string, unknown>)[rule.key] ?? "")
        const bv = String((b as Record<string, unknown>)[rule.key] ?? "")
        const cmp = av.localeCompare(bv, undefined, { numeric: true })
        if (cmp) return rule.dir === "asc" ? cmp : -cmp
      }
      return 0
    })
  }, [data, sortRules])

  const rowPy =
    tableDensity === "compact" ? "py-1" : tableDensity === "expansive" ? "py-3" : "py-2"

  const handleRowClick = (row: T, e: React.MouseEvent) => {
    if (onSelectionChange) {
      if (e.ctrlKey || e.metaKey) {
        const next = selectedIds.includes(row.id)
          ? selectedIds.filter((id) => id !== row.id)
          : [...selectedIds, row.id]
        onSelectionChange(next)
        onSelect?.(row)
      } else if (e.shiftKey && selectedIds.length > 0) {
        const lastId = selectedIds[selectedIds.length - 1]
        const lastIdx = sorted.findIndex((r) => r.id === lastId)
        const curIdx = sorted.findIndex((r) => r.id === row.id)
        const [from, to] =
          lastIdx < curIdx ? [lastIdx, curIdx] : [curIdx, lastIdx]
        const range = sorted.slice(from, to + 1).map((r) => r.id)
        onSelectionChange([...new Set([...selectedIds, ...range])])
        onSelect?.(row)
      } else {
        onSelectionChange([row.id])
        onSelect?.(row)
      }
    } else {
      onSelect?.(selectedId === row.id ? null : row)
    }
  }

  const isSelected = (row: T) =>
    selectedIds.length > 0
      ? selectedIds.includes(row.id)
      : selectedId === row.id

  const SortIcon = ({ col }: { col: Column<T> }) => {
    if (!col.sortable) return null
    const active = sortRules.find((rule) => rule.key === String(col.key))
    if (!active)
      return (
        <Sort className="opacity-0 group-hover:opacity-60 transition-opacity" />
      )
    return active.dir === "asc" ? (
      <SortAsc style={{ opacity: 1, color: "var(--primary)" }} />
    ) : (
      <SortDesc style={{ opacity: 1, color: "var(--primary)" }} />
    )
  }

  return (
    <div className="w-full h-full overflow-auto">
      <div className="sticky top-0 z-10 flex justify-end px-2 py-1" style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)" }}>
        <details className="relative">
          <summary className="cursor-pointer select-none rounded px-2 py-1 text-xs font-semibold" style={{ color: "var(--muted-fg)", border: "1px solid var(--border)" }}>
            Manage columns
          </summary>
          <div className="absolute end-0 mt-1 z-20 min-w-52 rounded p-2 shadow-lg" style={{ background: "var(--card-bg)", border: "1px solid var(--border)" }}>
            <div className="mb-1 text-[10px] uppercase tracking-wide" style={{ color: "var(--muted-fg)" }}>Displayed fields</div>
            <input className="ctrl mb-1 w-full text-xs" placeholder="Find a field…" value={columnQuery} onChange={(event) => setColumnQuery(event.target.value)} />
            {columns.filter((column) => `${column.header} ${String(column.key)}`.toLowerCase().includes(columnQuery.toLowerCase())).map((column) => {
              const key = String(column.key)
              return <label key={key} className="flex items-center gap-2 px-1 py-1 text-xs cursor-pointer">
                <input type="checkbox" checked={!hiddenColumns.includes(key)} onChange={() => setHiddenColumns((current) => current.includes(key) ? current.filter((item) => item !== key) : [...current, key])} />
                <span className="truncate">{column.header}</span>
                <button type="button" className="ms-auto text-[10px] underline" onClick={(event) => { event.preventDefault(); setPinnedColumns((current) => current.includes(key) ? current.filter((item) => item !== key) : [...current, key]) }}>
                  {pinnedColumns.includes(key) ? "Unpin" : "Pin"}
                </button>
                <button type="button" className="text-[10px]" title="Move field earlier" onClick={(event) => { event.preventDefault(); setColumnOrder((current) => { const base = current.length ? current : columns.map((item) => String(item.key)); const index = base.indexOf(key); if (index <= 0) return base; const next = [...base]; [next[index - 1], next[index]] = [next[index], next[index - 1]]; return next }) }}>↑</button>
                <button type="button" className="text-[10px]" title="Move field later" onClick={(event) => { event.preventDefault(); setColumnOrder((current) => { const base = current.length ? current : columns.map((item) => String(item.key)); const index = base.indexOf(key); if (index < 0 || index >= base.length - 1) return base; const next = [...base]; [next[index], next[index + 1]] = [next[index + 1], next[index]]; return next }) }}>↓</button>
              </label>
            })}
            <div className="mt-2 border-t pt-2" style={{ borderColor: "var(--border)" }}>
              <div className="mb-1 text-[10px] uppercase tracking-wide" style={{ color: "var(--muted-fg)" }}>Row density</div>
              <div className="flex gap-1">
                {(["compact", "comfortable", "expansive"] as const).map((option) => <button key={option} type="button" className="rounded px-1.5 py-1 text-[10px]" style={{ background: tableDensity === option ? "var(--primary)" : "var(--surface-2)", color: tableDensity === option ? "var(--primary-fg)" : "var(--fg)" }} onClick={() => setTableDensity(option)}>{option}</button>)}
              </div>
            </div>
            <div className="mt-2 border-t pt-2" style={{ borderColor: "var(--border)" }}>
              <div className="mb-1 text-[10px] uppercase tracking-wide" style={{ color: "var(--muted-fg)" }}>Saved layouts</div>
              <div className="flex gap-1">
                <input className="ctrl min-w-0 flex-1 text-xs" placeholder="Layout name" value={profileName} onChange={(event) => setProfileName(event.target.value)} />
                <button type="button" className="text-xs underline" onClick={() => { const name = profileName.trim(); if (!name) return; const next = { ...profiles, [name]: { hidden: hiddenColumns, widths: columnWidths, pinned: pinnedColumns, order: columnOrder, density: tableDensity, sort: sortRules } }; setProfiles(next); localStorage.setItem(`${preferenceKey}.profiles`, JSON.stringify(next)); setProfileName("") }}>Save</button>
              </div>
              {Object.keys(profiles).map((name) => <button key={name} type="button" className="mt-1 me-1 rounded px-1.5 py-1 text-[10px]" style={{ background: "var(--surface-2)" }} onClick={() => { const profile = profiles[name]; setHiddenColumns(profile.hidden); setColumnWidths(profile.widths); setPinnedColumns(profile.pinned); setColumnOrder(profile.order); setTableDensity(profile.density); setSortRules(profile.sort) }}>{name}</button>)}
            </div>
            <button type="button" className="mt-2 text-xs underline" onClick={() => { setHiddenColumns([]); setColumnWidths({}); setSortRules([]); setPinnedColumns([]); setColumnOrder([]); setTableDensity(density); localStorage.removeItem(`${preferenceKey}.hidden`); localStorage.removeItem(`${preferenceKey}.widths`); localStorage.removeItem(`${preferenceKey}.density`); localStorage.removeItem(`${preferenceKey}.sort`); localStorage.removeItem(`${preferenceKey}.order`) }}>Reset table layout</button>
          </div>
        </details>
      </div>
      <table
        className="w-full border-collapse"
        style={{ tableLayout: "fixed", minWidth: Math.max(720, visibleColumns.length * 140 + 72), fontFamily: "var(--font-body)" }}
      >
        <colgroup>
          {onSelectionChange && <col style={{ width: 36 }} />}
          <col style={{ width: 36 }} />
          {visibleColumns.map((col) => (
            <col key={String(col.key)} style={{ width: columnWidths[String(col.key)] ?? col.width ?? 160, minWidth: columnWidths[String(col.key)] ?? col.width ?? 72 }} />
          ))}
        </colgroup>

        <thead>
          <tr style={{ position: "sticky", top: 0, zIndex: 2, backdropFilter: "blur(8px) saturate(1.3)", WebkitBackdropFilter: "blur(8px) saturate(1.3)" }}>
            {onSelectionChange && (
              <th
                scope="col"
                className="px-2 text-center"
                style={{
                  background: "var(--thead-glass)",
                  borderBottom: "1px solid var(--border-strong)",
                  height: 34,
                }}
              >
                <RowCheckbox
                  checked={
                    data.length > 0 && selectedIds.length === data.length
                  }
                  mixed={
                    selectedIds.length > 0 && selectedIds.length < data.length
                  }
                  label={
                    selectedIds.length === data.length && data.length > 0
                      ? "Deselect all rows"
                      : "Select all rows"
                  }
                  onChange={(v) =>
                    onSelectionChange(v ? data.map((r) => r.id) : [])
                  }
                />
              </th>
            )}
            <th
              scope="col"
              className="text-center"
              aria-label="Row number"
              style={{
                background: "var(--thead-glass)",
                borderBottom: "1px solid var(--border-strong)",
                height: 34,
                color: "var(--muted-fg)",
                fontSize: "0.65rem",
                fontFamily: "var(--font-mono)",
                width: 36,
              }}
            >
              #
            </th>
            {visibleColumns.map((col) => (
              <th
                key={String(col.key)}
                scope="col"
                aria-sort={
                  col.sortable
                    ? sortRules.find((rule) => rule.key === String(col.key))
                      ? sortRules.find((rule) => rule.key === String(col.key))!.dir === "asc"
                        ? "ascending"
                        : "descending"
                      : "none"
                    : undefined
                }
                className="px-3 text-start"
                style={{
                  background: "var(--thead-glass)",
                  borderBottom: "1px solid var(--border-strong)",
                  height: 34,
                  color: "var(--fg-soft)",
                  fontSize: "0.84rem",
                  fontFamily: "var(--font-display)",
                  fontWeight: 600,
                  letterSpacing: "0.005em",
                  textAlign: col.align ?? "start",
                  ...pinStyle(String(col.key)),
                  userSelect: "none",
                  position: "relative",
                }}
              >
                {col.sortable ? (
                  <button
                    type="button"
                    onClick={(event) => handleSort(String(col.key), event.shiftKey)}
                    className="group inline-flex items-center gap-1 cursor-pointer rounded-[var(--radius-sm)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] hover:text-[var(--fg)] transition-colors"
                    style={{
                      color: "inherit",
                      font: "inherit",
                    }}
                    title={`Sort by ${col.header}`}
                  >
                    {col.header}
                    <SortIcon col={col} />
                  </button>
                ) : (
                  <span>{col.header}</span>
                )}
                <span
                  role="separator"
                  aria-label={`Resize ${col.header} column`}
                  onMouseDown={(event) => {
                    event.preventDefault()
                    resizeColumn(String(col.key), event.clientX, (event.currentTarget.parentElement?.getBoundingClientRect().width ?? 160))
                  }}
                  onDoubleClick={() => setColumnWidths((current) => { const next = { ...current }; delete next[String(col.key)]; return next })}
                  className="absolute end-0 top-0 h-full w-1 cursor-col-resize hover:bg-[var(--primary)]"
                />
              </th>
            ))}
          </tr>
          {visibleColumns.some((col) => col.filter) && (
            <tr aria-label="Column filters">
              {onSelectionChange && (
                <th style={{ background: "var(--thead-glass)" }} aria-hidden="true" />
              )}
              <th style={{ background: "var(--thead-glass)" }} aria-hidden="true" />
              {visibleColumns.map((col) => (
                <th
                  key={`filter-${String(col.key)}`}
                  className="px-1 pb-1.5 align-top"
                  style={{
                    background: "var(--thead-glass)",
                    borderTop: "1px solid var(--border)",
                  }}
                >
                  {col.filter ?? null}
                </th>
              ))}
            </tr>
          )}

        </thead>

        <tbody>
          {sorted.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length + (onSelectionChange ? 2 : 1) + 1}
                className="text-center"
                style={{
                  padding: "48px 16px",
                  color: "var(--muted-fg)",
                  fontSize: "0.8rem",
                }}
              >
                <div className="flex flex-col items-center gap-2">
                  <span style={{ color: "var(--muted-fg-2)", opacity: 0.6 }}>
                    <EmptyFile size="xl" />
                  </span>
                  <span>{emptyText}</span>
                </div>
              </td>
            </tr>
          ) : (
            sorted.map((row, idx) => {
              const sel = isSelected(row)
              return (
                <tr
                  key={row.id}
                  onClick={(e) => handleRowClick(row, e)}
                  onDoubleClick={() => onDoubleClick?.(row)}
                  aria-selected={sel}
                  className={`cursor-pointer transition-all duration-150 ${rowPy}`}
                  style={{
                    background: sel
                      ? "var(--primary-soft-2)"
                      : idx % 2 === 0
                        ? "var(--surface)"
                        : "var(--row-tint)",
                    color: "var(--fg)",
                    borderInlineStart: sel
                      ? "2px solid var(--primary)"
                      : "2px solid transparent",
                  }}
                  onMouseEnter={(e) => {
                    if (!sel)
                      e.currentTarget.style.background = "var(--row-hover)"
                  }}
                  onMouseLeave={(e) => {
                    if (!sel)
                      e.currentTarget.style.background =
                        idx % 2 === 0 ? "var(--surface)" : "var(--row-tint)"
                  }}
                >
                  {onSelectionChange && (
                    <td
                      className="px-2 text-center"
                      style={{ borderBottom: "1px solid var(--border)" }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <RowCheckbox
                        checked={selectedIds.includes(row.id)}
                        label={`Select row ${rowNumberOffset + idx + 1}`}
                        onChange={(v) => {
                          const next = v
                            ? [...selectedIds, row.id]
                            : selectedIds.filter((id) => id !== row.id)
                          onSelectionChange(next)
                        }}
                      />
                    </td>
                  )}
                  <td
                    className="text-center"
                    style={{
                      borderBottom: "1px solid var(--border)",
                      fontSize: "0.7rem",
                      fontFamily: "var(--font-mono)",
                      color: "var(--muted-fg)",
                      width: 38,
                      opacity: sel ? 0.65 : 0.5,
                    }}
                  >
                    {rowNumberOffset + idx + 1}
                  </td>
                  {visibleColumns.map((col) => (
                    <td
                      key={String(col.key)}
                      className="px-3 overflow-hidden"
                      style={{
                        borderBottom: "1px solid var(--border)",
                        textAlign: col.align ?? "start",
                        ...pinStyle(String(col.key)),
                        maxWidth: col.width ?? 200,
                        fontSize: "0.94rem",
                        lineHeight: 1.5,
                        fontWeight: 450,
                      }}
                    >
                      <div className="truncate">
                        {col.render
                          ? col.render(row, rowNumberOffset + idx)
                          : String(
                              (row as Record<string, unknown>)[
                                String(col.key)
                              ] ?? "—",
                            )}
                      </div>
                    </td>
                  ))}
                </tr>
              )
            })
          )}
        </tbody>
      </table>
    </div>
  )
}