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
  ImportanceBar,
  RecordTypeBadge,
  MoreMenu,
  Badge,
  StatCard,
  PageHeader,
  EmptyState,
} from "../components/ui"
import {
  NavSources,
  Plus,
  Pencil,
  Trash,
  Refresh,
  ImportFile,
  CopyIcon,
  ExportArrow,
  Print,
  SearchCodeIcon,
  SigmaIcon,
  LayersIcon,
} from "../components/icons"
import { ExportDialog } from "../components/ExportDialog"
import { AdvancedSearch } from "../components/AdvancedSearch"
import { ComboField, usageMap } from "../components/ComboField"
import { formatDateTime, nowIso } from "../core/text"
import { BulkOperations } from "../components/BulkOperations"
import { ImportWizard } from "../components/ImportWizard"
import { useAppData } from "../store/AppContext"
import { useSettings } from "../store/SettingsContext"
import { useTranslation } from "../i18n"
import { paletteFor } from "../core/charts"
import type { Source } from "../types"
import { applyDateFilter, freeTextSearch } from "../core/search"
import { computeEntityStats } from "../core/stats"
import { buildPrintDocument, printHtml } from "../core/print"
import { hasErrors, type ValidationIssue } from "../core/validation"

const TYPE_VOCABULARY = "sources.type"

function emptySource(): Omit<Source, "id" | "date_creation" | "date_modified"> {
  return {
    name: "",
    type: "website",
    link_sources: "",
    importance: 0.75,
    country: "",
    city: "",
    description: "",
    accounts: "",
    note: "",
    ownership: "",
    date_entry: nowIso(),
  }
}

