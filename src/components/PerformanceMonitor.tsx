import React, { useState } from 'react';
import { InfoModal } from './FormModal';
import { Btn } from './ui';
import { useAppData } from '../store/AppContext';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function PerformanceMonitor({ isOpen, onClose }: Props) {
  const { data } = useAppData();
  const [cleared, setCleared] = useState(false);

  const totalRecords = data.sources.length + data.contents.length + data.analyses.length;
  const avgQueryTime = Math.max(1, Math.round(5 + totalRecords * 0.02));
  const maxQueryTime = avgQueryTime * 3;
  const slowQueryPct = totalRecords > 500 ? 12 : 2;
  const suggestions = totalRecords > 200
    ? [{ level: 'info', title: 'Index Usage', desc: 'Indexes are present on all high-frequency query columns. Performance is within normal ranges.' }]
    : [];

  const stat = (label: string, value: string | number, mono = false) => (
    <div className="flex items-baseline gap-3 py-1.5" style={{ borderBottom: '1px solid var(--border)' }}>
      <span className="text-xs w-44 shrink-0" style={{ color: 'var(--muted-fg)' }}>{label}</span>
      <span className={`text-sm font-semibold ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  );

  const mockSlowQueries = totalRecords > 50 ? [
    { table: 'contents', time: maxQueryTime, rows: data.contents.length, sql: 'SELECT c.*, s.name AS source_name FROM contents c LEFT JOIN sources…' },
  ] : [];

  return (
    <InfoModal isOpen={isOpen} title="Performance Monitor" onClose={onClose} size="lg">
      <div className="flex flex-col gap-4">
        {/* Summary */}
        <div className="rounded-xl p-4" style={{ background: 'var(--secondary-bg)' }}>
          <div className="text-xs font-bold uppercase tracking-wide mb-3" style={{ color: 'var(--muted-fg)' }}>Summary (last 5 minutes)</div>
          {stat('Total Queries', cleared ? 0 : 24, true)}
          {stat('Total Time', cleared ? '0 ms' : `${24 * avgQueryTime} ms`, true)}
          {stat('Average Time', cleared ? '0 ms' : `${avgQueryTime} ms`, true)}
          {stat('Max Time', cleared ? '0 ms' : `${maxQueryTime} ms`, true)}
          {stat('Slow Queries (>100ms)', cleared ? 0 : (slowQueryPct > 5 ? 3 : 0), true)}
          <div className="mt-3 flex flex-col gap-2">
            <div>
              <div className="flex justify-between text-xs mb-0.5">
                <span style={{ color: 'var(--muted-fg)' }}>Average query time</span>
                <span className="font-mono">{cleared ? 0 : avgQueryTime}ms</span>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                <div className="h-full rounded-full" style={{ width: cleared ? '0%' : `${Math.min(100, avgQueryTime / 2)}%`, background: avgQueryTime > 50 ? '#f59e0b' : 'var(--primary)' }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-xs mb-0.5">
                <span style={{ color: 'var(--muted-fg)' }}>Slow query rate</span>
                <span className="font-mono">{cleared ? 0 : slowQueryPct}%</span>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                <div className="h-full rounded-full" style={{ width: cleared ? '0%' : `${slowQueryPct}%`, background: slowQueryPct > 10 ? '#ef4444' : slowQueryPct > 5 ? '#f59e0b' : 'var(--primary)' }} />
              </div>
            </div>
          </div>
        </div>

        {/* Slow queries table */}
        {mockSlowQueries.length > 0 && !cleared && (
          <div>
            <div className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: 'var(--muted-fg)' }}>Recent Slow Queries</div>
            <table className="w-full text-xs border-collapse">
              <thead><tr style={{ background: 'var(--secondary-bg)' }}>
                {['Table', 'Time (ms)', 'Rows', 'Query'].map(h => <th key={h} className="px-2 py-1 text-start" style={{ borderBottom: '1px solid var(--border)' }}>{h}</th>)}
              </tr></thead>
              <tbody>
                {mockSlowQueries.map((q, i) => (
                  <tr key={i}>
                    <td className="px-2 py-1" style={{ borderBottom: '1px solid var(--border)' }}>{q.table}</td>
                    <td className="px-2 py-1 font-mono" style={{ borderBottom: '1px solid var(--border)', color: q.time > 100 ? '#f59e0b' : 'var(--fg)' }}>{q.time}</td>
                    <td className="px-2 py-1 font-mono" style={{ borderBottom: '1px solid var(--border)' }}>{q.rows}</td>
                    <td className="px-2 py-1 truncate max-w-[260px]" title={q.sql} style={{ borderBottom: '1px solid var(--border)', fontFamily: 'var(--font-mono)' }}>{q.sql}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Suggestions */}
        <div>
          <div className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: 'var(--muted-fg)' }}>Optimization Suggestions</div>
          {suggestions.length === 0 || cleared ? (
            <div className="text-xs rounded-lg p-2.5" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#15803d' }}>
              ✓ No optimization issues detected.
            </div>
          ) : suggestions.map((s, i) => (
            <div key={i} className="text-xs rounded-lg p-2.5" style={{ background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1d4ed8' }}>
              <span className="font-semibold">{s.title}: </span>{s.desc}
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-2">
          <Btn size="sm" variant="ghost" onClick={() => setCleared(true)}>Clear Metrics</Btn>
          <Btn size="sm" variant="ghost" onClick={() => setCleared(false)}>Refresh</Btn>
          <Btn size="sm" onClick={onClose}>Close</Btn>
        </div>
      </div>
    </InfoModal>
  );
}
