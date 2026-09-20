import React, { useEffect, useMemo, useState } from "react"
import { DataTable, type Column } from "../components/DataTable"
import { FormModal, ConfirmDialog, InfoModal } from "../components/FormModal"
import {
  Btn,
  Field,
  Input,
  Textarea,
  Select,
  Toolbar,
  ToolbarSep,
  SearchInput,
  DateInput,
  DateTimeInput,
  FilterRow,
  ResultsStrip,
  SelectionBar,
  FullTextPreview,
  PaginationBar,
  MoreMenu,
  Badge,
  ColumnFilter,
  StatCard,
  PageHeader,
  WorkspaceToolbar,
  EmptyState,
} from "../components/ui"
import {
  TriangleAlert,
  Close,
  NavAnalysis,
  Plus,
  Pencil,
  Trash,
  CopyIcon,
  ExportArrow,
  Print,
  SearchCodeIcon,
  SigmaIcon,
  LayersIcon,
  MapPinIcon,
  CompareIcon,
  Bolt,
  ImportFile,
  Reset,
} from "../components/icons"
import { ExportDialog } from "../components/ExportDialog"
import { ImportWizard } from "../components/ImportWizard"
import { AdvancedSearch } from "../components/AdvancedSearch"
import { FilterBuilder } from "../components/FilterBuilder"
import { applyFilterGroups, type FilterGroup } from "../core/filterBuilder"
import { ComboField, usageMap } from "../components/ComboField"
import { BulkOperations } from "../components/BulkOperations"
import { ComparisonDialog } from "../components/ComparisonDialog"
import { SummaryDialog } from "../components/SummaryDialog"
import { useAppData } from "../store/AppContext"
import { useSettings } from "../store/SettingsContext"
import { useTranslation } from "../i18n"
import { mergeSuggestion, type ExtractionResult } from "../core/extract/engine"
import {
  applyColumnFilters,
  applyDateFilter,
  freeTextSearch,
} from "../core/search"
import { computeEntityStats } from "../core/stats"
import { buildPrintDocument, printHtml } from "../core/print"
import type { Row } from "../core/repository"
import { formatDateTime, nowIso } from "../core/text"
import type { Analysis } from "../types"

const CLASSIFICATION_VOCABULARY = "analyses.classification"

function emptyAnalysis(
  contentId = "",
): Omit<Analysis, "id" | "date_creation" | "date_modified"> {
  return {
    content_id: contentId,
    classification: "Security / Diplomacy",
    list_names_people: "",
    list_names_places: "",
    list_coordinates: "",
    list_sides: "",
    date_analysis: nowIso(),
  }
}

/** Rows carry the joined labels the table and filters display. */
type EnrichedAnalysis = Analysis & { content_title: string; source_name: string }

