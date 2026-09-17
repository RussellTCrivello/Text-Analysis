/**
 * Import Wizard — a true multi-step workflow (fully redesigned) built on the
 * same core pipeline:
 *
 *   1. Select file      parse (CSV/TSV/JSON/JSONL/XML/XLSX)
 *   2. Map columns      auto-map headers, adjust by hand
 *   3. Preview/validate schema rules, FK resolution, duplicate detection
 *   4. Import           transactional apply, audited
 *
 * The stepper communicates which steps are complete, which is current and
 * which remain; busy states reflect the actual async parse/validate/apply
 * work; and the result panel makes it unmistakable whether rows were already
 * written (and how many).
 */
import React, { useEffect, useMemo, useRef, useState } from "react"
import {
  Modal,
  Btn,
  Field,
  Select,
  Callout,
  EmptyState,
  ProgressBar,
  Checkbox,
} from "./ui"
import {
  Alert,
  Check,
  ChevronL,
  ChevronR,
  ColumnsIcon,
  ErrorIcon,
  FileDoc,
  FolderOpenIcon,
  ImportArrow,
  ImportFile,
  PlayIcon,
  Refresh,
  Reset,
  Spinner,
  Success,
  TableIcon,
  Verify,
  UploadIcon,
  Close,
} from "./icons"
import { useTranslation } from "../i18n"
import { useAppData } from "../store/AppContext"
import { importTargets, SCHEMA, type EntityName } from "../core/schema"
import {
  autoMap,
  describePlan,
  planImport,
  sniffDelimiter,
  type ColumnMapping,
  type ImportPlan,
} from "../core/import/pipeline"
import {
  detectFormat,
  parseDelimited,
  parseJson,
  parseJsonLines,
  parseXml,
  parseXlsxBytes,
  type ImportFileFormat,
  type ParsedTable,
} from "../core/import/parse"
import { formatBytes } from "../core/text"
import type { ValidationIssue } from "../core/validation"

interface ImportWizardProps {
  isOpen: boolean
  onClose: () => void
  targetType?: "source" | "content" | "analysis"
  onToast?: (message: string) => void
}

type Step = 1 | 2 | 3 | 4
type Busy = "" | "parse" | "plan" | "apply"

const TARGET_ENTITY: Record<"source" | "content" | "analysis", EntityName> = {
  source: "sources",
  content: "contents",
  analysis: "analyses",
}

const ACCEPT = ".csv,.tsv,.txt,.json,.jsonl,.ndjson,.xml,.xlsx"

