/**
 * Advanced search — full query-construction workspace redesign.
 *
 * Left: the query builder — match logic as a segmented control, numbered
 * condition rows (field / operator / value) with labelled remove buttons,
 * add-condition, a live SQL preview, save-search and send-to-Reports actions,
 * plus the saved-search library. Right: results with count pill, deliberate
 * empty/no-result states and the apply-to-view action. All engine behaviour
 * (runAdvancedSearch, SQL translation, saved-search persistence) is preserved.
 */
import React, { useEffect, useState } from 'react';
import { Modal } from './ui';
import { Btn, EmptyState, InlineTabs, Input, Select, Segmented, IconButton } from './ui';
import { DataTable, type Column } from './DataTable';
import {
  IconAdd, IconAllChecked, IconBookmark, IconChart, IconClose, IconDatabase,
  IconDelete, IconSave, IconSearch, IconSliders,
} from './icons';
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
  const a = t.dialogs.advancedSearch;
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

  const ops = a.operators as Record<string, string>;
  const operatorOpts = SEARCH_OPERATORS.map((op) => ({
    value: op.value,
    label: `${ops[op.value] ?? op.label}`,
  }));

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
    { id: 'search', label: a.conditions },
    { id: 'saved', label: `${a.savedSearches} (${saved.length})` },
  ];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={a.title} size="xl"
      footer={
        <>
          <span className="me-auto text-[11px] tnum" style={{ color: 'var(--muted-fg)', fontFamily: 'var(--font-mono)' }}>
            {results !== null ? `${results.length} ${t.messages.records}` : ''}
          </span>
          <Btn variant="ghost" onClick={onClose} icon={<IconClose size="xs" />}>{t.actions.close}</Btn>
        </>
      }
    >
      <div className="flex flex-col lg:flex-row gap-4">
        {/* ── Left: query builder ──────────────────────────────────── */}
        <div className="flex flex-col gap-3" style={{ width: 400, flexShrink: 0, maxHeight: 470 }}>
          <InlineTabs tabs={tabs} active={tab} onChange={setTab} />

          {tab === 'search' && (
            <>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-wide shrink-0" style={{ color: 'var(--muted-fg)', fontFamily: 'var(--font-display)' }}>
                  {a.logic}
                </span>
                <Segmented
                  value={logic}
                  onChange={(v) => setLogic(v as LogicMode)}
                  options={[
                    { value: 'AND', label: a.andShort },
                    { value: 'OR', label: a.orShort },
                  ]}
                />
              </div>

              <div className="flex flex-col gap-1.5 overflow-y-auto pe-1" style={{ maxHeight: 218 }} role="list" aria-label={a.conditions}>
                {conditions.map((cond, i) => (
                  <div key={cond.id} role="listitem" className="flex items-center gap-1 rounded-[var(--radius)] p-1.5" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                    <span
                      className="text-[9px] font-bold shrink-0 px-1.5 py-0.5 rounded-[var(--radius-sm)] tnum"
                      style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--muted-fg)', fontFamily: 'var(--font-mono)', minWidth: 28, textAlign: 'center' }}
                    >
                      {i === 0 ? a.ifLabel : logic === 'AND' ? a.andShort : a.orShort}
                    </span>
                    <select
                      value={cond.field}
                      onChange={(e) => updateCondition(cond.id, 'field', e.target.value)}
                      aria-label={`${a.field} ${i + 1}`}
                      className="flex-1 rounded-[var(--radius-sm)] px-1 py-0.5 text-xs outline-none"
                      style={{ background: 'var(--surface)', border: '1px solid var(--border-strong)', color: 'var(--fg)', minWidth: 0 }}
                    >
                      {fields.map((f) => (
                        <option key={f.value} value={f.value}>{f.label}</option>
                      ))}
                    </select>
                    <select
                      value={cond.operator}
                      onChange={(e) => updateCondition(cond.id, 'operator', e.target.value)}
                      aria-label={`${a.operator} ${i + 1}`}
                      className="rounded-[var(--radius-sm)] px-1 py-0.5 text-xs outline-none"
                      style={{ background: 'var(--surface)', border: '1px solid var(--border-strong)', color: 'var(--fg)', width: 112 }}
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
                        aria-label={`${a.value} ${i + 1}`}
                        className="rounded-[var(--radius-sm)] px-1.5 py-0.5 text-xs outline-none"
                        style={{ background: 'var(--surface)', border: '1px solid var(--border-strong)', color: 'var(--fg)', width: 66 }}
                      />
                    )}
                    <IconButton
                      label={a.removeCondition}
                      danger
                      onClick={() => removeCondition(cond.id)}
                    >
                      <IconClose size="xs" />
                    </IconButton>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <Btn size="xs" variant="subtle" onClick={addCondition} icon={<IconAdd size="xs" />}>{a.addCondition}</Btn>
                <div className="flex-1" />
                <Btn size="xs" variant="primary" onClick={runSearch} icon={<IconSearch size="xs" />}>{a.execute}</Btn>
              </div>

              {/* Query preview */}
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <IconDatabase size="xs" />
                  <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--muted-fg)', fontFamily: 'var(--font-display)' }}>
                    {a.queryPreview}
                  </span>
                </div>
                <div className="rounded-[var(--radius)] p-2 text-[11px] overflow-x-auto" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', fontFamily: 'var(--font-mono)', wordBreak: 'break-all', whiteSpace: 'pre-wrap' }}>
                  {statement}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Input value={saveName} onChange={(e) => setSaveName(e.target.value)} placeholder={a.searchName} />
                <Btn size="xs" variant="subtle" onClick={saveSearch} disabled={!saveName.trim()} icon={<IconSave size="xs" />}>
                  {a.saveSearch}
                </Btn>
              </div>
              {onSendToReports && (
                <Btn size="xs" variant="ghost" onClick={() => { onSendToReports(statement); onClose(); }} icon={<IconChart size="xs" />}>
                  {a.openInReports}
                </Btn>
              )}
            </>
          )}

          {tab === 'saved' && (
            <div className="flex flex-col gap-1.5 overflow-y-auto" style={{ maxHeight: 380 }}>
              {saved.length === 0 ? (
                <EmptyState variant="empty" title={a.noSaved} icon={<IconBookmark size="hero" />} compact />
              ) : (
                saved.map((ss) => (
                  <div
                    key={ss.id}
                    className="flex items-center gap-2 text-start px-3 py-2 rounded-[var(--radius)] transition-colors"
                    style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}
                  >
                    <span className="shrink-0 inline-flex" style={{ color: 'var(--primary)' }}><IconBookmark size="xs" /></span>
                    <button className="flex-1 text-start min-w-0 focus-visible:outline-none" onClick={() => loadSearch(ss)}>
                      <div className="font-semibold text-xs truncate">{ss.name}</div>
                      <div className="text-[10.5px] tnum" style={{ color: 'var(--muted-fg)', fontFamily: 'var(--font-mono)' }}>
                        {a.savedMeta.replace('{c}', String(ss.conditions.length)).replace('{l}', ss.logic)}
                        {' · '}{a.usesCount.replace('{n}', String(ss.uses))}
                        {' · '}{ss.createdAt.slice(0, 10)}
                      </div>
                    </button>
                    <IconButton label={a.removeSaved} danger onClick={() => deleteSearch(ss.id)}>
                      <IconDelete size="xs" />
                    </IconButton>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* ── Right: results ───────────────────────────────────────── */}
        <div className="flex-1 flex flex-col gap-2 overflow-hidden" style={{ minWidth: 0, maxHeight: 470 }}>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold flex items-center gap-1.5" style={{ color: 'var(--fg-soft)', fontFamily: 'var(--font-display)' }}>
              <IconSliders size="xs" />
              {a.results}
            </span>
            {results !== null && (
              <span className="inline-flex items-center px-2 py-px rounded-full text-[11px] font-semibold tnum" style={{ background: 'var(--primary-soft)', color: 'var(--primary)', fontFamily: 'var(--font-mono)' }}>
                {results.length}
              </span>
            )}
            {results !== null && (
              <span className="text-[11px] tnum" style={{ color: 'var(--muted-fg)', fontFamily: 'var(--font-mono)' }}>
                {timestamp().slice(11, 19)}
              </span>
            )}
            <div className="flex-1" />
            {results !== null && results.length > 0 && (
              <Btn variant="primary" onClick={applyResults} icon={<IconAllChecked size="xs" />}>
                {a.applyResults.replace('{n}', String(results.length))}
              </Btn>
            )}
          </div>
          <div className="flex-1 overflow-hidden rounded-[var(--radius)]" style={{ border: '1px solid var(--border)' }}>
            {results === null ? (
              <EmptyState variant="noResults" title={a.execute} description={a.resultsHint} icon={<IconSearch size="hero" />} compact />
            ) : results.length === 0 ? (
              <EmptyState variant="noResults" title={t.messages.noRecords} description={a.resultsHint} compact />
            ) : (
              <DataTable columns={resultColumns} data={results as (Record<string, unknown> & { id: string })[]} emptyText={t.messages.noRecords} />
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
