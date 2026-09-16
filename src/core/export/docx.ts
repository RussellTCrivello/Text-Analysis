/**
 * Word (.docx) document generation — OOXML written by hand, no third-party
 * libraries, so exports behave identically in tests, in the browser and in
 * any future host (mirrors the philosophy of core/export/exporters).
 *
 * The Word export deliberately does NOT use tables. It produces a structured
 * report built from first-class Word constructs:
 *
 *   • Title/Subtitle styles, an organisation masthead and a document number
 *   • a refreshable TOC field — every section uses real outline levels, so
 *     the Navigation pane and “References → Update Table” both work
 *   • numbered sections: Overview → per-field profiles → Records → Field guide
 *   • each record as its own Heading 3 with label→value definition lines that
 *     align on a right tab stop (never table cells)
 *   • page header and footer with the document number and Page X of Y fields
 *   • automatic right-to-left paragraphs when the data contains Arabic
 *   • core properties (title/subject/creator) for the Word info pane
 *
 * The classic grid rendering remains available as `docxLayout: 'table'` for
 * users who want the tabular document.
 */
import { escapeXml, type ExportColumn } from './exporters';
import { formatDate } from '../text';
import { createZip, type ZipEntry } from './zip';

export type WordLayout = 'report' | 'table';

export interface WordMeta {
  title?: string;
  subtitle?: string;
  headerLines?: string[];
  footerText?: string;
  docNumber?: string;
  generatedAt: string;
  /** Human description of the exported scope, e.g. "after filters". */
  scopeLabel?: string;
}

export interface WordOptions {
  layout: WordLayout;
  pageSize: 'a4' | 'letter';
  /** Used by the table layout; the report layout is always portrait. */
  orientation: 'portrait' | 'landscape';
  /** When true the overview gains a per-field coverage/statistics block. */
  stats: boolean;
  /** Records per numbered sub-block; 0 falls back to the default (25). */
  groupSize: number;
}

export interface WordArtifact {
  bytes: Uint8Array;
  documentXml: string;
  warnings: string[];
}

const ACCENT = '5B4FD6'; // iris — matches the app's --primary
const INK = '111827';
const MUTED = '4B5563';
const FAINT = '9CA3AF';
const RULE = 'E5E7EB';
const FONT_ASCII = '&quot;Source Sans 3&quot;, &quot;Segoe UI&quot;, Calibri, sans-serif';
const FONT_CS = 'Tahoma';
const PAGE_MARGIN = 1134; // 2 cm in twips

const RTL_SCRIPT = /[\u0590-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF]/;
const DASH = '\u2014';
const MID = '\u00b7';

function isRtl(matrix: string[][], meta: WordMeta): boolean {
  if (RTL_SCRIPT.test(`${meta.title ?? ''} ${meta.subtitle ?? ''} ${(meta.headerLines ?? []).join(' ')}`)) return true;
  return matrix.some((row) => row.some((cell) => RTL_SCRIPT.test(cell)));
}

function pageDims(pageSize: 'a4' | 'letter', landscape: boolean): { w: number; h: number } {
  const base = pageSize === 'letter' ? { w: 12240, h: 15840 } : { w: 11906, h: 16838 };
  return landscape ? { w: base.h, h: base.w } : base;
}

/* ------------------------------ OOXML helpers ------------------------------ */

interface RunStyle {
  b?: boolean;
  i?: boolean;
  caps?: boolean;
  color?: string;
  sz?: number; // half-points
  rtl?: boolean;
}

function runProps(s: RunStyle): string {
  const parts: string[] = [];
  if (s.caps) parts.push('<w:caps/>');
  if (s.b) parts.push('<w:b/><w:bCs/>');
  if (s.i) parts.push('<w:i/><w:iCs/>');
  if (s.color) parts.push(`<w:color w:val="${s.color}"/>`);
  if (s.sz) parts.push(`<w:sz w:val="${s.sz}"/><w:szCs w:val="${s.sz}"/>`);
  if (s.rtl) parts.push('<w:rtl/>');
  return parts.length ? `<w:rPr>${parts.join('')}</w:rPr>` : '';
}

