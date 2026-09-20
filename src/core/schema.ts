/**
 * Schema registry — the single source of truth for the data model.
 *
 * Every other layer (forms, tables, validation, import mapping, export columns,
 * the SQL engine, search, statistics, timeline) derives its behaviour from this
 * registry instead of hard-coding field names. Adding a field means editing one
 * declaration here; the rest of the application picks it up automatically.
 */

export type EntityName = 'sources' | 'contents' | 'analyses';

export type FieldKind =
  | 'id'
  | 'text'
  | 'textarea'
  | 'url'
  | 'number'
  | 'date'
  | 'list'
  | 'ref';

export interface FieldSpec {
  key: string;
  kind: FieldKind;
  /** i18n key under `fields.*` */
  labelKey: string;
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  unique?: boolean;
  /** System-maintained: never edited by the user, not offered in import mapping. */
  system?: boolean;
  /** Foreign key reference. */
  ref?: { entity: EntityName; labelField: string };
  /** Header spellings recognised when importing files. */
  importAliases?: string[];
  /** Excluded from exports by default (user can still opt in). */
  exportDefault?: boolean;
  /** Included in free-text search. */
  searchable?: boolean;
  /** Show as percentage (0..1 → 0..100%). */
  format?: 'percent' | 'date' | 'datetime' | 'text';
  defaultValue?: string | number;
  /** Free-text autocomplete source: existing values of this column. */
  autoComplete?: boolean;
  /**
   * Key of the user-editable vocabulary that backs this field's option list
   * (see core/vocabulary). The list is extensible from the frontend; values
   * already stored in records are always accepted.
   */
  vocabulary?: string;
  /** Date fields capture date *and* time. */
  withTime?: boolean;
}

export interface EntitySpec {
  name: EntityName;
  /** i18n key holding the singular noun, e.g. `sections.sources.add` → "Add Source" */
  titleKey: string;
  idPrefix: string;
  /** Field used as the human readable title of a record. */
  titleField: string;
  /** Resolution order used to pick the "event date" for the timeline. */
  dateFields: string[];
  /** Child → parent relation (drives cascade deletes and joins). */
  parent?: { field: string; entity: EntityName };
  /** Extra columns produced by joining the parent (available to SQL/search/export). */
  derived?: { key: string; labelKey: string; from: string }[];
  fields: FieldSpec[];
}

const SYSTEM_FIELDS = (dateEntryAlias?: string): FieldSpec[] => {
  const f: FieldSpec[] = [
    {
      key: 'date_creation',
      kind: 'date',
      labelKey: 'date_creation',
      system: true,
      format: 'datetime',
      withTime: true,
      searchable: true,
      importAliases: ['created', 'created at', 'creation date', 'date created'],
    },
    {
      key: 'date_modified',
      kind: 'date',
      labelKey: 'date_modified',
      system: true,
      format: 'datetime',
      withTime: true,
      searchable: true,
      importAliases: ['modified', 'updated', 'updated at', 'modification date', 'last modified'],
    },
  ];
  if (dateEntryAlias) f[0].importAliases = [...(f[0].importAliases ?? []), dateEntryAlias];
  return f;
};

