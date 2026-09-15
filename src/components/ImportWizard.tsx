import React, { useRef, useState } from 'react';
import { InfoModal } from './FormModal';
import { Btn, Field, Input, Select } from './ui';
import { useTranslation } from '../i18n';
import { generateId } from '../data/sampleData';
import type { RecordType } from '../types';

interface ImportWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (records: Record<string, unknown>[], target: RecordType) => void;
  targetType?: RecordType;
}

type Step = 1 | 2 | 3 | 4;

export function ImportWizard({ isOpen, onClose, onImport, targetType }: ImportWizardProps) {
  const { t } = useTranslation();
  const [step, setStep] = useState<Step>(1);
  const [file, setFile] = useState<File | null>(null);
  const [format, setFormat] = useState<'csv' | 'json'>('csv');
  const [delimiter, setDelimiter] = useState(',');
  const [target, setTarget] = useState<RecordType>(targetType ?? 'source');
  const [rawRows, setRawRows] = useState<Record<string, string>[]>([]);
  const [fileColumns, setFileColumns] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [validRows, setValidRows] = useState<Record<string, unknown>[]>([]);
  const [errorCount, setErrorCount] = useState(0);
  const [importing, setImporting] = useState(false);
  const [done, setDone] = useState(false);
  const [importedCount, setImportedCount] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  const targetFields: Record<RecordType, string[]> = {
    source: ['name', 'type', 'link_sources', 'importance', 'country', 'city', 'description', 'accounts', 'note', 'ownership', 'date_entry'],
    content: ['title', 'content_data', 'attachments', 'note', 'importance', 'date_content'],
    analysis: ['classification', 'list_names_people', 'list_names_places', 'list_coordinates', 'list_sides'],
  };

  const parseFile = (f: File) => {
    const reader = new FileReader();
    reader.onload = ev => {
      const text = ev.target?.result as string;
      try {
        if (format === 'json') {
          const parsed = JSON.parse(text);
          const arr = Array.isArray(parsed) ? parsed : [parsed];
          setRawRows(arr.map(r => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, String(v ?? '')]))));
          setFileColumns(arr.length > 0 ? Object.keys(arr[0]) : []);
        } else {
          const lines = text.split(/\r?\n/).filter(Boolean);
          const headers = lines[0].split(delimiter).map(h => h.trim().replace(/^"|"$/g, ''));
          const rows = lines.slice(1).map(line => {
            const vals = line.split(delimiter).map(v => v.trim().replace(/^"|"$/g, ''));
            return Object.fromEntries(headers.map((h, i) => [h, vals[i] ?? '']));
          });
          setRawRows(rows);
          setFileColumns(headers);
        }
        // Auto-map matching columns
        const fields = targetFields[target];
        const autoMap: Record<string, string> = {};
        for (const f2 of fileColumns) {
          const match = fields.find(fn => fn.toLowerCase() === f2.toLowerCase() || fn.replace(/_/g, '').toLowerCase() === f2.replace(/_/g, '').toLowerCase());
          if (match) autoMap[f2] = match;
        }
        setMapping(autoMap);
        setStep(2);
      } catch (err) {
        alert('Failed to parse file: ' + String(err));
      }
    };
    reader.readAsText(f);
  };

  const buildRows = () => {
    const rows: Record<string, unknown>[] = [];
    let errs = 0;
    rawRows.forEach(raw => {
      const row: Record<string, unknown> = { id: generateId('imp') };
      let valid = true;
      Object.entries(mapping).forEach(([srcCol, tgtField]) => {
        if (tgtField) row[tgtField] = raw[srcCol];
      });
      if (!row['name'] && target === 'source') valid = false;
      if (!row['title'] && target === 'content') valid = false;
      if (valid) rows.push(row);
      else errs++;
    });
    setValidRows(rows);
    setErrorCount(errs);
    setStep(3);
  };

  const doImport = () => {
    setImporting(true);
    setTimeout(() => {
      onImport(validRows, target);
      setImportedCount(validRows.length);
      setDone(true);
      setStep(4);
      setImporting(false);
    }, 600);
  };

  const reset = () => {
    setStep(1); setFile(null); setRawRows([]); setFileColumns([]);
    setMapping({}); setValidRows([]); setErrorCount(0); setDone(false); setImportedCount(0);
  };

  const targetOpts: { value: RecordType; label: string }[] = [
    { value: 'source', label: t.nav.sources },
    { value: 'content', label: t.nav.contents },
    { value: 'analysis', label: t.nav.analysis },
  ];
  const formatOpts = [{ value: 'csv', label: 'CSV' }, { value: 'json', label: 'JSON' }];
  const delimOpts = [{ value: ',', label: 'Comma (,)' }, { value: '\t', label: 'Tab' }, { value: ';', label: 'Semicolon (;)' }];

  const steps = [t.dialogs.importWizard.step1, t.dialogs.importWizard.step2, t.dialogs.importWizard.step3, t.dialogs.importWizard.step4];

  return (
    <InfoModal isOpen={isOpen} title={t.dialogs.importWizard.title} onClose={() => { reset(); onClose(); }} size="lg">
      {/* Step indicator */}
      <div className="flex items-center gap-1 mb-4">
        {steps.map((s, i) => (
          <React.Fragment key={i}>
            <div className="flex items-center gap-1">
              <div className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold"
                style={{ background: step === i + 1 ? 'var(--primary)' : step > i + 1 ? '#15803d' : 'var(--secondary-bg)', color: step >= i + 1 ? '#fff' : 'var(--muted-fg)' }}>
                {step > i + 1 ? '✓' : i + 1}
              </div>
              <span className="text-xs" style={{ color: step === i + 1 ? 'var(--primary)' : 'var(--muted-fg)' }}>{s}</span>
            </div>
            {i < 3 && <div className="flex-1 h-px mx-1" style={{ background: step > i + 1 ? '#15803d' : 'var(--border)' }} />}
          </React.Fragment>
        ))}
      </div>

      <div style={{ minHeight: 260 }}>
        {step === 1 && (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-4">
              <Field label={t.dialogs.importWizard.format}>
                <Select value={format} onChange={e => setFormat(e.target.value as 'csv' | 'json')} options={formatOpts} />
              </Field>
              <Field label={t.dialogs.importWizard.targetTable}>
                <Select value={target} onChange={e => setTarget(e.target.value as RecordType)} options={targetOpts} />
              </Field>
              {format === 'csv' && (
                <Field label={t.dialogs.importWizard.delimiter}>
                  <Select value={delimiter} onChange={e => setDelimiter(e.target.value)} options={delimOpts} />
                </Field>
              )}
            </div>
            <div
              className="rounded-lg border-2 border-dashed flex flex-col items-center justify-center gap-2 cursor-pointer py-8"
              style={{ borderColor: 'var(--border)', background: 'var(--muted-bg)' }}
              onClick={() => fileRef.current?.click()}
            >
              <span className="text-2xl">📂</span>
              <span className="text-sm font-semibold" style={{ color: 'var(--muted-fg)' }}>
                {file ? file.name : t.dialogs.importWizard.chooseFile}
              </span>
              {file && <span className="text-xs" style={{ color: 'var(--muted-fg)' }}>{rawRows.length || '—'} rows detected</span>}
            </div>
            <input ref={fileRef} type="file" accept=".csv,.json" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) { setFile(f); parseFile(f); } }} />
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-col gap-3">
            <p className="text-xs" style={{ color: 'var(--muted-fg)' }}>{t.dialogs.importWizard.columnMapping}</p>
            <div className="overflow-y-auto border rounded" style={{ borderColor: 'var(--border)', maxHeight: 240 }}>
              <table className="w-full">
                <thead>
                  <tr style={{ background: 'var(--muted-bg)' }}>
                    <th className="px-3 py-1.5 text-xs font-semibold text-start border-b" style={{ borderColor: 'var(--border)', color: 'var(--muted-fg)' }}>{t.dialogs.importWizard.sourceColumn}</th>
                    <th className="px-3 py-1.5 text-xs font-semibold text-start border-b" style={{ borderColor: 'var(--border)', color: 'var(--muted-fg)' }}>{t.dialogs.importWizard.targetField}</th>
                  </tr>
                </thead>
                <tbody>
                  {fileColumns.map(col => (
                    <tr key={col} style={{ background: 'var(--card-bg)' }}>
                      <td className="px-3 py-1.5 text-xs border-b" style={{ borderColor: 'var(--border)' }}>{col}</td>
                      <td className="px-3 py-1.5 border-b" style={{ borderColor: 'var(--border)' }}>
                        <select
                          value={mapping[col] ?? ''}
                          onChange={e => setMapping(m => ({ ...m, [col]: e.target.value }))}
                          className="w-full rounded border px-1.5 py-0.5 text-xs outline-none"
                          style={{ background: 'var(--card-bg)', borderColor: 'var(--border)', color: 'var(--fg)' }}
                        >
                          <option value="">{t.dialogs.importWizard.ignore}</option>
                          {targetFields[target].map(f2 => <option key={f2} value={f2}>{f2}</option>)}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="flex flex-col gap-3">
            <div className="flex gap-4">
              {[
                { label: t.dialogs.importWizard.validRows, value: validRows.length, color: '#15803d' },
                { label: t.dialogs.importWizard.errorRows, value: errorCount, color: '#dc2626' },
                { label: t.dialogs.importWizard.totalRows, value: rawRows.length, color: 'var(--muted-fg)' },
              ].map(s => (
                <div key={s.label} className="rounded p-3 flex-1" style={{ background: 'var(--secondary-bg)' }}>
                  <div className="text-xs" style={{ color: 'var(--muted-fg)' }}>{s.label}</div>
                  <div className="text-lg font-bold" style={{ color: s.color, fontFamily: 'var(--font-mono)' }}>{s.value}</div>
                </div>
              ))}
            </div>
            <div className="overflow-y-auto border rounded" style={{ borderColor: 'var(--border)', maxHeight: 180 }}>
              <table className="w-full">
                <thead>
                  <tr style={{ background: 'var(--muted-bg)' }}>
                    {Object.keys(validRows[0] ?? {}).slice(0, 5).map(k => (
                      <th key={k} className="px-2 py-1 text-xs font-semibold text-start border-b" style={{ borderColor: 'var(--border)', color: 'var(--muted-fg)' }}>{k}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {validRows.slice(0, 10).map((row, i) => (
                    <tr key={i} style={{ background: i % 2 === 0 ? 'var(--card-bg)' : 'var(--muted-bg)' }}>
                      {Object.keys(validRows[0] ?? {}).slice(0, 5).map(k => (
                        <td key={k} className="px-2 py-1 text-xs border-b truncate" style={{ borderColor: 'var(--border)' }}>{String(row[k] ?? '')}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="flex flex-col items-center justify-center gap-4 py-8">
            {importing ? (
              <>
                <div className="text-2xl">⏳</div>
                <p className="text-sm font-semibold">{t.dialogs.importWizard.importProgress}</p>
              </>
            ) : done ? (
              <>
                <div className="text-3xl">✅</div>
                <p className="text-sm font-semibold">{t.dialogs.importWizard.importDone.replace('{n}', String(importedCount))}</p>
                <Btn variant="primary" onClick={() => { reset(); onClose(); }}>Close</Btn>
              </>
            ) : null}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 mt-3 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
        <Btn onClick={() => setStep(s => Math.max(1, s - 1) as Step)} disabled={step === 1 || step === 4}>{t.actions.back}</Btn>
        <div className="flex items-center gap-2">
          <Btn onClick={() => { reset(); onClose(); }}>{t.actions.cancel}</Btn>
          {step === 1 && <Btn variant="primary" onClick={() => { if (file) parseFile(file); }} disabled={!file}>{t.actions.next}</Btn>}
          {step === 2 && <Btn variant="primary" onClick={buildRows}>{t.actions.next}</Btn>}
          {step === 3 && <Btn variant="primary" onClick={doImport} disabled={validRows.length === 0}>{t.dialogs.importWizard.step4}</Btn>}
        </div>
      </div>
    </InfoModal>
  );
}
