import React, { type ReactNode, useState, useRef, useEffect } from 'react';
import { formatDateTime, fromDateTimeLocal, nowIso, toDateTimeLocal } from '../core/text';
import { IconWarning, IconClose, IconExpandMore, IconMore, IconChevronRight, IconChevronLeft, IconChevronsLeft, IconChevronsRight, IconSearch, IconStatusX, IconSuccess, IconInfo, IconInbox, IconNoResults, IconError as IconErrorState, IconCheckGlyph, IconLoader } from './icons';
import type { RecordType, Source, Content, Analysis } from '../types';

/* ============================================================================
   BUTTON
   ========================================================================== */
interface BtnProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'success' | 'subtle';
  size?: 'xs' | 'sm' | 'md';
  icon?: ReactNode;
}

export function Btn({ variant = 'secondary', size = 'sm', icon, className = '', children, ...rest }: BtnProps) {
  const base =
    'inline-flex items-center justify-center gap-1.5 font-medium transition-all duration-150 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed whitespace-nowrap select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-1';
  const radii = { xs: 'rounded-[var(--radius-sm)]', sm: 'rounded-[var(--radius)]', md: 'rounded-[var(--radius)]' };
  const sizes = {
    xs: 'px-2.5 py-1 text-[11px] tracking-wide',
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
  };
  const vars: Record<string, string> = {
    primary:
      'bg-[var(--primary)] text-[var(--primary-fg)] hover:brightness-110 active:brightness-95 shadow-sm shadow-[var(--primary-soft)]',
    secondary:
      'border border-[var(--border-strong)] bg-[var(--surface)] text-[var(--fg)] hover:bg-[var(--surface-3)] hover:border-[var(--primary)] active:bg-[var(--surface-2)]',
    ghost:
      'text-[var(--fg-soft)] hover:bg-[var(--surface-3)] active:bg-[var(--surface-2)]',
    subtle:
      'bg-[var(--surface-2)] text-[var(--fg-soft)] border border-[var(--border)] hover:bg-[var(--surface-3)]',
    danger: 'bg-[var(--error)] text-white hover:brightness-110 active:brightness-95 shadow-sm',
    success: 'bg-[var(--success)] text-white hover:brightness-110 active:brightness-95 shadow-sm',
  };
  return (
    <button className={`${base} ${radii[size]} ${sizes[size]} ${vars[variant]} ${className}`} {...rest}>
      {icon && <span className="shrink-0 leading-none flex items-center">{icon}</span>}
      {children}
    </button>
  );
}

/* ============================================================================
   FIELD + INPUTS
   ========================================================================== */
interface FieldProps {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: ReactNode;
}

export function Field({ label, required, hint, error, children }: FieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[11px] font-semibold uppercase tracking-[0.07em]" style={{ color: 'var(--muted-fg)', fontFamily: 'var(--font-display)' }}>
        {label}
        {required && <span className="ms-1" style={{ color: 'var(--error)' }}>*</span>}
      </label>
      {children}
      {hint && <p className="text-[11px] leading-snug" style={{ color: 'var(--muted-fg-2)' }}>{hint}</p>}
      {error && (
        <p className="text-[11px] leading-snug font-medium flex items-center gap-1" style={{ color: 'var(--error)' }}>
          <IconWarning size="xs" />
          {error}
        </p>
      )}
    </div>
  );
}

export function Input({ className = '', error, ...rest }: React.InputHTMLAttributes<HTMLInputElement> & { error?: boolean }) {
  return (
    <input
      className={`w-full px-3 py-1.5 text-sm outline-none transition-all duration-150 ${className}`}
      style={{
        background: 'var(--surface)',
        color: 'var(--fg)',
        border: `1px solid ${error ? 'var(--error)' : 'var(--border-strong)'}`,
        borderRadius: 'var(--radius)',
        fontFamily: 'var(--font-body)',
        boxShadow: error ? '0 0 0 2px var(--error-soft)' : 'none',
      }}
      onFocus={(e) => { e.currentTarget.style.borderColor = error ? 'var(--error)' : 'var(--primary)'; e.currentTarget.style.boxShadow = error ? '0 0 0 3px var(--error-soft)' : '0 0 0 3px var(--primary-soft)'; }}
      onBlur={(e) => { e.currentTarget.style.borderColor = error ? 'var(--error)' : 'var(--border-strong)'; e.currentTarget.style.boxShadow = error ? '0 0 0 2px var(--error-soft)' : 'none'; }}
      {...rest}
    />
  );
}

export function Textarea({ className = '', ...rest }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={`w-full px-3 py-2 text-sm outline-none resize-y min-h-[80px] transition-all duration-150 ${className}`}
      style={{
        background: 'var(--surface)',
        color: 'var(--fg)',
        border: '1px solid var(--border-strong)',
        borderRadius: 'var(--radius)',
        fontFamily: 'var(--font-body)',
      }}
      onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.boxShadow = '0 0 0 3px var(--primary-soft)'; }}
      onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border-strong)'; e.currentTarget.style.boxShadow = 'none'; }}
      {...rest}
    />
  );
}