function run(text: string, style: RunStyle = {}): string {
  return `<w:r>${runProps(style)}<w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r>`;
}

function runRaw(inner: string): string {
  return `<w:r>${inner}</w:r>`;
}

/** Word field with an optional cached result (shown until fields refresh). */
function fieldRun(instr: string, result?: string, style: RunStyle = {}): string {
  const props = runProps(style);
  return (
    runRaw(`<w:fldChar w:fldCharType="begin"/>${props}`) +
    runRaw(`<w:instrText xml:space="preserve">${instr}</w:instrText>${props}`) +
    runRaw(`<w:fldChar w:fldCharType="separate"/>${props}`) +
    (result !== undefined ? run(result, style) : '') +
    runRaw(`<w:fldChar w:fldCharType="end"/>${props}`)
  );
}

interface TabStop {
  pos: number;
  val?: 'left' | 'center' | 'right';
  leader?: 'dot' | 'hyphen';
}

interface ParaProps {
  style?: string;
  bidi?: boolean;
  jc?: 'left' | 'center' | 'right';
  tabs?: TabStop[];
  spacing?: { before?: number; after?: number; line?: number; lineRule?: 'auto' | 'exact' | 'atLeast' };
  ind?: { left?: number; right?: number; hanging?: number };
  keepNext?: boolean;
  keepLines?: boolean;
  pageBreakBefore?: boolean;
  bottomBorder?: { color: string; sz?: number; space?: number };
}

function pPr(p: ParaProps): string {
  const parts: string[] = [];
  if (p.style) parts.push(`<w:pStyle w:val="${p.style}"/>`);
  if (p.keepNext) parts.push('<w:keepNext/>');
  if (p.keepLines) parts.push('<w:keepLines/>');
  if (p.pageBreakBefore) parts.push('<w:pageBreakBefore/>');
  if (p.bottomBorder) {
    parts.push(
      `<w:pBdr><w:bottom w:val="single" w:sz="${p.bottomBorder.sz ?? 6}" w:space="${p.bottomBorder.space ?? 4}" w:color="${p.bottomBorder.color}"/></w:pBdr>`,
    );
  }
  if (p.tabs?.length) {
    parts.push(
      `<w:tabs>${p.tabs
        .map((t) => `<w:tab w:val="${t.val ?? 'right'}"${t.leader ? ` w:leader="${t.leader}"` : ''} w:pos="${t.pos}"/>`)
        .join('')}</w:tabs>`,
    );
  }
  if (p.bidi) parts.push('<w:bidi/>');
  if (p.spacing) {
    const a: string[] = [];
    if (p.spacing.before !== undefined) a.push(`w:before="${p.spacing.before}"`);
    if (p.spacing.after !== undefined) a.push(`w:after="${p.spacing.after}"`);
    if (p.spacing.line !== undefined) a.push(`w:line="${p.spacing.line}"`);
    if (p.spacing.lineRule) a.push(`w:lineRule="${p.spacing.lineRule}"`);
    parts.push(`<w:spacing ${a.join(' ')}/>`);
  }
  if (p.ind) {
    const a: string[] = [];
    if (p.ind.left !== undefined) a.push(`w:left="${p.ind.left}"`);
    if (p.ind.right !== undefined) a.push(`w:right="${p.ind.right}"`);
    if (p.ind.hanging !== undefined) a.push(`w:hanging="${p.ind.hanging}"`);
    parts.push(`<w:ind ${a.join(' ')}/>`);
  }
  if (p.jc) parts.push(`<w:jc w:val="${p.jc}"/>`);
  return parts.length ? `<w:pPr>${parts.join('')}</w:pPr>` : '';
}

function para(runs: string, props: ParaProps = {}): string {
  return `<w:p>${pPr(props)}${runs}</w:p>`;
}

/* ------------------------------ data analytics ----------------------------- */

/** Statistics the report narrates per field — computed from the real data. */
interface ColumnProfile {
  filled: number;
  empties: number;
  unique: number;
  numeric?: { n: number; min: number; max: number; mean: number; median: number };
  first?: string;
}