export const SCHEMA: Record<EntityName, EntitySpec> = {
  sources: {
    name: 'sources',
    titleKey: 'sections.sources.title',
    idPrefix: 's',
    titleField: 'name',
    dateFields: ['date_entry', 'date_creation'],
    fields: [
      { key: 'id', kind: 'id', labelKey: 'id', system: true, importAliases: ['id', 'source id', 'no', '#'] },
      {
        key: 'name',
        kind: 'text',
        labelKey: 'name',
        required: true,
        minLength: 2,
        unique: true,
        searchable: true,
        exportDefault: true,
        importAliases: ['name', 'source', 'source name', 'title', 'publication'],
      },
      {
        key: 'type',
        kind: 'text',
        labelKey: 'type',
        required: true,
        searchable: true,
        exportDefault: true,
        autoComplete: true,
        vocabulary: 'sources.type',
        importAliases: ['type', 'source type', 'category', 'kind'],
      },
      {
        key: 'link_sources',
        kind: 'url',
        labelKey: 'link_sources',
        searchable: true,
        exportDefault: true,
        importAliases: ['link', 'url', 'link_sources', 'website', 'href'],
      },
      {
        key: 'importance',
        kind: 'number',
        labelKey: 'importance',
        min: 0,
        max: 1,
        format: 'percent',
        defaultValue: 0,
        exportDefault: true,
        searchable: true,
        importAliases: ['importance', 'priority', 'weight', 'score'],
      },
      {
        key: 'country',
        kind: 'text',
        labelKey: 'country',
        required: true,
        searchable: true,
        exportDefault: true,
        autoComplete: true,
        importAliases: ['country', 'nation', 'country of origin'],
      },
      {
        key: 'city',
        kind: 'text',
        labelKey: 'city',
        searchable: true,
        exportDefault: true,
        autoComplete: true,
        importAliases: ['city', 'town', 'location'],
      },
      {
        key: 'description',
        kind: 'textarea',
        labelKey: 'description',
        searchable: true,
        exportDefault: true,
        importAliases: ['description', 'summary', 'abstract', 'about'],
      },
      {
        key: 'accounts',
        kind: 'list',
        labelKey: 'accounts',
        searchable: true,
        exportDefault: true,
        importAliases: ['accounts', 'account', 'handles', 'social'],
      },
      { key: 'note', kind: 'textarea', labelKey: 'note', searchable: true, importAliases: ['note', 'notes', 'comment'] },
      {
        key: 'ownership',
        kind: 'text',
        labelKey: 'ownership',
        searchable: true,
        autoComplete: true,
        importAliases: ['ownership', 'owner', 'owned by', 'parent'],
      },
      {
        key: 'date_entry',
        kind: 'date',
        labelKey: 'date_entry',
        format: 'datetime',
        withTime: true,
        searchable: true,
        exportDefault: true,
        importAliases: ['date_entry', 'entry date', 'date', 'entered'],
      },
      ...SYSTEM_FIELDS(),
    ],
  },

  contents: {
    name: 'contents',
    titleKey: 'sections.contents.title',
    idPrefix: 'c',
    titleField: 'title',
    dateFields: ['date_content', 'date_creation'],
    parent: { field: 'sources_id', entity: 'sources' },
    derived: [{ key: 'source_name', labelKey: 'sourceName', from: 'name' }],
    fields: [
      { key: 'id', kind: 'id', labelKey: 'id', system: true, importAliases: ['id', 'content id', '#'] },
      {
        key: 'sources_id',
        kind: 'ref',
        labelKey: 'sources_id',
        required: true,
        ref: { entity: 'sources', labelField: 'name' },
        exportDefault: true,
        searchable: true,
        importAliases: ['sources_id', 'source id', 'source_id', 'source', 'source name'],
      },
      {
        key: 'title',
        kind: 'text',
        labelKey: 'title',
        searchable: true,
        exportDefault: true,
        importAliases: ['title', 'headline', 'subject', 'name'],
      },
      {
        key: 'content_data',
        kind: 'textarea',
        labelKey: 'content_data',
        required: true,
        searchable: true,
        exportDefault: true,
        importAliases: ['content_data', 'content', 'text', 'body', 'data', 'full text'],
      },
      {
        key: 'attachments',
        kind: 'list',
        labelKey: 'attachments',
        searchable: true,
        importAliases: ['attachments', 'files', 'attachment'],
      },
      { key: 'note', kind: 'textarea', labelKey: 'note', searchable: true, importAliases: ['note', 'notes'] },
      {
        key: 'importance',
        kind: 'number',
        labelKey: 'importance',
        min: 0,
        max: 1,
        format: 'percent',
        defaultValue: 0,
        searchable: true,
        exportDefault: true,
        importAliases: ['importance', 'priority', 'score'],
      },
      {
        key: 'date_content',
        kind: 'date',
        labelKey: 'date_content',
        format: 'datetime',
        withTime: true,
        searchable: true,
        exportDefault: true,
        importAliases: ['date_content', 'content date', 'published', 'publication date', 'date'],
      },
      ...SYSTEM_FIELDS(),
    ],
  },

  analyses: {
    name: 'analyses',
    titleKey: 'sections.analysis.title',
    idPrefix: 'a',
    titleField: 'classification',
    dateFields: ['date_analysis', 'date_creation'],
    parent: { field: 'content_id', entity: 'contents' },
    derived: [
      { key: 'content_title', labelKey: 'title', from: 'title' },
      { key: 'source_name', labelKey: 'sourceName', from: 'name' },
    ],
    fields: [
      { key: 'id', kind: 'id', labelKey: 'id', system: true, importAliases: ['id', 'analysis id', '#'] },
      {
        key: 'content_id',
        kind: 'ref',
        labelKey: 'content_id',
        required: true,
        ref: { entity: 'contents', labelField: 'title' },
        searchable: true,
        exportDefault: true,
        importAliases: ['content_id', 'content id', 'content', 'content title'],
      },
      {
        key: 'classification',
        kind: 'text',
        labelKey: 'classification',
        required: true,
        minLength: 2,
        searchable: true,
        exportDefault: true,
        autoComplete: true,
        vocabulary: 'analyses.classification',
        importAliases: ['classification', 'category', 'topic', 'class'],
      },
      {
        key: 'list_names_people',
        kind: 'list',
        labelKey: 'list_names_people',
        searchable: true,
        exportDefault: true,
        importAliases: ['people', 'persons', 'list_names_people', 'names', 'who'],
      },
      {
        key: 'list_names_places',
        kind: 'list',
        labelKey: 'list_names_places',
        searchable: true,
        exportDefault: true,
        importAliases: ['places', 'locations', 'list_names_places', 'where', 'cities'],
      },
      {
        key: 'list_coordinates',
        kind: 'list',
        labelKey: 'list_coordinates',
        searchable: true,
        exportDefault: true,
        importAliases: ['coordinates', 'coords', 'list_coordinates', 'latlon', 'gps'],
      },
      {
        key: 'list_sides',
        kind: 'list',
        labelKey: 'list_sides',
        searchable: true,
        exportDefault: true,
        importAliases: ['sides', 'parties', 'list_sides', 'stakeholders', 'actors'],
      },
      {
        key: 'date_analysis',
        kind: 'date',
        labelKey: 'date_analysis',
        format: 'datetime',
        withTime: true,
        searchable: true,
        exportDefault: true,
        importAliases: ['date_analysis', 'analysis date', 'analyzed on', 'date'],
      },
      ...SYSTEM_FIELDS(),
    ],
  },
};

