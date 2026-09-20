/**
 * SqlEngine — the query interface used by the Reports workspace.
 *
 * It exposes a real SQL dialect (SELECT … JOIN … WHERE … GROUP BY … HAVING …
 * ORDER BY … LIMIT) over the application's relations, plus introspection
 * (`schemaInfo`), an `explain` plan, and a typed error surface the UI can render.
 */
import { similarity, timestamp } from '../text';
import { execute, SqlRuntimeError, type Database, type QueryOutput, type Row } from './executor';
import { parseSelect, SqlParseError, type SelectStatement } from './parser';
import { SqlSyntaxError } from './lexer';

export interface SqlError {
  message: string;
  position?: number;
  hint?: string;
  kind: 'syntax' | 'runtime';
}

export interface QueryResult extends QueryOutput {
  sql: string;
  elapsedMs: number;
  executedAt: string;
  plan: string[];
}

export interface TableColumn {
  name: string;
  table: string;
  sample?: unknown;
}

export interface TableInfo {
  name: string;
  columns: TableColumn[];
  rowCount: number;
  kind: 'table' | 'view';
  description: string;
}

/** Relations exposed to SQL: the three tables plus derived join columns and a unified view. */
export function buildDatabase(data: {
  sources: Row[];
  contents: Row[];
  analyses: Row[];
  allRecords: Row[];
}): Database {
  const sourceById = new Map(data.sources.map((s) => [String(s.id), s]));
  const contentById = new Map(data.contents.map((c) => [String(c.id), c]));

  const contents = data.contents.map((c) => {
    const parent = sourceById.get(String(c.sources_id));
    return { ...c, source_name: parent ? parent.name : '' };
  });
  const analyses = data.analyses.map((a) => {
    const content = contentById.get(String(a.content_id));
    const source = content ? sourceById.get(String(content.sources_id)) : undefined;
    return {
      ...a,
      content_title: content ? content.title : '',
      source_name: source ? source.name : '',
    };
  });

  return {
    sources: data.sources,
    contents,
    analyses,
    all_records: data.allRecords,
  };
}

export class SqlEngine {
  private readonly database: () => Database;
  constructor(database: () => Database) {
    this.database = database;
  }

  /** Parse + execute. Throws never escape: failures come back as `{ error }`. */
  run(sql: string): { result?: QueryResult; error?: SqlError } {
    const started = performance.now();
    let stmt: SelectStatement;
    try {
      stmt = parseSelect(sql);
    } catch (err) {
      return { error: toSqlError(err) };
    }

    let plan: string[];
    try {
      plan = describePlan(stmt, this.database());
    } catch (err) {
      return { error: toSqlError(err) };
    }

    try {
      const output = execute(stmt, this.database());
      return {
        result: {
          ...output,
          sql,
          elapsedMs: Math.max(0.01, performance.now() - started),
          executedAt: timestamp(),
          plan,
        },
      };
    } catch (err) {
      return { error: toSqlError(err) };
    }
  }

  validate(sql: string): SqlError | null {
    try {
      const stmt = parseSelect(sql);
      // A dry run over an empty schema still surfaces unknown tables/columns.
      execute(stmt, this.database());
      return null;
    } catch (err) {
      return toSqlError(err);
    }
  }

  explain(sql: string): { plan?: string[]; error?: SqlError } {
    try {
      const stmt = parseSelect(sql);
      return { plan: describePlan(stmt, this.database()) };
    } catch (err) {
      return { error: toSqlError(err) };
    }
  }

  schemaInfo(): TableInfo[] {
    const db = this.database();
    const descriptions: Record<string, string> = {
      sources: 'Research sources (people, organisations, publications, websites).',
      contents: 'Captured content, joined with source_name from its parent source.',
      analyses: 'Structured analyses, joined with content_title and source_name.',
      all_records: 'Unified read-only view over sources, contents and analyses.',
    };
    return Object.entries(db).map(([name, rows]) => ({
      name,
      rowCount: rows.length,
      kind: name === 'all_records' ? 'view' : 'table',
      description: descriptions[name] ?? '',
      columns: Object.keys(rows[0] ?? {}).map((col) => ({ name: col, table: name, sample: rows[0]?.[col] })),
    }));
  }
}

function toSqlError(err: unknown): SqlError {
  if (err instanceof SqlParseError || err instanceof SqlSyntaxError) {
    return { kind: 'syntax', message: err.message, position: err.pos };
  }
  if (err instanceof SqlRuntimeError) {
    return { kind: 'runtime', message: err.message, hint: err.hint };
  }
  return { kind: 'runtime', message: err instanceof Error ? err.message : String(err) };
}

