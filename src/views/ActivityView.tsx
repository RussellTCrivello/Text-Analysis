/**
 * Activity / audit trail. Every mutation that went through the Repository is
 * listed here with field-level diffs, and the whole log can be filtered and
 * exported through the shared exporter.
 */
import React, { useMemo, useState } from "react"
import {
  Btn,
  Badge,
  DateInput,
  FilterRow,
  SearchInput,
  Select,
  StatCard,
  PageHeader,
  EmptyState,
} from "../components/ui"
import {
  ChevronD,
  ChevronU,
  ExportArrow,
  NavActivity,
  Redo,
  Undo,
} from "../components/icons"
import { useAppData } from "../store/AppContext"
import { useTranslation } from "../i18n"
import { downloadArtifact, exportData } from "../core/export/exporters"
import type { AuditAction, AuditEntry } from "../core/audit"

const ACTION_COLORS: Record<string, string> = {
  create: "#15803d",
  update: "#1d4ed8",
  delete: "#b91c1c",
  bulk_delete: "#b91c1c",
  bulk_update: "#c2410c",
  import: "#7c3aed",
  restore: "#0369a1",
  merge: "#0e7490",
  reset: "#57534e",
  load_sample: "#57534e",
}

export function ActivityView({ onToast }: { onToast: (m: string) => void }) {
  const { t } = useTranslation()
  const a = t.sections.activity
  const au = t.audit
  const { audit, repo, stats, undo, redo, canUndo, canRedo } = useAppData()

  const actionLabel = (key: string) =>
    (au.actions as Record<string, string>)[key] ?? key
  const entityLabel = (key: string) =>
    (au.entities as Record<string, string>)[key] ?? key

  const [action, setAction] = useState<AuditAction | "all">("all")
  const [entity, setEntity] = useState<string>("all")
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  const [search, setSearch] = useState("")
  const [expanded, setExpanded] = useState<string | null>(null)

  const filtered = useMemo(
    () =>
      repo.audit.list({
        action,
        entity: entity as never,
        from: from || undefined,
        to: to || undefined,
        search: search || undefined,
      }),
    [repo.audit, action, entity, from, to, search],
  )

  const counts = useMemo(() => repo.audit.countsByAction(), [repo.audit, audit])
  const entityOpts = useMemo(
    () => [
      { value: "all", label: a.allEntities },
      ...[...new Set(audit.map((e) => e.entity))].map((e) => ({
        value: e,
        label: entityLabel(e),
      })),
    ],
    [audit, au],
  )
  const actionOpts = [
    { value: "all", label: a.allActions },
    ...Object.keys(counts).map((k) => ({
      value: k,
      label: `${actionLabel(k)} (${counts[k]})`,
    })),
  ]

  const exportLog = () => {
    if (!filtered.length) {
      onToast(t.messages.nothingToExport)
      return
    }
    const rows = filtered.map((e: AuditEntry) => ({
      id: e.id,
      ts: e.ts,
      actor: e.actor,
      action: e.action,
      entity: e.entity,
      recordId: e.recordId,
      title: e.title,
      summary: e.summary,
      changes: (e.changes ?? [])
        .map(
          (c) =>
            `${c.field}: ${JSON.stringify(c.before)} → ${JSON.stringify(c.after)}`,
        )
        .join(" | "),
    }))
    const artifact = exportData(rows, {
      columns: Object.keys(rows[0]).map((key) => ({ key, label: key })),
      format: "csv",
      filename: a.exportName,
      title: a.title,
      subtitle: t.messages.entriesN.replace("{n}", String(filtered.length)),
    })
    downloadArtifact(artifact)
    onToast(t.messages.exportedFile.replace("{file}", artifact.filename))
  }

  const day = (ts: string) => ts.slice(0, 10)
  const time = (ts: string) => ts.slice(11, 19)

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PageHeader
        eyebrow={t.nav.activityDesc}
        title={t.nav.activity}
        subtitle={a.subtitle}
        icon={<NavActivity size="md" />}
        count={{ value: audit.length, label: a.entriesShown }}
      />

      <FilterRow>
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder={t.messages.searchPlaceholder}
        />
        <Select
          value={action}
          onChange={(e) => setAction(e.target.value as AuditAction | "all")}
          options={actionOpts}
          className="!w-44"
        />
        <Select
          value={entity}
          onChange={(e) => setEntity(e.target.value)}
          options={entityOpts}
          className="!w-36"
        />
        <DateInput
          label={t.messages.dateFrom}
          value={from}
          onChange={setFrom}
        />
        <DateInput label={t.messages.dateTo} value={to} onChange={setTo} />
        <Btn
          size="xs"
          variant="ghost"
          onClick={() => {
            setSearch("")
            setAction("all")
            setEntity("all")
            setFrom("")
            setTo("")
          }}
        >
          {t.actions.clearFilters}
        </Btn>
        <div className="flex-1" />
        <Btn size="xs" onClick={exportLog} icon={<ExportArrow size="xs" />}>
          {t.actions.export}
        </Btn>
      </FilterRow>

      <div
        className="px-3 py-2 flex items-center gap-3 flex-wrap shrink-0"
        style={{
          background: "var(--card-bg)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <StatCard label={a.entriesShown} value={String(filtered.length)} />
        <StatCard
          label={a.logCapacity}
          value={`${audit.length} / ${repo.audit.capacity}`}
        />
        <StatCard label={a.undoDepth} value={String(stats.undoDepth)} />
        <div className="flex-1" />
        <Btn
          size="xs"
          onClick={() => {
            undo()
            onToast(a.undone)
          }}
          disabled={!canUndo}
          icon={<Undo size="xs" />}
        >
          {a.undo}
        </Btn>
        <Btn
          size="xs"
          onClick={() => {
            redo()
            onToast(a.redone)
          }}
          disabled={!canRedo}
          icon={<Redo size="xs" />}
        >
          {a.redo}
        </Btn>
      </div>

      <div className="flex-1 overflow-auto">
        {filtered.length === 0 ? (
          <EmptyState
            variant={audit.length ? "noResults" : "empty"}
            title={a.noEntries}
            description={audit.length ? t.messages.noFilterMatches : undefined}
          />
        ) : (
          filtered.map((entry) => (
            <div
              key={entry.id}
              style={{ borderBottom: "1px solid var(--border)" }}
            >
              <button
                className="w-full flex items-center gap-3 px-3 py-2 text-start hover:bg-[var(--secondary-bg)] transition-colors"
                onClick={() =>
                  setExpanded(expanded === entry.id ? null : entry.id)
                }
              >
                <span
                  className="rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide shrink-0"
                  style={{
                    background: `${ACTION_COLORS[entry.action] ?? "#57534e"}22`,
                    color: ACTION_COLORS[entry.action] ?? "#57534e",
                  }}
                >
                  {actionLabel(entry.action)}
                </span>
                <Badge size="xs">{entityLabel(entry.entity)}</Badge>
                <span className="text-xs truncate flex-1">
                  {entry.title || entry.recordId}
                </span>
                <span
                  className="text-xs shrink-0"
                  style={{
                    color: "var(--muted-fg)",
                    fontFamily: "var(--font-mono)",
                  }}
                >
                  {day(entry.ts)} {time(entry.ts)}
                </span>
                <span
                  className="text-xs shrink-0"
                  style={{ color: "var(--muted-fg)" }}
                >
                  {entry.changes?.length
                    ? au.fieldsChanged.replace("{n}", String(entry.changes.length))
                    : ""}
                </span>
                <span
                  className="inline-flex shrink-0"
                  style={{ color: "var(--muted-fg-2)" }}
                  aria-hidden="true"
                >
                  {expanded === entry.id ? (
                    <ChevronU size="xs" />
                  ) : (
                    <ChevronD size="xs" />
                  )}
                </span>
              </button>
              {expanded === entry.id && (
                <div
                  className="px-3 pb-3 text-xs"
                  style={{ background: "var(--secondary-bg)" }}
                >
                  <div style={{ color: "var(--muted-fg)" }}>
                    {entry.summary} ·{" "}
                    {au.actorRecord
                      .replace("{actor}", entry.actor)
                      .replace("{id}", entry.recordId)}
                  </div>
                  {entry.changes && entry.changes.length > 0 && (
                    <table
                      className="w-full mt-2 text-[11px]"
                      style={{ borderCollapse: "collapse" }}
                    >
                      <thead>
                        <tr>
                          {[a.field, a.before, a.after].map((h) => (
                            <th
                              key={h}
                              className="px-2 py-1 text-start text-[10px] font-semibold uppercase tracking-wide"
                              style={{ color: "var(--muted-fg)" }}
                            >
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {entry.changes.map((c) => (
                          <tr key={c.field}>
                            <td
                              className="px-2 py-1"
                              style={{ fontFamily: "var(--font-mono)" }}
                            >
                              {c.field}
                            </td>
                            <td
                              className="px-2 py-1"
                              style={{
                                color: "var(--error)",
                                wordBreak: "break-word",
                              }}
                            >
                              {String(c.before ?? "—").slice(0, 120)}
                            </td>
                            <td
                              className="px-2 py-1"
                              style={{
                                color: "var(--success)",
                                wordBreak: "break-word",
                              }}
                            >
                              {String(c.after ?? "—").slice(0, 120)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}