export function SourcesView({
  onToast,
  autoOpenAdd = 0 /** nonce from the shell Quick Add flow — opens the Add dialog once */,
}: {
  onToast: (m: string) => void
  autoOpenAdd?: number
}) {
  const { t } = useTranslation()
  const { settings } = useSettings()
  const {
    data,
    addSource,
    updateSource,
    deleteSource,
    duplicateSource,
    bulkDeleteSources,
    printConfig,
    validate,
    vocabulary,
    vocabularyTick,
    addVocabularyValue,
    removeVocabularyValue,
  } = useAppData()

  const [search, setSearch] = useState("")
  const [typeFilter, setTypeFilter] = useState("")
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
  const [showAdvSearch, setShowAdvSearch] = useState(false)
  const [showBulkOps, setShowBulkOps] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [showStats, setShowStats] = useState(false)
  const [form, setForm] = useState(emptySource())
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [importancePct, setImportancePct] = useState("75.00")
  const [advancedIds, setAdvancedIds] = useState<string[] | null>(null)

  const selected = data.sources.find((s) => s.id === selectedId) ?? null

  // Shell-initiated quick add: open the Add dialog once per nonce.
  const [seenAddNonce, setSeenAddNonce] = useState(0)
  useEffect(() => {
    if (autoOpenAdd && autoOpenAdd !== seenAddNonce) {
      setSeenAddNonce(autoOpenAdd)
      openAdd()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoOpenAdd])

  const filtered = useMemo(() => {
    const rows = data.sources as unknown as Record<string, unknown>[]
    const typed = typeFilter
      ? rows.filter((s) => String(s.type) === typeFilter)
      : rows
    const byText = freeTextSearch(typed, search)
    const byAdvanced = advancedIds
      ? byText.filter((r) => advancedIds.includes(String(r.id)))
      : byText
    return applyDateFilter(byAdvanced, dateFrom || null, dateTo || null, [
      "date_entry",
      "date_creation",
    ]) as unknown as Source[]
  }, [data.sources, search, typeFilter, dateFrom, dateTo, advancedIds])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize)

  const openAdd = () => {
    setForm(emptySource())
    setImportancePct("75.00")
    setErrors({})
    setShowAdd(true)
  }
  const openEdit = () => {
    if (!selected) return
    setForm({ ...selected })
    setImportancePct((selected.importance * 100).toFixed(2))
    setErrors({})
    setShowEdit(true)
  }

  const validateForm = (f: typeof form): Record<string, string> => {
    const errs: Record<string, string> = {}
    if (!f.name.trim()) errs.name = t.messages.required
    if (f.link_sources && !/^https?:\/\//.test(f.link_sources))
      errs.link_sources = t.messages.urlInvalid
    const imp = parseFloat(importancePct)
    if (isNaN(imp) || imp < 0 || imp > 100)
      errs.importance = t.messages.importanceRange
    return errs
  }

  const handleSave = () => {
    const imp = parseFloat(importancePct) / 100
    const payload = { ...form, importance: imp }
    const localErrors = validateForm(payload)
    if (Object.keys(localErrors).length > 0) {
      setErrors(localErrors)
      return
    }

    // The repository is the authority: it re-checks required fields, URL shape,
    // uniqueness and whole-record duplicates.
    const issues = validate(
      "sources",
      payload as unknown as Record<string, unknown>,
      showEdit ? (selectedId ?? undefined) : undefined,
    )
    const fieldErrors: Record<string, string> = {}
    const warnings: string[] = []
    for (const issue of issues) {
      if (issue.level === "warning") warnings.push(issue.message)
      else fieldErrors[issue.field] = issue.message
    }
    if (Object.keys(fieldErrors).length > 0) {
      setErrors(fieldErrors)
      onToast(Object.values(fieldErrors)[0])
      return
    }

    const result = showAdd
      ? addSource(payload)
      : updateSource({ ...payload, id: selectedId! })
    if (!result.ok || hasErrors(result.issues)) {
      const messages = result.issues
        .filter((i: ValidationIssue) => i.level === "error")
        .map(
          (i: ValidationIssue) =>
            `${(t.fields as Record<string, string>)[i.field] ?? i.field}: ${i.message}`,
        )
      onToast(messages[0] ?? t.messages.saved)
      return
    }
    setShowAdd(false)
    setShowEdit(false)
    onToast(
      warnings.length
        ? `${t.messages.saved} — ${warnings[0]}`
        : t.messages.saved,
    )
  }

  const handleDelete = () => {
    if (!selectedId) return
    deleteSource(selectedId)
    setSelectedId(null)
    setShowDelete(false)
    onToast(t.messages.deleted)
  }

  const handleDuplicate = () => {
    if (!selectedId) return
    duplicateSource(selectedId)
    onToast(t.messages.duplicated)
  }

  const handleBulkDelete = (ids: string[]) => {
    bulkDeleteSources(ids)
    setSelectedIds([])
    setSelectedId(null)
    onToast(t.messages.bulkDeleted.replace("{n}", String(ids.length)))
  }

  const handlePrint = () => {
    const html = buildPrintDocument({
      columns: exportColumns.map((c) => ({
        key: c.key,
        label: c.label,
        format:
          c.key === "importance"
            ? "percent"
            : c.key.startsWith("date")
              ? "datetime"
              : undefined,
      })),
      rows: filtered as unknown as Record<string, unknown>[],
      config: printConfig,
      title: `${t.sections.sources.title} — ${filtered.length} ${t.messages.records}`,
      subtitle: [
        search ? `search: ${search}` : "",
        typeFilter ? `type: ${typeFilter}` : "",
      ]
        .filter(Boolean)
        .join(" · "),
    })
    if (!printHtml(html)) onToast(t.messages.printUnavailable)
  }

  const typeOptions = useMemo(
    () => vocabulary.list(TYPE_VOCABULARY),
    [vocabulary, vocabularyTick],
  )
  const typeUsage = useMemo(
    () =>
      usageMap(data.sources as unknown as Record<string, unknown>[], "type"),
    [data.sources],
  )
  const typeOpts = [
    { value: "", label: `— All types —` },
    ...typeOptions.map((o) => ({ value: o.value, label: o.value })),
  ]
  // Values stored on records but missing from the vocabulary are still offered.
  const orphanTypes = useMemo(
    () =>
      vocabulary.orphans(
        TYPE_VOCABULARY,
        data.sources as unknown as Record<string, unknown>[],
        "type",
      ),
    [vocabulary, vocabularyTick, data.sources],
  )

  const columns: Column<Source>[] = [
    { key: "name", header: t.fields.name, width: "22%", sortable: true },
    {
      key: "type",
      header: t.fields.type,
      width: "90px",
      sortable: true,
      render: (s) => (
        <Badge>
          <span
            className="type-dot"
            style={{ background: paletteFor(s.type ?? ""), color: s.type ?? "" }}
          />
          {s.type}
        </Badge>
      ),
    },
    {
      key: "link_sources",
      header: t.fields.link_sources,
      width: "22%",
      render: (s) =>
        s.link_sources ? (
          <a
            href={s.link_sources}
            target="_blank"
            rel="noreferrer"
            className="text-blue-600 hover:underline truncate block text-xs"
            onClick={(e) => e.stopPropagation()}
          >
            {s.link_sources}
          </a>
        ) : (
          <span style={{ color: "var(--muted-fg)" }}>—</span>
        ),
    },
    {
      key: "importance",
      header: t.fields.importance,
      width: "110px",
      sortable: true,
      render: (s) => <ImportanceBar value={s.importance} />,
    },
    {
      key: "country",
      header: t.fields.country,
      width: "14%",
      sortable: true,
      render: (s) => (
        <span>{[s.city, s.country].filter(Boolean).join(", ") || "—"}</span>
      ),
    },
    {
      key: "date_entry",
      header: t.fields.date_entry,
      width: "90px",
      sortable: true,
      render: (s) => (
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.8em" }}>
          {s.date_entry ? formatDateTime(s.date_entry) : "—"}
        </span>
      ),
    },
  ]

  const exportColumns = [
    { key: "id", label: "ID" },
    { key: "name", label: t.fields.name },
    { key: "type", label: t.fields.type },
    { key: "link_sources", label: t.fields.link_sources },
    { key: "importance", label: t.fields.importance },
    { key: "country", label: t.fields.country },
    { key: "city", label: t.fields.city },
    { key: "description", label: t.fields.description },
    { key: "date_entry", label: t.fields.date_entry },
  ]

  const searchFields = [
    { value: "name", label: t.fields.name },
    { value: "type", label: t.fields.type },
    { value: "country", label: t.fields.country },
    { value: "description", label: t.fields.description },
    { value: "link_sources", label: t.fields.link_sources },
  ]

  const moreItems = [
    {
      label: t.actions.advancedSearch,
      icon: <SearchCodeIcon size="xs" />,
      onClick: () => setShowAdvSearch(true),
    },
    {
      label: t.actions.bulkOperations,
      icon: <LayersIcon size="xs" />,
      onClick: () => setShowBulkOps(true),
      disabled: selectedIds.length === 0,
    },
    {
      label: t.dialogs.statistics.title,
      icon: <SigmaIcon size="xs" />,
      onClick: () => setShowStats(true),
    },
    { divider: true, label: "", onClick: () => {} },
    {
      label: t.actions.importSources,
      icon: <ImportFile size="xs" />,
      onClick: () => setShowImport(true),
    },
  ]

  const statsInfo = useMemo(() => {
    const stats = computeEntityStats(
      "sources",
      data.sources as unknown as Record<string, unknown>[],
    )
    return {
      total: stats.total,
      avgImp: (stats.avgImportance * 100).toFixed(1),
      byType:
        stats.fields
          .find((f) => f.field === "type")
          ?.top.slice(0, 8)
          .map((b) => ({ type: b.label, count: b.count })) ?? [],
      byCountry:
        stats.fields
          .find((f) => f.field === "country")
          ?.top.slice(0, 5)
          .map((b) => ({ country: b.label, count: b.count })) ?? [],
      dateRange: stats.dateRange,
      filled: stats.fields,
    }
  }, [data.sources])

  const renderForm = () => (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4">
        <Field label={t.fields.name} required error={errors.name}>
          <Input
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            error={!!errors.name}
          />
        </Field>
        <Field label={t.fields.type} required>
          <ComboField
            id="source-type"
            value={form.type}
            onChange={(next) => setForm((f) => ({ ...f, type: next }))}
            options={typeOptions}
            usage={typeUsage}
            placeholder="Type or pick a type…"
            error={!!errors.type}
            onCreate={(value) => {
              addVocabularyValue(TYPE_VOCABULARY, value)
              onToast(
                t.sections.dictionary.vocabAdded
                  .replace("{v}", value)
                  .replace("{k}", TYPE_VOCABULARY),
              )
            }}
            onRemove={(value) => {
              const result = removeVocabularyValue(
                TYPE_VOCABULARY,
                value,
                typeUsage[value.toLowerCase()] ?? 0,
              )
              onToast(
                result.ok
                  ? `Removed “${value}”`
                  : `Cannot remove “${value}”: ${result.reason ?? "in use"}`,
              )
            }}
          />
        </Field>
        <Field label={t.fields.link_sources} error={errors.link_sources}>
          <Input
            value={form.link_sources}
            onChange={(e) =>
              setForm((f) => ({ ...f, link_sources: e.target.value }))
            }
            placeholder="https://"
            error={!!errors.link_sources}
          />
        </Field>
        <Field
          label={`${t.fields.importance} (0–100%)`}
          required
          error={errors.importance}
        >
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={0}
              max={100}
              step={0.01}
              value={importancePct}
              onChange={(e) => setImportancePct(e.target.value)}
              className="w-24"
              error={!!errors.importance}
            />
            <span className="text-xs" style={{ color: "var(--muted-fg)" }}>
              %
            </span>
            <ImportanceBar value={parseFloat(importancePct) / 100 || 0} />
          </div>
        </Field>
        <Field label={t.fields.country}>
          <Input
            value={form.country}
            onChange={(e) =>
              setForm((f) => ({ ...f, country: e.target.value }))
            }
          />
        </Field>
        <Field label={t.fields.city}>
          <Input
            value={form.city}
            onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
          />
        </Field>
        <Field label={t.fields.date_entry} required>
          <DateTimeInput
            value={form.date_entry}
            onChange={(v) => setForm((f) => ({ ...f, date_entry: v }))}
            hint="Date and time of entry"
          />
        </Field>
        <Field label={t.fields.ownership}>
          <Input
            value={form.ownership}
            onChange={(e) =>
              setForm((f) => ({ ...f, ownership: e.target.value }))
            }
          />
        </Field>
      </div>
      <Field
        label={t.fields.accounts}
        hint="Separate multiple accounts with semicolons"
      >
        <Input
          value={form.accounts}
          onChange={(e) => setForm((f) => ({ ...f, accounts: e.target.value }))}
        />
      </Field>
      <Field label={t.fields.description}>
        <Textarea
          value={form.description}
          onChange={(e) =>
            setForm((f) => ({ ...f, description: e.target.value }))
          }
          rows={3}
        />
      </Field>
      <Field label={t.fields.note}>
        <Textarea
          value={form.note}
          onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
          rows={2}
        />
      </Field>
    </div>
  )

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PageHeader
        eyebrow={t.nav.sourcesDesc}
        title={t.sections.sources.title}
        subtitle={t.sections.sources.subtitle}
        icon={<NavSources size="md" />}
        count={{ value: data.sources.length, label: t.messages.records }}
        actions={
          <Btn variant="primary" onClick={openAdd} icon={<Plus size="sm" />}>
            {t.sections.sources.add}
          </Btn>
        }
      />

      {/* Filter row */}
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
          value={typeFilter}
          onChange={(e) => {
            setTypeFilter(e.target.value)
            setPage(1)
          }}
          options={typeOpts}
          className="!w-32"
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
          size="xs"
          onClick={() => {
            setSearch("")
            setTypeFilter("")
            setDateFrom("")
            setDateTo("")
            setAdvancedIds(null)
            setPage(1)
          }}
          variant="ghost"
        >
          {t.actions.clearFilters}
        </Btn>
        {advancedIds && (
          <Btn size="xs" variant="ghost" onClick={() => setAdvancedIds(null)}>
            Clear advanced ({advancedIds.length})
          </Btn>
        )}
      </FilterRow>

      {/* Action row */}
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
            setSelectedId(null)
            setSelectedIds([])
          }}
          variant="ghost"
          icon={<Refresh size="xs" />}
        >
          {t.actions.refresh}
        </Btn>
        <ToolbarSep />
        <Btn
          onClick={() => setShowImport(true)}
          icon={<ImportFile size="xs" />}
        >
          {t.actions.import}
        </Btn>
        <Btn
          onClick={handleDuplicate}
          disabled={!selected}
          icon={<CopyIcon size="xs" />}
        >
          {t.actions.duplicate}
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

      {orphanTypes.length > 0 && (
        <div
          className="px-3 py-1.5 flex items-center gap-2 flex-wrap shrink-0 text-xs"
          style={{
            background: "#fffbeb",
            borderBottom: "1px solid #fde68a",
            color: "#b45309",
          }}
        >
          <span className="font-semibold">
            {t.sections.dictionary.vocabDrift}
          </span>
          <span>{t.sections.dictionary.vocabDriftHint}</span>
          {orphanTypes.slice(0, 4).map((o) => (
            <button
              key={o.value}
              className="underline"
              onClick={() => {
                addVocabularyValue(TYPE_VOCABULARY, o.value)
                onToast(
                  t.sections.dictionary.vocabAdded
                    .replace("{v}", o.value)
                    .replace("{k}", TYPE_VOCABULARY),
                )
              }}
            >
              {t.sections.dictionary.vocabAdopt} “{o.value}” ({o.count})
            </button>
          ))}
        </div>
      )}

      {/* Results strip */}
      <ResultsStrip
        total={data.sources.length}
        filtered={filtered.length}
        selected={selectedIds.length}
        recordsLabel={t.messages.records}
        totalLabel={t.messages.total}
        selectedLabel={t.messages.selected}
      />

      {/* Table */}
      <div className="flex-1 overflow-hidden">
        {filtered.length === 0 ? (
          <EmptyState
            variant={
              advancedIds || search || typeFilter || dateFrom || dateTo
                ? "noResults"
                : "empty"
            }
            title={
              advancedIds || search || typeFilter || dateFrom || dateTo
                ? t.messages.noFilterMatches
                : t.sections.sources.noData
            }
            description={
              advancedIds || search || typeFilter || dateFrom || dateTo
                ? undefined
                : undefined
            }
            action={
              search || typeFilter || dateFrom || dateTo || advancedIds ? (
                <Btn
                  size="xs"
                  variant="ghost"
                  onClick={() => {
                    setSearch("")
                    setTypeFilter("")
                    setDateFrom("")
                    setDateTo("")
                    setAdvancedIds(null)
                    setPage(1)
                  }}
                  icon={<Refresh size="xs" />}
                >
                  {t.actions.clearFilters}
                </Btn>
              ) : (
                <Btn
                  variant="primary"
                  onClick={openAdd}
                  icon={<Plus size="sm" />}
                >
                  {t.sections.sources.add}
                </Btn>
              )
            }
          />
        ) : (
          <DataTable
            columns={columns}
            data={paged}
            selectedId={selectedId ?? undefined}
            selectedIds={selectedIds}
            onSelect={(r) => setSelectedId(r?.id ?? null)}
            onSelectionChange={(ids) => {
              setSelectedIds(ids)
              if (ids.length === 1) setSelectedId(ids[0])
            }}
            onDoubleClick={() => openEdit()}
            emptyText={t.sections.sources.noData}
            rowNumberOffset={(page - 1) * pageSize}
            density={
              settings.density === "compact"
                ? "compact"
                : settings.density === "expansive"
                  ? "expansive"
                  : "comfortable"
            }
          />
        )}
      </div>

      {/* Selection bar */}
      {selectedIds.length > 0 && (
        <SelectionBar
          count={selectedIds.length}
          onClear={() => setSelectedIds([])}
          onBulkDelete={() => setShowBulkOps(true)}
          label={t.messages.selected}
        />
      )}

      {/* Full Text Preview */}
      <FullTextPreview
        record={selected}
        recordType={selected ? "source" : null}
        sources={data.sources}
      />

      {/* Pagination */}
      {filtered.length > 0 && (
        <PaginationBar
          total={filtered.length}
          page={page}
          pageSize={pageSize}
          onPage={(p) => setPage(Math.min(p, totalPages))}
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

      {/* Add dialog */}
      <FormModal
        isOpen={showAdd}
        title={t.sections.sources.add}
        onClose={() => setShowAdd(false)}
        onSave={handleSave}
        saveLabel={t.actions.save}
        size="lg"
      >
        {renderForm()}
      </FormModal>

      {/* Edit dialog */}
      <FormModal
        isOpen={showEdit}
        title={t.sections.sources.edit}
        onClose={() => setShowEdit(false)}
        onSave={handleSave}
        saveLabel={t.actions.save}
        size="lg"
      >
        {renderForm()}
      </FormModal>

      {/* Confirm delete */}
      <ConfirmDialog
        isOpen={showDelete}
        title={t.actions.delete}
        message={t.messages.confirmDelete}
        onConfirm={handleDelete}
        onCancel={() => setShowDelete(false)}
        danger
      />

      {/* Export */}
      <ExportDialog
        isOpen={showExport}
        onClose={() => setShowExport(false)}
        data={filtered as unknown as Record<string, unknown>[]}
        columns={exportColumns}
        defaultFilename="sources"
      />

      {/* Advanced Search */}
      <AdvancedSearch
        isOpen={showAdvSearch}
        onClose={() => setShowAdvSearch(false)}
        fields={searchFields}
        data={data.sources as unknown as Record<string, unknown>[]}
        target="sources"
        onApply={(rows) => {
          setAdvancedIds(rows.map((r) => String(r.id)))
          setPage(1)
          onToast(
            t.messages.advancedApplied.replace("{n}", String(rows.length)),
          )
        }}
      />

      {/* Bulk Operations */}
      <BulkOperations
        isOpen={showBulkOps}
        onClose={() => setShowBulkOps(false)}
        selectedIds={selectedIds}
        entity="sources"
        data={data.sources.map((s) => ({ id: s.id, label: s.name }))}
        onToast={onToast}
        onBulkDelete={handleBulkDelete}
      />

      {/* Import Wizard */}
      <ImportWizard
        isOpen={showImport}
        onClose={() => setShowImport(false)}
        targetType="source"
        onToast={onToast}
      />

      {/* Statistics */}
      <InfoModal
        isOpen={showStats}
        title={`${t.dialogs.statistics.title} — ${t.sections.sources.title}`}
        onClose={() => setShowStats(false)}
        size="md"
        icon={<SigmaIcon size="sm" />}
      >
        <div className="flex flex-col gap-3 text-xs">
          <div className="grid grid-cols-2 gap-2">
            <StatCard
              label={t.dialogs.statistics.totalRecords}
              value={statsInfo.total}
            />
            <StatCard
              label={t.dialogs.statistics.avgImportance}
              value={`${statsInfo.avgImp}%`}
            />
          </div>
          <div>
            <div
              className="text-[10px] uppercase tracking-wide font-semibold mb-1"
              style={{ color: "var(--muted-fg)" }}
            >
              {t.dialogs.statistics.byCountry}
            </div>
            {statsInfo.byCountry.length === 0 && (
              <div className="text-xs" style={{ color: "var(--muted-fg)" }}>
                —
              </div>
            )}
            {statsInfo.byCountry.map((bc) => (
              <div key={bc.country} className="flex items-center gap-2 py-0.5">
                <span className="truncate" style={{ flex: "1 1 auto" }}>
                  {bc.country}
                </span>
                <div
                  className="h-2 rounded-full overflow-hidden"
                  style={{ width: 90, background: "var(--surface-3)" }}
                >
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${
                        statsInfo.total ? (bc.count / statsInfo.total) * 100 : 0
                      }%`,
                      background: "var(--primary)",
                    }}
                  />
                </div>
                <span
                  className="tnum"
                  style={{
                    fontFamily: "var(--font-mono)",
                    width: 34,
                    textAlign: "end",
                  }}
                >
                  {bc.count}
                </span>
              </div>
            ))}
          </div>
          <div>
            <div
              className="text-[10px] uppercase tracking-wide font-semibold mb-1"
              style={{ color: "var(--muted-fg)" }}
            >
              {t.dialogs.statistics.byType}
            </div>
            {statsInfo.byType.map((bt) => (
              <div key={bt.type} className="flex items-center gap-2 py-0.5">
                <span className="truncate" style={{ flex: "1 1 auto" }}>
                  {bt.type}
                </span>
                <div
                  className="h-2 rounded-full overflow-hidden"
                  style={{ width: 90, background: "var(--surface-3)" }}
                >
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${(bt.count / statsInfo.total) * 100}%`,
                      background: "var(--accent-violet)",
                    }}
                  />
                </div>
                <span
                  className="tnum"
                  style={{
                    fontFamily: "var(--font-mono)",
                    width: 34,
                    textAlign: "end",
                  }}
                >
                  {bt.count}
                </span>
              </div>
            ))}
          </div>
          <div className="text-[11px]" style={{ color: "var(--muted-fg)" }}>
            {t.dialogs.statistics.dateRange}: {statsInfo.dateRange.from ?? "—"}{" "}
            → {statsInfo.dateRange.to ?? "—"}
            <br />
            Field coverage:{" "}
            {statsInfo.filled
              .map((f) => `${f.field} ${f.filled}/${statsInfo.total}`)
              .join(" · ")}
          </div>
        </div>
      </InfoModal>
    </div>
  )
}