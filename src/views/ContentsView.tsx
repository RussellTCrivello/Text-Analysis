import React, { useEffect, useMemo, useRef, useState } from "react"
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
  MoreMenu,
  Badge,
  ColumnFilter,
  StatCard,
  PageHeader,
  WorkspaceToolbar,
  EmptyState,
} from "../components/ui"
import {
  Close,
  NavContents,
  Plus,
  Pencil,
  Trash,
  CopyIcon,
  EyeIcon,
  Attachment,
  ImportFile,
  ExportArrow,
  Print,
  Reset,
  SearchCodeIcon,
  SigmaIcon,
  LayersIcon,
  LinkIcon,
} from "../components/icons"
import { ExportDialog } from "../components/ExportDialog"
import { ImportWizard } from "../components/ImportWizard"
import { AdvancedSearch } from "../components/AdvancedSearch"
import { FilterBuilder } from "../components/FilterBuilder"
import { applyFilterGroups, type FilterGroup } from "../core/filterBuilder"
import { ComboField, usageMap } from "../components/ComboField"
import {
  AttachmentField,
  type AttachmentFieldHandle,
} from "../components/AttachmentField"
import { BulkOperations } from "../components/BulkOperations"
import { ContentPreviewDialog } from "../components/ContentPreviewDialog"
import { useAppData } from "../store/AppContext"
import { useSettings } from "../store/SettingsContext"
import { useTranslation } from "../i18n"
import type { Content } from "../types"
import {
  applyColumnFilters,
  applyDateFilter,
  freeTextSearch,
} from "../core/search"
import { computeEntityStats } from "../core/stats"
import { buildPrintDocument, printHtml } from "../core/print"
import type { Row } from "../core/repository"
import { formatBytes, formatDateTime, nowIso } from "../core/text"

function emptyContent(
  sourceId = "",
): Omit<Content, "id" | "date_creation" | "date_modified"> {
  return {
    sources_id: sourceId,
    title: "",
    content_data: "",
    attachments: "",
    note: "",
    importance: 0.7,
    date_content: nowIso(),
  }
}

