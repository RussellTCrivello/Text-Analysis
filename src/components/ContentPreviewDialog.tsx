import React from 'react';
import { InfoModal } from './FormModal';
import type { Content, Source } from '../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  content: Content | null;
  source?: Source | null;
}

export function ContentPreviewDialog({ isOpen, onClose, content, source }: Props) {
  if (!content) return null;
  return (
    <InfoModal isOpen={isOpen} title="Preview Content" onClose={onClose} size="lg">
      <div className="flex flex-col gap-4">
        <h2 className="text-lg font-bold" style={{ fontFamily: 'var(--font-display)' }}>
          {content.title || '(No Title)'}
        </h2>
        <div className="text-xs" style={{ color: 'var(--muted-fg)' }}>
          Source: {source?.name ?? '—'} &nbsp;|&nbsp; Date: {content.date_content || '—'}
        </div>
        <div className="rounded-lg p-3 text-sm leading-relaxed whitespace-pre-wrap" style={{ background: 'var(--secondary-bg)', border: '1px solid var(--border)', maxHeight: 300, overflowY: 'auto' }}>
          {content.content_data || '(empty)'}
        </div>
        {content.note && (
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--muted-fg)' }}>Note</div>
            <div className="text-sm" style={{ color: 'var(--muted-fg)' }}>{content.note}</div>
          </div>
        )}
      </div>
    </InfoModal>
  );
}
