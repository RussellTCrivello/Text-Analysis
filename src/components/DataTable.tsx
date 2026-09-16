import React, { useState, useCallback } from "react"
import { Sort, SortAsc, SortDesc, EmptyFile } from "./icons"

export interface Column<T> {
  key: keyof T | string
  header: string
  width?: string
  sortable?: boolean
  render?: (row: T, idx: number) => React.ReactNode
  align?: "left" | "right" | "center"
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
      <table
        className="w-full border-collapse"
        style={{ tableLayout: "fixed", fontFamily: "var(--font-body)" }}
      >
        <colgroup>
          {onSelectionChange && <col style={{ width: 34 }} />}
          <col style={{ width: 36 }} />
          {columns.map((col) => (
            <col key={String(col.key)} style={{ width: col.width ?? "auto" }} />
          ))}
        </colgroup>

        <thead>
          <tr style={{ position: "sticky", top: 0, zIndex: 2 }}>
            {onSelectionChange && (
              <th
                scope="col"
                className="px-2 text-center"
                style={{
                  background: "var(--surface-2)",
                  borderBottom: "2px solid var(--border)",
                  height: 32,
                }}
              >
                <input
                  type="checkbox"
                  checked={
                    data.length > 0 && selectedIds.length === data.length
                  }
                  onChange={(e) =>
                    onSelectionChange(
                      e.target.checked ? data.map((r) => r.id) : [],
                    )
                  }
                  aria-label={
                    selectedIds.length === data.length
                      ? "Deselect all rows"
                      : "Select all rows"
                  }
                  className="cursor-pointer"
                  style={{ accentColor: "var(--primary)" }}
                />
              </th>
            )}
            <th
              scope="col"
              className="text-center"
              aria-label="Row number"
              style={{
                background: "var(--surface-2)",
                borderBottom: "2px solid var(--border)",
                height: 32,
                color: "var(--muted-fg)",
                fontSize: "0.65rem",
                fontFamily: "var(--font-mono)",
                width: 36,
              }}
            >
              #
            </th>
            {columns.map((col) => (
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
                  background: "var(--surface-2)",
                  borderBottom: "2px solid var(--border)",
                  height: 32,
                  color: "var(--muted-fg)",
                  fontSize: "0.65rem",
                  fontFamily: "var(--font-display)",
                  fontWeight: 600,
                  letterSpacing: "0.07em",
                  textAlign: col.align ?? "start",
                  userSelect: "none",
                }}
              >
                {col.sortable ? (
                  <button
                    type="button"
                    onClick={() => handleSort(String(col.key))}
                    className="group inline-flex items-center gap-1 uppercase tracking-[0.07em] cursor-pointer rounded-[var(--radius-sm)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] hover:text-[var(--fg)] transition-colors"
                    style={{
                      color: "inherit",
                      font: "inherit",
                      textTransform: "uppercase",
                      letterSpacing: "0.07em",
                    }}
                    title={`Sort by ${col.header}`}
                  >
                    {col.header}
                    <SortIcon col={col} />
                  </button>
                ) : (
                  <span className="uppercase tracking-[0.07em]">
                    {col.header}
                  </span>
                )}
              </th>
            ))}
          </tr>
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
                  className={`cursor-pointer transition-all duration-75 ${rowPy}`}
                  style={{
                    background: sel
                      ? "var(--primary-soft)"
                      : idx % 2 === 0
                        ? "var(--surface)"
                        : "var(--surface-2)",
                    color: "var(--fg)",
                    borderInlineStart: sel
                      ? "2px solid var(--primary)"
                      : "2px solid transparent",
                  }}
                  onMouseEnter={(e) => {
                    if (!sel)
                      e.currentTarget.style.background = "var(--surface-3)"
                  }}
                  onMouseLeave={(e) => {
                    if (!sel)
                      e.currentTarget.style.background =
                        idx % 2 === 0 ? "var(--surface)" : "var(--surface-2)"
                  }}
                >
                  {onSelectionChange && (
                    <td
                      className="px-2 text-center"
                      style={{ borderBottom: "1px solid var(--border)" }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(row.id)}
                        aria-label={`Select row ${rowNumberOffset + idx + 1}`}
                        onChange={(e) => {
                          const next = e.target.checked
                            ? [...selectedIds, row.id]
                            : selectedIds.filter((id) => id !== row.id)
                          onSelectionChange(next)
                        }}
                        className="cursor-pointer"
                        style={{ accentColor: "var(--primary)" }}
                      />
                    </td>
                  )}
                  <td
                    className="text-center"
                    style={{
                      borderBottom: "1px solid var(--border)",
                      fontSize: "0.65rem",
                      fontFamily: "var(--font-mono)",
                      color: "var(--muted-fg)",
                      width: 36,
                      opacity: sel ? 0.5 : 0.4,
                    }}
                  >
                    {rowNumberOffset + idx + 1}
                  </td>
                  {columns.map((col) => (
                    <td
                      key={String(col.key)}
                      className="px-3 overflow-hidden"
                      style={{
                        borderBottom: "1px solid var(--border)",
                        textAlign: col.align ?? "start",
                        maxWidth: col.width ?? 200,
                        fontSize: "0.75rem",
                        lineHeight: 1.4,
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