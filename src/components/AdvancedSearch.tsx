/**
 * Advanced search built on the core search engine. Conditions are evaluated by
 * `runAdvancedSearch`, the same condition set can be translated to SQL for the
 * Reports workspace, and saved searches persist through the workspace store.
 */
import React, { useEffect, useState } from 'react';
import { InfoModal } from './FormModal';
import { Btn, Field, Input, Select, InlineTabs } from './ui';
import { DataTable, type Column } from './DataTable';
import { useTranslation } from '../i18n';
import { useAppData } from '../store/AppContext';
import { conditionsToSql, runAdvancedSearch, SEARCH_OPERATORS, type SavedSearch, type SearchCondition, type SearchOperator } from '../core/search';
import { id, timestamp } from '../core/text';

interface AdvancedSearchProps {
  isOpen: boolean;
  onClose: () => void;
  fields: { value: string; label: string }[];
  data: Record<string, unknown>[];
  onApply: (results: Record<string, unknown>[]) => void;
  /** Entity these conditions belong to, used to scope saved searches. */
  target?: string;
  /** Called with the generated SQL so a view can hand it to Reports. */
  onSendToReports?: (sql: string) => void;
}

type LogicMode = 'AND' | 'OR';

const NO_VALUE = new Set<SearchOperator>(['is_empty', 'is_not_empty']);

