import React, { type ReactNode, useState, useRef, useEffect } from 'react';
import type { RecordType, Source, Content, Analysis } from '../types';

// ─── Button ───────────────────────────────────────────────────────────
interface BtnProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
  size?: 'xs' | 'sm' | 'md';
  icon?: string;
}

export function Btn({ variant = 'secondary', size = 'sm', icon, className = '', children, ...rest }: BtnProps) {
  const base = 'inline-flex items-center gap-1.5 font-medium transition-all duration-150 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed whitespace-nowrap select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-1';
  const radii = { xs: 'rounded', sm: 'rounded-[var(--radius)]', md: 'rounded-[var(--radius)]' };
  const sizes = {
    xs: 'px-2 py-0.5 text-[11px] tracking-wide',
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
  };
  const vars: Record<string, string> = {
    primary: 'bg-[var(--primary)] text-[var(--primary-fg)] hover:brightness-110 active:brightness-95 shadow-sm',
    secondary: 'border border-[var(--border)] bg-[var(--card-bg)] text-[var(--fg)] hover:bg-[var(--secondary-bg)] hover:border-[var(--primary)] active:bg-[var(--secondary-bg)]',
    ghost: 'text-[var(--fg)] hover:bg-[var(--secondary-bg)] active:bg-[var(--secondary-bg)]',
    danger: 'bg-[var(--error)] text-white hover:brightness-110 active:brightness-95 shadow-sm',
    success: 'bg-[var(--success)] text-white hover:brightness-110 active:brightness-95 shadow-sm',
  };
  return (
    <button className={`${base} ${radii[size]} ${sizes[size]} ${vars[variant]} ${className}`} {...rest}>
      {icon && <span className="shrink-0 leading-none">{icon}</span>}
      {children}
    </button>
  );
}

// ─── Field wrapper ────────────────────────────────────────────────────
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
        {label}{required && <span className="ms-1" style={{ color: 'var(--error)' }}>*</span>}
      </label>
      {children}
      {hint && <p className="text-[11px] leading-snug" style={{ color: 'var(--muted-fg)' }}>{hint}</p>}
      {error && <p className="text-[11px] leading-snug font-medium" style={{ color: 'var(--error)' }}>{error}</p>}
    </div>
  );
}

// ─── Input ────────────────────────────────────────────────────────────
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

export function Input({ className = '', error, ...rest }: InputProps) {
  return (
    <input
      className={`w-full px-3 py-1.5 text-sm outline-none transition-all duration-150 ${className}`}
      style={{
        background: 'var(--card-bg)',
        color: 'var(--fg)',
        border: `1px solid ${error ? 'var(--error)' : 'var(--border)'}`,
        borderRadius: 'var(--radius)',
        fontFamily: 'var(--font-body)',
        boxShadow: error ? '0 0 0 2px rgba(220,38,38,0.15)' : 'none',
      }}
      onFocus={e => { e.currentTarget.style.borderColor = error ? 'var(--error)' : 'var(--ring)'; e.currentTarget.style.boxShadow = error ? '0 0 0 3px rgba(220,38,38,0.15)' : '0 0 0 3px rgba(79,110,247,0.15)'; }}
      onBlur={e => { e.currentTarget.style.borderColor = error ? 'var(--error)' : 'var(--border)'; e.currentTarget.style.boxShadow = error ? '0 0 0 2px rgba(220,38,38,0.15)' : 'none'; }}
      {...rest}
    />
  );
}

// ─── Textarea ─────────────────────────────────────────────────────────
export function Textarea({ className = '', ...rest }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={`w-full px-3 py-2 text-sm outline-none resize-y min-h-[80px] transition-all duration-150 ${className}`}
      style={{
        background: 'var(--card-bg)',
        color: 'var(--fg)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        fontFamily: 'var(--font-body)',
      }}
      onFocus={e => { e.currentTarget.style.borderColor = 'var(--ring)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(79,110,247,0.15)'; }}
      onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.boxShadow = 'none'; }}
      {...rest}
    />
  );
}

// ─── Select ───────────────────────────────────────────────────────────
interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  options: { value: string; label: string }[];
  placeholder?: string;
}