export function ImportWizard({
  isOpen,
  onClose,
  targetType = "source",
  onToast,
}: ImportWizardProps) {
  const { t } = useTranslation()
  const iw = t.dialogs.importWizard
  const { repo, importRows } = useAppData()

  const [step, setStep] = useState<Step>(1)
  const [target, setTarget] = useState<"source" | "content" | "analysis">(
    targetType,
  )
  const [file, setFile] = useState<File | null>(null)
  const [format, setFormat] = useState<ImportFileFormat>("csv")
  const [mapping, setMapping] = useState<ColumnMapping[]>([])
  const [plan, setPlan] = useState<ImportPlan | null>(null)
  const [applyResult, setApplyResult] = useState<{
    inserted: number
    issues: ValidationIssue[]
  } | null>(null)
  const [error, setError] = useState<string>("")
  const [busy, setBusy] = useState<Busy>("")
  const [dragOver, setDragOver] = useState(false)
  const [skipOnError, setSkipOnError] = useState(true)
  const fileRef = useRef<HTMLInputElement>(null)

  const entity = TARGET_ENTITY[target]
  const fields = useMemo(() => importTargets(entity), [entity])
  const fieldOptions = useMemo(
    () =>
      fields.map((f) => ({
        value: f.key,
        label: `${f.labelKey}${f.required ? " *" : ""}`,
      })),
    [fields],
  )

  useEffect(() => {
    if (isOpen) {
      setStep(1)
      setTarget(targetType)
      resetAll(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, targetType])

  const resetAll = (clearFile = true) => {
    setParsedState(null)
    if (clearFile) {
      setFile(null)
      setPlan(null)
      setApplyResult(null)
      setError("")
      setBusy("")
      if (fileRef.current) fileRef.current.value = ""
    }
    setMapping([])
  }

  const [parsed, setParsedState] = useState<ParsedTable | null>(null)

  const close = () => {
    if (applyResult && onToast) onToast(iw.importedNote)
    resetAll()
    onClose()
  }

  const parse = async (chosen: File) => {
    setError("")
    setBusy("parse")
    try {
      // Yield one frame so the busy state paints around the real parse work.
      await new Promise((r) => window.setTimeout(r, 16))
      const detected = detectFormat(chosen.name, "")
      setFormat(detected)
      let table: ParsedTable
      if (detected === "xlsx") {
        const bytes = new Uint8Array(await chosen.arrayBuffer())
        table = await parseXlsxBytes(bytes)
      } else {
        const text = await chosen.text()
        if (detected === "json") table = parseJson(text)
        else if (detected === "jsonl") table = parseJsonLines(text)
        else if (detected === "xml") table = parseXml(text)
        else {
          const delim = sniffDelimiter(text)
          table = parseDelimited(text, delim)
        }
      }
      if (!table.headers.length) {
        setError(iw.noColumns)
        return
      }
      setParsedState(table)
      setMapping(autoMap(table.headers, table, entity))
      setStep(2)
    } catch (err) {
      setError(
        `${iw.fileError}: ${err instanceof Error ? err.message : String(err)}`,
      )
    } finally {
      setBusy("")
    }
  }

  const buildPlan = async () => {
    if (!parsed) return
    setBusy("plan")
    setError("")
    await new Promise((r) => window.setTimeout(r, 16))
    try {
      setPlan(
        planImport(parsed, mapping, entity, {
          existing: repo.list(entity),
          parents: {
            sources: repo.list("sources"),
            contents: repo.list("contents"),
            analyses: repo.list("analyses"),
          },
          resolveRef: (e, value) => repo.resolveRef(e, value),
        }),
      )
      setStep(3)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy("")
    }
  }

  const apply = async () => {
    if (!plan) return
    setBusy("apply")
    await new Promise((r) => window.setTimeout(r, 16))
    try {
      const rows = skipOnError ? plan.accepted : plan.accepted
      const result = importRows(entity, rows)
      setApplyResult(result)
      setStep(4)
      if (onToast)
        onToast(iw.importDone.replace("{n}", String(result.inserted)))
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy("")
    }
  }

  const reMap = (header: string, field: string | null) => {
    setMapping((prev) => {
      const next = prev.map((m) => {
        if (m.header !== header) return m
        return { ...m, field, confidence: field ? 1 : 0 }
      })
      // A field can only be mapped once: clear it from any other column.
      if (field) {
        return next.map((m) =>
          m.header !== header && m.field === field
            ? { ...m, field: null, confidence: 0 }
            : m,
        )
      }
      return next
    })
    setPlan(null)
  }

  const targetOpts = [
    {
      value: "source",
      label: `${t.nav.sources} — ${SCHEMA.sources.fields.length} ${t.actions.columns.toLowerCase()}`,
    },
    {
      value: "content",
      label: `${t.nav.contents} — ${SCHEMA.contents.fields.length} ${t.actions.columns.toLowerCase()}`,
    },
    {
      value: "analysis",
      label: `${t.nav.analysis} — ${SCHEMA.analyses.fields.length} ${t.actions.columns.toLowerCase()}`,
    },
  ]

  const stepDefs = [
    {
      title: iw.step1,
      description: iw.stepDesc1,
      icon: <UploadIcon size="xs" />,
    },
    {
      title: iw.step2,
      description: iw.stepDesc2,
      icon: <ColumnsIcon size="xs" />,
    },
    { title: iw.step3, description: iw.stepDesc3, icon: <Verify size="xs" /> },
    {
      title: iw.step4,
      description: iw.stepDesc4,
      icon: <ImportArrow size="xs" />,
    },
  ]
  // Deduped: two file columns never map to the same field now (autoMap/manual
  // both guard it), but keep the review table resilient either way.
  const planCols = [...new Set(plan?.mapped.map((m) => m.field) ?? [])]
  const canNext =
    step === 2
      ? mapping.some((m) => m.field)
      : step === 3
        ? !!plan && plan.accepted.length > 0
        : false

  /* --------------------------------- steps ---------------------------------- */

  const stepOne = (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label={iw.targetTable} hint={iw.schemaHint}>
          <Select
            value={target}
            onChange={(e) => {
              const next = e.target.value as "source" | "content" | "analysis"
              setTarget(next)
              if (parsed)
                setMapping(autoMap(parsed.headers, parsed, TARGET_ENTITY[next]))
              setPlan(null)
            }}
            options={targetOpts}
            className="w-full"
          />
        </Field>
        <Field label={iw.format} hint={iw.dropHint}>
          <div
            className="flex items-center gap-2 h-[34px] px-3 rounded-[var(--radius)] text-xs"
            style={{
              background: "var(--surface-2)",
              border: "1px solid var(--border)",
            }}
          >
            <FileDoc size="sm" />
            <span
              className="tnum uppercase"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              {file ? format : "—"}
            </span>
            {file && (
              <span className="ms-auto" style={{ color: "var(--muted-fg)" }}>
                {formatBytes(file.size)}
              </span>
            )}
          </div>
        </Field>
      </div>

      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragOver(false)
          const f = e.dataTransfer.files?.[0]
          if (f) {
            setFile(f)
            void parse(f)
          }
        }}
        className="rounded-[var(--radius-lg)] flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors"
        style={{
          border: `2px dashed ${
            dragOver ? "var(--primary)" : "var(--border-strong)"
          }`,
          background: dragOver ? "var(--primary-soft)" : "var(--surface-2)",
          padding: "28px 16px",
          color: "var(--muted-fg)",
        }}
      >
        {busy === "parse" ? (
          <>
            <Spinner size="xl" className="animate-spin-slow" />
            <span
              className="text-sm font-semibold"
              style={{ color: "var(--fg-soft)" }}
            >
              {iw.parsing}
            </span>
          </>
        ) : file ? (
          <>
            <span style={{ color: "var(--primary)" }}>
              <Success size="xl" />
            </span>
            <span
              className="text-sm font-semibold"
              style={{ color: "var(--fg)" }}
            >
              {file.name}
            </span>
            <span className="text-xs">
              {iw.fileReady} · {format.toUpperCase()} · {formatBytes(file.size)}
            </span>
          </>
        ) : (
          <>
            <span style={{ color: "var(--muted-fg-2)" }}>
              <FolderOpenIcon size="xl" />
            </span>
            <span
              className="text-sm font-semibold"
              style={{ color: "var(--fg-soft)" }}
            >
              {iw.dropTitle}
            </span>
            <span className="text-xs">{iw.dropHint}</span>
          </>
        )}
        {parsed && (
          <span
            className="text-[11px] tnum"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            {iw.rowsParsed
              .replace("{rows}", String(parsed.rows.length))
              .replace("{cols}", String(parsed.headers.length))}
            {parsed.problems.length
              ? ` · ${iw.parseNotes.replace("{n}", String(parsed.problems.length))}`
              : ""}
          </span>
        )}
      </button>
      <input
        ref={fileRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) {
            setFile(f)
            void parse(f)
          }
        }}
      />
      <p
        className="text-[11px] leading-relaxed"
        style={{ color: "var(--muted-fg)" }}
      >
        Required fields:{" "}
        {fields
          .filter((f) => f.required)
          .map((f) => f.labelKey)
          .join(", ") || "—"}
        . {iw.requiredFieldsHint}
      </p>
    </div>
  )

  const stepTwo = parsed && (
    <div className="flex flex-col gap-3">
      <div
        className="flex items-center gap-3 text-xs"
        style={{ color: "var(--muted-fg)" }}
      >
        <span
          className="inline-flex items-center gap-1.5 font-semibold"
          style={{ color: "var(--fg-soft)" }}
        >
          <ColumnsIcon size="sm" /> {iw.columnMapping}
        </span>
        <span className="flex-1" />
        <button
          className="inline-flex items-center gap-1 font-semibold"
          style={{ color: "var(--primary)" }}
          onClick={() => {
            setMapping(autoMap(parsed.headers, parsed, entity))
            setPlan(null)
          }}
        >
          <Refresh size="xs" /> {iw.reRunAutoMap}
        </button>
        <button
          className="inline-flex items-center gap-1"
          style={{ color: "var(--muted-fg)" }}
          onClick={() => {
            setMapping((m) =>
              m.map((x) => ({ ...x, field: null, confidence: 0 })),
            )
            setPlan(null)
          }}
        >
          <Reset size="xs" /> {iw.clearAllMap}
        </button>
      </div>
      <p className="text-[11px]" style={{ color: "var(--muted-fg)" }}>
        {iw.autoMapNote}
      </p>
      <div
        className="overflow-auto rounded-[var(--radius-lg)]"
        style={{ border: "1px solid var(--border)", maxHeight: 280 }}
      >
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
              {[
                iw.fileColumn,
                iw.sampleValue,
                iw.targetField,
                iw.confidence,
              ].map((h) => (
                <th
                  key={h}
                  className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-start border-b whitespace-nowrap"
                  style={{
                    borderColor: "var(--border)",
                    color: "var(--muted-fg)",
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {mapping.map((m) => (
              <tr key={m.header}>
                <td
                  className="px-2 py-1.5 text-xs border-b"
                  style={{
                    borderColor: "var(--border)",
                    fontFamily: "var(--font-mono)",
                  }}
                >
                  {m.header}
                </td>
                <td
                  className="px-2 py-1.5 text-xs border-b truncate"
                  style={{
                    borderColor: "var(--border)",
                    maxWidth: 160,
                    color: "var(--muted-fg)",
                  }}
                >
                  {m.sample || "—"}
                </td>
                <td
                  className="px-2 py-1.5 border-b"
                  style={{ borderColor: "var(--border)" }}
                >
                  <Select
                    value={m.field ?? ""}
                    onChange={(e) => reMap(m.header, e.target.value || null)}
                    options={[{ value: "", label: iw.ignore }, ...fieldOptions]}
                    className="w-full"
                  />
                </td>
                <td
                  className="px-2 py-1.5 text-xs border-b tnum"
                  style={{
                    borderColor: "var(--border)",
                    fontFamily: "var(--font-mono)",
                    color:
                      m.field && m.confidence >= 0.9
                        ? "var(--success)"
                        : "var(--muted-fg)",
                  }}
                >
                  {m.field ? `${Math.round(m.confidence * 100)}%` : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div
        className="flex items-center gap-2 text-[11px]"
        style={{ color: "var(--muted-fg)", fontFamily: "var(--font-mono)" }}
      >
        <TableIcon size="xs" />
        {parsed.rows.length} rows · {parsed.headers.length}{" "}
        {t.actions.columns.toLowerCase()}
        {mapping.filter((m) => !m.field).length > 0 &&
          ` · ${iw.ignoreCount.replace("{n}", String(mapping.filter((m) => !m.field).length))}`}
      </div>
    </div>
  )

  const stepThree = plan && (
    <div className="flex flex-col gap-3">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span style={{ color: "var(--primary)" }}>
            <Verify size="sm" />
          </span>
          <h3
            className="text-[11px] font-bold uppercase tracking-[0.08em]"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {iw.reviewHeading}
          </h3>
        </div>
        <p className="text-[11px]" style={{ color: "var(--muted-fg)" }}>
          {iw.reviewDesc}
        </p>
      </div>

      <div className="flex gap-2">
        {[
          {
            label: iw.validRows,
            value: plan.ok,
            color: "var(--success)",
            icon: <Check size="xs" />,
          },
          {
            label: iw.warningRows,
            value: plan.warnings,
            color: "var(--warning)",
            icon: <Alert size="xs" />,
          },
          {
            label: iw.errorRows,
            value: plan.errors,
            color: "var(--error)",
            icon: <ErrorIcon size="xs" />,
          },
          {
            label: iw.totalRows,
            value: plan.total,
            color: "var(--muted-fg)",
            icon: <TableIcon size="xs" />,
          },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-[var(--radius)] p-3 flex-1 flex flex-col gap-1"
            style={{
              background: "var(--surface-2)",
              border: "1px solid var(--border)",
            }}
          >
            <span
              className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wide font-semibold"
              style={{ color: "var(--muted-fg)" }}
            >
              <span style={{ color: s.color }}>{s.icon}</span>
              {s.label}
            </span>
            <span
              className="text-xl font-bold tnum"
              style={{ color: s.color, fontFamily: "var(--font-mono)" }}
            >
              {s.value}
            </span>
          </div>
        ))}
      </div>

      {plan.errors > 0 && (
        <Callout variant="warning">
          {iw.errorsSkipNote.replace("{n}", String(plan.errors))}
        </Callout>
      )}

      <div
        className="overflow-auto rounded-[var(--radius-lg)]"
        style={{ border: "1px solid var(--border)", maxHeight: 210 }}
      >
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
              {["Line", "Status", ...planCols.slice(0, 4), "Issues"].map(
                (h) => (
                  <th
                    key={h}
                    className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-start border-b whitespace-nowrap"
                    style={{
                      borderColor: "var(--border)",
                      color: "var(--muted-fg)",
                    }}
                  >
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {plan.rows.slice(0, 40).map((row) => (
              <tr key={row.row}>
                <td
                  className="px-2 py-1 text-xs border-b tnum"
                  style={{
                    borderColor: "var(--border)",
                    fontFamily: "var(--font-mono)",
                  }}
                >
                  {row.row}
                </td>
                <td
                  className="px-2 py-1 border-b"
                  style={{ borderColor: "var(--border)" }}
                >
                  <span
                    className="inline-flex items-center gap-1 px-1.5 py-px rounded-full text-[10px] font-bold uppercase"
                    style={{
                      background:
                        row.status === "error"
                          ? "var(--error-soft)"
                          : row.status === "warning"
                            ? "var(--warning-soft)"
                            : "var(--success-soft)",
                      color:
                        row.status === "error"
                          ? "var(--error)"
                          : row.status === "warning"
                            ? "var(--warning)"
                            : "var(--success)",
                    }}
                  >
                    {row.status === "error" ? (
                      <ErrorIcon size="xs" />
                    ) : row.status === "warning" ? (
                      <Alert size="xs" />
                    ) : (
                      <Check size="xs" />
                    )}
                    {row.status}
                  </span>
                </td>
                {planCols.slice(0, 4).map((field) => (
                  <td
                    key={field}
                    className="px-2 py-1 text-xs border-b truncate"
                    style={{ borderColor: "var(--border)", maxWidth: 120 }}
                  >
                    {String(row.values[field] ?? "—")}
                  </td>
                ))}
                <td
                  className="px-2 py-1 text-[11px] border-b"
                  style={{
                    borderColor: "var(--border)",
                    color:
                      row.status === "error"
                        ? "var(--error)"
                        : "var(--muted-fg)",
                  }}
                >
                  {row.issues
                    .map(
                      (i) =>
                        `${
                          (t.fields as Record<string, string>)[i.field] ??
                          i.field
                        }: ${i.message}`,
                    )
                    .join(" · ") || "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="text-[11px]" style={{ color: "var(--muted-fg)" }}>
        {describePlan(plan)}
        {plan.unmapped.length > 0 && (
          <span>
            {" "}
            · {iw.unmappedCols.replace("{cols}", plan.unmapped.join(", "))}
          </span>
        )}
      </div>

      <Checkbox
        checked={skipOnError}
        onChange={setSkipOnError}
        label={iw.errorsSkipNote.replace("{n}", String(plan.errors))}
        disabled={plan.errors === 0}
      />
    </div>
  )

  const stepFour = applyResult && (
    <div className="flex flex-col items-center justify-center gap-4 py-8 animate-[fadeIn_0.2s_ease-out]">
      <span
        className="w-14 h-14 rounded-full inline-flex items-center justify-center"
        style={{
          background: applyResult.inserted
            ? "var(--success-soft)"
            : "var(--warning-soft)",
          color: applyResult.inserted ? "var(--success)" : "var(--warning)",
        }}
      >
        {applyResult.inserted ? <Success size="xl" /> : <Alert size="xl" />}
      </span>
      <div className="text-center">
        <div
          className="text-base font-bold"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {applyResult.issues.length > 0
            ? iw.importPartialHeading
            : iw.importSuccessHeading}
        </div>
        <p className="text-xs mt-1" style={{ color: "var(--muted-fg)" }}>
          {applyResult.issues.length > 0
            ? iw.importPartialDesc
                .replace("{n}", String(applyResult.inserted))
                .replace("{m}", String(applyResult.issues.length))
            : iw.importSuccessDesc.replace("{n}", String(applyResult.inserted))}
        </p>
      </div>
      <div
        className="flex items-center gap-3 text-[11px] tnum"
        style={{ color: "var(--muted-fg)", fontFamily: "var(--font-mono)" }}
      >
        <span style={{ color: "var(--success)" }}>
          <Check size="xs" />
        </span>{" "}
        {applyResult.inserted} inserted
        {applyResult.issues.length > 0 && (
          <>
            <span style={{ color: "var(--error)" }}>
              <ErrorIcon size="xs" />
            </span>{" "}
            {applyResult.issues.length} issues
          </>
        )}
      </div>
      <p
        className="text-[11px] max-w-md text-center"
        style={{ color: "var(--muted-fg-2)" }}
      >
        Every imported row was validated against the schema and written in a
        single audited transaction.
      </p>
      <Btn variant="primary" onClick={close} icon={<Check size="sm" />}>
        {iw.viewImported}
      </Btn>
    </div>
  )

  return (
    <Modal
      isOpen={isOpen}
      onClose={close}
      size="lg"
      icon={<ImportFile size="sm" />}
      title={`${iw.title} — ${t.nav[target === "source" ? "sources" : target === "content" ? "contents" : "analysis"]}`}
      subtitle={iw.stepProgress
        .replace("{c}", String(step))
        .replace("{total}", "4")}
      footer={
        <>
          {step < 4 ? (
            <span
              className="text-[11px] hidden sm:inline"
              style={{
                color: applyResult ? "var(--warning)" : "var(--muted-fg-2)",
              }}
            >
              {applyResult ? iw.importedNote : iw.cancelNote}
            </span>
          ) : (
            <span />
          )}
          <div className="flex-1" />
          <Btn
            variant="ghost"
            onClick={() => setStep((s) => Math.max(1, s - 1) as Step)}
            disabled={step === 1 || step === 4 || !!busy}
            icon={<ChevronL size="sm" />}
          >
            {t.actions.back}
          </Btn>
          {step === 1 && (
            <Btn
              variant="primary"
              onClick={() => parsed && setStep(2)}
              disabled={!parsed || busy === "parse"}
              icon={<ChevronR size="sm" />}
            >
              {t.actions.next}
            </Btn>
          )}
          {step === 2 && (
            <Btn
              variant="primary"
              onClick={buildPlan}
              disabled={!canNext || !!busy}
              loading={busy === "plan"}
              icon={busy === "plan" ? undefined : <ChevronR size="sm" />}
            >
              {busy === "plan" ? iw.validating : t.actions.next}
            </Btn>
          )}
          {step === 3 && (
            <Btn
              variant="primary"
              onClick={apply}
              disabled={!canNext || !!busy}
              loading={busy === "apply"}
              icon={busy === "apply" ? undefined : <PlayIcon size="sm" />}
            >
              {busy === "apply" ? iw.applying : iw.step4}
            </Btn>
          )}
          {step === 4 && (
            <Btn variant="primary" onClick={close} icon={<Close size="sm" />}>
              {t.actions.close}
            </Btn>
          )}
        </>
      }
    >
      <div className="flex flex-col gap-4" style={{ minHeight: 340 }}>
        <ImportStepper
          steps={stepDefs}
          current={step}
          onBack={(i) => setStep(i as Step)}
          canGoBack={step > 1 && step < 4 && !applyResult}
        />

        {error && (
          <Callout variant="error" onClose={() => setError("")}>
            {error}
          </Callout>
        )}
        {busy && step !== 1 && (
          <div
            className="flex items-center gap-2 text-xs"
            style={{ color: "var(--primary)" }}
          >
            <Spinner size="sm" className="animate-spin-slow" />
            {busy === "plan" ? iw.validating : iw.applying}
            <div className="flex-1 max-w-56">
              <ProgressBar indeterminate label={iw.importProgress} />
            </div>
          </div>
        )}

        <div className="flex-1 min-h-0">
          {step === 1 && stepOne}
          {step === 2 && stepTwo}
          {step === 3 &&
            (busy === "plan" ? (
              <EmptyState compact variant="loading" title={iw.validating} />
            ) : (
              stepThree
            ))}
          {step === 4 && stepFour}
        </div>
      </div>
    </Modal>
  )
}

/** Local stepper wrapper: marks completed steps and allows going back. */
function ImportStepper({
  steps,
  current,
  onBack,
  canGoBack,
}: {
  steps: { title: string; description?: string; icon?: React.ReactNode }[]
  current: number
  onBack: (i: number) => void
  canGoBack: boolean
}) {
  return (
    <ol className="flex items-center gap-1 w-full" aria-label="Import progress">
      {steps.map((s, i) => {
        const done = i + 1 < current
        const active = i + 1 === current
        const clickable = canGoBack && done
        return (
          <li
            key={s.title}
            className="flex items-center gap-1 flex-1 min-w-0 last:flex-none"
          >
            <button
              type="button"
              disabled={!clickable}
              onClick={() => clickable && onBack(i + 1)}
              aria-current={active ? "step" : undefined}
              className={`flex items-center gap-2 min-w-0 rounded-[var(--radius)] px-1.5 py-1 text-start transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] ${
                clickable
                  ? "hover:bg-[var(--surface-3)] cursor-pointer"
                  : "cursor-default"
              }`}
              title={s.description ?? s.title}
            >
              <span
                className="w-[22px] h-[22px] rounded-full inline-flex items-center justify-center shrink-0"
                style={{
                  background: done
                    ? "var(--success)"
                    : active
                      ? "var(--primary)"
                      : "var(--surface-3)",
                  color:
                    done || active ? "var(--primary-fg)" : "var(--muted-fg)",
                  border: `1px solid ${
                    done
                      ? "var(--success)"
                      : active
                        ? "var(--primary)"
                        : "var(--border-strong)"
                  }`,
                  fontFamily: "var(--font-mono)",
                  fontSize: 10,
                  fontWeight: 700,
                }}
              >
                {done ? <Check size="xs" /> : active ? s.icon : i + 1}
              </span>
              <span className="hidden sm:block min-w-0">
                <span
                  className="block text-[11px] font-bold leading-tight truncate"
                  style={{
                    color: active
                      ? "var(--fg)"
                      : done
                        ? "var(--fg-soft)"
                        : "var(--muted-fg)",
                    fontFamily: "var(--font-display)",
                  }}
                >
                  {s.title}
                </span>
              </span>
            </button>
            {i < steps.length - 1 && (
              <span
                aria-hidden="true"
                className="flex-1 h-px min-w-2"
                style={{
                  background: done ? "var(--success)" : "var(--border-strong)",
                }}
              />
            )}
          </li>
        )
      })}
    </ol>
  )
}