export function AdvancedSearch({ isOpen, onClose, fields, data, onApply, target = 'all', onSendToReports }: AdvancedSearchProps) {
  const { t } = useTranslation();
  const { searches } = useAppData();

  const [conditions, setConditions] = useState<SearchCondition[]>([
    { id: id('cond'), field: fields[0]?.value ?? '', operator: 'contains', value: '' },
  ]);
  const [logic, setLogic] = useState<LogicMode>('AND');
  const [results, setResults] = useState<Record<string, unknown>[] | null>(null);
  const [tab, setTab] = useState('search');
  const [saveName, setSaveName] = useState('');
  const [saved, setSaved] = useState<SavedSearch[]>([]);

  useEffect(() => {
    if (isOpen) setSaved(searches.list(target));
  }, [isOpen, searches, target]);

  const ops = t.dialogs.advancedSearch.operators as Record<string, string>;
  const operatorOpts = SEARCH_OPERATORS.map((op) => ({
    value: op.value,
    label: `${ops[op.value] ?? op.label}`,
  }));
  const logicOpts = [
    { value: 'AND', label: t.dialogs.advancedSearch.and },
    { value: 'OR', label: t.dialogs.advancedSearch.or },
  ];

  const addCondition = () =>
    setConditions((c) => [...c, { id: id('cond'), field: fields[0]?.value ?? '', operator: 'contains', value: '' }]);

  const removeCondition = (idToRemove: string) => setConditions((c) => c.filter((x) => x.id !== idToRemove));

  const updateCondition = (conditionId: string, key: keyof SearchCondition, val: string) =>
    setConditions((c) => c.map((x) => (x.id === conditionId ? { ...x, [key]: val } : x)));

  const whereClause = conditionsToSql(
    conditions.filter((c) => c.field && c.operator),
    logic,
  );
  const statement = `SELECT * FROM ${target === 'all' ? 'sources' : target}${whereClause ? ` WHERE ${whereClause}` : ''}`;

  const runSearch = () => {
    const filtered = runAdvancedSearch(data, conditions, logic);
    setResults(filtered);
    const active = conditions.find((c) => c.field && c.operator);
    if (active) {
      const match = saved.find((s) => s.name === saveName.trim() && saveName.trim());
      if (match) searches.touch(match.id);
    }
  };

  const applyResults = () => {
    if (!results) return;
    onApply(results);
    onClose();
  };

  const saveSearch = () => {
    const name = saveName.trim();
    if (!name) return;
    searches.save({ id: id('ss'), name, entity: target, conditions, logic });
    setSaved(searches.list(target));
    setSaveName('');
  };

  const loadSearch = (ss: SavedSearch) => {
    setConditions(ss.conditions.length ? ss.conditions : [{ id: id('cond'), field: fields[0]?.value ?? '', operator: 'contains', value: '' }]);
    setLogic(ss.logic);
    setSaveName(ss.name);
    setTab('search');
    searches.touch(ss.id);
    setSaved(searches.list(target));
  };

  const deleteSearch = (ssId: string) => {
    searches.remove(ssId);
    setSaved(searches.list(target));
  };

  const resultColumns: Column<Record<string, unknown>>[] = fields.slice(0, 4).map((f) => ({
    key: f.value,
    header: f.label,
    sortable: true,
    render: (row) => <span className="truncate">{String(row[f.value] ?? '—')}</span>,
  }));

  const tabs = [
    { id: 'search', label: t.dialogs.advancedSearch.conditions },
    { id: 'saved', label: `${t.dialogs.advancedSearch.savedSearches} (${saved.length})` },
  ];

  return (
    <InfoModal isOpen={isOpen} title={t.dialogs.advancedSearch.title} onClose={onClose} size="lg">
      <div className="flex gap-4" style={{ minHeight: 420 }}>
        {/* Left: conditions */}
        <div className="flex flex-col gap-3" style={{ width: 380, shrink: 0 } as React.CSSProperties}>
          <InlineTabs tabs={tabs} active={tab} onChange={setTab} />

          {tab === 'search' && (
            <>
              <Field label={t.dialogs.advancedSearch.logic}>
                <Select value={logic} onChange={(e) => setLogic(e.target.value as LogicMode)} options={logicOpts} />
              </Field>
              <div className="flex flex-col gap-2 overflow-y-auto" style={{ maxHeight: 200 }}>
                {conditions.map((cond, i) => (
                  <div key={cond.id} className="flex items-center gap-1 rounded p-2" style={{ background: 'var(--muted-bg)', border: '1px solid var(--border)' }}>
                    <span className="text-xs shrink-0" style={{ color: 'var(--muted-fg)', minWidth: 24 }}>
                      {i === 0 ? 'IF' : logic}
                    </span>
                    <select
                      value={cond.field}
                      onChange={(e) => updateCondition(cond.id, 'field', e.target.value)}
                      className="flex-1 rounded border px-1 py-0.5 text-xs outline-none"
                      style={{ background: 'var(--card-bg)', borderColor: 'var(--border)', color: 'var(--fg)', minWidth: 0 }}
                    >
                      {fields.map((f) => (
                        <option key={f.value} value={f.value}>{f.label}</option>
                      ))}
                    </select>
                    <select
                      value={cond.operator}
                      onChange={(e) => updateCondition(cond.id, 'operator', e.target.value)}
                      className="rounded border px-1 py-0.5 text-xs outline-none"
                      style={{ background: 'var(--card-bg)', borderColor: 'var(--border)', color: 'var(--fg)', width: 118 }}
                    >
                      {operatorOpts.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                    {!NO_VALUE.has(cond.operator) && (
                      <input
                        value={cond.value}
                        onChange={(e) => updateCondition(cond.id, 'value', e.target.value)}
                        placeholder={cond.operator === 'between' ? 'a, b' : ''}
                        className="rounded border px-1.5 py-0.5 text-xs outline-none"
                        style={{ background: 'var(--card-bg)', borderColor: 'var(--border)', color: 'var(--fg)', width: 70 }}
                      />
                    )}
                    <button onClick={() => removeCondition(cond.id)} className="text-xs shrink-0" style={{ color: '#ef4444' }}>
                      ✕
                    </button>
                  </div>
                ))}
              </div>
              <Btn size="xs" onClick={addCondition}>+ {t.dialogs.advancedSearch.addCondition}</Btn>

              <div className="rounded p-2 text-[11px]" style={{ background: 'var(--secondary-bg)', fontFamily: 'var(--font-mono)', wordBreak: 'break-all' }}>
                {statement}
              </div>

              <div className="flex items-center gap-2 mt-1">
                <Input value={saveName} onChange={(e) => setSaveName(e.target.value)} placeholder={t.dialogs.advancedSearch.searchName} />
                <Btn size="xs" onClick={saveSearch} disabled={!saveName.trim()}>
                  {t.dialogs.advancedSearch.saveSearch}
                </Btn>
              </div>
              {onSendToReports && (
                <Btn size="xs" variant="ghost" onClick={() => { onSendToReports(statement); onClose(); }}>
                  Open in Reports
                </Btn>
              )}
            </>
          )}

          {tab === 'saved' && (
            <div className="flex flex-col gap-1 overflow-y-auto">
              {saved.length === 0 ? (
                <p className="text-xs py-4 text-center" style={{ color: 'var(--muted-fg)' }}>
                  {t.dialogs.advancedSearch.noSaved}
                </p>
              ) : (
                saved.map((ss) => (
                  <div
                    key={ss.id}
                    className="flex items-center gap-2 text-start px-3 py-2 rounded text-xs hover:bg-[var(--secondary-bg)] transition-colors"
                    style={{ background: 'var(--muted-bg)', border: '1px solid var(--border)' }}
                  >
                    <button className="flex-1 text-start" onClick={() => loadSearch(ss)}>
                      <div className="font-semibold">{ss.name}</div>
                      <div style={{ color: 'var(--muted-fg)' }}>
                        {ss.conditions.length} conditions · {ss.logic} · used {ss.uses}× · {ss.createdAt.slice(0, 10)}
                      </div>
                    </button>
                    <Btn size="xs" variant="ghost" onClick={() => deleteSearch(ss.id)}>
                      ✕
                    </Btn>
                  </div>
                ))
              )}
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
            <span className="text-[11px]" style={{ color: 'var(--muted-fg)', fontFamily: 'var(--font-mono)' }}>
              {results !== null ? timestamp().slice(11, 19) : ''}
            </span>
            <div className="flex-1" />
            <Btn variant="primary" onClick={runSearch}>{t.dialogs.advancedSearch.execute}</Btn>
          </div>
          <div className="flex-1 overflow-hidden border rounded" style={{ borderColor: 'var(--border)' }}>
            {results === null ? (
              <div className="flex items-center justify-center h-full text-xs" style={{ color: 'var(--muted-fg)' }}>
                Configure conditions and click &quot;{t.dialogs.advancedSearch.execute}&quot;
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
