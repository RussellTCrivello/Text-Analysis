import React, { useMemo, useState } from 'react';
import { DataTable, type Column } from '../components/DataTable';
import { InfoModal } from '../components/FormModal';
import { Btn, Toolbar, ToolbarSep, SearchInput, DateInput, FilterRow, ResultsStrip, FullTextPreview, PaginationBar, RecordTypeBadge, ImportanceBar, Select, MoreMenu } from '../components/ui';
import { ExportDialog } from '../components/ExportDialog';
import { useAppData } from '../store/AppContext';
import { useSettings } from '../store/SettingsContext';
import { useTranslation } from '../i18n';
import type { RecordType } from '../types';

interface UnifiedRecord {
  id: string;
  recordType: RecordType;
  sourceName: string;
  title: string;
  contentData: string;
  classification: string;
  importance: number;
  date: string;
  date_creation: string;
  list_names_people: string;
  list_names_places: string;
  note: string;
  list_sides: string;
}

export function AllDataView({ onToast, onGenerateReport }: { onToast: (m: string) => void; onGenerateReport?: (records: UnifiedRecord[]) => void }) {
  const { t } = useTranslation();
  const { settings } = useSettings();
  const { data } = useAppData();
  const [typeFilter, setTypeFilter] = useState<RecordType | 'all'>('all');
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(settings.defaultPageSize);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [showExport, setShowExport] = useState(false);

  const sourceName = (id: string) => data.sources.find(s => s.id === id)?.name ?? '—';
  const contentTitle = (id: string) => data.contents.find(c => c.id === id)?.title ?? '—';

  const allRecords = useMemo<UnifiedRecord[]>(() => {
    const sources: UnifiedRecord[] = data.sources.map(s => ({
      id: s.id, recordType: 'source', sourceName: s.name, title: s.name,
      contentData: s.description, classification: s.type, importance: s.importance,
      date: s.date_entry, date_creation: s.date_creation, list_names_people: '',
      list_names_places: [s.city, s.country].filter(Boolean).join(', '), note: s.note, list_sides: '',
    }));
    const contents: UnifiedRecord[] = data.contents.map(c => ({
      id: c.id, recordType: 'content', sourceName: sourceName(c.sources_id), title: c.title,
      contentData: c.content_data?.slice(0, 200), classification: '', importance: c.importance,
      date: c.date_content, date_creation: c.date_creation, list_names_people: '',
      list_names_places: '', note: c.note, list_sides: '',
    }));
    const analyses: UnifiedRecord[] = data.analyses.map(a => {
      const content = data.contents.find(c => c.id === a.content_id);
      return {
        id: a.id, recordType: 'analysis', sourceName: content ? sourceName(content.sources_id) : '—',
        title: content?.title ?? '—', contentData: a.classification, classification: a.classification,
        importance: 0, date: a.date_analysis, date_creation: a.date_creation,
        list_names_people: a.list_names_people, list_names_places: a.list_names_places,
        note: a.list_sides, list_sides: a.list_sides,
      };
    });
    return [...sources, ...contents, ...analyses];
  }, [data]);

  const filtered = useMemo(() => {
    return allRecords.filter(r => {
      if (typeFilter !== 'all' && r.recordType !== typeFilter) return false;
      const q = search.toLowerCase();
      if (q && !Object.values(r).some(v => String(v).toLowerCase().includes(q))) return false;
      if (dateFrom && r.date < dateFrom) return false;
      if (dateTo && r.date > dateTo) return false;
      return true;
    });
  }, [allRecords, typeFilter, search, dateFrom, dateTo]);

  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);
  const selected = filtered.find(r => r.id === selectedId) ?? null;

  const typeOpts = [
    { value: 'all', label: t.sections.allData.filterAll },
    { value: 'source', label: t.sections.allData.filterSources },
    { value: 'content', label: t.sections.allData.filterContents },
    { value: 'analysis', label: t.sections.allData.filterAnalysis },
  ];

  const columns: Column<UnifiedRecord>[] = [
    { key: 'recordType', header: t.fields.recordType, width: '90px',
      render: r => <RecordTypeBadge type={r.recordType} /> },
    { key: 'sourceName', header: t.fields.sourceName, width: '16%', sortable: true },
    { key: 'title', header: t.fields.title, width: '22%', sortable: true },
    { key: 'contentData', header: t.fields.contentData,
      render: r => <span className="text-xs truncate block" style={{ color: 'var(--muted-fg)' }}>{r.contentData?.slice(0, 90)}</span> },
    { key: 'classification', header: t.fields.classification, width: '130px', sortable: true,
      render: r => r.classification ? <span className="text-xs">{r.classification}</span> : <span style={{ color: 'var(--muted-fg)' }}>—</span> },
    { key: 'importance', header: t.fields.importance, width: '110px', sortable: true,
      render: r => r.importance > 0 ? <ImportanceBar value={r.importance} /> : <span style={{ color: 'var(--muted-fg)' }}>—</span> },
    { key: 'date', header: t.fields.date, width: '90px', sortable: true,
      render: r => <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8em' }}>{r.date || '—'}</span> },
  ];

  const exportColumns = [
    { key: 'id', label: 'ID' }, { key: 'recordType', label: t.fields.recordType },
    { key: 'sourceName', label: t.fields.sourceName }, { key: 'title', label: t.fields.title },
    { key: 'classification', label: t.fields.classification }, { key: 'importance', label: t.fields.importance },
    { key: 'date', label: t.fields.date },
  ];

  const moreItems = [
    { label: t.actions.generateReport, icon: '📊', onClick: () => { onGenerateReport?.(filtered); onToast('Data sent to Reports.'); } },
  ];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <FilterRow>
        <Select value={typeFilter} onChange={e => { setTypeFilter(e.target.value as RecordType | 'all'); setPage(1); }} options={typeOpts} className="!w-32" />
        <SearchInput value={search} onChange={v => { setSearch(v); setPage(1); }} placeholder={t.messages.searchPlaceholder} />
        <DateInput label={t.messages.dateFrom} value={dateFrom} onChange={v => { setDateFrom(v); setPage(1); }} />
        <DateInput label={t.messages.dateTo} value={dateTo} onChange={v => { setDateTo(v); setPage(1); }} />
        <Btn size="xs" onClick={() => { setSearch(''); setTypeFilter('all'); setDateFrom(''); setDateTo(''); setPage(1); }} variant="ghost">{t.actions.clearFilters}</Btn>
      </FilterRow>

      <Toolbar>
        <Btn onClick={() => { if (!selectedId) return; setShowPreview(true); }} disabled={!selectedId} icon="👁">{t.actions.quickView}</Btn>
        <ToolbarSep />
        <Btn onClick={() => setShowExport(true)} icon="⬇">{t.actions.export}</Btn>
        <Btn onClick={() => window.print()} icon="🖨">{t.actions.print}</Btn>
        <div className="flex-1" />
        <MoreMenu items={moreItems} />
      </Toolbar>

      <ResultsStrip total={allRecords.length} filtered={filtered.length} selected={0} recordsLabel={t.messages.records} totalLabel={t.messages.total} selectedLabel={t.messages.selected} />

      <div className="flex-1 overflow-hidden">
        <DataTable
          columns={columns}
          data={paged}
          selectedId={selectedId ?? undefined}
          onSelect={r => setSelectedId(r?.id ?? null)}
          onDoubleClick={r => { setSelectedId(r.id); setShowPreview(true); }}
          emptyText={t.sections.allData.noData}
          rowNumberOffset={(page - 1) * pageSize}
          density={settings.density === 'compact' ? 'compact' : 'comfortable'}
        />
      </div>

      <FullTextPreview record={null} recordType={null} />
      <PaginationBar total={filtered.length} page={page} pageSize={pageSize} onPage={p => setPage(p)} onPageSize={s => { setPageSize(s); setPage(1); }} perPageLabel={t.messages.perPage} pageLabel={t.messages.page} ofLabel={t.messages.of} showingLabel={t.messages.showing} />

      {/* Quick View dialog */}
      <InfoModal isOpen={showPreview && !!selected} title={t.actions.quickView} onClose={() => setShowPreview(false)} size="lg">
        {selected && (
          <div className="flex flex-col gap-3 text-sm">
            <div className="flex items-center gap-2 mb-1">
              <RecordTypeBadge type={selected.recordType} />
              <h3 className="text-base font-semibold" style={{ fontFamily: 'var(--font-display)' }}>{selected.title}</h3>
            </div>
            {[
              [t.fields.sourceName, selected.sourceName],
              [t.fields.classification, selected.classification],
              [t.fields.date, selected.date],
              [t.fields.list_names_people, selected.list_names_people],
              [t.fields.list_names_places, selected.list_names_places],
            ].filter(([, v]) => v).map(([k, v]) => (
              <div key={String(k)} className="flex gap-3 py-1.5" style={{ borderBottom: '1px solid var(--border)' }}>
                <span className="w-32 shrink-0 text-xs uppercase tracking-wide font-semibold" style={{ color: 'var(--muted-fg)' }}>{k}</span>
                <span className="flex-1 text-xs">{v}</span>
              </div>
            ))}
            {selected.contentData && (
              <div className="pt-2">
                <p className="text-xs uppercase tracking-wide font-semibold mb-2" style={{ color: 'var(--muted-fg)' }}>Content</p>
                <p className="text-sm leading-relaxed" style={{ whiteSpace: 'pre-wrap' }}>{selected.contentData}</p>
              </div>
            )}
          </div>
        )}
      </InfoModal>

      <ExportDialog isOpen={showExport} onClose={() => setShowExport(false)} data={filtered as unknown as Record<string, unknown>[]} columns={exportColumns} defaultFilename="all_data" />
    </div>
  );
}
