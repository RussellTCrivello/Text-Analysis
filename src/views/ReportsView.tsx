import React, { useMemo, useRef, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, CartesianGrid, Legend,
  AreaChart, Area, RadarChart, Radar, PolarGrid, PolarAngleAxis, ScatterChart, Scatter,
} from 'recharts';
import { Btn, Select, Input, InlineTabs } from '../components/ui';
import { useAppData } from '../store/AppContext';
import { useTranslation } from '../i18n';
import type { SavedReport } from '../types';
import { generateId } from '../data/sampleData';

const COLORS = ['#0f766e','#1d4ed8','#c2410c','#7c3aed','#db2777','#15803d','#dc2626','#0369a1','#b45309','#0e7490'];

const SQL_TEMPLATES = [
  'SELECT * FROM sources',
  'SELECT * FROM contents',
  'SELECT * FROM analyses',
  'SELECT * FROM sources WHERE importance > 0.7',
  'SELECT * FROM contents ORDER BY date_content DESC',
  'SELECT * FROM analyses ORDER BY date_analysis DESC',
  'SELECT name, importance FROM sources ORDER BY importance DESC',
  'SELECT title, importance FROM contents WHERE importance > 0.5',
  'SELECT classification, COUNT(*) as count FROM analyses GROUP BY classification',
  'SELECT type, COUNT(*) as count FROM sources GROUP BY type',
  'SELECT country, COUNT(*) as count FROM sources GROUP BY country',
  'SELECT date_content, title FROM contents ORDER BY date_content',
  'SELECT date_analysis, classification FROM analyses ORDER BY date_analysis',
  'SELECT s.name, COUNT(c.id) as content_count FROM sources s JOIN contents c ON c.sources_id = s.id GROUP BY s.id',
  'SELECT c.title, COUNT(a.id) as analysis_count FROM contents c JOIN analyses a ON a.content_id = c.id GROUP BY c.id',
  'SELECT * FROM sources WHERE country != ""',
  'SELECT * FROM contents WHERE note != ""',
  'SELECT * FROM sources ORDER BY date_creation DESC LIMIT 10',
  'SELECT * FROM contents ORDER BY importance DESC LIMIT 10',
  'SELECT * FROM analyses WHERE list_names_people != ""',
  'SELECT * FROM analyses WHERE list_names_places != ""',
  'SELECT * FROM analyses WHERE list_coordinates != ""',
  'SELECT * FROM sources WHERE type = "website"',
  'SELECT * FROM sources WHERE type = "person"',
  'SELECT * FROM sources WHERE type = "organization"',
  'SELECT * FROM contents WHERE sources_id != ""',
  'SELECT * FROM analyses WHERE content_id != ""',
  'SELECT * FROM sources ORDER BY name',
  'SELECT * FROM contents ORDER BY title',
  'SELECT * FROM analyses ORDER BY classification',
  'SELECT name, type, importance, country FROM sources',
  'SELECT title, importance, date_content FROM contents',
  'SELECT classification, list_sides, date_analysis FROM analyses',
  'SELECT * FROM sources WHERE importance > 0.8',
  'SELECT * FROM sources WHERE importance < 0.3',
];

type ChartType = 'bar' | 'line' | 'pie' | 'area' | 'radar' | 'scatter';
type Aggregation = 'count' | 'sum' | 'avg' | 'min' | 'max';
type ColorScheme = 'teal' | 'blue' | 'red' | 'mixed';

const SCHEME_COLORS: Record<ColorScheme, string[]> = {
  teal: ['#0d9488','#0f766e','#115e59','#134e4a','#99f6e4'],
  blue: ['#3b82f6','#1d4ed8','#1e40af','#1e3a8a','#bfdbfe'],
  red: ['#f87171','#ef4444','#dc2626','#b91c1c','#fecaca'],
  mixed: COLORS,
};

interface QueryResult { columns: string[]; rows: Record<string, unknown>[] }

