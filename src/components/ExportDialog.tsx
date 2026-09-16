/**
 * Professional export workflow (fully redesigned):
 *
 *   Scope → Format → Columns → Options → Preview → Execute
 *
 * Every capability of the previous dialog is preserved (all 13 formats from
 * the core exporter, column selection, filename, headers/BOM toggles, print
 * header metadata for document formats) while adding what a production export
 * needs: an explicit scope summary, per-format icons, live validation, real
 * busy/success/failure states around the actual (synchronous) export job, and
 * a readable manifest of the produced file.
 */
import React, { useMemo, useState } from "react"
import {
  Modal,
  Btn,
  Input,
  Callout,
  Checkbox,
  ProgressBar,
  EmptyState,
  Divider,
} from "./ui"
import {
  FORMAT_ICONS,
  Check,
  ColumnsIcon,
  DownloadIcon,
  ErrorIcon,
  ExportArrow,
  ExportFile,
  LayersIcon,
  Checks,
  Refresh,
  SettingsIcon,
  Spinner,
  Success,
  TableIcon,
  EyeIcon,
  FileSheet,
} from "./icons"
import { useTranslation } from "../i18n"
import { useAppData } from "../store/AppContext"
import {
  downloadArtifact,
  exportData,
  FORMAT_META,
  type ExportArtifact,
  type ExportFormat,
} from "../core/export/exporters"
import { formatBytes } from "../core/text"
import { nextDocumentNumber } from "../core/print"

interface ExportDialogProps {
  isOpen: boolean
  onClose: () => void
  data: Record<string, unknown>[]
  columns: {
    key: string
    label: string
    format?: "percent" | "date" | "datetime" | "text"
  }[]
  defaultFilename?: string
  /** Human description of the current scope, e.g. "filtered view of Sources". */
  scopeLabel?: string
  onToast?: (message: string) => void
}

const FORMAT_GROUPS: {
  key: "spreadsheet" | "document" | "data"
  formats: ExportFormat[]
}[] = [
  { key: "spreadsheet", formats: ["xlsx", "xls", "csv", "tsv"] },
  { key: "document", formats: ["docx", "doc", "pdf", "html", "markdown"] },
  { key: "data", formats: ["json", "jsonl", "xml", "txt"] },
]

const GROUP_LABEL_KEY = {
  spreadsheet: "groupSpreadsheet",
  document: "groupDocument",
  data: "groupData",
} as const

const DOCUMENT_FORMATS: ExportFormat[] = [
  "docx",
  "doc",
  "pdf",
  "html",
  "markdown",
]

type Phase = "idle" | "building" | "done" | "failed"