function profileColumn(values: string[], format?: ExportColumn['format']): ColumnProfile {
  const profile: ColumnProfile = { filled: 0, empties: 0, unique: 0 };
  const uniq = new Set<string>();
  const numbers: number[] = [];
  for (const value of values) {
    if (value === '' || value === DASH) {
      profile.empties++;
      continue;
    }
    profile.filled++;
    if (!profile.first) profile.first = value;
    uniq.add(value.toLowerCase());
    if (format !== 'date' && format !== 'datetime') {
      const n = Number(value.replace(/,/g, '').replace(/%$/, ''));
      if (!Number.isNaN(n)) numbers.push(n);
    }
  }
  profile.unique = uniq.size;
  const nonEmpty = values.filter((v) => v !== '' && v !== DASH).length;
  if (numbers.length >= 2 && numbers.length === nonEmpty) {
    const sorted = [...numbers].sort((a, b) => a - b);
    const sum = sorted.reduce((a, c) => a + c, 0);
    const mid = Math.floor(sorted.length / 2);
    profile.numeric = {
      n: sorted.length,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      mean: sum / sorted.length,
      median: sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2,
    };
  }
  return profile;
}

function roundStat(n: number): string {
  if (Number.isInteger(n)) return String(n);
  const abs = Math.abs(n);
  if (abs >= 1000) return n.toFixed(0);
  if (abs >= 10) return n.toFixed(1);
  return n.toFixed(2);
}

/* -------------------------------- styles.xml ------------------------------- */

const STYLES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:docDefaults>
<w:rPrDefault><w:rPr><w:rFonts w:ascii="${FONT_ASCII}" w:hAnsi="${FONT_ASCII}" w:cs="${FONT_CS}"/><w:sz w:val="21"/><w:szCs w:val="21"/><w:lang w:val="en-US" w:eastAsia="en-US" w:bidi="ar-SA"/></w:rPr></w:rPrDefault>
<w:pPrDefault><w:pPr><w:widowControl/><w:spacing w:after="140" w:line="264" w:lineRule="auto"/></w:pPr></w:pPrDefault>
</w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>
<w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:pPr><w:keepNext/><w:spacing w:before="320" w:after="60"/><w:jc w:val="center"/></w:pPr><w:rPr><w:b/><w:bCs/><w:color w:val="${INK}"/><w:sz w:val="52"/><w:szCs w:val="52"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Subtitle"><w:name w:val="Subtitle"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:pPr><w:keepNext/><w:spacing w:before="0" w:after="80"/><w:jc w:val="center"/></w:pPr><w:rPr><w:i/><w:iCs/><w:color w:val="${MUTED}"/><w:sz w:val="25"/><w:szCs w:val="25"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:pPr><w:keepNext/><w:keepLines/><w:spacing w:before="360" w:after="140"/><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:b/><w:bCs/><w:color w:val="${ACCENT}"/><w:sz w:val="32"/><w:szCs w:val="32"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:pPr><w:keepNext/><w:keepLines/><w:spacing w:before="240" w:after="100"/><w:outlineLvl w:val="1"/></w:pPr><w:rPr><w:b/><w:bCs/><w:color w:val="${INK}"/><w:sz w:val="26"/><w:szCs w:val="26"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading3"><w:name w:val="heading 3"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:pPr><w:keepNext/><w:keepLines/><w:spacing w:before="220" w:after="60"/><w:outlineLvl w:val="2"/></w:pPr><w:rPr><w:b/><w:bCs/><w:color w:val="${INK}"/><w:sz w:val="23"/><w:szCs w:val="23"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="ListParagraph"><w:name w:val="List Paragraph"/><w:basedOn w:val="Normal"/><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr><w:spacing w:after="60"/></w:pPr></w:style>
<w:style w:type="paragraph" w:styleId="Quote"><w:name w:val="Quote"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:pPr><w:spacing w:before="80" w:after="160"/><w:pBdr><w:left w:val="single" w:sz="14" w:space="8" w:color="${ACCENT}"/></w:pBdr><w:ind w:left="360" w:right="360"/></w:pPr><w:rPr><w:i/><w:iCs/><w:color w:val="${MUTED}"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Caption"><w:name w:val="caption"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:before="20" w:after="120"/></w:pPr><w:rPr><w:i/><w:iCs/><w:color w:val="${FAINT}"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Header"><w:name w:val="header"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:before="0" w:after="0"/><w:pBdr><w:bottom w:val="single" w:sz="4" w:space="2" w:color="${RULE}"/></w:pBdr></w:pPr><w:rPr><w:color w:val="${FAINT}"/><w:sz w:val="17"/><w:szCs w:val="17"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Footer"><w:name w:val="footer"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:before="0" w:after="0"/></w:pPr><w:rPr><w:color w:val="${FAINT}"/><w:sz w:val="17"/><w:szCs w:val="17"/></w:rPr></w:style>
<w:style w:type="character" w:default="1" w:styleId="DefaultParagraphFont"><w:name w:val="Default Paragraph Font"/></w:style>
<w:style w:type="table" w:default="1" w:styleId="TableNormal"><w:name w:val="Normal Table"/><w:tblPr><w:tblCellMar><w:top w:w="40" w:type="dxa"/><w:left w:w="80" w:type="dxa"/><w:bottom w:w="40" w:type="dxa"/><w:right w:w="80" w:type="dxa"/></w:tblCellMar></w:tblPr></w:style>
</w:styles>`;

/* ------------------------------ numbering.xml ------------------------------ */

const NUMBERING_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:abstractNum w:abstractNumId="0">
<w:multiLevelType w:val="hybridMultilevel"/>
<w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="\u25cf" w:cs="1"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="360" w:hanging="240"/></w:pPr></w:lvl>
<w:lvl w:ilvl="1"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="\u25e6" w:cs="1"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="720" w:hanging="240"/></w:pPr></w:lvl>
</w:abstractNum>
<w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>
</w:numbering>`;

