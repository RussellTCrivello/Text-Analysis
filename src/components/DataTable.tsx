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
  const [hiddenColumns, setHiddenColumns] = useState<string[]>([])
  const visibleColumns = columns.filter((column) => !hiddenColumns.includes(String(column.key)))

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
    density === "compact" ? "py-1" : density === "expansive" ? "py-3" : "py-2"

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
            {columns.map((column) => {
              const key = String(column.key)
              return <label key={key} className="flex items-center gap-2 px-1 py-1 text-xs cursor-pointer">
                <input type="checkbox" checked={!hiddenColumns.includes(key)} onChange={() => setHiddenColumns((current) => current.includes(key) ? current.filter((item) => item !== key) : [...current, key])} />
                <span>{column.header}</span>
              </label>
            })}
            <button type="button" className="mt-1 text-xs underline" onClick={() => setHiddenColumns([])}>Show all fields</button>
          </div>
        </details>
      </div>
      <table
        className="w-full border-collapse"
        style={{ tableLayout: "fixed", fontFamily: "var(--font-body)" }}
      >
        <colgroup>
          {onSelectionChange && <col style={{ width: 36 }} />}
          <col style={{ width: 36 }} />
          {visibleColumns.map((col) => (
            <col key={String(col.key)} style={{ width: col.width ?? "auto" }} />
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