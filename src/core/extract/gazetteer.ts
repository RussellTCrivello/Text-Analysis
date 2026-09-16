/**
 * Gazetteer — a small, extensible knowledge base of place names, organisation
 * suffixes and personal titles used by the extraction engine.
 *
 * The default set ships with the application, but entries can be added, edited
 * and removed at runtime from the Data Dictionary workspace and are persisted
 * with the rest of the workspace data — the extraction knowledge is user data,
 * not hard-coded behaviour.
 */

export type GazetteerKind = 'country' | 'city' | 'region' | 'organization' | 'keyword';

export interface GazetteerEntry {
  name: string;
  kind: GazetteerKind;
  /** ISO-ish country name the place belongs to. */
  country?: string;
  lat?: number;
  lon?: number;
  aliases?: string[];
  /** Built-in entries cannot be deleted, only extended. */
  builtin?: boolean;
}

export interface PlaceMatch {
  value: string;
  kind: GazetteerKind;
  country?: string;
  lat?: number;
  lon?: number;
  start: number;
  end: number;
  confidence: number;
}

type Row = [string, string, string?, number?, number?, string?];

/** name, kind, country, lat, lon, aliases (pipe separated) */
const SEED: Row[] = [
  ['Afghanistan', 'country', '', 33.93911, 67.709953],
  ['Algeria', 'country', '', 28.0339, 1.6596],
  ['Bahrain', 'country', '', 26.0667, 50.5577],
  ['Brazil', 'country', '', -14.235, -51.9253],
  ['Canada', 'country', '', 56.1304, -106.3468],
  ['China', 'country', '', 35.8617, 104.1954],
  ['Egypt', 'country', '', 26.8206, 30.8025, 'مصر'],
  ['Ethiopia', 'country', '', 9.145, 40.4897],
  ['France', 'country', '', 46.2276, 2.2137],
  ['Germany', 'country', '', 51.1657, 10.4515],
  ['India', 'country', '', 20.5937, 78.9629],
  ['Indonesia', 'country', '', -0.7893, 113.9213],
  ['Iran', 'country', '', 32.4279, 53.688, 'Persia|Islamic Republic of Iran|إيران'],
  ['Iraq', 'country', '', 33.2232, 43.6793, 'العراق'],
  ['Israel', 'country', '', 31.0461, 34.8516],
  ['Italy', 'country', '', 41.8719, 12.5674],
  ['Japan', 'country', '', 36.2048, 138.2529],
  ['Jordan', 'country', '', 30.5852, 36.2384, 'Hashemite Kingdom of Jordan|الأردن'],
  ['Kuwait', 'country', '', 29.3117, 47.4818],
  ['Lebanon', 'country', '', 33.8547, 35.8623, 'لبنان'],
  ['Libya', 'country', '', 26.3351, 17.2283, 'ليبيا'],
  ['Malaysia', 'country', '', 4.2105, 101.9758],
  ['Mexico', 'country', '', 23.6345, -102.5528],
  ['Morocco', 'country', '', 31.7917, -7.0926],
  ['Netherlands', 'country', '', 52.1326, 5.2913, 'Holland'],
  ['Nigeria', 'country', '', 9.082, 8.6753],
  ['Oman', 'country', '', 21.4735, 55.9754],
  ['Pakistan', 'country', '', 30.3753, 69.3451],
  ['Palestine', 'country', '', 31.9522, 35.2332, 'Palestinian Territories|Gaza|West Bank'],
  ['Qatar', 'country', '', 25.3548, 51.1839, 'قطر'],
  ['Russia', 'country', '', 61.524, 105.3188, 'Russian Federation'],
  ['Saudi Arabia', 'country', '', 23.8859, 45.0792, 'KSA|Kingdom of Saudi Arabia|السعودية'],
  ['Somalia', 'country', '', 5.1521, 46.1996],
  ['South Africa', 'country', '', -30.5595, 22.9375],
  ['Spain', 'country', '', 40.4637, -3.7492],
  ['Sudan', 'country', '', 12.8628, 30.2176, 'السودان'],
  ['Sweden', 'country', '', 60.1282, 18.6435],
  ['Syria', 'country', '', 34.8021, 38.9968, 'Syrian Arab Republic|سوريا|سورية'],
  ['Tunisia', 'country', '', 33.8869, 9.5375],
  ['Turkey', 'country', '', 38.9637, 35.2433, 'Türkiye|تركيا'],
  ['Ukraine', 'country', '', 48.3794, 31.1656],
  ['United Arab Emirates', 'country', '', 23.4241, 53.8478, 'UAE|Emirates'],
  ['United Kingdom', 'country', '', 55.3781, -3.436, 'UK|Britain|Great Britain'],
  ['United States', 'country', '', 37.0902, -95.7129, 'USA|US|United States of America|America'],
  ['Yemen', 'country', '', 15.5527, 48.5164, 'اليمن'],

  ['London', 'city', 'United Kingdom', 51.5072, -0.1276],
  ['Washington D.C.', 'city', 'United States', 38.9072, -77.0369, 'Washington|Washington DC'],
  ['New York', 'city', 'United States', 40.7128, -74.006, 'NYC'],
  ['Paris', 'city', 'France', 48.8566, 2.3522],
  ['Berlin', 'city', 'Germany', 52.52, 13.405],
  ['Moscow', 'city', 'Russia', 55.7558, 37.6173],
  ['Beijing', 'city', 'China', 39.9042, 116.4074],
  ['Tokyo', 'city', 'Japan', 35.6762, 139.6503],
  ['New Delhi', 'city', 'India', 28.6139, 77.209, 'Delhi'],
  ['Cairo', 'city', 'Egypt', 30.0444, 31.2357, 'القاهرة'],
  ['Tehran', 'city', 'Iran', 35.6892, 51.389, 'طهران'],
  ['Baghdad', 'city', 'Iraq', 33.3152, 44.3661, 'بغداد'],
  ['Damascus', 'city', 'Syria', 33.5138, 36.2765, 'دمشق'],
  ['Aleppo', 'city', 'Syria', 36.2021, 37.1343, 'حلب'],
  ['Beirut', 'city', 'Lebanon', 33.8938, 35.5018, 'بيروت'],
  ['Amman', 'city', 'Jordan', 31.9539, 35.9106, 'عمان'],
  ['Jerusalem', 'city', 'Israel', 31.7683, 35.2137, 'القدس'],
  ['Gaza City', 'city', 'Palestine', 31.5017, 34.4668, 'Gaza|غزة'],
  ['Ramallah', 'city', 'Palestine', 31.9038, 35.2034, 'رام الله'],
  ['Riyadh', 'city', 'Saudi Arabia', 24.7136, 46.6753, 'الرياض'],
  ['Jeddah', 'city', 'Saudi Arabia', 21.4858, 39.1925, 'جدة'],
  ['Doha', 'city', 'Qatar', 25.2854, 51.531, 'الدوحة'],
  ['Abu Dhabi', 'city', 'United Arab Emirates', 24.4539, 54.3773, 'أبو ظبي'],
  ['Dubai', 'city', 'United Arab Emirates', 25.2048, 55.2708, 'دبي'],
  ['Kuwait City', 'city', 'Kuwait', 29.3759, 47.9774, 'الكويت'],
  ['Muscat', 'city', 'Oman', 23.588, 58.3829, 'مسقط'],
  ['Sanaa', 'city', 'Yemen', 15.3694, 44.191, 'صنعاء'],
  ['Tripoli', 'city', 'Libya', 32.8872, 13.1913, 'طرابلس'],
  ['Tunis', 'city', 'Tunisia', 36.8065, 10.1815, 'تونس'],
  ['Rabat', 'city', 'Morocco', 34.0209, -6.8416, 'الرباط'],
  ['Algiers', 'city', 'Algeria', 36.7538, 3.0588, 'الجزائر'],
  ['Khartoum', 'city', 'Sudan', 15.5007, 32.5599, 'الخرطوم'],
  ['Ankara', 'city', 'Turkey', 39.9334, 32.8597, 'أنقرة'],
  ['Istanbul', 'city', 'Turkey', 41.0082, 28.9784, 'إسطنبول'],
  ['Kyiv', 'city', 'Ukraine', 50.4501, 30.5234, 'Kiev'],
  ['Islamabad', 'city', 'Pakistan', 33.6844, 73.0479],
  ['Kabul', 'city', 'Afghanistan', 34.5553, 69.2075],
  ['Brussels', 'city', 'Belgium', 50.8503, 4.3517],
  ['Geneva', 'city', 'Switzerland', 46.2044, 6.1432],
  ['Vienna', 'city', 'Austria', 48.2082, 16.3738],
  ['Rome', 'city', 'Italy', 41.9028, 12.4964],
  ['Madrid', 'city', 'Spain', 40.4168, -3.7038],
  ['Singapore', 'city', 'Singapore', 1.3521, 103.8198],
  ['Jakarta', 'city', 'Indonesia', -6.2088, 106.8456],
  ['Nairobi', 'city', 'Kenya', -1.2921, 36.8219],
  ['Lagos', 'city', 'Nigeria', 6.5244, 3.3792],
  ['Mexico City', 'city', 'Mexico', 19.4326, -99.1332],
  ['Brasília', 'city', 'Brazil', -15.7975, -47.8919],
  ['Ottawa', 'city', 'Canada', 45.4215, -75.6972],
  ['Canberra', 'city', 'Australia', -35.2809, 149.13],
  ['Daraa', 'city', 'Syria', 32.6189, 36.1021, 'درعا'],
  ['Idlib', 'city', 'Syria', 35.9306, 36.6339, 'إدلب'],
  ['Homs', 'city', 'Syria', 34.7324, 36.7137, 'حمص'],
  ['Mosul', 'city', 'Iraq', 36.335, 43.1189, 'الموصل'],
  ['Basra', 'city', 'Iraq', 30.5085, 47.7804, 'البصرة'],
  ['Erbil', 'city', 'Iraq', 36.1911, 44.0092, 'أربيل'],
  ['Benghazi', 'city', 'Libya', 32.1167, 20.0667, 'بنغازي'],
  ['Aden', 'city', 'Yemen', 12.7855, 45.0187, 'عدن'],
  ['Hodeidah', 'city', 'Yemen', 14.7969, 42.9515, 'الحديدة'],
];

