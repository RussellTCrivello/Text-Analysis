import React, { useState, useCallback } from 'react';

export interface Column<T> {
  key: keyof T | string;
  header: string;
  width?: string;
  sortable?: boolean;
  render?: (row: T, idx: number) => React.ReactNode;
  align?: 'left' | 'right' | 'center';
}

interface DataTableProps<T extends { id: string }> {
  columns: Column<T>[];
  data: T[];
  selectedId?: string;
  selectedIds?: string[];
  onSelect?: (row: T | null) => void;
  onSelectionChange?: (ids: string[]) => void;
  onDoubleClick?: (row: T) => void;
  emptyText?: string;
  rowNumberOffset?: number;
  density?: 'compact' | 'comfortable' | 'expansive';
}

export function DataTable<T extends { id: string }>({
  columns,
  data,
  selectedId,
  selectedIds = [],
  onSelect,
  onSelectionChange,
  onDoubleClick,
  emptyText = 'No records.',
  rowNumberOffset = 0,
  density = 'comfortable',
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string>('');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const handleSort = useCallback((key: string) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }, [sortKey]);

  const sorted = React.useMemo(() => {
    if (!sortKey) return data;
    return [...data].sort((a, b) => {
      const av = String((a as Record<string, unknown>)[sortKey] ?? '');
      const bv = String((b as Record<string, unknown>)[sortKey] ?? '');
      const cmp = av.localeCompare(bv, undefined, { numeric: true });
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [data, sortKey, sortDir]);

  const rowPy = density === 'compact' ? 'py-1' : density === 'expansive' ? 'py-3' : 'py-2';

  const handleRowClick = (row: T, e: React.MouseEvent) => {
    if (onSelectionChange) {
      if (e.ctrlKey || e.metaKey) {
        const next = selectedIds.includes(row.id)
          ? selectedIds.filter(id => id !== row.id)
          : [...selectedIds, row.id];
        onSelectionChange(next);
        onSelect?.(row);
      } else if (e.shiftKey && selectedIds.length > 0) {
        const lastId = selectedIds[selectedIds.length - 1];
        const lastIdx = sorted.findIndex(r => r.id === lastId);
        const curIdx = sorted.findIndex(r => r.id === row.id);
        const [from, to] = lastIdx < curIdx ? [lastIdx, curIdx] : [curIdx, lastIdx];
        const range = sorted.slice(from, to + 1).map(r => r.id);
        onSelectionChange([...new Set([...selectedIds, ...range])]);
        onSelect?.(row);
      } else {
        onSelectionChange([row.id]);
        onSelect?.(row);
      }
    } else {
      onSelect?.(selectedId === row.id ? null : row);
    }
  };

  const isSelected = (row: T) => selectedIds.length > 0 ? selectedIds.includes(row.id) : selectedId === row.id;

  const SortIcon = ({ col }: { col: Column<T> }) => {
    if (!col.sortable) return null;
    const active = sortKey === String(col.key);
    return (
      <svg
        width="8" height="10" viewBox="0 0 8 10" fill="none"
        className="ms-1 shrink-0 opacity-0 group-hover:opacity-60 transition-opacity"
        style={{ opacity: active ? 1 : undefined, color: active ? 'var(--primary)' : 'var(--muted-fg)' }}
      >
        <path d="M4 1v8M1 4l3-3 3 3" stroke={active && sortDir === 'asc' ? 'var(--primary)' : 'currentColor'} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" opacity={active && sortDir === 'desc' ? 0.3 : 1} />
        <path d="M1 6l3 3 3-3" stroke={active && sortDir === 'desc' ? 'var(--primary)' : 'currentColor'} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" opacity={active && sortDir === 'asc' ? 0.3 : 1} />
      </svg>
    );
  };

  return (
    <div className="w-full h-full overflow-auto">
      <table
        className="w-full border-collapse"
        style={{ tableLayout: 'fixed', fontFamily: 'var(--font-body)' }}
      >
        <colgroup>
          {onSelectionChange && <col style={{ width: 34 }} />}
          <col style={{ width: 36 }} />
          {columns.map(col => <col key={String(col.key)} style={{ width: col.width ?? 'auto' }} />)}
        </colgroup>

        <thead>
          <tr style={{ position: 'sticky', top: 0, zIndex: 2 }}>
            {onSelectionChange && (
              <th
                scope="col"
                className="px-2 text-center"
                style={{
                  background: 'var(--muted-bg)',
                  borderBottom: '2px solid var(--border)',
                  height: 32,
                }}
              >
                <input
                  type="checkbox"
                  checked={data.length > 0 && selectedIds.length === data.length}
                  onChange={e => onSelectionChange(e.target.checked ? data.map(r => r.id) : [])}
                  aria-label={selectedIds.length === data.length ? 'Deselect all rows' : 'Select all rows'}
                  className="cursor-pointer"
                  style={{ accentColor: 'var(--primary)' }}
                />
              </th>
            )}
            <th
              scope="col"
              className="text-center"
              aria-label="Row number"
              style={{
                background: 'var(--muted-bg)',
                borderBottom: '2px solid var(--border)',
                height: 32,
                color: 'var(--muted-fg)',
                fontSize: '0.65rem',
                fontFamily: 'var(--font-mono)',
                width: 36,
              }}
            >#</th>
            {columns.map(col => (
              <th
                key={String(col.key)}
                scope="col"
                aria-sort={col.sortable ? (sortKey === String(col.key) ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none') : undefined}
                className={`px-3 text-start group ${col.sortable ? 'cursor-pointer select-none' : ''}`}
                style={{
                  background: 'var(--muted-bg)',
                  borderBottom: '2px solid var(--border)',
                  height: 32,
                  color: 'var(--muted-fg)',
                  fontSize: '0.65rem',
                  fontFamily: 'var(--font-display)',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.07em',
                  textAlign: col.align ?? 'start',
                  userSelect: 'none',
                }}
                onClick={() => col.sortable && handleSort(String(col.key))}
                onMouseEnter={e => { if (col.sortable) (e.currentTarget as HTMLElement).style.color = 'var(--fg)'; }}
                onMouseLeave={e => { if (col.sortable) (e.currentTarget as HTMLElement).style.color = 'var(--muted-fg)'; }}
              >
                <span className="flex items-center gap-0.5">
                  {col.header}
                  <SortIcon col={col} />
                </span>
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
                style={{ padding: '48px 16px', color: 'var(--muted-fg)', fontSize: '0.8rem' }}
              >
                <div className="flex flex-col items-center gap-2">
                  <svg width="32" height="32" viewBox="0 0 32 32" fill="none" style={{ opacity: 0.25 }}>
                    <rect x="4" y="4" width="24" height="24" rx="3" stroke="currentColor" strokeWidth="1.5"/>
                    <path d="M10 11h12M10 16h8M10 21h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                  <span>{emptyText}</span>
                </div>
              </td>
            </tr>
          ) : (
            sorted.map((row, idx) => {
              const sel = isSelected(row);
              return (
                <tr
                  key={row.id}
                  onClick={e => handleRowClick(row, e)}
                  onDoubleClick={() => onDoubleClick?.(row)}
                  aria-selected={sel}
                  className={`cursor-pointer transition-all duration-75 ${rowPy}`}
                  style={{
                    background: sel
                      ? 'rgba(79, 110, 247, 0.08)'
                      : idx % 2 === 0 ? 'var(--card-bg)' : 'var(--muted-bg)',
                    color: 'var(--fg)',
                    borderInlineStart: sel ? '2px solid var(--primary)' : '2px solid transparent',
                  }}
                  onMouseEnter={e => { if (!sel) (e.currentTarget as HTMLElement).style.background = 'var(--secondary-bg)'; }}
                  onMouseLeave={e => { if (!sel) (e.currentTarget as HTMLElement).style.background = idx % 2 === 0 ? 'var(--card-bg)' : 'var(--muted-bg)'; }}
                >
                  {onSelectionChange && (
                    <td
                      className="px-2 text-center"
                      style={{ borderBottom: '1px solid var(--border)' }}
                      onClick={e => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(row.id)}
                        aria-label={`Select row ${rowNumberOffset + idx + 1}`}
                        onChange={e => {
                          const next = e.target.checked
                            ? [...selectedIds, row.id]
                            : selectedIds.filter(id => id !== row.id);
                          onSelectionChange(next);
                        }}
                        className="cursor-pointer"
                        style={{ accentColor: 'var(--primary)' }}
                      />
                    </td>
                  )}
                  <td
                    className="text-center"
                    style={{
                      borderBottom: '1px solid var(--border)',
                      fontSize: '0.65rem',
                      fontFamily: 'var(--font-mono)',
                      color: 'var(--muted-fg)',
                      width: 36,
                      opacity: sel ? 0.5 : 0.4,
                    }}
                  >
                    {rowNumberOffset + idx + 1}
                  </td>
                  {columns.map(col => (
                    <td
                      key={String(col.key)}
                      className="px-3 overflow-hidden"
                      style={{
                        borderBottom: '1px solid var(--border)',
                        textAlign: col.align ?? 'start',
                        maxWidth: col.width ?? 200,
                        fontSize: '0.75rem',
                        lineHeight: 1.4,
                      }}
                    >
                      <div className="truncate">
                        {col.render
                          ? col.render(row, rowNumberOffset + idx)
                          : String((row as Record<string, unknown>)[String(col.key)] ?? '—')}
                      </div>
                    </td>
                  ))}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
