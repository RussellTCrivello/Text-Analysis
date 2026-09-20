import React from 'react'
import { InfoModal } from './FormModal'
import { Btn } from './ui'
import { Attachment, Pencil } from './icons'
import type { Content, Source } from '../types'

interface Props {
  isOpen: boolean
  onClose: () => void
  content: Content | null
  source?: Source | null
  onAttach?: () => void
  onEdit?: () => void
}

export function ContentPreviewDialog({ isOpen, onClose, content, source, onAttach, onEdit }: Props) {
  if (!content) return null
  const metadata = [
    ['Source', source?.name ?? '—'],
    ['Date', content.date_content || '—'],
    ['Importance', content.importance == null ? '—' : `${Math.round(Number(content.importance) * 100)}%`],
  ]
  return (
    <InfoModal isOpen={isOpen} title="Content workspace" onClose={onClose} size="lg">
      <div className="flex flex-col gap-4">
        <header className="flex items-start gap-3 border-b pb-3" style={{ borderColor: 'var(--border)' }}>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-bold uppercase tracking-[0.12em] mb-1" style={{ color: 'var(--muted-fg-2)' }}>
              Contents / Preview
            </div>
            <h2 className="text-lg font-bold truncate" style={{ fontFamily: 'var(--font-display)', color: 'var(--fg)' }}>
              {content.title || '(No Title)'}
            </h2>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs" style={{ color: 'var(--muted-fg)' }}>
              <span>Content record</span>
              {source?.name && <span>{source.name}</span>}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {onEdit && <Btn size="sm" variant="subtle" onClick={onEdit} icon={<Pencil size="xs" />}>Edit</Btn>}
            {onAttach && <Btn size="sm" variant="subtle" onClick={onAttach} icon={<Attachment size="xs" />}>Attach</Btn>}
          </div>
        </header>

        <div className="grid grid-cols-2 gap-x-6 gap-y-3 rounded-[var(--radius)] border px-3 py-3 sm:grid-cols-4" style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}>
          {metadata.map(([label, value]) => (
            <div key={label} className="min-w-0">
              <div className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--muted-fg-2)' }}>{label}</div>
              <div className="mt-0.5 truncate text-xs font-semibold" style={{ color: 'var(--fg)' }}>{value}</div>
            </div>
          ))}
        </div>

        <section aria-label="Content body">
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--muted-fg)' }}>Overview</div>
          <div className="rounded-[var(--radius)] border p-4 text-sm leading-relaxed whitespace-pre-wrap" style={{ background: 'var(--surface)', borderColor: 'var(--border)', maxHeight: 340, overflowY: 'auto', color: 'var(--fg)' }}>
            {content.content_data || '(empty)'}
          </div>
        </section>

        {content.note && (
          <section>
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--muted-fg)' }}>Notes</div>
            <div className="text-sm" style={{ color: 'var(--muted-fg)' }}>{content.note}</div>
          </section>
        )}
      </div>
    </InfoModal>
  )
}
