/**
 * Validation + normalisation driven entirely by the schema registry.
 * Implements the rules from the interface spec: required fields, minimum
 * lengths, URL checks, 0..1 importance range, foreign-key existence,
 * uniqueness, and whole-record duplicate detection.
 */
import { SCHEMA, fieldsOf, type EntityName, type FieldSpec } from './schema';
import { fold, isBlank, normalizeWhitespace, parseDate, toImportance, toNumber } from './text';

export type IssueLevel = 'error' | 'warning';

export interface ValidationIssue {
  field: string;
  level: IssueLevel;
  code:
    | 'required'
    | 'minLength'
    | 'range'
    | 'url'
    | 'date'
    | 'unknownRef'
    | 'duplicate'
    | 'exactDuplicate'
    | 'unknownField';
  message: string;
}

export interface ValidationContext {
  entity: EntityName;
  /** All rows of the target entity, used for uniqueness/duplicate checks. */
  existing: Record<string, unknown>[];
  /** Parent rows keyed by entity, used for FK checks and name→id resolution. */
  parents?: Partial<Record<EntityName, Record<string, unknown>[]>>;
  /** Id of the row being edited (excluded from uniqueness/duplicate checks). */
  editingId?: string;
  /** Reject records that exactly duplicate an existing one. */
  detectDuplicates?: boolean;
}

const URL_RE = /^(https?|ftp):\/\/[^\s/$.?#].[^\s]*$/i;

export function isValidUrl(value: string): boolean {
  const v = value.trim();
  return v === '' || URL_RE.test(v);
}

/** Coerce a raw value (from a form, an import file, or JSON) into the stored shape. */
export function coerceField(field: FieldSpec, value: unknown): unknown {
  if (value === undefined) return field.defaultValue ?? (field.kind === 'number' ? 0 : '');
  if (value === null) return field.kind === 'number' ? 0 : '';

  switch (field.kind) {
    case 'number': {
      if (field.format === 'percent') {
        const n = toImportance(value);
        return n === null ? 0 : n;
      }
      const n = toNumber(value);
      return n === null ? 0 : n;
    }
    case 'date': {
      const iso = parseDate(value);
      return iso ?? (typeof value === 'string' ? value : '');
    }
    case 'list':
      return normalizeWhitespace(value).replace(/\s*,\s*/g, ', ');
    default:
      return normalizeWhitespace(value);
  }
}

/** Build a full record from partial input, applying defaults and coercion. */
export function normalizeRecord(
  entity: EntityName,
  raw: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const field of fieldsOf(entity)) {
    out[field.key] = field.key in raw ? coerceField(field, raw[field.key]) : (field.defaultValue ?? (field.kind === 'number' ? 0 : ''));
  }
  out.id = raw.id ?? '';
  return out;
}

/** Strip keys that are not part of the schema (protects storage from junk). */
export function projectRecord(entity: EntityName, raw: Record<string, unknown>): Record<string, unknown> {
  const known = new Set(fieldsOf(entity).map((f) => f.key));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw)) if (known.has(k)) out[k] = v;
  return out;
}