export const ORG_SUFFIXES = [
  'Inc', 'Ltd', 'LLC', 'Corp', 'Corporation', 'Company', 'Co', 'Group', 'Holdings', 'Bank', 'Agency',
  'Ministry', 'Commission', 'Committee', 'Council', 'Authority', 'Foundation', 'Institute', 'University',
  'Organization', 'Organisation', 'Association', 'Federation', 'Union', 'Party', 'Forces', 'Force',
  'Army', 'Police', 'Intelligence', 'Agency', 'Bureau', 'Department', 'Office', 'Coalition', 'Movement',
  'News', 'Times', 'Post', 'Journal', 'Media', 'Broadcasting', 'Channel', 'Press',
  'Nations', 'Fund', 'Program', 'Programme', 'Society', 'Chamber', 'Administration', 'Service',
  'وزارة', 'منظمة', 'منظمه', 'حزب', 'شركة', 'بنك', 'جامعة', 'لجنة', 'مجلس', 'هيئة', 'وكالة', 'قوات',
  'جيش', 'شرطة', 'مؤسسة', 'اتحاد', 'حركة', 'ائتلاف', 'جبهة', 'صحيفة', 'قناة',
];

export const PERSON_TITLES_EN = [
  'Mr', 'Mrs', 'Ms', 'Dr', 'Prof', 'Professor', 'President', 'Vice President', 'Prime Minister',
  'Minister', 'Secretary', 'Senator', 'Rep', 'Governor', 'Mayor', 'Ambassador', 'Envoy', 'General',
  'Colonel', 'Captain', 'Major', 'Commander', 'Admiral', 'Chief', 'Director', 'Chairman', 'Chairwoman',
  'Commissioner', 'Spokesman', 'Spokeswoman', 'Analyst', 'Commander', 'King', 'Queen', 'Prince',
  'Princess', 'Sheikh', 'Emir', 'Sultan', 'Ayatollah', 'Pope', 'Bishop', 'Judge', 'Attorney',
];

