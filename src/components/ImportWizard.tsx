/**
 * Import wizard driven by the core import pipeline:
 *   parse (CSV/TSV/JSON/JSONL/XML/XLSX) → auto-map headers → validate every row
 *   (schema rules, FK resolution, duplicate detection) → transactional apply.
 */
import React, { useMemo, useRef, useState } from 'react';
import { InfoModal } from './FormModal';
import { Btn, Field, Input, Select } from './ui';
import { useTranslation } from '../i18n';
import { useAppData } from '../store/AppContext';
import { importTargets, SCHEMA, type EntityName } from '../core/schema';
import { autoMap, describePlan, planImport, sniffDelimiter, type ColumnMapping, type ImportPlan } from '../core/import/pipeline';
import { detectFormat, parseDelimited, parseJson, parseJsonLines, parseXml, parseXlsxBytes, type ImportFileFormat, type ParsedTable } from '../core/import/parse';
import { formatBytes } from '../core/text';
import type { ValidationIssue } from '../core/validation';

interface ImportWizardProps {
  isOpen: boolean;
  onClose: () => void;
  targetType?: 'source' | 'content' | 'analysis';
  onToast?: (message: string) => void;
}

type Step = 1 | 2 | 3 | 4;

const TARGET_ENTITY: Record<'source' | 'content' | 'analysis', EntityName> = {
  source: 'sources',
  content: 'contents',
  analysis: 'analyses',
};

const ACCEPT = '.csv,.tsv,.txt,.json,.jsonl,.ndjson,.xml,.xlsx';