export function Select({ options, placeholder, className = '', ...rest }: SelectProps) {
  return (
    <select
      className={`w-full px-3 py-1.5 text-sm outline-none transition-all duration-150 appearance-none ${className}`}
      style={{
        background: 'var(--card-bg)',
        color: 'var(--fg)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        fontFamily: 'var(--font-body)',
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%2364748B'/%3E%3C/svg%3E")`,
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'right 10px center',
        paddingRight: 28,
      }}
      onFocus={e => { e.currentTarget.style.borderColor = 'var(--ring)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(79,110,247,0.15)'; }}
      onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.boxShadow = 'none'; }}
      {...rest}
    >
      {placeholder && <option value="">{placeholder}</option>}
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

// ─── Badge ────────────────────────────────────────────────────────────
export function Badge({ children, color, size = 'sm' }: { children: ReactNode; color?: string; size?: 'xs' | 'sm' }) {
  const sz = size === 'xs' ? 'px-1.5 py-px text-[10px]' : 'px-2 py-0.5 text-[11px]';
  return (
    <span
      className={`inline-flex items-center font-semibold tracking-wide ${sz}`}
      style={{
        background: color ? color + '18' : 'var(--secondary-bg)',
        color: color ?? 'var(--muted-fg)',
        border: `1px solid ${color ? color + '35' : 'var(--border)'}`,
        borderRadius: 4,
        fontFamily: 'var(--font-display)',
        letterSpacing: '0.04em',
      }}
    >
      {children}
    </span>
  );
}

// ─── Record type badge ────────────────────────────────────────────────
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
  const label = RECORD_LABELS[type];
  return (
    <span
      className="inline-flex items-center px-1.5 py-px text-[10px] font-bold tracking-widest"
      style={{
        background: color + '18',
        color,
        border: `1px solid ${color}35`,
        borderRadius: 3,
        fontFamily: 'var(--font-mono)',
        letterSpacing: '0.1em',
      }}
    >
      {label}
    </span>
  );
}

export function recordTypeColor(type: RecordType): string {
  return RECORD_COLORS[type];
}

// ─── Importance bar ───────────────────────────────────────────────────
export function ImportanceBar({ value }: { value: number }) {
  const pct = (value * 100).toFixed(2);
  const color = value >= 0.8 ? 'var(--error)' : value >= 0.6 ? 'var(--primary)' : value >= 0.3 ? 'var(--warning)' : 'var(--muted-fg)';
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1 rounded-full overflow-hidden shrink-0" style={{ background: 'var(--border)' }}>
        <div className="h-full rounded-full transition-all duration-300" style={{ width: `${value * 100}%`, background: color }} />
      </div>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color, minWidth: 52, letterSpacing: '-0.01em' }}>{pct}%</span>
    </div>
  );
}

// ─── Search input ─────────────────────────────────────────────────────
export function SearchInput({ value, onChange, placeholder = 'Search…' }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="relative flex items-center" style={{ minWidth: 180 }}>
      <svg className="absolute start-2.5 pointer-events-none" width="12" height="12" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ opacity: 0.45, color: 'var(--muted-fg)' }} aria-hidden="true">
        <circle cx="6.5" cy="6.5" r="5" stroke="currentColor" strokeWidth="1.5" />
        <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      <input
        type="text"
        role="searchbox"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full ps-8 pe-7 py-1.5 text-xs outline-none transition-all duration-150"
        style={{
          background: 'var(--card-bg)',
          color: 'var(--fg)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          fontFamily: 'var(--font-body)',
        }}
        onFocus={e => { e.currentTarget.style.borderColor = 'var(--ring)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(79,110,247,0.13)'; }}
        onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.boxShadow = 'none'; }}
      />
      {value && (
        <button
          onClick={() => onChange('')}
          aria-label="Clear search"
          className="absolute end-2 flex items-center justify-center w-4 h-4 rounded-full text-[10px] transition-colors hover:bg-[var(--secondary-bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
          style={{ color: 'var(--muted-fg)' }}
        >✕</button>
      )}
    </div>
  );
}

