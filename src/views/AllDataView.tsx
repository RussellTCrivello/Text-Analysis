import React, { useEffect, useMemo, useState } from "react"
import { DataTable, type Column } from "../components/DataTable"
import { InfoModal } from "../components/FormModal"
import {
  Btn,
  Toolbar,
  ToolbarSep,
  SearchInput,
  DateInput,
  FilterRow,
  ResultsStrip,
  FullTextPreview,
  PaginationBar,
  RecordTypeBadge,
  ImportanceBar,
  Select,
  MoreMenu,
  PageHeader,
  EmptyState,
} from "../components/ui"
import {
  Close,
  NavAllData,
  EyeIcon,
  ExportArrow,
  Print,
  SearchCodeIcon,
  TableIcon,
} from "../components/icons"
import { ExportDialog } from "../components/ExportDialog"
import { AdvancedSearch } from "../components/AdvancedSearch"
import { freeTextSearch, applyDateFilter } from "../core/search"
import { categoryCounts, countPerDay, createdWithin, paletteFor } from "../core/charts"
import { MiniDonut, Sparkline } from "../components/Charts"
import { formatDateTime } from "../core/text"
import { buildPrintDocument, printHtml } from "../core/print"
import type { Row } from "../core/repository"
import { useAppData } from "../store/AppContext"
import { useSettings } from "../store/SettingsContext"
import { useTranslation } from "../i18n"
import type { RecordType } from "../types"

interface UnifiedRecord {
  id: string
  recordType: RecordType
  sourceName: string
  title: string
  contentData: string
  classification: string
  importance: number
  date: string
  date_creation: string
  list_names_people: string
  list_names_places: string
  note: string
  list_sides: string
}

/**
 * Glanceable workspace pulse: real record counts, 14-day creation
 * sparklines per kind, the week's delta, and the source-type mix.
 */