/* ------------------------------ page furniture ----------------------------- */

function headerPara(headerLines: string[], docNumber: string, usable: number, rtl: boolean): string {
  const runs: string[] = [];
  for (const line of headerLines) runs.push(run(`${line}  ${MID}  `, { caps: true, sz: 15 }));
  if (runs.length) runs.push(runRaw('<w:tab/>'));
  if (docNumber) runs.push(run(docNumber));
  return para(runs.join(''), { style: 'Header', bidi: rtl, tabs: [{ pos: usable, val: 'right' }] });
}

function footerPara(footerText: string, generated: string, usable: number, rtl: boolean): string {
  const runs: string[] = [];
  if (footerText) runs.push(run(`${footerText}  ${MID}  `), runRaw('<w:tab/>'));
  else runs.push(run(`Generated ${generated}`), runRaw('<w:tab/>'));
  runs.push(
    fieldRun(' PAGE ', '1', { sz: 17, color: FAINT }),
    run(' of '),
    fieldRun(' NUMPAGES ', '1', { sz: 17, color: FAINT }),
  );
  return para(runs.join(''), { style: 'Footer', bidi: rtl, tabs: [{ pos: usable, val: 'right' }] });
}

const EMPTY_HEADER_PARA = '<w:p><w:pPr><w:spacing w:after="0"/></w:pPr></w:p>';

function headerXml(inner: string): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">${inner}${EMPTY_HEADER_PARA}</w:hdr>`;
}

function footerXml(inner: string): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">${inner}${EMPTY_HEADER_PARA}</w:ftr>`;
}

/* ------------------------------- report body ------------------------------- */

/**
 * Sequential document builder with automatic section numbering. Headings use
 * the style (which owns keepNext/outline levels); the builder only prepends
 * the computed number so Word can still repaginate and refresh the TOC.
 */
class ReportBuilder {
  private parts: string[] = [];
  private h1 = 0;
  private h2 = 0;
  private h3 = 0;
  private readonly rtl: boolean;
  private readonly usable: number;

  constructor(rtl: boolean, usable: number) {
    this.rtl = rtl;
    this.usable = usable;
  }