export function AnalysisView({
  onToast,
  initialContentId,
  autoOpenAdd = 0,
}: {
  onToast: (m: string) => void
  initialContentId?: string
  autoOpenAdd?: number
}) {
  const { t } = useTranslation()
  const { settings } = useSettings()
  const {
    data,
    addAnalysis,
    updateAnalysis,
    deleteAnalysis,
    duplicateAnalysis,
    bulkDeleteAnalyses,
    validate,
    extract,
    printConfig,
    vocabulary,
    vocabularyTick,
    addVocabularyValue,
    removeVocabularyValue,
    taxonomy,
    setTaxonomy,
  } = useAppData()
  const [showImport, setShowImport] = useState(false)
  const [showAdvSearch, setShowAdvSearch] = useState(false)
  const [showFilterBuilder, setShowFilterBuilder] = useState(false)
  const [showStats, setShowStats] = useState(false)
  const [advancedIds, setAdvancedIds] = useState<string[] | null>(null)

  const [search, setSearch] = useState("")
  const [classFilter, setClassFilter] = useState("")
  const [colFilters, setColFilters] = useState<Record<string, string>>({})
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(settings.defaultPageSize)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [showAdd, setShowAdd] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const [showDelete, setShowDelete] = useState(false)
  const [showExport, setShowExport] = useState(false)
  const [showBulkOps, setShowBulkOps] = useState(false)
  const [showCompare, setShowCompare] = useState(false)
  const [showSummary, setShowSummary] = useState(false)
  const [form, setForm] = useState(emptyAnalysis(initialContentId))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [extraction, setExtraction] = useState<ExtractionResult | null>(null)

  const selected = data.analyses.find((a) => a.id === selectedId) ?? null

  const [seenAddNonce, setSeenAddNonce] = useState(0)
  useEffect(() => {
    if (autoOpenAdd && autoOpenAdd !== seenAddNonce) {
      setSeenAddNonce(autoOpenAdd)
      openAdd()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoOpenAdd])
  const contentTitle = (id: string) =>
    data.contents.find((c) => c.id === id)?.title ?? id
  const sourceName = (contentId: string) => {
    const c = data.contents.find((x) => x.id === contentId)
    return c
      ? (data.sources.find((s) => s.id === c.sources_id)?.name ?? "—")
      : "—"
  }

  const filtered = useMemo(() => {
    const enriched = data.analyses.map((a) => {
      const content = data.contents.find((c) => c.id === a.content_id)
      return {
        ...a,
        content_title: content?.title ?? "",
        content_data: content?.content_data ?? "",
        source_name: content
          ? (data.sources.find((s) => s.id === content.sources_id)?.name ?? "")
          : "",
      }
    }) as unknown as Row[]
    const byText = freeTextSearch(enriched, search)
    const byClass = classFilter
      ? byText.filter((a) => String(a.classification) === classFilter)
      : byText
    const byColumns = applyColumnFilters(byClass, colFilters, (row, key) => {
      const v = row[key as keyof typeof row] ?? row[key]
      const raw = String(v ?? "")
      return key.startsWith("date_") && raw
        ? `${raw} ${formatDateTime(raw)}`
        : raw
    })
    const byAdvanced = advancedIds
      ? byColumns.filter((a) => advancedIds.includes(String(a.id)))
      : byColumns
    return applyDateFilter(byAdvanced, dateFrom || null, dateTo || null, [
      "date_analysis",
      "date_creation",
    ]) as unknown as EnrichedAnalysis[]
  }, [
    data.analyses,
    data.contents,
    data.sources,
    search,
    classFilter,
    colFilters,
    dateFrom,
    dateTo,
    advancedIds,
  ])

  const analysisStats = useMemo(
    () =>
      computeEntityStats(
        "analyses",
        (search || classFilter || advancedIds || Object.keys(colFilters).length
          ? filtered
          : data.analyses) as unknown as Row[],
      ),
    [filtered, data.analyses, search, classFilter, advancedIds],
  )

  const paged = filtered.slice((page - 1) * pageSize, page * pageSize)

  const openAdd = () => {
    setForm(emptyAnalysis(initialContentId))
    setErrors({})
    setShowAdd(true)
  }

  const openEdit = () => {
    if (!selected) return
    setForm({ ...selected })
    setErrors({})
    setShowEdit(true)
  }

  const runExtraction = () => {
    const content = data.contents.find((c) => c.id === form.content_id)
    if (!content) {
      onToast(t.messages.pickContentFirst)
      return
    }
    const text = `${content.title}\n${content.content_data}`
    const result = extract(text)
    setExtraction(result)
    onToast(
      `Extracted ${result.people.length + result.places.length + result.organizations.length + result.sides.length} entities (${result.coordinates.length} coordinates)`,
    )
  }

  const autoExtract = () => {
    const result = extraction ?? runExtractionSilently()
    if (!result) return
    setForm((f) => {
      // mergeSuggestion intentionally returns only extracted fields. Keep the
      // relational fields (especially content_id) from the form; otherwise the
      // derived source name disappears and save validation asks the user to
      // choose the content again.
      const extracted = mergeSuggestion(f, result.suggestion, "merge")
      return { ...f, ...extracted }
    })
    setExtraction(null)
  }

  const runExtractionSilently = () => {
    const content = data.contents.find((c) => c.id === form.content_id)
    if (!content) {
      onToast(t.messages.pickContentFirst)
      return null
    }
    const result = extract(`${content.title}\n${content.content_data}`)
    setExtraction(result)
    return result
  }

  const validateForm = (f: typeof form) => {
    const issues = validate(
      "analyses",
      f as unknown as Record<string, unknown>,
      showEdit ? (selectedId ?? undefined) : undefined,
    )
    const errs: Record<string, string> = {}
    for (const issue of issues)
      if (issue.level === "error") errs[issue.field] = issue.message
    return errs
  }

  const handleSave = () => {
    const errs = validateForm(form)
    if (Object.keys(errs).length > 0) {
      setErrors(errs)
      return
    }
    if (showAdd) addAnalysis(form)
    else
      updateAnalysis({
        ...form,
        id: selectedId!,
        date_creation: selected!.date_creation,
        date_modified: "",
      })
    setShowAdd(false)
    setShowEdit(false)
    onToast(t.messages.saved)
  }

  const handleDelete = () => {
    if (!selectedId) return
    deleteAnalysis(selectedId)
    setSelectedId(null)
    setShowDelete(false)
    onToast(t.messages.deleted)
  }

  const handleBulkDelete = (ids: string[]) => {
    bulkDeleteAnalyses(ids)
    setSelectedIds([])
    setSelectedId(null)
    onToast(t.messages.bulkDeleted.replace("{n}", String(ids.length)))
  }

  const openMapView = () => {
    if (!selected?.list_coordinates) return
    const coords = selected.list_coordinates.split(",").map((s) => s.trim())
    if (coords.length >= 2) {
      window.open(
        `https://www.google.com/maps?q=${coords[0]},${coords[1]}`,
        "_blank",
      )
    }
  }

  const classOptions = useMemo(
    () => vocabulary.list(CLASSIFICATION_VOCABULARY),
    [vocabulary, vocabularyTick],
  )
  const classUsage = useMemo(
    () =>
      usageMap(
        data.analyses as unknown as Record<string, unknown>[],
        "classification",
      ),
    [data.analyses],
  )
  const classOpts = [
    { value: "", label: "— All —" },
    ...classOptions.map((o) => ({ value: o.value, label: o.value })),
  ]
  const orphanClasses = useMemo(
    () =>
      vocabulary.orphans(
        CLASSIFICATION_VOCABULARY,
        data.analyses as unknown as Record<string, unknown>[],
        "classification",
      ),
    [vocabulary, vocabularyTick, data.analyses],
  )
  // Keep relational pickers searchable. IDs remain the stored value while
  // titles, source names and content text are all searchable by the user.
  const contentOpts = data.contents.map((c) => {
    const source = data.sources.find((s) => s.id === c.sources_id)?.name ?? ""
    return {
      value: c.id,
      label: [c.title, source, c.note, c.date_content].filter(Boolean).join(" · "),
    }
  })

  const setColFilter = (key: string, value: string) => {
    setColFilters((f) => {
      const n = { ...f }
      if (value.trim()) n[key] = value
      else delete n[key]
      return n
    })
    setPage(1)
  }
  const sourceNames = [
    ...new Set(data.sources.map((x) => x.name).filter(Boolean)),
  ].sort((a, b) => a.localeCompare(b))
  const contentTitles = [
    ...new Set(data.contents.map((c) => c.title).filter(Boolean)),
  ].sort((a, b) => a.localeCompare(b))
  const classificationValues = [
    ...new Set(data.analyses.map((a) => a.classification).filter(Boolean)),
  ].sort((a, b) => a.localeCompare(b))
  const colFilter = (key: string, label: string, options?: string[]) => (
    <ColumnFilter
      label={`${label} — ${t.actions.filter}`}
      value={colFilters[key] ?? ""}
      onChange={(v) => setColFilter(key, v)}
      options={options}
    />
  )

  const columns: Column<EnrichedAnalysis>[] = [
    {
      key: "source_name",
      header: t.fields.sources_id,
      width: "13%",
      sortable: true,
      render: (a) => (
        <span className="truncate" style={{ color: "var(--muted-fg)" }}>
          {a.source_name || "—"}
        </span>
      ),
      filter: colFilter("source_name", t.fields.sources_id, sourceNames),
    },
    {
      key: "content_id",
      header: t.fields.content_id,
      width: "20%",
      sortable: true,
      render: (a) => (
        <span className="truncate" title={a.content_id}>
          {a.content_title || contentTitle(a.content_id)}
        </span>
      ),
      filter: colFilter("content_id", t.fields.content_id, contentTitles),
    },
    {
      key: "classification",
      header: t.fields.classification,
      width: "140px",
      sortable: true,
      render: (a) => <Badge color="#1d4ed8">{a.classification}</Badge>,
      filter: colFilter("classification", t.fields.classification, classificationValues),
    },
    {
      key: "list_names_people",
      header: t.fields.list_names_people,
      width: "16%",
      render: (a) => (
        <span className="text-xs truncate block">
          {a.list_names_people || "—"}
        </span>
      ),
      filter: colFilter("list_names_people", t.fields.list_names_people),
    },
    {
      key: "list_names_places",
      header: t.fields.list_names_places,
      width: "15%",
      render: (a) => (
        <span className="text-xs truncate block">
          {a.list_names_places || "—"}
        </span>
      ),
      filter: colFilter("list_names_places", t.fields.list_names_places),
    },
    {
      key: "list_sides",
      header: t.fields.list_sides,
      width: "14%",
      render: (a) => (
        <span className="text-xs truncate block">{a.list_sides || "—"}</span>
      ),
      filter: colFilter("list_sides", t.fields.list_sides),
    },
    {
      key: "date_analysis",
      header: t.fields.date_analysis,
      width: "96px",
      sortable: true,
      render: (a) => (
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.8em" }}>
          {a.date_analysis ? formatDateTime(a.date_analysis) : "—"}
        </span>
      ),
      filter: colFilter("date_analysis", t.fields.date_analysis),
    },
  ]

  const exportColumns = [
    { key: "id", label: "ID" },
    { key: "source_name", label: t.fields.sources_id },
    { key: "content_title", label: t.fields.content_id },
    { key: "classification", label: t.fields.classification },
    { key: "list_names_people", label: t.fields.list_names_people },
    { key: "list_names_places", label: t.fields.list_names_places },
    { key: "list_coordinates", label: t.fields.list_coordinates },
    { key: "list_sides", label: t.fields.list_sides },
    { key: "date_analysis", label: t.fields.date_analysis },
  ]

  const handlePrint = () => {
    const html = buildPrintDocument({
      columns: exportColumns.map((c) => ({
        key: c.key,
        label: c.label,
        format: c.key.startsWith("date") ? "datetime" : undefined,
      })),
      rows: filtered as unknown as Record<string, unknown>[],
      config: printConfig,
      title: `${t.sections.analysis.title} — ${filtered.length} ${t.messages.records}`,
      subtitle: [
        search ? `search: ${search}` : "",
        classFilter ? `classification: ${classFilter}` : "",
      ]
        .filter(Boolean)
        .join(" · "),
    })
    if (!printHtml(html)) onToast(t.messages.printUnavailable)
  }

  const advFields = [
    { value: "classification", label: t.fields.classification },
    { value: "list_names_people", label: t.fields.list_names_people },
    { value: "list_names_places", label: t.fields.list_names_places },
    { value: "list_coordinates", label: t.fields.list_coordinates },
    { value: "list_sides", label: t.fields.list_sides },
    { value: "date_analysis", label: t.fields.date_analysis },
  ]

  const moreItems = [
    {
      label: t.actions.viewOnMap,
      icon: <MapPinIcon size="xs" />,
      onClick: openMapView,
      disabled: !selected?.list_coordinates,
    },
    {
      label: t.actions.advancedSearch,
      icon: <SearchCodeIcon size="xs" />,
      onClick: () => setShowAdvSearch(true),
    },
    {
      label: "Filter builder",
      icon: <SearchCodeIcon size="xs" />,
      onClick: () => setShowFilterBuilder(true),
    },
    {
      label: t.dialogs.statistics.title,
      icon: <SigmaIcon size="xs" />,
      onClick: () => setShowStats(true),
    },
    {
      label: t.actions.importAnalysis,
      icon: <ImportFile size="xs" />,
      onClick: () => setShowImport(true),
    },
    {
      label: t.actions.compare,
      icon: <CompareIcon size="xs" />,
      onClick: () => {
        if (filtered.length < 2) {
          onToast(t.messages.needCompare)
          return
        }
        setShowCompare(true)
      },
    },
    {
      label: t.actions.summary,
      icon: <LayersIcon size="xs" />,
      onClick: () => {
        if (!filtered.length) {
          onToast(t.messages.nothingToExport)
          return
        }
        setShowSummary(true)
      },
    },
    {
      label: t.actions.bulkOperations,
      icon: <LayersIcon size="xs" />,
      onClick: () => setShowBulkOps(true),
      disabled: selectedIds.length === 0,
    },
  ]

  const renderForm = () => (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4">
        <Field label={t.fields.content_id} required error={errors.content_id}>
          <ComboField
            id="analysis-content"
            value={form.content_id}
            onChange={(next) => setForm((f) => ({ ...f, content_id: next }))}
            options={contentOpts}
            allowCreate={false}
            placeholder="Search content by title or source…"
            error={!!errors.content_id}
          />
        </Field>
        <Field label={t.fields.sources_id}>
          <Input
            readOnly
            value={form.content_id ? sourceName(form.content_id) : ""}
            placeholder="Selected content source appears here"
            aria-label={t.fields.sources_id}
            style={{
              background: "var(--surface-2)",
              color: "var(--muted-fg)",
              cursor: "default",
            }}
          />
        </Field>
        <Field
          label={t.fields.classification}
          required
          error={errors.classification}
        >
          <ComboField
            id="analysis-classification"
            value={form.classification}
            onChange={(next) =>
              setForm((f) => ({ ...f, classification: next }))
            }
            options={classOptions}
            usage={classUsage}
            placeholder="Type or pick a classification…"
            error={!!errors.classification}
            createLabel={(typed) => `Add “${typed}” and teach the extractor`}
            onCreate={(value) => {
              addVocabularyValue(CLASSIFICATION_VOCABULARY, value)
              // A new category is only useful if automated extraction knows it.
              if (
                !taxonomy.some(
                  (rule) =>
                    rule.classification.toLowerCase() === value.toLowerCase(),
                )
              ) {
                setTaxonomy([
                  ...taxonomy,
                  { classification: value, keywords: [] },
                ])
              }
              onToast(
                `Classification “${value}” added — add keywords in the Dictionary to enable auto-classification`,
              )
            }}
            onRemove={(value) => {
              const result = removeVocabularyValue(
                CLASSIFICATION_VOCABULARY,
                value,
                classUsage[value.toLowerCase()] ?? 0,
              )
              onToast(
                result.ok
                  ? `Removed “${value}”`
                  : `Cannot remove “${value}”: ${result.reason ?? "in use"}`,
              )
            }}
          />
        </Field>
      </div>
      <div className="flex items-center justify-between">
        <span
          className="text-xs font-semibold uppercase tracking-wide"
          style={{ color: "var(--muted-fg)" }}
        >
          Entity extraction
        </span>
        <div className="flex gap-2">
          <Btn
            size="xs"
            variant="ghost"
            onClick={runExtraction}
            disabled={!form.content_id}
          >
            Preview extraction
          </Btn>
          <Btn
            size="xs"
            onClick={autoExtract}
            disabled={!form.content_id}
            icon={<Bolt size="xs" />}
          >
            {t.actions.extract}
          </Btn>
        </div>
      </div>
      {extraction && (
        <div
          className="rounded p-3 text-xs space-y-1"
          style={{
            background: "var(--secondary-bg)",
            border: "1px solid var(--border)",
          }}
        >
          <div className="flex items-center justify-between">
            <span className="font-semibold">Extraction preview</span>
            <span
              style={{
                color: "var(--muted-fg)",
                fontFamily: "var(--font-mono)",
              }}
            >
              {extraction.stats.words} words · {extraction.stats.language} ·{" "}
              {extraction.stats.elapsedMs.toFixed(1)} ms
            </span>
          </div>
          <div style={{ color: "var(--muted-fg)" }}>
            {extraction.people.length} people · {extraction.places.length}{" "}
            places · {extraction.organizations.length} organizations ·{" "}
            {extraction.sides.length} sides · {extraction.coordinates.length}{" "}
            coordinates · {extraction.dates.length} dates
            {extraction.stats.truncated ? " · document truncated" : ""}
          </div>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              wordBreak: "break-word",
            }}
          >
            {extraction.suggestion.classification || "—"} ·{" "}
            {extraction.suggestion.list_names_people || "no people"} ·{" "}
            {extraction.suggestion.list_names_places || "no places"} ·{" "}
            {extraction.suggestion.list_coordinates || "no coordinates"}
          </div>
          <div className="flex gap-2 pt-1">
            <Btn size="xs" variant="primary" onClick={autoExtract}>
              Apply to form (merge)
            </Btn>
            <Btn
              size="xs"
              variant="ghost"
              onClick={() =>
                setForm(
                  (f) =>
                    mergeSuggestion(
                      f as unknown as Record<string, unknown>,
                      extraction.suggestion,
                      "fill-empty",
                    ) as unknown as typeof f,
                )
              }
            >
              Fill empty only
            </Btn>
            <Btn size="xs" variant="ghost" onClick={() => setExtraction(null)}>
              Dismiss
            </Btn>
          </div>
        </div>
      )}
      <div className="grid grid-cols-2 gap-4">
        <Field label={t.fields.list_names_people} hint="Comma-separated names">
          <Textarea
            value={form.list_names_people}
            onChange={(e) =>
              setForm((f) => ({ ...f, list_names_people: e.target.value }))
            }
            rows={3}
          />
        </Field>
        <Field label={t.fields.list_names_places} hint="Comma-separated places">
          <Textarea
            value={form.list_names_places}
            onChange={(e) =>
              setForm((f) => ({ ...f, list_names_places: e.target.value }))
            }
            rows={3}
          />
        </Field>
        <Field label={t.fields.list_coordinates} hint="lat, lon">
          <Input
            value={form.list_coordinates}
            onChange={(e) =>
              setForm((f) => ({ ...f, list_coordinates: e.target.value }))
            }
            placeholder="e.g. 39.92, 32.85"
          />
        </Field>
        <Field label={t.fields.list_sides} hint="Semicolon-separated">
          <Input
            value={form.list_sides}
            onChange={(e) =>
              setForm((f) => ({ ...f, list_sides: e.target.value }))
            }
          />
        </Field>
        <Field
          label={t.fields.date_analysis}
          hint="Date and time of the analysis"
        >
          <DateTimeInput
            value={form.date_analysis}
            onChange={(v) => setForm((f) => ({ ...f, date_analysis: v }))}
          />
        </Field>
      </div>
    </div>
  )

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PageHeader
        eyebrow={t.nav.analysisDesc}
        title={t.sections.analysis.title}
        subtitle={t.sections.analysis.subtitle}
        icon={<NavAnalysis size="md" />}
        count={{ value: data.analyses.length, label: t.messages.records }}
        actions={
          <Btn variant="primary" onClick={openAdd} icon={<Plus size="sm" />}>
            {t.sections.analysis.add}
          </Btn>
        }
      />

      <div className="work-card mx-3 mb-3">
      <FilterRow>
        <SearchInput
          value={search}
          onChange={(v) => {
            setSearch(v)
            setPage(1)
          }}
          placeholder={t.messages.searchPlaceholder}
        />
        <Select
          value={classFilter}
          onChange={(e) => {
            setClassFilter(e.target.value)
            setPage(1)
          }}
          options={classOpts}
          className="!w-44"
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
            !search && !classFilter && !dateFrom && !dateTo && !advancedIds && Object.keys(colFilters).length === 0
          }
          onClick={() => {
            setSearch("")
            setColFilters({})
            setClassFilter("")
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

      <WorkspaceToolbar
        selectionCount={selectedIds.length}
        onClearSelection={() => {
          setSelectedId(null)
          setSelectedIds([])
        }}
      >
      <Toolbar>
        <Btn
          onClick={openEdit}
          disabled={!selected}
          icon={<Pencil size="xs" />}
        >
          {t.actions.edit}
        </Btn>
        <Btn
          variant="danger"
          onClick={() => setShowDelete(true)}
          disabled={!selected}
          icon={<Trash size="xs" />}
        >
          {t.actions.delete}
        </Btn>
        <Btn
          onClick={() => {
            if (selectedId) duplicateAnalysis(selectedId)
          }}
          disabled={!selected}
          icon={<CopyIcon size="xs" />}
        >
          {t.actions.duplicate}
        </Btn>
        <ToolbarSep />
        <Btn
          onClick={openMapView}
          disabled={!selected?.list_coordinates}
          icon={<MapPinIcon size="xs" />}
        >
          {t.actions.mapView}
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
      </WorkspaceToolbar>

      {orphanClasses.length > 0 && (
        <div
          className="px-3 py-1.5 flex items-center gap-2 flex-wrap shrink-0 text-xs"
          style={{
            background: "color-mix(in srgb, var(--warning) 8%, var(--surface))",
            borderBottom: "1px solid color-mix(in srgb, var(--warning) 26%, transparent)",
            color: "color-mix(in srgb, var(--warning) 80%, var(--fg))",
          }}
        >
          <TriangleAlert size="sm" style={{ flex: "none" }} />
          <span className="font-semibold">
            {t.sections.dictionary.vocabDrift}
          </span>
          <span>{t.sections.dictionary.vocabDriftHint}</span>
          {orphanClasses.slice(0, 4).map((o) => (
            <button
              key={o.value}
              className="underline"
              onClick={() => {
                addVocabularyValue(CLASSIFICATION_VOCABULARY, o.value)
                onToast(
                  t.sections.dictionary.vocabAdded
                    .replace("{v}", o.value)
                    .replace("{k}", CLASSIFICATION_VOCABULARY),
                )
              }}
            >
              {t.sections.dictionary.vocabAdopt} “{o.value}” ({o.count})
            </button>
          ))}
        </div>
      )}

      <ResultsStrip
        total={data.analyses.length}
        filtered={filtered.length}
        selected={selectedIds.length}
        recordsLabel={t.messages.records}
        totalLabel={t.messages.total}
        selectedLabel={t.messages.selected}
      />

      <div className="flex-1 min-h-0 overflow-hidden">
        {filtered.length === 0 ? (
          <EmptyState
            variant={
              advancedIds || search || classFilter || dateFrom || dateTo
                ? "noResults"
                : "empty"
            }
            title={
              advancedIds || search || classFilter || dateFrom || dateTo
                ? t.messages.noFilterMatches
                : t.sections.analysis.noData
            }
            action={
              search || classFilter || dateFrom || dateTo || advancedIds ? (
                <Btn
                  size="xs"
                  variant="ghost"
                  onClick={() => {
                    setSearch("")
                    setClassFilter("")
                    setDateFrom("")
                    setDateTo("")
                    setAdvancedIds(null)
                    setPage(1)
                  }}
                  icon={<Reset size="xs" />}
                >
                  {t.actions.clearFilters}
                </Btn>
              ) : (
                <Btn
                  variant="primary"
                  onClick={openAdd}
                  icon={<Plus size="sm" />}
                >
                  {t.sections.analysis.add}
                </Btn>
              )
            }
          />
        ) : (
          <DataTable
            columns={columns}
            entity="analyses"
            data={paged}
            selectedId={selectedId ?? undefined}
            selectedIds={selectedIds}
            onSelect={(r) => setSelectedId(r?.id ?? null)}
            onSelectionChange={(ids) => {
              setSelectedIds(ids)
              if (ids.length === 1) setSelectedId(ids[0])
            }}
            onDoubleClick={() => openEdit()}
            emptyText={t.sections.analysis.noData}
            rowNumberOffset={(page - 1) * pageSize}
            density={settings.density === "compact" ? "compact" : "comfortable"}
          />
        )}
      </div>

      {selectedIds.length > 0 && (
        <SelectionBar
          count={selectedIds.length}
          onClear={() => setSelectedIds([])}
          onBulkDelete={() => setShowBulkOps(true)}
          label={t.messages.selected}
        />
      )}
      <FullTextPreview
        record={selected}
        recordType={selected ? "analysis" : null}
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
      </div>

      <FormModal
        isOpen={showAdd}
        title={t.sections.analysis.add}
        onClose={() => setShowAdd(false)}
        onSave={handleSave}
        saveLabel={t.actions.save}
        size="lg"
      >
        {renderForm()}
      </FormModal>
      <FormModal
        isOpen={showEdit}
        title={t.sections.analysis.edit}
        onClose={() => setShowEdit(false)}
        onSave={handleSave}
        saveLabel={t.actions.save}
        size="lg"
      >
        {renderForm()}
      </FormModal>
      <ConfirmDialog
        isOpen={showDelete}
        title={t.actions.delete}
        message={t.messages.confirmDelete}
        onConfirm={handleDelete}
        onCancel={() => setShowDelete(false)}
        danger
      />
      <ExportDialog
        isOpen={showExport}
        onClose={() => setShowExport(false)}
        data={filtered as unknown as Record<string, unknown>[]}
        columns={exportColumns}
        defaultFilename="analysis"
      />
      <ImportWizard
        isOpen={showImport}
        onClose={() => setShowImport(false)}
        targetType="analysis"
        onToast={onToast}
      />
      {showFilterBuilder && (
        <InfoModal isOpen title="Analysis filter builder" onClose={() => setShowFilterBuilder(false)} size="lg">
          <FilterBuilder
            entity="analyses"
            onApply={(groups: FilterGroup[]) => {
              const rows = applyFilterGroups(data.analyses as unknown as Record<string, unknown>[], groups)
              setAdvancedIds(rows.map((row) => String(row.id)))
              setPage(1)
              setShowFilterBuilder(false)
              onToast(`Applied filter builder: ${rows.length} records`)
            }}
            onClear={() => { setAdvancedIds(null); setShowFilterBuilder(false) }}
          />
        </InfoModal>
      )}
      <AdvancedSearch
        isOpen={showAdvSearch}
        onClose={() => setShowAdvSearch(false)}
        fields={advFields}
        data={data.analyses as unknown as Record<string, unknown>[]}
        target="analyses"
        onApply={(rows) => {
          setAdvancedIds(rows.map((r) => String(r.id)))
          setPage(1)
          onToast(
            t.messages.advancedApplied.replace("{n}", String(rows.length)),
          )
        }}
      />
      <InfoModal
        isOpen={showStats}
        title={t.dialogs.statistics.title}
        onClose={() => setShowStats(false)}
        size="md"
      >
        <div className="flex flex-col gap-3 text-xs">
          <div className="grid grid-cols-2 gap-2">
            <StatCard
              label={t.dialogs.statistics.totalRecords}
              value={String(analysisStats.total)}
            />
            <StatCard
              label={t.dialogs.statistics.byClassification}
              value={String(analysisStats.classifications?.length ?? 0)}
            />
            <StatCard
              label={t.fields.list_names_people}
              value={String(analysisStats.uniquePeople ?? 0)}
            />
            <StatCard
              label={t.fields.list_names_places}
              value={String(analysisStats.uniquePlaces ?? 0)}
            />
          </div>
          <div
            className="rounded p-2"
            style={{
              background: "var(--secondary-bg)",
              color: "var(--muted-fg)",
            }}
          >
            {t.dialogs.statistics.byClassification}
          </div>
          {(analysisStats.classifications ?? []).map((b) => (
            <div key={b.key} className="flex items-center gap-2 py-0.5">
              <span className="truncate" style={{ flex: "1 1 auto" }}>
                {b.label}
              </span>
              <div
                className="h-2 rounded-full overflow-hidden"
                style={{ width: 90, background: "var(--border)" }}
              >
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${(b.share * 100).toFixed(1)}%`,
                    background: "#7c3aed",
                  }}
                />
              </div>
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  width: 34,
                  textAlign: "end",
                }}
              >
                {b.count}
              </span>
            </div>
          ))}
          <div style={{ color: "var(--muted-fg)" }}>
            Geotagged: {analysisStats.withCoordinates ?? 0} ·{" "}
            {t.dialogs.statistics.dateRange}:{" "}
            {analysisStats.dateRange.from ?? "—"} →{" "}
            {analysisStats.dateRange.to ?? "—"}
          </div>
          <div className="flex justify-end">
            <Btn onClick={() => setShowStats(false)}>{t.actions.close}</Btn>
          </div>
        </div>
      </InfoModal>
      <BulkOperations
        isOpen={showBulkOps}
        onClose={() => setShowBulkOps(false)}
        selectedIds={selectedIds}
        entity="analyses"
        data={data.analyses.map((a) => ({ id: a.id, label: a.classification }))}
        onToast={onToast}
        onBulkDelete={handleBulkDelete}
      />
      <ComparisonDialog
        isOpen={showCompare}
        onClose={() => setShowCompare(false)}
        analyses={filtered}
        contentTitle={contentTitle}
      />
      <SummaryDialog
        isOpen={showSummary}
        onClose={() => setShowSummary(false)}
        analyses={filtered}
      />
    </div>
  )
}