function describePlan(stmt: SelectStatement, db: Database): string[] {
  const lines: string[] = [];
  const base = stmt.from.name.toLowerCase();
  lines.push(`SCAN ${base}${stmt.from.alias !== base ? ` AS ${stmt.from.alias}` : ''} (${db[base]?.length ?? 0} rows)`);
  for (const join of stmt.joins) {
    const name = join.table.name.toLowerCase();
    const kind = join.type === 'left' ? 'LEFT JOIN' : join.type === 'cross' ? 'CROSS JOIN' : 'INNER JOIN';
    const on = join.on ? renderExpr(join.on) : 'no condition';
    lines.push(`${kind} ${name}${join.table.alias !== name ? ` AS ${join.table.alias}` : ''} (${db[name]?.length ?? 0} rows) ON ${on}`);
  }
  if (stmt.where) lines.push(`FILTER ${renderExpr(stmt.where)}`);
  if (stmt.groupBy.length) lines.push(`GROUP BY ${stmt.groupBy.map(renderExpr).join(', ')}`);
  if (stmt.having) lines.push(`HAVING ${renderExpr(stmt.having)}`);
  if (stmt.orderBy.length) {
    lines.push(`SORT BY ${stmt.orderBy.map((o) => `${renderExpr(o.expr)} ${o.dir}`).join(', ')}`);
  }
  if (stmt.limit !== undefined) lines.push(`LIMIT ${stmt.limit}${stmt.offset ? ` OFFSET ${stmt.offset}` : ''}`);
  else if (stmt.offset !== undefined) lines.push(`OFFSET ${stmt.offset}`);
  return lines;
}

/** Render an expression back to SQL text (used by EXPLAIN and the visual builder). */
export function renderExpr(expr: unknown): string {
  if (!expr || typeof expr !== 'object') return String(expr ?? '');
  const e = expr as Record<string, unknown>;
  switch (e.kind) {
    case 'lit':
      return typeof e.value === 'string' ? `'${String(e.value).replace(/'/g, "''")}'` : String(e.value ?? 'NULL');
    case 'col':
      return e.table ? `${e.table}.${e.name}` : String(e.name);
    case 'bin':
      return `(${renderExpr(e.left)} ${e.op} ${renderExpr(e.right)})`;
    case 'unary':
      return `${e.op} ${renderExpr(e.expr)}`;
    case 'func':
      if (e.star) return `${e.name}(*)`;
      return `${e.name}(${e.distinct ? 'DISTINCT ' : ''}${(e.args as unknown[]).map(renderExpr).join(', ')})`;
    case 'like':
      return `${renderExpr(e.expr)} ${e.not ? 'NOT ' : ''}LIKE ${renderExpr(e.pattern)}`;
    case 'in':
      return `${renderExpr(e.expr)} ${e.not ? 'NOT ' : ''}IN (${(e.values as unknown[]).map(renderExpr).join(', ')})`;
    case 'between':
      return `${renderExpr(e.expr)} ${e.not ? 'NOT ' : ''}BETWEEN ${renderExpr(e.low)} AND ${renderExpr(e.high)}`;
    case 'isnull':
      return `${renderExpr(e.expr)} IS ${e.not ? 'NOT ' : ''}NULL`;
    default:
      return '?';
  }
}

/* --------------------------- visual query builder --------------------------- */

export interface VisualQuerySpec {
  table: string;
  fields: string[];
  filters: { field: string; operator: string; value: string }[];
  groupBy?: string;
  aggregate?: 'count' | 'sum' | 'avg' | 'min' | 'max';
  aggregateField?: string;
  orderBy?: string;
  orderDir?: 'ASC' | 'DESC';
  limit?: number;
  /** Column alias for the aggregate; defaults to `<aggregate>_value`. */
  aggregateAlias?: string;
}

const OPERATOR_SQL: Record<string, (field: string, value: string) => string> = {
  '=': (f, v) => `${f} = ${quote(v)}`,
  '!=': (f, v) => `${f} != ${quote(v)}`,
  '>': (f, v) => `${f} > ${quote(v)}`,
  '>=': (f, v) => `${f} >= ${quote(v)}`,
  '<': (f, v) => `${f} < ${quote(v)}`,
  '<=': (f, v) => `${f} <= ${quote(v)}`,
  contains: (f, v) => `${f} LIKE '%${escapeLike(v)}%'`,
  not_contains: (f, v) => `${f} NOT LIKE '%${escapeLike(v)}%'`,
  starts_with: (f, v) => `${f} LIKE '${escapeLike(v)}%'`,
  ends_with: (f, v) => `${f} LIKE '%${escapeLike(v)}'`,
  is_empty: (f) => `(${f} IS NULL OR ${f} = '')`,
  is_not_empty: (f) => `(${f} IS NOT NULL AND ${f} != '')`,
  in_list: (f, v) => `${f} IN (${v.split(',').map((x) => quote(x.trim())).join(', ')})`,
};

export function quote(value: string): string {
  const n = Number(value);
  if (value !== '' && Number.isFinite(n) && /^-?\d*\.?\d+$/.test(value.trim())) return value.trim();
  return `'${value.replace(/'/g, "''")}'`;
}

