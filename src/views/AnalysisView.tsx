import React, { useMemo, useState } from 'react';
import { DataTable, type Column } from '../components/DataTable';
import { FormModal, ConfirmDialog } from '../components/FormModal';
import { Btn, Field, Input, Textarea, Select, Toolbar, ToolbarSep, SearchInput, DateInput, FilterRow, ResultsStrip, SelectionBar, FullTextPreview, PaginationBar, MoreMenu, Badge } from '../components/ui';
import { ExportDialog } from '../components/ExportDialog';
import { BulkOperations } from '../components/BulkOperations';
import { ComparisonDialog } from '../components/ComparisonDialog';
import { SummaryDialog } from '../components/SummaryDialog';
import { useAppData } from '../store/AppContext';
import { useSettings } from '../store/SettingsContext';
import { useTranslation } from '../i18n';
import { extractPeopleFromText, extractPlacesFromText, extractCoordinatesFromText } from '../data/sampleData';
import type { Analysis } from '../types';

const CLASSIFICATIONS = ['Security / Diplomacy','Political Analysis','Economic / Trade','Environmental Security','Geopolitics','Military','Social','Other'];

function emptyAnalysis(contentId = ''): Omit<Analysis, 'id' | 'date_creation' | 'date_modified'> {
  return { content_id: contentId, classification: 'Security / Diplomacy', list_names_people: '', list_names_places: '', list_coordinates: '', list_sides: '', date_analysis: new Date().toISOString().split('T')[0] };
}

