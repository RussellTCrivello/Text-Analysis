/**
 * Data Dictionary — the extensibility surface required by the spec. The place
 * gazetteer and the classification taxonomy that drive automated extraction are
 * editable here from the frontend, persisted with the workspace, and exported
 * as JSON so a team can share a vocabulary.
 */
import React, { useMemo, useState } from "react"
import {
  Btn,
  Field,
  Input,
  Select,
  Badge,
  InlineTabs,
  SearchInput,
  Toolbar,
  ToolbarSep,
  PageHeader,
  IconButton,
} from "../components/ui"
import {
  Close,
  ExportArrow,
  NavDictionary,
  Plus,
  Reset,
} from "../components/icons"
import { useAppData } from "../store/AppContext"
import { useTranslation } from "../i18n"
import { DEFAULT_TAXONOMY, type TaxonomyRule } from "../core/extract/engine"
import {
  defaultEntries,
  type GazetteerEntry,
  type GazetteerKind,
} from "../core/extract/gazetteer"

const KINDS: GazetteerKind[] = [
  "country",
  "city",
  "region",
  "organization",
  "keyword",
]

export function DictionaryView({ onToast }: { onToast: (m: string) => void }) {
  const { t } = useTranslation()
  const d = t.sections.dictionary
  const {
    gazetteer,
    taxonomy,
    setTaxonomy,
    addGazetteerEntry,
    removeGazetteerEntry,
    extract,
    data,
    vocabulary,
    vocabularyTick,
    addVocabularyValue,
    removeVocabularyValue,
    renameVocabularyValue,
    updateSource,
    updateContent,
    updateAnalysis,
  } = useAppData()
  const [vocabKey, setVocabKey] = useState<string>("sources.type")
  const [newValue, setNewValue] = useState("")
  const [renameFrom, setRenameFrom] = useState("")
  const [renameTo, setRenameTo] = useState("")

  const [tab, setTab] =
    useState<"gazetteer" | "taxonomy" | "vocabularies" | "test">("gazetteer")
  const [search, setSearch] = useState("")
  const [onlyCustom, setOnlyCustom] = useState(false)

  const [name, setName] = useState("")
  const [kind, setKind] = useState<GazetteerKind>("city")
  const [country, setCountry] = useState("")
  const [lat, setLat] = useState("")
  const [lon, setLon] = useState("")
  const [aliases, setAliases] = useState("")

  const [testText, setTestText] = useState("")

  const entries = useMemo(() => {
    const all = gazetteer.list()
    const q = search.trim().toLowerCase()
    return all.filter((e: GazetteerEntry) => {
      if (onlyCustom && e.builtin) return false
      if (!q) return true
      return `${e.name} ${(e.aliases ?? []).join(" ")} ${e.country ?? ""}`
        .toLowerCase()
        .includes(q)
    })
  }, [gazetteer, search, onlyCustom])

  const customCount = useMemo(
    () => gazetteer.list().filter((e) => !e.builtin).length,
    [gazetteer],
  )

  const addEntry = () => {
    const trimmed = name.trim()
    if (!trimmed) {
      onToast(d.nameRequired)
      return
    }
    const entry: GazetteerEntry = {
      name: trimmed,
      kind,
      country: country.trim() || undefined,
      lat: lat ? Number(lat) : undefined,
      lon: lon ? Number(lon) : undefined,
      aliases: aliases
        .split(",")
        .map((a) => a.trim())
        .filter(Boolean),
    }
    if ((lat && Number.isNaN(entry.lat)) || (lon && Number.isNaN(entry.lon))) {
      onToast(d.coordsNumeric)
      return
    }
    addGazetteerEntry(entry)
    setName("")
    setCountry("")
    setLat("")
    setLon("")
    setAliases("")
    onToast(d.entryAdded.replace("{n}", trimmed))
  }

  const exportVocabulary = () => {
    const payload = { gazetteer: gazetteer.toJSON(), taxonomy }
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    })
    const a = document.createElement("a")
    a.href = URL.createObjectURL(blob)
    a.download = "tam_vocabulary.json"
    a.click()
    URL.revokeObjectURL(a.href)
    onToast(d.vocabularyExported)
  }

  const resetTaxonomy = () => {
    if (!window.confirm(d.confirmReset)) return
    setTaxonomy(DEFAULT_TAXONOMY)
    onToast(d.taxonomyReset)
  }

  const test = useMemo(
    () => (testText.trim() ? extract(testText) : null),
    [testText, extract],
  )

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PageHeader
        eyebrow={t.nav.dictionaryDesc}
        title={t.nav.dictionary}
        subtitle={d.subtitle}
        icon={<NavDictionary size="md" />}
        count={{ value: customCount, label: d.custom }}
      />

      <Toolbar>
        <InlineTabs
          tabs={[
            {
              id: "gazetteer",
              label: `${d.tabGazetteer} (${customCount} ${d.custom})`,
            },
            { id: "taxonomy", label: `${d.tabTaxonomy} (${taxonomy.length})` },
            { id: "vocabularies", label: d.tabVocabularies },
            { id: "test", label: d.tabTest },
          ]}
          active={tab}
          onChange={(id) => setTab(id as typeof tab)}
        />
        <ToolbarSep />
        <Btn
          size="xs"
          onClick={exportVocabulary}
          icon={<ExportArrow size="xs" />}
        >
          {d.exportVocabulary}
        </Btn>
        <div className="flex-1" />
        <span className="text-[11px]" style={{ color: "var(--muted-fg)" }}>
          {d.appliesImmediately}
        </span>
      </Toolbar>

      {tab === "gazetteer" && (
        <div className="flex flex-1 overflow-hidden">
          {/* Editor */}
          <div
            className="w-80 shrink-0 flex flex-col gap-3 p-3 overflow-y-auto"
            style={{
              borderInlineEnd: "1px solid var(--border)",
              background: "var(--card-bg)",
            }}
          >
            <Field label={d.name} required>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={d.phPlace}
              />
            </Field>
            <Field label={d.kind}>
              <Select
                value={kind}
                onChange={(e) => setKind(e.target.value as GazetteerKind)}
                options={KINDS.map((k) => ({ value: k, label: k }))}
              />
            </Field>
            <Field label={d.country}>
              <Input
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                placeholder={d.phCountry}
              />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label={d.latitude}>
                <Input
                  value={lat}
                  onChange={(e) => setLat(e.target.value)}
                  placeholder="34.5983"
                />
              </Field>
              <Field label={d.longitude}>
                <Input
                  value={lon}
                  onChange={(e) => setLon(e.target.value)}
                  placeholder="43.6781"
                />
              </Field>
            </div>
            <Field label={d.aliases} hint={d.aliasesHint}>
              <Input
                value={aliases}
                onChange={(e) => setAliases(e.target.value)}
                placeholder={d.phAliases}
              />
            </Field>
            <Btn variant="primary" onClick={addEntry}>
              {t.actions.addNew}
            </Btn>
            <div className="text-[11px]" style={{ color: "var(--muted-fg)" }}>
              {d.extendHint}
            </div>
          </div>

          {/* List */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div
              className="flex items-center gap-2 p-2 shrink-0"
              style={{ borderBottom: "1px solid var(--border)" }}
            >
              <SearchInput
                value={search}
                onChange={setSearch}
                placeholder={d.filterGazetteer}
              />
              <label className="flex items-center gap-1.5 text-xs cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={onlyCustom}
                  onChange={() => setOnlyCustom(!onlyCustom)}
                />
                {d.customOnly}
              </label>
              <div className="flex-1" />
              <span
                className="text-[11px] shrink-0"
                style={{ color: "var(--muted-fg)" }}
              >
                {entries.length} {d.shown} · {defaultEntries().length}{" "}
                {d.builtIn}
              </span>
            </div>
            <div className="flex-1 overflow-auto">
              {entries.length === 0 && (
                <div
                  className="p-6 text-center text-xs"
                  style={{ color: "var(--muted-fg)" }}
                >
                  {t.messages.noRecords}
                </div>
              )}
              {entries.map((e: GazetteerEntry) => (
                <div
                  key={`${e.kind}:${e.name}`}
                  className="flex items-center gap-2 px-3 py-1.5 hover:bg-[var(--secondary-bg)] transition-colors"
                  style={{ borderBottom: "1px solid var(--border)" }}
                >
                  <Badge size="xs">{e.kind}</Badge>
                  <span
                    className="text-xs truncate"
                    style={{ flex: "1 1 auto" }}
                  >
                    {e.name}
                    {e.aliases?.length ? (
                      <span style={{ color: "var(--muted-fg)" }}>
                        {" "}
                        · {e.aliases.join(", ")}
                      </span>
                    ) : null}
                  </span>
                  {e.country && (
                    <span
                      className="text-[11px]"
                      style={{ color: "var(--muted-fg)" }}
                    >
                      {e.country}
                    </span>
                  )}
                  {e.lat !== undefined && e.lon !== undefined && (
                    <span
                      className="text-[11px]"
                      style={{
                        color: "var(--muted-fg)",
                        fontFamily: "var(--font-mono)",
                      }}
                    >
                      {e.lat}, {e.lon}
                    </span>
                  )}
                  {e.builtin ? (
                    <span
                      className="text-[10px]"
                      style={{ color: "var(--muted-fg)" }}
                    >
                      {d.builtIn}
                    </span>
                  ) : (
                    <IconButton
                      label={`${t.actions.delete} ${e.name}`}
                      danger
                      onClick={() => {
                        if (removeGazetteerEntry(e.name))
                          onToast(d.entryRemoved.replace("{n}", e.name))
                      }}
                    >
                      <Close size="xs" />
                    </IconButton>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === "taxonomy" && (
        <div className="flex-1 overflow-auto p-3">
          <div className="flex items-center gap-2 mb-3">
            <Btn
              size="xs"
              onClick={() =>
                setTaxonomy([
                  ...taxonomy,
                  { classification: d.newCategory, keywords: [] },
                ])
              }
              icon={<Plus size="xs" />}
            >
              {d.addCategory}
            </Btn>
            <Btn
              size="xs"
              variant="ghost"
              onClick={resetTaxonomy}
              icon={<Reset size="xs" />}
            >
              {d.resetDefaults}
            </Btn>
            <div className="flex-1" />
            <span className="text-[11px]" style={{ color: "var(--muted-fg)" }}>
              {d.taxonomyHint}
            </span>
          </div>
          {taxonomy.map((rule, idx) => (
            <div
              key={`${rule.classification}-${idx}`}
              className="mb-3 rounded-lg p-3"
              style={{
                background: "var(--card-bg)",
                border: "1px solid var(--border)",
              }}
            >
              <div className="flex items-center gap-2 mb-2">
                <Input
                  value={rule.classification}
                  onChange={(e) =>
                    setTaxonomy(
                      taxonomy.map((r, i) =>
                        i === idx
                          ? { ...r, classification: e.target.value }
                          : r,
                      ),
                    )
                  }
                  className="!w-72"
                />
                <div className="flex-1" />
                <Btn
                  size="xs"
                  variant="danger"
                  onClick={() =>
                    setTaxonomy(taxonomy.filter((_, i) => i !== idx))
                  }
                >
                  {t.actions.delete}
                </Btn>
              </div>
              <Input
                value={rule.keywords.join(", ")}
                onChange={(e) =>
                  setTaxonomy(
                    taxonomy.map((r, i) =>
                      i === idx
                        ? {
                            ...r,
                            keywords: e.target.value
                              .split(",")
                              .map((k) => k.trim())
                              .filter(Boolean),
                          }
                        : r,
                    ),
                  )
                }
                placeholder="comma, separated, keywords"
              />
              <div
                className="text-[11px] mt-1"
                style={{ color: "var(--muted-fg)" }}
              >
                {rule.keywords.length} {d.keywords}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "vocabularies" && (
        <div className="flex flex-1 overflow-hidden">
          <div
            className="w-64 shrink-0 overflow-y-auto p-2"
            style={{
              borderInlineEnd: "1px solid var(--border)",
              background: "var(--card-bg)",
            }}
          >
            {vocabulary.keys().map((key) => (
              <button
                key={key}
                onClick={() => {
                  setVocabKey(key)
                  setRenameFrom("")
                  setRenameTo("")
                }}
                className="w-full text-start px-3 py-2 text-xs rounded mb-1"
                style={{
                  background:
                    vocabKey === key ? "var(--primary)" : "transparent",
                  color: vocabKey === key ? "var(--primary-fg)" : "var(--fg)",
                }}
              >
                <div className="font-semibold">{key}</div>
                <div style={{ opacity: 0.75, fontSize: 10 }}>
                  {d.vocabValues.replace(
                    "{n}",
                    String(vocabulary.values(key).length),
                  )}
                </div>
              </button>
            ))}
          </div>

          <div className="flex-1 flex flex-col overflow-hidden">
            <div
              className="p-3 flex items-end gap-2 shrink-0"
              style={{ borderBottom: "1px solid var(--border)" }}
            >
              <Field label={d.vocabNewValue}>
                <Input
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                  placeholder={d.phVocabExample}
                />
              </Field>
              <Btn
                variant="primary"
                onClick={() => {
                  const result = addVocabularyValue(vocabKey, newValue)
                  if (result.created) {
                    setNewValue("")
                    onToast(
                      d.vocabAdded
                        .replace("{v}", result.entry.value)
                        .replace("{k}", vocabKey),
                    )
                  } else {
                    onToast(
                      result.reason === "empty"
                        ? t.messages.required
                        : d.vocabExists.replace("{v}", newValue.trim()),
                    )
                  }
                }}
              >
                {t.actions.addNew}
              </Btn>
              <div className="flex-1" />
              <span
                className="text-[11px]"
                style={{ color: "var(--muted-fg)" }}
              >
                {d.appliesImmediately}
              </span>
            </div>

            <div
              className="p-3 flex items-end gap-2 shrink-0"
              style={{ borderBottom: "1px solid var(--border)" }}
            >
              <Field label={d.vocabRenameFrom}>
                <Input
                  value={renameFrom}
                  onChange={(e) => setRenameFrom(e.target.value)}
                  placeholder={d.phExistingValue}
                />
              </Field>
              <Field label={d.vocabRenameTo}>
                <Input
                  value={renameTo}
                  onChange={(e) => setRenameTo(e.target.value)}
                  placeholder={d.phNewValue}
                />
              </Field>
              <Btn
                onClick={() => {
                  const result = renameVocabularyValue(
                    vocabKey,
                    renameFrom,
                    renameTo,
                  )
                  if (!result.ok) {
                    onToast(
                      d.vocabRenameFailed.replace(
                        "{r}",
                        String(result.reason ?? "unknown"),
                      ),
                    )
                    return
                  }
                  // Rewrite the records that used the old value so nothing is left behind.
                  const entity = vocabKey.split(
                    ".",
                  )[0] as "sources" | "contents" | "analyses"
                  const field = vocabKey.split(".")[1]
                  const rows = (entity === "sources"
                    ? data.sources
                    : entity === "contents"
                      ? data.contents
                      : data.analyses) as unknown as Record<string, unknown>[]
                  const affected = rows.filter(
                    (r) =>
                      String(r[field] ?? "").toLowerCase() ===
                      renameFrom.trim().toLowerCase(),
                  )
                  for (const row of affected) {
                    if (entity === "sources")
                      updateSource({
                        id: String(row.id),
                        [field]: result.canonical,
                      })
                    else if (entity === "contents")
                      updateContent({
                        id: String(row.id),
                        [field]: result.canonical,
                      })
                    else
                      updateAnalysis({
                        id: String(row.id),
                        [field]: result.canonical,
                      })
                  }
                  setRenameFrom("")
                  setRenameTo("")
                  onToast(
                    d.vocabRenamed
                      .replace("{v}", String(result.canonical))
                      .replace("{n}", String(affected.length)),
                  )
                }}
                disabled={!renameFrom.trim() || !renameTo.trim()}
              >
                {d.vocabRenameAction}
              </Btn>
            </div>

            <div className="flex-1 overflow-auto">
              {vocabulary
                .usage(
                  vocabKey,
                  (vocabKey.startsWith("sources")
                    ? data.sources
                    : vocabKey.startsWith("contents")
                      ? data.contents
                      : data.analyses) as unknown as Record<string, unknown>[],
                  vocabKey.split(".")[1],
                )
                .map(({ entry, count }) => (
                  <div
                    key={entry.value}
                    className="flex items-center gap-2 px-3 py-1.5 hover:bg-[var(--secondary-bg)] transition-colors"
                    style={{ borderBottom: "1px solid var(--border)" }}
                  >
                    <span
                      className="text-xs truncate"
                      style={{ flex: "1 1 auto" }}
                    >
                      {entry.value}
                    </span>
                    {entry.builtin && (
                      <span
                        className="text-[10px] uppercase tracking-wide"
                        style={{ color: "var(--muted-fg)" }}
                      >
                        built-in
                      </span>
                    )}
                    <span
                      className="text-[11px]"
                      style={{
                        color: "var(--muted-fg)",
                        fontFamily: "var(--font-mono)",
                      }}
                    >
                      {count} record(s)
                    </span>
                    <IconButton
                      label={t.actions.delete}
                      danger
                      disabled={!!entry.builtin || count > 0}
                      onClick={() => {
                        const result = removeVocabularyValue(
                          vocabKey,
                          entry.value,
                          count,
                        )
                        onToast(
                          result.ok
                            ? d.vocabRemoved.replace("{v}", entry.value)
                            : d.vocabCannotRemove.replace(
                                "{r}",
                                String(result.reason ?? "protected"),
                              ),
                        )
                      }}
                    >
                      <Close size="xs" />
                    </IconButton>
                  </div>
                ))}
            </div>
            <div
              className="px-3 py-2 text-[11px] shrink-0"
              style={{
                borderTop: "1px solid var(--border)",
                color: "var(--muted-fg)",
              }}
            >
              {d.vocabValuesIn
                .replace("{n}", String(vocabulary.values(vocabKey).length))
                .replace("{k}", vocabKey)}{" "}
              · {d.vocabFooter}
            </div>
          </div>
        </div>
      )}

      {tab === "test" && (
        <div className="flex-1 flex overflow-hidden">
          <div
            className="flex-1 flex flex-col p-3 gap-2"
            style={{ borderInlineEnd: "1px solid var(--border)" }}
          >
            <span
              className="text-[10px] uppercase tracking-wide font-semibold"
              style={{ color: "var(--muted-fg)" }}
            >
              {d.testDocument}
            </span>
            <textarea
              value={testText}
              onChange={(e) => setTestText(e.target.value)}
              rows={14}
              className="w-full text-xs p-2 rounded"
              style={{
                background: "var(--card-bg)",
                border: "1px solid var(--border)",
                fontFamily: "var(--font-mono)",
              }}
              placeholder={d.testPlaceholder}
            />
            <Btn size="xs" variant="ghost" onClick={() => setTestText("")}>
              {t.actions.clearFilters}
            </Btn>
          </div>
          <div className="flex-1 overflow-auto p-3 text-xs">
            {!test ? (
              <div style={{ color: "var(--muted-fg)" }}>{d.testEmpty}</div>
            ) : (
              <div className="flex flex-col gap-3">
                <div style={{ color: "var(--muted-fg)" }}>
                  {test.stats.words} words · {test.stats.language} ·{" "}
                  {test.stats.elapsedMs.toFixed(1)} ms
                </div>
                <Section
                  label={d.people}
                  values={test.people.map(
                    (p) => `${p.value} (${p.confidence.toFixed(2)})`,
                  )}
                />
                <Section
                  label={d.places}
                  values={test.places.map(
                    (p) => `${p.value} (${p.confidence.toFixed(2)})`,
                  )}
                />
                <Section
                  label={d.organizations}
                  values={test.organizations.map(
                    (p) => `${p.value} (${p.confidence.toFixed(2)})`,
                  )}
                />
                <Section
                  label={d.sides}
                  values={test.sides.map(
                    (p) => `${p.value} (${p.confidence.toFixed(2)})`,
                  )}
                />
                <Section
                  label={d.coordinates}
                  values={test.coordinates.map(
                    (c) => `${c.lat}, ${c.lon} (${c.confidence.toFixed(2)})`,
                  )}
                />
                <Section
                  label={d.dates}
                  values={test.dates.map((d) => `${d.value} (${d.kind})`)}
                />
                <Section
                  label={d.classifications}
                  values={test.classifications.map(
                    (c) => `${c.value} (${c.confidence.toFixed(2)})`,
                  )}
                />
                <div
                  className="rounded p-2"
                  style={{
                    background: "var(--secondary-bg)",
                    fontFamily: "var(--font-mono)",
                    fontSize: 11,
                  }}
                >
                  {test.suggestion.classification} ·{" "}
                  {test.suggestion.list_names_people} ·{" "}
                  {test.suggestion.list_names_places} ·{" "}
                  {test.suggestion.list_coordinates} ·{" "}
                  {test.suggestion.date_analysis}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function Section({ label, values }: { label: string; values: string[] }) {
  return (
    <div>
      <div
        className="text-[10px] uppercase tracking-wide font-semibold mb-1"
        style={{ color: "var(--muted-fg)" }}
      >
        {label} ({values.length})
      </div>
      {values.length === 0 ? (
        <div style={{ color: "var(--muted-fg)" }}>—</div>
      ) : (
        <div className="flex flex-wrap gap-1">
          {values.map((v) => (
            <Badge key={v} size="xs">
              {v}
            </Badge>
          ))}
        </div>
      )}
    </div>
  )
}