export const PERSON_TITLES_AR = [
  'السيد', 'السيدة', 'الدكتور', 'الدكتورة', 'الأستاذ', 'الرئيس', 'نائب الرئيس', 'رئيس الوزراء',
  'الوزير', 'وزيرة', 'الأمين', 'السيناتور', 'النائب', 'الحاكم', 'السفير', 'المبعوث', 'الجنرال',
  'العقيد', 'النقيب', 'القائد', 'اللواء', 'الشيخ', 'الأمير', 'الملك', 'الملكة', 'المحلل', 'القاضي',
];

/** Words that look like names but are not (sentence starters, common nouns). */
export const NON_NAME_WORDS = new Set([
  'The','This','That','These','Those','However','Meanwhile','According','Although','Because','After',
  'Before','Also','Then','Thus','Therefore','Moreover','Furthermore','Nevertheless','Additionally',
  'Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday','January','February','March',
  'April','May','June','July','August','September','October','November','December','Today','Yesterday',
  'Tomorrow','Earlier','Later','Soon','Recently','Officials','Sources','Reports','Analysts','Experts',
  'Residents','Witnesses','Journalists','Troops','Forces','Both','Some','Many','Most','All','Each',
  'Several','Hundreds','Thousands','Millions','North','South','East','West','Central','Northern',
  'Southern','Eastern','Western','Foreign','Local','International','National','Regional','Global',
]);

