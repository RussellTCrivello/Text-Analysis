import React, { useMemo, useState } from 'react';
import { DataTable, type Column } from '../components/DataTable';
import { FormModal, ConfirmDialog } from '../components/FormModal';
import { Btn, Field, Input, Textarea, Select, Toolbar, ToolbarSep, SearchInput, DateInput, FilterRow, ResultsStrip, SelectionBar, FullTextPreview, PaginationBar, ImportanceBar, MoreMenu, Badge } from '../components/ui';
import { ExportDialog } from '../components/ExportDialog';
import { BulkOperations } from '../components/BulkOperations';
import { ContentPreviewDialog } from '../components/ContentPreviewDialog';
import { useAppData } from '../store/AppContext';
import { useSettings } from '../store/SettingsContext';
import { useTranslation } from '../i18n';
import type { Content } from '../types';

function emptyContent(sourceId = ''): Omit<Content, 'id' | 'date_creation' | 'date_modified'> {
  return { sources_id: sourceId, title: '', content_data: '', attachments: '', note: '', importance: 0.70, date_content: new Date().toISOString().split('T')[0] };
}

export function ContentsView({ onToast, onLinkToAnalysis }: { onToast: (m: string) => void; onLinkToAnalysis?: (contentId: string) => void }) {
  const { t } = useTranslation();
  const { settings } = useSettings();
  const { data, addContent, updateContent, deleteContent, duplicateContent, bulkDeleteContents } = useAppData();

  const [search, setSearch] = useState('');
  const [srcFilter, setSrcFilter] = useState('');
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
  const [showPreview, setShowPreview] = useState(false);
  const [form, setForm] = useState(emptyContent());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [importancePct, setImportancePct] = useState('70.00');

  const selected = data.contents.find(c => c.id === selectedId) ?? null;
  const sourceName = (id: string) => data.sources.find(s => s.id === id)?.name ?? id;

  const filtered = useMemo(() => {
    return data.contents.filter(c => {
      const q = search.toLowerCase();
      if (q && ![c.title, c.content_data, c.note, sourceName(c.sources_id)].some(v => v.toLowerCase().includes(q))) return false;
      if (srcFilter && c.sources_id !== srcFilter) return false;
      if (dateFrom && c.date_content < dateFrom) return false;
      if (dateTo && c.date_content > dateTo) return false;
      return true;
    });
  }, [data.contents, search, srcFilter, dateFrom, dateTo]);

  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);

  const openAdd = () => { setForm(emptyContent()); setImportancePct('70.00'); setErrors({}); setShowAdd(true); };
  const openEdit = () => {
    if (!selected) return;
    setForm({ ...selected });
    setImportancePct((selected.importance * 100).toFixed(2));
    setErrors({});
    setShowEdit(true);
  };

  const validate = (f: typeof form): Record<string, string> => {
    const errs: Record<string, string> = {};
    if (!f.title.trim()) errs.title = t.messages.required;
    if (!f.sources_id) errs.sources_id = t.messages.required;
    const imp = parseFloat(importancePct);
    if (isNaN(imp) || imp < 0 || imp > 100) errs.importance = t.messages.importanceRange;
    return errs;
  };

  const handleSave = () => {
    const imp = parseFloat(importancePct) / 100;
    const payload = { ...form, importance: imp };
    const errs = validate(payload);
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    if (showAdd) addContent(payload);
    else updateContent({ ...payload, id: selectedId!, date_creation: selected!.date_creation, date_modified: '' });
    setShowAdd(false); setShowEdit(false);
    onToast(t.messages.saved);
  };

  const handleDelete = () => {
    if (!selectedId) return;
    deleteContent(selectedId);
    setSelectedId(null);
    setShowDelete(false);
    onToast(t.messages.deleted);
  };

  const handleBulkDelete = (ids: string[]) => {
    bulkDeleteContents(ids);
    setSelectedIds([]); setSelectedId(null);
    onToast(t.messages.bulkDeleted.replace('{n}', String(ids.length)));
  };

  const srcOpts = [
    { value: '', label: '— All sources —' },
    ...data.sources.map(s => ({ value: s.id, label: s.name })),
  ];
  const srcFormOpts = data.sources.map(s => ({ value: s.id, label: s.name }));

  const columns: Column<Content>[] = [
    { key: 'title', header: t.fields.title, width: '26%', sortable: true },
    { key: 'sources_id', header: t.fields.sources_id, width: '16%', sortable: true,
      render: c => <span className="truncate">{sourceName(c.sources_id)}</span> },
    { key: 'content_data', header: t.fields.content_data,
      render: c => <span className="text-xs truncate block" style={{ color: 'var(--muted-fg)' }}>{c.content_data?.slice(0, 80)}</span> },
    { key: 'importance', header: t.fields.importance, width: '110px', sortable: true,
      render: c => <ImportanceBar value={c.importance} /> },
    { key: 'attachments', header: t.fields.attachments, width: '80px',
      render: c => c.attachments ? <Badge>📎 {c.attachments.split(',').length}</Badge> : <span>—</span> },
    { key: 'date_content', header: t.fields.date_content, width: '90px', sortable: true,
      render: c => <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8em' }}>{c.date_content || '—'}</span> },
  ];

  const exportColumns = [
    { key: 'id', label: 'ID' }, { key: 'title', label: t.fields.title },
    { key: 'sources_id', label: t.fields.sources_id }, { key: 'content_data', label: t.fields.content_data },
    { key: 'importance', label: t.fields.importance }, { key: 'date_content', label: t.fields.date_content },
  ];

  const moreItems = [
    { label: 'Preview Content', icon: '👁', onClick: () => { if (!selected) return; setShowPreview(true); }, disabled: !selected },
    { label: t.actions.bulkOperations, icon: '⚙', onClick: () => setShowBulkOps(true), disabled: selectedIds.length === 0 },
    { divider: true, label: '', onClick: () => {} },
    { label: t.actions.linkToAnalysis, icon: '🔗', onClick: () => { if (selectedId) onLinkToAnalysis?.(selectedId); }, disabled: !selectedId },
  ];

  const FormContent = () => (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2"><Field label={t.fields.title} required error={errors.title}>
          <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} error={!!errors.title} />
        </Field></div>
        <Field label={t.fields.sources_id} required error={errors.sources_id}>
          <Select value={form.sources_id} onChange={e => setForm(f => ({ ...f, sources_id: e.target.value }))} options={srcFormOpts} placeholder="Select source..." />
        </Field>
        <Field label={`${t.fields.importance} (0–100%)`} required error={errors.importance}>
          <div className="flex items-center gap-2">
            <Input type="number" min={0} max={100} step={0.01} value={importancePct} onChange={e => setImportancePct(e.target.value)} className="w-24" error={!!errors.importance} />
            <span className="text-xs" style={{ color: 'var(--muted-fg)' }}>%</span>
            <ImportanceBar value={parseFloat(importancePct) / 100 || 0} />
          </div>
        </Field>
        <Field label={t.fields.date_content} required>
          <Input type="date" value={form.date_content} onChange={e => setForm(f => ({ ...f, date_content: e.target.value }))} />
        </Field>
        <Field label={t.fields.attachments} hint="Comma-separated filenames">
          <Input value={form.attachments} onChange={e => setForm(f => ({ ...f, attachments: e.target.value }))} placeholder="file1.pdf, file2.docx" />
        </Field>
      </div>
      <Field label={t.fields.content_data} required>
        <Textarea value={form.content_data} onChange={e => setForm(f => ({ ...f, content_data: e.target.value }))} rows={5} />
      </Field>
      <Field label={t.fields.note}>
        <Textarea value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} rows={2} />
      </Field>
    </div>
  );

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <FilterRow>
        <SearchInput value={search} onChange={v => { setSearch(v); setPage(1); }} placeholder={t.messages.searchPlaceholder} />
        <Select value={srcFilter} onChange={e => { setSrcFilter(e.target.value); setPage(1); }} options={srcOpts} className="!w-36" />
        <DateInput label={t.messages.dateFrom} value={dateFrom} onChange={v => { setDateFrom(v); setPage(1); }} />
        <DateInput label={t.messages.dateTo} value={dateTo} onChange={v => { setDateTo(v); setPage(1); }} />
        <Btn size="xs" onClick={() => { setSearch(''); setSrcFilter(''); setDateFrom(''); setDateTo(''); setPage(1); }} variant="ghost">{t.actions.clearFilters}</Btn>
      </FilterRow>

      <Toolbar>
        <Btn variant="success" onClick={openAdd} icon="＋">{t.sections.contents.add}</Btn>
        <Btn onClick={openEdit} disabled={!selected}>{t.actions.edit}</Btn>
        <Btn variant="danger" onClick={() => setShowDelete(true)} disabled={!selected}>{t.actions.delete}</Btn>
        <Btn onClick={() => { if (selected) duplicateContent(selectedId!); }} disabled={!selected} icon="⎘">{t.actions.duplicate}</Btn>
        <ToolbarSep />
        <Btn onClick={() => { if (selected) setShowPreview(true); }} disabled={!selected} icon="👁">Preview</Btn>
        <Btn onClick={() => setShowExport(true)} icon="⬇">{t.actions.export}</Btn>
        <Btn onClick={() => window.print()} icon="🖨">{t.actions.print}</Btn>
        <div className="flex-1" />
        <MoreMenu items={moreItems} />
      </Toolbar>

      <ResultsStrip total={data.contents.length} filtered={filtered.length} selected={selectedIds.length} recordsLabel={t.messages.records} totalLabel={t.messages.total} selectedLabel={t.messages.selected} />

      <div className="flex-1 overflow-hidden">
        <DataTable columns={columns} data={paged} selectedId={selectedId ?? undefined} selectedIds={selectedIds}
          onSelect={r => setSelectedId(r?.id ?? null)}
          onSelectionChange={ids => { setSelectedIds(ids); if (ids.length === 1) setSelectedId(ids[0]); }}
          onDoubleClick={() => openEdit()} emptyText={t.sections.contents.noData}
          rowNumberOffset={(page - 1) * pageSize} density={settings.density === 'compact' ? 'compact' : 'comfortable'} />
      </div>

      {selectedIds.length > 0 && <SelectionBar count={selectedIds.length} onClear={() => setSelectedIds([])} onBulkDelete={() => setShowBulkOps(true)} label={t.messages.selected} />}

      <FullTextPreview record={selected} recordType={selected ? 'content' : null} sources={data.sources} />

      <PaginationBar total={filtered.length} page={page} pageSize={pageSize}
        onPage={p => setPage(p)} onPageSize={s => { setPageSize(s); setPage(1); }}
        perPageLabel={t.messages.perPage} pageLabel={t.messages.page} ofLabel={t.messages.of} showingLabel={t.messages.showing} />

      <FormModal isOpen={showAdd} title={t.sections.contents.add} onClose={() => setShowAdd(false)} onSave={handleSave} saveLabel={t.actions.save} size="lg"><FormContent /></FormModal>
      <FormModal isOpen={showEdit} title={t.sections.contents.edit} onClose={() => setShowEdit(false)} onSave={handleSave} saveLabel={t.actions.save} size="lg"><FormContent /></FormModal>
      <ConfirmDialog isOpen={showDelete} title={t.actions.delete} message={t.messages.confirmDelete} onConfirm={handleDelete} onCancel={() => setShowDelete(false)} danger />
      <ExportDialog isOpen={showExport} onClose={() => setShowExport(false)} data={filtered as unknown as Record<string, unknown>[]} columns={exportColumns} defaultFilename="contents" />
      <BulkOperations isOpen={showBulkOps} onClose={() => setShowBulkOps(false)} selectedIds={selectedIds} data={data.contents.map(c => ({ id: c.id, label: c.title }))} onBulkDelete={handleBulkDelete} />
      <ContentPreviewDialog isOpen={showPreview} onClose={() => setShowPreview(false)} content={selected} source={selected ? data.sources.find(s => s.id === selected.sources_id) : null} />
    </div>
  );
}
