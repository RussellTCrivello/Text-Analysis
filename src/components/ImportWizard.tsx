/**
 * Import wizard — full multi-step workflow redesign.
 *
 * A real stepper (completed steps get a check, current step is highlighted,
 * clicking a completed step navigates back), a deliberate drop target, a
 * mapping worksheet, a validation report with semantic stat tiles, and an
 * explicit completion state. Back / Cancel / Next / Import are the only
 * navigation controls and use real icon components. The core pipeline
 * (parse → auto-map → plan/validate → transactional apply) is untouched.
 */
import React, { useMemo, useRef, useState } from 'react';
import { Modal } from './ui';
import { Btn, EmptyState, Field, Input, Select, Callout, Spinner } from './ui';
import {
  IconBack, IconCheck, IconClose, IconEraser, IconImport,
  IconNext, IconStatusX, IconSuccessBig, IconUploadZone, IconWarning, IconWand,
} from './icons';
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
  const w = t.dialogs.importWizard;
  const { repo, importRows } = useAppData();

  const [step, setStep] = useState<Step>(1);
  const [target, setTarget] = useState<'source' | 'content' | 'analysis'>(targetType);
  const [file, setFile] = useState<File | null>(null);
  const [format, setFormat] = useState<ImportFileFormat>('csv');
  const [parsing, setParsing] = useState(false);
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

  const maxCompleted = (!parsed ? 1 : !plan ? 2 : !applyResult ? 3 : 4) as Step;

  const reset = () => {
    setStep(1);
    setFile(null);
    setParsed(null);
    setMapping([]);
    setPlan(null);
    setApplyResult(null);
    setError('');
    setParsing(false);
    if (fileRef.current) fileRef.current.value = '';
  };

  const parse = async (chosen: File) => {
    setError('');
    setParsing(true);
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
        setError(w.noColumns);
        return;
      }
      setParsed(table);
      setMapping(autoMap(table.headers, table, entity));
      setStep(2);
    } catch (err) {
      setError(`Could not read the file: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setParsing(false);
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
    if (onToast) onToast(w.importDone.replace('{n}', String(result.inserted)));
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

  const steps = [w.step1, w.step2, w.step3, w.step4];
  const planCols = plan?.mapped.map((m) => m.field) ?? [];
  const ignoredCount = mapping.filter((m) => !m.field).length;

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => { reset(); onClose(); }}
      title={`${w.title} — ${t.nav[target === 'source' ? 'sources' : target === 'content' ? 'contents' : 'analysis']}`}
      size="xl"
      footer={
        step === 4 ? (
          <Btn variant="primary" onClick={() => { reset(); onClose(); }} icon={<IconCheck size="xs" />}>{t.actions.close}</Btn>
        ) : (
          <>
            <Btn variant="ghost" onClick={() => setStep((s) => Math.max(1, s - 1) as Step)} disabled={step === 1} icon={<IconBack size="xs" />}>
              {t.actions.back}
            </Btn>
            <span className="flex-1" />
            <Btn onClick={() => { reset(); onClose(); }}>{t.actions.cancel}</Btn>
            {step === 1 && (
              <Btn variant="primary" onClick={() => fileRef.current?.click()} disabled={parsing} icon={<IconUploadZone size="sm" />}>
                {w.chooseFile}
              </Btn>
            )}
            {step === 2 && (
              <Btn variant="primary" onClick={buildPlan} disabled={!mapping.some((m) => m.field)} icon={<IconNext size="xs" />}>
                {t.actions.next}
              </Btn>
            )}
            {step === 3 && (
              <Btn variant="primary" onClick={apply} disabled={!plan || plan.accepted.length === 0} icon={<IconImport size="sm" />}>
                {w.step4}
              </Btn>
            )}
          </>
        )
      }
    >
      {/* ── Stepper ─────────────────────────────────────────────────── */}
      <ol className="flex items-center gap-1 mb-4" aria-label={w.title}>
        {steps.map((s, i) => {
          const n = i + 1;
          const done = maxCompleted > n;
          const current = step === n;
          return (
            <React.Fragment key={s}>
              <li className="flex items-center gap-1.5 min-w-0">
                <button
                  type="button"
                  disabled={!done || current}
                  onClick={() => done && setStep(n as Step)}
                  aria-current={current ? 'step' : undefined}
                  className="flex items-center gap-1.5 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:cursor-default"
                >
                  <span
                    className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 transition-colors"
                    style={{
                      background: current ? 'var(--primary)' : done ? 'var(--success)' : 'var(--surface-3)',
                      color: current || done ? (current ? 'var(--primary-fg)' : '#fff') : 'var(--muted-fg)',
                    }}
                  >
                    {done ? <IconCheck size="xs" /> : <span className="text-[10px] font-bold tnum">{n}</span>}
                  </span>
                  <span
                    className="text-xs whitespace-nowrap truncate"
                    style={{ color: current ? 'var(--primary)' : done ? 'var(--fg-soft)' : 'var(--muted-fg)', fontWeight: current ? 700 : 400 }}
                  >
                    {s}
                  </span>
                </button>
              </li>
              {i < 3 && (
                <span aria-hidden="true" className="flex-1 h-px mx-1" style={{ background: maxCompleted > n ? 'var(--success)' : 'var(--border)' }} />
              )}
            </React.Fragment>
          );
        })}
      </ol>

      {error && (
        <Callout variant="error" icon={<IconStatusX size="sm" />} onClose={() => setError('')}>{error}</Callout>
      )}

      <div style={{ minHeight: 300 }} className="mt-3">
        {/* ── Step 1 · Select file ──────────────────────────────────── */}
        {step === 1 && (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label={w.targetTable} hint={w.schemaHint}>
                <Select
                  value={target}
                  onChange={(e) => {
                    setTarget(e.target.value as 'source' | 'content' | 'analysis');
                    if (parsed) setMapping(autoMap(parsed.headers, parsed, TARGET_ENTITY[e.target.value as 'source' | 'content' | 'analysis']));
                  }}
                  options={targetOpts}
                />
              </Field>
              <Field label={w.format} hint={w.formatDetected}>
                <Input value={format.toUpperCase()} readOnly />
              </Field>
            </div>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={parsing}
              className="rounded-[var(--radius-lg)] border-2 border-dashed flex flex-col items-center justify-center gap-2 py-9 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] hover:border-[var(--primary)]"
              style={{ borderColor: 'var(--border-strong)', background: 'var(--surface-2)' }}
            >
              {parsing ? (
                <>
                  <Spinner size={26} />
                  <span className="text-sm font-semibold" style={{ color: 'var(--muted-fg)' }}>{w.parsingFile}</span>
                </>
              ) : (
                <>
                  <span className="inline-flex" style={{ color: file ? 'var(--success)' : 'var(--muted-fg)' }}><IconUploadZone size="lg" /></span>
                  <span className="text-sm font-semibold" style={{ color: file ? 'var(--fg)' : 'var(--muted-fg)' }}>
                    {file ? file.name : w.chooseFile}
                  </span>
                  <span className="text-xs tnum" style={{ color: 'var(--muted-fg)', fontFamily: 'var(--font-mono)' }}>
                    {file ? formatBytes(file.size) : 'CSV · TSV · JSON · JSONL · XML · XLSX'}
                  </span>
                </>
              )}
            </button>
            {file && (
              <div className="flex items-center gap-2 text-xs tnum" style={{ color: 'var(--muted-fg)', fontFamily: 'var(--font-mono)' }}>
                <span className="font-semibold" style={{ color: 'var(--fg)', fontFamily: 'var(--font-body)' }}>{file.name}</span>
                {formatBytes(file.size)}
                <Btn size="xs" variant="ghost" onClick={() => { setFile(null); setParsed(null); setMapping([]); setPlan(null); if (fileRef.current) fileRef.current.value = ''; }} aria-label={t.actions.delete} title={t.actions.delete}>
                  <IconClose size="xs" />
                </Btn>
              </div>
            )}
            <p className="text-[11px] leading-relaxed" style={{ color: 'var(--muted-fg)' }}>
              <strong style={{ color: 'var(--fg-soft)' }}>{w.requiredFields}</strong>{' '}
              {fields.filter((f) => f.required).map((f) => f.labelKey).join(', ') || '—'}. {w.refHint}
            </p>
          </div>
        )}

        {/* ── Step 2 · Map columns ──────────────────────────────────── */}
        {step === 2 && parsed && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2 text-xs flex-wrap">
              <span className="font-semibold" style={{ color: 'var(--fg-soft)', fontFamily: 'var(--font-display)' }}>{w.columnMapping}</span>
              <span className="tnum" style={{ color: 'var(--muted-fg)', fontFamily: 'var(--font-mono)' }}>
                {parsed.rows.length} × {parsed.headers.length}
                {parsed.problems.length ? ` · ${w.parseNotes.replace('{n}', String(parsed.problems.length))}` : ''}
                {ignoredCount ? ` · ${ignoredCount}` : ''}
              </span>
              <span className="flex-1" />
              <Btn size="xs" variant="subtle" onClick={() => setMapping(autoMap(parsed.headers, parsed, entity))} icon={<IconWand size="xs" />}>
                {w.rerunAutoMap}
              </Btn>
              <Btn size="xs" variant="subtle" onClick={() => setMapping((m) => m.map((x) => ({ ...x, field: null, confidence: 0 })))} icon={<IconEraser size="xs" />}>
                {w.clearMapping}
              </Btn>
            </div>
            <div className="overflow-auto rounded-[var(--radius)]" style={{ border: '1px solid var(--border)', maxHeight: 264 }}>
              <table className="w-full">
                <thead>
                  <tr style={{ background: 'var(--surface-2)' }}>
                    {[w.sourceColumn, w.sampleValue, w.targetField, w.confidence].map((h) => (
                      <th key={h} className="px-2 py-1.5 text-[10px] font-semibold text-start uppercase tracking-wide" style={{ borderBottom: '1px solid var(--border)', color: 'var(--muted-fg)', fontFamily: 'var(--font-display)' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {mapping.map((m) => (
                    <tr key={m.header}>
                      <td className="px-2 py-1.5 text-xs" style={{ borderBottom: '1px solid var(--border)', fontFamily: 'var(--font-mono)' }}>
                        {m.header}
                      </td>
                      <td className="px-2 py-1.5 text-xs truncate" style={{ borderBottom: '1px solid var(--border)', maxWidth: 160, color: 'var(--muted-fg)' }}>
                        {m.sample || '—'}
                      </td>
                      <td className="px-2 py-1.5" style={{ borderBottom: '1px solid var(--border)' }}>
                        <select
                          value={m.field ?? ''}
                          onChange={(e) => reMap(m.header, e.target.value || null)}
                          aria-label={`${w.targetField}: ${m.header}`}
                          className="w-full rounded-[var(--radius-sm)] px-1.5 py-0.5 text-xs outline-none"
                          style={{ background: 'var(--surface)', border: '1px solid var(--border-strong)', color: 'var(--fg)' }}
                        >
                          <option value="">{w.ignore}</option>
                          {fieldOptions.map((f) => (
                            <option key={f.value} value={f.value}>
                              {f.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-2 py-1.5 text-xs tnum" style={{ borderBottom: '1px solid var(--border)', fontFamily: 'var(--font-mono)', color: m.field && m.confidence >= 0.9 ? 'var(--success)' : m.field ? 'var(--warning)' : 'var(--muted-fg)' }}>
                        {m.field ? `${Math.round(m.confidence * 100)}%` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Step 3 · Preview & validate ───────────────────────────── */}
        {step === 3 && plan && (
          <div className="flex flex-col gap-3">
            <div className="flex gap-3">
              {[
                { label: w.validRows, value: plan.ok, color: 'var(--success)' },
                { label: w.warningRows, value: plan.warnings, color: 'var(--warning)' },
                { label: w.errorRows, value: plan.errors, color: 'var(--error)' },
                { label: w.totalRows, value: plan.total, color: 'var(--fg)' },
              ].map((s) => (
                <div key={s.label} className="rounded-[var(--radius)] p-3 flex-1" style={{ background: 'var(--surface-2)', borderTop: `2px solid ${s.color}` }}>
                  <div className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--muted-fg)', fontFamily: 'var(--font-display)' }}>
                    {s.label}
                  </div>
                  <div className="text-lg font-bold tnum" style={{ color: s.color, fontFamily: 'var(--font-mono)' }}>
                    {s.value}
                  </div>
                </div>
              ))}
            </div>

            <div className="overflow-auto rounded-[var(--radius)]" style={{ border: '1px solid var(--border)', maxHeight: 208 }}>
              <table className="w-full">
                <thead>
                  <tr style={{ background: 'var(--surface-2)' }}>
                    {[w.colLine, w.colStatus, ...planCols.slice(0, 4), w.colIssues].map((h) => (
                      <th key={h} className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-start whitespace-nowrap" style={{ borderBottom: '1px solid var(--border)', color: 'var(--muted-fg)', fontFamily: 'var(--font-display)' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {plan.rows.slice(0, 40).map((row) => (
                    <tr key={row.row} style={{ background: row.status === 'error' ? 'var(--error-soft)' : row.status === 'warning' ? 'var(--warning-soft)' : 'transparent' }}>
                      <td className="px-2 py-1 text-xs tnum" style={{ borderBottom: '1px solid var(--border)', fontFamily: 'var(--font-mono)' }}>
                        {row.row}
                      </td>
                      <td className="px-2 py-1 text-xs" style={{ borderBottom: '1px solid var(--border)' }}>
                        <span
                          className="inline-flex items-center gap-1 px-1.5 py-px rounded-[var(--radius-sm)] text-[10px] font-semibold uppercase tracking-wide"
                          style={{
                            color: row.status === 'error' ? 'var(--error)' : row.status === 'warning' ? 'var(--warning)' : 'var(--success)',
                            background: 'var(--surface)',
                            border: `1px solid ${row.status === 'error' ? 'var(--error)' : row.status === 'warning' ? 'var(--warning)' : 'var(--success)'}40`,
                          }}
                        >
                          {row.status === 'error' ? <IconStatusX size="xs" /> : row.status === 'warning' ? <IconWarning size="xs" /> : <IconCheck size="xs" />}
                          {row.status}
                        </span>
                      </td>
                      {planCols.slice(0, 4).map((field) => (
                        <td key={field} className="px-2 py-1 text-xs truncate" style={{ borderBottom: '1px solid var(--border)', maxWidth: 120 }}>
                          {String(row.values[field] ?? '—')}
                        </td>
                      ))}
                      <td className="px-2 py-1 text-[11px]" style={{ borderBottom: '1px solid var(--border)', color: row.status === 'error' ? 'var(--error)' : 'var(--muted-fg)' }}>
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
                <strong style={{ color: 'var(--fg-soft)' }}>{w.ignoredColumns}</strong> {plan.unmapped.join(', ')}
              </div>
            )}
          </div>
        )}

        {/* ── Step 4 · Result ───────────────────────────────────────── */}
        {step === 4 && applyResult && (
          applyResult.inserted ? (
            <EmptyState
              variant="success"
              title={w.importDone.replace('{n}', String(applyResult.inserted))}
              description={applyResult.issues.length > 0
                ? w.importErrors.replace('{n}', String(applyResult.issues.length))
                : w.resultNote}
              icon={<span className="inline-flex" style={{ color: 'var(--success)' }}><IconSuccessBig size="hero" /></span>}
            />
          ) : (
            <EmptyState
              variant="warning"
              title={w.importErrors.replace('{n}', String(applyResult.issues.length))}
              description={w.resultNote}
              icon={<span className="inline-flex" style={{ color: 'var(--warning)' }}><IconWarning size="hero" /></span>}
            />
          )
        )}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        aria-label={w.chooseFile}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) {
            setFile(f);
            void parse(f);
          }
        }}
      />
    </Modal>
  );
}
