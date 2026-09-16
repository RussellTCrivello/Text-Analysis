import React, { useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, CartesianGrid } from 'recharts';
import { Btn, FilterRow, SearchInput, Select, Badge, RecordTypeBadge, DateInput, PageHeader, EmptyState } from '../components/ui';
import { TimelineExportDialog } from '../components/TimelineExportDialog';
import { useAppData } from '../store/AppContext';
import { useTranslation } from '../i18n';
import { formatDateTime } from '../core/text';
import { IconClose, IconExport, IconMapPin, IconTimeline } from '../components/icons';
import type { AppData as CoreAppData } from '../core/repository';
import {
  buildTimeline,
  filterTimeline,
  paginateEvents,
  sortTimeline,
  summarizeTimeline,
  timelineFacets,
  timelineSeries,
  timelineStats,
  type TimelineChart,
  type TimelineEvent,
  type TimelineRecordType,
  type TimelineSort,
} from '../core/timeline';

const COLORS = ['#0f766e','#1d4ed8','#c2410c','#7c3aed','#db2777','#15803d','#dc2626','#0369a1'];

type SortDir = 'asc' | 'desc';
type Density = 'compact' | 'normal' | 'expanded';

export function TimelineView({ onToast }: { onToast: (m: string) => void }) {
  const { t } = useTranslation();
  const { data } = useAppData();
  const [search, setSearch] = useState('');
  const [peopleFilter, setPeopleFilter] = useState('');
  const [placesFilter, setPlacesFilter] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [types, setTypes] = useState<TimelineRecordType[]>(['source', 'content', 'analysis']);
  const [sortField, setSortField] = useState<TimelineSort>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [density, setDensity] = useState<Density>('normal');
  const [chartType, setChartType] = useState<TimelineChart>('type');
  const [selectedEvent, setSelectedEvent] = useState<TimelineEvent | null>(null);
  const [showExport, setShowExport] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 50;

  const sourceName = (id: string) => data.sources.find(s => s.id === id)?.name ?? '—';

  const allEvents = useMemo(() => buildTimeline(data as unknown as CoreAppData), [data]);

  const facets = useMemo(() => timelineFacets(allEvents), [allEvents]);

  const filtered = useMemo(
    () =>
      sortTimeline(
        filterTimeline(allEvents, {
          from: dateFrom || undefined,
          to: dateTo || undefined,
          search: search || undefined,
          person: peopleFilter || undefined,
          place: placesFilter || undefined,
          category: classFilter || undefined,
          types,
        }),
        sortField,
        sortDir,
      ),
    [allEvents, dateFrom, dateTo, search, peopleFilter, placesFilter, classFilter, types, sortField, sortDir],
  );

  const { slice: pageEvents, pages } = paginateEvents(filtered, page, pageSize);

  const summary = useMemo(() => summarizeTimeline(filtered), [filtered]);

  const toggleType = (type: TimelineRecordType) =>
    setTypes((current) => (current.includes(type) ? current.filter((x) => x !== type) : [...current, type]));

  const chartData = useMemo(() => timelineSeries(filtered, chartType), [filtered, chartType]);

  const stats = timelineStats(allEvents, filtered);

  const sortOpts: { value: TimelineSort; label: string }[] = [
    { value: 'date', label: t.sections.timeline.sortDate },
    { value: 'source', label: t.sections.timeline.sortSource },
    { value: 'classification', label: 'Classification' },
    { value: 'people', label: 'People' },
    { value: 'places', label: 'Places' },
  ];
  const dirOpts = [
    { value: 'asc', label: t.sections.timeline.ascending },
    { value: 'desc', label: t.sections.timeline.descending },
  ];
  const densityOpts: { value: Density; label: string }[] = [
    { value: 'compact', label: t.sections.timeline.densityCompact },
    { value: 'normal', label: t.sections.timeline.densityNormal },
    { value: 'expanded', label: t.sections.timeline.densityExpanded },
  ];
  const chartOpts: { value: TimelineChart; label: string }[] = [
    { value: 'type', label: t.sections.timeline.chartTypeDistribution },
    { value: 'monthly', label: t.sections.timeline.chartMonthly },
    { value: 'weekday', label: t.sections.timeline.chartDayOfWeek },
    { value: 'classification', label: t.sections.timeline.chartClassification },
    { value: 'daily', label: 'Daily' },
    { value: 'yearly', label: 'Yearly' },
  ];
  const classOpts = [{ value: '', label: '— All —' }, ...facets.categories.map((c) => ({ value: c, label: c }))];
  const peopleOpts = [{ value: '', label: '— All people —' }, ...facets.people.map((p) => ({ value: p, label: p.slice(0, 40) }))];
  const placesOpts = [{ value: '', label: '— All places —' }, ...facets.places.map((p) => ({ value: p, label: p.slice(0, 40) }))];

  const axisDot = (type: string): { color: string; size: number } => {
    if (type === 'source') return { color: '#15803d', size: 8 };
    if (type === 'content') return { color: '#1d4ed8', size: 10 };
    return { color: '#7c3aed', size: 12 };
  };

  const cardPy = density === 'compact' ? 'py-1' : density === 'expanded' ? 'py-4' : 'py-2.5';

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PageHeader
        eyebrow={t.nav.timelineDesc}
        title={t.sections.timeline.title}
        count={{ value: stats.total, label: t.sections.timeline.totalEvents }}
        icon={<IconTimeline size={16} />}
      />

      {/* Filter row */}
      <FilterRow>
        <SearchInput value={search} onChange={setSearch} placeholder={t.messages.searchPlaceholder} />
        <Select value={classFilter} onChange={e => setClassFilter(e.target.value)} options={classOpts} className="!w-36" />
        <Select value={peopleFilter} onChange={e => setPeopleFilter(e.target.value)} options={peopleOpts} className="!w-36" />
        <Select value={placesFilter} onChange={e => setPlacesFilter(e.target.value)} options={placesOpts} className="!w-36" />
        <DateInput label={t.messages.dateFrom} value={dateFrom} onChange={v => { setDateFrom(v); setPage(1); }} />
        <DateInput label={t.messages.dateTo} value={dateTo} onChange={v => { setDateTo(v); setPage(1); }} />
        <Btn size="xs" onClick={() => { setSearch(''); setClassFilter(''); setPeopleFilter(''); setPlacesFilter(''); setDateFrom(''); setDateTo(''); setTypes(['source', 'content', 'analysis']); }} variant="ghost">{t.actions.clearFilters}</Btn>
        <div className="flex items-center gap-1">
          {(['source', 'content', 'analysis'] as TimelineRecordType[]).map(type => (
            <button
              key={type}
              onClick={() => toggleType(type)}
              className="px-2 py-1 rounded text-[10px] font-semibold uppercase tracking-wide transition-colors"
              style={{
                background: types.includes(type) ? 'var(--primary)' : 'var(--surface-2)',
                color: types.includes(type) ? 'var(--primary-fg)' : 'var(--muted-fg)',
                border: `1px solid ${types.includes(type) ? 'var(--primary)' : 'var(--border)'}`,
              }}
            >
              {type}
            </button>
          ))}
        </div>
      </FilterRow>

      {/* Stats + controls */}
      <div className="px-3 py-2 flex items-center gap-3 flex-wrap shrink-0" style={{ background: 'var(--card-bg)', borderBottom: '1px solid var(--border)' }}>
        {[
          { label: t.sections.timeline.totalEvents, value: stats.total, color: '#0f766e' },
          { label: t.sections.timeline.filteredEvents, value: stats.filtered, color: '#1d4ed8' },
          { label: t.sections.timeline.sourcesCount, value: stats.sources, color: '#15803d' },
          { label: t.sections.timeline.analysesCount, value: stats.analyses, color: '#7c3aed' },
          { label: 'Contents', value: stats.contents, color: '#1d4ed8' },
          { label: 'Geotagged', value: stats.withCoordinates, color: '#c2410c' },
        ].map(s => (
          <div key={s.label} className="flex items-center gap-2 px-3 py-1 rounded" style={{ background: 'var(--secondary-bg)' }}>
            <span className="text-xs" style={{ color: 'var(--muted-fg)' }}>{s.label}</span>
            <span className="text-sm font-bold" style={{ fontFamily: 'var(--font-mono)', color: s.color }}>{s.value}</span>
          </div>
        ))}
        <span className="text-[11px]" style={{ color: 'var(--muted-fg)' }}>
          {summary.range.from ?? '—'} – {summary.range.to ?? '—'} · busiest {summary.mostActivePeriod?.label ?? '—'} ({summary.mostActivePeriod?.count ?? 0})
        </span>
        <div className="flex-1" />
        <Select value={sortField} onChange={e => setSortField(e.target.value as TimelineSort)} options={sortOpts} className="!w-36" />
        <Select value={sortDir} onChange={e => setSortDir(e.target.value as SortDir)} options={dirOpts} className="!w-28" />
        <Select value={density} onChange={e => setDensity(e.target.value as Density)} options={densityOpts} className="!w-28" />
        <Btn size="xs" onClick={() => setShowExport(true)} icon={<IconExport size="sm" />}>Export</Btn>
      </div>

      {/* Main content: left=timeline events, right=detail */}
      <div className="flex flex-1 overflow-hidden">
        {/* Timeline events list */}
        <div className="flex-1 overflow-y-auto px-4 py-3" style={{ minWidth: 0 }}>
          {/* Chart section */}
          <div className="mb-4 rounded-xl overflow-hidden" style={{ background: 'var(--card-bg)', border: '1px solid var(--border)' }}>
            <div className="flex items-center px-3 py-2 gap-2" style={{ borderBottom: '1px solid var(--border)' }}>
              <span className="text-xs font-semibold" style={{ color: 'var(--muted-fg)' }}>Chart</span>
              <Select value={chartType} onChange={e => setChartType(e.target.value as TimelineChart)} options={chartOpts} className="!w-40" />
            </div>
            <div className="px-2 py-2">
              <ResponsiveContainer width="100%" height={160}>
                {chartType === 'type' || chartType === 'classification' ? (
                  <PieChart>
                    <Pie data={chartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={65} label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}>
                      {chartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                ) : (
                  <BarChart data={chartData}>
                    <XAxis dataKey="name" tick={{ fontSize: 9 }} />
                    <YAxis tick={{ fontSize: 9 }} />
                    <Tooltip />
                    <Bar dataKey="value" fill="var(--primary)" radius={[3, 3, 0, 0]} />
                  </BarChart>
                )}
              </ResponsiveContainer>
            </div>
          </div>

          {/* Event cards */}
          {filtered.length === 0 ? (
            <EmptyState variant="noResults" title={t.sections.timeline.noData} compact />
          ) : (
            <div className="relative">
              {/* Axis line */}
              <div className="absolute inset-y-0 left-5 w-px" style={{ background: 'var(--border)' }} />

              {filtered.map((event, idx) => {
                const dot = axisDot(event.type);
                const isSelected = selectedEvent?.id === event.id;
                return (
                  <div
                    key={event.id}
                    onClick={() => setSelectedEvent(isSelected ? null : event)}
                    className={`flex gap-3 cursor-pointer mb-1 rounded-lg transition-colors ${cardPy}`}
                    style={{ background: isSelected ? 'var(--secondary-bg)' : 'transparent' }}
                  >
                    {/* Dot */}
                    <div className="relative flex flex-col items-center shrink-0" style={{ width: 40, paddingTop: 4 }}>
                      <div className="rounded-full shrink-0 z-10" style={{ width: dot.size, height: dot.size, background: dot.color, border: '2px solid var(--card-bg)', boxShadow: `0 0 0 1px ${dot.color}` }} />
                    </div>
                    {/* Content */}
                    <div className="flex-1 min-w-0 pb-2" style={{ borderBottom: idx < filtered.length - 1 ? '1px solid var(--border)' : 'none' }}>
                      <div className="flex items-center gap-2 mb-0.5">
                        <RecordTypeBadge type={event.type} />
                        <span className="text-xs font-semibold truncate">{event.title}</span>
                        <span
                          className="ms-auto text-xs shrink-0"
                          style={{ color: 'var(--muted-fg)', fontFamily: 'var(--font-mono)' }}
                          title={formatDateTime(event.date)}
                        >
                          {event.date ? formatDateTime(event.date) : '—'}
                        </span>
                      </div>
                      {density !== 'compact' && (
                        <p className="text-xs truncate" style={{ color: 'var(--muted-fg)' }}>{event.summary}</p>
                      )}
                      {density === 'expanded' && (
                        <div className="flex flex-wrap gap-2 mt-1">
                          {event.source && <span className="text-xs" style={{ color: 'var(--muted-fg)' }}><IconMapPin size="xs" /> {event.source}</span>}
                          {event.classification && <Badge size="xs">{event.classification}</Badge>}
                          {event.hasCoordinates && <Badge size="xs">geotagged</Badge>}
                          {event.people.slice(0, 3).map(p => <Badge key={p} size="xs">{p}</Badge>)}
                          {event.places.slice(0, 3).map(p => <Badge key={p} size="xs">{p}</Badge>)}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: detail panel */}
        {selectedEvent && (
          <div className="w-72 shrink-0 overflow-y-auto p-4 flex flex-col gap-3" style={{ borderInlineStart: '1px solid var(--border)', background: 'var(--muted-bg)' }}>
            <div className="flex items-center gap-2">
              <RecordTypeBadge type={selectedEvent.type} />
              <button onClick={() => setSelectedEvent(null)} aria-label="Close event details" className="ms-auto flex items-center text-xs" style={{ color: 'var(--muted-fg)' }}><IconClose size="xs" /></button>
            </div>
            <h3 className="text-sm font-bold" style={{ fontFamily: 'var(--font-display)' }}>{selectedEvent.title}</h3>
            {[
              ['Date', selectedEvent.date],
              ['Source', selectedEvent.source],
              ['Classification', selectedEvent.classification],
              ['People', selectedEvent.people.join(', ')],
              ['Places', selectedEvent.places.join(', ')],
              ['Importance', selectedEvent.importance ? (selectedEvent.importance * 100).toFixed(0) + '%' : ''],
            ].filter(([, v]) => v).map(([k, v]) => (
              <div key={k} className="py-1.5" style={{ borderBottom: '1px solid var(--border)' }}>
                <div className="text-[10px] uppercase tracking-wide font-semibold mb-0.5" style={{ color: 'var(--muted-fg)' }}>{k}</div>
                <div className="text-xs">{v}</div>
              </div>
            ))}
            {selectedEvent.summary && (
              <div>
                <div className="text-[10px] uppercase tracking-wide font-semibold mb-1" style={{ color: 'var(--muted-fg)' }}>Summary</div>
                <p className="text-xs leading-relaxed">{selectedEvent.summary}</p>
              </div>
            )}
          </div>
        )}
      </div>
      <div className="px-3 py-1.5 flex items-center gap-2 shrink-0 text-xs" style={{ borderTop: '1px solid var(--border)', background: 'var(--card-bg)' }}>
        <span style={{ color: 'var(--muted-fg)' }}>
          Page {page} of {Math.max(1, pages)} · showing {pageEvents.length} of {filtered.length}
        </span>
        <div className="flex-1" />
        <Btn size="xs" variant="ghost" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}>Prev</Btn>
        <Btn size="xs" variant="ghost" onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page >= pages}>Next</Btn>
      </div>
      <TimelineExportDialog
        isOpen={showExport}
        onClose={() => setShowExport(false)}
        filteredEvents={filtered}
        allEvents={allEvents}
        pageEvents={pageEvents}
        onToast={onToast}
      />
    </div>
  );
}