  get xml(): string {
    return this.parts.join('');
  }

  private push(s: string): void {
    this.parts.push(s);
  }

  raw(runsXml: string, props: ParaProps = {}): void {
    this.push(para(runsXml, { bidi: this.rtl, ...props }));
  }

  title(text: string): void {
    this.push(para(run(text, { b: true, sz: 52, color: INK }), { style: 'Title', bidi: this.rtl }));
  }

  subtitle(text: string): void {
    this.push(para(run(text, { i: true, sz: 25, color: MUTED }), { style: 'Subtitle', bidi: this.rtl }));
  }

  h1Line(text: string): void {
    this.h1++;
    this.h2 = 0;
    this.h3 = 0;
    this.push(para(run(`${this.h1}.  ${text}`, { b: true, sz: 32, color: ACCENT }), { style: 'Heading1', bidi: this.rtl }));
  }

  h2Line(text: string): void {
    this.h2++;
    this.h3 = 0;
    this.push(para(run(`${this.h1}.${this.h2}  ${text}`, { b: true, sz: 26, color: INK }), { style: 'Heading2', bidi: this.rtl }));
  }

  h3Line(text: string, opts: { pageBreak?: boolean } = {}): void {
    this.h3++;
    this.push(
      para(run(`${this.h1}.${this.h2}.${this.h3}  ${text}`, { b: true, sz: 23, color: INK }), {
        style: 'Heading3',
        bidi: this.rtl,
        pageBreakBefore: opts.pageBreak,
      }),
    );
  }

  text(text: string, props: ParaProps = {}): void {
    this.push(para(run(text, { sz: 21, color: INK }), { bidi: this.rtl, ...props }));
  }

  note(text: string): void {
    this.push(para(run(text, { i: true, sz: 17, color: FAINT }), { bidi: this.rtl, spacing: { after: 80 } }));
  }

  /** Definition line: bold label, right-aligned value on a tab stop — no table. */
  def(label: string, value: string): void {
    this.push(
      para(`${run(label, { b: true, sz: 20, color: MUTED })}${runRaw('<w:tab/>')}${run(value && value !== '' ? value : DASH, { sz: 21, color: INK })}`, {
        bidi: this.rtl,
        tabs: [{ pos: this.usable, val: 'right' }],
        spacing: { before: 20, after: 20, line: 240, lineRule: 'auto' },
        bottomBorder: { color: 'EEF0F4', sz: 4, space: 2 },
      }),
    );
  }

  bullet(text: string, opts: { muted?: boolean } = {}): void {
    this.push(para(run(text, { sz: 21, color: opts.muted ? MUTED : INK }), { style: 'ListParagraph', bidi: this.rtl }));
  }

  centered(text: string, props: ParaProps = {}): void {
    this.push(para(run(text, { sz: 18, color: FAINT }), { bidi: this.rtl, jc: 'center', ...props }));
  }

  tocField(): void {
    this.push(
      para(
        para('', {
          bidi: this.rtl,
          tabs: [{ pos: this.usable, val: 'right', leader: 'dot' }],
        }) + fieldRun(' TOC \\o "1-2" \\h \\z \\u ', undefined, { sz: 19, color: FAINT }),
        { bidi: this.rtl, spacing: { before: 40, after: 40 } },
      ),
    );
  }
}

function recordLabel(row: string[]): string {
  for (let i = 0; i < Math.min(row.length, 3); i++) {
    const cell = row[i];
    if (cell && cell !== DASH) return cell;
  }
  return '';
}