function runSimpleQuery(sql: string, data: ReturnType<typeof useAppData>['data']): QueryResult {
  const s = sql.trim().toLowerCase();
  let table: Record<string, unknown>[] = [];
  if (s.includes('from sources')) table = data.sources as unknown as Record<string, unknown>[];
  else if (s.includes('from contents')) table = data.contents as unknown as Record<string, unknown>[];
  else if (s.includes('from analyses')) table = data.analyses as unknown as Record<string, unknown>[];

  let rows = [...table];

  // Basic WHERE
  const whereMatch = s.match(/where\s+(\w+)\s*(>|<|=|!=|>=|<=)\s*([^\s]+)/);
  if (whereMatch) {
    const [, col, op, rawVal] = whereMatch;
    const val = rawVal.replace(/['"]/g, '');
    rows = rows.filter(r => {
      const rv = String(r[col] ?? '');
      const numVal = parseFloat(val);
      if (op === '>' && !isNaN(numVal)) return parseFloat(rv) > numVal;
      if (op === '<' && !isNaN(numVal)) return parseFloat(rv) < numVal;
      if (op === '>=') return parseFloat(rv) >= numVal;
      if (op === '<=') return parseFloat(rv) <= numVal;
      if (op === '!=') return rv !== val;
      if (op === '=') return rv === val;
      return true;
    });
  }

  // GROUP BY + COUNT
  const groupMatch = s.match(/group\s+by\s+(\w+)/);
  if (groupMatch) {
    const groupCol = groupMatch[1];
    const groups: Record<string, number> = {};
    rows.forEach(r => { const k = String(r[groupCol] ?? '(empty)'); groups[k] = (groups[k] ?? 0) + 1; });
    rows = Object.entries(groups).map(([key, count]) => ({ [groupCol]: key, count }));
    return { columns: [groupCol, 'count'], rows };
  }

  // ORDER BY
  const orderMatch = s.match(/order\s+by\s+(\w+)(\s+desc)?/);
  if (orderMatch) {
    const col = orderMatch[1]; const desc = !!orderMatch[2];
    rows.sort((a, b) => { const av = String(a[col] ?? ''), bv = String(b[col] ?? ''); return desc ? bv.localeCompare(av) : av.localeCompare(bv); });
  }

  // LIMIT
  const limitMatch = s.match(/limit\s+(\d+)/);
  if (limitMatch) rows = rows.slice(0, parseInt(limitMatch[1]));

  // SELECT columns
  const selectMatch = sql.match(/SELECT\s+(.+?)\s+FROM/i);
  if (selectMatch && selectMatch[1].trim() !== '*') {
    const cols = selectMatch[1].split(',').map(c => c.trim().split(/\s+as\s+/i).pop()?.trim() ?? c.trim());
    const srcCols = selectMatch[1].split(',').map(c => c.trim().split(' ')[0].trim());
    rows = rows.map(r => {
      const out: Record<string, unknown> = {};
      cols.forEach((col, i) => { out[col] = r[srcCols[i]] ?? r[col]; });
      return out;
    });
    return { columns: cols, rows };
  }

  const cols = rows[0] ? Object.keys(rows[0]) : [];
  return { columns: cols, rows };
}

const FIELDS = ['id','name','type','importance','country','city','description','link_sources','accounts','note','ownership',
  'date_entry','date_creation','date_modified','title','content_data','sources_id','attachments','date_content',
  'content_id','classification','list_names_people','list_names_places','list_coordinates','list_sides','date_analysis'];

const OPERATORS = ['=','!=','>','<','>=','<=','contains','starts_with','is_empty','is_not_empty'];

interface VisualFilter { field: string; operator: string; value: string }

export function ReportsView({ onToast }: { onToast: (m: string) => void }) {
  const { t } = useTranslation();
  const { data } = useAppData();
  const r = t.sections.reports;

  const [queryMode, setQueryMode] = useState<'sql' | 'visual'>('sql');
  const [sql, setSql] = useState('SELECT * FROM sources');
  const [visTable, setVisTable] = useState('sources');
  const [visFields, setVisFields] = useState('*');
  const [visFilters, setVisFilters] = useState<VisualFilter[]>([]);
  const [visOrderBy, setVisOrderBy] = useState('');
  const [visOrderDir, setVisOrderDir] = useState<'ASC' | 'DESC'>('ASC');
  const [visLimit, setVisLimit] = useState('100');
  const [queryResult, setQueryResult] = useState<QueryResult | null>(null);

  const [chartType, setChartType] = useState<ChartType>('bar');
  const [aggregation, setAggregation] = useState<Aggregation>('count');
  const [colorScheme, setColorScheme] = useState<ColorScheme>('mixed');
  const [labelField, setLabelField] = useState('');
  const [valueField, setValueField] = useState('');
  const [chartRowLimit, setChartRowLimit] = useState('20');
  const [chartData, setChartData] = useState<Record<string, unknown>[]>([]);
  const [hasChart, setHasChart] = useState(false);

  const [reportTitle, setReportTitle] = useState('Untitled Report');
  const [includeChart, setIncludeChart] = useState(true);

  const [savedReports, setSavedReports] = useState<SavedReport[]>([]);
  const [saveName, setSaveName] = useState('');

  const printRef = useRef<HTMLDivElement>(null);

  const generatedSQL = useMemo(() => {
    const cols = visFields.trim() || '*';
    let q = `SELECT ${cols} FROM ${visTable}`;
    const whereParts = visFilters.filter(f => f.field && f.operator).map(f => {
      if (f.operator === 'is_empty') return `${f.field} = ""`;
      if (f.operator === 'is_not_empty') return `${f.field} != ""`;
      if (f.operator === 'contains') return `${f.field} LIKE "%${f.value}%"`;
      if (f.operator === 'starts_with') return `${f.field} LIKE "${f.value}%"`;
      return `${f.field} ${f.operator} "${f.value}"`;
    });
    if (whereParts.length) q += ` WHERE ${whereParts.join(' AND ')}`;
    if (visOrderBy) q += ` ORDER BY ${visOrderBy} ${visOrderDir}`;
    if (visLimit) q += ` LIMIT ${visLimit}`;
    return q;
  }, [visTable, visFields, visFilters, visOrderBy, visOrderDir, visLimit]);

  const runQuery = () => {
    const q = queryMode === 'sql' ? sql : generatedSQL;
    try {
      const result = runSimpleQuery(q, data);
      setQueryResult(result);
      onToast(`Query returned ${result.rows.length} rows`);
    } catch (e) {
      onToast('Query error: ' + String(e));
    }
  };

  const generateChart = () => {
    if (!queryResult) { onToast('Run a query first.'); return; }
    const lf = labelField || queryResult.columns[0] || '';
    const vf = valueField || queryResult.columns[1] || '';
    const limited = queryResult.rows.slice(0, parseInt(chartRowLimit) || 20);
    let processed = limited.map(row => ({ name: String(row[lf] ?? ''), value: parseFloat(String(row[vf] ?? 0)) || 0 }));
    if (aggregation === 'count') {
      const grouped: Record<string, number> = {};
      limited.forEach(row => { const k = String(row[lf] ?? ''); grouped[k] = (grouped[k] ?? 0) + 1; });
      processed = Object.entries(grouped).map(([name, value]) => ({ name, value }));
    }
    setChartData(processed);
    setHasChart(true);
    onToast('Chart generated.');
  };

  const saveReport = () => {
    const rep: SavedReport = {
      id: generateId('rep'), name: saveName || reportTitle, date_creation: new Date().toISOString(),
      sql: queryMode === 'sql' ? sql : generatedSQL, chartType, labelField, valueField,
    };
    setSavedReports(rs => [rep, ...rs]);
    setSaveName('');
    onToast('Report saved.');
  };

  const loadReport = (rep: SavedReport) => {
    setSql(rep.sql); setQueryMode('sql');
    setChartType(rep.chartType as ChartType);
    setLabelField(rep.labelField); setValueField(rep.valueField);
    setReportTitle(rep.name);
    onToast(`Loaded: ${rep.name}`);
  };

  const deleteReport = (id: string) => setSavedReports(rs => rs.filter(r => r.id !== id));

  const exportCSV = () => {
    if (!queryResult) { onToast('No results to export.'); return; }
    const header = queryResult.columns.join(',');
    const rows = queryResult.rows.map(r => queryResult.columns.map(c => `"${String(r[c] ?? '').replace(/"/g, '""')}"`).join(','));
    const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${reportTitle}.csv`; a.click();
  };

  const exportJSON = () => {
    if (!queryResult) { onToast('No results to export.'); return; }
    const blob = new Blob([JSON.stringify(queryResult.rows, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${reportTitle}.json`; a.click();
  };

  const printReport = () => window.print();

  const fieldOpts = [{ value: '', label: '— Field —' }, ...FIELDS.map(f => ({ value: f, label: f }))];
  const tableOpts = ['sources','contents','analyses'].map(t2 => ({ value: t2, label: t2 }));
  const operatorOpts = OPERATORS.map(op => ({ value: op, label: op }));
  const chartOpts: { value: ChartType; label: string }[] = [
    { value: 'bar', label: 'Bar' }, { value: 'line', label: 'Line' }, { value: 'pie', label: 'Pie' },
    { value: 'area', label: 'Area' }, { value: 'radar', label: 'Radar' }, { value: 'scatter', label: 'Scatter' },
  ];
  const aggOpts: { value: Aggregation; label: string }[] = [
    { value: 'count', label: 'Count' }, { value: 'sum', label: 'Sum' }, { value: 'avg', label: 'Avg' },
    { value: 'min', label: 'Min' }, { value: 'max', label: 'Max' },
  ];
  const schemeOpts: { value: ColorScheme; label: string }[] = [
    { value: 'mixed', label: 'Mixed' }, { value: 'teal', label: 'Teal' }, { value: 'blue', label: 'Blue' }, { value: 'red', label: 'Red' },
  ];
  const colColors = SCHEME_COLORS[colorScheme];

  const resultCols = queryResult?.columns ?? [];
  const resultColOpts = [{ value: '', label: '— auto —' }, ...resultCols.map(c => ({ value: c, label: c }))];

  const queryModeTab = [{ id: 'sql', label: r.sqlMode }, { id: 'visual', label: r.visualMode }];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-1.5 px-3 py-2 shrink-0" style={{ background: 'var(--card-bg)', borderBottom: '1px solid var(--border)' }}>
        <Btn size="xs" variant="ghost" onClick={() => { setSql('SELECT * FROM sources'); setQueryResult(null); setHasChart(false); }}>New</Btn>
        <Btn size="xs" variant="ghost" onClick={saveReport}>Save</Btn>
        <div className="w-px h-4 mx-1" style={{ background: 'var(--border)' }} />
        <Btn size="xs" variant="ghost" onClick={printReport}>Print</Btn>
        <Btn size="xs" variant="ghost" onClick={exportCSV}>Export CSV</Btn>
        <Btn size="xs" variant="ghost" onClick={exportJSON}>Export JSON</Btn>
        <div className="flex-1" />
        {savedReports.length > 0 && (
          <select className="text-xs rounded px-2 py-1" style={{ background: 'var(--secondary-bg)', border: '1px solid var(--border)', color: 'var(--fg)' }}
            onChange={e => { const rep = savedReports.find(r2 => r2.id === e.target.value); if (rep) loadReport(rep); }}>
            <option value="">Load saved report…</option>
            {savedReports.map(r2 => <option key={r2.id} value={r2.id}>{r2.name}</option>)}
          </select>
        )}
      </div>

      {/* 4-panel layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left column: Query Builder + Chart Designer */}
        <div className="flex flex-col w-80 shrink-0 overflow-hidden" style={{ borderInlineEnd: '1px solid var(--border)' }}>
          {/* Query Builder */}
          <div className="flex flex-col overflow-hidden" style={{ flex: '0 0 55%', borderBottom: '1px solid var(--border)' }}>
            <div className="px-3 py-2 flex items-center gap-2 shrink-0" style={{ background: 'var(--secondary-bg)', borderBottom: '1px solid var(--border)' }}>
              <span className="text-xs font-bold">{r.queryBuilder}</span>
              <div className="flex-1" />
              <InlineTabs tabs={queryModeTab} active={queryMode} onChange={id => setQueryMode(id as 'sql' | 'visual')} />
            </div>

            <div className="flex-1 overflow-y-auto p-2">
              {queryMode === 'sql' ? (
                <>
                  <textarea
                    value={sql} onChange={e => setSql(e.target.value)}
                    className="w-full h-24 text-xs rounded p-2 resize-none mb-2"
                    style={{ background: 'var(--secondary-bg)', border: '1px solid var(--border)', color: 'var(--fg)', fontFamily: 'var(--font-mono)' }}
                    spellCheck={false}
                  />
                  <div className="text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--muted-fg)' }}>{r.templates}</div>
                  <div className="flex flex-wrap gap-1">
                    {SQL_TEMPLATES.slice(0, 18).map((tpl, i) => (
                      <button key={i} onClick={() => setSql(tpl)}
                        className="text-[9px] px-1.5 py-0.5 rounded"
                        style={{ background: 'var(--secondary-bg)', border: '1px solid var(--border)', color: 'var(--muted-fg)' }}>
                        {tpl.slice(7, 36).trim()}…
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <div className="flex flex-col gap-2">
                  <div className="flex gap-2 items-center">
                    <span className="text-xs w-12 shrink-0" style={{ color: 'var(--muted-fg)' }}>Table</span>
                    <Select value={visTable} onChange={e => setVisTable(e.target.value)} options={tableOpts} className="flex-1" />
                  </div>
                  <div className="flex gap-2 items-center">
                    <span className="text-xs w-12 shrink-0" style={{ color: 'var(--muted-fg)' }}>Fields</span>
                    <Input value={visFields} onChange={e => setVisFields(e.target.value)} placeholder="* or col1, col2" className="flex-1" />
                  </div>
                  {/* Filters */}
                  <div className="text-[10px] font-semibold uppercase tracking-wide mt-1" style={{ color: 'var(--muted-fg)' }}>{r.addFilter}</div>
                  {visFilters.map((f, i) => (
                    <div key={i} className="flex gap-1 items-center">
                      <Select value={f.field} onChange={e => setVisFilters(fs => fs.map((x, j) => j === i ? { ...x, field: e.target.value } : x))} options={fieldOpts} className="flex-1" />
                      <Select value={f.operator} onChange={e => setVisFilters(fs => fs.map((x, j) => j === i ? { ...x, operator: e.target.value } : x))} options={operatorOpts} className="flex-1" />
                      <Input value={f.value} onChange={e => setVisFilters(fs => fs.map((x, j) => j === i ? { ...x, value: e.target.value } : x))} className="flex-1" placeholder="value" />
                      <button onClick={() => setVisFilters(fs => fs.filter((_, j) => j !== i))} className="text-xs px-1" style={{ color: 'var(--muted-fg)' }}>✕</button>
                    </div>
                  ))}
                  <Btn size="xs" variant="ghost" onClick={() => setVisFilters(fs => [...fs, { field: '', operator: '=', value: '' }])}>{r.addFilter}</Btn>
                  <div className="flex gap-2 items-center">
                    <span className="text-xs w-12 shrink-0" style={{ color: 'var(--muted-fg)' }}>{r.orderBy}</span>
                    <Select value={visOrderBy} onChange={e => setVisOrderBy(e.target.value)} options={[{ value: '', label: '—' }, ...FIELDS.map(f2 => ({ value: f2, label: f2 }))]} className="flex-1" />
                    <Select value={visOrderDir} onChange={e => setVisOrderDir(e.target.value as 'ASC' | 'DESC')} options={[{ value: 'ASC', label: 'ASC' }, { value: 'DESC', label: 'DESC' }]} className="w-16" />
                  </div>
                  <div className="flex gap-2 items-center">
                    <span className="text-xs w-12 shrink-0" style={{ color: 'var(--muted-fg)' }}>{r.rowLimit}</span>
                    <Input value={visLimit} onChange={e => setVisLimit(e.target.value)} type="number" className="w-20" />
                  </div>
                  {/* Generated SQL preview */}
                  <div className="text-[10px] font-semibold uppercase tracking-wide mt-1" style={{ color: 'var(--muted-fg)' }}>Generated SQL</div>
                  <div className="text-[10px] rounded p-2 break-all" style={{ background: 'var(--secondary-bg)', fontFamily: 'var(--font-mono)', color: 'var(--fg)', border: '1px solid var(--border)' }}>{generatedSQL}</div>
                </div>
              )}
            </div>
            <div className="p-2 shrink-0 flex gap-2" style={{ borderTop: '1px solid var(--border)' }}>
              <Btn size="sm" onClick={runQuery} className="flex-1">Run Query</Btn>
            </div>
          </div>

          {/* Chart Designer */}
          <div className="flex flex-col overflow-hidden flex-1">
            <div className="px-3 py-2 text-xs font-bold shrink-0" style={{ background: 'var(--secondary-bg)', borderBottom: '1px solid var(--border)' }}>{r.chartDesigner}</div>
            <div className="flex-1 overflow-y-auto p-2">
              <div className="flex flex-col gap-2">
                {[
                  [r.chartType, <Select value={chartType} onChange={e => setChartType(e.target.value as ChartType)} options={chartOpts} />],
                  [r.aggregation, <Select value={aggregation} onChange={e => setAggregation(e.target.value as Aggregation)} options={aggOpts} />],
                  [r.colorScheme, <Select value={colorScheme} onChange={e => setColorScheme(e.target.value as ColorScheme)} options={schemeOpts} />],
                  [r.labelField, <Select value={labelField} onChange={e => setLabelField(e.target.value)} options={resultColOpts} />],
                  [r.valueField, <Select value={valueField} onChange={e => setValueField(e.target.value)} options={resultColOpts} />],
                  [r.rowLimit, <Input value={chartRowLimit} onChange={e => setChartRowLimit(e.target.value)} type="number" />],
                ].map(([label, ctrl], i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-xs w-20 shrink-0" style={{ color: 'var(--muted-fg)' }}>{label as string}</span>
                    <div className="flex-1">{ctrl as React.ReactNode}</div>
                  </div>
                ))}
                <Btn size="sm" onClick={generateChart} className="mt-1">Generate Chart</Btn>
              </div>
            </div>
          </div>
        </div>

        {/* Right column: Results + Preview */}
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Results */}
          <div className="flex flex-col overflow-hidden" style={{ flex: '0 0 55%', borderBottom: '1px solid var(--border)' }}>
            <div className="px-3 py-2 flex items-center gap-2 shrink-0" style={{ background: 'var(--secondary-bg)', borderBottom: '1px solid var(--border)' }}>
              <span className="text-xs font-bold">{r.results}</span>
              {queryResult && (
                <span className="text-xs" style={{ color: 'var(--muted-fg)', fontFamily: 'var(--font-mono)' }}>
                  {queryResult.rows.length} {r.rows} × {queryResult.columns.length} {r.columns}
                </span>
              )}
              <div className="flex-1" />
              {queryResult && <Btn size="xs" variant="ghost" onClick={generateChart}>Create Chart</Btn>}
            </div>
            <div className="flex-1 overflow-auto">
              {!queryResult ? (
                <div className="flex items-center justify-center h-full text-xs" style={{ color: 'var(--muted-fg)' }}>{r.noResults}</div>
              ) : (
                <table className="w-full text-xs border-collapse">
                  <thead style={{ position: 'sticky', top: 0, background: 'var(--card-bg)', zIndex: 1 }}>
                    <tr>
                      {queryResult.columns.map(col => (
                        <th key={col} className="px-3 py-1.5 text-start text-[10px] font-semibold uppercase tracking-wide whitespace-nowrap"
                          style={{ borderBottom: '2px solid var(--border)', color: 'var(--muted-fg)' }}>{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {queryResult.rows.map((row, i) => (
                      <tr key={i} className="hover:bg-[var(--secondary-bg)] transition-colors" style={{ background: i % 2 === 0 ? 'transparent' : 'var(--muted-bg)' }}>
                        {queryResult.columns.map(col => (
                          <td key={col} className="px-3 py-1.5 truncate max-w-[180px]" style={{ borderBottom: '1px solid var(--border)' }}>
                            {String(row[col] ?? '')}
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
            <div className="px-3 py-2 flex items-center gap-2 shrink-0" style={{ background: 'var(--secondary-bg)', borderBottom: '1px solid var(--border)' }}>
              <span className="text-xs font-bold">{r.reportPreview}</span>
              <div className="flex-1" />
              <Input value={saveName} onChange={e => setSaveName(e.target.value)} placeholder="Name to save as…" className="w-36 !text-xs" />
              <Btn size="xs" onClick={saveReport}>Save</Btn>
            </div>
            <div ref={printRef} className="flex-1 overflow-y-auto p-4">
              {!queryResult && !hasChart ? (
                <div className="flex items-center justify-center h-full text-xs" style={{ color: 'var(--muted-fg)' }}>{r.noPreview}</div>
              ) : (
                <div className="max-w-3xl mx-auto">
                  <div className="mb-3">
                    <input value={reportTitle} onChange={e => setReportTitle(e.target.value)}
                      className="text-lg font-bold bg-transparent border-0 border-b-2 w-full focus:outline-none mb-1"
                      style={{ borderColor: 'var(--border)', color: 'var(--fg)', fontFamily: 'var(--font-display)' }} />
                    <div className="text-xs" style={{ color: 'var(--muted-fg)' }}>Generated {new Date().toLocaleDateString()}</div>
                  </div>

                  {/* Stats row */}
                  {queryResult && (
                    <div className="flex gap-4 mb-4">
                      {[['Records', queryResult.rows.length], ['Columns', queryResult.columns.length]].map(([label, val]) => (
                        <div key={label as string} className="px-4 py-2 rounded-lg" style={{ background: 'var(--secondary-bg)' }}>
                          <div className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--muted-fg)' }}>{label}</div>
                          <div className="text-xl font-bold" style={{ fontFamily: 'var(--font-mono)', color: 'var(--primary)' }}>{val}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Chart */}
                  {hasChart && includeChart && chartData.length > 0 && (
                    <div className="rounded-xl p-4 mb-4" style={{ background: 'var(--card-bg)', border: '1px solid var(--border)' }}>
                      <div className="text-xs font-semibold mb-2" style={{ color: 'var(--muted-fg)' }}>{r.chartDesigner}</div>
                      <ResponsiveContainer width="100%" height={200}>
                        {chartType === 'pie' ? (
                          <PieChart>
                            <Pie data={chartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}>
                              {chartData.map((_, i) => <Cell key={i} fill={colColors[i % colColors.length]} />)}
                            </Pie>
                            <Tooltip /><Legend />
                          </PieChart>
                        ) : chartType === 'line' ? (
                          <LineChart data={chartData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" tick={{ fontSize: 9 }} /><YAxis tick={{ fontSize: 9 }} /><Tooltip /><Line dataKey="value" stroke={colColors[0]} strokeWidth={2} /></LineChart>
                        ) : chartType === 'area' ? (
                          <AreaChart data={chartData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" tick={{ fontSize: 9 }} /><YAxis tick={{ fontSize: 9 }} /><Tooltip /><Area dataKey="value" fill={colColors[0]} stroke={colColors[1] ?? colColors[0]} /></AreaChart>
                        ) : chartType === 'radar' ? (
                          <RadarChart data={chartData} cx="50%" cy="50%" outerRadius={80}><PolarGrid /><PolarAngleAxis dataKey="name" tick={{ fontSize: 9 }} /><Radar name="value" dataKey="value" stroke={colColors[0]} fill={colColors[0]} fillOpacity={0.4} /></RadarChart>
                        ) : (
                          <BarChart data={chartData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" tick={{ fontSize: 9 }} /><YAxis tick={{ fontSize: 9 }} /><Tooltip />
                            <Bar dataKey="value" radius={[3, 3, 0, 0]}>{chartData.map((_, i) => <Cell key={i} fill={colColors[i % colColors.length]} />)}</Bar>
                          </BarChart>
                        )}
                      </ResponsiveContainer>
                    </div>
                  )}

                  <div className="flex items-center gap-2 mb-3">
                    <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                      <input type="checkbox" checked={includeChart} onChange={e => setIncludeChart(e.target.checked)} />
                      {r.includeChart}
                    </label>
                  </div>

                  {/* Mini table */}
                  {queryResult && queryResult.rows.length > 0 && (
                    <div className="overflow-auto rounded-lg" style={{ border: '1px solid var(--border)' }}>
                      <table className="w-full text-xs border-collapse">
                        <thead><tr style={{ background: 'var(--secondary-bg)' }}>
                          {queryResult.columns.slice(0, 6).map(c => <th key={c} className="px-3 py-1.5 text-start font-semibold whitespace-nowrap" style={{ borderBottom: '1px solid var(--border)' }}>{c}</th>)}
                        </tr></thead>
                        <tbody>
                          {queryResult.rows.slice(0, 8).map((row, i) => (
                            <tr key={i} style={{ background: i % 2 === 0 ? 'transparent' : 'var(--muted-bg)' }}>
                              {queryResult.columns.slice(0, 6).map(c => <td key={c} className="px-3 py-1 truncate max-w-[140px]" style={{ borderBottom: '1px solid var(--border)' }}>{String(row[c] ?? '')}</td>)}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {queryResult.rows.length > 8 && <div className="px-3 py-1 text-xs" style={{ color: 'var(--muted-fg)' }}>+ {queryResult.rows.length - 8} more rows…</div>}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
