import React from 'react';
import { InfoModal } from './FormModal';
import { useTranslation } from '../i18n';
import type { Analysis } from '../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  analyses: Analysis[];
}

function topN<T>(arr: T[], n: number): T[] { return arr.slice(0, n); }

export function SummaryDialog({ isOpen, onClose, analyses }: Props) {
  const { t } = useTranslation();
  if (!isOpen) return null;

  const total = analyses.length;

  const classGroups: Record<string, number> = {};
  analyses.forEach(a => { const k = a.classification || t.messages.noValue; classGroups[k] = (classGroups[k] ?? 0) + 1; });
  const classSorted = Object.entries(classGroups).sort(([,a],[,b]) => b - a);

  const allPeople = analyses.flatMap(a => a.list_names_people.split(',').map(s => s.trim()).filter(Boolean));
  const uniquePeople = [...new Set(allPeople)];
  const allPlaces = analyses.flatMap(a => a.list_names_places.split(',').map(s => s.trim()).filter(Boolean));
  const uniquePlaces = [...new Set(allPlaces)];

  const withCoords = analyses.filter(a => a.list_coordinates.trim()).length;

  const stat = (label: string, value: string | number) => (
    <div className="flex items-baseline gap-3 py-1.5" style={{ borderBottom: '1px solid var(--border)' }}>
      <span className="text-xs w-44 shrink-0" style={{ color: 'var(--muted-fg)' }}>{label}</span>
      <span className="text-sm font-semibold">{value}</span>
    </div>
  );

  return (
    <InfoModal isOpen={isOpen} title={t.messages.analysisSummaryTitle} onClose={onClose} size="md">
      <div className="flex flex-col gap-1">
        {stat(t.messages.totalRecords, total)}
        <div className="py-1.5" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="text-xs mb-1 font-semibold uppercase tracking-wide" style={{ color: 'var(--muted-fg)' }}>{t.messages.byClassification}</div>
          {classSorted.map(([k, v]) => (
            <div key={k} className="flex items-center gap-2 py-0.5 text-xs">
              <span className="w-44 truncate">{k}</span>
              <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                <div className="h-full rounded-full" style={{ width: `${(v / total) * 100}%`, background: 'var(--primary)' }} />
              </div>
              <span className="w-16 text-end font-mono">{v} ({((v / total) * 100).toFixed(1)}%)</span>
            </div>
          ))}
        </div>
        {stat(t.messages.uniquePeople, uniquePeople.length)}
        {uniquePeople.length > 0 && (
          <div className="text-xs py-1 pl-2" style={{ color: 'var(--muted-fg)' }}>
            {t.messages.top5}: {topN(uniquePeople, 5).join(', ')}
          </div>
        )}
        {stat(t.messages.uniquePlaces, uniquePlaces.length)}
        {uniquePlaces.length > 0 && (
          <div className="text-xs py-1 pl-2" style={{ color: 'var(--muted-fg)' }}>
            {t.messages.top5}: {topN(uniquePlaces, 5).join(', ')}
          </div>
        )}
        {stat(t.messages.withCoordinates, `${withCoords} (${total > 0 ? ((withCoords / total) * 100).toFixed(1) : 0}%)`)}
      </div>
    </InfoModal>
  );
}