// ─── Date input ───────────────────────────────────────────────────────
export function DateInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] font-medium shrink-0 whitespace-nowrap" style={{ color: 'var(--muted-fg)', fontFamily: 'var(--font-display)' }}>{label}</span>
      <input
        type="date"
        value={value}
        onChange={e => onChange(e.target.value)}
        className="px-2 py-1.5 text-xs outline-none transition-all duration-150"
        style={{
          background: 'var(--card-bg)',
          color: 'var(--fg)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          fontFamily: 'var(--font-mono)',
        }}
        onFocus={e => { e.currentTarget.style.borderColor = 'var(--ring)'; }}
        onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)'; }}
      />
    </div>
  );
}

// ─── Toolbar ──────────────────────────────────────────────────────────
export function Toolbar({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`flex items-center gap-1 px-3 py-2 shrink-0 flex-wrap ${className}`}
      style={{ background: 'var(--card-bg)', borderBottom: '1px solid var(--border)', minHeight: 40 }}
    >
      {children}
    </div>
  );
}

export function ToolbarSep() {
  return <div className="w-px mx-0.5 self-stretch my-0.5" style={{ background: 'var(--border)' }} />;
}

// ─── Filter row ───────────────────────────────────────────────────────
export function FilterRow({ children }: { children: ReactNode }) {
  return (
    <div
      className="flex items-center gap-2 px-3 py-2 shrink-0 flex-wrap"
      style={{
        background: 'var(--muted-bg)',
        borderBottom: '1px solid var(--border)',
        minHeight: 40,
      }}
    >
      {children}
    </div>
  );
}

// ─── Results strip ────────────────────────────────────────────────────
interface ResultsStripProps {
  total: number;
  filtered: number;
  selected: number;
  recordsLabel?: string;
  totalLabel?: string;
  selectedLabel?: string;
}

export function ResultsStrip({ total, filtered, selected, recordsLabel = 'records', totalLabel = 'total', selectedLabel = 'selected' }: ResultsStripProps) {
  return (
    <div
      className="flex items-center gap-2 px-3 shrink-0"
      style={{
        background: 'var(--muted-bg)',
        borderBottom: '1px solid var(--border)',
        height: 24,
        color: 'var(--muted-fg)',
        fontFamily: 'var(--font-mono)',
        fontSize: '0.68rem',
        letterSpacing: '0.02em',
      }}
    >
      <span>
        <strong style={{ color: 'var(--fg)', fontWeight: 600 }}>{filtered}</strong>
        <span className="ms-1">{recordsLabel}</span>
      </span>
      {filtered !== total && (
        <span style={{ opacity: 0.7 }}>
          · <strong style={{ color: 'var(--fg)' }}>{total}</strong> {totalLabel}
        </span>
      )}
      {selected > 0 && (
        <span style={{ color: 'var(--primary)', fontWeight: 600 }}>
          · {selected} {selectedLabel}
        </span>
      )}
    </div>
  );
}

// ─── Selection action bar ─────────────────────────────────────────────
interface SelectionBarProps {
  count: number;
  onClear: () => void;
  onBulkDelete?: () => void;
  onBulkEdit?: () => void;
  label?: string;
}

export function SelectionBar({ count, onClear, onBulkDelete, onBulkEdit, label = 'selected' }: SelectionBarProps) {
  return (
    <div
      className="flex items-center gap-2 px-3 py-1.5 shrink-0"
      style={{
        background: 'rgba(79, 110, 247, 0.07)',
        borderTop: '1px solid rgba(79, 110, 247, 0.25)',
        borderBottom: '1px solid rgba(79, 110, 247, 0.25)',
      }}
    >
      <span
        className="text-[11px] font-semibold"
        style={{ color: 'var(--primary)', fontFamily: 'var(--font-mono)' }}
      >
        {count} {label}
      </span>
      <div className="flex-1" />
      {onBulkEdit && (
        <button
          onClick={onBulkEdit}
          className="px-2.5 py-1 text-[11px] font-medium rounded transition-colors hover:bg-[var(--secondary-bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
          style={{ color: 'var(--primary)', border: '1px solid rgba(79,110,247,0.3)' }}
        >
          Edit All
        </button>
      )}
      {onBulkDelete && (
        <button
          onClick={onBulkDelete}
          className="px-2.5 py-1 text-[11px] font-medium rounded transition-colors hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
          style={{ background: 'var(--error)', color: '#fff' }}
        >
          Delete All
        </button>
      )}
      <button
        onClick={onClear}
        aria-label="Clear selection"
        className="px-2 py-1 text-[11px] rounded transition-colors hover:bg-[var(--secondary-bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
        style={{ color: 'var(--primary)', fontFamily: 'var(--font-mono)' }}
      >
        ✕ Clear
      </button>
    </div>
  );
}

