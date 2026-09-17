import React, { useMemo, useRef, useState } from "react"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  CartesianGrid,
  Legend,
  AreaChart,
  Area,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  ScatterChart,
  Scatter,
} from "recharts"
import {
  Btn,
  Select,
  Input,
  InlineTabs,
  PageHeader,
  EmptyState,
  IconButton,
} from "../components/ui"
import {
  NavReports,
  Plus,
  Save,
  Print,
  DownloadIcon as Download,
  TableIcon,
  PlayIcon,
  Clipboard,
  Close,
  LayersIcon,
  Bookmark,
} from "../components/icons"
import { useAppData } from "../store/AppContext"
import { useTranslation } from "../i18n"
import type { SavedReport } from "../types"
import { generateId } from "../data/sampleData"
import {
  buildSql,
  queryTemplates,
  type SqlError,
  type TableInfo,
} from "../core/sql/engine"
import {
  downloadArtifact,
  exportData,
  type ExportFormat,
} from "../core/export/exporters"
import { buildPrintDocument, printHtml } from "../core/print"
import { sqlColumns } from "../core/schema"
import type { EntityName } from "../core/schema"

const COLORS = [
  "#0f766e",
  "#1d4ed8",
  "#c2410c",
  "#7c3aed",
  "#db2777",
  "#15803d",
  "#dc2626",
  "#0369a1",
  "#b45309",
  "#0e7490",
]

const SAVED_REPORTS_KEY = "tam.savedReports"

type ChartType = "bar" | "line" | "pie" | "area" | "radar" | "scatter"
type Aggregation = "count" | "sum" | "avg" | "min" | "max"
type ColorScheme = "teal" | "blue" | "red" | "mixed"

const SCHEME_COLORS: Record<ColorScheme, string[]> = {
  teal: ["#0d9488", "#0f766e", "#115e59", "#134e4a", "#99f6e4"],
  blue: ["#3b82f6", "#1d4ed8", "#1e40af", "#1e3a8a", "#bfdbfe"],
  red: ["#f87171", "#ef4444", "#dc2626", "#b91c1c", "#fecaca"],
  mixed: COLORS,
}

interface QueryResult {
  columns: string[]
  rows: Record<string, unknown>[]
  elapsedMs: number
  plan: string[]
  scanned: number
  grouped: boolean
  sql: string
}

const FIELDS = [
  "id",
  "name",
  "type",
  "importance",
  "country",
  "city",
  "description",
  "link_sources",
  "accounts",
  "note",
  "ownership",
  "date_entry",
  "date_creation",
  "date_modified",
  "title",
  "content_data",
  "sources_id",
  "attachments",
  "date_content",
  "content_id",
  "classification",
  "list_names_people",
  "list_names_places",
  "list_coordinates",
  "list_sides",
  "date_analysis",
]

const OPERATORS = [
  "=",
  "!=",
  ">",
  "<",
  ">=",
  "<=",
  "contains",
  "starts_with",
  "is_empty",
  "is_not_empty",
]

interface VisualFilter {
  field: string
  operator: string
  value: string
}