function buildReportBody(matrix: string[][], columns: ExportColumn[], meta: WordMeta, opts: WordOptions): string {
  const rtl = isRtl(matrix, meta);
  const page = pageDims(opts.pageSize, false);
  const usable = page.w - 2 * PAGE_MARGIN;
  const b = new ReportBuilder(rtl, usable);

  /* ------------------------------- masthead ------------------------------- */
  for (const line of meta.headerLines ?? []) {
    b.raw(run(line, { caps: true, sz: 18, color: FAINT }), { jc: 'center', keepNext: true, spacing: { before: 0, after: 20 } });
  }
  const ident: string[] = [];
  if (meta.docNumber) ident.push(`Document ${meta.docNumber}`);
  ident.push(`Generated ${formatDate(meta.generatedAt, true)}`);
  b.raw(run(ident.join(`  ${MID}  `), { sz: 17, color: FAINT }), { jc: 'center', keepNext: true, spacing: { before: 0, after: 200 } });

  /* --------------------------------- title --------------------------------- */
  b.title(meta.title || 'Export');
  if (meta.subtitle) b.subtitle(meta.subtitle);
  b.centered(
    `${matrix.length} ${matrix.length === 1 ? 'record' : 'records'}  ${MID}  ${columns.length} ${columns.length === 1 ? 'field' : 'fields'}  ${MID}  Word report (no tables)`,
    { spacing: { before: 60, after: 240 }, bottomBorder: { color: RULE, sz: 6, space: 10 } },
  );

  /* ------------------------------ contents -------------------------------- */
  b.tocField();
  b.note('Contents: right-click and choose “Update Field” (or press F9) to build the table of contents.');

  /* ------------------------------- overview ------------------------------- */
  b.h1Line('Overview');
  b.text(
    `This report presents ${matrix.length} ${matrix.length === 1 ? 'record' : 'records'} across ${columns.length} ${columns.length === 1 ? 'field' : 'fields'}${meta.scopeLabel ? `, scope: ${meta.scopeLabel}` : ''}. ` +
      `Each record is a numbered heading followed by label→value definition lines aligned on a right tab stop, so the document reflows at any page width, ` +
      `reads correctly with assistive technology, and can be restyled through Word themes or the styles in this package.`,
  );
  if (meta.subtitle) b.text(meta.subtitle);

  b.h2Line('Document control');
  b.def('Generated', formatDate(meta.generatedAt, true));
  b.def('Layout', 'Structured Word report (no tables)');
  b.def('Page setup', `${opts.pageSize === 'a4' ? 'A4' : 'Letter'} portrait, 2 cm margins`);
  b.def('Records', String(matrix.length));
  b.def('Fields per record', String(columns.length));
  if (meta.docNumber) b.def('Document number', meta.docNumber);
  for (const line of meta.headerLines ?? []) b.def('Organisation', line);
  if (meta.footerText) b.def('Footer note', meta.footerText);

  /* ---------------------------- column profiles ---------------------------- */
  if (opts.stats && matrix.length > 0) {
    b.h2Line('Field profiles');
    b.text(`Coverage and value statistics for every exported field, computed from the ${matrix.length} records in scope.`);
    columns.forEach((col, i) => {
      const values = matrix.map((row) => row[i] ?? '');
      const profile = profileColumn(values, col.format);
      b.h3Line(col.label);
      b.bullet(
        `${profile.filled} of ${matrix.length} records populated${profile.empties ? ` (${profile.empties} empty)` : ''} · ${profile.unique} distinct value${profile.unique === 1 ? '' : 's'}`,
      );
      if (profile.numeric) {
        const n = profile.numeric;
        b.bullet(`Numeric — min ${roundStat(n.min)} · median ${roundStat(n.median)} · mean ${roundStat(n.mean)} · max ${roundStat(n.max)} (n=${n.n})`);
      }
      if (col.format === 'date' || col.format === 'datetime') {
        const dates = values.filter(Boolean).sort();
        if (dates.length) b.bullet(`Date range — ${dates[0]} through ${dates[dates.length - 1]}`);
      }
      if (profile.first) b.bullet(`First value — “${profile.first.length > 90 ? `${profile.first.slice(0, 90)}…` : profile.first}”`, { muted: true });
    });
  }

  /* -------------------------------- records -------------------------------- */
  b.h1Line('Records');
  if (matrix.length === 0) {
    b.text('No records were included in this scope — adjust the filters or selection and export again.');
  } else {
    let chunkSize = opts.groupSize > 0 ? opts.groupSize : 25;
    while (Math.ceil(matrix.length / chunkSize) > 60) chunkSize *= 2;
    for (let start = 0; start < matrix.length; start += chunkSize) {
      const end = Math.min(start + chunkSize, matrix.length);
      b.h2Line(end - start === 1 ? `Record ${start + 1}` : `Records ${start + 1}–${end}`);
      if (start === 0) b.note('Use the Navigation pane or the refreshed contents above to jump between records.');
      for (let r = start; r < end; r++) {
        const row = matrix[r];
        const label = recordLabel(row);
        b.h3Line(label ? `${label}` : `Record ${r + 1}`);
        for (let c = 0; c < columns.length; c++) b.def(columns[c].label, row[c] ?? '');
      }
    }
  }

  /* ------------------------------ field guide ------------------------------ */
  b.h1Line('Field guide');
  b.text('Reference for every column shown in this report. Keys are the underlying identifiers, useful when matching this document to CSV, XLSX or JSON exports of the same rows.');
  columns.forEach((col) => {
    b.h3Line(col.label);
    b.def('Key', col.key);
    b.def('Formatting', col.format ? col.format : 'plain text');
    if (opts.stats && matrix.length) {
      const values = matrix.map((row) => row[columns.indexOf(col)] ?? '');
      const filled = values.filter((v) => v !== '' && v !== DASH).length;
      b.def('Populated in', `${filled} of ${matrix.length} records`);
    }
  });

  /* -------------------------------- closing -------------------------------- */
  b.centered(`End of report — ${matrix.length} record${matrix.length === 1 ? '' : 's'}${meta.docNumber ? ` · ${meta.docNumber}` : ''}`, {
    spacing: { before: 320, after: 0 },
    bottomBorder: { color: RULE, sz: 6, space: 10 },
  });

  return b.xml;
}

