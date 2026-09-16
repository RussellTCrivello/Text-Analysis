/** SQL lexer — turns a query string into a positioned token stream. */

export type TokenType =
  | 'keyword'
  | 'ident'
  | 'string'
  | 'number'
  | 'operator'
  | 'punct'
  | 'eof';

export interface Token {
  type: TokenType;
  value: string;
  /** Uppercased keyword text, when type === 'keyword'. */
  kw?: string;
  pos: number;
}

export const KEYWORDS = new Set([
  'SELECT','FROM','WHERE','GROUP','BY','HAVING','ORDER','LIMIT','OFFSET','JOIN','INNER','LEFT','RIGHT','OUTER',
  'ON','AS','AND','OR','NOT','IN','IS','NULL','LIKE','BETWEEN','DISTINCT','ASC','DESC','CASE','WHEN','THEN',
  'ELSE','END','UNION','ALL','TRUE','FALSE','CROSS','USING','EXISTS','GLOB','COLLATE','CAST',
]);

const MULTI_CHAR_OPS = ['<=', '>=', '<>', '!=', '||', '=='];
const SINGLE_CHAR_OPS = ['=', '<', '>', '+', '-', '/', '%'];

export class SqlSyntaxError extends Error {
  readonly pos: number;
  constructor(message: string, pos: number) {
    super(`${message} (at position ${pos})`);
    this.name = 'SqlSyntaxError';
    this.pos = pos;
  }
}

export function tokenize(sql: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < sql.length) {
    const ch = sql[i];

    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    if (ch === '-' && sql[i + 1] === '-') {
      while (i < sql.length && sql[i] !== '\n') i++;
      continue;
    }
    if (ch === '/' && sql[i + 1] === '*') {
      const end = sql.indexOf('*/', i + 2);
      i = end === -1 ? sql.length : end + 2;
      continue;
    }

    const start = i;

    if (ch === "'" || ch === '"') {
      const quote = ch;
      let value = '';
      i++;
      while (i < sql.length) {
        if (sql[i] === quote) {
          if (sql[i + 1] === quote) {
            value += quote;
            i += 2;
            continue;
          }
          i++;
          break;
        }
        value += sql[i];
        i++;
      }
      // Double quotes denote identifiers in SQL, single quotes string literals.
      tokens.push({ type: quote === '"' ? 'ident' : 'string', value, pos: start });
      continue;
    }

    if (ch === '`' || ch === '[') {
      const close = ch === '`' ? '`' : ']';
      let value = '';
      i++;
      while (i < sql.length && sql[i] !== close) value += sql[i++];
      i++;
      tokens.push({ type: 'ident', value, pos: start });
      continue;
    }

    if (/[0-9]/.test(ch) || (ch === '.' && /[0-9]/.test(sql[i + 1] ?? ''))) {
      let value = '';
      while (i < sql.length && /[0-9.eE_]/.test(sql[i])) {
        if (sql[i] === '_') {
          i++;
          continue;
        }
        value += sql[i++];
      }
      tokens.push({ type: 'number', value, pos: start });
      continue;
    }

    if (/[\p{L}_$]/u.test(ch)) {
      let value = '';
      while (i < sql.length && /[\p{L}\p{N}_$]/u.test(sql[i])) value += sql[i++];
      const upper = value.toUpperCase();
      if (KEYWORDS.has(upper)) tokens.push({ type: 'keyword', value, kw: upper, pos: start });
      else tokens.push({ type: 'ident', value, pos: start });
      continue;
    }

    const two = sql.slice(i, i + 2);
    if (MULTI_CHAR_OPS.includes(two)) {
      tokens.push({ type: 'operator', value: two === '==' ? '=' : two, pos: start });
      i += 2;
      continue;
    }
    if (SINGLE_CHAR_OPS.includes(ch)) {
      tokens.push({ type: 'operator', value: ch, pos: start });
      i++;
      continue;
    }
    if (ch === '*') {
      tokens.push({ type: 'operator', value: '*', pos: start });
      i++;
      continue;
    }
    if (ch === ',' ) {
      tokens.push({ type: 'punct', value: ',', pos: start });
      i++;
      continue;
    }
    if (ch === '(' || ch === ')') {
      tokens.push({ type: 'punct', value: ch, pos: start });
      i++;
      continue;
    }
    if (ch === '.') {
      tokens.push({ type: 'punct', value: '.', pos: start });
      i++;
      continue;
    }
    if (ch === ';') {
      tokens.push({ type: 'punct', value: ';', pos: start });
      i++;
      continue;
    }

    throw new SqlSyntaxError(`Unexpected character "${ch}"`, i);
  }
  tokens.push({ type: 'eof', value: '', pos: sql.length });
  return tokens;
}