export function ImportWizard({ isOpen, onClose, targetType = 'source', onToast }: ImportWizardProps) {
  const { t } = useTranslation();
  const { repo, importRows } = useAppData();

  const [step, setStep] = useState<Step>(1);
  const [target, setTarget] = useState<'source' | 'content' | 'analysis'>(targetType);
  const [file, setFile] = useState<File | null>(null);
  const [format, setFormat] = useState<ImportFileFormat>('csv');
  const [delimiter, setDelimiter] = useState(',');
  const [parsed, setParsed] = useState<ParsedTable | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping[]>([]);
  const [plan, setPlan] = useState<ImportPlan | null>(null);
  const [applyResult, setApplyResult] = useState<{ inserted: number; issues: ValidationIssue[] } | null>(null);
  const [error, setError] = useState<string>('');
  const fileRef = useRef<HTMLInputElement>(null);

  const entity = TARGET_ENTITY[target];
  const fields = useMemo(() => importTargets(entity), [entity]);
  const fieldOptions = useMemo(
    () => fields.map((f) => ({ value: f.key, label: `${f.labelKey}${f.required ? ' *' : ''}` })),
    [fields],
  );

  const reset = () => {
    setStep(1);
    setFile(null);
    setParsed(null);
    setMapping([]);
    setPlan(null);
    setApplyResult(null);
    setError('');
    if (fileRef.current) fileRef.current.value = '';
  };

  const parse = async (chosen: File) => {
    setError('');
    try {
      const detected = detectFormat(chosen.name, '');
      setFormat(detected);
      let table: ParsedTable;
      if (detected === 'xlsx') {
        const bytes = new Uint8Array(await chosen.arrayBuffer());
        table = parseXlsxBytes(bytes);
      } else {
        const text = await chosen.text();
        if (detected === 'json') table = parseJson(text);
        else if (detected === 'jsonl') table = parseJsonLines(text);
        else if (detected === 'xml') table = parseXml(text);
        else {
          const delim = sniffDelimiter(text);
          setDelimiter(delim);
          table = parseDelimited(text, delim);
        }
      }
      if (!table.headers.length) {
        setError('No columns were detected in this file.');
        return;
      }
      setParsed(table);
      setMapping(autoMap(table.headers, table, entity));
      setStep(2);
    } catch (err) {
      setError(`Could not read the file: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const buildPlan = () => {
    if (!parsed) return;
    setPlan(
      planImport(parsed, mapping, entity, {
        existing: repo.list(entity),
        parents: { sources: repo.list('sources'), contents: repo.list('contents'), analyses: repo.list('analyses') },
        resolveRef: (e, value) => repo.resolveRef(e, value),
      }),
    );
    setStep(3);
  };

  const apply = () => {
    if (!plan) return;
    const result = importRows(entity, plan.accepted);
    setApplyResult(result);
    setStep(4);
    if (onToast) onToast(t.dialogs.importWizard.importDone.replace('{n}', String(result.inserted)));
  };

  const reMap = (header: string, field: string | null) => {
    setMapping((prev) => {
      const next = prev.map((m) => {
        if (m.header !== header) return m;
        return { ...m, field, confidence: field ? 1 : 0 };
      });
      // A field can only be mapped once: clear it from any other column.
      if (field) {
        return next.map((m) => (m.header !== header && m.field === field ? { ...m, field: null, confidence: 0 } : m));
      }
      return next;
    });
    setPlan(null);
  };

  const targetOpts = [
    { value: 'source', label: `${t.nav.sources} — ${SCHEMA.sources.fields.length} fields` },
    { value: 'content', label: `${t.nav.contents} — ${SCHEMA.contents.fields.length} fields` },
    { value: 'analysis', label: `${t.nav.analysis} — ${SCHEMA.analyses.fields.length} fields` },
  ];

  const steps = [t.dialogs.importWizard.step1, t.dialogs.importWizard.step2, t.dialogs.importWizard.step3, t.dialogs.importWizard.step4];
  const planCols = plan?.mapped.map((m) => m.field) ?? [];

  return (
    <InfoModal isOpen={isOpen} title={`${t.dialogs.importWizard.title} — ${t.nav[target === 'source' ? 'sources' : target === 'content' ? 'contents' : 'analysis']}`} onClose={() => { reset(); onClose(); }} size="lg">
      {/* Step indicator */}
      <div className="flex items-center gap-1 mb-4">
        {steps.map((s, i) => (
          <React.Fragment key={s}>
            <div className="flex items-center gap-1">
              <div
                className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold"
                style={{
                  background: step === i + 1 ? 'var(--primary)' : step > i + 1 ? '#15803d' : 'var(--secondary-bg)',
                  color: step >= i + 1 ? '#fff' : 'var(--muted-fg)',
                }}
              >
                {step > i + 1 ? '✓' : i + 1}
              </div>
              <span className="text-xs" style={{ color: step === i + 1 ? 'var(--primary)' : 'var(--muted-fg)' }}>
                {s}
              </span>
            </div>
            {i < 3 && <div className="flex-1 h-px mx-1" style={{ background: step > i + 1 ? '#15803d' : 'var(--border)' }} />}
          </React.Fragment>
        ))}
      </div>

      {error && (
        <div className="mb-3 rounded px-3 py-2 text-xs" style={{ background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca' }}>
          {error}
        </div>
      )}

      <div style={{ minHeight: 280 }}>
        {/* ------------------------------- step 1 ------------------------------ */}
        {step === 1 && (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-4">
              <Field label={t.dialogs.importWizard.targetTable} hint="Determines which schema the rows are validated against">
                <Select
                  value={target}
                  onChange={(e) => {
                    setTarget(e.target.value as 'source' | 'content' | 'analysis');
                    if (parsed) setMapping(autoMap(parsed.headers, parsed, TARGET_ENTITY[e.target.value as 'source' | 'content' | 'analysis']));
                  }}
                  options={targetOpts}
                />
              </Field>
              <Field label={t.dialogs.importWizard.format} hint="Detected from the file">
                <Input value={format.toUpperCase()} readOnly />
              </Field>
            </div>
            <div
              className="rounded-lg border-2 border-dashed flex flex-col items-center justify-center gap-2 cursor-pointer py-8"
              style={{ borderColor: 'var(--border)', background: 'var(--secondary-bg)' }}
              onClick={() => fileRef.current?.click()}
            >
              <span className="text-2xl">📂</span>
              <span className="text-sm font-semibold" style={{ color: 'var(--muted-fg)' }}>
                {file ? file.name : t.dialogs.importWizard.chooseFile}
              </span>
              <span className="text-xs" style={{ color: 'var(--muted-fg)' }}>
                {file ? formatBytes(file.size) : 'CSV · TSV · JSON · JSONL · XML · XLSX'}
              </span>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept={ACCEPT}
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) {
                  setFile(f);
                  void parse(f);
                }
              }}
            />
            <div className="text-[11px] leading-relaxed" style={{ color: 'var(--muted-fg)' }}>
              Required fields: {fields.filter((f) => f.required).map((f) => f.labelKey).join(', ') || '—'}. Parent references
              (source / content) may be given as an id <em>or</em> by name — the importer resolves them and rejects rows that
              point at a missing record.
            </div>
          </div>
        )}

        {/* ------------------------------- step 2 ------------------------------ */}
        {step === 2 && parsed && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--muted-fg)' }}>
              <span>{t.dialogs.importWizard.columnMapping}</span>
              <span className="flex-1" />
              <button className="underline" style={{ color: 'var(--primary)' }} onClick={() => setMapping(autoMap(parsed.headers, parsed, entity))}>
                re-run auto-map
              </button>
              <button className="underline" style={{ color: 'var(--primary)' }} onClick={() => setMapping((m) => m.map((x) => ({ ...x, field: null, confidence: 0 })))}>
                clear all
              </button>
            </div>
            <div className="overflow-auto border rounded" style={{ borderColor: 'var(--border)', maxHeight: 260 }}>
              <table className="w-full">
                <thead>
                  <tr style={{ background: 'var(--secondary-bg)' }}>
                    {['File column', 'Sample value', t.dialogs.importWizard.targetField, 'Confidence'].map((h) => (
                      <th key={h} className="px-2 py-1.5 text-xs font-semibold text-start border-b whitespace-nowrap" style={{ borderColor: 'var(--border)', color: 'var(--muted-fg)' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {mapping.map((m) => (
                    <tr key={m.header}>
                      <td className="px-2 py-1.5 text-xs border-b" style={{ borderColor: 'var(--border)', fontFamily: 'var(--font-mono)' }}>
                        {m.header}
                      </td>
                      <td className="px-2 py-1.5 text-xs border-b truncate" style={{ borderColor: 'var(--border)', maxWidth: 160, color: 'var(--muted-fg)' }}>
                        {m.sample || '—'}
                      </td>
                      <td className="px-2 py-1.5 border-b" style={{ borderColor: 'var(--border)' }}>
                        <select
                          value={m.field ?? ''}
                          onChange={(e) => reMap(m.header, e.target.value || null)}
                          className="w-full rounded border px-1.5 py-0.5 text-xs outline-none"
                          style={{ background: 'var(--card-bg)', borderColor: 'var(--border)', color: 'var(--fg)' }}
                        >
                          <option value="">{t.dialogs.importWizard.ignore}</option>
                          {fieldOptions.map((f) => (
                            <option key={f.value} value={f.value}>
                              {f.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-2 py-1.5 text-xs border-b" style={{ borderColor: 'var(--border)', fontFamily: 'var(--font-mono)' }}>
                        {m.field ? `${Math.round(m.confidence * 100)}%` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="text-[11px]" style={{ color: 'var(--muted-fg)' }}>
              {parsed.rows.length} rows · {parsed.headers.length} columns
              {parsed.problems.length ? ` · ${parsed.problems.length} parse notes` : ''}
              {mapping.filter((m) => !m.field).length ? ` · ${mapping.filter((m) => !m.field).length} ignored` : ''}
            </div>
          </div>
        )}

        {/* ------------------------------- step 3 ------------------------------ */}
        {step === 3 && plan && (
          <div className="flex flex-col gap-3">
            <div className="flex gap-3">
              {[
                { label: t.dialogs.importWizard.validRows, value: plan.ok, color: '#15803d' },
                { label: t.dialogs.importWizard.warningRows, value: plan.warnings, color: '#b45309' },
                { label: t.dialogs.importWizard.errorRows, value: plan.errors, color: '#dc2626' },
                { label: t.dialogs.importWizard.totalRows, value: plan.total, color: 'var(--muted-fg)' },
              ].map((s) => (
                <div key={s.label} className="rounded p-3 flex-1" style={{ background: 'var(--secondary-bg)' }}>
                  <div className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--muted-fg)' }}>
                    {s.label}
                  </div>
                  <div className="text-lg font-bold" style={{ color: s.color, fontFamily: 'var(--font-mono)' }}>
                    {s.value}
                  </div>
                </div>
              ))}
            </div>

            <div className="overflow-auto border rounded" style={{ borderColor: 'var(--border)', maxHeight: 200 }}>
              <table className="w-full">
                <thead>
                  <tr style={{ background: 'var(--secondary-bg)' }}>
                    {['Line', 'Status', ...planCols.slice(0, 4), 'Issues'].map((h) => (
                      <th key={h} className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-start border-b whitespace-nowrap" style={{ borderColor: 'var(--border)', color: 'var(--muted-fg)' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {plan.rows.slice(0, 40).map((row) => (
                    <tr key={row.row} style={{ background: row.status === 'error' ? '#fef2f2' : row.status === 'warning' ? '#fffbeb' : 'transparent' }}>
                      <td className="px-2 py-1 text-xs border-b" style={{ borderColor: 'var(--border)', fontFamily: 'var(--font-mono)' }}>
                        {row.row}
                      </td>
                      <td className="px-2 py-1 text-xs border-b capitalize" style={{ borderColor: 'var(--border)' }}>
                        {row.status}
                      </td>
                      {planCols.slice(0, 4).map((field) => (
                        <td key={field} className="px-2 py-1 text-xs border-b truncate" style={{ borderColor: 'var(--border)', maxWidth: 120 }}>
                          {String(row.values[field] ?? '—')}
                        </td>
                      ))}
                      <td className="px-2 py-1 text-[11px] border-b" style={{ borderColor: 'var(--border)', color: row.status === 'error' ? '#b91c1c' : 'var(--muted-fg)' }}>
                        {row.issues.map((i) => i.message).join(' · ') || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="text-[11px]" style={{ color: 'var(--muted-fg)' }}>{describePlan(plan)}</div>
            {plan.unmapped.length > 0 && (
              <div className="text-[11px]" style={{ color: 'var(--muted-fg)' }}>
                Ignored columns: {plan.unmapped.join(', ')}
              </div>
            )}
          </div>
        )}

        {/* ------------------------------- step 4 ------------------------------ */}
        {step === 4 && applyResult && (
          <div className="flex flex-col items-center justify-center gap-3 py-8">
            <div className="text-3xl">{applyResult.inserted ? '✅' : '⚠️'}</div>
            <p className="text-sm font-semibold">
              {t.dialogs.importWizard.importDone.replace('{n}', String(applyResult.inserted))}
            </p>
            {applyResult.issues.length > 0 && (
              <p className="text-xs" style={{ color: '#b45309' }}>
                {t.dialogs.importWizard.importErrors.replace('{n}', String(applyResult.issues.length))}
              </p>
            )}
            <p className="text-[11px]" style={{ color: 'var(--muted-fg)' }}>
              Every imported row was validated against the schema and written in a single audited transaction.
            </p>
            <Btn variant="primary" onClick={() => { reset(); onClose(); }}>
              {t.actions.close}
            </Btn>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 mt-3 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
        <Btn onClick={() => setStep((s) => Math.max(1, s - 1) as Step)} disabled={step === 1 || step === 4}>
          {t.actions.back}
        </Btn>
        <div className="flex items-center gap-2">
          <Btn onClick={() => { reset(); onClose(); }}>{t.actions.cancel}</Btn>
          {step === 2 && (
            <Btn variant="primary" onClick={buildPlan} disabled={!mapping.some((m) => m.field)}>
              {t.actions.next}
            </Btn>
          )}
          {step === 3 && (
            <Btn variant="primary" onClick={apply} disabled={!plan || plan.accepted.length === 0}>
              {t.dialogs.importWizard.step4}
            </Btn>
          )}
        </div>
      </div>
    </InfoModal>
  );
}