// ─── Pagination bar ───────────────────────────────────────────────────
const PAGE_SIZES = [25, 50, 100, 200, 500];

interface PaginationBarProps {
  total: number;
  page: number;
  pageSize: number;
  onPage: (p: number) => void;
  onPageSize: (s: number) => void;
  perPageLabel?: string;
  pageLabel?: string;
  ofLabel?: string;
  showingLabel?: string;
}

export function PaginationBar({ total, page, pageSize, onPage, onPageSize, perPageLabel = 'per page', pageLabel = 'Page', ofLabel = 'of', showingLabel = 'Showing' }: PaginationBarProps) {
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

  const pgBtn = (label: string | number, target: number, active = false, disabled = false) => (
    <button
      key={`${label}-${target}`}
      onClick={() => !disabled && onPage(target)}
      disabled={disabled}
      className="min-w-[26px] h-[26px] px-1.5 text-[11px] font-medium flex items-center justify-center transition-all duration-150 disabled:opacity-30"
      style={{
        background: active ? 'var(--primary)' : 'transparent',
        color: active ? 'var(--primary-fg)' : 'var(--muted-fg)',
        border: active ? '1px solid var(--primary)' : '1px solid var(--border)',
        borderRadius: 4,
        fontFamily: active ? 'var(--font-mono)' : 'inherit',
      }}
    >
      {label}
    </button>
  );

  return (
    <div
      className="flex items-center gap-2 px-3 py-1.5 shrink-0 flex-wrap"
      style={{ background: 'var(--card-bg)', borderTop: '1px solid var(--border)', minHeight: 36 }}
    >
      <span className="text-[11px]" style={{ color: 'var(--muted-fg)', fontFamily: 'var(--font-mono)' }}>
        {showingLabel} <span style={{ color: 'var(--fg)', fontWeight: 600 }}>{start}–{end}</span> {ofLabel} <span style={{ color: 'var(--fg)', fontWeight: 600 }}>{total}</span>
      </span>
      <div className="flex-1" />
      <div className="flex items-center gap-0.5">
        {pgBtn('«', 1, false, page === 1)}
        {pgBtn('‹', page - 1, false, page === 1)}
        {getPages().map((p, i) =>
          p === '...'
            ? <span key={`e${i}`} className="text-xs px-1" style={{ color: 'var(--muted-fg)' }}>…</span>
            : pgBtn(p, p as number, p === page)
        )}
        {pgBtn('›', page + 1, false, page === totalPages)}
        {pgBtn('»', totalPages, false, page === totalPages)}
      </div>
      <div className="flex items-center gap-2 ms-2">
        <span className="text-[11px]" style={{ color: 'var(--muted-fg)' }}>{perPageLabel}</span>
        <select
          value={pageSize}
          onChange={e => { onPageSize(Number(e.target.value)); onPage(1); }}
          className="text-[11px] px-2 py-1 outline-none"
          style={{
            background: 'var(--card-bg)',
            color: 'var(--fg)',
            border: '1px solid var(--border)',
            borderRadius: 4,
            fontFamily: 'var(--font-mono)',
          }}
        >
          {PAGE_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
    </div>
  );
}

// ─── Full Text Preview panel ──────────────────────────────────────────
type AnyRecord = Source | Content | Analysis;

interface FullTextPreviewProps {
  record: AnyRecord | null;
  recordType: RecordType | null;
  sources?: Source[];
  contents?: Content[];
  label?: string;
  emptyLabel?: string;
}

export function FullTextPreview({ record, recordType, sources = [], contents = [], label = 'Full Text Preview', emptyLabel = 'Select a record to preview its content here.' }: FullTextPreviewProps) {
  const [expanded, setExpanded] = useState(false);

  const getTitle = (): string => {
    if (!record) return '';
    if (recordType === 'source') return (record as Source).name;
    if (recordType === 'content') return (record as Content).title;
    if (recordType === 'analysis') {
      const a = record as Analysis;
      const c = contents.find(x => x.id === a.content_id);
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
      return [
        ['Type', s.type],
        ['Importance', `${(s.importance * 100).toFixed(2)}%`],
        ['Location', [s.city, s.country].filter(Boolean).join(', ')],
        ['Entry Date', s.date_entry],
        ['Accounts', s.accounts],
        ['Ownership', s.ownership],
      ].filter(([, v]) => v) as [string, string][];
    }
    if (recordType === 'content') {
      const c = record as Content;
      const src = sources.find(s => s.id === c.sources_id);
      return [
        ['Source', src?.name ?? c.sources_id],
        ['Importance', `${(c.importance * 100).toFixed(2)}%`],
        ['Content Date', c.date_content],
        ['Attachments', c.attachments],
      ].filter(([, v]) => v) as [string, string][];
    }
    if (recordType === 'analysis') {
      const a = record as Analysis;
      return [
        ['Classification', a.classification],
        ['Sides', a.list_sides],
        ['Coordinates', a.list_coordinates],
        ['Analysis Date', a.date_analysis],
      ].filter(([, v]) => v) as [string, string][];
    }
    return [];
  };

  return (
    <div
      className="shrink-0 overflow-hidden transition-all duration-200"
      style={{
        height: expanded ? 280 : 36,
        borderTop: `2px solid var(--primary)`,
        background: 'var(--card-bg)',
      }}
    >
      {/* Header strip */}
      <button
        onClick={() => setExpanded(e => !e)}
        aria-expanded={expanded}
        aria-controls="full-text-preview-body"
        className="w-full flex items-center gap-2.5 px-3 h-9 text-start transition-colors hover:bg-[var(--muted-bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--ring)]"
      >
        <span
          className="text-[10px] font-bold uppercase tracking-[0.1em]"
          style={{ color: 'var(--primary)', fontFamily: 'var(--font-display)' }}
        >
          {label}
        </span>
        {record && recordType && (
          <>
            <RecordTypeBadge type={recordType} />
            <span className="text-xs font-medium truncate" style={{ color: 'var(--fg)' }}>{getTitle()}</span>
          </>
        )}
        <span
          className="ms-auto text-[10px] transition-transform duration-200"
          style={{ color: 'var(--muted-fg)', transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)', display: 'inline-block' }}
        >▾</span>
      </button>

      {/* Expanded body */}
      {expanded && (
        <div className="flex" style={{ height: 'calc(100% - 36px)' }}>
          {!record ? (
            <div className="flex items-center justify-center w-full text-xs" style={{ color: 'var(--muted-fg)' }}>
              {emptyLabel}
            </div>
          ) : (
            <>
              <div
                className="flex-1 overflow-y-auto p-3 text-xs leading-relaxed"
                style={{ color: 'var(--fg)', borderRight: '1px solid var(--border)', whiteSpace: 'pre-wrap', fontFamily: 'var(--font-body)' }}
              >
                {getPrimaryText() || <span style={{ color: 'var(--muted-fg)' }}>—</span>}
              </div>
              <div className="w-52 shrink-0 overflow-y-auto py-1">
                {getFields().map(([k, v]) => (
                  <div key={k} className="px-3 py-1.5" style={{ borderBottom: '1px solid var(--border)' }}>
                    <div
                      className="text-[10px] uppercase tracking-[0.07em] mb-0.5"
                      style={{ color: 'var(--muted-fg)', fontFamily: 'var(--font-display)', fontWeight: 600 }}
                    >{k}</div>
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

// ─── Dropdown menu (More ⋯) ───────────────────────────────────────────
interface MenuItem {
  label: string;
  onClick: () => void;
  icon?: string;
  danger?: boolean;
  disabled?: boolean;
  divider?: boolean;
}

export function MoreMenu({ items }: { items: MenuItem[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        aria-label="More options"
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex items-center justify-center px-2.5 py-1.5 text-sm font-medium transition-colors rounded-[var(--radius)] hover:bg-[var(--secondary-bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
        style={{
          border: '1px solid var(--border)',
          background: open ? 'var(--secondary-bg)' : 'var(--card-bg)',
          color: 'var(--fg)',
          letterSpacing: '0.08em',
        }}
      >⋯</button>
      {open && (
        <div
          role="menu"
          className="absolute end-0 top-full mt-1.5 z-50 overflow-hidden min-w-[180px]"
          style={{
            background: 'var(--card-bg)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.15), 0 2px 6px rgba(0,0,0,0.08)',
          }}
        >
          <div className="py-1">
            {items.map((item, i) =>
              item.divider ? (
                <div key={`div-${i}`} className="mx-2 my-1" role="separator" style={{ height: 1, background: 'var(--border)' }} />
              ) : (
                <button
                  key={`mi-${i}`}
                  role="menuitem"
                  disabled={item.disabled}
                  onClick={() => { item.onClick(); setOpen(false); }}
                  className="w-full flex items-center gap-2.5 text-start px-3.5 py-2 text-xs transition-colors disabled:opacity-40 hover:bg-[var(--muted-bg)] focus-visible:outline-none focus-visible:bg-[var(--muted-bg)]"
                  style={{ color: item.danger ? 'var(--error)' : 'var(--fg)', fontFamily: 'var(--font-body)' }}
                >
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

// ─── Section header ───────────────────────────────────────────────────
export function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="px-4 py-2.5 shrink-0" style={{ borderBottom: '1px solid var(--border)', background: 'var(--card-bg)' }}>
      <h2 className="text-sm font-bold leading-tight" style={{ fontFamily: 'var(--font-display)', color: 'var(--fg)' }}>{title}</h2>
      {subtitle && <p className="text-[11px] mt-0.5" style={{ color: 'var(--muted-fg)' }}>{subtitle}</p>}
    </div>
  );
}

// ─── Stat card ────────────────────────────────────────────────────────
export function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div
      className="flex flex-col gap-1 p-3"
      style={{
        background: 'var(--card-bg)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        borderTop: color ? `2px solid ${color}` : '2px solid var(--border)',
      }}
    >
      <span
        className="text-[10px] font-bold uppercase tracking-[0.08em]"
        style={{ color: color ?? 'var(--muted-fg)', fontFamily: 'var(--font-display)' }}
      >{label}</span>
      <span
        className="text-2xl font-bold leading-none"
        style={{ fontFamily: 'var(--font-mono)', color: color ?? 'var(--fg)' }}
      >{value}</span>
      {sub && <span className="text-[11px]" style={{ color: 'var(--muted-fg)' }}>{sub}</span>}
    </div>
  );
}

// ─── Inline tabs ──────────────────────────────────────────────────────
interface Tab { id: string; label: string }

export function InlineTabs({ tabs, active, onChange }: { tabs: Tab[]; active: string; onChange: (id: string) => void }) {
  return (
    <div role="tablist" className="flex" style={{ borderBottom: '1px solid var(--border)' }}>
      {tabs.map(tab => (
        <button
          key={tab.id}
          role="tab"
          aria-selected={active === tab.id}
          onClick={() => onChange(tab.id)}
          className="px-4 py-2 text-xs font-semibold transition-colors relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-inset"
          style={{
            color: active === tab.id ? 'var(--primary)' : 'var(--muted-fg)',
            background: 'transparent',
            fontFamily: 'var(--font-display)',
            letterSpacing: '0.02em',
          }}
        >
          {tab.label}
          {active === tab.id && (
            <span
              aria-hidden="true"
              className="absolute bottom-0 start-0 end-0 h-0.5"
              style={{ background: 'var(--primary)' }}
            />
          )}
        </button>
      ))}
    </div>
  );
}

// Legacy alias
export const ImportanceStars = ImportanceBar;
