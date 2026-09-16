/**
 * Advanced Search — a professional query workspace (fully redesigned) on top
 * of the same core engine, preserving every existing capability:
 *
 *   • 16 operators (contains / equals / comparisons / ranges / lists / empty
 *     checks / regex — wildcards via `.*`, phrases via quoted value)
 *   • AND / OR logic across conditions, live SQL translation
 *   • saved searches (scoped per entity, usage-tracked) and history ranking
 *   • results applied back into the calling workspace view
 *   • "Open in Reports" hand-off of the generated SQL
 *
 * The redesign adds: quick-filter chips, per-condition validation (regex
 * compile check, required values), an always-visible query preview, result
 * counts, and real empty/error/busy states.
 */
import React, { useEffect, useMemo, useState } from "react"
import { Modal, Btn, Input, Callout, EmptyState, Segmented } from "./ui"
import { DataTable, type Column } from "./DataTable"
import {
  AsteriskIcon,
  Bookmark,
  Checks,
  Close,
  EqualsIcon,
  ErrorIcon,
  FilterIcon,
  LinkIcon,
  ListIcon,
  Plus,
  Quotes,
  Reset,
  SearchCodeIcon,
  Search as SearchIcon,
  SigmaIcon,
  Spinner,
  TableIcon,
  Trash,
  CopyIcon,
  Check,
} from "./icons"
import { useTranslation } from "../i18n"
import { useAppData } from "../store/AppContext"
import {
  conditionsToSql,
  runAdvancedSearch,
  SEARCH_OPERATORS,
  type SavedSearch,
  type SearchCondition,
  type SearchOperator,
} from "../core/search"
import { id, timestamp } from "../core/text"

interface AdvancedSearchProps {
  isOpen: boolean
  onClose: () => void
  fields: { value: string; label: string }[]
  data: Record<string, unknown>[]
  onApply: (results: Record<string, unknown>[]) => void
  /** Entity these conditions belong to, used to scope saved searches. */
  target?: string
  /** Called with the generated SQL so a view can hand it to Reports. */
  onSendToReports?: (sql: string) => void
  onToast?: (message: string) => void
}

const NO_VALUE = new Set<SearchOperator>(["is_empty", "is_not_empty"])

function newCondition(
  fields: { value: string; label: string }[],
): SearchCondition {
  return {
    id: id("cond"),
    field: fields[0]?.value ?? "",
    operator: "contains",
    value: "",
  }
}

