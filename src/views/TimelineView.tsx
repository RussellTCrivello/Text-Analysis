import React, { useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, CartesianGrid } from 'recharts';
import { Btn, FilterRow, SearchInput, Select, Badge, RecordTypeBadge } from '../components/ui';
import { TimelineExportDialog } from '../components/TimelineExportDialog';
import { useAppData } from '../store/AppContext';
import { useTranslation } from '../i18n';
import type { TimelineEvent } from '../types';

const COLORS = ['#0f766e','#1d4ed8','#c2410c','#7c3aed','#db2777','#15803d','#dc2626','#0369a1'];

type ChartType = 'typeDistribution' | 'monthly' | 'dayOfWeek' | 'classification';
type SortField = 'date' | 'type' | 'source';
type SortDir = 'asc' | 'desc';
type Density = 'compact' | 'normal' | 'expanded';

export function TimelineView({ onToast }: { onToast: (m: string) => void }) {
  const { t } = useTranslation();
  const { data } = useAppData();
  const [search, setSearch] = useState('');
  const [peopleFilter, setPeopleFilter] = useState('');
  const [placesFilter, setPlacesFilter] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [density, setDensity] = useState<Density>('normal');
  const [chartType, setChartType] = useState<ChartType>('typeDistribution');
  const [selectedEvent, setSelectedEvent] = useState<TimelineEvent | null>(null);
  const [showExport, setShowExport] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 50;

  const sourceName = (id: string) => data.sources.find(s => s.id === id)?.name ?? '—';

  const allEvents = useMemo<TimelineEvent[]>(() => {
    const events: TimelineEvent[] = [];
    data.sources.forEach(s => events.push({
      id: s.id, type: 'source', date: s.date_entry, title: s.name,
      summary: s.description?.slice(0, 120), source: s.name, list_names_people: '', list_names_places: s.city, classification: s.type,
    }));
    data.contents.forEach(c => events.push({
      id: c.id, type: 'content', date: c.date_content, title: c.title,
      summary: c.content_data?.slice(0, 120), source: sourceName(c.sources_id), list_names_people: '', list_names_places: '', classification: '',
    }));
    data.analyses.forEach(a => {
      const c = data.contents.find(x => x.id === a.content_id);
      events.push({
        id: a.id, type: 'analysis', date: a.date_analysis, title: c?.title ?? a.classification,
        summary: [a.list_names_people, a.list_names_places].filter(Boolean).join(' · ').slice(0, 120),
        source: c ? sourceName(c.sources_id) : '—', list_names_people: a.list_names_people, list_names_places: a.list_names_places, classification: a.classification,
      });
    });
    return events;
  }, [data]);

  const allClassifications = useMemo(() => [...new Set(allEvents.map(e => e.classification).filter(Boolean))], [allEvents]);
  const allPeople = useMemo(() => [...new Set(allEvents.map(e => e.list_names_people).filter(Boolean))], [allEvents]);
  const allPlaces = useMemo(() => [...new Set(allEvents.map(e => e.list_names_places).filter(Boolean))], [allEvents]);

  const filtered = useMemo(() => {
    return allEvents.filter(e => {
      const q = search.toLowerCase();
      if (q && ![e.title, e.summary, e.source, e.classification].some(v => v?.toLowerCase().includes(q))) return false;
      if (peopleFilter && !e.list_names_people.includes(peopleFilter)) return false;
      if (placesFilter && !e.list_names_places.includes(placesFilter)) return false;
      if (classFilter && e.classification !== classFilter) return false;
      return true;
    }).sort((a, b) => {
      let av = '', bv = '';
      if (sortField === 'date') { av = a.date; bv = b.date; }
      else if (sortField === 'type') { av = a.type; bv = b.type; }
      else if (sortField === 'source') { av = a.source; bv = b.source; }
      const cmp = av.localeCompare(bv);
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [allEvents, search, peopleFilter, placesFilter, classFilter, sortField, sortDir]);

  const pageEvents = filtered.slice((page - 1) * pageSize, page * pageSize);

  const chartData = useMemo(() => {
    if (chartType === 'typeDistribution') {
      return ['source', 'content', 'analysis'].map(t2 => ({ name: t2.charAt(0).toUpperCase() + t2.slice(1), value: filtered.filter(e => e.type === t2).length }));
    }
    if (chartType === 'monthly') {
      const months: Record<string, number> = {};
      filtered.forEach(e => { const m = e.date.slice(0, 7); if (m) months[m] = (months[m] ?? 0) + 1; });
      return Object.entries(months).sort(([a], [b]) => a.localeCompare(b)).map(([name, value]) => ({ name, value }));
    }
    if (chartType === 'dayOfWeek') {
      const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
      const counts = [0,0,0,0,0,0,0];
      filtered.forEach(e => { if (e.date) { const d = new Date(e.date).getDay(); if (!isNaN(d)) counts[d]++; } });
      return days.map((name, i) => ({ name, value: counts[i] }));
    }
    if (chartType === 'classification') {
      const grouped: Record<string, number> = {};
      filtered.forEach(e => { const k = e.classification || '(none)'; grouped[k] = (grouped[k] ?? 0) + 1; });
      return Object.entries(grouped).sort(([,a],[,b]) => b - a).slice(0, 8).map(([name, value]) => ({ name, value }));
    }
    return [];
  }, [filtered, chartType]);

  const stats = {
    total: allEvents.length,
    filtered: filtered.length,
    sources: allEvents.filter(e => e.type === 'source').length,
    analyses: allEvents.filter(e => e.type === 'analysis').length,
  };

  const sortOpts: { value: SortField; label: string }[] = [
    { value: 'date', label: t.sections.timeline.sortDate },
    { value: 'type', label: t.sections.timeline.sortType },
    { value: 'source', label: t.sections.timeline.sortSource },
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
  const chartOpts: { value: ChartType; label: string }[] = [
    { value: 'typeDistribution', label: t.sections.timeline.chartTypeDistribution },
    { value: 'monthly', label: t.sections.timeline.chartMonthly },
    { value: 'dayOfWeek', label: t.sections.timeline.chartDayOfWeek },
    { value: 'classification', label: t.sections.timeline.chartClassification },
  ];
  const classOpts = [{ value: '', label: '— All —' }, ...allClassifications.map(c => ({ value: c, label: c }))];
  const peopleOpts = [{ value: '', label: '— All people —' }, ...allPeople.map(p => ({ value: p, label: p.slice(0, 40) }))];
  const placesOpts = [{ value: '', label: '— All places —' }, ...allPlaces.map(p => ({ value: p, label: p.slice(0, 40) }))];

  const axisDot = (type: string): { color: string; size: number } => {
    if (type === 'source') return { color: '#15803d', size: 8 };
    if (type === 'content') return { color: '#1d4ed8', size: 10 };
    return { color: '#7c3aed', size: 12 };
  };

  const cardPy = density === 'compact' ? 'py-1' : density === 'expanded' ? 'py-4' : 'py-2.5';

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Filter row */}
      <FilterRow>
        <SearchInput value={search} onChange={setSearch} placeholder={t.messages.searchPlaceholder} />
        <Select value={classFilter} onChange={e => setClassFilter(e.target.value)} options={classOpts} className="!w-36" />
        <Select value={peopleFilter} onChange={e => setPeopleFilter(e.target.value)} options={peopleOpts} className="!w-36" />
        <Select value={placesFilter} onChange={e => setPlacesFilter(e.target.value)} options={placesOpts} className="!w-36" />
        <Btn size="xs" onClick={() => { setSearch(''); setClassFilter(''); setPeopleFilter(''); setPlacesFilter(''); }} variant="ghost">{t.actions.clearFilters}</Btn>
      </FilterRow>

      {/* Stats + controls */}
      <div className="px-3 py-2 flex items-center gap-3 flex-wrap shrink-0" style={{ background: 'var(--card-bg)', borderBottom: '1px solid var(--border)' }}>
        {[
          { label: t.sections.timeline.totalEvents, value: stats.total, color: '#0f766e' },
          { label: t.sections.timeline.filteredEvents, value: stats.filtered, color: '#1d4ed8' },
          { label: t.sections.timeline.sourcesCount, value: stats.sources, color: '#15803d' },
          { label: t.sections.timeline.analysesCount, value: stats.analyses, color: '#7c3aed' },
        ].map(s => (
          <div key={s.label} className="flex items-center gap-2 px-3 py-1 rounded" style={{ background: 'var(--secondary-bg)' }}>
            <span className="text-xs" style={{ color: 'var(--muted-fg)' }}>{s.label}</span>
            <span className="text-sm font-bold" style={{ fontFamily: 'var(--font-mono)', color: s.color }}>{s.value}</span>
          </div>
        ))}
        <div className="flex-1" />
        <Select value={sortField} onChange={e => setSortField(e.target.value as SortField)} options={sortOpts} className="!w-28" />
        <Select value={sortDir} onChange={e => setSortDir(e.target.value as SortDir)} options={dirOpts} className="!w-28" />
        <Select value={density} onChange={e => setDensity(e.target.value as Density)} options={densityOpts} className="!w-28" />
        <Btn size="xs" onClick={() => setShowExport(true)} icon="⬇">Export</Btn>
      </div>

      {/* Main content: left=timeline events, right=detail */}
      <div className="flex flex-1 overflow-hidden">
        {/* Timeline events list */}
        <div className="flex-1 overflow-y-auto px-4 py-3" style={{ minWidth: 0 }}>
          {/* Chart section */}
          <div className="mb-4 rounded-xl overflow-hidden" style={{ background: 'var(--card-bg)', border: '1px solid var(--border)' }}>
            <div className="flex items-center px-3 py-2 gap-2" style={{ borderBottom: '1px solid var(--border)' }}>
              <span className="text-xs font-semibold" style={{ color: 'var(--muted-fg)' }}>Chart</span>
              <Select value={chartType} onChange={e => setChartType(e.target.value as ChartType)} options={chartOpts} className="!w-40" />
            </div>
            <div className="px-2 py-2">
              <ResponsiveContainer width="100%" height={160}>
                {chartType === 'typeDistribution' ? (
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
            <div className="flex items-center justify-center py-20 text-xs" style={{ color: 'var(--muted-fg)' }}>{t.sections.timeline.noData}</div>
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
                        <span className="ms-auto text-xs shrink-0" style={{ color: 'var(--muted-fg)', fontFamily: 'var(--font-mono)' }}>{event.date || '—'}</span>
                      </div>
                      {density !== 'compact' && (
                        <p className="text-xs truncate" style={{ color: 'var(--muted-fg)' }}>{event.summary}</p>
                      )}
                      {density === 'expanded' && (
                        <div className="flex gap-3 mt-1">
                          {event.source && <span className="text-xs" style={{ color: 'var(--muted-fg)' }}>📍 {event.source}</span>}
                          {event.classification && <Badge size="xs">{event.classification}</Badge>}
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
              <button onClick={() => setSelectedEvent(null)} className="ms-auto text-xs" style={{ color: 'var(--muted-fg)' }}>✕</button>
            </div>
            <h3 className="text-sm font-bold" style={{ fontFamily: 'var(--font-display)' }}>{selectedEvent.title}</h3>
            {[
              ['Date', selectedEvent.date],
              ['Source', selectedEvent.source],
              ['Classification', selectedEvent.classification],
              ['People', selectedEvent.list_names_people],
              ['Places', selectedEvent.list_names_places],
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
      <TimelineExportDialog isOpen={showExport} onClose={() => setShowExport(false)} filteredEvents={filtered} allEvents={allEvents} pageEvents={pageEvents} />
    </div>
  );
}