function escapeLike(value: string): string {
  return value.replace(/'/g, "''").replace(/[%_]/g, '\\$&');
}

/** Translate the visual builder state into an executable SQL statement. */
export function buildSql(spec: VisualQuerySpec): string {
  const fields = spec.fields.length ? spec.fields : ['*'];
  const selectParts: string[] = [];
  for (const f of fields) selectParts.push(f);
  if (spec.groupBy && spec.aggregate) {
    const target = spec.aggregateField && spec.aggregate !== 'count' ? spec.aggregateField : '*';
    const alias = spec.aggregateAlias ?? `${spec.aggregate}_value`;
    selectParts.push(`${spec.aggregate.toUpperCase()}(${target}) AS ${alias}`);
  }

  const clauses: string[] = [`SELECT ${selectParts.join(', ')}`, `FROM ${spec.table}`];
  const conditions = spec.filters
    .filter((f) => f.field && OPERATOR_SQL[f.operator])
    .map((f) => OPERATOR_SQL[f.operator](f.field, f.value));
  if (conditions.length) clauses.push(`WHERE ${conditions.join(' AND ')}`);
  if (spec.groupBy) clauses.push(`GROUP BY ${spec.groupBy}`);
  if (spec.orderBy) clauses.push(`ORDER BY ${spec.orderBy} ${spec.orderDir ?? 'ASC'}`);
  if (spec.limit) clauses.push(`LIMIT ${spec.limit}`);
  return clauses.join('\n');
}

/** Starter queries surfaced in the Reports workspace, validated against the live schema. */
export function queryTemplates(
  db: Database,
  localize?: (label: string) => string,
): { label: string; sql: string }[] {
  const list: { label: string; sql: string }[] = [
    { label: 'All sources', sql: 'SELECT * FROM sources ORDER BY importance DESC' },
    { label: 'All contents', sql: 'SELECT * FROM contents ORDER BY date_content DESC' },
    { label: 'All analyses', sql: 'SELECT * FROM analyses ORDER BY date_analysis DESC' },
    {
      label: 'High importance sources',
      sql: 'SELECT name, type, country, importance FROM sources WHERE importance >= 0.7 ORDER BY importance DESC',
    },
    {
      label: 'Contents per source',
      sql: `SELECT s.name, COUNT(c.id) AS content_count, ROUND(AVG(c.importance), 2) AS avg_importance
FROM sources s LEFT JOIN contents c ON c.sources_id = s.id
GROUP BY s.id ORDER BY content_count DESC`,
    },
    {
      label: 'Analyses per content',
      sql: `SELECT c.title, s.name AS source_name, COUNT(a.id) AS analysis_count
FROM contents c
LEFT JOIN analyses a ON a.content_id = c.id
LEFT JOIN sources s ON s.id = c.sources_id
GROUP BY c.id ORDER BY analysis_count DESC`,
    },
    {
      label: 'Classification breakdown',
      sql: 'SELECT classification, COUNT(*) AS n FROM analyses GROUP BY classification ORDER BY n DESC',
    },
    {
      label: 'Sources by country',
      sql: 'SELECT country, COUNT(*) AS n, ROUND(AVG(importance), 3) AS avg_importance FROM sources GROUP BY country ORDER BY n DESC',
    },
    {
      label: 'Sources with no content',
      sql: `SELECT s.name, s.country FROM sources s
LEFT JOIN contents c ON c.sources_id = s.id
WHERE c.id IS NULL ORDER BY s.name`,
    },
    {
      label: 'Analyses with coordinates',
      sql: "SELECT content_title, source_name, list_coordinates FROM analyses WHERE list_coordinates IS NOT NULL AND list_coordinates != ''",
    },
    {
      label: 'People mentioned most often',
      sql: `SELECT list_names_people, COUNT(*) AS mentions FROM analyses
WHERE list_names_people != '' GROUP BY list_names_people ORDER BY mentions DESC LIMIT 20`,
    },
    {
      label: 'Recent activity (all records)',
      sql: 'SELECT record_type, record_name, source_name, display_date FROM all_records ORDER BY display_date DESC LIMIT 50',
    },
    {
      label: 'Search across the workspace',
      sql: "SELECT * FROM all_records WHERE record_name LIKE '%report%' OR content_data LIKE '%report%'",
    },
    {
      label: 'Importance distribution',
      sql: `SELECT CASE WHEN importance >= 0.8 THEN 'Critical' WHEN importance >= 0.5 THEN 'High' WHEN importance >= 0.25 THEN 'Medium' ELSE 'Low' END AS band, COUNT(*) AS n
FROM sources GROUP BY band ORDER BY n DESC`,
    },
  ];
  return list.filter((t) => {
    try {
      execute(parseSelect(t.sql), db);
      return true;
    } catch {
      return false;
    }
  }).map((t) => ({ ...t, label: localize ? localize(t.label) : t.label }));
}

/** Cheap "did you mean" helper reused by the SQL editor autocomplete. */
export function suggestColumn(partial: string, db: Database, table?: string): string[] {
  const tables = table ? [table] : Object.keys(db);
  const options = tables.flatMap((t) => Object.keys(db[t]?.[0] ?? {}).map((c) => (tables.length > 1 ? `${t}.${c}` : c)));
  return options
    .map((o) => ({ o, s: similarity(partial, o.split('.').pop() as string) }))
    .filter((x) => x.s > 0.4)
    .sort((a, b) => b.s - a.s)
    .slice(0, 8)
    .map((x) => x.o);
}