export function validateRecord(
  entity: EntityName,
  raw: Record<string, unknown>,
  ctx: ValidationContext,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const record = normalizeRecord(entity, raw);

  for (const field of SCHEMA[entity].fields) {
    const value = record[field.key];

    if (field.required && isBlank(value)) {
      issues.push({ field: field.key, level: 'error', code: 'required', message: `${field.labelKey} is required` });
      continue;
    }
    if (isBlank(value)) continue;

    if (field.kind === 'text' || field.kind === 'textarea' || field.kind === 'url' || field.kind === 'list') {
      const s = String(value);
      if (field.minLength && s.trim().length < field.minLength) {
        issues.push({
          field: field.key,
          level: 'error',
          code: 'minLength',
          message: `${field.labelKey} needs at least ${field.minLength} characters`,
        });
      }
    }

    if (field.kind === 'url' && !isValidUrl(String(value))) {
      issues.push({ field: field.key, level: 'error', code: 'url', message: `${field.labelKey} must be a valid URL` });
    }

    if (field.kind === 'number') {
      const n = toNumber(value);
      if (n === null) {
        issues.push({ field: field.key, level: 'error', code: 'range', message: `${field.labelKey} must be a number` });
      } else if ((field.min !== undefined && n < field.min) || (field.max !== undefined && n > field.max)) {
        issues.push({
          field: field.key,
          level: 'error',
          code: 'range',
          message: `${field.labelKey} must be between ${field.min} and ${field.max}`,
        });
      }
      // Percent fields are stored on a 0..1 scale. A raw value above 1 is read
      // as a percentage ("78" → 0.78); surface that reinterpretation as a warning
      // so imports and forms never change a number silently.
      if (field.format === 'percent') {
        const rawNumber = toNumber(raw[field.key]);
        if (rawNumber !== null && rawNumber > 1) {
          issues.push({
            field: field.key,
            level: 'warning',
            code: 'range',
            message: `${field.labelKey} "${raw[field.key]}" was read as a percentage (${((n ?? 0) * 100).toFixed(1)}%)`,
          });
        }
      }
    }

    if (field.kind === 'date' && !parseDate(value)) {
      issues.push({ field: field.key, level: 'warning', code: 'date', message: `${field.labelKey} is not a recognisable date` });
    }

    if (field.unique) {
      const clash = ctx.existing.find(
        (r) => r.id !== ctx.editingId && fold(r[field.key]) === fold(value),
      );
      if (clash) {
        issues.push({
          field: field.key,
          level: 'error',
          code: 'duplicate',
          message: `${field.labelKey} already used by record ${String(clash.id)}`,
        });
      }
    }

    if (field.kind === 'ref' && field.ref) {
      const parentRows = ctx.parents?.[field.ref.entity] ?? [];
      const asString = String(value).trim();
      const exists = parentRows.some(
        (p) => String(p.id) === asString || fold(p[field.ref!.labelField]) === fold(asString),
      );
      if (!exists) {
        issues.push({
          field: field.key,
          level: 'error',
          code: 'unknownRef',
          message: `${field.labelKey} does not reference an existing record`,
        });
      }
    }
  }

  if (ctx.detectDuplicates) {
    const dup = findExactDuplicate(entity, record, ctx.existing, ctx.editingId);
    if (dup) {
      issues.push({
        field: '*',
        level: 'error',
        code: 'exactDuplicate',
        message: `Identical record already exists (ID ${String(dup)})`,
      });
    }
  }

  return issues;
}

export function hasErrors(issues: ValidationIssue[]): boolean {
  return issues.some((i) => i.level === 'error');
}

/**
 * Whole-record duplicate detection: every field except id and the system
 * timestamps is compared after whitespace normalisation and date-aware parsing.
 */
export function findExactDuplicate(
  entity: EntityName,
  record: Record<string, unknown>,
  existing: Record<string, unknown>[],
  ignoreId?: string,
): string | null {
  const comparable = SCHEMA[entity].fields.filter((f) => f.kind !== 'id' && !f.system).map((f) => f.key);
  const target = comparable.map((k) => canonical(record[k]));
  for (const row of existing) {
    if (ignoreId && String(row.id) === String(ignoreId)) continue;
    const other = comparable.map((k) => canonical(row[k]));
    if (other.every((v, i) => v === target[i])) return String(row.id);
  }
  return null;
}

function canonical(value: unknown): string {
  if (isBlank(value)) return '';
  const asDate = parseDate(value);
  if (asDate && /\d{4}-\d{2}-\d{2}/.test(String(value))) return asDate;
  const n = toNumber(value);
  if (n !== null && typeof value !== 'string') return String(n);
  return fold(value);
}
