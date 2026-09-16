/**
 * Performance monitor with real numbers: it benchmarks the SQL engine against
 * the live workspace and reports repository/storage metrics. Nothing here is
 * simulated — every figure comes from a measurement taken when the panel opens.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { InfoModal } from './FormModal';
import { Btn } from './ui';
import { useAppData } from '../store/AppContext';
import { formatBytes } from '../core/text';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

interface Benchmark {
  label: string;
  sql: string;
  rows: number;
  scanned: number;
  elapsedMs: number;
  ok: boolean;
}

const BENCHMARKS: { label: string; sql: string }[] = [
  { label: 'Full source scan', sql: 'SELECT * FROM sources' },
  { label: 'Content join', sql: 'SELECT c.title, s.name AS source_name FROM contents c JOIN sources s ON c.sources_id = s.id' },
  { label: 'Grouped aggregation', sql: 'SELECT type, COUNT(*) AS n, AVG(importance) AS avg_importance FROM sources GROUP BY type ORDER BY n DESC' },
  { label: 'Filtered + ordered', sql: 'SELECT name, importance FROM sources WHERE importance > 0.5 ORDER BY importance DESC LIMIT 50' },
  { label: 'Analysis lookup', sql: 'SELECT classification, COUNT(*) AS n FROM analyses GROUP BY classification HAVING n >= 1' },
];

const SLOW_MS = 50;

export function PerformanceMonitor({ isOpen, onClose }: Props) {
  const { repo, stats, sql } = useAppData();
  const [runs, setRuns] = useState<Benchmark[][]>([]);

  const measure = useCallback(() => {
    const pass: Benchmark[] = BENCHMARKS.map(({ label, sql: statement }) => {
      const out = sql.run(statement);
      if (out.error || !out.result) {
        return { label, sql: statement, rows: 0, scanned: 0, elapsedMs: 0, ok: false };
      }
      return {
        label,
        sql: statement,
        rows: out.result.rows.length,
        scanned: out.result.scanned,
        elapsedMs: out.result.elapsedMs,
        ok: true,
      };
    });
    setRuns((r) => [...r.slice(-4), pass]);
  }, [sql]);

  useEffect(() => {
    if (isOpen) measure();
  }, [isOpen, measure]);

  const latest = runs[runs.length - 1] ?? [];
  const times = latest.filter((b) => b.ok).map((b) => b.elapsedMs);
  const totalTime = times.reduce((n, t) => n + t, 0);
  const avgTime = times.length ? totalTime / times.length : 0;
  const maxTime = times.length ? Math.max(...times) : 0;
  const slow = latest.filter((b) => b.ok && b.elapsedMs > SLOW_MS);
  const scannedRows = latest.reduce((n, b) => n + b.scanned, 0);

  const storageBytes = (() => {
    let total = 0;
    for (const key of ['tam_data', 'tam.backups.v3', 'tam.knowledge.v3', 'tam.searches', 'tam_settings']) {
      total += (localStorage.getItem(key) ?? '').length * 2;
    }
    return total;
  })();

  const orphans = Object.entries(stats.orphans).filter(([, n]) => n > 0);

  const suggestions = [
    ...orphans.map(([entity, n]) => ({
      level: 'warning',
      title: `Orphaned ${entity}`,
      desc: `${n} record(s) reference a missing parent. Use merge/restore with the referential check, or delete them.`,
    })),
    ...slow.map((b) => ({
      level: 'info',
      title: `Slow query: ${b.label}`,
      desc: `${b.elapsedMs.toFixed(2)} ms over ${b.scanned} scanned rows. Consider narrowing the WHERE clause or a LIMIT.`,
    })),
    stats.total > 5000
      ? { level: 'info', title: 'Workspace size', desc: `${stats.total} records. Exports stay fast, but the browser store grows with every backup kept.` }
      : null,
  ].filter(Boolean) as { level: string; title: string; desc: string }[];

  const bar = (value: number, max: number, color: string) => (
    <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
      <div className="h-full rounded-full" style={{ width: `${max ? Math.min(100, (value / max) * 100) : 0}%`, background: color }} />
    </div>
  );

  const stat = (label: string, value: string | number, mono = true) => (
    <div className="flex items-baseline gap-3 py-1.5" style={{ borderBottom: '1px solid var(--border)' }}>
      <span className="text-xs w-44 shrink-0" style={{ color: 'var(--muted-fg)' }}>{label}</span>
      <span className={`text-sm font-semibold ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  );

  return (
    <InfoModal isOpen={isOpen} title="Performance Monitor" onClose={onClose} size="lg">
      <div className="flex flex-col gap-4">
        <div className="rounded-xl p-4" style={{ background: 'var(--secondary-bg)' }}>
          <div className="text-xs font-bold uppercase tracking-wide mb-3" style={{ color: 'var(--muted-fg)' }}>
            Query benchmark · {runs.length} run(s) this session
          </div>
          {stat('Queries executed', latest.length)}
          {stat('Rows scanned', scannedRows)}
          {stat('Total time', `${totalTime.toFixed(2)} ms`)}
          {stat('Average time', `${avgTime.toFixed(2)} ms`)}
          {stat('Slowest query', `${maxTime.toFixed(2)} ms`)}
          {stat(`Slow queries (> ${SLOW_MS} ms)`, slow.length)}
          <div className="mt-3 flex flex-col gap-2">
            <div>
              <div className="flex justify-between text-xs mb-0.5">
                <span style={{ color: 'var(--muted-fg)' }}>Average query time</span>
                <span className="font-mono">{avgTime.toFixed(2)} ms</span>
              </div>
              {bar(avgTime, 100, avgTime > 50 ? '#f59e0b' : 'var(--primary)')}
            </div>
            <div>
              <div className="flex justify-between text-xs mb-0.5">
                <span style={{ color: 'var(--muted-fg)' }}>Rows scanned per query</span>
                <span className="font-mono">{latest.length ? Math.round(scannedRows / latest.length) : 0}</span>
              </div>
              {bar(scannedRows / Math.max(1, latest.length), stats.total || 1, '#1d4ed8')}
            </div>
          </div>
        </div>

        <div className="rounded-xl p-4" style={{ background: 'var(--secondary-bg)' }}>
          <div className="text-xs font-bold uppercase tracking-wide mb-3" style={{ color: 'var(--muted-fg)' }}>Workspace</div>
          {stat('Records', `${stats.counts.sources} sources · ${stats.counts.contents} contents · ${stats.counts.analyses} analyses`)}
          {stat('In-memory payload', formatBytes(stats.bytes))}
          {stat('Browser storage', formatBytes(storageBytes))}
          {stat('Audit entries', stats.auditEntries)}
          {stat('Undo / redo depth', `${stats.undoDepth} / ${stats.redoDepth}`)}
          {stat('Integrity checksum', stats.checksum.slice(0, 16))}
          {stat('Last persisted', stats.lastPersisted ?? 'never')}
        </div>

        <div>
          <div className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: 'var(--muted-fg)' }}>Benchmark detail</div>
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr style={{ background: 'var(--secondary-bg)' }}>
                {['Query', 'Rows', 'Scanned', 'ms', ''].map((h) => (
                  <th key={h} className="px-2 py-1 text-start" style={{ borderBottom: '1px solid var(--border)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {latest.map((b) => (
                <tr key={b.label}>
                  <td className="px-2 py-1 truncate max-w-[320px]" title={b.sql} style={{ borderBottom: '1px solid var(--border)', fontFamily: 'var(--font-mono)' }}>
                    {b.label}
                  </td>
                  <td className="px-2 py-1 font-mono" style={{ borderBottom: '1px solid var(--border)' }}>{b.ok ? b.rows : '—'}</td>
                  <td className="px-2 py-1 font-mono" style={{ borderBottom: '1px solid var(--border)' }}>{b.ok ? b.scanned : '—'}</td>
                  <td className="px-2 py-1 font-mono" style={{ borderBottom: '1px solid var(--border)', color: b.elapsedMs > SLOW_MS ? '#f59e0b' : 'var(--fg)' }}>
                    {b.ok ? b.elapsedMs.toFixed(2) : 'error'}
                  </td>
                  <td className="px-2 py-1" style={{ borderBottom: '1px solid var(--border)' }}>{b.ok ? '' : '✕'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div>
          <div className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: 'var(--muted-fg)' }}>Recommendations</div>
          {suggestions.length === 0 ? (
            <div className="text-xs rounded-lg p-2.5" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#15803d' }}>
              ✓ No performance or integrity issues detected.
            </div>
          ) : (
            suggestions.map((s, i) => (
              <div
                key={`${s.title}-${i}`}
                className="text-xs rounded-lg p-2.5 mb-1"
                style={{
                  background: s.level === 'warning' ? '#fffbeb' : '#eff6ff',
                  border: `1px solid ${s.level === 'warning' ? '#fde68a' : '#bfdbfe'}`,
                  color: s.level === 'warning' ? '#b45309' : '#1d4ed8',
                }}
              >
                <span className="font-semibold">{s.title}: </span>
                {s.desc}
              </div>
            ))
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Btn size="sm" variant="ghost" onClick={measure}>Re-run benchmark</Btn>
          <Btn size="sm" variant="ghost" onClick={() => setRuns([])}>Clear metrics</Btn>
          <Btn size="sm" onClick={onClose}>Close</Btn>
        </div>
      </div>
    </InfoModal>
  );
}