export function ExportDialog({
  isOpen,
  onClose,
  data,
  columns,
  defaultFilename = "export",
  scopeLabel,
  onToast,
}: ExportDialogProps) {
  const { t } = useTranslation()
  const { printConfig } = useAppData()
  const ed = t.dialogs.exportDialog

  const [format, setFormat] = useState<ExportFormat>("xlsx")
  const [filename, setFilename] = useState(defaultFilename)
  const [selectedCols, setSelectedCols] = useState<Set<string>>(
    new Set(columns.map((c) => c.key)),
  )
  const [includeHeaders, setIncludeHeaders] = useState(true)
  const [includeId, setIncludeId] = useState(false)
  const [bom, setBom] = useState(true)
  const [phase, setPhase] = useState<Phase>("idle")
  const [result, setResult] = useState<ExportArtifact | null>(null)
  const [failure, setFailure] = useState("")
  const [warning, setWarning] = useState("")

  const activeCols = useMemo(
    () =>
      columns.filter(
        (c) => selectedCols.has(c.key) && (includeId || c.key !== "id"),
      ),
    [columns, selectedCols, includeId],
  )

  const filenameError = !filename.trim() || /[/\\]/.test(filename)
  const validation = filenameError
    ? ed.validationFilename
    : !columns.length
      ? ed.validationNoCols
      : !data.length
        ? ed.validationNoData
        : ""

  const previewRows = data.slice(0, 6)
  const isDocument = DOCUMENT_FORMATS.includes(format)

  const buildOptions = () => ({
    columns: activeCols.map((c) => ({
      key: c.key,
      label: c.label,
      format: c.format,
    })),
    format,
    filename,
    includeHeaders,
    bom,
    sheetName: ed.title,
    title: printConfig.reportTitle || ed.title,
    subtitle: printConfig.reportSubtitle,
    headerLines: [
      printConfig.header1,
      printConfig.header2,
      printConfig.header3,
    ].filter(Boolean),
    footerText: printConfig.footerText,
    docNumber: nextDocumentNumber(printConfig),
    pageSize: printConfig.pageSize,
    orientation: printConfig.orientation,
  })

  const estimated = useMemo(() => {
    if (!activeCols.length || !data.length) return null
    try {
      const artifact = exportData(data.slice(0, 25), buildOptions())
      const perRow = artifact.bytes / Math.min(25, data.length)
      return formatBytes(Math.max(artifact.bytes, perRow * data.length))
    } catch {
      return null
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }
  }, [
    data,
    activeCols,
    format,
    filename,
    includeHeaders,
    includeId,
    bom,
    printConfig,
  ])

  const toggleCol = (key: string) => {
    setSelectedCols((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const reset = () => {
    setPhase("idle")
    setResult(null)
    setFailure("")
    setWarning("")
  }

  const doExport = () => {
    if (validation) return
    setPhase("building")
    setResult(null)
    setFailure("")
    setWarning("")
    // The export itself is synchronous in the core; deferring one frame lets
    // the busy state paint first, so progress reflects the real work window.
    window.setTimeout(() => {
      try {
        const artifact = exportData(data, buildOptions())
        const ok = downloadArtifact(artifact)
        if (!ok) throw new Error("The browser blocked the download.")
        setResult(artifact)
        if (artifact.warnings.length) setWarning(artifact.warnings[0])
        setPhase("done")
        if (onToast)
          onToast(
            artifact.warnings.length
              ? `${t.messages.exportSuccess} — ${artifact.warnings[0]}`
              : t.messages.exportSuccess,
          )
      } catch (err) {
        setFailure(err instanceof Error ? err.message : String(err))
        setPhase("failed")
        if (onToast)
          onToast(
            `${ed.failedTitle}: ${
              err instanceof Error ? err.message : String(err)
            }`,
          )
      }
    }, 24)
  }

  const close = () => {
    reset()
    onClose()
  }

  const FormatIcon = FORMAT_ICONS[format] ?? FileSheet

  /* --------------------------------- views --------------------------------- */

  const configPanel = (
    <div className="flex flex-col gap-4">
      {/* Scope */}
      <section>
        <div className="flex items-center gap-2 mb-1.5">
          <span style={{ color: "var(--primary)" }}>
            <LayersIcon size="sm" />
          </span>
          <h3
            className="text-[11px] font-bold uppercase tracking-[0.08em]"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {ed.scopeHeading}
          </h3>
        </div>
        <div
          className="rounded-[var(--radius)] p-3 text-xs"
          style={{
            background: "var(--surface-2)",
            border: "1px solid var(--border)",
          }}
        >
          <div className="flex items-center gap-2">
            <span
              className="text-xl font-bold tnum"
              style={{ fontFamily: "var(--font-mono)", color: "var(--fg)" }}
            >
              {data.length}
            </span>
            <span style={{ color: "var(--muted-fg)" }}>
              {t.messages.records}
            </span>
            <span className="ms-auto">
              <ExportFile size="sm" />
            </span>
          </div>
          <p className="mt-1" style={{ color: "var(--muted-fg)" }}>
            {ed.scopeDesc
              .replace("{n}", String(data.length))
              .replace("{label}", scopeLabel ?? ed.scopeAll)}
          </p>
        </div>
      </section>

      {/* Format */}
      <section>
        <div className="flex items-center gap-2 mb-1.5">
          <span style={{ color: "var(--primary)" }}>
            <FileSheet size="sm" />
          </span>
          <h3
            className="text-[11px] font-bold uppercase tracking-[0.08em]"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {ed.formatHeading}
          </h3>
        </div>
        <div className="flex flex-col gap-2.5">
          {FORMAT_GROUPS.map((group) => (
            <div key={group.key} className="flex flex-col gap-1">
              <span
                className="text-[10px] font-bold uppercase tracking-[0.1em]"
                style={{ color: "var(--muted-fg-2)" }}
              >
                {ed[GROUP_LABEL_KEY[group.key]]}
              </span>
              <div
                className="grid grid-cols-2 gap-1"
                role="radiogroup"
                aria-label={ed.format}
              >
                {group.formats.map((f) => {
                  const Icon = FORMAT_ICONS[f] ?? FileSheet
                  const selected = format === f
                  return (
                    <button
                      key={f}
                      role="radio"
                      aria-checked={selected}
                      onClick={() => {
                        setFormat(f)
                        if (phase !== "idle") reset()
                      }}
                      className="flex items-center gap-2 px-2 py-1.5 rounded-[var(--radius-sm)] text-xs transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
                      style={{
                        background: selected
                          ? "var(--primary-soft)"
                          : "var(--surface)",
                        border: `1px solid ${
                          selected ? "var(--primary)" : "var(--border-strong)"
                        }`,
                        color: selected ? "var(--primary)" : "var(--fg-soft)",
                        fontWeight: selected ? 650 : 500,
                      }}
                    >
                      <Icon size="sm" />
                      <span className="truncate">
                        {FORMAT_META[f].label.replace(/\s*\(.*\)$/, "")}
                      </span>
                      {selected && (
                        <span className="ms-auto">
                          <Check size="xs" />
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </section>

      <Divider />

      {/* Filename + destination */}
      <section className="flex flex-col gap-2.5">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span style={{ color: "var(--primary)" }}>
              <ExportArrow size="sm" />
            </span>
            <h3
              className="text-[11px] font-bold uppercase tracking-[0.08em]"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {ed.filename}
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <Input
              value={filename}
              onChange={(e) => setFilename(e.target.value)}
              error={filenameError}
              aria-label={ed.filename}
              className="flex-1"
            />
            <span
              className="text-xs tnum px-2 py-1 rounded-[var(--radius-sm)]"
              style={{
                background: "var(--surface-2)",
                border: "1px solid var(--border-strong)",
                fontFamily: "var(--font-mono)",
                color: "var(--muted-fg)",
              }}
            >
              .{FORMAT_META[format].ext}
            </span>
          </div>
          <p
            className="mt-1 text-[11px] flex items-center gap-1.5"
            style={{
              color: filenameError ? "var(--error)" : "var(--muted-fg)",
            }}
          >
            <DownloadIcon size="xs" />
            {filenameError
              ? ed.validationFilename
              : `${ed.destinationBrowser} ${filename || "export"}.${FORMAT_META[format].ext}`}
          </p>
        </div>

        <Divider />

        {/* Options */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2 mb-0.5">
            <span style={{ color: "var(--primary)" }}>
              <SettingsIcon size="sm" />
            </span>
            <h3
              className="text-[11px] font-bold uppercase tracking-[0.08em]"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {ed.options}
            </h3>
          </div>
          <Checkbox
            checked={includeHeaders}
            onChange={setIncludeHeaders}
            label={ed.includeHeaders}
          />
          <Checkbox
            checked={includeId}
            onChange={setIncludeId}
            label={ed.includeId}
          />
          <Checkbox
            checked={bom}
            onChange={setBom}
            label={ed.includeBom}
            disabled={!["csv", "tsv", "txt"].includes(format)}
          />
          {isDocument && (
            <Callout variant="info" title={ed.metadataHeading}>
              {printConfig.header1
                ? `${ed.metadataDesc} (“${printConfig.header1}”) · ${ed.docNumberLabel} `
                : ed.metadataDescNoHeader}
              {printConfig.header1 && (
                <span
                  className="tnum"
                  style={{ fontFamily: "var(--font-mono)" }}
                >
                  {nextDocumentNumber(printConfig)}
                </span>
              )}
            </Callout>
          )}
        </div>
      </section>
    </div>
  )

  const columnsPanel = (
    <section className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <span style={{ color: "var(--primary)" }}>
          <ColumnsIcon size="sm" />
        </span>
        <h3
          className="text-[11px] font-bold uppercase tracking-[0.08em] flex-1"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {ed.columns}
        </h3>
        <button
          className="inline-flex items-center gap-1 text-[11px] font-semibold rounded-[var(--radius-sm)] px-1.5 py-0.5 transition-colors hover:bg-[var(--surface-3)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
          style={{ color: "var(--primary)" }}
          onClick={() =>
            setSelectedCols(
              selectedCols.size === columns.length
                ? new Set()
                : new Set(columns.map((c) => c.key)),
            )
          }
        >
          <Checks size="xs" />
          {selectedCols.size === columns.length
            ? ed.clearAllCols
            : ed.selectAllCols}
        </button>
      </div>
      <div
        className="flex flex-col gap-0.5 overflow-y-auto pr-1"
        style={{ maxHeight: 132 }}
      >
        {columns.map((col) => (
          <label
            key={col.key}
            className="flex items-center gap-2 text-xs px-1 py-1 rounded-[var(--radius-sm)] cursor-pointer hover:bg-[var(--surface-2)]"
          >
            <Checkbox
              checked={selectedCols.has(col.key)}
              onChange={() => toggleCol(col.key)}
            />
            <span className="truncate">{col.label}</span>
          </label>
        ))}
        {!columns.length && (
          <p className="text-[11px] py-2" style={{ color: "var(--muted-fg)" }}>
            {ed.validationNoCols}
          </p>
        )}
      </div>
      <p
        className="text-[10px]"
        style={{ color: "var(--muted-fg-2)", fontFamily: "var(--font-mono)" }}
      >
        {ed.columnsSelected
          .replace("{n}", String(activeCols.length))
          .replace("{m}", String(columns.length))}
        {estimated ? ` · ${ed.estimatedSize} ≈ ${estimated}` : ""}
        {estimated
          ? ""
          : ` · ${ed.rowCount.replace("{n}", String(data.length)).replace("{m}", String(activeCols.length))}`}
      </p>
    </section>
  )

  const previewPanel = (
    <div className="flex-1 flex flex-col gap-2 min-w-0">
      <div className="flex items-center gap-2">
        <span style={{ color: "var(--primary)" }}>
          <EyeIcon size="sm" />
        </span>
        <h3
          className="text-[11px] font-bold uppercase tracking-[0.08em]"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {ed.preview}
        </h3>
        <span
          className="text-[11px] tnum ms-auto"
          style={{ color: "var(--muted-fg)", fontFamily: "var(--font-mono)" }}
        >
          {data.length} {t.messages.records} · {activeCols.length}{" "}
          {t.actions.columns}
        </span>
      </div>
      <div
        className="flex-1 overflow-auto rounded-[var(--radius-lg)]"
        style={{
          border: "1px solid var(--border)",
          background: "var(--surface-inset)",
          minHeight: 180,
        }}
      >
        {previewRows.length === 0 ? (
          <EmptyState
            compact
            variant="noResults"
            title={t.messages.noRecords}
            description={ed.validationNoData}
          />
        ) : (
          <table className="w-full">
            <thead>
              <tr
                style={{
                  background: "var(--surface-2)",
                  position: "sticky",
                  top: 0,
                  zIndex: 1,
                }}
              >
                {activeCols.map((c) => (
                  <th
                    key={c.key}
                    className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-start border-b whitespace-nowrap"
                    style={{
                      borderColor: "var(--border)",
                      color: "var(--muted-fg)",
                    }}
                  >
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {previewRows.map((row, i) => (
                <tr
                  key={i}
                  style={{
                    background: i % 2 ? "var(--surface-2)" : "transparent",
                  }}
                >
                  {activeCols.map((c) => (
                    <td
                      key={c.key}
                      className="px-2 py-1 text-xs border-b truncate"
                      style={{ borderColor: "var(--border)", maxWidth: 150 }}
                    >
                      {String(row[c.key] ?? "—")}
                    </td>
                  ))}
                </tr>
              ))}
              {data.length > previewRows.length && (
                <tr>
                  <td
                    colSpan={Math.max(1, activeCols.length)}
                    className="px-2 py-1.5 text-center text-[10px]"
                    style={{ color: "var(--muted-fg-2)" }}
                  >
                    + {data.length - previewRows.length} {t.messages.records}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )

  return (
    <Modal
      isOpen={isOpen}
      onClose={close}
      size="lg"
      icon={<FormatIcon size="sm" />}
      title={
        <span className="inline-flex items-center gap-2">
          {ed.title}
          {phase === "done" && (
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide"
              style={{
                background: "var(--success-soft)",
                color: "var(--success)",
              }}
            >
              <Check size="xs" /> {ed.doneAction}
            </span>
          )}
        </span>
      }
      subtitle={`${FORMAT_META[format].label} · ${data.length} ${t.messages.records}`}
      footer={
        <>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {phase === "building" && (
              <div
                className="flex items-center gap-2 min-w-0"
                style={{ color: "var(--primary)" }}
              >
                <Spinner size="sm" className="animate-spin-slow" />
                <span className="text-xs truncate">
                  {ed.building.replace("{format}", FORMAT_META[format].label)}
                </span>
                <div className="w-24">
                  <ProgressBar indeterminate label={ed.preparing} />
                </div>
              </div>
            )}
            {phase !== "building" && validation && (
              <span
                className="text-[11px] inline-flex items-center gap-1"
                style={{ color: "var(--warning)" }}
              >
                <ErrorIcon size="xs" /> {validation}
              </span>
            )}
          </div>
          {phase === "idle" && (
            <Btn
              variant="primary"
              onClick={doExport}
              disabled={!!validation}
              icon={<ExportArrow size="sm" />}
            >
              {ed.exportBtn}
            </Btn>
          )}
          {phase !== "idle" && (
            <>
              <Btn variant="ghost" onClick={reset} icon={<Refresh size="sm" />}>
                {ed.newExport}
              </Btn>
              <Btn variant="primary" onClick={close} icon={<Check size="sm" />}>
                {ed.doneAction}
              </Btn>
            </>
          )}
        </>
      }
    >
      {phase === "done" && result ? (
        <div className="flex flex-col items-center justify-center gap-4 py-10 animate-[fadeIn_0.2s_ease-out]">
          <span
            className="w-14 h-14 rounded-full inline-flex items-center justify-center"
            style={{
              background: "var(--success-soft)",
              color: "var(--success)",
            }}
          >
            <Success size="xl" />
          </span>
          <div className="text-center">
            <div
              className="text-base font-bold"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {ed.successTitle}
            </div>
            <p className="text-xs mt-1" style={{ color: "var(--muted-fg)" }}>
              {ed.successDesc
                .replace("{file}", result.filename)
                .replace("{bytes}", formatBytes(result.bytes))
                .replace("{rows}", String(result.rows))}
            </p>
          </div>
          {warning && (
            <div className="w-full max-w-md">
              <Callout variant="warning" title={ed.warningsNote}>
                {warning}
              </Callout>
            </div>
          )}
          <div
            className="flex items-center gap-2 text-[11px] tnum"
            style={{ color: "var(--muted-fg)", fontFamily: "var(--font-mono)" }}
          >
            <TableIcon size="xs" /> {result.rows} × {activeCols.length} · .
            {FORMAT_META[format].ext}
          </div>
        </div>
      ) : phase === "failed" ? (
        <div className="flex flex-col items-center justify-center gap-4 py-10">
          <span
            className="w-14 h-14 rounded-full inline-flex items-center justify-center"
            style={{ background: "var(--error-soft)", color: "var(--error)" }}
          >
            <ErrorIcon size="xl" />
          </span>
          <div className="text-center">
            <div
              className="text-base font-bold"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {ed.failedTitle}
            </div>
            <p
              className="text-xs mt-1 max-w-md"
              style={{ color: "var(--muted-fg)" }}
            >
              {ed.failedDesc} {failure}
            </p>
          </div>
          <Btn
            variant="primary"
            onClick={doExport}
            icon={<Refresh size="sm" />}
          >
            {ed.retry}
          </Btn>
        </div>
      ) : (
        <div className="flex flex-col gap-4 lg:flex-row lg:min-h-[430px]">
          <div className="lg:w-[280px] shrink-0 flex flex-col gap-3">
            {configPanel}
            {columnsPanel}
          </div>
          <div className="flex-1 flex flex-col gap-3 min-w-0">
            {validation && phase === "idle" && (
              <Callout variant="warning">{validation}</Callout>
            )}
            {previewPanel}
          </div>
        </div>
      )}
    </Modal>
  )
}