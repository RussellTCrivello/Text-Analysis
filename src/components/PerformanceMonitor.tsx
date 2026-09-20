/**
 * Performance monitor with real numbers: it benchmarks the SQL engine against
 * the live workspace and reports repository/storage metrics. Nothing here is
 * simulated — every figure comes from a measurement taken when the panel opens.
 */
import React, { useCallback, useEffect, useState } from "react"
import { InfoModal } from "./FormModal"
import { Btn } from "./ui"
import { Check, CircleXIcon, Close, GaugeIcon, Refresh } from "./icons"
import { useAppData } from "../store/AppContext"
import { useTranslation } from "../i18n"
import { formatBytes } from "../core/text"

interface Props {
  isOpen: boolean
  onClose: () => void
}

interface Benchmark {
  label: string
  sql: string
  rows: number
  scanned: number
  elapsedMs: number
  ok: boolean
}

type BenchmarkLabelKey =
  | "bFullScan"
  | "bContentJoin"
  | "bAggregation"
  | "bFiltered"
  | "bLookup"

const BENCHMARKS: { key: BenchmarkLabelKey; sql: string }[] = [
  { key: "bFullScan", sql: "SELECT * FROM sources" },
  {
    key: "bContentJoin",
    sql: "SELECT c.title, s.name AS source_name FROM contents c JOIN sources s ON c.sources_id = s.id",
  },
  {
    key: "bAggregation",
    sql: "SELECT type, COUNT(*) AS n, AVG(importance) AS avg_importance FROM sources GROUP BY type ORDER BY n DESC",
  },
  {
    key: "bFiltered",
    sql: "SELECT name, importance FROM sources WHERE importance > 0.5 ORDER BY importance DESC LIMIT 50",
  },
  {
    key: "bLookup",
    sql: "SELECT classification, COUNT(*) AS n FROM analyses GROUP BY classification HAVING n >= 1",
  },
]

const SLOW_MS = 50