export function AnalysisView({ onToast, initialContentId }: { onToast: (m: string) => void; initialContentId?: string }) {
  const { t } = useTranslation();
  const { settings } = useSettings();
  const { data, addAnalysis, updateAnalysis, deleteAnalysis, duplicateAnalysis, bulkDeleteAnalyses } = useAppData();

  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(settings.defaultPageSize);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [showBulkOps, setShowBulkOps] = useState(false);
  const [showCompare, setShowCompare] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [form, setForm] = useState(emptyAnalysis(initialContentId));
  const [errors, setErrors] = useState<Record<string, string>>({});

  const selected = data.analyses.find(a => a.id === selectedId) ?? null;
  const contentTitle = (id: string) => data.contents.find(c => c.id === id)?.title ?? id;
  const sourceName = (contentId: string) => {
    const c = data.contents.find(x => x.id === contentId);
    return c ? (data.sources.find(s => s.id === c.sources_id)?.name ?? '—') : '—';
  };

  const filtered = useMemo(() => {
    return data.analyses.filter(a => {
      const q = search.toLowerCase();
      if (q && ![a.classification, a.list_names_people, a.list_names_places, a.list_sides, contentTitle(a.content_id)].some(v => v.toLowerCase().includes(q))) return false;
      if (classFilter && a.classification !== classFilter) return false;
      if (dateFrom && a.date_analysis < dateFrom) return false;
      if (dateTo && a.date_analysis > dateTo) return false;
      return true;
    });
  }, [data.analyses, search, classFilter, dateFrom, dateTo]);

  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);

  const openAdd = () => {
    setForm(emptyAnalysis(initialContentId));
    setErrors({});
    setShowAdd(true);
  };

  const openEdit = () => {
    if (!selected) return;
    setForm({ ...selected });
    setErrors({});
    setShowEdit(true);
  };

  const autoExtract = () => {
    const content = data.contents.find(c => c.id === form.content_id);
    if (!content) return;
    const people = extractPeopleFromText(content.content_data).join(', ');
    const places = extractPlacesFromText(content.content_data).join(', ');
    const coords = extractCoordinatesFromText(content.content_data);
    setForm(f => ({ ...f, list_names_people: people, list_names_places: places, list_coordinates: coords }));
  };

  const validate = (f: typeof form) => {
    const errs: Record<string, string> = {};
    if (!f.content_id) errs.content_id = t.messages.required;
    if (!f.classification.trim()) errs.classification = t.messages.required;
    return errs;
  };

  const handleSave = () => {
    const errs = validate(form);
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    if (showAdd) addAnalysis(form);
    else updateAnalysis({ ...form, id: selectedId!, date_creation: selected!.date_creation, date_modified: '' });
    setShowAdd(false); setShowEdit(false);
    onToast(t.messages.saved);
  };

  const handleDelete = () => {
    if (!selectedId) return;
    deleteAnalysis(selectedId);
    setSelectedId(null);
    setShowDelete(false);
    onToast(t.messages.deleted);
  };

  const handleBulkDelete = (ids: string[]) => {
    bulkDeleteAnalyses(ids);
    setSelectedIds([]); setSelectedId(null);
    onToast(t.messages.bulkDeleted.replace('{n}', String(ids.length)));
  };

  const openMapView = () => {
    if (!selected?.list_coordinates) return;
    const coords = selected.list_coordinates.split(',').map(s => s.trim());
    if (coords.length >= 2) {
      window.open(`https://www.google.com/maps?q=${coords[0]},${coords[1]}`, '_blank');
    }
  };

  const classOpts = [{ value: '', label: '— All —' }, ...CLASSIFICATIONS.map(c => ({ value: c, label: c }))];
  const classFormOpts = CLASSIFICATIONS.map(c => ({ value: c, label: c }));
  const contentOpts = data.contents.map(c => ({ value: c.id, label: c.title }));

  const columns: Column<Analysis>[] = [
    { key: 'content_id', header: t.fields.content_id, width: '22%', sortable: true,
      render: a => <span className="truncate">{contentTitle(a.content_id)}</span> },
    { key: 'classification', header: t.fields.classification, width: '140px', sortable: true,
      render: a => <Badge color="#1d4ed8">{a.classification}</Badge> },
    { key: 'list_names_people', header: t.fields.list_names_people, width: '18%',
      render: a => <span className="text-xs truncate block">{a.list_names_people || '—'}</span> },
    { key: 'list_names_places', header: t.fields.list_names_places, width: '16%',
      render: a => <span className="text-xs truncate block">{a.list_names_places || '—'}</span> },
    { key: 'list_sides', header: t.fields.list_sides, width: '16%',
      render: a => <span className="text-xs truncate block">{a.list_sides || '—'}</span> },
    { key: 'date_analysis', header: t.fields.date_analysis, width: '90px', sortable: true,
      render: a => <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8em' }}>{a.date_analysis || '—'}</span> },
  ];

  const exportColumns = [
    { key: 'id', label: 'ID' }, { key: 'content_id', label: t.fields.content_id },
    { key: 'classification', label: t.fields.classification },
    { key: 'list_names_people', label: t.fields.list_names_people },
    { key: 'list_names_places', label: t.fields.list_names_places },
    { key: 'list_coordinates', label: t.fields.list_coordinates },
    { key: 'list_sides', label: t.fields.list_sides },
    { key: 'date_analysis', label: t.fields.date_analysis },
  ];

  const moreItems = [
    { label: t.actions.viewOnMap, icon: '🗺', onClick: openMapView, disabled: !selected?.list_coordinates },
    { label: 'Compare', icon: '⇆', onClick: () => { if (filtered.length < 2) { onToast('Need at least 2 records to compare.'); return; } setShowCompare(true); } },
    { label: 'Summary', icon: '∑', onClick: () => { if (!filtered.length) { onToast('No records to summarize.'); return; } setShowSummary(true); } },
    { label: t.actions.bulkOperations, icon: '⚙', onClick: () => setShowBulkOps(true), disabled: selectedIds.length === 0 },
  ];

  const FormContent = () => (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4">
        <Field label={t.fields.content_id} required error={errors.content_id}>
          <Select value={form.content_id} onChange={e => setForm(f => ({ ...f, content_id: e.target.value }))} options={contentOpts} placeholder="Select content..." />
        </Field>
        <Field label={t.fields.classification} required error={errors.classification}>
          <Select value={form.classification} onChange={e => setForm(f => ({ ...f, classification: e.target.value }))} options={classFormOpts} />
        </Field>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--muted-fg)' }}>Entity extraction</span>
        <Btn size="xs" onClick={autoExtract} disabled={!form.content_id} icon="⚡">{t.actions.extract}</Btn>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field label={t.fields.list_names_people} hint="Comma-separated names">
          <Textarea value={form.list_names_people} onChange={e => setForm(f => ({ ...f, list_names_people: e.target.value }))} rows={3} />
        </Field>
        <Field label={t.fields.list_names_places} hint="Comma-separated places">
          <Textarea value={form.list_names_places} onChange={e => setForm(f => ({ ...f, list_names_places: e.target.value }))} rows={3} />
        </Field>
        <Field label={t.fields.list_coordinates} hint="lat, lon">
          <Input value={form.list_coordinates} onChange={e => setForm(f => ({ ...f, list_coordinates: e.target.value }))} placeholder="e.g. 39.92, 32.85" />
        </Field>
        <Field label={t.fields.list_sides} hint="Semicolon-separated">
          <Input value={form.list_sides} onChange={e => setForm(f => ({ ...f, list_sides: e.target.value }))} />
        </Field>
      </div>
      <p className="text-xs" style={{ color: 'var(--muted-fg)' }}>
        Analysis date is set automatically when the record is created.
      </p>
    </div>
  );

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <FilterRow>
        <SearchInput value={search} onChange={v => { setSearch(v); setPage(1); }} placeholder={t.messages.searchPlaceholder} />
        <Select value={classFilter} onChange={e => { setClassFilter(e.target.value); setPage(1); }} options={classOpts} className="!w-44" />
        <DateInput label={t.messages.dateFrom} value={dateFrom} onChange={v => { setDateFrom(v); setPage(1); }} />
        <DateInput label={t.messages.dateTo} value={dateTo} onChange={v => { setDateTo(v); setPage(1); }} />
        <Btn size="xs" onClick={() => { setSearch(''); setClassFilter(''); setDateFrom(''); setDateTo(''); setPage(1); }} variant="ghost">{t.actions.clearFilters}</Btn>
      </FilterRow>

      <Toolbar>
        <Btn variant="success" onClick={openAdd} icon="＋">{t.sections.analysis.add}</Btn>
        <Btn onClick={openEdit} disabled={!selected}>{t.actions.edit}</Btn>
        <Btn variant="danger" onClick={() => setShowDelete(true)} disabled={!selected}>{t.actions.delete}</Btn>
        <Btn onClick={() => { if (selectedId) duplicateAnalysis(selectedId); }} disabled={!selected} icon="⎘">{t.actions.duplicate}</Btn>
        <ToolbarSep />
        <Btn onClick={openMapView} disabled={!selected?.list_coordinates} icon="🗺">{t.actions.mapView}</Btn>
        <ToolbarSep />
        <Btn onClick={() => setShowExport(true)} icon="⬇">{t.actions.export}</Btn>
        <div className="flex-1" />
        <MoreMenu items={moreItems} />
      </Toolbar>

      <ResultsStrip total={data.analyses.length} filtered={filtered.length} selected={selectedIds.length} recordsLabel={t.messages.records} totalLabel={t.messages.total} selectedLabel={t.messages.selected} />

      <div className="flex-1 overflow-hidden">
        <DataTable columns={columns} data={paged} selectedId={selectedId ?? undefined} selectedIds={selectedIds}
          onSelect={r => setSelectedId(r?.id ?? null)}
          onSelectionChange={ids => { setSelectedIds(ids); if (ids.length === 1) setSelectedId(ids[0]); }}
          onDoubleClick={() => openEdit()} emptyText={t.sections.analysis.noData}
          rowNumberOffset={(page - 1) * pageSize} density={settings.density === 'compact' ? 'compact' : 'comfortable'} />
      </div>

      {selectedIds.length > 0 && <SelectionBar count={selectedIds.length} onClear={() => setSelectedIds([])} onBulkDelete={() => setShowBulkOps(true)} label={t.messages.selected} />}
      <FullTextPreview record={selected} recordType={selected ? 'analysis' : null} sources={data.sources} contents={data.contents} />
      <PaginationBar total={filtered.length} page={page} pageSize={pageSize} onPage={p => setPage(p)} onPageSize={s => { setPageSize(s); setPage(1); }} perPageLabel={t.messages.perPage} pageLabel={t.messages.page} ofLabel={t.messages.of} showingLabel={t.messages.showing} />

      <FormModal isOpen={showAdd} title={t.sections.analysis.add} onClose={() => setShowAdd(false)} onSave={handleSave} saveLabel={t.actions.save} size="lg"><FormContent /></FormModal>
      <FormModal isOpen={showEdit} title={t.sections.analysis.edit} onClose={() => setShowEdit(false)} onSave={handleSave} saveLabel={t.actions.save} size="lg"><FormContent /></FormModal>
      <ConfirmDialog isOpen={showDelete} title={t.actions.delete} message={t.messages.confirmDelete} onConfirm={handleDelete} onCancel={() => setShowDelete(false)} danger />
      <ExportDialog isOpen={showExport} onClose={() => setShowExport(false)} data={filtered as unknown as Record<string, unknown>[]} columns={exportColumns} defaultFilename="analysis" />
      <BulkOperations isOpen={showBulkOps} onClose={() => setShowBulkOps(false)} selectedIds={selectedIds} data={data.analyses.map(a => ({ id: a.id, label: a.classification }))} onBulkDelete={handleBulkDelete} />
      <ComparisonDialog isOpen={showCompare} onClose={() => setShowCompare(false)} analyses={filtered} contentTitle={contentTitle} />
      <SummaryDialog isOpen={showSummary} onClose={() => setShowSummary(false)} analyses={filtered} />
    </div>
  );
}