/* ----------------------------- table fallback ------------------------------ */

/** The pre-report Word rendering: a bordered grid, kept for `docxLayout: 'table'`. */
function buildTableBody(matrix: string[][], columns: ExportColumn[], meta: WordMeta): string {
  const esc = escapeXml;
  const paragraph = (text: string, style: { bold?: boolean; size?: number } = {}) =>
    `<w:p><w:pPr>${style.bold ? '<w:rPr><w:b/></w:rPr>' : ''}</w:pPr><w:r><w:rPr>${style.bold ? '<w:b/>' : ''}<w:sz w:val="${(style.size ?? 22) * 2}"/></w:rPr><w:t xml:space="preserve">${esc(text)}</w:t></w:r></w:p>`;

  const tableRows = [
    `<w:tr><w:trPr><w:tblHeader/></w:trPr>${columns
      .map(
        (c) =>
          `<w:tc><w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="0F766E"/></w:tcPr>${paragraph(c.label, { bold: true, size: 10 })}</w:tc>`,
      )
      .join('')}</w:tr>`,
    ...matrix.map(
      (row) => `<w:tr>${row.map((cell) => `<w:tc>${paragraph(cell, { size: 10 })}</w:tc>`).join('')}</w:tr>`,
    ),
  ];
  const grid = columns.map(() => '<w:gridCol w:w="1800"/>').join('');
  return [
    meta.title ? paragraph(meta.title, { bold: true, size: 16 }) : '',
    meta.subtitle ? paragraph(meta.subtitle, { size: 11 }) : '',
    `<w:tbl><w:tblPr><w:tblStyle w:val="TableGrid"/><w:tblW w:w="0" w:type="auto"/><w:tblBorders><w:top w:val="single" w:sz="4" w:color="CBD5E1"/><w:left w:val="single" w:sz="4" w:color="CBD5E1"/><w:bottom w:val="single" w:sz="4" w:color="CBD5E1"/><w:right w:val="single" w:sz="4" w:color="CBD5E1"/><w:insideH w:val="single" w:sz="4" w:color="CBD5E1"/><w:insideV w:val="single" w:sz="4" w:color="CBD5E1"/></w:tblBorders></w:tblPr><w:tblGrid>${grid}</w:tblGrid>${tableRows.join('')}</w:tbl>`,
    paragraph(`Generated ${meta.generatedAt.slice(0, 19).replace('T', ' ')} ${MID} ${matrix.length} records`, { size: 9 }),
  ].join('');
}

