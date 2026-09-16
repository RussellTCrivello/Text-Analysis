/** SQL parser — produces an AST for the SELECT dialect used by the Reports workspace. */
import { SqlSyntaxError, tokenize, type Token } from './lexer';

export type Expr =
  | { kind: 'col'; table?: string; name: string }
  | { kind: 'lit'; value: string | number | boolean | null }
  | { kind: 'bin'; op: string; left: Expr; right: Expr }
  | { kind: 'unary'; op: string; expr: Expr }
  | { kind: 'func'; name: string; args: Expr[]; distinct?: boolean; star?: boolean }
  | { kind: 'like'; expr: Expr; pattern: Expr; not: boolean }
  | { kind: 'in'; expr: Expr; values: Expr[]; not: boolean }
  | { kind: 'between'; expr: Expr; low: Expr; high: Expr; not: boolean }
  | { kind: 'isnull'; expr: Expr; not: boolean }
  | { kind: 'case'; operand?: Expr; whens: { when: Expr; then: Expr }[]; otherwise?: Expr };

export interface SelectColumn {
  star?: boolean;
  table?: string;
  expr?: Expr;
  alias?: string;
}

export interface TableRef {
  name: string;
  alias: string;
}

export interface JoinClause {
  type: 'inner' | 'left' | 'cross';
  table: TableRef;
  on?: Expr;
}

export interface SelectStatement {
  distinct: boolean;
  columns: SelectColumn[];
  from: TableRef;
  joins: JoinClause[];
  where?: Expr;
  groupBy: Expr[];
  having?: Expr;
  orderBy: { expr: Expr; dir: 'ASC' | 'DESC' }[];
  limit?: number;
  offset?: number;
}

export class SqlParseError extends SqlSyntaxError {}

class Parser {
  private pos = 0;
  private readonly tokens: Token[];
  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  parse(): SelectStatement {
    this.expectKw('SELECT');
    const distinct = this.matchKw('DISTINCT');
    const columns = this.parseSelectColumns();
    this.expectKw('FROM');
    const from = this.parseTableRef();
    const joins: JoinClause[] = [];
    while (true) {
      if (this.matchKw('INNER')) {
        this.expectKw('JOIN');
        joins.push({ type: 'inner', table: this.parseTableRef(), on: this.parseJoinCondition() });
        continue;
      }
      if (this.matchKw('LEFT')) {
        this.matchKw('OUTER');
        this.expectKw('JOIN');
        joins.push({ type: 'left', table: this.parseTableRef(), on: this.parseJoinCondition() });
        continue;
      }
      if (this.matchKw('CROSS')) {
        this.expectKw('JOIN');
        joins.push({ type: 'cross', table: this.parseTableRef() });
        continue;
      }
      if (this.matchKw('JOIN')) {
        joins.push({ type: 'inner', table: this.parseTableRef(), on: this.parseJoinCondition() });
        continue;
      }
      break;
    }

    let where: Expr | undefined;
    if (this.matchKw('WHERE')) where = this.parseExpr();

    const groupBy: Expr[] = [];
    if (this.matchKw('GROUP')) {
      this.expectKw('BY');
      do {
        groupBy.push(this.parseExpr());
      } while (this.match(','));
    }

    let having: Expr | undefined;
    if (this.matchKw('HAVING')) having = this.parseExpr();

    const orderBy: { expr: Expr; dir: 'ASC' | 'DESC' }[] = [];
    if (this.matchKw('ORDER')) {
      this.expectKw('BY');
      do {
        const expr = this.parseExpr();
        let dir: 'ASC' | 'DESC' = 'ASC';
        if (this.matchKw('DESC')) dir = 'DESC';
        else this.matchKw('ASC');
        orderBy.push({ expr, dir });
      } while (this.match(','));
    }

    let limit: number | undefined;
    let offset: number | undefined;
    if (this.matchKw('LIMIT')) {
      limit = this.parseNumber();
      if (this.matchKw('OFFSET')) offset = this.parseNumber();
      else if (this.match(',')) offset = limit, limit = this.parseNumber();
    } else if (this.matchKw('OFFSET')) {
      offset = this.parseNumber();
    }

    this.match(';');
    if (!this.atEnd()) {
      throw new SqlParseError(`Unexpected token "${this.peek().value}"`, this.peek().pos);
    }
    return { distinct, columns, from, joins, where, groupBy, having, orderBy, limit, offset };
  }

