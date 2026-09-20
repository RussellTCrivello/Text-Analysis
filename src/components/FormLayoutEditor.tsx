import React from "react"
import { Btn } from "./ui"
import { ChevronU, ChevronD } from "./icons"
import { useTranslation } from "../i18n"
import type { FormLayout } from "../core/formEngine"
import type { FieldMetadata } from "../core/framework"

export function FormLayoutEditor({ fields, layout, onChange, onReset }: { fields: FieldMetadata[]; layout: FormLayout; onChange: (next: FormLayout) => void; onReset: () => void }) {
  const { t } = useTranslation()
  const move = (key: string, delta: number) => {
    const order = [...layout.order]
    const index = order.indexOf(key)
    const next = index + delta
    if (index < 0 || next < 0 || next >= order.length) return
    ;[order[index], order[next]] = [order[next], order[index]]
    onChange({ ...layout, order })
  }
  const toggleHidden = (key: string) => onChange({ ...layout, hidden: layout.hidden.includes(key) ? layout.hidden.filter((item) => item !== key) : [...layout.hidden, key] })
  const toggleReadOnly = (key: string) => onChange({ ...layout, readOnly: layout.readOnly.includes(key) ? layout.readOnly.filter((item) => item !== key) : [...layout.readOnly, key] })
  const labelOf = (field: FieldMetadata) => (t.fields as Record<string, string>)[field.key] ?? field.label
  return <div className="flex flex-col gap-2">
    <div className="text-xs" style={{ color: "var(--muted-fg)" }}>{t.messages.layoutHint}</div>
    {fields.map((field, index) => {
      const label = labelOf(field)
      return <div key={field.key} className="flex items-center gap-2 rounded px-2 py-1.5" style={{ border: "1px solid var(--border)" }}>
      <span className="flex-1 text-sm">{label}</span>
      <button type="button" aria-label={t.messages.moveUp.replace("{f}", label)} title={t.messages.moveUp.replace("{f}", label)} disabled={index === 0} onClick={() => move(field.key, -1)}><ChevronU size="xs" /></button>
      <button type="button" aria-label={t.messages.moveDown.replace("{f}", label)} title={t.messages.moveDown.replace("{f}", label)} disabled={index === fields.length - 1} onClick={() => move(field.key, 1)}><ChevronD size="xs" /></button>
      <label className="text-xs"><input type="checkbox" checked={!layout.hidden.includes(field.key)} onChange={() => toggleHidden(field.key)} /> {t.messages.show}</label>
      <label className="text-xs"><input type="checkbox" checked={layout.readOnly.includes(field.key)} onChange={() => toggleReadOnly(field.key)} /> {t.messages.readOnlyLabel}</label>
    </div>
    })}
    <Btn size="xs" variant="ghost" onClick={onReset}>{t.messages.resetToDefault}</Btn>
  </div>
}
