import React, { useState } from 'react';
import { InfoModal } from './FormModal';
import { Btn, Field, Input, Select, InlineTabs } from './ui';
import { DataTable, type Column } from './DataTable';
import { useTranslation } from '../i18n';
import { generateId } from '../data/sampleData';
import type { RecordType, SearchCondition, SavedSearch } from '../types';

interface AdvancedSearchProps {
  isOpen: boolean;
  onClose: () => void;
  fields: { value: string; label: string }[];
  data: Record<string, unknown>[];
  onApply: (results: Record<string, unknown>[]) => void;
  target?: RecordType | 'all';
  savedSearches?: SavedSearch[];
  onSaveSavedSearch?: (s: SavedSearch) => void;
}

type LogicMode = 'AND' | 'OR';

const OPERATORS = ['contains','not_contains','equals','not_equals','starts_with','ends_with','gt','lt','gte','lte','is_empty','is_not_empty'];

export function AdvancedSearch({ isOpen, onClose, fields, data, onApply, savedSearches = [], onSaveSavedSearch }: AdvancedSearchProps) {
  const { t } = useTranslation();
  const [conditions, setConditions] = useState<SearchCondition[]>([{ id: generateId('cond'), field: fields[0]?.value ?? '', operator: 'contains', value: '' }]);
  const [logic, setLogic] = useState<LogicMode>('AND');
  const [results, setResults] = useState<Record<string, unknown>[] | null>(null);
  const [tab, setTab] = useState('search');
  const [saveName, setSaveName] = useState('');

  const ops = useTranslation().t.dialogs.advancedSearch.operators;

  const operatorOpts = OPERATORS.map(op => ({ value: op, label: (ops as Record<string, string>)[op] ?? op }));
  const logicOpts = [
    { value: 'AND', label: t.dialogs.advancedSearch.and },
    { value: 'OR', label: t.dialogs.advancedSearch.or },
  ];

  const addCondition = () =>
    setConditions(c => [...c, { id: generateId('cond'), field: fields[0]?.value ?? '', operator: 'contains', value: '' }]);

  const removeCondition = (id: string) =>
    setConditions(c => c.filter(x => x.id !== id));

  const updateCondition = (id: string, key: keyof SearchCondition, val: string) =>
    setConditions(c => c.map(x => x.id === id ? { ...x, [key]: val } : x));

  const matchRecord = (record: Record<string, unknown>, cond: SearchCondition): boolean => {
    const val = String(record[cond.field] ?? '').toLowerCase();
    const cv = cond.value.toLowerCase();
    switch (cond.operator) {
      case 'contains': return val.includes(cv);
      case 'not_contains': return !val.includes(cv);
      case 'equals': return val === cv;
      case 'not_equals': return val !== cv;
      case 'starts_with': return val.startsWith(cv);
      case 'ends_with': return val.endsWith(cv);
      case 'gt': return parseFloat(val) > parseFloat(cv);
      case 'lt': return parseFloat(val) < parseFloat(cv);
      case 'gte': return parseFloat(val) >= parseFloat(cv);
      case 'lte': return parseFloat(val) <= parseFloat(cv);
      case 'is_empty': return val === '';
      case 'is_not_empty': return val !== '';
      default: return true;
    }
  };

  const runSearch = () => {
    const filtered = data.filter(record => {
      const matches = conditions.map(cond => matchRecord(record, cond));
      return logic === 'AND' ? matches.every(Boolean) : matches.some(Boolean);
    });
    setResults(filtered);
  };

  const applyResults = () => {
    if (results) { onApply(results); onClose(); }
  };

  const saveSearch = () => {
    if (!saveName) return;
    const s: SavedSearch = {
      id: generateId('ss'),
      name: saveName,
      conditions,
      logic,
      target: 'all',
      date_creation: new Date().toISOString(),
    };
    onSaveSavedSearch?.(s);
    setSaveName('');
  };

  const resultColumns: Column<Record<string, unknown>>[] = fields.slice(0, 4).map(f => ({
    key: f.value,
    header: f.label,
    sortable: true,
    render: (row) => <span className="truncate">{String(row[f.value] ?? '—')}</span>,
  }));

  const tabs = [
    { id: 'search', label: t.dialogs.advancedSearch.conditions },
    { id: 'saved', label: t.dialogs.advancedSearch.savedSearches },
  ];

  return (
    <InfoModal isOpen={isOpen} title={t.dialogs.advancedSearch.title} onClose={onClose} size="lg">
      <div className="flex gap-4" style={{ minHeight: 420 }}>
        {/* Left: conditions */}
        <div className="flex flex-col gap-3" style={{ width: 360, shrink: 0 } as React.CSSProperties}>
          <InlineTabs tabs={tabs} active={tab} onChange={setTab} />

          {tab === 'search' && (
            <>
              <Field label={t.dialogs.advancedSearch.logic}>
                <Select value={logic} onChange={e => setLogic(e.target.value as LogicMode)} options={logicOpts} />
              </Field>
              <div className="flex flex-col gap-2 overflow-y-auto" style={{ maxHeight: 200 }}>
                {conditions.map((cond, i) => (
                  <div key={cond.id} className="flex items-center gap-1 rounded p-2" style={{ background: 'var(--muted-bg)', border: '1px solid var(--border)' }}>
                    <span className="text-xs shrink-0" style={{ color: 'var(--muted-fg)', minWidth: 24 }}>
                      {i === 0 ? 'IF' : logic}
                    </span>
                    <select
                      value={cond.field}
                      onChange={e => updateCondition(cond.id, 'field', e.target.value)}
                      className="flex-1 rounded border px-1 py-0.5 text-xs outline-none"
                      style={{ background: 'var(--card-bg)', borderColor: 'var(--border)', color: 'var(--fg)', minWidth: 0 }}
                    >
                      {fields.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                    </select>
                    <select
                      value={cond.operator}
                      onChange={e => updateCondition(cond.id, 'operator', e.target.value)}
                      className="rounded border px-1 py-0.5 text-xs outline-none"
                      style={{ background: 'var(--card-bg)', borderColor: 'var(--border)', color: 'var(--fg)', width: 90 }}
                    >
                      {operatorOpts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                    {!['is_empty', 'is_not_empty'].includes(cond.operator) && (
                      <input
                        value={cond.value}
                        onChange={e => updateCondition(cond.id, 'value', e.target.value)}
                        className="rounded border px-1.5 py-0.5 text-xs outline-none"
                        style={{ background: 'var(--card-bg)', borderColor: 'var(--border)', color: 'var(--fg)', width: 70 }}
                      />
                    )}
                    <button onClick={() => removeCondition(cond.id)} className="text-xs shrink-0" style={{ color: '#ef4444' }}>✕</button>
                  </div>
                ))}
              </div>
              <Btn size="xs" onClick={addCondition}>+ {t.dialogs.advancedSearch.addCondition}</Btn>
              <div className="flex items-center gap-2 mt-1">
                <Input value={saveName} onChange={e => setSaveName(e.target.value)} placeholder={t.dialogs.advancedSearch.searchName} />
                <Btn size="xs" onClick={saveSearch} disabled={!saveName}>{t.dialogs.advancedSearch.saveSearch}</Btn>
              </div>
            </>
          )}

          {tab === 'saved' && (
            <div className="flex flex-col gap-1">
              {savedSearches.length === 0
                ? <p className="text-xs py-4 text-center" style={{ color: 'var(--muted-fg)' }}>{t.dialogs.advancedSearch.noSaved}</p>
                : savedSearches.map(ss => (
                  <button key={ss.id} onClick={() => { setConditions(ss.conditions); setLogic(ss.logic); setTab('search'); }}
                    className="text-start px-3 py-2 rounded text-xs hover:bg-[var(--secondary-bg)] transition-colors"
                    style={{ background: 'var(--muted-bg)', border: '1px solid var(--border)' }}>
                    <div className="font-semibold">{ss.name}</div>
                    <div style={{ color: 'var(--muted-fg)' }}>{ss.conditions.length} conditions · {ss.logic}</div>
                  </button>
                ))
              }
            </div>
          )}
        </div>

        {/* Right: results */}
        <div className="flex-1 flex flex-col gap-2 overflow-hidden">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold" style={{ color: 'var(--muted-fg)' }}>
              {t.dialogs.advancedSearch.results}
              {results !== null && ` — ${results.length} ${t.messages.records}`}
            </span>
            <div className="flex-1" />
            <Btn variant="primary" onClick={runSearch}>{t.dialogs.advancedSearch.execute}</Btn>
          </div>
          <div className="flex-1 overflow-hidden border rounded" style={{ borderColor: 'var(--border)' }}>
            {results === null ? (
              <div className="flex items-center justify-center h-full text-xs" style={{ color: 'var(--muted-fg)' }}>
                Configure conditions and click "{t.dialogs.advancedSearch.execute}"
              </div>
            ) : (
              <DataTable columns={resultColumns} data={results as (Record<string, unknown> & { id: string })[]} emptyText={t.messages.noRecords} />
            )}
          </div>
          {results !== null && results.length > 0 && (
            <Btn variant="primary" onClick={applyResults}>Apply {results.length} results to view</Btn>
          )}
        </div>
      </div>
    </InfoModal>
  );
}