export function AdvancedSearch({
  isOpen,
  onClose,
  fields,
  data,
  onApply,
  target = "all",
  onSendToReports,
  onToast,
}: AdvancedSearchProps) {
  const { t } = useTranslation()
  const as = t.dialogs.advancedSearch
  const { searches } = useAppData()

  const [conditions, setConditions] = useState<SearchCondition[]>(() => [
    newCondition(fields),
  ])
  const [logic, setLogic] = useState<"AND" | "OR">("AND")
  const [results, setResults] = useState<Record<string, unknown>[] | null>(null)
  const [running, setRunning] = useState(false)
  const [tab, setTab] = useState<"builder" | "saved">("builder")
  const [saveName, setSaveName] = useState("")
  const [saved, setSaved] = useState<SavedSearch[]>([])
  const [copied, setCopied] = useState(false)
  const [lastRun, setLastRun] = useState<string>("")

  useEffect(() => {
    if (isOpen) {
      setSaved(searches.list(target))
      setResults(null)
      setConditions([newCondition(fields)])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, target])

  const ops = as.operators as Record<string, string>
  const operatorOpts = SEARCH_OPERATORS.map((op) => ({
    value: op.value,
    label: ops[op.value] ?? op.label,
  }))

  const addCondition = (over?: Partial<SearchCondition>) =>
    setConditions((c) => [...c, { ...newCondition(fields), ...over }])

  const removeCondition = (idToRemove: string) =>
    setConditions((c) =>
      c.length === 1 ? c : c.filter((x) => x.id !== idToRemove),
    )
  const clearConditions = () => {
    setConditions([newCondition(fields)])
    setResults(null)
  }

  const updateCondition = (
    conditionId: string,
    key: keyof SearchCondition,
    val: string,
  ) => {
    setConditions((c) =>
      c.map((x) => (x.id === conditionId ? { ...x, [key]: val } : x)),
    )
  }

  /* ----------------------------- validation ------------------------------ */
  const conditionErrors = useMemo(() => {
    const errs = new Map<string, string>()
    for (const cond of conditions) {
      if (!cond.field) {
        errs.set(cond.id, t.messages.required)
        continue
      }
      if (NO_VALUE.has(cond.operator as SearchOperator)) continue
      if (!cond.value.trim()) {
        errs.set(
          cond.id,
          as.valueRequired.replace("{op}", ops[cond.operator] ?? cond.operator),
        )
        continue
      }
      if (cond.operator === "between" && cond.value.split(",").length < 2)
        errs.set(cond.id, as.betweenHint)
      if (cond.operator === "regex") {
        try {
          void new RegExp(cond.value)
        } catch {
          errs.set(cond.id, t.messages.invalidRegex)
        }
      }
    }
    return errs
  }, [conditions, as, ops, t.messages.required, t.messages.invalidRegex])

  const activeConditions = conditions.filter(
    (c) =>
      c.field &&
      c.operator &&
      (!NO_VALUE.has(c.operator as SearchOperator) || true),
  )
  const invalid = conditionErrors.size > 0

  const whereClause = conditionsToSql(activeConditions, logic)
  const statement = `SELECT * FROM ${target === "all" ? "sources" : target}${
    whereClause ? ` WHERE ${whereClause}` : ""
  }`

  const runSearch = () => {
    if (invalid) return
    setRunning(true)
    window.setTimeout(() => {
      try {
        const filtered = runAdvancedSearch(
          data,
          conditions.filter((c) => c.field),
          logic,
        )
        setResults(filtered)
        setLastRun(timestamp().slice(11, 19))
        const name = saveName.trim()
        if (name) {
          const match = saved.find((s) => s.name === name)
          if (match) searches.touch(match.id)
          setSaved(searches.list(target))
        }
      } finally {
        setRunning(false)
      }
    }, 16)
  }

  const applyResults = () => {
    if (!results) return
    onApply(results)
    if (onToast)
      onToast(t.messages.advancedApplied.replace("{n}", String(results.length)))
    onClose()
  }

  const saveSearch = () => {
    const name = saveName.trim()
    if (!name) return
    searches.save({ id: id("ss"), name, entity: target, conditions, logic })
    setSaved(searches.list(target))
    setSaveName("")
  }

  const loadSearch = (ss: SavedSearch) => {
    setConditions(ss.conditions.length ? ss.conditions : [newCondition(fields)])
    setLogic(ss.logic as "AND" | "OR")
    setSaveName(ss.name)
    setTab("builder")
    searches.touch(ss.id)
    setSaved(searches.list(target))
  }

  const deleteSearch = (ssId: string) => {
    searches.remove(ssId)
    setSaved(searches.list(target))
  }

  const copySql = async () => {
    try {
      await navigator.clipboard.writeText(statement)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1400)
    } catch {
      if (onToast) onToast(as.queryPreview)
    }
  }

  const resultColumns: Column<Record<string, unknown>>[] = fields
    .slice(0, 4)
    .map((f) => ({
      key: f.value,
      header: f.label,
      sortable: true,
      render: (row) => (
        <span className="truncate">{String(row[f.value] ?? "—")}</span>
      ),
    }))

  /* ------------------------------ quick chips ----------------------------- */
  const chips: {
    label: string
    icon: React.ReactNode
    make: () => Partial<SearchCondition>
  }[] = [
    {
      label: as.chipPhrase,
      icon: <Quotes size="xs" />,
      make: () => ({ operator: "contains", value: "" }),
    },
    {
      label: as.chipExclude,
      icon: <Close size="xs" />,
      make: () => ({ operator: "not_contains", value: "" }),
    },
    {
      label: as.chipWildcard,
      icon: <AsteriskIcon size="xs" />,
      make: () => ({ operator: "regex", value: ".*" }),
    },
    {
      label: as.chipEmpty,
      icon: <EqualsIcon size="xs" />,
      make: () => ({ operator: "is_empty", value: "" }),
    },
    {
      label: as.chipRange,
      icon: <SigmaIcon size="xs" />,
      make: () => ({ operator: "between", value: "" }),
    },
  ]

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="xl"
      icon={<SearchCodeIcon size="sm" />}
      title={as.title}
      subtitle={`${data.length} ${t.messages.records} · ${as.conditionCount.replace("{n}", String(activeConditions.filter((c) => c.field).length))}`}
      headerExtra={
        <Segmented
          ariaLabel={as.title}
          size="xs"
          options={[
            { value: "builder", label: as.conditions },
            { value: "saved", label: `${as.savedSearches} (${saved.length})` },
          ]}
          value={tab}
          onChange={(v) => setTab(v as "builder" | "saved")}
        />
      }
      footer={
        <>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Input
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              placeholder={as.searchName}
              className="!w-52 hidden md:block"
              aria-label={as.saveSearch}
            />
            <Btn
              size="xs"
              onClick={saveSearch}
              disabled={!saveName.trim()}
              icon={<Bookmark size="xs" />}
              title={as.saveHere}
            >
              {as.saveSearch}
            </Btn>
            {onSendToReports && (
              <Btn
                size="xs"
                variant="ghost"
                onClick={() => {
                  onSendToReports(statement)
                  onClose()
                }}
                icon={<LinkIcon size="xs" />}
              >
                {as.sendToReports}
              </Btn>
            )}
          </div>
          <Btn
            variant="ghost"
            onClick={clearConditions}
            icon={<Reset size="sm" />}
          >
            {as.resetSearch}
          </Btn>
          <Btn
            variant="primary"
            onClick={runSearch}
            disabled={invalid || running}
            loading={running}
            icon={running ? undefined : <SearchIcon size="sm" />}
          >
            {running ? as.results : as.execute}
          </Btn>
        </>
      }
    >
      <div className="flex flex-col gap-3 min-h-[430px]">
        {/* Logic + quick filters */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-2">
            <span
              className="text-[11px] font-bold uppercase tracking-[0.08em]"
              style={{
                color: "var(--muted-fg)",
                fontFamily: "var(--font-display)",
              }}
            >
              {as.logic}
            </span>
            <Segmented
              ariaLabel={as.logic}
              options={[
                { value: "AND", label: as.and },
                { value: "OR", label: as.or },
              ]}
              value={logic}
              onChange={(v) => setLogic(v as "AND" | "OR")}
              size="xs"
            />
          </div>
          <div
            className="w-px h-5 self-center"
            style={{ background: "var(--border)" }}
            aria-hidden="true"
          />
          <span
            className="text-[11px] font-bold uppercase tracking-[0.08em] inline-flex items-center gap-1"
            style={{
              color: "var(--muted-fg)",
              fontFamily: "var(--font-display)",
            }}
          >
            <FilterIcon size="xs" /> {as.quickHeading}
          </span>
          <div className="flex flex-wrap gap-1">
            {chips.map((chip) => (
              <button
                key={chip.label}
                onClick={() => {
                  addCondition(chip.make())
                  setTab("builder")
                }}
                className="inline-flex items-center gap-1.5 px-2 py-1 text-[11px] font-medium rounded-[var(--radius-sm)] transition-all hover:bg-[var(--surface-3)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
                style={{
                  border: "1px solid var(--border-strong)",
                  background: "var(--surface-2)",
                  color: "var(--fg-soft)",
                }}
              >
                {chip.icon}
                {chip.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-3 flex-1 min-h-0">
          {/* Conditions / saved searches */}
          <div className="lg:w-[430px] shrink-0 flex flex-col gap-2 min-h-0">
            {tab === "builder" ? (
              <>
                <div
                  className="flex flex-col gap-1.5 overflow-y-auto pr-1 flex-1"
                  style={{ maxHeight: 320 }}
                >
                  {conditions.map((cond, i) => {
                    const condErr = conditionErrors.get(cond.id)
                    const opMeta = SEARCH_OPERATORS.find(
                      (o) => o.value === cond.operator,
                    )
                    return (
                      <div
                        key={cond.id}
                        className="rounded-[var(--radius)] p-2 flex flex-col gap-1.5 transition-colors"
                        style={{
                          background: "var(--surface-2)",
                          border: `1px solid ${
                            condErr ? "var(--error)40" : "var(--border)"
                          }`,
                        }}
                      >
                        <div className="flex items-center gap-1.5">
                          <span
                            className="text-[10px] font-bold uppercase shrink-0 w-7 text-center rounded px-1 py-0.5"
                            style={{
                              background:
                                i === 0
                                  ? "var(--surface-3)"
                                  : logic === "AND"
                                    ? "var(--primary-soft)"
                                    : "var(--processing-soft)",
                              color:
                                i === 0 ? "var(--muted-fg)" : "var(--primary)",
                              fontFamily: "var(--font-mono)",
                            }}
                            aria-hidden="true"
                          >
                            {i === 0 ? "IF" : logic}
                          </span>
                          <select
                            value={cond.field}
                            onChange={(e) =>
                              updateCondition(cond.id, "field", e.target.value)
                            }
                            aria-label={`${as.field} ${i + 1}`}
                            className="flex-1 min-w-0 rounded-[var(--radius-sm)] border px-1.5 py-1 text-xs outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
                            style={{
                              background: "var(--surface)",
                              borderColor: "var(--border-strong)",
                              color: "var(--fg)",
                              fontFamily: "var(--font-body)",
                            }}
                          >
                            {fields.map((f) => (
                              <option key={f.value} value={f.value}>
                                {f.label}
                              </option>
                            ))}
                          </select>
                          <select
                            value={cond.operator}
                            onChange={(e) =>
                              updateCondition(
                                cond.id,
                                "operator",
                                e.target.value,
                              )
                            }
                            aria-label={`${as.operator} ${i + 1}`}
                            className="rounded-[var(--radius-sm)] border px-1.5 py-1 text-xs outline-none w-32 shrink-0"
                            style={{
                              background: "var(--surface)",
                              borderColor: "var(--border-strong)",
                              color: "var(--fg)",
                            }}
                          >
                            {operatorOpts.map((o) => (
                              <option key={o.value} value={o.value}>
                                {o.label}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={() => removeCondition(cond.id)}
                            disabled={conditions.length === 1}
                            aria-label={`${as.removeCondition} ${i + 1}`}
                            title={`${as.removeCondition} ${i + 1}`}
                            className="w-6 h-6 inline-flex items-center justify-center rounded-[var(--radius-sm)] transition-colors disabled:opacity-30 hover:enabled:bg-[var(--error-soft)] hover:enabled:text-[var(--error)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
                            style={{ color: "var(--muted-fg)" }}
                          >
                            <Trash size="xs" />
                          </button>
                        </div>
                        {opMeta?.needsValue && (
                          <input
                            value={cond.value}
                            onChange={(e) =>
                              updateCondition(cond.id, "value", e.target.value)
                            }
                            aria-label={`${as.value} ${i + 1}`}
                            placeholder={
                              cond.operator === "between"
                                ? as.betweenHint
                                : cond.operator === "regex"
                                  ? as.wildcardHint
                                  : cond.operator === "in_list" ||
                                      cond.operator === "not_in_list"
                                    ? "a, b, c"
                                    : `${as.value}…`
                            }
                            className="w-full rounded-[var(--radius-sm)] border px-2 py-1 text-xs outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
                            style={{
                              background: "var(--surface)",
                              borderColor: condErr
                                ? "var(--error)"
                                : "var(--border-strong)",
                              color: "var(--fg)",
                              fontFamily:
                                cond.operator === "regex"
                                  ? "var(--font-mono)"
                                  : "var(--font-body)",
                            }}
                          />
                        )}
                        {condErr && (
                          <p
                            className="text-[10.5px] font-medium inline-flex items-center gap-1"
                            style={{ color: "var(--error)" }}
                            role="alert"
                          >
                            <ErrorIcon size="xs" /> {condErr}
                          </p>
                        )}
                      </div>
                    )
                  })}
                </div>
                <Btn
                  size="xs"
                  onClick={() => addCondition()}
                  icon={<Plus size="xs" />}
                >
                  {as.addCondition}
                </Btn>

                {/* SQL preview */}
                <div
                  className="rounded-[var(--radius-lg)] overflow-hidden"
                  style={{ border: "1px solid var(--border)" }}
                >
                  <div
                    className="flex items-center gap-2 px-2.5 py-1"
                    style={{
                      background: "var(--surface-2)",
                      borderBottom: "1px solid var(--border)",
                    }}
                  >
                    <span
                      className="text-[10px] font-bold uppercase tracking-[0.08em]"
                      style={{
                        color: "var(--muted-fg)",
                        fontFamily: "var(--font-display)",
                      }}
                    >
                      {as.queryPreview}
                    </span>
                    <div className="flex-1" />
                    <button
                      onClick={() => void copySql()}
                      className="inline-flex items-center gap-1 text-[10px] font-semibold rounded-[var(--radius-sm)] px-1.5 py-0.5 transition-colors hover:bg-[var(--surface-3)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
                      style={{
                        color: copied ? "var(--success)" : "var(--primary)",
                      }}
                      aria-label={as.copyQuery}
                    >
                      {copied ? <Check size="xs" /> : <CopyIcon size="xs" />}{" "}
                      {as.copyQuery}
                    </button>
                  </div>
                  <pre
                    className="px-2.5 py-2 text-[10.5px] leading-relaxed whitespace-pre-wrap break-all m-0"
                    style={{
                      fontFamily: "var(--font-mono)",
                      color: "var(--fg-soft)",
                      background: "var(--surface-inset)",
                    }}
                  >
                    {statement}
                  </pre>
                </div>
                {copied && (
                  <p
                    className="text-[10px]"
                    style={{ color: "var(--success)" }}
                  >
                    {as.queryCopied}
                  </p>
                )}
              </>
            ) : (
              /* Saved searches tab */
              <div
                className="flex flex-col gap-1.5 overflow-y-auto pr-1"
                style={{ maxHeight: 380 }}
              >
                {saved.length === 0 ? (
                  <EmptyState
                    compact
                    variant="empty"
                    title={as.noSaved}
                    description={as.saveHere}
                    icon={<Bookmark size="xl" />}
                  />
                ) : (
                  saved.map((ss) => (
                    <div
                      key={ss.id}
                      className="flex items-center gap-2 text-start px-3 py-2 rounded-[var(--radius)] text-xs transition-colors hover:bg-[var(--surface-3)]"
                      style={{
                        background: "var(--surface-2)",
                        border: "1px solid var(--border)",
                      }}
                    >
                      <button
                        className="flex-1 text-start min-w-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] rounded"
                        onClick={() => loadSearch(ss)}
                        aria-label={`${as.loadSaved}: ${ss.name}`}
                      >
                        <div className="font-semibold truncate">{ss.name}</div>
                        <div
                          className="text-[11px] truncate"
                          style={{ color: "var(--muted-fg)" }}
                        >
                          {as.savedMeta
                            .replace("{n}", String(ss.conditions.length))
                            .replace("{logic}", ss.logic)
                            .replace("{uses}", String(ss.uses))}
                        </div>
                      </button>
                      <Btn
                        size="xs"
                        onClick={() => loadSearch(ss)}
                        icon={<Checks size="xs" />}
                      >
                        {as.loadSaved}
                      </Btn>
                      <button
                        onClick={() => deleteSearch(ss.id)}
                        aria-label={as.deleteSaved}
                        title={as.deleteSaved}
                        className="w-6 h-6 inline-flex items-center justify-center rounded-[var(--radius-sm)] transition-colors hover:bg-[var(--error-soft)] hover:text-[var(--error)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
                        style={{ color: "var(--muted-fg)" }}
                      >
                        <Trash size="xs" />
                      </button>
                    </div>
                  ))
                )}
                <p
                  className="text-[10px]"
                  style={{ color: "var(--muted-fg-2)" }}
                >
                  {as.overwriteHint}
                </p>
              </div>
            )}
          </div>

          {/* Results */}
          <div className="flex-1 flex flex-col gap-2 min-w-0 min-h-0">
            <div className="flex items-center gap-2">
              <span
                className="text-xs font-bold uppercase tracking-[0.08em] inline-flex items-center gap-1.5"
                style={{
                  color: "var(--fg-soft)",
                  fontFamily: "var(--font-display)",
                }}
              >
                <TableIcon size="sm" /> {as.results}
              </span>
              {results !== null && (
                <span
                  className="text-[11px] tnum"
                  style={{
                    color: "var(--muted-fg)",
                    fontFamily: "var(--font-mono)",
                  }}
                >
                  {as.matchProgress
                    .replace("{m}", String(results.length))
                    .replace("{t}", String(data.length))}
                  {lastRun ? ` · ${lastRun}` : ""}
                </span>
              )}
              <div className="flex-1" />
              {running && (
                <span
                  className="inline-flex items-center gap-1.5 text-[11px]"
                  style={{ color: "var(--primary)" }}
                >
                  <Spinner size="xs" className="animate-spin-slow" />{" "}
                  {as.execute}…
                </span>
              )}
              {results !== null && results.length > 0 && (
                <Btn
                  variant="primary"
                  size="xs"
                  onClick={applyResults}
                  icon={<ListIcon size="xs" />}
                >
                  {t.actions.apply}
                </Btn>
              )}
            </div>

            {results === null && activeConditions.length === 0 && (
              <Callout variant="info">{as.noConditions}</Callout>
            )}
            <div
              className="flex-1 rounded-[var(--radius-lg)] overflow-hidden min-h-[220px]"
              style={{ border: "1px solid var(--border)" }}
            >
              {results === null ? (
                <EmptyState
                  compact
                  title={
                    invalid && activeConditions.length
                      ? as.valueRequired.replace("{op}", "")
                      : as.runHint
                  }
                  icon={<SearchCodeIcon size="xl" />}
                />
              ) : results.length === 0 ? (
                <EmptyState
                  variant="noResults"
                  title={t.messages.noRecords}
                  description={t.messages.noFilterMatches}
                  action={
                    <Btn
                      size="xs"
                      variant="ghost"
                      onClick={clearConditions}
                      icon={<Reset size="xs" />}
                    >
                      {as.resetSearch}
                    </Btn>
                  }
                />
              ) : (
                <DataTable
                  columns={resultColumns}
                  data={results as Record<string, unknown> & { id: string }[]}
                  emptyText={t.messages.noRecords}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </Modal>
  )
}