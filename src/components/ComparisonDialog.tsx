import React from 'react';
import { InfoModal } from './FormModal';
import { DataTable, type Column } from './DataTable';
import { useTranslation } from '../i18n';
import type { Analysis } from '../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  analyses: Analysis[];
  contentTitle: (id: string) => string;
}

export function ComparisonDialog({ isOpen, onClose, analyses, contentTitle }: Props) {
  const { t } = useTranslation();
  const columns: Column<Analysis>[] = [
    { key: 'id', header: 'ID', width: '60px', render: a => <span className="font-mono text-xs">{a.id}</span> },
    { key: 'content_id', header: t.fields.content_id, width: '160px', render: a => <span className="truncate block text-xs">{contentTitle(a.content_id)}</span> },
    { key: 'classification', header: t.fields.classification, width: '140px' },
    { key: 'list_names_people', header: t.fields.list_names_people, width: '140px', render: a => <span className="text-xs truncate block max-w-[140px]" title={a.list_names_people}>{a.list_names_people || '—'}</span> },
    { key: 'list_names_places', header: t.fields.list_names_places, width: '140px', render: a => <span className="text-xs truncate block max-w-[140px]" title={a.list_names_places}>{a.list_names_places || '—'}</span> },
    { key: 'list_coordinates', header: t.fields.list_coordinates, width: '120px', render: a => <span className="text-xs truncate block max-w-[120px]" title={a.list_coordinates}>{a.list_coordinates || '—'}</span> },
    { key: 'list_sides', header: t.fields.list_sides, width: '130px', render: a => <span className="text-xs truncate block max-w-[130px]" title={a.list_sides}>{a.list_sides || '—'}</span> },
  ];

  if (analyses.length < 2) return null;

  return (
    <InfoModal isOpen={isOpen} title={t.messages.compareTitle} onClose={onClose} size="xl">
      <div className="mb-2 text-xs" style={{ color: 'var(--muted-fg)' }}>
        {t.messages.comparingHint.replace("{n}", String(analyses.length))}
      </div>
      <div style={{ height: 380, overflow: 'hidden' }}>
        <DataTable columns={columns} data={analyses} emptyText={t.messages.noAnalysisRecords} density="compact" />
      </div>
    </InfoModal>
  );
}