export const ENTITY_ORDER: EntityName[] = ['sources', 'contents', 'analyses'];

export function entitySpec(entity: EntityName): EntitySpec {
  return SCHEMA[entity];
}

export function fieldsOf(entity: EntityName): FieldSpec[] {
  return SCHEMA[entity].fields;
}

export function fieldOf(entity: EntityName, key: string): FieldSpec | undefined {
  return SCHEMA[entity].fields.find((f) => f.key === key);
}

/** Fields a user can edit in a form (excludes id + system timestamps). */
export function editableFields(entity: EntityName): FieldSpec[] {
  return SCHEMA[entity].fields.filter((f) => !f.system && f.kind !== 'id');
}

/** Fields shown in a table by default. */
export function defaultColumns(entity: EntityName): FieldSpec[] {
  return SCHEMA[entity].fields.filter((f) => f.exportDefault || f.kind === 'id');
}

/** Fields offered as import targets. */
export function importTargets(entity: EntityName): FieldSpec[] {
  return SCHEMA[entity].fields.filter((f) => f.kind !== 'id' && !f.system);
}

/** All column names visible to the SQL engine, including join-derived columns. */
export function sqlColumns(entity: EntityName): string[] {
  const spec = SCHEMA[entity];
  // Reports can temporarily hold a view name such as `all_records` while a
  // table selector is changing. Keep the schema helper total at the runtime
  // boundary instead of allowing a transient UI value to crash the workspace.
  if (!spec) return [];
  return [...spec.fields.map((f) => f.key), ...(spec.derived ?? []).map((d) => d.key)];
}

export type RecordShape = Record<string, unknown>;