  /* ------------------------------ select list ------------------------------ */

  private parseSelectColumns(): SelectColumn[] {
    const columns: SelectColumn[] = [];
    do {
      if (this.peek().type === 'operator' && this.peek().value === '*') {
        this.pos++;
        columns.push({ star: true });
        continue;
      }
      // alias.*
      if (
        this.peek().type === 'ident' &&
        this.tokens[this.pos + 1]?.type === 'punct' &&
        this.tokens[this.pos + 1].value === '.' &&
        this.tokens[this.pos + 2]?.type === 'operator' &&
        this.tokens[this.pos + 2].value === '*'
      ) {
        const table = this.peek().value;
        this.pos += 3;
        columns.push({ star: true, table });
        continue;
      }
      const expr = this.parseExpr();
      let alias: string | undefined;
      if (this.matchKw('AS')) alias = this.parseIdentifier();
      else if (this.peek().type === 'ident') alias = this.parseIdentifier();
      columns.push({ expr, alias });
    } while (this.match(','));
    return columns;
  }

  private parseTableRef(): TableRef {
    const name = this.parseIdentifier();
    let alias = name;
    if (this.matchKw('AS')) alias = this.parseIdentifier();
    else if (this.peek().type === 'ident' && !this.startsClause()) alias = this.parseIdentifier();
    return { name, alias };
  }

  private parseJoinCondition(): Expr | undefined {
    if (this.matchKw('ON')) return this.parseExpr();
    if (this.matchKw('USING')) {
      this.expect('(');
      const col = this.parseIdentifier();
      this.expect(')');
      return {
        kind: 'bin',
        op: '=',
        left: { kind: 'col', name: col },
        right: { kind: 'col', name: col },
      };
    }
    return undefined;
  }

  private startsClause(): boolean {
    const t = this.peek();
    return t.type === 'keyword' &&
      ['WHERE','GROUP','ORDER','LIMIT','HAVING','JOIN','INNER','LEFT','CROSS','ON','UNION','OFFSET'].includes(t.kw ?? '');
  }

  /* ------------------------------- expressions ------------------------------ */

  parseExpr(): Expr {
    return this.parseOr();
  }

  private parseOr(): Expr {
    let left = this.parseAnd();
    while (this.matchKw('OR')) left = { kind: 'bin', op: 'OR', left, right: this.parseAnd() };
    return left;
  }

  private parseAnd(): Expr {
    let left = this.parseNot();
    while (this.matchKw('AND')) left = { kind: 'bin', op: 'AND', left, right: this.parseNot() };
    return left;
  }

  private parseNot(): Expr {
    if (this.matchKw('NOT')) return { kind: 'unary', op: 'NOT', expr: this.parseNot() };
    return this.parseComparison();
  }

  private parseComparison(): Expr {
    let left = this.parseAdditive();

    // IS [NOT] NULL
    if (this.checkKw('IS')) {
      this.pos++;
      const not = this.matchKw('NOT');
      this.expectKw('NULL');
      return { kind: 'isnull', expr: left, not };
    }

    const negate = this.checkKw('NOT') &&
      ['LIKE','IN','BETWEEN'].includes(this.tokens[this.pos + 1]?.kw ?? '');
    if (negate) this.pos++;

    if (this.matchKw('LIKE') || this.matchKw('GLOB')) {
      const pattern = this.parseAdditive();
      return { kind: 'like', expr: left, pattern, not: negate };
    }
    if (this.matchKw('IN')) {
      this.expect('(');
      const values: Expr[] = [];
      if (!this.check(')')) {
        do {
          values.push(this.parseExpr());
        } while (this.match(','));
      }
      this.expect(')');
      return { kind: 'in', expr: left, values, not: negate };
    }
    if (this.matchKw('BETWEEN')) {
      const low = this.parseAdditive();
      this.expectKw('AND');
      const high = this.parseAdditive();
      return { kind: 'between', expr: left, low, high, not: negate };
    }

    const t = this.peek();
    // The lexer normalises "<>" to "!=", so "!=" must be listed here too.
    if (t.type === 'operator' && ['=', '!=', '<', '>', '<=', '>='].includes(t.value)) {
      this.pos++;
      return { kind: 'bin', op: t.value, left, right: this.parseAdditive() };
    }
    return left;
  }