export function Select({ options, placeholder, className = '', grouped, ...rest }: React.SelectHTMLAttributes<HTMLSelectElement> & { options: { value: string; label: string; group?: string }[]; placeholder?: string; grouped?: boolean }) {
  const groups = grouped ? [...new Set(options.map((o) => o.group ?? ''))] : [];
  return (
    <select
      className={`w-full px-3 py-1.5 text-sm outline-none transition-all duration-150 appearance-none ${className}`}
      style={{
        background: 'var(--surface)',
        color: 'var(--fg)',
        border: '1px solid var(--border-strong)',
        borderRadius: 'var(--radius)',
        fontFamily: 'var(--font-body)',
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%2366707f'/%3E%3C/svg%3E")`,
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'right 10px center',
        paddingRight: 28,
      }}
      onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.boxShadow = '0 0 0 3px var(--primary-soft)'; }}
      onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border-strong)'; e.currentTarget.style.boxShadow = 'none'; }}
      {...rest}
    >
      {placeholder && <option value="">{placeholder}</option>}
      {grouped
        ? groups.map((g) => (
            <optgroup key={g} label={g}>
              {options.filter((o) => (o.group ?? '') === g).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </optgroup>
          ))
        : options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

/** Pill toggle used for dense boolean controls in toolbars/filters. */
export function ToggleChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className="px-2.5 py-1 rounded-[var(--radius-sm)] text-[10px] font-semibold uppercase tracking-[0.06em] transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
      style={{
        background: active ? 'var(--primary)' : 'var(--surface-2)',
        color: active ? 'var(--primary-fg)' : 'var(--muted-fg)',
        border: `1px solid ${active ? 'var(--primary)' : 'var(--border)'}`,
      }}
    >
      {children}
    </button>
  );
}

/* ============================================================================
   BADGES / TAGS / RECORD-TYPE
   ========================================================================== */
export function Badge({ children, color, size = 'sm' }: { children: ReactNode; color?: string; size?: 'xs' | 'sm' }) {
  const sz = size === 'xs' ? 'px-1.5 py-px text-[10px]' : 'px-2 py-0.5 text-[11px]';
  return (
    <span
      className={`inline-flex items-center font-semibold tracking-wide ${sz}`}
      style={{
        background: color ? color + '18' : 'var(--surface-3)',
        color: color ?? 'var(--fg-soft)',
        border: `1px solid ${color ? color + '38' : 'var(--border)'}`,
        borderRadius: 'var(--radius-sm)',
        fontFamily: 'var(--font-display)',
        letterSpacing: '0.03em',
      }}
    >
      {children}
    </span>
  );
}

const RECORD_COLORS: Record<RecordType, string> = {
  source: '#16A34A',
  content: '#EA580C',
  analysis: '#2563EB',
};

const RECORD_LABELS: Record<RecordType, string> = {
  source: 'SRC',
  content: 'CNT',
  analysis: 'ANL',
};

export function RecordTypeBadge({ type }: { type: RecordType }) {
  const color = RECORD_COLORS[type];
  return (
    <span
      className="inline-flex items-center px-1.5 py-px text-[10px] font-bold tracking-widest"
      style={{
        background: color + '1A',
        color,
        border: `1px solid ${color}3D`,
        borderRadius: 'var(--radius-sm)',
        fontFamily: 'var(--font-mono)',
        letterSpacing: '0.1em',
      }}
    >
      {RECORD_LABELS[type]}
    </span>
  );
}

export function recordTypeColor(type: RecordType): string {
  return RECORD_COLORS[type];
}

export function Tag({ children, color, onRemove }: { children: ReactNode; color?: string; onRemove?: () => void }) {
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium"
      style={{
        background: color ? color + '16' : 'var(--surface-3)',
        color: color ?? 'var(--fg-soft)',
        border: `1px solid ${color ? color + '3a' : 'var(--border)'}`,
        borderRadius: 'var(--radius-full)',
        fontFamily: 'var(--font-body)',
      }}
    >
      {children}
      {onRemove && (
        <button onClick={onRemove} aria-label="Remove" className="leading-none opacity-60 hover:opacity-100 focus-visible:outline-none" style={{ color: 'inherit' }}>
          <IconClose size="xs" />
        </button>
      )}
    </span>
  );
}

/* ============================================================================
   IMPORTANCE
   ========================================================================== */
export function ImportanceBar({ value }: { value: number }) {
  const pct = (value * 100).toFixed(2);
  const color = value >= 0.8 ? 'var(--error)' : value >= 0.6 ? 'var(--primary)' : value >= 0.3 ? 'var(--warning)' : 'var(--muted-fg)';
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 rounded-full overflow-hidden shrink-0" style={{ background: 'var(--surface-3)' }}>
        <div className="h-full rounded-full transition-all duration-300" style={{ width: `${value * 100}%`, background: color }} />
      </div>
      <span className="tnum" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color, minWidth: 52 }}>{pct}%</span>
    </div>
  );
}

export const ImportanceStars = ImportanceBar;

/* ============================================================================
   SEARCH / DATE INPUTS
   ========================================================================== */
export function SearchInput({ value, onChange, placeholder = 'Search…' }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="relative flex items-center" style={{ minWidth: 180 }}>
      <span className="absolute start-2.5 pointer-events-none inline-flex items-center" style={{ opacity: 0.5, color: 'var(--muted-fg)' }} aria-hidden="true"><IconSearch size="xs" /></span>
      <input
        type="text"
        role="searchbox"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full ps-8 pe-7 py-1.5 text-xs outline-none transition-all duration-150"
        style={{ background: 'var(--surface)', color: 'var(--fg)', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius)' }}
        onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.boxShadow = '0 0 0 3px var(--primary-soft)'; }}
        onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border-strong)'; e.currentTarget.style.boxShadow = 'none'; }}
      />
      {value && (
        <button
          onClick={() => onChange('')}
          aria-label="Clear search"
          className="absolute end-2 flex items-center justify-center w-4 h-4 rounded-full transition-colors hover:bg-[var(--surface-3)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
          style={{ color: 'var(--muted-fg)' }}
        >
          <IconClose size="xs" />
        </button>
      )}
    </div>
  );
}

