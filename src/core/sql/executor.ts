/** SQL executor — evaluates a parsed SELECT statement against in-memory relations. */
import { similarity, toNumber } from '../text';
import { containsAggregate, type Expr, type SelectStatement } from './parser';

export type Row = Record<string, unknown>;
export type Database = Record<string, Row[]>;

export interface QueryOutput {
  columns: string[];
  rows: Row[];
  scanned: number;
  grouped: boolean;
}

export class SqlRuntimeError extends Error {
  readonly hint?: string;
  constructor(message: string, hint?: string) {
    super(hint ? `${message}\nHint: ${hint}` : message);
    this.name = 'SqlRuntimeError';
    this.hint = hint;
  }
}

const AGGREGATES = new Set(['COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'TOTAL', 'GROUP_CONCAT']);

interface Tuple {
  values: Map<string, unknown>;
}

interface ExecContext {
  db: Database;
  /** alias → column names, in join order */
  aliasColumns: Map<string, string[]>;
}

/* ------------------------------ tuple plumbing ------------------------------ */

function buildTuple(alias: string, row: Row | null, columns: string[]): Tuple {
  const values = new Map<string, unknown>();
  if (row) for (const col of columns) values.set(`${alias}.${col}`, row[col] ?? null);
  else for (const col of columns) values.set(`${alias}.${col}`, null);
  return { values };
}

function mergeTuples(a: Tuple, b: Tuple): Tuple {
  const values = new Map(a.values);
  for (const [k, v] of b.values) values.set(k, v);
  return { values };
}

function columnsOf(rows: Row[]): string[] {
  const seen = new Set<string>();
  for (const row of rows) for (const key of Object.keys(row)) seen.add(key);
  return [...seen];
}

function resolveKey(ctx: ExecContext, name: string, table?: string): string {
  if (table) {
    if (!ctx.aliasColumns.has(table)) {
      throw new SqlRuntimeError(
        `Unknown table or alias "${table}"`,
        `Available: ${[...ctx.aliasColumns.keys()].join(', ')}`,
      );
    }
    const cols = ctx.aliasColumns.get(table) as string[];
    const match = cols.find((c) => c.toLowerCase() === name.toLowerCase());
    if (!match) {
      throw new SqlRuntimeError(
        `Unknown column "${table}.${name}"`,
        suggest(name, cols),
      );
    }
    return `${table}.${match}`;
  }
  const candidates: string[] = [];
  for (const [alias, cols] of ctx.aliasColumns) {
    const match = cols.find((c) => c.toLowerCase() === name.toLowerCase());
    if (match) candidates.push(`${alias}.${match}`);
  }
  if (!candidates.length) {
    const all = [...ctx.aliasColumns.values()].flat();
    throw new SqlRuntimeError(`Unknown column "${name}"`, suggest(name, all));
  }
  if (candidates.length > 1) {
    throw new SqlRuntimeError(
      `Column "${name}" is ambiguous`,
      `Qualify it as ${candidates.join(' or ')}`,
    );
  }
  return candidates[0];
}

function suggest(name: string, options: string[]): string {
  const ranked = options
    .map((o) => ({ o, s: similarity(name, o) }))
    .filter((x) => x.s >= 0.4)
    .sort((a, b) => b.s - a.s)
    .slice(0, 3)
    .map((x) => x.o);
  return ranked.length ? `Did you mean ${ranked.join(', ')}?` : `Available columns: ${options.join(', ')}`;
}

/* -------------------------------- evaluation -------------------------------- */

function truthy(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0 && !Number.isNaN(value);
  const s = String(value).trim();
  if (s === '' || s === '0') return false;
  return s.toLowerCase() !== 'false';
}

function compare(a: unknown, b: unknown): number {
  if (a === null || a === undefined) return b === null || b === undefined ? 0 : -1;
  if (b === null || b === undefined) return 1;
  const na = toNumber(a);
  const nb = toNumber(b);
  if (na !== null && nb !== null) return na === nb ? 0 : na < nb ? -1 : 1;
  const sa = String(a);
  const sb = String(b);
  return sa.localeCompare(sb, undefined, { numeric: true, sensitivity: 'base' });
}

function equal(a: unknown, b: unknown): boolean {
  if ((a === null || a === undefined || a === '') && (b === null || b === undefined || b === '')) {
    return (a === null || a === undefined) === (b === null || b === undefined) ? a === b : String(a ?? '') === String(b ?? '');
  }
  return compare(a, b) === 0;
}

function likeToRegex(pattern: string): RegExp {
  const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, (m) => (m === '%' || m === '_' ? m : `\\${m}`));
  const body = escaped.replace(/%/g, '.*').replace(/_/g, '.');
  return new RegExp(`^${body}$`, 'is');
}

function evalExpr(
  expr: Expr,
  tuple: Tuple,
  group: Tuple[],
  ctx: ExecContext,
): unknown {
  switch (expr.kind) {
    case 'lit':
      return expr.value;
    case 'col': {
      const key = resolveKey(ctx, expr.name, expr.table);
      return tuple.values.has(key) ? tuple.values.get(key) ?? null : null;
    }
    case 'unary': {
      const v = evalExpr(expr.expr, tuple, group, ctx);
      if (expr.op === 'NOT') return !truthy(v);
      const n = toNumber(v);
      return -(n ?? 0);
    }
    case 'bin': {
      if (expr.op === 'AND') return truthy(evalExpr(expr.left, tuple, group, ctx)) && truthy(evalExpr(expr.right, tuple, group, ctx));
      if (expr.op === 'OR') return truthy(evalExpr(expr.left, tuple, group, ctx)) || truthy(evalExpr(expr.right, tuple, group, ctx));
      const a = evalExpr(expr.left, tuple, group, ctx);
      const b = evalExpr(expr.right, tuple, group, ctx);
      switch (expr.op) {
        case '=': return equal(a, b);
        case '!=': return !equal(a, b);
        case '<': return compare(a, b) < 0;
        case '<=': return compare(a, b) <= 0;
        case '>': return compare(a, b) > 0;
        case '>=': return compare(a, b) >= 0;
        case '||': return `${a ?? ''}${b ?? ''}`;
        case '+': return (toNumber(a) ?? 0) + (toNumber(b) ?? 0);
        case '-': return (toNumber(a) ?? 0) - (toNumber(b) ?? 0);
        case '*': return (toNumber(a) ?? 0) * (toNumber(b) ?? 0);
        case '/': {
          const d = toNumber(b) ?? 0;
          return d === 0 ? null : (toNumber(a) ?? 0) / d;
        }
        case '%': {
          const d = toNumber(b) ?? 0;
          return d === 0 ? null : (toNumber(a) ?? 0) % d;
        }
        default:
          throw new SqlRuntimeError(`Unsupported operator "${expr.op}"`);
      }
    }
    case 'like': {
      const value = String(evalExpr(expr.expr, tuple, group, ctx) ?? '');
      const pattern = String(evalExpr(expr.pattern, tuple, group, ctx) ?? '');
      const result = likeToRegex(pattern).test(value);
      return expr.not ? !result : result;
    }
    case 'in': {
      const value = evalExpr(expr.expr, tuple, group, ctx);
      const result = expr.values.some((v) => equal(value, evalExpr(v, tuple, group, ctx)));
      return expr.not ? !result : result;
    }
    case 'between': {
      const value = evalExpr(expr.expr, tuple, group, ctx);
      const low = evalExpr(expr.low, tuple, group, ctx);
      const high = evalExpr(expr.high, tuple, group, ctx);
      const result = compare(value, low) >= 0 && compare(value, high) <= 0;
      return expr.not ? !result : result;
    }
    case 'isnull': {
      const v = evalExpr(expr.expr, tuple, group, ctx);
      const isNull = v === null || v === undefined || v === '';
      return expr.not ? !isNull : isNull;
    }
    case 'case': {
      const subject = expr.operand ? evalExpr(expr.operand, tuple, group, ctx) : undefined;
      for (const branch of expr.whens) {
        const when = evalExpr(branch.when, tuple, group, ctx);
        const matched = expr.operand ? equal(subject, when) : truthy(when);
        if (matched) return evalExpr(branch.then, tuple, group, ctx);
      }
      return expr.otherwise ? evalExpr(expr.otherwise, tuple, group, ctx) : null;
    }
    case 'func':
      return evalFunction(expr, tuple, group, ctx);
    default:
      throw new SqlRuntimeError('Unsupported expression');
  }
}

function columnValues(expr: Expr, group: Tuple[], ctx: ExecContext, distinct: boolean | undefined): unknown[] {
  const values = group.map((t) => evalExpr(expr, t, [t], ctx));
  const filtered = values.filter((v) => v !== null && v !== undefined && v !== '');
  if (!distinct) return filtered;
  const seen = new Set<string>();
  return filtered.filter((v) => {
    const key = String(v).toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function evalFunction(
  expr: Extract<Expr, { kind: 'func' }>,
  tuple: Tuple,
  group: Tuple[],
  ctx: ExecContext,
): unknown {
  const name = expr.name.toUpperCase();

  if (AGGREGATES.has(name)) {
    if (name === 'COUNT') {
      if (expr.star) return group.length;
      if (!expr.args.length) return group.length;
      return columnValues(expr.args[0], group, ctx, expr.distinct).length;
    }
    if (name === 'GROUP_CONCAT') {
      const values = columnValues(expr.args[0], group, ctx, expr.distinct);
      const sep = expr.args[1] ? String(evalExpr(expr.args[1], tuple, group, ctx) ?? ',') : ',';
      return values.join(sep);
    }
    const values = columnValues(expr.args[0], group, ctx, expr.distinct).map((v) => toNumber(v)).filter((v): v is number => v !== null);
    if (!values.length) return name === 'SUM' || name === 'TOTAL' ? 0 : null;
    switch (name) {
      case 'SUM': return values.reduce((a, b) => a + b, 0);
      case 'TOTAL': return values.reduce((a, b) => a + b, 0);
      case 'AVG': return values.reduce((a, b) => a + b, 0) / values.length;
      case 'MIN': return Math.min(...values);
      case 'MAX': return Math.max(...values);
    }
  }

  const scalar = (i = 0): unknown => (expr.args[i] ? evalExpr(expr.args[i], tuple, group, ctx) : null);
  switch (name) {
    case 'UPPER': return String(scalar() ?? '').toUpperCase();
    case 'LOWER': return String(scalar() ?? '').toLowerCase();
    case 'TRIM': return String(scalar() ?? '').trim();
    case 'LENGTH': return String(scalar() ?? '').length;
    case 'ABS': return Math.abs(toNumber(scalar()) ?? 0);
    case 'ROUND': {
      const digits = toNumber(scalar(1)) ?? 0;
      const factor = 10 ** digits;
      return Math.round((toNumber(scalar()) ?? 0) * factor) / factor;
    }
    case 'SUBSTR': {
      const s = String(scalar() ?? '');
      const start = Math.max(0, (toNumber(scalar(1)) ?? 1) - 1);
      const len = expr.args[2] ? toNumber(scalar(2)) ?? undefined : undefined;
      return s.slice(start, len === undefined ? undefined : start + len);
    }
    case 'REPLACE':
      return String(scalar() ?? '').split(String(scalar(1) ?? '')).join(String(scalar(2) ?? ''));
    case 'INSTR':
      return String(scalar() ?? '').indexOf(String(scalar(1) ?? '')) + 1;
    case 'COALESCE':
    case 'IFNULL': {
      for (const arg of expr.args) {
        const v = evalExpr(arg, tuple, group, ctx);
        if (v !== null && v !== undefined && v !== '') return v;
      }
      return null;
    }
    default:
      throw new SqlRuntimeError(`Unknown function "${name}"`, 'Supported: COUNT, SUM, AVG, MIN, MAX, TOTAL, GROUP_CONCAT, UPPER, LOWER, TRIM, LENGTH, ABS, ROUND, SUBSTR, REPLACE, INSTR, COALESCE, IFNULL');
  }
}

/* --------------------------------- execution -------------------------------- */

export function execute(stmt: SelectStatement, db: Database): QueryOutput {
  const ctx: ExecContext = { db, aliasColumns: new Map() };

  const baseName = stmt.from.name.toLowerCase();
  const baseRows = db[baseName];
  if (!baseRows) {
    throw new SqlRuntimeError(
      `Unknown table "${stmt.from.name}"`,
      `Available tables: ${Object.keys(db).join(', ')}`,
    );
  }
  const baseColumns = columnsOf(baseRows);
  ctx.aliasColumns.set(stmt.from.alias, baseColumns);

  let scanned = baseRows.length;
  let tuples: Tuple[] = baseRows.map((r) => buildTuple(stmt.from.alias, r, baseColumns));

  for (const join of stmt.joins) {
    const joinName = join.table.name.toLowerCase();
    const joinRows = db[joinName];
    if (!joinRows) {
      throw new SqlRuntimeError(
        `Unknown table "${join.table.name}"`,
        `Available tables: ${Object.keys(db).join(', ')}`,
      );
    }
    const joinColumns = columnsOf(joinRows);
    ctx.aliasColumns.set(join.table.alias, joinColumns);
    scanned += joinRows.length;

    const out: Tuple[] = [];
    if (join.type === 'cross') {
      for (const left of tuples) for (const right of joinRows) out.push(mergeTuples(left, buildTuple(join.table.alias, right, joinColumns)));
    } else {
      for (const left of tuples) {
        let matched = false;
        for (const right of joinRows) {
          const merged = mergeTuples(left, buildTuple(join.table.alias, right, joinColumns));
          if (!join.on || truthy(evalExpr(join.on, merged, [merged], ctx))) {
            out.push(merged);
            matched = true;
          }
        }
        if (!matched && join.type === 'left') {
          out.push(mergeTuples(left, buildTuple(join.table.alias, null, joinColumns)));
        }
      }
    }
    tuples = out;
  }

  if (stmt.where) tuples = tuples.filter((t) => truthy(evalExpr(stmt.where as Expr, t, [t], ctx)));

  // SQLite-style: GROUP BY / HAVING may reference output aliases.
  const aliasExprs = new Map<string, Expr>();
  for (const col of stmt.columns) {
    if (col.alias && col.expr) aliasExprs.set(col.alias.toLowerCase(), col.expr);
  }
  const rewriteAlias = (e: Expr): Expr => {
    if (e.kind === 'col' && !e.table && aliasExprs.has(e.name.toLowerCase())) {
      const known = [...ctx.aliasColumns.values()].some((cols) =>
        cols.some((c) => c.toLowerCase() === e.name.toLowerCase()),
      );
      if (!known) return aliasExprs.get(e.name.toLowerCase()) as Expr;
    }
    return e;
  };
  const groupBy = stmt.groupBy.map(rewriteAlias);
  const having = stmt.having ? rewriteAlias(stmt.having) : undefined;

  const isGrouped =
    stmt.groupBy.length > 0 || stmt.columns.some((c) => containsAggregate(c.expr)) || containsAggregate(stmt.having);

  const columns: string[] = [];
  const rows: Row[] = [];
  const orderSources: Tuple[] = [];

  if (isGrouped) {
    const groups = new Map<string, Tuple[]>();
    if (stmt.groupBy.length) {
      for (const t of tuples) {
        const key = groupBy.map((g) => JSON.stringify(evalExpr(g, t, [t], ctx) ?? null)).join('\u0001');
        const bucket = groups.get(key);
        if (bucket) bucket.push(t);
        else groups.set(key, [t]);
      }
    } else {
      groups.set('\u0000', tuples);
    }

    for (const group of groups.values()) {
      if (!group.length) continue;
      const head = group[0];
      const row: Row = {};
      const names = projectColumns(stmt, ctx);
      let i = 0;
      for (const col of stmt.columns) {
        if (col.star) {
          for (const [alias, cols] of ctx.aliasColumns) {
            for (const c of cols) {
              const key = stmt.columns.length === 1 && alias === stmt.from.alias ? c : `${alias}.${c}`;
              row[key] = head.values.get(`${alias}.${c}`) ?? null;
              if (!columns.includes(key)) columns.push(key);
            }
          }
          continue;
        }
        const name = names[i++];
        row[name] = evalExpr(col.expr as Expr, head, group, ctx);
        if (!columns.includes(name)) columns.push(name);
      }
      if (having && !truthy(evalExpr(having, head, group, ctx))) continue;
      rows.push(row);
      orderSources.push(head);
    }
  } else {
    const names = projectColumns(stmt, ctx);
    for (const t of tuples) {
      const row: Row = {};
      let i = 0;
      for (const col of stmt.columns) {
        if (col.star) {
          for (const [alias, cols] of ctx.aliasColumns) {
            if (col.table && col.table !== alias) continue;
            for (const c of cols) {
              const key = stmt.columns.length === 1 && alias === stmt.from.alias ? c : `${alias}.${c}`;
              row[key] = t.values.get(`${alias}.${c}`) ?? null;
              if (!columns.includes(key)) columns.push(key);
            }
          }
          continue;
        }
        const name = names[i++];
        row[name] = evalExpr(col.expr as Expr, t, [t], ctx);
        if (!columns.includes(name)) columns.push(name);
      }
      rows.push(row);
      orderSources.push(t);
    }
  }

  let result = rows.map((row, i) => ({ row, source: orderSources[i] }));

  if (stmt.distinct) {
    const seen = new Set<string>();
    result = result.filter(({ row }) => {
      const key = columns.map((c) => String(row[c] ?? '')).join('\u0001');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  if (stmt.orderBy.length) {
    result.sort((a, b) => {
      for (const order of stmt.orderBy) {
        let av: unknown;
        let bv: unknown;
        if (order.expr.kind === 'lit' && typeof order.expr.value === 'number') {
          // ORDER BY 1 — positional reference into the select list
          const name = columns[order.expr.value - 1];
          if (name) {
            av = a.row[name];
            bv = b.row[name];
            const c = compare(av, bv);
            if (c !== 0) return order.dir === 'DESC' ? -c : c;
            continue;
          }
        }
        if (order.expr.kind === 'col') {
          const name = order.expr.name;
          const outputAlias = !order.expr.table
            ? columns.find((c) => c.toLowerCase() === name.toLowerCase())
            : undefined;
          if (outputAlias) {
            av = a.row[outputAlias];
            bv = b.row[outputAlias];
          } else {
            const key = resolveKey(ctx, name, order.expr.table);
            av = a.source.values.get(key) ?? null;
            bv = b.source.values.get(key) ?? null;
          }
        } else {
          av = evalExpr(order.expr, a.source, [a.source], ctx);
          bv = evalExpr(order.expr, b.source, [b.source], ctx);
        }
        const c = compare(av, bv);
        if (c !== 0) return order.dir === 'DESC' ? -c : c;
      }
      return 0;
    });
  }

  if (stmt.offset) result = result.slice(stmt.offset);
  if (stmt.limit !== undefined) result = result.slice(0, stmt.limit);

  return { columns, rows: result.map((r) => r.row), scanned, grouped: isGrouped };
}

function projectColumns(stmt: SelectStatement, ctx: ExecContext): string[] {
  const names: string[] = [];
  let auto = 0;
  for (const col of stmt.columns) {
    if (col.star) continue;
    if (col.alias) {
      names.push(col.alias);
      continue;
    }
    const expr = col.expr as Expr;
    if (expr.kind === 'col') names.push(expr.name);
    else if (expr.kind === 'func') names.push(expr.name.toLowerCase());
    else names.push(`expr${++auto}`);
  }
  void ctx;
  return names;
}