  private parseAdditive(): Expr {
    let left = this.parseMultiplicative();
    while (true) {
      const t = this.peek();
      if (t.type === 'operator' && (t.value === '+' || t.value === '-' || t.value === '||')) {
        this.pos++;
        left = { kind: 'bin', op: t.value, left, right: this.parseMultiplicative() };
        continue;
      }
      break;
    }
    return left;
  }

  private parseMultiplicative(): Expr {
    let left = this.parseUnary();
    while (true) {
      const t = this.peek();
      if (t.type === 'operator' && (t.value === '*' || t.value === '/' || t.value === '%')) {
        this.pos++;
        left = { kind: 'bin', op: t.value, left, right: this.parseUnary() };
        continue;
      }
      break;
    }
    return left;
  }

  private parseUnary(): Expr {
    const t = this.peek();
    if (t.type === 'operator' && t.value === '-') {
      this.pos++;
      return { kind: 'unary', op: '-', expr: this.parseUnary() };
    }
    return this.parsePrimary();
  }

  private parsePrimary(): Expr {
    const t = this.peek();

    if (t.type === 'punct' && t.value === '(') {
      this.pos++;
      const expr = this.parseExpr();
      this.expect(')');
      return expr;
    }
    if (t.type === 'number') {
      this.pos++;
      return { kind: 'lit', value: Number(t.value) };
    }
    if (t.type === 'string') {
      this.pos++;
      return { kind: 'lit', value: t.value };
    }
    if (t.type === 'keyword' && (t.kw === 'TRUE' || t.kw === 'FALSE')) {
      this.pos++;
      return { kind: 'lit', value: t.kw === 'TRUE' };
    }
    if (t.type === 'keyword' && t.kw === 'NULL') {
      this.pos++;
      return { kind: 'lit', value: null };
    }
    if (t.type === 'operator' && t.value === '*') {
      this.pos++;
      return { kind: 'func', name: 'COUNT', args: [], star: true };
    }
    if (t.type === 'keyword' && t.kw === 'CASE') {
      this.pos++;
      let operand: Expr | undefined;
      if (!this.checkKw('WHEN')) operand = this.parseExpr();
      const whens: { when: Expr; then: Expr }[] = [];
      while (this.matchKw('WHEN')) {
        const when = this.parseExpr();
        this.expectKw('THEN');
        whens.push({ when, then: this.parseExpr() });
      }
      if (!whens.length) throw new SqlParseError('CASE requires at least one WHEN branch', t.pos);
      let otherwise: Expr | undefined;
      if (this.matchKw('ELSE')) otherwise = this.parseExpr();
      this.expectKw('END');
      return { kind: 'case', operand, whens, otherwise };
    }
    if (t.type === 'ident' || (t.type === 'keyword' && this.isFunctionLike(t))) {
      const name = t.value;
      this.pos++;
      if (this.check('(')) {
        this.pos++;
        const distinct = this.matchKw('DISTINCT');
        const args: Expr[] = [];
        let star = false;
        if (this.check(')')) {
          /* count() */
        } else if (this.peek().type === 'operator' && this.peek().value === '*') {
          star = true;
          this.pos++;
        } else {
          do {
            args.push(this.parseExpr());
          } while (this.match(','));
        }
        this.expect(')');
        return { kind: 'func', name: name.toUpperCase(), args, distinct, star };
      }
      if (this.check('.') && this.tokens[this.pos + 1]?.type === 'ident') {
        this.pos++;
        const col = this.parseIdentifier();
        return { kind: 'col', table: name, name: col };
      }
      if (this.check('.') && this.peekNext()?.type === 'operator' && this.peekNext()?.value === '*') {
        this.pos += 2;
        return { kind: 'col', table: name, name: '*' };
      }
      return { kind: 'col', name };
    }

    throw new SqlParseError(`Unexpected token "${t.value || 'end of input'}"`, t.pos);
  }

