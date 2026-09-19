import React, { useState, useCallback } from "react"
import { Sort, SortAsc, SortDesc, EmptyFile } from "./icons"
import { RowCheckbox } from "./ui"

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
}

export function DataTable<T extends { id: string }>({
  columns,
  data,
  selectedId,
  selectedIds = [],
  onSelect,
  onSelectionChange,
  onDoubleClick,
  emptyText = "No records.",
  rowNumberOffset = 0,
  density = "comfortable",
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string>("")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc")
  const preferenceKey = `text-analysis.table.${columns.map((column) => String(column.key)).join(",")}`
  const [hiddenColumns, setHiddenColumns] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(`${preferenceKey}.hidden`) ?? "[]") } catch { return [] }
  })
  const [tableDensity, setTableDensity] = useState<"compact" | "comfortable" | "expansive">(() => {
    try { return (localStorage.getItem(`${preferenceKey}.density`) as "compact" | "comfortable" | "expansive") || density } catch { return density }
  })
  const [columnQuery, setColumnQuery] = useState("")
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() => {
    try { return JSON.parse(localStorage.getItem(`${preferenceKey}.widths`) ?? "{}") } catch { return {} }
  })
  const visibleColumns = columns.filter((column) => !hiddenColumns.includes(String(column.key)))
  const resizeColumn = (key: string, startX: number, startWidth: number) => {
    const move = (event: MouseEvent) => setColumnWidths((current) => ({ ...current, [key]: Math.max(72, Math.round(startWidth + event.clientX - startX)) }))
    const stop = () => { window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", stop) }
    window.addEventListener("mousemove", move)
    window.addEventListener("mouseup", stop)
  }

  React.useEffect(() => {
    try {
      localStorage.setItem(`${preferenceKey}.hidden`, JSON.stringify(hiddenColumns))
      localStorage.setItem(`${preferenceKey}.density`, tableDensity)
      localStorage.setItem(`${preferenceKey}.widths`, JSON.stringify(columnWidths))
    } catch { /* private browsing or SSR */ }
  }, [preferenceKey, hiddenColumns, tableDensity, columnWidths])

  const handleSort = useCallback(
    (key: string) => {
      if (sortKey === key) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"))
      } else {
        setSortKey(key)
        setSortDir("asc")
      }
    },
    [sortKey],
  )

  const sorted = React.useMemo(() => {
    if (!sortKey) return data
    return [...data].sort((a, b) => {
      const av = String((a as Record<string, unknown>)[sortKey] ?? "")
      const bv = String((b as Record<string, unknown>)[sortKey] ?? "")
      const cmp = av.localeCompare(bv, undefined, { numeric: true })
      return sortDir === "asc" ? cmp : -cmp
    })
  }, [data, sortKey, sortDir])

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
    const active = sortKey === String(col.key)
    if (!active)
      return (
        <Sort className="opacity-0 group-hover:opacity-60 transition-opacity" />
      )
    return sortDir === "asc" ? (
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
                <span>{column.header}</span>
              </label>
            })}
            <div className="mt-2 border-t pt-2" style={{ borderColor: "var(--border)" }}>
              <div className="mb-1 text-[10px] uppercase tracking-wide" style={{ color: "var(--muted-fg)" }}>Row density</div>
              <div className="flex gap-1">
                {(["compact", "comfortable", "expansive"] as const).map((option) => <button key={option} type="button" className="rounded px-1.5 py-1 text-[10px]" style={{ background: tableDensity === option ? "var(--primary)" : "var(--surface-2)", color: tableDensity === option ? "var(--primary-fg)" : "var(--fg)" }} onClick={() => setTableDensity(option)}>{option}</button>)}
              </div>
            </div>
            <button type="button" className="mt-2 text-xs underline" onClick={() => { setHiddenColumns([]); setColumnWidths({}); setTableDensity(density); localStorage.removeItem(`${preferenceKey}.hidden`); localStorage.removeItem(`${preferenceKey}.widths`); localStorage.removeItem(`${preferenceKey}.density`) }}>Reset table layout</button>
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
                    ? sortKey === String(col.key)
                      ? sortDir === "asc"
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
                  userSelect: "none",
                  position: "relative",
                }}
              >
                {col.sortable ? (
                  <button
                    type="button"
                    onClick={() => handleSort(String(col.key))}
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