export function PerformanceMonitor({ isOpen, onClose }: Props) {
  const { stats, sql } = useAppData()
  const { t } = useTranslation()
  const [runs, setRuns] = useState<Benchmark[][]>([])

  const labelOf = (key: BenchmarkLabelKey) => t.perf[key]

  const measure = useCallback(() => {
    const pass: Benchmark[] = BENCHMARKS.map(({ key, sql: statement }) => {
      const out = sql.run(statement)
      if (out.error || !out.result) {
        return {
          label: labelOf(key),
          sql: statement,
          rows: 0,
          scanned: 0,
          elapsedMs: 0,
          ok: false,
        }
      }
      return {
        label: labelOf(key),
        sql: statement,
        rows: out.result.rows.length,
        scanned: out.result.scanned,
        elapsedMs: out.result.elapsedMs,
        ok: true,
      }
    })
    setRuns((r) => [...r.slice(-4), pass])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sql, t])

  useEffect(() => {
    if (isOpen) measure()
  }, [isOpen, measure])

  const latest = runs[runs.length - 1] ?? []
  const times = latest.filter((b) => b.ok).map((b) => b.elapsedMs)
  const totalTime = times.reduce((n, tms) => n + tms, 0)
  const avgTime = times.length ? totalTime / times.length : 0
  const maxTime = times.length ? Math.max(...times) : 0
  const slow = latest.filter((b) => b.ok && b.elapsedMs > SLOW_MS)
  const scannedRows = latest.reduce((n, b) => n + b.scanned, 0)

  const storageBytes = (() => {
    let total = 0
    for (const key of [
      "tam_data",
      "tam.backups.v3",
      "tam.knowledge.v3",
      "tam.searches",
      "tam_settings",
    ]) {
      total += (localStorage.getItem(key) ?? "").length * 2
    }
    return total
  })()

  const orphans = Object.entries(stats.orphans).filter(([, n]) => n > 0)
  const entityName = (entity: string) =>
    (t.nav as unknown as Record<string, string>)[entity] ?? entity

  const suggestions = [
    ...orphans.map(([entity, n]) => ({
      level: "warning",
      title: t.perf.orphanTitle.replace("{entity}", entityName(entity)),
      desc: t.perf.orphanDesc.replace("{n}", String(n)),
    })),
    ...slow.map((b) => ({
      level: "info",
      title: t.perf.slowQuery.replace("{label}", b.label),
      desc: t.perf.slowDesc
        .replace("{ms}", b.elapsedMs.toFixed(2))
        .replace("{rows}", String(b.scanned)),
    })),
    stats.total > 5000
      ? {
          level: "info",
          title: t.perf.workspaceSize,
          desc: t.perf.workspaceSizeDesc.replace("{n}", String(stats.total)),
        }
      : null,
  ].filter(Boolean) as { level: string; title: string; desc: string }[]

  const bar = (value: number, max: number, color: string) => (
    <div
      className="h-2 rounded-full overflow-hidden"
      style={{ background: "var(--border)" }}
    >
      <div
        className="h-full rounded-full"
        style={{
          width: `${max ? Math.min(100, (value / max) * 100) : 0}%`,
          background: color,
        }}
      />
    </div>
  )

  const stat = (label: string, value: string | number, mono = true) => (
    <div
      className="flex items-baseline gap-3 py-1.5"
      style={{ borderBottom: "1px solid var(--border)" }}
    >
      <span
        className="text-xs w-44 shrink-0"
        style={{ color: "var(--muted-fg)" }}
      >
        {label}
      </span>
      <span className={`text-sm font-semibold ${mono ? "font-mono" : ""}`}>
        {value}
      </span>
    </div>
  )

  return (
    <InfoModal
      isOpen={isOpen}
      title={t.perf.title}
      onClose={onClose}
      size="lg"
      icon={<GaugeIcon size="sm" />}
    >
      <div className="flex flex-col gap-4">
        <div
          className="rounded-xl p-4"
          style={{ background: "var(--secondary-bg)" }}
        >
          <div
            className="text-xs font-bold uppercase tracking-wide mb-3"
            style={{ color: "var(--muted-fg)" }}
          >
            {t.perf.benchmarkHeader.replace("{n}", String(runs.length))}
          </div>
          {stat(t.perf.queriesExecuted, latest.length)}
          {stat(t.perf.rowsScanned, scannedRows)}
          {stat(t.perf.totalTime, `${totalTime.toFixed(2)} ms`)}
          {stat(t.perf.avgTime, `${avgTime.toFixed(2)} ms`)}
          {stat(t.perf.slowest, `${maxTime.toFixed(2)} ms`)}
          {stat(t.perf.slowQueries.replace("{n}", String(SLOW_MS)), slow.length)}
          <div className="mt-3 flex flex-col gap-2">
            <div>
              <div className="flex justify-between text-xs mb-0.5">
                <span style={{ color: "var(--muted-fg)" }}>
                  {t.perf.avgQueryTime}
                </span>
                <span className="font-mono">{avgTime.toFixed(2)} ms</span>
              </div>
              {bar(
                avgTime,
                100,
                avgTime > 50 ? "var(--warning)" : "var(--primary)",
              )}
            </div>
            <div>
              <div className="flex justify-between text-xs mb-0.5">
                <span style={{ color: "var(--muted-fg)" }}>
                  {t.perf.rowsPerQuery}
                </span>
                <span className="font-mono">
                  {latest.length ? Math.round(scannedRows / latest.length) : 0}
                </span>
              </div>
              {bar(
                scannedRows / Math.max(1, latest.length),
                stats.total || 1,
                "#1d4ed8",
              )}
            </div>
          </div>
        </div>

        <div
          className="rounded-xl p-4"
          style={{ background: "var(--secondary-bg)" }}
        >
          <div
            className="text-xs font-bold uppercase tracking-wide mb-3"
            style={{ color: "var(--muted-fg)" }}
          >
            {t.perf.workspace}
          </div>
          {stat(
            t.perf.records,
            t.perf.recordsValue
              .replace("{s}", String(stats.counts.sources))
              .replace("{c}", String(stats.counts.contents))
              .replace("{a}", String(stats.counts.analyses)),
          )}
          {stat(t.perf.inMemory, formatBytes(stats.bytes))}
          {stat(t.perf.browserStorage, formatBytes(storageBytes))}
          {stat(t.perf.auditEntries, stats.auditEntries)}
          {stat(t.perf.undoRedo, `${stats.undoDepth} / ${stats.redoDepth}`)}
          {stat(t.perf.checksum, stats.checksum.slice(0, 16))}
          {stat(
            t.perf.lastPersisted,
            stats.lastPersisted ?? t.perf.never,
          )}
        </div>

        <div>
          <div
            className="text-xs font-bold uppercase tracking-wide mb-2"
            style={{ color: "var(--muted-fg)" }}
          >
            {t.perf.benchmarkDetail}
          </div>
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr style={{ background: "var(--secondary-bg)" }}>
                {[
                  t.perf.thQuery,
                  t.perf.thRows,
                  t.perf.thScanned,
                  "ms",
                  "",
                ].map((h, i) => (
                  <th
                    key={i}
                    className="px-2 py-1 text-start"
                    style={{ borderBottom: "1px solid var(--border)" }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {latest.map((b) => (
                <tr key={b.label}>
                  <td
                    className="px-2 py-1 truncate max-w-[320px]"
                    title={b.sql}
                    style={{
                      borderBottom: "1px solid var(--border)",
                      fontFamily: "var(--font-mono)",
                    }}
                  >
                    {b.label}
                  </td>
                  <td
                    className="px-2 py-1 font-mono"
                    style={{ borderBottom: "1px solid var(--border)" }}
                  >
                    {b.ok ? b.rows : "—"}
                  </td>
                  <td
                    className="px-2 py-1 font-mono"
                    style={{ borderBottom: "1px solid var(--border)" }}
                  >
                    {b.ok ? b.scanned : "—"}
                  </td>
                  <td
                    className="px-2 py-1 font-mono"
                    style={{
                      borderBottom: "1px solid var(--border)",
                      color:
                        b.elapsedMs > SLOW_MS ? "var(--warning)" : "var(--fg)",
                    }}
                  >
                    {b.ok ? b.elapsedMs.toFixed(2) : t.perf.error}
                  </td>
                  <td
                    className="px-2 py-1"
                    style={{ borderBottom: "1px solid var(--border)" }}
                  >
                    {b.ok ? (
                      <span
                        className="inline-flex"
                        style={{ color: "var(--success)" }}
                      >
                        <Check size="xs" />
                      </span>
                    ) : (
                      <span
                        className="inline-flex"
                        style={{ color: "var(--error)" }}
                      >
                        <CircleXIcon size="xs" />
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div>
          <div
            className="text-xs font-bold uppercase tracking-wide mb-2"
            style={{ color: "var(--muted-fg)" }}
          >
            {t.perf.recommendations}
          </div>
          {suggestions.length === 0 ? (
            <div
              className="text-xs rounded-[var(--radius)] p-2.5 inline-flex items-center gap-2"
              style={{
                background: "var(--success-soft)",
                border: "1px solid var(--success)40",
                color: "var(--success)",
              }}
            >
              <Check size="sm" /> {t.perf.allClear}
            </div>
          ) : (
            suggestions.map((s, i) => (
              <div
                key={`${s.title}-${i}`}
                className="text-xs rounded-lg p-2.5 mb-1"
                style={{
                  background:
                    s.level === "warning"
                      ? "var(--warning-soft)"
                      : "var(--info-soft)",
                  border: `1px solid ${
                    s.level === "warning" ? "var(--warning)55" : "var(--info)55"
                  }`,
                  color:
                    s.level === "warning" ? "var(--warning)" : "var(--info)",
                }}
              >
                <span className="font-semibold">{s.title}: </span>
                {s.desc}
              </div>
            ))
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Btn
            size="sm"
            variant="ghost"
            onClick={measure}
            icon={<Refresh size="xs" />}
          >
            {t.perf.rerun}
          </Btn>
          <Btn
            size="sm"
            variant="ghost"
            onClick={() => setRuns([])}
            icon={<Close size="xs" />}
          >
            {t.perf.clearMetrics}
          </Btn>
          <Btn size="sm" onClick={onClose}>
            {t.actions.close}
          </Btn>
        </div>
      </div>
    </InfoModal>
  )
}