  private isFunctionLike(t: Token): boolean {
    return ['COUNT','SUM','AVG','MIN','MAX','LENGTH','UPPER','LOWER','TRIM','ROUND','ABS','COALESCE','IFNULL','GROUP_CONCAT','SUBSTR','REPLACE','INSTR','TOTAL','DATE'].includes((t.kw ?? '').toUpperCase());
  }

  /* --------------------------------- helpers -------------------------------- */

  private peek(): Token {
    return this.tokens[this.pos];
  }
  private peekNext(): Token | undefined {
    return this.tokens[this.pos + 1];
  }
  private atEnd(): boolean {
    return this.peek().type === 'eof';
  }
  private check(value: string): boolean {
    const t = this.peek();
    return (t.type === 'punct' || t.type === 'operator') && t.value === value;
  }
  private match(value: string): boolean {
    if (this.check(value)) {
      this.pos++;
      return true;
    }
    return false;
  }
  private checkKw(kw: string): boolean {
    const t = this.peek();
    return t.type === 'keyword' && t.kw === kw;
  }
  private matchKw(kw: string): boolean {
    if (this.checkKw(kw)) {
      this.pos++;
      return true;
    }
    return false;
  }
  private expect(value: string): void {
    if (!this.match(value)) throw new SqlParseError(`Expected "${value}" but found "${this.peek().value || 'end of input'}"`, this.peek().pos);
  }
  private expectKw(kw: string): void {
    if (!this.matchKw(kw)) throw new SqlParseError(`Expected ${kw} but found "${this.peek().value || 'end of input'}"`, this.peek().pos);
  }
  private parseIdentifier(): string {
    const t = this.peek();
    if (t.type === 'ident' || t.type === 'keyword' || t.type === 'string') {
      this.pos++;
      return t.value;
    }
    throw new SqlParseError(`Expected an identifier but found "${t.value || 'end of input'}"`, t.pos);
  }
  private parseNumber(): number {
    const t = this.peek();
    if (t.type !== 'number') throw new SqlParseError(`Expected a number but found "${t.value}"`, t.pos);
    this.pos++;
    return Number(t.value);
  }
}

export function parseSelect(sql: string): SelectStatement {
  const trimmed = sql.trim();
  if (!trimmed) throw new SqlParseError('Empty query', 0);
  if (!/^\s*(select|with)\b/i.test(trimmed)) {
    throw new SqlParseError('Only SELECT statements are supported by the Reports workspace', 0);
  }
  if (/^\s*with\b/i.test(trimmed)) {
    throw new SqlParseError('Common table expressions (WITH …) are not supported yet', 0);
  }
  const tokens = tokenize(trimmed);
  return new Parser(tokens).parse();
}

/** True when the expression tree contains an aggregate call. */
export function containsAggregate(expr: Expr | undefined): boolean {
  if (!expr) return false;
  const AGG = new Set(['COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'TOTAL', 'GROUP_CONCAT']);
  switch (expr.kind) {
    case 'func':
      if (AGG.has(expr.name)) return true;
      return expr.args.some(containsAggregate);
    case 'bin':
      return containsAggregate(expr.left) || containsAggregate(expr.right);
    case 'unary':
      return containsAggregate(expr.expr);
    case 'like':
      return containsAggregate(expr.expr) || containsAggregate(expr.pattern);
    case 'in':
      return containsAggregate(expr.expr) || expr.values.some(containsAggregate);
    case 'between':
      return containsAggregate(expr.expr) || containsAggregate(expr.low) || containsAggregate(expr.high);
    case 'isnull':
      return containsAggregate(expr.expr);
    default:
      return false;
  }
}
