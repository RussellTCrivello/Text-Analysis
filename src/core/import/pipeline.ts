/**
 * Import pipeline: header → field mapping, per-row validation and a
 * transaction-ready plan. Mirrors the desktop application's behaviour of
 * matching Name/Type/Link/… columns and reporting imported records and errors.
 */
import { importTargets, type EntityName, type FieldSpec } from '../schema';
import { coerceField, normalizeRecord, validateRecord, hasErrors, type ValidationIssue } from '../validation';
import { similarity, toNumber } from '../text';
import type { Row } from '../repository';
import type { ParsedTable } from './parse';

export interface ColumnMapping {
  header: string;
  /** Target field key, or null to ignore the column. */
  field: string | null;
  confidence: number;
  suggestions: { field: string; score: number }[];
  sample: string;
}

export interface ImportContext {
  existing: Row[];
  parents: Partial<Record<EntityName, Row[]>>;
  /** Resolve a parent reference by id or by the parent's title. */
  resolveRef: (entity: EntityName, value: unknown) => string | null;
}

export type RowStatus = 'ok' | 'warning' | 'error';

export interface RowPlan {
  row: number;
  values: Row;
  issues: ValidationIssue[];
  status: RowStatus;
}

export interface ImportPlan {
  entity: EntityName;
  total: number;
  ok: number;
  warnings: number;
  errors: number;
  rows: RowPlan[];
  unmapped: string[];
  mapped: { header: string; field: string }[];
  /** Rows ready to hand to Repository.insertMany. */
  accepted: Row[];
}

/** Suggest a target field for each header using schema aliases + fuzzy similarity. */
export function autoMap(headers: string[], parsed: ParsedTable, entity: EntityName): ColumnMapping[] {
  const fields = importTargets(entity);
  return headers.map((header) => {
    const scored = fields
      .map((field) => ({ field: field.key, score: scoreHeader(header, field) }))
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score);
    const best = scored[0];
    const sample = String(parsed.rows[0]?.[header] ?? '').slice(0, 60);
    return {
      header,
      field: best && best.score >= 0.5 ? best.field : null,
      confidence: best ? Number(best.score.toFixed(2)) : 0,
      suggestions: scored.slice(0, 4).map((s) => ({ field: s.field, score: Number(s.score.toFixed(2)) })),
      sample,
    };
  });
}

function scoreHeader(header: string, field: FieldSpec): number {
  const candidates = [field.key, field.labelKey, ...(field.importAliases ?? [])];
  let best = 0;
  for (const candidate of candidates) {
    const exact = similarity(header, candidate);
    best = Math.max(best, exact);
  }
  // Boost when the header contains a distinguishing word ("Source Name" → sources_id).
  const lower = header.toLowerCase();
  if (field.key === 'sources_id' && /(source|src)/.test(lower)) best = Math.max(best, 0.9);
  if (field.key === 'content_id' && /(content|article|document)/.test(lower)) best = Math.max(best, 0.9);
  if (field.kind === 'number' && /(importance|priority|score|weight)/.test(lower)) best = Math.max(best, 0.95);
  if (field.kind === 'date' && /(date|when|on)$/.test(lower)) best = Math.max(best, 0.85);
  return best;
}

/** Build the plan: coerce, resolve references, validate every row. */
export function planImport(
  parsed: ParsedTable,
  mapping: ColumnMapping[],
  entity: EntityName,
  ctx: ImportContext,
  options: { skipErrors?: boolean } = {},
): ImportPlan {
  const active = mapping.filter((m) => m.field);
  const rows: RowPlan[] = [];
  const accepted: Row[] = [];

  parsed.rows.forEach((source, index) => {
    const values: Row = {};
    for (const m of active) values[m.field as string] = source[m.header];

    // Resolve foreign keys from names when the file carries titles instead of ids.
    const issues: ValidationIssue[] = [];
    for (const field of importTargets(entity)) {
      if (field.kind !== 'ref' || !(field.key in values)) continue;
      const raw = values[field.key];
      if (raw === '' || raw === null || raw === undefined) continue;
      const resolved = ctx.resolveRef(entity, raw);
      if (resolved) values[field.key] = resolved;
      else {
        issues.push({
          field: field.key,
          level: 'error',
          code: 'unknownRef',
          message: `"${String(raw)}" does not match an existing record`,
        });
      }
    }

    const coerced = normalizeRecord(entity, values);
    // Validate the raw mapped values (not the coerced ones) so the validator can
    // see the original spellings — e.g. an importance column entered as "78".
    const rowIssues = [
      ...issues,
      ...validateRecord(entity, values, {
        entity,
        existing: [...ctx.existing, ...accepted],
        parents: ctx.parents,
        detectDuplicates: true,
      }),
    ];

    const status: RowStatus = rowIssues.some((i) => i.level === 'error')
      ? 'error'
      : rowIssues.length
        ? 'warning'
        : 'ok';

    rows.push({ row: index + 2, values: coerced, issues: rowIssues, status });
    if (status !== 'error' || options.skipErrors === false) {
      if (status !== 'error') accepted.push(coerced);
    }
  });

  return {
    entity,
    total: rows.length,
    ok: rows.filter((r) => r.status === 'ok').length,
    warnings: rows.filter((r) => r.status === 'warning').length,
    errors: rows.filter((r) => r.status === 'error').length,
    rows,
    unmapped: mapping.filter((m) => !m.field).map((m) => m.header),
    mapped: active.map((m) => ({ header: m.header, field: m.field as string })),
    accepted,
  };
}

/** Human readable summary for the import wizard's final step. */
export function describePlan(plan: ImportPlan): string {
  const parts = [`${plan.total} rows`, `${plan.ok} clean`, `${plan.warnings} with warnings`, `${plan.errors} rejected`];
  return parts.join(' · ');
}

/** Detect a delimiter when the caller is unsure (used by the wizard's preview). */
export function sniffDelimiter(sample: string): ',' | '\t' | ';' {
  const firstLine = sample.split(/\r?\n/)[0] ?? '';
  const counts: [string, number][] = [
    [',', (firstLine.match(/,/g) ?? []).length],
    ['\t', (firstLine.match(/\t/g) ?? []).length],
    [';', (firstLine.match(/;/g) ?? []).length],
  ];
  counts.sort((a, b) => b[1] - a[1]);
  return (counts[0][1] > 0 ? counts[0][0] : ',') as ',' | '\t' | ';';
}

/** Numeric sanity check used to warn when an importance column looks like 0–100. */
export function importanceLooksLikePercent(values: unknown[]): boolean {
  const numbers = values.map(toNumber).filter((n): n is number => n !== null);
  if (!numbers.length) return false;
  return numbers.some((n) => n > 1);
}
