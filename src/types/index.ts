export type Language = 'en' | 'ar';
export type Theme = 'light' | 'dark';
export type Density = 'compact' | 'comfortable' | 'expansive';
export type NavSection = 'dashboard' | 'sources' | 'contents' | 'analysis' | 'allData' | 'timeline' | 'reports' | 'activity' | 'dictionary';
export type RecordType = 'source' | 'content' | 'analysis';
export type ColorBlindMode = 'none' | 'deuteranopia' | 'protanopia' | 'tritanopia';

export interface Source {
  id: string;
  name: string;
  type: string;
  link_sources: string;
  importance: number; // 0.0 – 1.0
  country: string;
  city: string;
  description: string;
  accounts: string;
  note: string;
  ownership: string;
  date_entry: string;
  date_creation: string;
  date_modified: string;
}

export interface Content {
  id: string;
  sources_id: string;
  title: string;
  content_data: string;
  attachments: string;
  note: string;
  importance: number; // 0.0 – 1.0
  date_content: string;
  date_creation: string;
  date_modified: string;
}

export interface Analysis {
  id: string;
  content_id: string;
  classification: string;
  list_names_people: string;
  list_names_places: string;
  list_coordinates: string;
  list_sides: string;
  date_analysis: string;
  date_creation: string;
  date_modified: string;
}

export interface AppSettings {
  language: Language;
  theme: Theme;
  fontSize: number;
  density: Density;
  // Accessibility
  highContrast: boolean;
  fontScale: number; // 100–200
  colorBlindMode: ColorBlindMode;
  keyboardShortcuts: boolean;
  focusIndicator: boolean;
  screenReader: boolean;
  // Performance
  defaultPageSize: number;
  autoSave: boolean;
  autoSaveInterval: number; // seconds
  /** Framework-owned table layouts, keyed by table identity. */
  tableLayouts: Record<string, unknown>;
}

export interface AppData {
  sources: Source[];
  contents: Content[];
  analyses: Analysis[];
}

export interface TimelineEvent {
  id: string;
  type: RecordType;
  date: string;
  title: string;
  summary: string;
  source: string;
  list_names_people: string;
  list_names_places: string;
  classification: string;
}

export interface BackupRecord {
  id: string;
  name: string;
  date_creation: string;
  data: AppData;
  sourceCount: number;
  contentCount: number;
  analysisCount: number;
}

export interface SavedSearch {
  id: string;
  name: string;
  conditions: SearchCondition[];
  logic: 'AND' | 'OR';
  target: RecordType | 'all';
  date_creation: string;
}

export interface SearchCondition {
  id: string;
  field: string;
  operator: string;
  value: string;
}

export interface SavedReport {
  id: string;
  name: string;
  sql: string;
  chartType: string;
  groupBy?: string;
  labelField: string;
  valueField: string;
  date_creation: string;
}