export function DateTimeInput({ label, value, onChange, required, error, hint, showNow = true, className = '' }: { label?: string; value: string; onChange: (v: string) => void; required?: boolean; error?: boolean; hint?: string; showNow?: boolean; className?: string }) {
  const local = toDateTimeLocal(value);
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      {label && (
        <span className="text-[11px] font-semibold uppercase tracking-[0.07em] whitespace-nowrap" style={{ color: 'var(--muted-fg)', fontFamily: 'var(--font-display)' }}>
          {label}
          {required && <span className="ms-1" style={{ color: 'var(--error)' }}>*</span>}
        </span>
      )}
      <div className="flex items-center gap-1">
        <input
          type="datetime-local"
          value={local}
          onChange={(e) => onChange(fromDateTimeLocal(e.target.value) ?? '')}
          className="px-2 py-1.5 text-xs outline-none transition-all duration-150 w-full"
          style={{ background: 'var(--surface)', color: 'var(--fg)', border: `1px solid ${error ? 'var(--error)' : 'var(--border-strong)'}`, borderRadius: 'var(--radius)', fontFamily: 'var(--font-mono)' }}
          onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.boxShadow = '0 0 0 3px var(--primary-soft)'; }}
          onBlur={(e) => { e.currentTarget.style.borderColor = error ? 'var(--error)' : 'var(--border-strong)'; e.currentTarget.style.boxShadow = 'none'; }}
        />
        {showNow && (
          <button type="button" onClick={() => onChange(nowIso())} title="Set to now" className="px-2 py-1.5 text-xs rounded shrink-0 transition-colors hover:bg-[var(--surface-3)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]" style={{ background: 'var(--surface-2)', color: 'var(--muted-fg)', border: '1px solid var(--border)' }}>
            now
          </button>
        )}
      </div>
      {hint && <span className="text-[11px]" style={{ color: 'var(--muted-fg-2)' }}>{hint}</span>}
      {value && (
        <span className="text-[10px] tnum" style={{ color: 'var(--muted-fg)', fontFamily: 'var(--font-mono)' }}>
          {formatDateTime(value)}
        </span>
      )}
    </div>
  );
}

export function DateInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] font-medium shrink-0 whitespace-nowrap" style={{ color: 'var(--muted-fg)', fontFamily: 'var(--font-display)' }}>{label}</span>
      <input
        type="datetime-local"
        value={toDateTimeLocal(value)}
        onChange={(e) => onChange(fromDateTimeLocal(e.target.value) ?? '')}
        className="px-2 py-1.5 text-xs outline-none transition-all duration-150"
        style={{ background: 'var(--surface)', color: 'var(--fg)', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius)', fontFamily: 'var(--font-mono)' }}
        onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.boxShadow = '0 0 0 3px var(--primary-soft)'; }}
        onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border-strong)'; e.currentTarget.style.boxShadow = 'none'; }}
      />
    </div>
  );
}

/* ============================================================================
   TOOLBARS / FILTERS
   ========================================================================== */
export function Toolbar({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`flex items-center gap-1.5 px-3 py-2 shrink-0 flex-wrap ${className}`} style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
      {children}
    </div>
  );
}

export function ToolbarSep() {
  return <div className="w-px mx-0.5 self-stretch my-1" style={{ background: 'var(--border)' }} />;
}

export function FilterRow({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 shrink-0 flex-wrap" style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
      {children}
    </div>
  );
}

/* ============================================================================
   RESULTS / SELECTION / PAGINATION
   ========================================================================== */
export function ResultsStrip({ total, filtered, selected, recordsLabel = 'records', totalLabel = 'total', selectedLabel = 'selected' }: { total: number; filtered: number; selected: number; recordsLabel?: string; totalLabel?: string; selectedLabel?: string }) {
  return (
    <div className="flex items-center gap-2 px-3 shrink-0" style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)', height: 26, color: 'var(--muted-fg)', fontFamily: 'var(--font-mono)', fontSize: '0.68rem', letterSpacing: '0.02em' }}>
      <span><strong style={{ color: 'var(--fg)', fontWeight: 600 }}>{filtered}</strong> <span className="ms-0.5">{recordsLabel}</span></span>
      {filtered !== total && (<span style={{ opacity: 0.7 }}>· <strong style={{ color: 'var(--fg)' }}>{total}</strong> {totalLabel}</span>)}
      {selected > 0 && (<span style={{ color: 'var(--primary)', fontWeight: 600 }}>· {selected} {selectedLabel}</span>)}
    </div>
  );
}

export function SelectionBar({ count, onClear, onBulkDelete, onBulkEdit, label = 'selected' }: { count: number; onClear: () => void; onBulkDelete?: () => void; onBulkEdit?: () => void; label?: string }) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 shrink-0" style={{ background: 'var(--primary-soft)', borderTop: '1px solid var(--primary-soft-2)', borderBottom: '1px solid var(--primary-soft-2)' }}>
      <span className="text-[11px] font-semibold tnum flex items-center gap-1.5" style={{ color: 'var(--primary)', fontFamily: 'var(--font-mono)' }}>
        <span className="inline-flex items-center justify-center w-4 h-4 rounded-full text-[9px]" style={{ background: 'var(--primary)', color: 'var(--primary-fg)' }}>{count}</span>
        {count} {label}
      </span>
      <div className="flex-1" />
      {onBulkEdit && (
        <button onClick={onBulkEdit} className="px-2.5 py-1 text-[11px] font-medium rounded transition-colors hover:bg-[var(--surface-3)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]" style={{ color: 'var(--primary)', border: '1px solid var(--primary-soft-2)' }}>
          Edit All
        </button>
      )}
      {onBulkDelete && (
        <button onClick={onBulkDelete} className="px-2.5 py-1 text-[11px] font-medium rounded transition-colors hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]" style={{ background: 'var(--error)', color: '#fff' }}>
          Delete All
        </button>
      )}
      <button onClick={onClear} aria-label="Clear selection" className="px-2 py-1 text-[11px] rounded transition-colors hover:bg-[var(--surface-3)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]" style={{ color: 'var(--primary)', fontFamily: 'var(--font-mono)' }}>
        <IconClose size="xs" /> Clear
      </button>
    </div>
  );
}

