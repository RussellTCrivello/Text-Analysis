/**
 * Coordinate extraction and geography helpers.
 *
 * Understands decimal pairs ("33.5138, 36.2765"), DMS ("33°30'50\"N 36°16'35\"E"),
 * decimal minutes ("33°30.5'N") and hemispheric prefixes ("N33.5 E36.2").
 */

export interface Coordinate {
  lat: number;
  lon: number;
  raw: string;
  format: 'decimal' | 'dms' | 'decimal-minutes';
  start: number;
  end: number;
  confidence: number;
}

const DECIMAL_PAIR = /(-?\d{1,3}(?:\.\d+)?)\s*[,;/]\s*(-?\d{1,3}(?:\.\d+)?)/g;
const HEMISPHERIC = /([NSns])\s*(-?\d{1,3}(?:\.\d+)?)\s*[,;/]?\s*([EWew])\s*(-?\d{1,3}(?:\.\d+)?)/g;
const DMS =
  /(\d{1,3})\s*[°º]\s*(\d{1,2})\s*['′’]\s*(?:(\d{1,2}(?:\.\d+)?)\s*["″”]\s*)?([NSns])\s*[,;/]?\s*(\d{1,3})\s*[°º]\s*(\d{1,2})\s*['′’]\s*(?:(\d{1,2}(?:\.\d+)?)\s*["″”]\s*)?([EWew])/g;
const DECIMAL_MINUTES =
  /(\d{1,3})\s*[°º]\s*(\d{1,2}(?:\.\d+)?)\s*['′’]\s*([NSns])\s*[,;/]?\s*(\d{1,3})\s*[°º]\s*(\d{1,2}(?:\.\d+)?)\s*['′’]\s*([EWew])/g;

export function isValidCoordinate(lat: number, lon: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
}

export function parseCoordinatePair(value: string): { lat: number; lon: number } | null {
  const cleaned = value.trim();
  if (!cleaned) return null;

  DMS.lastIndex = 0;
  const dms = DMS.exec(cleaned);
  if (dms) {
    const lat = dmsToDecimal(+dms[1], +dms[2], dms[3] ? +dms[3] : 0, dms[4]);
    const lon = dmsToDecimal(+dms[5], +dms[6], dms[7] ? +dms[7] : 0, dms[8]);
    if (isValidCoordinate(lat, lon)) return { lat, lon };
  }

  DECIMAL_PAIR.lastIndex = 0;
  const pair = DECIMAL_PAIR.exec(cleaned);
  if (pair) {
    const lat = parseFloat(pair[1]);
    const lon = parseFloat(pair[2]);
    if (isValidCoordinate(lat, lon)) return { lat, lon };
  }
  return null;
}

function dmsToDecimal(degrees: number, minutes: number, seconds: number, hemisphere: string): number {
  const sign = /[SsWw]/.test(hemisphere) ? -1 : 1;
  return sign * (Math.abs(degrees) + minutes / 60 + seconds / 3600);
}

export function extractCoordinates(text: string): Coordinate[] {
  const out: Coordinate[] = [];
  const taken: [number, number][] = [];
  const overlaps = (start: number, end: number) => taken.some(([s, e]) => start < e && end > s);

  DMS.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = DMS.exec(text))) {
    const lat = dmsToDecimal(+m[1], +m[2], m[3] ? +m[3] : 0, m[4]);
    const lon = dmsToDecimal(+m[5], +m[6], m[7] ? +m[7] : 0, m[8]);
    if (!isValidCoordinate(lat, lon)) continue;
    const start = m.index;
    const end = start + m[0].length;
    taken.push([start, end]);
    out.push({ lat, lon, raw: m[0], format: 'dms', start, end, confidence: 0.97 });
  }

  DECIMAL_MINUTES.lastIndex = 0;
  while ((m = DECIMAL_MINUTES.exec(text))) {
    const start = m.index;
    const end = start + m[0].length;
    if (overlaps(start, end)) continue;
    const lat = dmsToDecimal(+m[1], +m[2], 0, m[3]);
    const lon = dmsToDecimal(+m[4], +m[5], 0, m[6]);
    if (!isValidCoordinate(lat, lon)) continue;
    taken.push([start, end]);
    out.push({ lat, lon, raw: m[0], format: 'decimal-minutes', start, end, confidence: 0.93 });
  }

  HEMISPHERIC.lastIndex = 0;
  while ((m = HEMISPHERIC.exec(text))) {
    const start = m.index;
    const end = start + m[0].length;
    if (overlaps(start, end)) continue;
    const lat = parseFloat(m[2]) * (/[Ss]/.test(m[1]) ? -1 : 1);
    const lon = parseFloat(m[4]) * (/[Ww]/.test(m[3]) ? -1 : 1);
    if (!isValidCoordinate(lat, lon)) continue;
    taken.push([start, end]);
    out.push({ lat, lon, raw: m[0], format: 'decimal', start, end, confidence: 0.9 });
  }

  DECIMAL_PAIR.lastIndex = 0;
  while ((m = DECIMAL_PAIR.exec(text))) {
    const start = m.index;
    const end = start + m[0].length;
    if (overlaps(start, end)) continue;
    const lat = parseFloat(m[1]);
    const lon = parseFloat(m[2]);
    // Require at least one decimal digit on both sides: "2024, 2025" is not a coordinate.
    if (!/\./.test(m[1]) || !/\./.test(m[2])) continue;
    if (!isValidCoordinate(lat, lon)) continue;
    // Reject pairs that are plainly not geographic (both tiny, or lat==lon duplicates).
    if (Math.abs(lat) < 0.001 && Math.abs(lon) < 0.001) continue;
    taken.push([start, end]);
    out.push({ lat, lon, raw: m[0], format: 'decimal', start, end, confidence: 0.72 });
  }

  return out.sort((a, b) => a.start - b.start);
}

export function formatCoordinate(lat: number, lon: number, digits = 4): string {
  return `${lat.toFixed(digits)}, ${lon.toFixed(digits)}`;
}

/** Great-circle distance in kilometres (haversine). */
export function distanceKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const s =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** URL for the desktop application's "View on Map" action. */
export function mapUrl(lat: number, lon: number, zoom = 12): string {
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=${zoom}/${lat}/${lon}`;
}

/** Centroid + spread of a set of coordinates (used by the map/statistics views). */
export function centroid(coords: { lat: number; lon: number }[]): { lat: number; lon: number } | null {
  if (!coords.length) return null;
  const lat = coords.reduce((s, c) => s + c.lat, 0) / coords.length;
  const lon = coords.reduce((s, c) => s + c.lon, 0) / coords.length;
  return { lat, lon };
}
