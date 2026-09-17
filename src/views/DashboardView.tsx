/**
 * Dashboard — the workspace at a glance.
 *
 * Everything on this screen is computed live from the store: counts, weekly
 * deltas, a 30-day creation momentum chart, source-type mix, data-quality
 * coverage, the most-used sources and the newest audit entries. Every control
 * is a real navigation into the section it belongs to — nothing decorative.
 */
import React, { useMemo } from "react"
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { PageHeader, Btn, EmptyState } from "../components/ui"
import { MiniDonut, Sparkline } from "../components/Charts"
import {
  Check,
  ChevronR,
  NavDashboard,
  TableIcon,
} from "../components/icons"
import {
  categoryCounts,
  countPerDay,
  createdWithin,
  paletteFor,
} from "../core/charts"
import { formatDateTime } from "../core/text"
import { useAppData } from "../store/AppContext"
import { useTranslation } from "../i18n"
import type { NavSection } from "../types"
import type { AuditEntry } from "../core/audit"

/* Literal mid-tones that read well on both the light and the abyss-navy
   theme — the same reasoning as the Reports palette (SVG attributes do not
   resolve CSS custom properties inside recharts internals). */
const KIND_COLORS: Record<"sources" | "contents" | "analysis", string> = {
  sources: "#15803d",
  contents: "#c2410c",
  analysis: "#1d4ed8",
}

const ACTION_COLOR: Record<string, string> = {
  create: "#15803d",
  update: "#1d4ed8",
  delete: "#dc2626",
  import: "#7c3aed",
  export: "#0369a1",
  undo: "#b45309",
  redo: "#b45309",
  backup: "#0f766e",
  restore: "#0f766e",
}

function Panel({
  title,
  sub,
  action,
  children,
  className = "",
  style,
}: {
  title: string
  sub?: string
  action?: React.ReactNode
  children: React.ReactNode
  className?: string
  style?: React.CSSProperties
}) {
  return (
    <section
      className={`surface-card p-3 flex flex-col gap-2 min-w-0 ${className}`}
      style={style}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3
            className="text-[10.5px] font-bold uppercase tracking-[0.1em] truncate"
            style={{ fontFamily: "var(--font-display)", color: "var(--fg)" }}
          >
            {title}
          </h3>
          {sub && (
            <p className="text-[10px]" style={{ color: "var(--muted-fg-2)" }}>
              {sub}
            </p>
          )}
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

function CoverageBar({
  label,
  done,
  total,
  color,
}: {
  label: string
  done: number
  total: number
  color: string
}) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between gap-2 text-[11px]">
        <span style={{ color: "var(--fg-soft)" }}>{label}</span>
        <span
          className="tnum font-semibold"
          style={{ color: "var(--muted-fg)", fontFamily: "var(--font-mono)" }}
        >
          {done}/{total} · {pct}%
        </span>
      </div>
      <div
        className="h-1.5 rounded-full overflow-hidden"
        style={{ background: "var(--surface-inset)", border: "1px solid var(--border-faint)" }}
        role="img"
        aria-label={`${label}: ${pct}%`}
      >
        <div
          className="h-full rounded-full"
          style={{
            width: `${pct}%`,
            background: color,
            transition: "width var(--t-slow) var(--ease-out)",
          }}
        />
      </div>
    </div>
  )
}