export function ContentsView({
  onToast,
  onLinkToAnalysis,
  onQuickAddSource,
  autoOpenAdd = 0,
}: {
  onToast: (m: string) => void
  onLinkToAnalysis?: (contentId: string) => void
  onQuickAddSource?: () => void
  autoOpenAdd?: number
}) {
  const { t } = useTranslation()
  const { settings } = useSettings()
  const {
    data,
    addContent,
    updateContent,
    deleteContent,
    duplicateContent,
    bulkDeleteContents,
    validate,
    printConfig,
  } = useAppData()
  const [showStats, setShowStats] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [showAdvSearch, setShowAdvSearch] = useState(false)
  const [showFilterBuilder, setShowFilterBuilder] = useState(false)
  const [advancedIds, setAdvancedIds] = useState<string[] | null>(null)
  const attachRef = useRef<AttachmentFieldHandle>(null)

  const [search, setSearch] = useState("")
  const [srcFilter, setSrcFilter] = useState("")
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
  const [showPreview, setShowPreview] = useState(false)
  const [form, setForm] = useState(emptyContent())
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [importancePct, setImportancePct] = useState("70.00")

  const selected = data.contents.find((c) => c.id === selectedId) ?? null

  const [seenAddNonce, setSeenAddNonce] = useState(0)
  const sourceName = (id: string) =>
    data.sources.find((s) => s.id === id)?.name ?? id

  const searchFields = [
    "id",
    "title",
    "content_data",
    "note",
    "attachments",
    "sources_id",
    "importance",
    "date_content",
  ]

  const filtered = useMemo(() => {
    // Search & filter against DISPLAY values: a source name must match the
    // "Source" column, not the stored id.
    const typed: Row[] = (data.contents as unknown as Array<Record<string, unknown>>).map((c) => ({
      ...c,
      source_name: sourceName(String(c.sources_id ?? "")),
    }))
    const byText = freeTextSearch(typed, search, [...searchFields, "source_name"])
    const bySource = srcFilter
      ? byText.filter((c) => c.sources_id === srcFilter)
      : byText
    const byColumns = applyColumnFilters(bySource, colFilters, (row, key) => {
      if (key === "sources_id") return String(row.source_name ?? "")
      const raw = String(row[key] ?? "")
      return key === "date_content" && raw
        ? `${raw} ${formatDateTime(raw)}`
        : raw
    })
    const byAdvanced = advancedIds
      ? byColumns.filter((c) => advancedIds.includes(String(c.id)))
      : byColumns
    return applyDateFilter(byAdvanced, dateFrom || null, dateTo || null, [
      "date_content",
      "date_creation",
    ]) as unknown as Content[]
  }, [data.contents, data.sources, search, srcFilter, colFilters, dateFrom, dateTo, advancedIds])


  // Files and exports should read like the table: the Source column carries
  // the source's name, which the import pipeline resolves back to an id
  // (see repo.resolveRef), so export → edit → import round-trips by name.
  const namedRows = useMemo(
    () =>
      filtered.map((c) => ({
        ...c,
        sources_id: c.sources_id ? sourceName(c.sources_id) : "",
      })),
    [filtered, data.sources],
  )

  const contentStats = useMemo(
    () =>
      computeEntityStats(
        "contents",
        (srcFilter || search ? filtered : data.contents) as unknown as Row[],
      ),
    [filtered, data.contents, srcFilter, search],
  )

  const paged = filtered.slice((page - 1) * pageSize, page * pageSize)

  const openAdd = () => {
    setForm(emptyContent())
    setImportancePct("70.00")
    setErrors({})
    setShowAdd(true)
  }

  useEffect(() => {
    if (autoOpenAdd && autoOpenAdd !== seenAddNonce) {
      setSeenAddNonce(autoOpenAdd)
      openAdd()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoOpenAdd])
  const openEdit = () => {
    if (!selected) return
    setForm({ ...selected })
    setImportancePct((selected.importance * 100).toFixed(2))
    setErrors({})
    setShowEdit(true)
  }

  const validateForm = (f: typeof form): Record<string, string> => {
    const errs: Record<string, string> = {}
    const imp = parseFloat(importancePct)
    if (isNaN(imp) || imp < 0 || imp > 100)
      errs.importance = t.messages.importanceRange
    const issues = validate(
      "contents",
      { ...f, importance: imp / 100 } as unknown as Record<string, unknown>,
      showEdit ? (selectedId ?? undefined) : undefined,
    )
    for (const issue of issues)
      if (issue.level === "error") errs[issue.field] = issue.message
    for (const issue of issues) {
      if (issue.level === "warning" && !errs[issue.field])
        onToast(`${(t.fields as Record<string, string>)[issue.field] ?? issue.field}: ${issue.message}`)
    }
    return errs
  }

  const handleSave = async () => {
    const imp = parseFloat(importancePct) / 100
    const payload = { ...form, importance: imp }
    const errs = validateForm(payload)
    if (Object.keys(errs).length > 0) {
      setErrors(errs)
      return
    }
    let recordId = selectedId ?? ""
    if (showAdd) {
      const result = addContent(payload)
      recordId = String(result.record?.id ?? "")
    } else {
      updateContent({
        ...payload,
        id: selectedId!,
        date_creation: selected!.date_creation,
        date_modified: "",
      })
    }
    // Flush any files staged while the record was still new.
    const staged = attachRef.current?.staged ?? []
    if (recordId && staged.length) {
      const saved = await attachRef.current!.flush(recordId)
      const merged = [
        ...new Set([
          ...String(payload.attachments ?? "")
            .split(";")
            .map((v) => v.trim())
            .filter(Boolean),
          ...saved.map((m) => m.name),
        ]),
      ].join("; ")
      updateContent({ id: recordId, attachments: merged })
      onToast(`${saved.length} attachment(s) linked to “${payload.title}”`)
    }
    setShowAdd(false)
    setShowEdit(false)
    onToast(t.messages.saved)
  }

  const handleDelete = () => {
    if (!selectedId) return
    deleteContent(selectedId)
    setSelectedId(null)
    setShowDelete(false)
    onToast(t.messages.deleted)
  }

  const handleBulkDelete = (ids: string[]) => {
    bulkDeleteContents(ids)
    setSelectedIds([])
    setSelectedId(null)
    onToast(t.messages.bulkDeleted.replace("{n}", String(ids.length)))
  }

  const srcOpts = [
    { value: "", label: "— All sources —" },
    ...data.sources.map((s) => ({ value: s.id, label: s.name })),
  ]
  const srcFormOpts = data.sources.map((s) => ({
    value: s.id,
    // The picker searches this display string, so every useful source column
    // is available without exposing implementation IDs to the user.
    label: [s.name, s.type, s.country, s.city, s.ownership].filter(Boolean).join(" · "),
  }))
  const sourceUsage = useMemo(
    () => usageMap(data.contents as unknown as Record<string, unknown>[], "sources_id"),
    [data.contents],
  )

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
      rows: namedRows as unknown as Record<string, unknown>[],
      config: printConfig,
      title: `${t.sections.contents.title} — ${filtered.length} ${t.messages.records}`,
      subtitle: [
        search ? `search: ${search}` : "",
        srcFilter ? `source: ${sourceName(srcFilter)}` : "",
      ]
        .filter(Boolean)
        .join(" · "),
    })
    if (!printHtml(html)) onToast(t.messages.printUnavailable)
  }

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
  const colFilter = (key: string, label: string, options?: string[]) => (
    <ColumnFilter
      label={`${label} — ${t.actions.filter}`}
      value={colFilters[key] ?? ""}
      onChange={(v) => setColFilter(key, v)}
      options={options}
    />
  )

  const columns: Column<Content>[] = [
    {
      key: "title",
      header: t.fields.title,
      width: "26%",
      sortable: true,
      filter: colFilter("title", t.fields.title, contentTitles),
    },
    {
      key: "sources_id",
      header: t.fields.sources_id,
      width: "16%",
      sortable: true,
      render: (c) => (
        <span className="truncate" title={c.sources_id || undefined}>
          {sourceName(c.sources_id)}
        </span>
      ),
      filter: colFilter("sources_id", t.fields.sources_id, sourceNames),
    },
    {
      key: "content_data",
      header: t.fields.content_data,
      render: (c) => (
        <span
          className="text-xs truncate block"
          style={{ color: "var(--muted-fg)" }}
        >
          {c.content_data?.slice(0, 80)}
        </span>
      ),
      filter: colFilter("content_data", t.fields.content_data),
    },
    {
      key: "importance",
      header: t.fields.importance,
      width: "110px",
      sortable: true,
      render: (c) => <ImportanceBar value={c.importance} />,
      filter: colFilter("importance", t.fields.importance),
    },
    {
      key: "attachments",
      header: t.fields.attachments,
      width: "80px",
      render: (c) => {
        const count = c.attachments
          ? c.attachments
              .split(/[;,]/)
              .map((v) => v.trim())
              .filter(Boolean).length
          : 0
        return count ? (
          <button
            type="button"
            title={`${t.ops.attachments}: ${c.title}`}
            aria-label={`${t.ops.attachments} ${c.title}`}
            className="inline-flex cursor-pointer rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
            onClick={() =>
              window.dispatchEvent(
                new window.CustomEvent("tam:open-attachments", {
                  detail: { contentId: c.id },
                }),
              )
            }
          >
            <Badge>
              <Attachment size="xs" /> {count}
            </Badge>
          </button>
        ) : (
          <span aria-hidden="true">—</span>
        )
      },
      filter: colFilter("attachments", t.fields.attachments),
    },
    {
      key: "date_content",
      header: t.fields.date_content,
      width: "90px",
      sortable: true,
      render: (c) => (
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.8em" }}>
          {c.date_content ? formatDateTime(c.date_content) : "—"}
        </span>
      ),
      filter: colFilter("date_content", t.fields.date_content),
    },
  ]

  const exportColumns = [
    { key: "id", label: "ID" },
    { key: "title", label: t.fields.title },
    { key: "sources_id", label: t.fields.sources_id },
    { key: "content_data", label: t.fields.content_data },
    { key: "importance", label: t.fields.importance },
    { key: "date_content", label: t.fields.date_content },
  ]

  const moreItems = [
    {
      label: t.actions.preview,
      icon: <EyeIcon size="xs" />,
      onClick: () => {
        if (!selected) return
        setShowPreview(true)
      },
      disabled: !selected,
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
      label: t.actions.importContents,
      icon: <ImportFile size="xs" />,
      onClick: () => setShowImport(true),
    },
    {
      label: t.actions.bulkOperations,
      icon: <LayersIcon size="xs" />,
      onClick: () => setShowBulkOps(true),
      disabled: selectedIds.length === 0,
    },
    {
      label: t.actions.statistics,
      icon: <SigmaIcon size="xs" />,
      onClick: () => setShowStats(true),
    },
    { divider: true, label: "", onClick: () => {} },
    {
      label: t.actions.linkToAnalysis,
      icon: <LinkIcon size="xs" />,
      onClick: () => {
        if (selectedId) onLinkToAnalysis?.(selectedId)
      },
      disabled: !selectedId,
    },
  ]

  const renderForm = () => (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <Field label={t.fields.title} required error={errors.title}>
            <Input
              value={form.title}
              onChange={(e) =>
                setForm((f) => ({ ...f, title: e.target.value }))
              }
              error={!!errors.title}
            />
          </Field>
        </div>
        <Field label={t.fields.sources_id} required error={errors.sources_id}>
          <div className="flex items-start gap-2">
          <ComboField
            id="content-source"
            value={form.sources_id}
            onChange={(next) => setForm((f) => ({ ...f, sources_id: next }))}
            options={srcFormOpts}
            usage={sourceUsage}
            allowCreate={false}
            placeholder="Search source by name, type or country…"
            error={!!errors.sources_id}
          />
          {onQuickAddSource && (
            <Btn type="button" size="sm" variant="ghost" onClick={onQuickAddSource} title="Add a new source without losing your place">
              <Plus size="xs" />
            </Btn>
          )}
          </div>
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
        <Field label={t.fields.date_content} required>
          <DateTimeInput
            value={form.date_content}
            onChange={(v) => setForm((f) => ({ ...f, date_content: v }))}
            hint="Publication date and time"
          />
        </Field>
      </div>
      <Field
        label={t.fields.attachments}
        hint={t.sections.attachments.syncHint}
      >
        <div className="flex flex-col gap-2">
          <div className="flex items-start gap-2">
            <Input
              value={form.attachments}
              onChange={(e) =>
                setForm((f) => ({ ...f, attachments: e.target.value }))
              }
              placeholder="file1.pdf; file2.docx"
              className="flex-1"
            />
            <Btn
              size="sm"
              icon={<Attachment size="xs" />}
              onClick={() => attachRef.current?.openPicker()}
            >
              {t.sections.attachments.attachFile}
            </Btn>
          </div>
          <AttachmentField
            ref={attachRef}
            recordId={showEdit ? (selectedId ?? undefined) : undefined}
            recordType="content"
            recordTitle={form.title}
            sourceId={form.sources_id}
            sourceName={sourceName(form.sources_id)}
            value={form.attachments}
            onChange={(next) => setForm((f) => ({ ...f, attachments: next }))}
            onToast={onToast}
            embedded
          />
        </div>
      </Field>
      <Field label={t.fields.content_data} required>
        <Textarea
          value={form.content_data}
          onChange={(e) =>
            setForm((f) => ({ ...f, content_data: e.target.value }))
          }
          rows={5}
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
        eyebrow={t.nav.contentsDesc}
        title={t.sections.contents.title}
        subtitle={t.sections.contents.subtitle}
        icon={<NavContents size="md" />}
        count={{ value: data.contents.length, label: t.messages.records }}
        actions={
          <Btn variant="primary" onClick={openAdd} icon={<Plus size="sm" />}>
            {t.sections.contents.add}
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
          value={srcFilter}
          onChange={(e) => {
            setSrcFilter(e.target.value)
            setPage(1)
          }}
          options={srcOpts}
          className="!w-36"
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
            !search && !srcFilter && !dateFrom && !dateTo && !advancedIds && Object.keys(colFilters).length === 0
          }
          onClick={() => {
            setSearch("")
            setSrcFilter("")
            setColFilters({})
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
            if (selected) duplicateContent(selectedId!)
          }}
          disabled={!selected}
          icon={<CopyIcon size="xs" />}
        >
          {t.actions.duplicate}
        </Btn>
        <ToolbarSep />
        <Btn
          onClick={() => {
            if (selected) setShowPreview(true)
          }}
          disabled={!selected}
          icon={<EyeIcon size="xs" />}
        >
          {t.actions.preview}
        </Btn>
        <Btn
          onClick={() => {
            if (!selectedId) return
            window.dispatchEvent(
              new window.CustomEvent("tam:open-attachments", {
                detail: { contentId: selectedId },
              }),
            )
          }}
          disabled={!selectedId}
          icon={<Attachment size="xs" />}
        >
          {t.ops.attachments}
        </Btn>
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

      <ResultsStrip
        total={data.contents.length}
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
              advancedIds || search || srcFilter || dateFrom || dateTo
                ? "noResults"
                : "empty"
            }
            title={
              advancedIds || search || srcFilter || dateFrom || dateTo
                ? t.messages.noFilterMatches
                : t.sections.contents.noData
            }
            action={
              search ||
              srcFilter ||
              dateFrom ||
              dateTo ||
              advancedIds ||
              Object.keys(colFilters).length > 0 ? (
                <Btn
                  size="xs"
                  variant="ghost"
                  onClick={() => {
                    setSearch("")
                    setSrcFilter("")
                    setColFilters({})
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
                  {t.sections.contents.add}
                </Btn>
              )
            }
          />
        ) : (
          <DataTable
            columns={columns}
            entity="contents"
            data={paged}
            selectedId={selectedId ?? undefined}
            selectedIds={selectedIds}
            onSelect={(r) => setSelectedId(r?.id ?? null)}
            onSelectionChange={(ids) => {
              setSelectedIds(ids)
              if (ids.length === 1) setSelectedId(ids[0])
            }}
            onDoubleClick={() => openEdit()}
            emptyText={t.sections.contents.noData}
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
        recordType={selected ? "content" : null}
        sources={data.sources}
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
        title={t.sections.contents.add}
        onClose={() => setShowAdd(false)}
        onSave={handleSave}
        saveLabel={t.actions.save}
        size="lg"
      >
        {renderForm()}
      </FormModal>
      <FormModal
        isOpen={showEdit}
        title={t.sections.contents.edit}
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
        data={namedRows as unknown as Record<string, unknown>[]}
        columns={exportColumns}
        defaultFilename="contents"
      />
      <BulkOperations
        isOpen={showBulkOps}
        onClose={() => setShowBulkOps(false)}
        selectedIds={selectedIds}
        entity="contents"
        data={data.contents.map((c) => ({ id: c.id, label: c.title }))}
        onToast={onToast}
        onBulkDelete={handleBulkDelete}
      />
      <ImportWizard
        isOpen={showImport}
        onClose={() => setShowImport(false)}
        targetType="content"
        onToast={onToast}
      />
      {showFilterBuilder && (
        <InfoModal isOpen title="Content filter builder" onClose={() => setShowFilterBuilder(false)} size="lg">
          <FilterBuilder entity="contents" onApply={(groups: FilterGroup[]) => {
            const rows = applyFilterGroups(data.contents as unknown as Record<string, unknown>[], groups)
            setAdvancedIds(rows.map((row) => String(row.id)))
            setPage(1)
            setShowFilterBuilder(false)
            onToast(`Applied filter builder: ${rows.length} records`)
          }} onClear={() => { setAdvancedIds(null); setShowFilterBuilder(false) }} />
        </InfoModal>
      )}
      <AdvancedSearch
        isOpen={showAdvSearch}
        onClose={() => setShowAdvSearch(false)}
        fields={[
          { value: "title", label: t.fields.title },
          { value: "sources_id", label: t.fields.sources_id },
          { value: "attachments", label: t.fields.attachments },
          { value: "importance", label: t.fields.importance },
          { value: "note", label: t.fields.note },
          { value: "date_content", label: t.fields.date_content },
        ]}
        data={data.contents as unknown as Record<string, unknown>[]}
        target="contents"
        onApply={(rows) => {
          setAdvancedIds(rows.map((r) => String(r.id)))
          setPage(1)
          onToast(
            t.messages.advancedApplied.replace("{n}", String(rows.length)),
          )
        }}
      />
      <ContentPreviewDialog
        isOpen={showPreview}
        onClose={() => setShowPreview(false)}
        content={selected}
        onEdit={() => { setShowPreview(false); openEdit() }}
        onAttach={() => {
          if (selectedId) {
            window.dispatchEvent(new window.CustomEvent("tam:open-attachments", { detail: { contentId: selectedId } }))
          }
        }}
        source={
          selected
            ? data.sources.find((s) => s.id === selected.sources_id)
            : null
        }
      />
      <InfoModal
        isOpen={showStats}
        title={t.actions.statistics}
        onClose={() => setShowStats(false)}
        size="md"
      >
        <div className="flex flex-col gap-3 text-xs">
          <div className="grid grid-cols-2 gap-2">
            <StatCard
              label={t.dialogs.statistics.totalRecords}
              value={String(contentStats.total)}
            />
            <StatCard
              label={t.dialogs.statistics.avgImportance}
              value={`${(contentStats.avgImportance * 100).toFixed(1)}%`}
            />
          </div>
          <div>
            <div
              className="text-[10px] uppercase tracking-wide font-semibold mb-1"
              style={{ color: "var(--muted-fg)" }}
            >
              By source
            </div>
            {(
              contentStats.fields.find((f) => f.field === "sources_id")?.top ??
              []
            )
              .slice(0, 10)
              .map((b) => (
                <div key={b.key} className="flex items-center gap-2 py-0.5">
                  <span className="truncate" style={{ flex: "1 1 auto" }}>
                    {sourceName(b.key) || b.label}
                  </span>
                  <div
                    className="h-2 rounded-full overflow-hidden"
                    style={{ width: 80, background: "var(--border)" }}
                  >
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${(b.share * 100).toFixed(1)}%`,
                        background: "#1d4ed8",
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
          </div>
          <div>
            <div
              className="text-[10px] uppercase tracking-wide font-semibold mb-1"
              style={{ color: "var(--muted-fg)" }}
            >
              Importance bands
            </div>
            {contentStats.importanceBands.map((b) => (
              <div key={b.label} className="flex items-center gap-2 py-0.5">
                <span style={{ flex: "1 1 auto" }}>{b.label}</span>
                <span style={{ fontFamily: "var(--font-mono)" }}>
                  {b.count}
                </span>
              </div>
            ))}
          </div>
          <div style={{ color: "var(--muted-fg)" }}>
            {t.dialogs.statistics.dateRange}:{" "}
            {contentStats.dateRange.from ?? "—"} →{" "}
            {contentStats.dateRange.to ?? "—"}
          </div>
          <div style={{ color: "var(--muted-fg)" }}>
            Field coverage:{" "}
            {contentStats.fields
              .map((f) => `${f.field} ${f.filled}/${contentStats.total}`)
              .join(" · ")}
          </div>
          <div className="flex justify-end">
            <Btn onClick={() => setShowStats(false)}>{t.actions.close}</Btn>
          </div>
        </div>
      </InfoModal>
    </div>
  )
}