function OverviewBand() {
  const { t } = useTranslation()
  const { data } = useAppData()
  const { settings } = useSettings()
  const metrics = useMemo(() => {
    const mk = (
      key: string,
      label: string,
      color: string,
      rows: { date_creation?: string }[],
    ) => {
      const dates = rows.map((r) => r.date_creation)
      return {
        key,
        label,
        color,
        value: rows.length,
        series: countPerDay(dates, 14),
        week: createdWithin(dates, 7),
      }
    }
    return [
      mk("sources", t.nav.sources, "var(--color-source)", data.sources),
      mk("contents", t.nav.contents, "var(--color-content)", data.contents),
      mk("analyses", t.nav.analysis, "var(--color-analysis)", data.analyses),
    ]
  }, [data, t])

  const mix = useMemo(
    () =>
      categoryCounts(
        data.sources.map((sr) => sr.type),
        4,
        t.sections.allData.other,
      ).map((sl) => ({ ...sl, color: paletteFor(sl.label, settings.colorBlindMode) })),
    [data.sources, t, settings.colorBlindMode],
  )

  return (
    <section
      aria-label={t.sections.allData.overview}
      className="grid gap-2 px-3 pt-3 shrink-0"
      style={{
        gridTemplateColumns: "repeat(auto-fit, minmax(196px, 1fr))",
      }}
    >
      {metrics.map((m) => (
        <div
          key={m.key}
          className="surface-card card-lift metric-card p-2.5 flex flex-col gap-1"
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
                  ? { background: "var(--success-soft)", color: "var(--success)" }
                  : { color: "var(--muted-fg-2)" }
              }
            >
              {m.week > 0
                ? t.sections.allData.newThisWeek.replace("{n}", String(m.week))
                : t.sections.allData.quietWeek}
            </span>
          </div>
          <div className="flex items-end justify-between gap-2">
            <span
              className="text-[22px] font-extrabold leading-none tnum"
              style={{
                color: "var(--fg)",
                fontFamily: "var(--font-mono)",
                letterSpacing: "-0.03em",
              }}
            >
              {m.value}
            </span>
            <span
              className="text-[9px] uppercase tracking-wide"
              style={{ color: "var(--muted-fg-2)" }}
            >
              {t.sections.allData.last14}
            </span>
          </div>
          <div className="spark-well px-1 pt-1 mt-0.5">
            <Sparkline values={m.series} color={m.color} height={26} />
          </div>
        </div>
      ))}
      {mix.length > 0 && (
        <div className="surface-card card-lift p-2.5 flex items-center gap-3">
          <MiniDonut slices={mix} size={62} thickness={8} />
          <div className="min-w-0 flex-1 flex flex-col gap-1">
            <span
              className="text-[9.5px] font-bold uppercase tracking-[0.12em]"
              style={{ color: "var(--muted-fg)" }}
            >
              {t.sections.allData.sourceMix}
            </span>
            {mix.slice(0, 4).map((sl) => (
              <div
                key={sl.label}
                className="flex items-center gap-1.5 text-[10.5px] leading-tight"
                style={{ color: "var(--fg-soft)" }}
              >
                <span
                  className="type-dot"
                  style={{ background: sl.color, color: sl.color }}
                />
                <span className="truncate flex-1">{sl.label}</span>
                <span
                  className="tnum"
                  style={{ color: "var(--muted-fg-2)" }}
                >
                  {sl.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}

export function AllDataView({
  onToast,
  onGenerateReport,
  initialSearch /** value typed in the shell command bar */,
}: {
  onToast: (m: string) => void
  onGenerateReport?: (records: UnifiedRecord[]) => void
  initialSearch?: string
}) {
  const { t } = useTranslation()
  const { settings } = useSettings()
  const { data, printConfig } = useAppData()
  const [showAdvSearch, setShowAdvSearch] = useState(false)
  const [advancedIds, setAdvancedIds] = useState<string[] | null>(null)
  const [typeFilter, setTypeFilter] = useState<RecordType | "all">("all")
  const [search, setSearch] = useState("")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(settings.defaultPageSize)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showPreview, setShowPreview] = useState(false)
  const [showExport, setShowExport] = useState(false)

  // The global command-bar search feeds this unified view in real time.
  useEffect(() => {
    if (initialSearch !== undefined) {
      setSearch(initialSearch)
      setPage(1)
    }
  }, [initialSearch])

  const sourceName = (id: string) =>
    data.sources.find((s) => s.id === id)?.name ?? "—"
  const contentTitle = (id: string) =>
    data.contents.find((c) => c.id === id)?.title ?? "—"

  const allRecords = useMemo<UnifiedRecord[]>(() => {
    const sources: UnifiedRecord[] = data.sources.map((s) => ({
      id: s.id,
      recordType: "source",
      sourceName: s.name,
      title: s.name,
      contentData: s.description,
      classification: s.type,
      importance: s.importance,
      date: s.date_entry,
      date_creation: s.date_creation,
      list_names_people: "",
      list_names_places: [s.city, s.country].filter(Boolean).join(", "),
      note: s.note,
      list_sides: "",
    }))
    const contents: UnifiedRecord[] = data.contents.map((c) => ({
      id: c.id,
      recordType: "content",
      sourceName: sourceName(c.sources_id),
      title: c.title,
      contentData: c.content_data?.slice(0, 200),
      classification: "",
      importance: c.importance,
      date: c.date_content,
      date_creation: c.date_creation,
      list_names_people: "",
      list_names_places: "",
      note: c.note,
      list_sides: "",
    }))
    const analyses: UnifiedRecord[] = data.analyses.map((a) => {
      const content = data.contents.find((c) => c.id === a.content_id)
      return {
        id: a.id,
        recordType: "analysis",
        sourceName: content ? sourceName(content.sources_id) : "—",
        title: content?.title ?? "—",
        // Show the analysed content's text (falling back to the
        // classification) — not the classification duplicated twice, and the
        // parent content's importance rather than a hard-coded 0.
        contentData: content?.content_data?.slice(0, 200) ?? a.classification,
        classification: a.classification,
        importance: content?.importance ?? 0,
        date: a.date_analysis,
        date_creation: a.date_creation,
        list_names_people: a.list_names_people,
        list_names_places: a.list_names_places,
        note: a.list_sides,
        list_sides: a.list_sides,
      }
    })
    return [...sources, ...contents, ...analyses]
  }, [data])

  const filtered = useMemo(() => {
    const byType =
      typeFilter === "all"
        ? allRecords
        : allRecords.filter((r) => r.recordType === typeFilter)
    const byAdvanced = advancedIds
      ? byType.filter((r) => advancedIds.includes(r.id))
      : byType
    const byText = freeTextSearch(byAdvanced as unknown as Row[], search)
    return applyDateFilter(byText, dateFrom || null, dateTo || null, [
      "date",
      "date_creation",
    ]) as unknown as UnifiedRecord[]
  }, [allRecords, typeFilter, search, dateFrom, dateTo, advancedIds])

  const paged = filtered.slice((page - 1) * pageSize, page * pageSize)
  const selected = filtered.find((r) => r.id === selectedId) ?? null
  // The preview strip works on the real entity records, not the unified
  // projection — resolve the selected unified row back to its source record.
  const selectedReal = selected
    ? selected.recordType === "source"
      ? (data.sources.find((s) => s.id === selected.id) ?? null)
      : selected.recordType === "content"
        ? (data.contents.find((c) => c.id === selected.id) ?? null)
        : (data.analyses.find((a) => a.id === selected.id) ?? null)
    : null

  const typeOpts = [
    { value: "all", label: t.sections.allData.filterAll },
    { value: "source", label: t.sections.allData.filterSources },
    { value: "content", label: t.sections.allData.filterContents },
    { value: "analysis", label: t.sections.allData.filterAnalysis },
  ]

  const columns: Column<UnifiedRecord>[] = [
    {
      key: "recordType",
      header: t.fields.recordType,
      width: "90px",
      render: (r) => <RecordTypeBadge type={r.recordType} />,
    },
    {
      key: "sourceName",
      header: t.fields.sourceName,
      width: "16%",
      sortable: true,
    },
    { key: "title", header: t.fields.title, width: "22%", sortable: true },
    {
      key: "contentData",
      header: t.fields.contentData,
      render: (r) => (
        <span
          className="text-xs truncate block"
          style={{ color: "var(--muted-fg)" }}
        >
          {r.contentData?.slice(0, 90)}
        </span>
      ),
    },
    {
      key: "classification",
      header: t.fields.classification,
      width: "130px",
      sortable: true,
      render: (r) =>
        r.classification ? (
          <span className="text-xs">{r.classification}</span>
        ) : (
          <span style={{ color: "var(--muted-fg)" }}>—</span>
        ),
    },
    {
      key: "importance",
      header: t.fields.importance,
      width: "110px",
      sortable: true,
      render: (r) =>
        r.importance > 0 ? (
          <ImportanceBar value={r.importance} />
        ) : (
          <span style={{ color: "var(--muted-fg)" }}>—</span>
        ),
    },
    {
      key: "date",
      header: t.fields.date,
      width: "150px",
      sortable: true,
      render: (r) => (
        <span
          style={{ fontFamily: "var(--font-mono)", fontSize: "0.8em" }}
          title={formatDateTime(r.date)}
        >
          {r.date ? formatDateTime(r.date) : "—"}
        </span>
      ),
    },
  ]

  const exportColumns = [
    { key: "id", label: t.fields.id },
    { key: "recordType", label: t.fields.recordType },
    { key: "sourceName", label: t.fields.sourceName },
    { key: "title", label: t.fields.title },
    { key: "classification", label: t.fields.classification },
    { key: "importance", label: t.fields.importance },
    { key: "date", label: t.fields.date },
  ]

  const moreItems = [
    {
      label: t.actions.advancedSearch,
      icon: <SearchCodeIcon size="xs" />,
      onClick: () => setShowAdvSearch(true),
    },
    {
      label: t.actions.generateReport,
      icon: <TableIcon size="xs" />,
      onClick: () => {
        onGenerateReport?.(filtered)
        onToast(t.messages.reportSent)
      },
    },
  ]

  const advFields = [
    { value: "title", label: t.fields.title },
    { value: "sourceName", label: t.fields.sourceName },
    { value: "recordType", label: t.fields.recordType },
    { value: "classification", label: t.fields.classification },
    { value: "importance", label: t.fields.importance },
    { value: "list_names_people", label: t.fields.list_names_people },
    { value: "list_names_places", label: t.fields.list_names_places },
    { value: "date", label: t.fields.date },
  ]

  const handlePrint = () => {
    const html = buildPrintDocument({
      columns: exportColumns,
      rows: filtered as unknown as Record<string, unknown>[],
      config: printConfig,
      title: `${t.nav.allData} — ${filtered.length} ${t.messages.records}`,
      subtitle: [
        typeFilter !== "all"
          ? t.messages.printType.replace("{v}", typeOpts.find((o) => o.value === typeFilter)?.label ?? typeFilter)
          : "",
        search ? t.messages.printSearch.replace("{v}", search) : "",
      ]
        .filter(Boolean)
        .join(" · "),
    })
    if (!printHtml(html)) onToast(t.messages.printUnavailable)
  }


  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PageHeader
        eyebrow={t.nav.allDataDesc}
        title={t.sections.allData.title}
        subtitle={t.sections.allData.subtitle}
        icon={<NavAllData size="md" />}
        count={{ value: allRecords.length, label: t.messages.records }}
      />

      <OverviewBand />

      <div className="work-card mx-3 mb-3">
      <FilterRow>
        <Select
          value={typeFilter}
          onChange={(e) => {
            setTypeFilter(e.target.value as RecordType | "all")
            setPage(1)
          }}
          options={typeOpts}
          className="!w-32"
        />
        <SearchInput
          value={search}
          onChange={(v) => {
            setSearch(v)
            setPage(1)
          }}
          placeholder={t.messages.searchPlaceholder}
        />
        <DateInput
          label={t.messages.dateFrom}
          value={dateFrom}
          onChange={(v) => {
            setDateFrom(v)
            setPage(1)
          }}
        />
        <DateInput
          label={t.messages.dateTo}
          value={dateTo}
          onChange={(v) => {
            setDateTo(v)
            setPage(1)
          }}
        />
        <Btn
          size="sm"
          variant="subtle"
          icon={<Close size="xs" />}
          disabled={
            !search && typeFilter === "all" && !dateFrom && !dateTo && !advancedIds
          }
          onClick={() => {
            setSearch("")
            setTypeFilter("all")
            setDateFrom("")
            setDateTo("")
            setAdvancedIds(null)
            setPage(1)
          }}
        >
          {t.actions.clearFilters}
        </Btn>
        {advancedIds && (
          <Btn
            size="sm"
            variant="subtle"
            icon={<Close size="xs" />}
            onClick={() => setAdvancedIds(null)}
          >
            {t.messages.clearAdvanced} ({advancedIds.length})
          </Btn>
        )}
      </FilterRow>

      <Toolbar>
        <Btn
          onClick={() => {
            if (!selectedId) return
            setShowPreview(true)
          }}
          disabled={!selectedId}
          icon={<EyeIcon size="xs" />}
        >
          {t.actions.quickView}
        </Btn>
        <ToolbarSep />
        <Btn
          onClick={() => setShowExport(true)}
          icon={<ExportArrow size="xs" />}
        >
          {t.actions.export}
        </Btn>
        <Btn onClick={handlePrint} icon={<Print size="xs" />}>
          {t.actions.print}
        </Btn>
        <div className="flex-1" />
        <MoreMenu items={moreItems} />
      </Toolbar>

      <ResultsStrip
        total={allRecords.length}
        filtered={filtered.length}
        selected={0}
        recordsLabel={t.messages.records}
        totalLabel={t.messages.total}
        selectedLabel={t.messages.selected}
      />

      <div className="flex-1 min-h-0 overflow-hidden">
        {filtered.length === 0 ? (
          <EmptyState
            variant={
              advancedIds ||
              search ||
              typeFilter !== "all" ||
              dateFrom ||
              dateTo
                ? "noResults"
                : "empty"
            }
            title={
              advancedIds ||
              search ||
              typeFilter !== "all" ||
              dateFrom ||
              dateTo
                ? t.messages.noFilterMatches
                : t.sections.allData.noData
            }
            description={
              advancedIds ||
              search ||
              typeFilter !== "all" ||
              dateFrom ||
              dateTo
                ? undefined
                : t.messages.allDataEmptyBody
            }
            action={
              advancedIds ||
              search ||
              typeFilter !== "all" ||
              dateFrom ||
              dateTo ? (
                <Btn
                  size="xs"
                  variant="ghost"
                  onClick={() => {
                    setSearch("")
                    setTypeFilter("all")
                    setDateFrom("")
                    setDateTo("")
                    setAdvancedIds(null)
                    setPage(1)
                  }}
                >
                  {t.actions.clearFilters}
                </Btn>
              ) : undefined
            }
          />
        ) : (
          <DataTable
            columns={columns}
            data={paged}
            selectedId={selectedId ?? undefined}
            onSelect={(r) => setSelectedId(r?.id ?? null)}
            onDoubleClick={(r) => {
              setSelectedId(r.id)
              setShowPreview(true)
            }}
            emptyText={t.sections.allData.noData}
            rowNumberOffset={(page - 1) * pageSize}
            density={settings.density === "compact" ? "compact" : "comfortable"}
          />
        )}
      </div>

      <FullTextPreview
        record={selectedReal}
        recordType={selectedReal ? selected?.recordType ?? null : null}
        sources={data.sources}
        contents={data.contents}
      />
      {filtered.length > 0 && (
        <PaginationBar
          total={filtered.length}
          page={page}
          pageSize={pageSize}
          onPage={(p) => setPage(p)}
          onPageSize={(s) => {
            setPageSize(s)
            setPage(1)
          }}
          perPageLabel={t.messages.perPage}
          pageLabel={t.messages.page}
          ofLabel={t.messages.of}
          showingLabel={t.messages.showing}
        />
      )}

      {/* Quick View dialog */}
      </div>

      <InfoModal
        isOpen={showPreview && !!selected}
        title={t.actions.quickView}
        onClose={() => setShowPreview(false)}
        size="lg"
      >
        {selected && (
          <div className="flex flex-col gap-3 text-sm">
            <div className="flex items-center gap-2 mb-1">
              <RecordTypeBadge type={selected.recordType} />
              <h3
                className="text-base font-semibold"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {selected.title}
              </h3>
            </div>
            {[
              [t.fields.sourceName, selected.sourceName],
              [t.fields.classification, selected.classification],
              [t.fields.date, selected.date],
              [t.fields.list_names_people, selected.list_names_people],
              [t.fields.list_names_places, selected.list_names_places],
            ]
              .filter(([, v]) => v)
              .map(([k, v]) => (
                <div
                  key={String(k)}
                  className="flex gap-3 py-1.5"
                  style={{ borderBottom: "1px solid var(--border)" }}
                >
                  <span
                    className="w-32 shrink-0 text-xs uppercase tracking-wide font-semibold"
                    style={{ color: "var(--muted-fg)" }}
                  >
                    {k}
                  </span>
                  <span className="flex-1 text-xs">{v}</span>
                </div>
              ))}
            {selected.contentData && (
              <div className="pt-2">
                <p
                  className="text-xs uppercase tracking-wide font-semibold mb-2"
                  style={{ color: "var(--muted-fg)" }}
                >
                  {t.messages.contentLabel}
                </p>
                <p
                  className="text-sm leading-relaxed"
                  style={{ whiteSpace: "pre-wrap" }}
                >
                  {selected.contentData}
                </p>
              </div>
            )}
          </div>
        )}
      </InfoModal>

      <ExportDialog
        isOpen={showExport}
        onClose={() => setShowExport(false)}
        data={filtered as unknown as Record<string, unknown>[]}
        columns={exportColumns}
        defaultFilename="all_data"
      />
      <AdvancedSearch
        isOpen={showAdvSearch}
        onClose={() => setShowAdvSearch(false)}
        fields={advFields}
        data={allRecords as unknown as Record<string, unknown>[]}
        target="workspace"
        onApply={(rows) => {
          setAdvancedIds(rows.map((r) => String(r.id)))
          setPage(1)
          onToast(t.messages.advancedAppliedRows.replace("{n}", String(rows.length)))
        }}
      />
    </div>
  )
}