const PAGE_SIZES = [25, 50, 100, 200, 500];

export function PaginationBar({ total, page, pageSize, onPage, onPageSize, perPageLabel = 'per page', pageLabel = 'Page', ofLabel = 'of', showingLabel = 'Showing' }: { total: number; page: number; pageSize: number; onPage: (p: number) => void; onPageSize: (s: number) => void; perPageLabel?: string; pageLabel?: string; ofLabel?: string; showingLabel?: string }) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = Math.min(total, (page - 1) * pageSize + 1);
  const end = Math.min(total, page * pageSize);
  const getPages = (): (number | '...')[] => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const pages: (number | '...')[] = [1];
    if (page > 3) pages.push('...');
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i);
    if (page < totalPages - 2) pages.push('...');
    pages.push(totalPages);
    return pages;
  };
  const pgBtn = (label: React.ReactNode, target: number, active = false, disabled = false, ariaLabel?: string) => (
    <button key={target} onClick={() => !disabled && onPage(target)} disabled={disabled} aria-current={active ? 'page' : undefined} aria-label={ariaLabel} className="min-w-[26px] h-[26px] px-1.5 text-[11px] font-medium flex items-center justify-center transition-all duration-150 disabled:opacity-30" style={{ background: active ? 'var(--primary)' : 'transparent', color: active ? 'var(--primary-fg)' : 'var(--muted-fg)', border: active ? '1px solid var(--primary)' : '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontFamily: active ? 'var(--font-mono)' : 'inherit' }}>
      {label}
    </button>
  );
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 shrink-0 flex-wrap" style={{ background: 'var(--surface)', borderTop: '1px solid var(--border)', minHeight: 36 }}>
      <span className="text-[11px] tnum" style={{ color: 'var(--muted-fg)', fontFamily: 'var(--font-mono)' }}>
        {showingLabel} <span style={{ color: 'var(--fg)', fontWeight: 600 }}>{start}–{end}</span> {ofLabel} <span style={{ color: 'var(--fg)', fontWeight: 600 }}>{total}</span>
      </span>
      <div className="flex-1" />
      <div className="flex items-center gap-0.5">
        {pgBtn(<IconChevronsLeft size="xs" />, 1, false, page === 1, 'First page')}
        {pgBtn(<IconChevronLeft size="xs" />, page - 1, false, page === 1, 'Previous page')}
        {getPages().map((p, i) => (p === '...' ? <span key={`e${i}`} className="text-xs px-1" style={{ color: 'var(--muted-fg)' }} aria-hidden="true">…</span> : pgBtn(p, p as number, p === page)))}
        {pgBtn(<IconChevronRight size="xs" />, page + 1, false, page === totalPages, 'Next page')}
        {pgBtn(<IconChevronsRight size="xs" />, totalPages, false, page === totalPages, 'Last page')}
      </div>
      <div className="flex items-center gap-2 ms-2">
        <span className="text-[11px]" style={{ color: 'var(--muted-fg)' }}>{perPageLabel}</span>
        <select value={pageSize} onChange={(e) => { onPageSize(Number(e.target.value)); onPage(1); }} className="text-[11px] px-2 py-1 outline-none tnum" style={{ background: 'var(--surface)', color: 'var(--fg)', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-sm)', fontFamily: 'var(--font-mono)' }}>
          {PAGE_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
    </div>
  );
}

/* ============================================================================
   FULL TEXT PREVIEW (collapsible detail strip shared across workspaces)
   ========================================================================== */
type AnyRecord = Source | Content | Analysis;

export function FullTextPreview({ record, recordType, sources = [], contents = [], label = 'Full Text Preview', emptyLabel = 'Select a record to preview its content here.' }: { record: AnyRecord | null; recordType: RecordType | null; sources?: Source[]; contents?: Content[]; label?: string; emptyLabel?: string }) {
  const [expanded, setExpanded] = useState(false);
  const getTitle = (): string => {
    if (!record) return '';
    if (recordType === 'source') return (record as Source).name;
    if (recordType === 'content') return (record as Content).title;
    if (recordType === 'analysis') {
      const a = record as Analysis;
      const c = contents.find((x) => x.id === a.content_id);
      return c?.title ?? a.classification;
    }
    return '';
  };
  const getPrimaryText = (): string => {
    if (!record) return '';
    if (recordType === 'source') return (record as Source).description;
    if (recordType === 'content') return (record as Content).content_data;
    if (recordType === 'analysis') {
      const a = record as Analysis;
      return [a.list_names_people, a.list_names_places, a.list_sides].filter(Boolean).join('\n');
    }
    return '';
  };
  const getFields = (): [string, string][] => {
    if (!record) return [];
    if (recordType === 'source') {
      const s = record as Source;
      return [['Type', s.type], ['Importance', `${(s.importance * 100).toFixed(2)}%`], ['Location', [s.city, s.country].filter(Boolean).join(', ')], ['Entry Date', s.date_entry], ['Accounts', s.accounts], ['Ownership', s.ownership]].filter(([, v]) => v) as [string, string][];
    }
    if (recordType === 'content') {
      const c = record as Content;
      const src = sources.find((s) => s.id === c.sources_id);
      return [['Source', src?.name ?? c.sources_id], ['Importance', `${(c.importance * 100).toFixed(2)}%`], ['Content Date', c.date_content], ['Attachments', c.attachments]].filter(([, v]) => v) as [string, string][];
    }
    if (recordType === 'analysis') {
      const a = record as Analysis;
      return [['Classification', a.classification], ['Sides', a.list_sides], ['Coordinates', a.list_coordinates], ['Analysis Date', a.date_analysis]].filter(([, v]) => v) as [string, string][];
    }
    return [];
  };

  return (
    <div className="shrink-0 overflow-hidden transition-all duration-200" style={{ height: expanded ? 280 : 36, borderTop: '2px solid var(--primary)', background: 'var(--surface)' }}>
      <button onClick={() => setExpanded((e) => !e)} aria-expanded={expanded} aria-controls="full-text-preview-body" className="w-full flex items-center gap-2.5 px-3 h-9 text-start transition-colors hover:bg-[var(--surface-2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--ring)]">
        <span className="text-[10px] font-bold uppercase tracking-[0.1em]" style={{ color: 'var(--primary)', fontFamily: 'var(--font-display)' }}>{label}</span>
        {record && recordType && (<><RecordTypeBadge type={recordType} /><span className="text-xs font-medium truncate" style={{ color: 'var(--fg)' }}>{getTitle()}</span></>)}
        <span className="ms-auto flex items-center transition-transform duration-200" style={{ color: 'var(--muted-fg)', transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)' }}><IconExpandMore size="xs" /></span>
      </button>

      {expanded && (
        <div className="flex" style={{ height: 'calc(100% - 36px)' }}>
          {!record ? (
            <div className="flex items-center justify-center w-full text-xs" style={{ color: 'var(--muted-fg)' }}>{emptyLabel}</div>
          ) : (
            <>
              <div className="flex-1 overflow-y-auto p-3 text-xs leading-relaxed" style={{ color: 'var(--fg)', borderRight: '1px solid var(--border)', whiteSpace: 'pre-wrap', fontFamily: 'var(--font-body)' }}>{getPrimaryText() || <span style={{ color: 'var(--muted-fg)' }}>—</span>}</div>
              <div className="w-52 shrink-0 overflow-y-auto py-1">
                {getFields().map(([k, v]) => (
                  <div key={k} className="px-3 py-1.5" style={{ borderBottom: '1px solid var(--border)' }}>
                    <div className="text-[10px] uppercase tracking-[0.07em] mb-0.5" style={{ color: 'var(--muted-fg)', fontFamily: 'var(--font-display)', fontWeight: 600 }}>{k}</div>
                    <div className="text-xs break-words" style={{ color: 'var(--fg)' }}>{v}</div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/* ============================================================================
   MORE MENU (overflow actions)
   ========================================================================== */
interface MenuItem { label: string; onClick: () => void; icon?: ReactNode; danger?: boolean; disabled?: boolean; divider?: boolean; }

export function MoreMenu({ items, label = 'More' }: { items: MenuItem[]; label?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((o) => !o)} aria-label={label} aria-haspopup="menu" aria-expanded={open} className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-[var(--radius)] transition-colors hover:bg-[var(--surface-3)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]" style={{ border: '1px solid var(--border-strong)', background: open ? 'var(--surface-3)' : 'var(--surface)', color: 'var(--fg)' }}>
        <IconMore size="sm" />
        {label}
      </button>
      {open && (
        <div role="menu" className="absolute end-0 top-full mt-1.5 z-50 overflow-hidden min-w-[190px] animate-[popIn_0.12s_ease-out]" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-pop)' }}>
          <div className="py-1">
            {items.map((item, i) =>
              item.divider ? <div key={`div-${i}`} className="mx-2 my-1" role="separator" style={{ height: 1, background: 'var(--border)' }} /> : (
                <button key={`mi-${i}`} role="menuitem" disabled={item.disabled} onClick={() => { item.onClick(); setOpen(false); }} className="w-full flex items-center gap-2.5 text-start px-3.5 py-2 text-xs transition-colors disabled:opacity-40 hover:bg-[var(--surface-3)] focus-visible:outline-none focus-visible:bg-[var(--surface-3)]" style={{ color: item.danger ? 'var(--error)' : 'var(--fg)', fontFamily: 'var(--font-body)' }}>
                  {item.icon && <span className="text-sm leading-none opacity-75" aria-hidden="true">{item.icon}</span>}
                  {item.label}
                </button>
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================================================================
   SECTION HEADER / STAT CARD / INLINE TABS
   ========================================================================== */
export function SectionHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="px-4 py-2.5 shrink-0 flex items-center gap-3" style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
      <div className="min-w-0">
        <h2 className="text-sm font-bold leading-tight" style={{ fontFamily: 'var(--font-display)' }}>{title}</h2>
        {subtitle && <p className="text-[11px] mt-0.5 truncate" style={{ color: 'var(--muted-fg)' }}>{subtitle}</p>}
      </div>
      {actions && <div className="ms-auto flex items-center gap-1.5">{actions}</div>}
    </div>
  );
}

export function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="flex flex-col gap-1 p-3" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', borderTop: color ? `2px solid ${color}` : '2px solid var(--border)' }}>
      <span className="text-[10px] font-bold uppercase tracking-[0.08em]" style={{ color: color ?? 'var(--muted-fg)', fontFamily: 'var(--font-display)' }}>{label}</span>
      <span className="text-2xl font-bold leading-none tnum" style={{ fontFamily: 'var(--font-mono)', color: color ?? 'var(--fg)' }}>{value}</span>
      {sub && <span className="text-[11px]" style={{ color: 'var(--muted-fg)' }}>{sub}</span>}
    </div>
  );
}

export function StatTile({ label, value, hint, color, icon }: { label: string; value: ReactNode; hint?: string; color?: string; icon?: ReactNode }) {
  return (
    <div className="flex items-center gap-3 px-3 py-1.5 rounded-[var(--radius)]" style={{ background: 'var(--surface-2)' }}>
      {icon && <span className="shrink-0 opacity-80" style={{ color: color ?? 'var(--muted-fg)' }}>{icon}</span>}
      <div className="flex items-baseline gap-1.5 min-w-0">
        <span className="text-sm font-bold tnum" style={{ fontFamily: 'var(--font-mono)', color: color ?? 'var(--fg)' }}>{value}</span>
        <span className="text-xs truncate" style={{ color: 'var(--muted-fg)' }}>{label}</span>
      </div>
      {hint && <span className="ms-auto text-[11px] truncate" style={{ color: 'var(--muted-fg-2)' }}>{hint}</span>}
    </div>
  );
}

interface Tab { id: string; label: string }
export function InlineTabs({ tabs, active, onChange }: { tabs: Tab[]; active: string; onChange: (id: string) => void }) {
  return (
    <div role="tablist" className="flex p-0.5 rounded-[var(--radius)]" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
      {tabs.map((tab) => (
        <button key={tab.id} role="tab" aria-selected={active === tab.id} onClick={() => onChange(tab.id)} className="px-3 py-1.5 text-xs font-semibold transition-colors rounded-[5px] relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]" style={{ color: active === tab.id ? 'var(--primary)' : 'var(--muted-fg)', background: active === tab.id ? 'var(--surface)' : 'transparent', fontFamily: 'var(--font-display)', letterSpacing: '0.02em', boxShadow: active === tab.id ? 'var(--shadow-1)' : 'none' }}>
          {tab.label}
        </button>
      ))}
    </div>
  );
}

/* ============================================================================
   SEGMENTED CONTROL (dense select for enums)
   ========================================================================== */
export function Segmented({ options, value, onChange, size = 'sm' }: { options: { value: string; label: string }[]; value: string; onChange: (v: string) => void; size?: 'sm' | 'xs' }) {
  const pad = size === 'xs' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs';
  return (
    <div role="group" className="inline-flex p-0.5 rounded-[var(--radius)]" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
      {options.map((o) => (
        <button key={o.value} aria-pressed={value === o.value} onClick={() => onChange(o.value)} className={`${pad} font-semibold uppercase tracking-[0.04em] rounded-[5px] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]`} style={{ color: value === o.value ? 'var(--primary)' : 'var(--muted-fg)', background: value === o.value ? 'var(--surface)' : 'transparent', fontFamily: 'var(--font-display)' }}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ============================================================================
   CHECKBOX / SWITCH / KBD
   ========================================================================== */
export function Checkbox({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label?: ReactNode; disabled?: boolean }) {
  return (
    <label className={`inline-flex items-center gap-2 text-xs cursor-pointer select-none ${disabled ? 'opacity-40' : ''}`} style={{ color: 'var(--fg-soft)' }}>
      <span className="relative inline-flex items-center justify-center w-4 h-4 rounded-[5px] shrink-0 transition-all" style={{ background: checked ? 'var(--primary)' : 'var(--surface)', border: `1.5px solid ${checked ? 'var(--primary)' : 'var(--border-strong)'}`, boxShadow: checked ? '0 0 0 3px var(--primary-soft)' : 'none' }}>
        {checked && <IconCheckGlyph size={11} strokeWidth={2.4} style={{ color: 'var(--primary-fg)' }} />}
        <input type="checkbox" className="sr-only" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      </span>
      {label}
    </label>
  );
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: ReactNode }) {
  return (
    <label className="inline-flex items-center gap-2 text-xs cursor-pointer select-none" style={{ color: 'var(--fg-soft)' }}>
      <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className="relative inline-flex items-center w-8 h-[18px] rounded-full transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]" style={{ background: checked ? 'var(--primary)' : 'var(--border-strong)' }}>
        <span className="absolute w-3.5 h-3.5 rounded-full bg-white transition-all duration-200" style={{ insetInlineStart: checked ? 'calc(100% - 15px)' : '2px', boxShadow: '0 1px 2px rgba(0,0,0,0.3)' }} />
      </button>
      {label}
    </label>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex items-center justify-center px-1.5 py-0.5 rounded text-[10px] font-semibold" style={{ background: 'var(--surface-2)', border: '1px solid var(--border-strong)', borderBottomWidth: 2, color: 'var(--fg-soft)', fontFamily: 'var(--font-mono)' }}>
      {children}
    </kbd>
  );
}

/* ============================================================================
   DIVIDER
   ========================================================================== */
export function Divider({ orientation = 'h', label }: { orientation?: 'h' | 'v'; label?: string }) {
  if (orientation === 'v') return <div className="w-px self-stretch" style={{ background: 'var(--border)' }} />;
  if (label) {
    return (
      <div className="flex items-center gap-2" style={{ color: 'var(--muted-fg)' }}>
        <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
        <span className="text-[10px] uppercase tracking-[0.08em] font-semibold">{label}</span>
        <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
      </div>
    );
  }
  return <div className="w-full h-px" style={{ background: 'var(--border)' }} />;
}

/* ============================================================================
   CARD / PANEL
   ========================================================================== */
export function Card({ children, className = '', padding = 'p-4', style }: { children: ReactNode; className?: string; padding?: string; style?: React.CSSProperties }) {
  return (
    <div className={`surface-card ${padding} ${className}`} style={style}>
      {children}
    </div>
  );
}

export function Panel({ title, subtitle, actions, children, className = '', bodyClassName = '' }: { title?: ReactNode; subtitle?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; bodyClassName?: string }) {
  return (
    <section className={`surface-card overflow-hidden flex flex-col ${className}`}>
      {(title || actions) && (
        <header className="flex items-center gap-2 px-3 py-2 shrink-0" style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface-2)' }}>
          <div className="min-w-0">
            {title && <div className="text-xs font-bold" style={{ fontFamily: 'var(--font-display)' }}>{title}</div>}
            {subtitle && <div className="text-[11px]" style={{ color: 'var(--muted-fg)' }}>{subtitle}</div>}
          </div>
          {actions && <div className="ms-auto flex items-center gap-1.5">{actions}</div>}
        </header>
      )}
      <div className={`flex-1 min-h-0 ${bodyClassName}`}>{children}</div>
    </section>
  );
}

/* ============================================================================
   ICON BUTTON
   ========================================================================== */
export function IconButton({ label, onClick, children, danger, active }: { label: string; onClick?: (e: React.MouseEvent) => void; children: ReactNode; danger?: boolean; active?: boolean }) {
  const color = danger ? 'var(--error)' : active ? 'var(--primary)' : 'var(--muted-fg)';
  return (
    <button onClick={onClick} aria-label={label} title={label} className="w-7 h-7 flex items-center justify-center rounded-[var(--radius-sm)] transition-all duration-150 hover:bg-[var(--surface-3)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]" style={{ color }}>
      {children}
    </button>
  );
}

/* ============================================================================
   SPINNER / PROGRESS / SKELETON
   ========================================================================== */
export function Spinner({ size = 16, color }: { size?: number; color?: string }) {
  return <IconLoader size={size} className="animate-spin" style={{ color: color ?? 'var(--primary)' }} strokeWidth={2.4} />;
}

export function Skeleton({ width = '100%', height = 12, radius = 6, className = '' }: { width?: number | string; height?: number | string; radius?: number; className?: string }) {
  return (
    <div className={`shrink-0 ${className}`} style={{ width, height, borderRadius: radius, background: 'linear-gradient(90deg, var(--surface-3) 25%, var(--surface-2) 37%, var(--surface-3) 63%)', backgroundSize: '480px 100%', animation: 'shimmer 1.3s infinite linear' }} />
  );
}

export function SkeletonRows({ rows = 6, className = '' }: { rows?: number; className?: string }) {
  return (
    <div className={`flex flex-col gap-2 p-4 ${className}`}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton width={28} height={28} radius={8} />
          <div className="flex-1 flex flex-col gap-1.5">
            <Skeleton width={`${50 + ((i * 13) % 40)}%`} height={11} />
            <Skeleton width={`${30 + ((i * 7) % 50)}%`} height={9} />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ============================================================================
   PAGE HEADER — the consistent workspace title bar
   ========================================================================== */
export function PageHeader({ title, subtitle, eyebrow, icon, count, actions, meta }: { title: ReactNode; subtitle?: ReactNode; eyebrow?: ReactNode; icon?: ReactNode; count?: { value: number | string; label?: string }; actions?: ReactNode; meta?: ReactNode }) {
  return (
    <header className="flex items-center gap-3 px-4 shrink-0" style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', minHeight: 56, paddingTop: 10, paddingBottom: 10 }}>
      {icon && (
        <div className="w-9 h-9 shrink-0 rounded-[var(--radius)] flex items-center justify-center text-base" style={{ background: 'var(--primary-soft)', color: 'var(--primary)', border: '1px solid var(--primary-soft-2)' }}>
          {icon}
        </div>
      )}
      <div className="min-w-0">
        {eyebrow && <div className="text-[10px] font-bold uppercase tracking-[0.12em] mb-0.5" style={{ color: 'var(--muted-fg-2)', fontFamily: 'var(--font-display)' }}>{eyebrow}</div>}
        <div className="flex items-center gap-2.5 min-w-0">
          <h1 className="text-[15px] font-bold leading-none truncate" style={{ fontFamily: 'var(--font-display)' }}>{title}</h1>
          {count && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold tnum shrink-0" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--muted-fg)', fontFamily: 'var(--font-mono)' }}>
              {count.value}
              {count.label && <span style={{ color: 'var(--muted-fg-2)' }}>{count.label}</span>}
            </span>
          )}
        </div>
        {subtitle && <p className="text-[11.5px] mt-1 truncate" style={{ color: 'var(--muted-fg)' }}>{subtitle}</p>}
      </div>
      {meta && <div className="ms-auto hidden md:flex items-center gap-2 shrink-0">{meta}</div>}
      {actions && <div className="ms-auto md:ms-3 flex items-center gap-1.5 shrink-0">{actions}</div>}
    </header>
  );
}

/* ============================================================================
   BREADCRUMBS
   ========================================================================== */
export function Breadcrumbs({ items }: { items: { label: ReactNode; onClick?: () => void }[] }) {
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-[11px]" style={{ fontFamily: 'var(--font-display)' }}>
      {items.map((it, i) => (
        <React.Fragment key={i}>
          {i > 0 && <span className="flex items-center" style={{ color: 'var(--border-strong)' }} aria-hidden="true"><IconChevronRight size="xs" /></span>}
          {it.onClick ? (
            <button onClick={it.onClick} className="hover:underline transition-colors" style={{ color: 'var(--muted-fg)' }}>{it.label}</button>
          ) : (
            <span style={{ color: i === items.length - 1 ? 'var(--fg-soft)' : 'var(--muted-fg)', fontWeight: i === items.length - 1 ? 600 : 400 }}>{it.label}</span>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
}

/* ============================================================================
   CALLOT / BANNER
   ========================================================================== */
export function Callout({ variant = 'info', title, children, icon, action, onClose }: { variant?: 'info' | 'success' | 'warning' | 'error'; title?: ReactNode; children?: ReactNode; icon?: ReactNode; action?: ReactNode; onClose?: () => void }) {
  const map = {
    info: { c: 'var(--info)', bg: 'var(--info-soft)', b: 'var(--info)' },
    success: { c: 'var(--success)', bg: 'var(--success-soft)', b: 'var(--success)' },
    warning: { c: 'var(--warning)', bg: 'var(--warning-soft)', b: 'var(--warning)' },
    error: { c: 'var(--error)', bg: 'var(--error-soft)', b: 'var(--error)' },
  }[variant];
  return (
    <div className="flex items-start gap-2.5 px-3 py-2 rounded-[var(--radius)] text-xs" style={{ background: map.bg, border: `1px solid ${map.b}40`, color: 'var(--fg-soft)' }} role="status">
      <span className="shrink-0 mt-0.5" style={{ color: map.c }}>{icon ?? (variant === 'error' ? <IconStatusX size="sm" /> : variant === 'warning' ? <IconWarning size="sm" /> : variant === 'success' ? <IconSuccess size="sm" /> : <IconInfo size="sm" />)}</span>
      <div className="min-w-0 flex-1">
        {title && <div className="font-semibold mb-0.5" style={{ color: map.c }}>{title}</div>}
        {children && <div style={{ color: 'var(--fg-soft)' }}>{children}</div>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
      {onClose && <button onClick={onClose} aria-label="Dismiss" className="shrink-0 opacity-60 hover:opacity-100" style={{ color: map.c }}><IconClose size="xs" /></button>}
    </div>
  );
}

/* ============================================================================
   EMPTY / STATE PANEL — covers empty, no-results, loading, error, success
   ========================================================================== */
const STATE_ICONS: Record<string, ReactNode> = {
  empty: <IconInbox />,
  noResults: <IconNoResults />,
  error: <IconErrorState />,
  success: <IconSuccess size="hero" />,
};

export function EmptyState({ title, description, icon, action, variant = 'empty', compact }: { title: string; description?: ReactNode; icon?: ReactNode; action?: ReactNode; variant?: 'empty' | 'noResults' | 'error' | 'success' | 'warning' | 'loading'; compact?: boolean }) {
  const color = variant === 'error' ? 'var(--error)' : variant === 'success' ? 'var(--success)' : variant === 'warning' ? 'var(--warning)' : variant === 'noResults' ? 'var(--muted-fg)' : 'var(--muted-fg-2)';
  return (
    <div className={`flex flex-col items-center justify-center text-center ${compact ? 'py-10' : 'py-20'} px-6 gap-3 animate-[fadeIn_0.2s_ease-out]`}>
      <div className="opacity-70" style={{ color }}>{variant === 'loading' ? <Spinner size={34} /> : (icon ?? STATE_ICONS[variant] ?? STATE_ICONS.empty)}</div>
      <div className="text-sm font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--fg)' }}>{title}</div>
      {description && <div className="text-xs max-w-sm leading-relaxed" style={{ color: 'var(--muted-fg)' }}>{description}</div>}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}

/* ============================================================================
   MODAL — shared, accessible dialog surface used by FormModal/InfoModal/
   ConfirmDialog so every overlay in the app is visually identical.
   ========================================================================== */
function useFocusTrap(isOpen: boolean, ref: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (!isOpen || !ref.current) return;
    const el = ref.current;
    const focusable = el.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    first?.focus();
    const h = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      if (e.shiftKey) { if (document.activeElement === first) { e.preventDefault(); last?.focus(); } }
      else { if (document.activeElement === last) { e.preventDefault(); first?.focus(); } }
    };
    el.addEventListener('keydown', h);
    return () => el.removeEventListener('keydown', h);
  }, [isOpen, ref]);
}

const MODAL_WIDTHS = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' };

export function Modal({ isOpen, onClose, title, size = 'lg', children, footer, accent, hideFooter }: { isOpen: boolean; onClose: () => void; title: ReactNode; size?: 'sm' | 'md' | 'lg' | 'xl'; children: ReactNode; footer?: ReactNode; accent?: 'danger'; hideFooter?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = React.useId();
  useFocusTrap(isOpen, ref);
  useEffect(() => {
    if (!isOpen) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [isOpen, onClose]);
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-[fadeIn_0.12s_ease-out]" style={{ background: 'rgba(8,11,18,0.55)', backdropFilter: 'blur(3px)' }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }} aria-hidden="false">
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby={titleId} className={`w-full ${MODAL_WIDTHS[size]} flex flex-col overflow-hidden animate-[popIn_0.14s_ease-out]`} style={{ background: 'var(--surface)', color: 'var(--fg)', maxHeight: '90vh', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-pop)' }}>
        {accent === 'danger' && <div style={{ height: 3, background: 'var(--error)', borderTopLeftRadius: 'var(--radius-lg)', borderTopRightRadius: 'var(--radius-lg)' }} />}
        <div className="flex items-center justify-between px-5 py-3.5 shrink-0" style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface-2)' }}>
          <h2 id={titleId} className="font-bold text-[13px] tracking-tight flex items-center gap-2" style={{ fontFamily: 'var(--font-display)' }}>
            {accent === 'danger' && <IconWarning size="sm" />}
            {title}
          </h2>
          <IconButton label="Close" onClick={onClose}><IconClose size="xs" /></IconButton>
        </div>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
        {!hideFooter && (footer || <div className="flex items-center justify-end gap-2 px-5 py-3 shrink-0" style={{ borderTop: '1px solid var(--border)', background: 'var(--surface-2)' }}>{footer}</div>)}
      </div>
    </div>
  );
}