export const STOPWORDS_EN = new Set([
  'the','a','an','and','or','but','if','then','than','that','this','these','those','of','in','on','at',
  'to','for','with','without','from','by','as','is','are','was','were','be','been','being','it','its',
  'they','them','their','he','she','his','her','we','our','you','your','i','not','no','nor','so','such',
  'will','would','can','could','should','may','might','must','have','has','had','do','does','did','about',
  'into','over','under','after','before','between','during','through','against','among','which','who',
  'whom','what','when','where','why','how','all','any','both','each','few','more','most','other','some',
  'one','two','three','also','said','says','say','according','per','up','down','out','off','only','own',
  'same','too','very','just','now','new','last','next','year','years','day','days','time','times',
]);

export const STOPWORDS_AR = new Set([
  'في','من','على','إلى','عن','مع','هذا','هذه','ذلك','التي','الذي','الذين','ما','لا','لم','لن','أن','إن',
  'كان','كانت','قد','بين','بعد','قبل','حتى','عند','كل','بعض','غير','أو','و','ثم','لكن','بل','هو','هي',
  'هم','هن','أنا','نحن','أنت','أنتم','قال','قالت','يوم','عام','سنة','حسب','وفق','نحو','حول','ذلك',
]);

export class Gazetteer {
  private entries: GazetteerEntry[] = [];
  private index = new Map<string, GazetteerEntry>();

  constructor(entries: GazetteerEntry[] = defaultEntries()) {
    this.entries = entries.map((e) => ({ ...e }));
    this.rebuild();
  }

  private rebuild(): void {
    this.index = new Map();
    for (const entry of this.entries) {
      this.index.set(norm(entry.name), entry);
      for (const alias of entry.aliases ?? []) this.index.set(norm(alias), entry);
    }
  }

  get size(): number {
    return this.entries.length;
  }