export function DashboardView({
  onToast: _onToast,
  onNavigate,
}: {
  onToast: (m: string) => void
  onNavigate: (s: NavSection) => void
}) {
  const { t } = useTranslation()
  const { data, repo } = useAppData()

  const d = t.dashboard

  const total =
    data.sources.length + data.contents.length + data.analyses.length

  const kpis = useMemo(() => {
    const mk = (
      section: NavSection,
      label: string,
      rows: { date_creation?: string }[],
    ) => {
      const dates = rows.map((r) => r.date_creation)
      return {
        section,
        label,
        value: rows.length,
        color: KIND_COLORS[section as keyof typeof KIND_COLORS],
        series: countPerDay(dates, 30),
        week: createdWithin(dates, 7),
      }
    }
    const allDates = [
      ...data.sources.map((r) => r.date_creation),
      ...data.contents.map((r) => r.date_creation),
      ...data.analyses.map((r) => r.date_creation),
    ].filter(Boolean) as string[]
    const latest = allDates.length
      ? allDates.reduce((a, b) => (a > b ? a : b))
      : ""
    return {
      cards: [
        mk("sources", t.nav.sources, data.sources),
        mk("contents", t.nav.contents, data.contents),
        mk("analysis", t.nav.analysis, data.analyses),
      ],
      total,
      totalSeries: countPerDay(allDates, 30),
      totalWeek: createdWithin(allDates, 7),
      latest,
    }
  }, [data, t, total])

  /** 30 stacked-days series for the momentum chart. */
  const momentum = useMemo(() => {
    const days = 30
    const per = {
      sources: countPerDay(
        data.sources.map((r) => r.date_creation),
        days,
      ),
      contents: countPerDay(
        data.contents.map((r) => r.date_creation),
        days,
      ),
      analysis: countPerDay(
        data.analyses.map((r) => r.date_creation),
        days,
      ),
    }
    const today = new Date()
    return Array.from({ length: days }, (_, i) => {
      const dt = new Date(today)
      dt.setDate(today.getDate() - (days - 1 - i))
      return {
        label: dt.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
        sources: per.sources[i],
        contents: per.contents[i],
        analysis: per.analysis[i],
      }
    })
  }, [data])

  const mix = useMemo(
    () =>
      categoryCounts(data.sources.map((sr) => sr.type), 5, t.sections.allData.other).map(
        (sl) => ({ ...sl, color: paletteFor(sl.label) }),
      ),
    [data.sources, t],
  )

  const quality = useMemo(() => {
    const sourceIds = new Set(data.sources.map((s) => s.id))
    const contentIds = new Set(data.contents.map((c) => c.id))
    const linked = data.contents.filter(
      (c) => c.sources_id && sourceIds.has(c.sources_id),
    ).length
    const attached = data.contents.filter((c) =>
      String(c.attachments ?? "")
        .split(/[;,]/)
        .some((v) => v.trim()),
    ).length
    const analyzedIds = new Set(
      data.analyses.map((a) => String(a.content_id ?? "")).filter(Boolean),
    )
    const analyzed = data.contents.filter((c) => analyzedIds.has(c.id)).length
    const orphans = data.analyses.filter(
      (a) => a.content_id && !contentIds.has(String(a.content_id)),
    ).length
    return { linked, attached, analyzed, orphans }
  }, [data])

  const topSources = useMemo(() => {
    const counts = new Map<string, number>()
    for (const c of data.contents) {
      if (!c.sources_id) continue
      counts.set(c.sources_id, (counts.get(c.sources_id) ?? 0) + 1)
    }
    return [...counts.entries()]
      .map(([id, count]) => ({
        id,
        name: data.sources.find((s) => s.id === id)?.name ?? id,
        count,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
  }, [data])

  const activity = useMemo(
    () => repo.audit.list({}).slice(0, 7),
    [repo, data],
  )

  const open = (s: NavSection, label: string) => (
    <Btn
      size="xs"
      variant="ghost"
      onClick={() => onNavigate(s)}
      icon={<ChevronR size="xs" />}
      title={`${d.viewAll} — ${label}`}
    >
      {d.viewAll}
    </Btn>
  )

  return (
    <div className="flex flex-col h-full min-h-0">
      <PageHeader
        eyebrow={t.nav.dashboardDesc}
        title={d.title}
        subtitle={d.subtitle}
        icon={<NavDashboard size="md" />}
        count={{ value: total, label: t.messages.records }}
      />

      <div className="flex-1 overflow-auto p-3 flex flex-col gap-2.5">
        {total === 0 ? (
          <EmptyState
            variant="empty"
            title={d.emptyTitle}
            description={d.emptyBody}
            action={
              <Btn variant="primary" onClick={() => onNavigate("sources")}>
                {d.goSources}
              </Btn>
            }
          />
        ) : (
          <>
            {/* ── KPI row ─────────────────────────────────────────────────── */}
            <div
              className="grid gap-2.5"
              style={{
                gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
              }}
            >
              <button
                type="button"
                onClick={() => onNavigate("allData")}
                aria-label={`${d.totalRecords} — ${t.nav.allData}`}
                className="surface-card card-lift metric-card p-2.5 flex flex-col gap-1 text-start cursor-pointer"
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className="text-[9.5px] font-bold uppercase tracking-[0.12em]"
                    style={{ color: "var(--muted-fg)" }}
                  >
                    {d.totalRecords}
                  </span>
                  <span
                    className="rounded-full px-1.5 py-px text-[9px] font-bold tnum"
                    style={
                      kpis.totalWeek > 0
                        ? {
                            background: "var(--success-soft)",
                            color: "var(--success)",
                          }
                        : { color: "var(--muted-fg-2)" }
                    }
                  >
                    {kpis.totalWeek > 0
                      ? d.newThisWeek.replace("{n}", String(kpis.totalWeek))
                      : d.quietWeek}
                  </span>
                </div>
                <div className="flex items-end justify-between gap-2">
                  <span
                    className="text-[24px] font-extrabold leading-none tnum"
                    style={{
                      fontFamily: "var(--font-mono)",
                      letterSpacing: "-0.03em",
                    }}
                  >
                    {kpis.total}
                  </span>
                  <span
                    className="text-[9px] truncate"
                    style={{ color: "var(--muted-fg-2)", maxWidth: 110 }}
                  >
                    {kpis.latest
                      ? d.latestRecord.replace(
                          "{date}",
                          formatDateTime(kpis.latest).slice(0, 10),
                        )
                      : d.noRecords}
                  </span>
                </div>
                <div className="spark-well px-1 pt-1 mt-0.5">
                  <Sparkline
                    values={kpis.totalSeries}
                    height={26}
                    color="var(--accent-violet)"
                  />
                </div>
              </button>

              {kpis.cards.map((m) => (
                <button
                  key={m.section}
                  type="button"
                  onClick={() => onNavigate(m.section)}
                  aria-label={`${m.label} — ${d.viewAll}`}
                  className="surface-card card-lift metric-card p-2.5 flex flex-col gap-1 text-start cursor-pointer"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className="text-[9.5px] font-bold uppercase tracking-[0.12em] inline-flex items-center gap-1.5"
                      style={{ color: "var(--muted-fg)" }}
                    >
                      <span
                        className="type-dot"
                        style={{ background: m.color, color: m.color }}
                      />
                      {m.label}
                    </span>
                    <span
                      className="rounded-full px-1.5 py-px text-[9px] font-bold tnum"
                      style={
                        m.week > 0
                          ? {
                              background: "var(--success-soft)",
                              color: "var(--success)",
                            }
                          : { color: "var(--muted-fg-2)" }
                      }
                    >
                      {m.week > 0
                        ? d.newThisWeek.replace("{n}", String(m.week))
                        : d.quietWeek}
                    </span>
                  </div>
                  <span
                    className="text-[24px] font-extrabold leading-none tnum"
                    style={{
                      fontFamily: "var(--font-mono)",
                      letterSpacing: "-0.03em",
                    }}
                  >
                    {m.value}
                  </span>
                  <div className="spark-well px-1 pt-1 mt-0.5">
                    <Sparkline values={m.series} height={26} color={m.color} />
                  </div>
                </button>
              ))}
            </div>

            {/* ── main grid ──────────────────────────────────────────────── */}
            <div className="grid gap-2.5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
              <div className="flex flex-col gap-2.5 min-w-0">
                <Panel title={d.momentumTitle} sub={d.momentumSub}>
                  <div style={{ height: 196 }} dir="ltr">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={momentum}
                        margin={{ top: 6, right: 6, bottom: 0, left: -18 }}
                      >
                        <CartesianGrid
                          stroke="rgba(124,138,168,0.16)"
                          vertical={false}
                        />
                        <XAxis
                          dataKey="label"
                          tick={{ fontSize: 9, fill: "#8a93a6" }}
                          axisLine={{ stroke: "rgba(124,138,168,0.25)" }}
                          tickLine={false}
                          interval={4}
                        />
                        <YAxis
                          allowDecimals={false}
                          tick={{ fontSize: 9, fill: "#8a93a6" }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <Tooltip
                          cursor={{
                            stroke: "rgba(124,138,168,0.4)",
                            strokeDasharray: "3 3",
                          }}
                          contentStyle={{
                            background: "var(--surface)",
                            border: "1px solid var(--border)",
                            borderRadius: "var(--radius)",
                            fontSize: 11,
                            fontFamily: "var(--font-mono)",
                            boxShadow: "var(--shadow-2)",
                          }}
                          labelStyle={{ color: "var(--fg)" }}
                        />
                        <Area
                          type="monotone"
                          dataKey="sources"
                          name={t.nav.sources}
                          stackId="1"
                          stroke={KIND_COLORS.sources}
                          fill={KIND_COLORS.sources}
                          fillOpacity={0.28}
                          strokeWidth={1.5}
                        />
                        <Area
                          type="monotone"
                          dataKey="contents"
                          name={t.nav.contents}
                          stackId="1"
                          stroke={KIND_COLORS.contents}
                          fill={KIND_COLORS.contents}
                          fillOpacity={0.28}
                          strokeWidth={1.5}
                        />
                        <Area
                          type="monotone"
                          dataKey="analysis"
                          name={t.nav.analysis}
                          stackId="1"
                          stroke={KIND_COLORS.analysis}
                          fill={KIND_COLORS.analysis}
                          fillOpacity={0.28}
                          strokeWidth={1.5}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                  <div
                    className="flex items-center gap-3 text-[10px] pt-0.5"
                    style={{ color: "var(--muted-fg)" }}
                  >
                    {[
                      { label: t.nav.sources, color: KIND_COLORS.sources },
                      { label: t.nav.contents, color: KIND_COLORS.contents },
                      { label: t.nav.analysis, color: KIND_COLORS.analysis },
                    ].map((l) => (
                      <span key={l.label} className="inline-flex items-center gap-1.5">
                        <span
                          className="type-dot"
                          style={{ background: l.color, color: l.color }}
                        />
                        {l.label}
                      </span>
                    ))}
                  </div>
                </Panel>

                <div className="grid gap-2.5 md:grid-cols-2">
                  {mix.length > 0 && (
                    <Panel title={d.mixTitle} sub={d.mixSub}>
                      <div className="flex items-center gap-3">
                        <MiniDonut slices={mix} size={76} thickness={10} />
                        <ul className="min-w-0 flex-1 flex flex-col gap-1 list-none m-0 p-0">
                          {mix.slice(0, 5).map((sl) => (
                            <li
                              key={sl.label}
                              className="flex items-center gap-1.5 text-[10.5px]"
                              style={{ color: "var(--fg-soft)" }}
                            >
                              <span
                                className="type-dot"
                                style={{
                                  background: sl.color,
                                  color: sl.color,
                                }}
                              />
                              <span className="truncate flex-1">
                                {sl.label}
                              </span>
                              <span
                                className="tnum"
                                style={{ color: "var(--muted-fg-2)" }}
                              >
                                {sl.value} ·{" "}
                                {Math.round(sl.share * 100)}%
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </Panel>
                  )}

                  <Panel
                    title={d.qualityTitle}
                    action={open("allData", t.nav.allData)}
                  >
                    <div className="flex flex-col gap-2 pt-0.5">
                      <CoverageBar
                        label={d.qualityLinked}
                        done={quality.linked}
                        total={data.contents.length}
                        color={KIND_COLORS.sources}
                      />
                      <CoverageBar
                        label={d.qualityAttached}
                        done={quality.attached}
                        total={data.contents.length}
                        color={KIND_COLORS.contents}
                      />
                      <CoverageBar
                        label={d.qualityAnalyzed}
                        done={quality.analyzed}
                        total={data.contents.length}
                        color={KIND_COLORS.analysis}
                      />
                      <div className="text-[10.5px]" style={{ color: quality.orphans > 0 ? "var(--error)" : "var(--success)" }}>
                        {quality.orphans > 0 ? (
                          `${d.qualityOrphans}: ${quality.orphans}`
                        ) : (
                          <span className="inline-flex items-center gap-1">
                            <Check size="xs" />
                            {d.qualityOrphansClean}
                          </span>
                        )}
                      </div>
                    </div>
                  </Panel>
                </div>
              </div>

              {/* right column */}
              <div className="flex flex-col gap-2.5 min-w-0">
                <Panel
                  title={d.topTitle}
                  sub={d.topSub}
                  action={open("contents", t.nav.contents)}
                >
                  {topSources.length === 0 ? (
                    <p className="text-[11px]" style={{ color: "var(--muted-fg-2)" }}>
                      {d.emptyBody}
                    </p>
                  ) : (
                    <ul className="flex flex-col gap-1.5 list-none m-0 p-0">
                      {topSources.map((ts) => (
                        <li key={ts.id}>
                          <button
                            type="button"
                            onClick={() => onNavigate("contents")}
                            aria-label={`${d.openContents}: ${ts.name}`}
                            className="w-full text-start group"
                          >
                            <div className="flex items-center justify-between gap-2 text-[11px]">
                              <span
                                className="truncate font-medium group-hover:text-[var(--primary)] transition-colors"
                                style={{ color: "var(--fg-soft)" }}
                              >
                                {ts.name}
                              </span>
                              <span
                                className="tnum shrink-0"
                                style={{
                                  color: "var(--muted-fg)",
                                  fontFamily: "var(--font-mono)",
                                }}
                              >
                                {ts.count}
                              </span>
                            </div>
                            <div
                              className="h-1 mt-1 rounded-full overflow-hidden"
                              style={{
                                background: "var(--surface-inset)",
                              }}
                            >
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: `${Math.round(
                                    (ts.count / topSources[0].count) * 100,
                                  )}%`,
                                  background: "var(--brand-grad)",
                                  transition:
                                    "width var(--t-slow) var(--ease-out)",
                                }}
                              />
                            </div>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </Panel>

                <Panel
                  title={d.activityTitle}
                  sub={d.activitySub}
                  action={open("activity", t.nav.activity)}
                  className="flex-1"
                >
                  {activity.length === 0 ? (
                    <div
                      className="flex items-center gap-2 text-[11px] py-2"
                      style={{ color: "var(--muted-fg-2)" }}
                    >
                      <TableIcon size="xs" /> {d.activityEmpty}
                    </div>
                  ) : (
                    <ul className="flex flex-col list-none m-0 p-0">
                      {activity.map((e: AuditEntry) => (
                        <li
                          key={e.id}
                          className="flex items-start gap-2 py-1.5 border-b last:border-b-0"
                          style={{ borderColor: "var(--border-faint)" }}
                        >
                          <span
                            className="type-dot mt-1"
                            style={{
                              background:
                                ACTION_COLOR[e.action] ?? "var(--muted-fg)",
                              color: ACTION_COLOR[e.action] ?? "var(--muted-fg)",
                            }}
                          />
                          <div className="min-w-0 flex-1">
                            <div
                              className="text-[11px] truncate"
                              style={{ color: "var(--fg-soft)" }}
                            >
                              <span
                                className="font-bold uppercase text-[9px] me-1"
                                style={{
                                  color:
                                    ACTION_COLOR[e.action] ??
                                    "var(--muted-fg)",
                                }}
                              >
                                {e.action}
                              </span>
                              {e.title || e.summary || e.entity}
                            </div>
                            <div
                              className="text-[9.5px] tnum"
                              style={{
                                color: "var(--muted-fg-2)",
                                fontFamily: "var(--font-mono)",
                              }}
                            >
                              {e.entity} · {formatDateTime(e.ts)}
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </Panel>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