/* ------------------------------ package parts ------------------------------ */

function docPropsCore(title: string, subject: string): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
<dc:title>${escapeXml(title)}</dc:title>
<dc:subject>${escapeXml(subject)}</dc:subject>
<dc:creator>Text Analysis Manager</dc:creator>
<cp:keywords>export, report, structured</cp:keywords>
</cp:coreProperties>`;
}

const APP_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties">
<Application>Text Analysis Manager</Application>
</Properties>`;

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;

const ROOT_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`;

const DOC_RELS_REPORT = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>
<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/>
<Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>
</Relationships>`;

/* --------------------------------- entry ---------------------------------- */

/**
 * Build a complete OOXML .docx package. Returns the zip bytes, the raw
 * document.xml (used by tests and the preview) and user-facing warnings.
 */
export function buildWordDocument(
  matrix: string[][],
  columns: ExportColumn[],
  meta: WordMeta,
  opts: WordOptions,
): WordArtifact {
  const warnings: string[] = [];
  const rtl = isRtl(matrix, meta);
  const report = opts.layout === 'report';

  if (report && rtl) {
    warnings.push('Arabic content detected — the Word report mirrors its layout to right-to-left automatically.');
  }
  if (report && matrix.length > 4000) {
    warnings.push('Large scope exported as a structured report: the document will be long. A spreadsheet format reads faster for very large sets.');
  }

  const bodyXml = report ? buildReportBody(matrix, columns, meta, opts) : buildTableBody(matrix, columns, meta);
  const page = pageDims(opts.pageSize, report ? false : opts.orientation === 'landscape');
  const orient = !report && opts.orientation === 'landscape' ? ' w:orient="landscape"' : '';
  const references = report
    ? '<w:headerReference w:type="default" r:id="rId3"/><w:footerReference w:type="default" r:id="rId4"/>'
    : '';
  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>${bodyXml}<w:sectPr>${references}<w:pgSz w:w="${page.w}" w:h="${page.h}"${orient}/><w:pgMar w:top="${report ? PAGE_MARGIN : 720}" w:right="${report ? PAGE_MARGIN : 720}" w:bottom="${report ? PAGE_MARGIN : 720}" w:left="${report ? PAGE_MARGIN : 720}"${report ? ` w:header="${Math.round(PAGE_MARGIN * 0.55)}" w:footer="${Math.round(PAGE_MARGIN * 0.5)}" w:gutter="0"/>` : '/'}<w:cols w:space="708"/><w:docGrid w:linePitch="360"/></w:sectPr></w:body></w:document>`;

  const usable = page.w - 2 * PAGE_MARGIN;
  const entries: ZipEntry[] = [
    { name: '[Content_Types].xml', data: report ? CONTENT_TYPES_REPORT : CONTENT_TYPES },
    { name: '_rels/.rels', data: ROOT_RELS },
    { name: 'docProps/core.xml', data: docPropsCore(meta.title || 'Export', meta.subtitle ?? 'Data export') },
    { name: 'docProps/app.xml', data: APP_XML },
    { name: 'word/document.xml', data: documentXml },
  ];
  if (report) {
    entries.push(
      { name: 'word/_rels/document.xml.rels', data: DOC_RELS_REPORT },
      { name: 'word/styles.xml', data: STYLES_XML },
      { name: 'word/numbering.xml', data: NUMBERING_XML },
      {
        name: 'word/header1.xml',
        data: headerXml(headerPara(meta.headerLines ?? [], meta.docNumber ?? '', usable, rtl)),
      },
      {
        name: 'word/footer1.xml',
        data: footerXml(footerPara(meta.footerText ?? '', formatDate(meta.generatedAt, false), usable, rtl)),
      },
    );
  }

  return { bytes: createZip(entries), documentXml, warnings };
}

/* ------------------------------ content types ------------------------------ */

const CONTENT_TYPES_REPORT = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
<Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>
<Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/>
<Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>
</Types>`;