  list(kind?: GazetteerKind): GazetteerEntry[] {
    return kind ? this.entries.filter((e) => e.kind === kind) : [...this.entries];
  }

  lookup(name: string): GazetteerEntry | undefined {
    return this.index.get(norm(name));
  }

  upsert(entry: GazetteerEntry): void {
    const key = norm(entry.name);
    const existing = this.entries.findIndex((e) => norm(e.name) === key);
    if (existing >= 0) this.entries[existing] = { ...this.entries[existing], ...entry, name: this.entries[existing].name };
    else this.entries.push({ ...entry });
    this.rebuild();
  }

  remove(name: string): boolean {
    const before = this.entries.length;
    this.entries = this.entries.filter((e) => !(norm(e.name) === norm(name) && !e.builtin));
    this.rebuild();
    return this.entries.length !== before;
  }

  toJSON(): GazetteerEntry[] {
    return this.entries.map((e) => ({ ...e }));
  }

  static fromJSON(raw: unknown): Gazetteer {
    const custom = Array.isArray(raw) ? (raw as GazetteerEntry[]) : [];
    const g = new Gazetteer(defaultEntries());
    for (const entry of custom) g.upsert(entry);
    return g;
  }

  /** Longest-match scan for known places across the text. */
  matchPlaces(text: string, minWords = 1): PlaceMatch[] {
    const matches: PlaceMatch[] = [];
    const lower = text.toLowerCase();
    const names = [...this.index.entries()].sort((a, b) => b[0].length - a[0].length);
    const used = new Array<boolean>(text.length).fill(false);

    for (const [key, entry] of names) {
      if (key.length < 3) continue;
      if (entry.kind !== 'country' && entry.kind !== 'city' && entry.kind !== 'region') continue;
      const wordCount = key.split(/\s+/).length;
      if (wordCount < minWords) continue;
      let from = 0;
      while (from < lower.length) {
        const at = findWord(lower, key, from);
        if (at === -1) break;
        const end = at + key.length;
        if (!used.slice(at, end).some(Boolean)) {
          for (let i = at; i < end; i++) used[i] = true;
          matches.push({
            value: text.slice(at, end),
            kind: entry.kind,
            country: entry.country || (entry.kind === 'country' ? entry.name : undefined),
            lat: entry.lat,
            lon: entry.lon,
            start: at,
            end,
            confidence: entry.kind === 'country' ? 0.95 : 0.85,
          });
        }
        from = end;
      }
    }
    return matches.sort((a, b) => a.start - b.start);
  }

  orgSuffixes(): string[] {
    return ORG_SUFFIXES;
  }

  personTitles(language: 'en' | 'ar' = 'en'): string[] {
    return language === 'ar' ? PERSON_TITLES_AR : [...PERSON_TITLES_EN, ...PERSON_TITLES_AR];
  }

  stopwords(language: 'en' | 'ar' = 'en'): Set<string> {
    return language === 'ar' ? STOPWORDS_AR : STOPWORDS_EN;
  }
}

export function defaultEntries(): GazetteerEntry[] {
  return SEED.map(([name, kind, country, lat, lon, aliases]) => ({
    name,
    kind: kind as GazetteerKind,
    country: country || undefined,
    lat,
    lon,
    aliases: aliases ? aliases.split('|') : undefined,
    builtin: true,
  }));
}

function norm(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Word-boundary search that also works for Arabic (no \b support for non-Latin). */
function findWord(haystack: string, needle: string, from: number): number {
  let at = haystack.indexOf(needle, from);
  while (at !== -1) {
    const before = haystack[at - 1] ?? ' ';
    const after = haystack[at + needle.length] ?? ' ';
    const okBefore = !/[\p{L}\p{N}]/u.test(before);
    const okAfter = !/[\p{L}\p{N}]/u.test(after);
    if (okBefore && okAfter) return at;
    at = haystack.indexOf(needle, at + 1);
  }
  return -1;
}