export function ReportsView({ onToast }: { onToast: (m: string) => void }) {
  const { t } = useTranslation()
  const { sql, printConfig } = useAppData()
  const r = t.sections.reports

  const [queryMode, setQueryMode] = useState<"sql" | "visual">("sql")
  const [sqlText, setSqlText] = useState(
    "SELECT * FROM sources ORDER BY importance DESC",
  )
  const [visTable, setVisTable] = useState("sources")
  const [visFields, setVisFields] = useState("*")
  const [visFilters, setVisFilters] = useState<VisualFilter[]>([])
  const [visOrderBy, setVisOrderBy] = useState("")
  const [visOrderDir, setVisOrderDir] = useState<"ASC" | "DESC">("ASC")
  const [visLimit, setVisLimit] = useState("100")
  const [queryResult, setQueryResult] = useState<QueryResult | null>(null)

  const [chartType, setChartType] = useState<ChartType>("bar")
  const [aggregation, setAggregation] = useState<Aggregation>("count")
  const [colorScheme, setColorScheme] = useState<ColorScheme>("mixed")
  const [labelField, setLabelField] = useState("")
  const [valueField, setValueField] = useState("")
  const [chartRowLimit, setChartRowLimit] = useState("20")
  const [chartData, setChartData] = useState<Record<string, unknown>[]>([])
  const [hasChart, setHasChart] = useState(false)

  const [reportTitle, setReportTitle] = useState("Untitled Report")
  const [includeChart, setIncludeChart] = useState(true)

  const [savedReports, setSavedReports] = useState<SavedReport[]>(() => {
    try {
      const raw = localStorage.getItem(SAVED_REPORTS_KEY)
      return raw ? JSON.parse(raw) as SavedReport[] : []
    } catch {
      return []
    }
  })
  const [saveName, setSaveName] = useState("")
  const [queryError, setQueryError] = useState<SqlError | null>(null)
  const [showPlan, setShowPlan] = useState(false)
  const [showSchema, setShowSchema] = useState(false)

  const printRef = useRef<HTMLDivElement>(null)

  // The visual builder emits real SQL through the shared query compiler.
  const generatedSQL = useMemo(
    () =>
      buildSql({
        table: visTable,
        fields:
          visFields.trim() && visFields.trim() !== "*"
            ? visFields
                .split(",")
                .map((f) => f.trim())
                .filter(Boolean)
            : [],
        filters: visFilters.map((f) => ({
          field: f.field,
          operator: f.operator,
          value: f.value,
        })),
        orderBy: visOrderBy || undefined,
        orderDir: visOrderDir,
        limit: parseInt(visLimit) || undefined,
      }),
    [visTable, visFields, visFilters, visOrderBy, visOrderDir, visLimit],
  )

  const templates = useMemo(
    () =>
      queryTemplates({
        sources: [],
        contents: [],
        analyses: [],
        all_records: [],
      }),
    [],
  )
  const schemaInfo: TableInfo[] = useMemo(() => sql.schemaInfo(), [sql])

  const runQuery = () => {
    const statement = queryMode === "sql" ? sqlText : generatedSQL
    const outcome = sql.run(statement)
    if (outcome.error) {
      setQueryError(outcome.error)
      setQueryResult(null)
      onToast(outcome.error.message)
      return
    }
    setQueryError(null)
    const result = outcome.result!
    setQueryResult({
      columns: result.columns,
      rows: result.rows,
      elapsedMs: result.elapsedMs,
      plan: result.plan,
      scanned: result.scanned,
      grouped: result.grouped,
      sql: statement,
    })
    onToast(t.messages.queryExecuted.replace("{n}", String(result.rows.length)))
  }

  const generateChart = () => {
    if (!queryResult) {
      onToast(t.messages.runQueryFirst)
      return
    }
    const lf = labelField || queryResult.columns[0] || ""
    const vf = valueField || queryResult.columns[1] || ""
    const limited = queryResult.rows.slice(0, parseInt(chartRowLimit) || 20)
    let processed = limited.map((row) => ({
      name: String(row[lf] ?? ""),
      value: parseFloat(String(row[vf] ?? 0)) || 0,
    }))
    if (aggregation === "count") {
      const grouped: Record<string, number> = {}
      limited.forEach((row) => {
        const k = String(row[lf] ?? "")
        grouped[k] = (grouped[k] ?? 0) + 1
      })
      processed = Object.entries(grouped).map(([name, value]) => ({
        name,
        value,
      }))
    }
    setChartData(processed)
    setHasChart(true)
    onToast(t.messages.chartGenerated)
  }

  const saveReport = () => {
    const rep: SavedReport = {
      id: generateId("rep"),
      name: saveName || reportTitle,
      date_creation: new Date().toISOString(),
      sql: queryMode === "sql" ? sqlText : generatedSQL,
      chartType,
      labelField,
      valueField,
    }
    setSavedReports((rs) => {
      const next = [rep, ...rs.filter((x) => x.name !== rep.name)].slice(0, 50)
      localStorage.setItem(SAVED_REPORTS_KEY, JSON.stringify(next))
      return next
    })
    setSaveName("")
    onToast(t.messages.reportSaved)
  }

  const loadReport = (rep: SavedReport) => {
    setSqlText(rep.sql)
    setQueryMode("sql")
    setChartType(rep.chartType as ChartType)
    setLabelField(rep.labelField)
    setValueField(rep.valueField)
    setReportTitle(rep.name)
    onToast(`Loaded: ${rep.name}`)
  }

  const deleteReport = (id: string) =>
    setSavedReports((rs) => rs.filter((r) => r.id !== id))

  const exportAs = (format: ExportFormat) => {
    if (!queryResult) {
      onToast(t.messages.noResultsToExport)
      return
    }
    const artifact = exportData(queryResult.rows, {
      columns: queryResult.columns.map((c) => ({ key: c, label: c })),
      format,
      filename: reportTitle,
      title: reportTitle,
      subtitle: queryResult.sql.replace(/\s+/g, " ").slice(0, 160),
      headerLines: [
        printConfig.header1,
        printConfig.header2,
        printConfig.header3,
      ].filter(Boolean),
      footerText: printConfig.footerText,
      orientation: printConfig.orientation,
      pageSize: printConfig.pageSize,
    })
    downloadArtifact(artifact)
    onToast(`${artifact.filename} exported`)
  }

  const exportCSV = () => exportAs("csv")
  const exportJSON = () => exportAs("json")
  const exportExcel = () => exportAs("xlsx")
  const exportPdf = () => exportAs("pdf")

  const printReport = () => {
    if (!queryResult) {
      onToast(t.messages.runQueryFirst)
      return
    }
    const html = buildPrintDocument({
      columns: queryResult.columns.map((c) => ({ key: c, label: c })),
      rows: queryResult.rows,
      config: printConfig,
      title: reportTitle,
      subtitle: queryResult.sql.replace(/\s+/g, " ").slice(0, 200),
      preamble: `${queryResult.rows.length} rows \u00b7 ${queryResult.elapsedMs.toFixed(1)} ms \u00b7 ${queryResult.scanned} rows scanned`,
    })
    if (!printHtml(html))
      onToast(t.messages.printUnavailable)
  }

  const fieldOpts = [
    { value: "", label: "— Field —" },
    ...sqlColumns(visTable as EntityName).map((f) => ({ value: f, label: f })),
  ]
  const tableOpts = [
    ...(["sources", "contents", "analyses"] as EntityName[]).map((name) => ({
      value: name,
      label: name,
    })),
    { value: "all_records", label: "all_records (view)" },
  ]
  const operatorOpts = OPERATORS.map((op) => ({ value: op, label: op }))
  const chartOpts: { value: ChartType; label: string }[] = [
    { value: "bar", label: "Bar" },
    { value: "line", label: "Line" },
    { value: "pie", label: "Pie" },
    { value: "area", label: "Area" },
    { value: "radar", label: "Radar" },
    { value: "scatter", label: "Scatter" },
  ]
  const aggOpts: { value: Aggregation; label: string }[] = [
    { value: "count", label: "Count" },
    { value: "sum", label: "Sum" },
    { value: "avg", label: "Avg" },
    { value: "min", label: "Min" },
    { value: "max", label: "Max" },
  ]
  const schemeOpts: { value: ColorScheme; label: string }[] = [
    { value: "mixed", label: "Mixed" },
    { value: "teal", label: "Teal" },
    { value: "blue", label: "Blue" },
    { value: "red", label: "Red" },
  ]
  const colColors = SCHEME_COLORS[colorScheme]

  const resultCols = queryResult?.columns ?? []
  const resultColOpts = [
    { value: "", label: "— auto —" },
    ...resultCols.map((c) => ({ value: c, label: c })),
  ]

  const queryModeTab = [
    { id: "sql", label: r.sqlMode },
    { id: "visual", label: r.visualMode },
  ]

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PageHeader
        eyebrow={t.nav.reportsDesc}
        title={t.nav.reports}
        subtitle={r.subtitle}
        icon={<NavReports size="md" />}
      />

      {/* Toolbar */}
      <div
        className="flex items-center gap-1.5 px-3 py-2 shrink-0 flex-wrap"
        style={{
          background: "var(--surface)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <Btn
          size="xs"
          variant="ghost"
          onClick={() => {
            setSqlText("SELECT * FROM sources ORDER BY importance DESC")
            setQueryResult(null)
            setHasChart(false)
            setQueryError(null)
          }}
          icon={<Plus size="xs" />}
        >
          {t.actions.newReport}
        </Btn>
        <Btn
          size="xs"
          variant="ghost"
          onClick={saveReport}
          icon={<Save size="xs" />}
        >
          {t.actions.save}
        </Btn>
        <div
          className="w-px h-4 mx-1"
          style={{ background: "var(--border)" }}
          aria-hidden="true"
        />
        <Btn
          size="xs"
          variant="ghost"
          onClick={printReport}
          icon={<Print size="xs" />}
        >
          {t.actions.print}
        </Btn>
        <Btn
          size="xs"
          variant="ghost"
          onClick={exportCSV}
          icon={<Download size="xs" />}
        >
          {t.actions.generateCsv}
        </Btn>
        <Btn
          size="xs"
          variant="ghost"
          onClick={exportExcel}
          icon={<Download size="xs" />}
        >
          {t.actions.generateExcel}
        </Btn>
        <Btn
          size="xs"
          variant="ghost"
          onClick={exportJSON}
          icon={<Download size="xs" />}
        >
          JSON
        </Btn>
        <Btn
          size="xs"
          variant="ghost"
          onClick={exportPdf}
          icon={<Download size="xs" />}
        >
          {t.actions.generatePdf}
        </Btn>
        <div
          className="w-px h-4 mx-1"
          style={{ background: "var(--border)" }}
          aria-hidden="true"
        />
        <Btn
          size="xs"
          variant="ghost"
          onClick={() => setShowSchema((v) => !v)}
          icon={<TableIcon size="xs" />}
        >
          {showSchema ? "Hide schema" : "Schema"}
        </Btn>
        <Btn
          size="xs"
          variant="ghost"
          onClick={() => setShowPlan((v) => !v)}
          disabled={!queryResult}
          icon={<Clipboard size="xs" />}
        >
          Plan
        </Btn>
        <div className="flex-1" />
        {savedReports.length > 0 && (
          <span className="inline-flex items-center gap-1.5">
            <span style={{ color: "var(--muted-fg)" }}>
              <Bookmark size="xs" />
            </span>
            <select
              aria-label={t.actions.loadReport}
              className="text-xs rounded-[var(--radius-sm)] px-2 py-1 outline-none"
              style={{
                background: "var(--surface-2)",
                border: "1px solid var(--border)",
                color: "var(--fg)",
              }}
              onChange={(e) => {
                const rep = savedReports.find((r2) => r2.id === e.target.value)
                if (rep) loadReport(rep)
              }}
            >
              <option value="">{t.actions.loadReport}…</option>
              {savedReports.map((r2) => (
                <option key={r2.id} value={r2.id}>
                  {r2.name}
                </option>
              ))}
            </select>
          </span>
        )}
      </div>

      {/* 4-panel layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left column: Query Builder + Chart Designer */}
        <div
          className="flex flex-col w-80 shrink-0 overflow-hidden"
          style={{ borderInlineEnd: "1px solid var(--border)" }}
        >
          {/* Query Builder */}
          <div
            className="flex flex-col overflow-hidden"
            style={{ flex: "0 0 55%", borderBottom: "1px solid var(--border)" }}
          >
            <div
              className="px-3 py-2 flex items-center gap-2 shrink-0"
              style={{
                background: "var(--secondary-bg)",
                borderBottom: "1px solid var(--border)",
              }}
            >
              <span className="text-xs font-bold">{r.queryBuilder}</span>
              <div className="flex-1" />
              <InlineTabs
                tabs={queryModeTab}
                active={queryMode}
                onChange={(id) => setQueryMode(id as "sql" | "visual")}
              />
            </div>

            <div className="flex-1 overflow-y-auto p-2">
              {queryMode === "sql" ? (
                <>
                  <textarea
                    value={sqlText}
                    onChange={(e) => setSqlText(e.target.value)}
                    className="w-full h-24 text-xs rounded p-2 resize-none mb-2"
                    style={{
                      background: "var(--secondary-bg)",
                      border: "1px solid var(--border)",
                      color: "var(--fg)",
                      fontFamily: "var(--font-mono)",
                    }}
                    spellCheck={false}
                  />
                  <div
                    className="text-[10px] font-semibold uppercase tracking-wide mb-1"
                    style={{ color: "var(--muted-fg)" }}
                  >
                    {r.templates}
                  </div>
                  <div className="flex flex-col gap-1">
                    {templates.map((tpl) => (
                      <button
                        key={tpl.sql}
                        onClick={() => setSqlText(tpl.sql)}
                        className="text-[10px] px-1.5 py-1 rounded text-start truncate"
                        title={tpl.sql}
                        style={{
                          background: "var(--secondary-bg)",
                          border: "1px solid var(--border)",
                          color: "var(--muted-fg)",
                        }}
                      >
                        {tpl.label}
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <div className="flex flex-col gap-2">
                  <div className="flex gap-2 items-center">
                    <span
                      className="text-xs w-12 shrink-0"
                      style={{ color: "var(--muted-fg)" }}
                    >
                      Table
                    </span>
                    <Select
                      value={visTable}
                      onChange={(e) => setVisTable(e.target.value)}
                      options={tableOpts}
                      className="flex-1"
                    />
                  </div>
                  <div className="flex gap-2 items-center">
                    <span
                      className="text-xs w-12 shrink-0"
                      style={{ color: "var(--muted-fg)" }}
                    >
                      Fields
                    </span>
                    <Input
                      value={visFields}
                      onChange={(e) => setVisFields(e.target.value)}
                      placeholder="* or col1, col2"
                      className="flex-1"
                    />
                  </div>
                  {/* Filters */}
                  <div
                    className="text-[10px] font-semibold uppercase tracking-wide mt-1"
                    style={{ color: "var(--muted-fg)" }}
                  >
                    {r.addFilter}
                  </div>
                  {visFilters.map((f, i) => (
                    <div key={i} className="flex gap-1 items-center">
                      <Select
                        value={f.field}
                        onChange={(e) =>
                          setVisFilters((fs) =>
                            fs.map((x, j) =>
                              j === i ? { ...x, field: e.target.value } : x,
                            ),
                          )
                        }
                        options={fieldOpts}
                        className="flex-1"
                      />
                      <Select
                        value={f.operator}
                        onChange={(e) =>
                          setVisFilters((fs) =>
                            fs.map((x, j) =>
                              j === i ? { ...x, operator: e.target.value } : x,
                            ),
                          )
                        }
                        options={operatorOpts}
                        className="flex-1"
                      />
                      <Input
                        value={f.value}
                        onChange={(e) =>
                          setVisFilters((fs) =>
                            fs.map((x, j) =>
                              j === i ? { ...x, value: e.target.value } : x,
                            ),
                          )
                        }
                        className="flex-1"
                        placeholder="value"
                      />
                      <IconButton
                        label={r.removeFilter}
                        onClick={() =>
                          setVisFilters((fs) => fs.filter((_, j) => j !== i))
                        }
                        size={24}
                      >
                        <Close size="xs" />
                      </IconButton>
                    </div>
                  ))}
                  <Btn
                    size="xs"
                    variant="ghost"
                    onClick={() =>
                      setVisFilters((fs) => [
                        ...fs,
                        { field: "", operator: "=", value: "" },
                      ])
                    }
                  >
                    {r.addFilter}
                  </Btn>
                  <div className="flex gap-2 items-center">
                    <span
                      className="text-xs w-12 shrink-0"
                      style={{ color: "var(--muted-fg)" }}
                    >
                      {r.orderBy}
                    </span>
                    <Select
                      value={visOrderBy}
                      onChange={(e) => setVisOrderBy(e.target.value)}
                      options={[
                        { value: "", label: "—" },
                        ...sqlColumns(visTable as EntityName).map((f2) => ({
                          value: f2,
                          label: f2,
                        })),
                      ]}
                      className="flex-1"
                    />
                    <Select
                      value={visOrderDir}
                      onChange={(e) =>
                        setVisOrderDir(e.target.value as "ASC" | "DESC")
                      }
                      options={[
                        { value: "ASC", label: "ASC" },
                        { value: "DESC", label: "DESC" },
                      ]}
                      className="w-16"
                    />
                  </div>
                  <div className="flex gap-2 items-center">
                    <span
                      className="text-xs w-12 shrink-0"
                      style={{ color: "var(--muted-fg)" }}
                    >
                      {r.rowLimit}
                    </span>
                    <Input
                      value={visLimit}
                      onChange={(e) => setVisLimit(e.target.value)}
                      type="number"
                      className="w-20"
                    />
                  </div>
                  {/* Generated SQL preview */}
                  <div
                    className="text-[10px] font-semibold uppercase tracking-wide mt-1"
                    style={{ color: "var(--muted-fg)" }}
                  >
                    Generated SQL
                  </div>
                  <div
                    className="text-[10px] rounded p-2 break-all"
                    style={{
                      background: "var(--secondary-bg)",
                      fontFamily: "var(--font-mono)",
                      color: "var(--fg)",
                      border: "1px solid var(--border)",
                    }}
                  >
                    {generatedSQL}
                  </div>
                </div>
              )}
            </div>
            <div
              className="p-2 shrink-0 flex gap-2"
              style={{ borderTop: "1px solid var(--border)" }}
            >
              <Btn
                size="sm"
                onClick={runQuery}
                className="flex-1"
                variant="primary"
                icon={<PlayIcon size="xs" />}
              >
                {t.actions.run}
              </Btn>
            </div>
          </div>

          {/* Chart Designer */}
          <div className="flex flex-col overflow-hidden flex-1">
            <div
              className="px-3 py-2 text-xs font-bold shrink-0"
              style={{
                background: "var(--secondary-bg)",
                borderBottom: "1px solid var(--border)",
              }}
            >
              {r.chartDesigner}
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              <div className="flex flex-col gap-2">
                {[
                  [
                    r.chartType,
                    <Select
                      value={chartType}
                      onChange={(e) =>
                        setChartType(e.target.value as ChartType)
                      }
                      options={chartOpts}
                    />,
                  ],
                  [
                    r.aggregation,
                    <Select
                      value={aggregation}
                      onChange={(e) =>
                        setAggregation(e.target.value as Aggregation)
                      }
                      options={aggOpts}
                    />,
                  ],
                  [
                    r.colorScheme,
                    <Select
                      value={colorScheme}
                      onChange={(e) =>
                        setColorScheme(e.target.value as ColorScheme)
                      }
                      options={schemeOpts}
                    />,
                  ],
                  [
                    r.labelField,
                    <Select
                      value={labelField}
                      onChange={(e) => setLabelField(e.target.value)}
                      options={resultColOpts}
                    />,
                  ],
                  [
                    r.valueField,
                    <Select
                      value={valueField}
                      onChange={(e) => setValueField(e.target.value)}
                      options={resultColOpts}
                    />,
                  ],
                  [
                    r.rowLimit,
                    <Input
                      value={chartRowLimit}
                      onChange={(e) => setChartRowLimit(e.target.value)}
                      type="number"
                    />,
                  ],
                ].map(([label, ctrl], i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span
                      className="text-xs w-20 shrink-0"
                      style={{ color: "var(--muted-fg)" }}
                    >
                      {label as string}
                    </span>
                    <div className="flex-1">{ctrl as React.ReactNode}</div>
                  </div>
                ))}
                <Btn size="sm" onClick={generateChart} className="mt-1">
                  Generate Chart
                </Btn>
              </div>
            </div>
          </div>
        </div>

        {/* Right column: Results + Preview */}
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Results */}
          <div
            className="flex flex-col overflow-hidden"
            style={{ flex: "0 0 55%", borderBottom: "1px solid var(--border)" }}
          >
            <div
              className="px-3 py-2 flex items-center gap-2 shrink-0"
              style={{
                background: "var(--secondary-bg)",
                borderBottom: "1px solid var(--border)",
              }}
            >
              <span className="text-xs font-bold">{r.results}</span>
              {queryResult && (
                <span
                  className="text-xs"
                  style={{
                    color: "var(--muted-fg)",
                    fontFamily: "var(--font-mono)",
                  }}
                >
                  {queryResult.rows.length} {r.rows} ×{" "}
                  {queryResult.columns.length} {r.columns}
                  {" · "}
                  {queryResult.elapsedMs.toFixed(1)} ms
                  {queryResult.grouped ? " · grouped" : ""}
                </span>
              )}
              <div className="flex-1" />
              {queryResult && (
                <Btn
                  size="xs"
                  variant="ghost"
                  onClick={generateChart}
                  icon={<LayersIcon size="xs" />}
                >
                  {t.actions.addChart}
                </Btn>
              )}
            </div>

            {/* Engine diagnostics: parse/runtime errors, execution plan, schema */}
            {queryError && (
              <div
                className="px-3 py-2 text-xs shrink-0 flex items-start gap-2"
                role="alert"
                style={{
                  background: "var(--error-soft)",
                  color: "var(--error)",
                  borderBottom: "1px solid var(--error)33",
                }}
              >
                <span className="mt-0.5">
                  <Close size="xs" />
                </span>
                <div>
                  <div className="font-semibold">
                    {queryError.kind === "syntax"
                      ? "SQL syntax error"
                      : "Query error"}
                  </div>
                  <div style={{ fontFamily: "var(--font-mono)" }}>
                    {queryError.message}
                  </div>
                  {queryError.hint && (
                    <div style={{ color: "var(--warning)" }}>
                      Hint: {queryError.hint}
                    </div>
                  )}
                </div>
              </div>
            )}
            {showPlan && queryResult && (
              <div
                className="px-3 py-2 text-[11px] shrink-0"
                style={{
                  background: "var(--secondary-bg)",
                  borderBottom: "1px solid var(--border)",
                  fontFamily: "var(--font-mono)",
                }}
              >
                <div
                  className="font-semibold mb-1"
                  style={{
                    fontFamily: "var(--font-body)",
                    color: "var(--muted-fg)",
                  }}
                >
                  Execution plan · {queryResult.scanned} rows scanned
                </div>
                {queryResult.plan.map((line) => (
                  <div key={line}>{line}</div>
                ))}
              </div>
            )}
            {showSchema && (
              <div
                className="px-3 py-2 text-[11px] shrink-0 overflow-auto"
                style={{
                  maxHeight: 160,
                  background: "var(--secondary-bg)",
                  borderBottom: "1px solid var(--border)",
                }}
              >
                {schemaInfo.map((table) => (
                  <div key={table.name} className="mb-1.5">
                    <button
                      className="font-semibold"
                      style={{
                        color: "var(--primary)",
                        fontFamily: "var(--font-mono)",
                      }}
                      onClick={() =>
                        setSqlText(`SELECT * FROM ${table.name} LIMIT 50`)
                      }
                      title={table.description}
                    >
                      {table.name}
                    </button>
                    <span style={{ color: "var(--muted-fg)" }}>
                      {" "}
                      ({table.rowCount} rows
                      {table.kind === "view" ? " · view" : ""}) —{" "}
                    </span>
                    <span style={{ color: "var(--muted-fg)" }}>
                      {table.columns.map((c) => c.name).join(", ")}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div className="flex-1 overflow-auto">
              {!queryResult ? (
                <EmptyState compact variant="empty" title={r.noResults} />
              ) : (
                <table className="w-full text-xs border-collapse">
                  <thead
                    style={{
                      position: "sticky",
                      top: 0,
                      background: "var(--card-bg)",
                      zIndex: 1,
                    }}
                  >
                    <tr>
                      {queryResult.columns.map((col) => (
                        <th
                          key={col}
                          className="px-3 py-1.5 text-start text-[10px] font-semibold uppercase tracking-wide whitespace-nowrap"
                          style={{
                            borderBottom: "2px solid var(--border)",
                            color: "var(--muted-fg)",
                          }}
                        >
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {queryResult.rows.map((row, i) => (
                      <tr
                        key={i}
                        className="hover:bg-[var(--secondary-bg)] transition-colors"
                        style={{
                          background:
                            i % 2 === 0 ? "transparent" : "var(--muted-bg)",
                        }}
                      >
                        {queryResult.columns.map((col) => (
                          <td
                            key={col}
                            className="px-3 py-1.5 truncate max-w-[180px]"
                            style={{ borderBottom: "1px solid var(--border)" }}
                          >
                            {String(row[col] ?? "")}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Report Preview */}
          <div className="flex flex-col flex-1 overflow-hidden">
            <div
              className="px-3 py-2 flex items-center gap-2 shrink-0"
              style={{
                background: "var(--secondary-bg)",
                borderBottom: "1px solid var(--border)",
              }}
            >
              <span className="text-xs font-bold">{r.reportPreview}</span>
              <div className="flex-1" />
              <Input
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                placeholder="Name to save as…"
                className="w-36 !text-xs"
              />
              <Btn size="xs" onClick={saveReport} icon={<Save size="xs" />}>
                {t.actions.save}
              </Btn>
            </div>
            <div ref={printRef} className="flex-1 overflow-y-auto p-4">
              {!queryResult && !hasChart ? (
                <EmptyState compact variant="empty" title={r.noPreview} />
              ) : (
                <div className="max-w-3xl mx-auto">
                  <div className="mb-3">
                    <input
                      value={reportTitle}
                      onChange={(e) => setReportTitle(e.target.value)}
                      className="text-lg font-bold bg-transparent border-0 border-b-2 w-full focus:outline-none mb-1"
                      style={{
                        borderColor: "var(--border)",
                        color: "var(--fg)",
                        fontFamily: "var(--font-display)",
                      }}
                    />
                    <div
                      className="text-xs"
                      style={{ color: "var(--muted-fg)" }}
                    >
                      Generated {new Date().toLocaleDateString()}
                    </div>
                  </div>

                  {/* Stats row */}
                  {queryResult && (
                    <div className="flex gap-4 mb-4">
                      {[
                        ["Records", queryResult.rows.length],
                        ["Columns", queryResult.columns.length],
                      ].map(([label, val]) => (
                        <div
                          key={label as string}
                          className="px-4 py-2 rounded-lg"
                          style={{ background: "var(--secondary-bg)" }}
                        >
                          <div
                            className="text-[10px] uppercase tracking-wide"
                            style={{ color: "var(--muted-fg)" }}
                          >
                            {label}
                          </div>
                          <div
                            className="text-xl font-bold"
                            style={{
                              fontFamily: "var(--font-mono)",
                              color: "var(--primary)",
                            }}
                          >
                            {val}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Chart */}
                  {hasChart && includeChart && chartData.length > 0 && (
                    <div
                      className="rounded-xl p-4 mb-4"
                      style={{
                        background: "var(--card-bg)",
                        border: "1px solid var(--border)",
                      }}
                    >
                      <div
                        className="text-xs font-semibold mb-2"
                        style={{ color: "var(--muted-fg)" }}
                      >
                        {r.chartDesigner}
                      </div>
                      <ResponsiveContainer width="100%" height={200}>
                        {chartType === "pie" ? (
                          <PieChart>
                            <Pie
                              data={chartData}
                              dataKey="value"
                              nameKey="name"
                              cx="50%"
                              cy="50%"
                              outerRadius={80}
                              label={({ name, percent }) =>
                                `${name} ${((percent ?? 0) * 100).toFixed(0)}%`
                              }
                            >
                              {chartData.map((_, i) => (
                                <Cell
                                  key={i}
                                  fill={colColors[i % colColors.length]}
                                />
                              ))}
                            </Pie>
                            <Tooltip />
                            <Legend />
                          </PieChart>
                        ) : chartType === "line" ? (
                          <LineChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" tick={{ fontSize: 9 }} />
                            <YAxis tick={{ fontSize: 9 }} />
                            <Tooltip />
                            <Line
                              dataKey="value"
                              stroke={colColors[0]}
                              strokeWidth={2}
                            />
                          </LineChart>
                        ) : chartType === "area" ? (
                          <AreaChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" tick={{ fontSize: 9 }} />
                            <YAxis tick={{ fontSize: 9 }} />
                            <Tooltip />
                            <Area
                              dataKey="value"
                              fill={colColors[0]}
                              stroke={colColors[1] ?? colColors[0]}
                            />
                          </AreaChart>
                        ) : chartType === "radar" ? (
                          <RadarChart
                            data={chartData}
                            cx="50%"
                            cy="50%"
                            outerRadius={80}
                          >
                            <PolarGrid />
                            <PolarAngleAxis
                              dataKey="name"
                              tick={{ fontSize: 9 }}
                            />
                            <Radar
                              name="value"
                              dataKey="value"
                              stroke={colColors[0]}
                              fill={colColors[0]}
                              fillOpacity={0.4}
                            />
                          </RadarChart>
                        ) : (
                          <BarChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" tick={{ fontSize: 9 }} />
                            <YAxis tick={{ fontSize: 9 }} />
                            <Tooltip />
                            <Bar dataKey="value" radius={[3, 3, 0, 0]}>
                              {chartData.map((_, i) => (
                                <Cell
                                  key={i}
                                  fill={colColors[i % colColors.length]}
                                />
                              ))}
                            </Bar>
                          </BarChart>
                        )}
                      </ResponsiveContainer>
                    </div>
                  )}

                  <div className="flex items-center gap-2 mb-3">
                    <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                      <input
                        type="checkbox"
                        checked={includeChart}
                        onChange={(e) => setIncludeChart(e.target.checked)}
                      />
                      {r.includeChart}
                    </label>
                  </div>

                  {/* Mini table */}
                  {queryResult && queryResult.rows.length > 0 && (
                    <div
                      className="overflow-auto rounded-lg"
                      style={{ border: "1px solid var(--border)" }}
                    >
                      <table className="w-full text-xs border-collapse">
                        <thead>
                          <tr style={{ background: "var(--secondary-bg)" }}>
                            {queryResult.columns.slice(0, 6).map((c) => (
                              <th
                                key={c}
                                className="px-3 py-1.5 text-start font-semibold whitespace-nowrap"
                                style={{
                                  borderBottom: "1px solid var(--border)",
                                }}
                              >
                                {c}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {queryResult.rows.slice(0, 8).map((row, i) => (
                            <tr
                              key={i}
                              style={{
                                background:
                                  i % 2 === 0
                                    ? "transparent"
                                    : "var(--muted-bg)",
                              }}
                            >
                              {queryResult.columns.slice(0, 6).map((c) => (
                                <td
                                  key={c}
                                  className="px-3 py-1 truncate max-w-[140px]"
                                  style={{
                                    borderBottom: "1px solid var(--border)",
                                  }}
                                >
                                  {String(row[c] ?? "")}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {queryResult.rows.length > 8 && (
                        <div
                          className="px-3 py-1 text-xs"
                          style={{ color: "var(--muted-fg)" }}
                        >
                          + {queryResult.rows.length - 8} more rows…
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}