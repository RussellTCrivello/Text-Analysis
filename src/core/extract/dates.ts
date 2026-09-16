/** Date extraction from free text (Latin and Arabic month names). */
import { parseDate } from '../text';

export interface DateMatch {
  value: string; // ISO
  raw: string;
  start: number;
  end: number;
  kind: 'iso' | 'numeric' | 'month-name' | 'month-year' | 'relative';
  confidence: number;
}

const ISO = /\b(\d{4})-(\d{2})-(\d{2})\b/g;
const NUMERIC = /\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})\b/g;
const MONTH_NAMES =
  '(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec|يناير|فبراير|مارس|أبريل|مايو|يونيو|يوليو|أغسطس|سبتمبر|أكتوبر|نوفمبر|ديسمبر|كانون الثاني|شباط|آذار|نيسان|أيار|حزيران|تموز|آب|أيلول|تشرين الأول|تشرين الثاني|كانون الأول)';
const MONTH_NAME_DAY_YEAR = new RegExp(`\\b(${MONTH_NAMES})\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s+(\\d{4})\\b`, 'g');
const DAY_MONTH_YEAR = new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?(${MONTH_NAMES}),?\\s+(\\d{4})\\b`, 'g');
const MONTH_YEAR = new RegExp(`\\b(${MONTH_NAMES})\\s+(\\d{4})\\b`, 'g');

export function extractDates(text: string): DateMatch[] {
  const out: DateMatch[] = [];
  const taken: [number, number][] = [];
  const push = (raw: string, start: number, end: number, kind: DateMatch['kind'], confidence: number) => {
    if (taken.some(([s, e]) => start < e && end > s)) return;
    const iso = parseDate(raw);
    if (!iso) return;
    taken.push([start, end]);
    out.push({ value: iso, raw, start, end, kind, confidence });
  };

  let m: RegExpExecArray | null;

  ISO.lastIndex = 0;
  while ((m = ISO.exec(text))) push(m[0], m.index, m.index + m[0].length, 'iso', 0.98);

  DAY_MONTH_YEAR.lastIndex = 0;
  while ((m = DAY_MONTH_YEAR.exec(text))) push(m[0], m.index, m.index + m[0].length, 'month-name', 0.9);

  MONTH_NAME_DAY_YEAR.lastIndex = 0;
  while ((m = MONTH_NAME_DAY_YEAR.exec(text))) push(m[0], m.index, m.index + m[0].length, 'month-name', 0.9);

  NUMERIC.lastIndex = 0;
  while ((m = NUMERIC.exec(text))) {
    const year = m[3].length === 2 ? `20${m[3]}` : m[3];
    if (+year < 1900 || +year > 2100) continue;
    push(m[0], m.index, m.index + m[0].length, 'numeric', 0.75);
  }

  MONTH_YEAR.lastIndex = 0;
  while ((m = MONTH_YEAR.exec(text))) {
    if (+m[2] < 1900 || +m[2] > 2100) continue;
    push(`${m[1]} 1, ${m[2]}`, m.index, m.index + m[0].length, 'month-year', 0.7);
  }

  return out.sort((a, b) => a.start - b.start);
}

/** Day-of-week for an ISO date (0 = Sunday). */
export function dayOfWeek(iso: string): number {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? -1 : d.getUTCDay();
}

export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const MONTH_NAMES_EN = [
  'January','February','March','April','May','June','July','August','September','October','November','December',
];

export function monthKey(iso: string): string {
  return iso.slice(0, 7);
}
