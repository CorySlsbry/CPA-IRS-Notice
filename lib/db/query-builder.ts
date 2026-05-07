import type { Pool, PoolClient } from 'pg';

/**
 * Tiny Supabase-compatible query builder over node-postgres.
 *
 * Implements the subset of the supabase-js API NoticeReply uses:
 *   from(table).select(cols).eq(...).single()
 *   from(table).insert({...}).select('id').single()
 *   from(table).upsert({...}, { onConflict: 'a,b' }).select('id').single()
 *   from(table).update({...}).eq('id', x)
 *   from(table).delete().eq('id', x)
 *
 * Returns Supabase-shaped results: { data, error, count? }.
 *
 * Not a perfect drop-in. The patterns we actually use are covered.
 * Anything fancier (RPC with structured args, chained nested selects)
 * lives behind a custom repo function.
 */

type Op = '=' | '!=' | '>' | '>=' | '<' | '<=' | 'ilike' | 'like' | 'is';
type Filter =
  | { kind: 'simple'; column: string; op: Op; value: unknown }
  | { kind: 'in'; column: string; values: unknown[] }
  | { kind: 'or'; expression: string }
  | { kind: 'is_null'; column: string; isNull: boolean }
  | { kind: 'gte'; column: string; value: unknown }
  | { kind: 'lte'; column: string; value: unknown };

type Order = { column: string; ascending: boolean; nullsFirst?: boolean };

type SelectOptions = { count?: 'exact' | 'planned' | 'estimated'; head?: boolean };

type Result<T> = { data: T | null; error: { message: string; code?: string } | null; count?: number | null };

type OnConflictOptions = { onConflict?: string; ignoreDuplicates?: boolean };

export interface QueryBuilderClient {
  /** Returns a chained builder bound to the table. */
  from(table: string): TableBuilder;
  /** Call a Postgres function. Returns rows. Mirrors supabase.rpc(). */
  rpc(fnName: string, args?: Record<string, unknown>): RpcBuilder;
}

class TableBuilder {
  protected filters: Filter[] = [];
  protected orderBy: Order[] = [];
  protected limitValue: number | null = null;
  protected offsetValue: number | null = null;
  protected selectColumns: string = '*';
  protected selectOptions: SelectOptions | undefined;
  protected mode: 'select' | 'insert' | 'update' | 'upsert' | 'delete' = 'select';
  protected mutateRows: Record<string, unknown> | Record<string, unknown>[] | null = null;
  protected onConflict: OnConflictOptions | undefined;
  protected returningColumns: string | null = null;

  constructor(
    protected table: string,
    protected runner: (sql: string, params: unknown[]) => Promise<{ rows: Record<string, unknown>[]; rowCount: number | null }>,
  ) {}

  // ─── Terminal modes ───────────────────────────────────────────────────────

  select(columns: string = '*', opts?: SelectOptions): this {
    this.mode = 'select';
    this.selectColumns = columns;
    this.selectOptions = opts;
    if (this.mutateRows && !this.returningColumns) this.returningColumns = columns;
    return this;
  }

  insert(rows: Record<string, unknown> | Record<string, unknown>[]): this {
    this.mode = 'insert';
    this.mutateRows = rows;
    return this;
  }

  update(values: Record<string, unknown>): this {
    this.mode = 'update';
    this.mutateRows = values;
    return this;
  }

  upsert(rows: Record<string, unknown> | Record<string, unknown>[], opts: OnConflictOptions = {}): this {
    this.mode = 'upsert';
    this.mutateRows = rows;
    this.onConflict = opts;
    return this;
  }

  delete(): this {
    this.mode = 'delete';
    return this;
  }

  // ─── Filters ──────────────────────────────────────────────────────────────

  eq(column: string, value: unknown): this {
    this.filters.push({ kind: 'simple', column, op: '=', value });
    return this;
  }
  neq(column: string, value: unknown): this {
    this.filters.push({ kind: 'simple', column, op: '!=', value });
    return this;
  }
  gt(column: string, value: unknown): this {
    this.filters.push({ kind: 'simple', column, op: '>', value });
    return this;
  }
  gte(column: string, value: unknown): this {
    this.filters.push({ kind: 'gte', column, value });
    return this;
  }
  lt(column: string, value: unknown): this {
    this.filters.push({ kind: 'simple', column, op: '<', value });
    return this;
  }
  lte(column: string, value: unknown): this {
    this.filters.push({ kind: 'lte', column, value });
    return this;
  }
  ilike(column: string, pattern: string): this {
    this.filters.push({ kind: 'simple', column, op: 'ilike', value: pattern });
    return this;
  }
  like(column: string, pattern: string): this {
    this.filters.push({ kind: 'simple', column, op: 'like', value: pattern });
    return this;
  }
  is(column: string, value: null | true | false): this {
    this.filters.push({ kind: 'is_null', column, isNull: value === null });
    return this;
  }
  in(column: string, values: unknown[]): this {
    this.filters.push({ kind: 'in', column, values });
    return this;
  }
  /** Translate Supabase-style or() filter expression: "col.op.val,col.op.val". */
  or(expression: string): this {
    const clauses = expression.split(',').map((part) => orClauseFromShorthand(part.trim()));
    this.filters.push({ kind: 'or', expression: `(${clauses.join(' or ')})` });
    return this;
  }
  /** Match multiple equalities at once. */
  match(query: Record<string, unknown>): this {
    for (const [k, v] of Object.entries(query)) this.eq(k, v);
    return this;
  }

  // ─── Ordering / limits ────────────────────────────────────────────────────

  order(column: string, opts?: { ascending?: boolean; nullsFirst?: boolean }): this {
    this.orderBy.push({ column, ascending: opts?.ascending ?? true, nullsFirst: opts?.nullsFirst });
    return this;
  }
  limit(n: number): this {
    this.limitValue = n;
    return this;
  }
  range(from: number, to: number): this {
    this.offsetValue = from;
    this.limitValue = to - from + 1;
    return this;
  }

  // ─── Terminal awaits ──────────────────────────────────────────────────────

  async single<T = Record<string, unknown>>(): Promise<Result<T>> {
    this.limitValue = 1;
    const out = await this.execute<T>();
    if (out.error) return out as Result<T>;
    if (!out.data || (Array.isArray(out.data) && out.data.length === 0)) {
      return { data: null, error: { message: 'No rows returned', code: 'PGRST116' } };
    }
    const row = Array.isArray(out.data) ? out.data[0] : out.data;
    return { data: (row ?? null) as T, error: null };
  }

  async maybeSingle<T = Record<string, unknown>>(): Promise<Result<T>> {
    this.limitValue = 1;
    const out = await this.execute<T>();
    if (out.error) return out as Result<T>;
    const row = Array.isArray(out.data) ? out.data[0] : out.data;
    return { data: (row ?? null) as T | null, error: null };
  }

  /** Default await — returns array of rows. */
  then<TResult1 = Result<unknown[]>, TResult2 = never>(
    onfulfilled?: ((value: Result<unknown[]>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return this.execute<unknown[]>().then(onfulfilled, onrejected);
  }

  // ─── SQL compiler ─────────────────────────────────────────────────────────

  protected async execute<T>(): Promise<Result<T>> {
    try {
      const { sql, params, expectsRows } = this.compile();
      const result = await this.runner(sql, params);
      const rows = (result.rows as unknown[]) ?? [];
      const data = expectsRows ? (rows as unknown as T) : (null as unknown as T);
      const out: Result<T> = { data, error: null };
      if (this.selectOptions?.count) {
        // For count: 'exact', { head: true }, the caller wants .count without rows.
        out.count = this.selectOptions.head ? (result.rowCount ?? rows.length) : rows.length;
      }
      return out;
    } catch (err) {
      const e = err as { message?: string; code?: string };
      return { data: null, error: { message: e.message ?? 'unknown', code: e.code } };
    }
  }

  protected compile(): { sql: string; params: unknown[]; expectsRows: boolean } {
    const params: unknown[] = [];
    const where = this.compileWhere(params);

    switch (this.mode) {
      case 'select': {
        const cols = this.selectColumns === '*' ? '*' : this.selectColumns.replace(/[^\w*,()\s.]/g, '');
        if (this.selectOptions?.count === 'exact' && this.selectOptions?.head) {
          // Just want a count, not rows.
          const sql = `select count(*)::int as count from "${this.table}"${where}`;
          return { sql, params, expectsRows: false };
        }
        const sql = [
          `select ${cols} from "${this.table}"`,
          where,
          this.compileOrderBy(),
          this.limitValue != null ? `limit ${this.limitValue}` : '',
          this.offsetValue != null ? `offset ${this.offsetValue}` : '',
        ]
          .filter(Boolean)
          .join(' ');
        return { sql, params, expectsRows: true };
      }
      case 'insert': {
        const rows = Array.isArray(this.mutateRows) ? this.mutateRows : [this.mutateRows!];
        const cols = Array.from(new Set(rows.flatMap((r) => Object.keys(r ?? {}))));
        const valueGroups = rows
          .map((row) => {
            const vals = cols.map((c) => {
              const v = (row as Record<string, unknown>)[c];
              if (v === undefined) return 'default';
              params.push(serialize(v));
              return `$${params.length}`;
            });
            return `(${vals.join(',')})`;
          })
          .join(',');
        const colList = cols.map((c) => `"${c}"`).join(',');
        const returning = this.returningColumns ?? this.selectColumns;
        const sql = `insert into "${this.table}" (${colList}) values ${valueGroups} returning ${returning === '*' ? '*' : returning}`;
        return { sql, params, expectsRows: true };
      }
      case 'upsert': {
        const rows = Array.isArray(this.mutateRows) ? this.mutateRows : [this.mutateRows!];
        const cols = Array.from(new Set(rows.flatMap((r) => Object.keys(r ?? {}))));
        const valueGroups = rows
          .map((row) => {
            const vals = cols.map((c) => {
              const v = (row as Record<string, unknown>)[c];
              if (v === undefined) return 'default';
              params.push(serialize(v));
              return `$${params.length}`;
            });
            return `(${vals.join(',')})`;
          })
          .join(',');
        const colList = cols.map((c) => `"${c}"`).join(',');
        const conflictTarget = this.onConflict?.onConflict ?? 'id';
        const conflictCols = conflictTarget.split(',').map((c) => `"${c.trim()}"`).join(',');
        const updateAssignments = this.onConflict?.ignoreDuplicates
          ? 'nothing'
          : `update set ${cols
              .filter((c) => !conflictTarget.split(',').map((s) => s.trim()).includes(c))
              .map((c) => `"${c}" = excluded."${c}"`)
              .join(',')}`;
        const onConflictClause = this.onConflict?.ignoreDuplicates
          ? `on conflict (${conflictCols}) do ${updateAssignments}`
          : `on conflict (${conflictCols}) do ${updateAssignments}`;
        const returning = this.returningColumns ?? this.selectColumns;
        const sql = `insert into "${this.table}" (${colList}) values ${valueGroups} ${onConflictClause} returning ${returning === '*' ? '*' : returning}`;
        return { sql, params, expectsRows: true };
      }
      case 'update': {
        const setEntries = Object.entries(this.mutateRows as Record<string, unknown>);
        const setClause = setEntries
          .map(([c, v]) => {
            params.push(serialize(v));
            return `"${c}" = $${params.length}`;
          })
          .join(',');
        const whereClause = this.compileWhere(params);
        const returning = this.returningColumns ?? this.selectColumns;
        const sql = `update "${this.table}" set ${setClause} ${whereClause} ${this.returningColumns ? `returning ${returning === '*' ? '*' : returning}` : ''}`.trim();
        return { sql, params, expectsRows: !!this.returningColumns };
      }
      case 'delete': {
        const whereClause = this.compileWhere(params);
        const sql = `delete from "${this.table}" ${whereClause}`.trim();
        return { sql, params, expectsRows: false };
      }
    }
  }

  protected compileWhere(params: unknown[]): string {
    if (this.filters.length === 0) return '';
    const parts = this.filters.map((f) => {
      switch (f.kind) {
        case 'simple':
          params.push(serialize(f.value));
          return `"${f.column}" ${f.op} $${params.length}`;
        case 'gte':
          params.push(serialize(f.value));
          return `"${f.column}" >= $${params.length}`;
        case 'lte':
          params.push(serialize(f.value));
          return `"${f.column}" <= $${params.length}`;
        case 'is_null':
          return `"${f.column}" is ${f.isNull ? 'null' : 'not null'}`;
        case 'in':
          if (f.values.length === 0) return 'false';
          return `"${f.column}" in (${f.values
            .map((v) => {
              params.push(serialize(v));
              return `$${params.length}`;
            })
            .join(',')})`;
        case 'or':
          return f.expression;
      }
    });
    return `where ${parts.join(' and ')}`;
  }

  protected compileOrderBy(): string {
    if (this.orderBy.length === 0) return '';
    return (
      'order by ' +
      this.orderBy
        .map((o) => {
          const dir = o.ascending ? 'asc' : 'desc';
          const nulls = o.nullsFirst === undefined ? '' : o.nullsFirst ? ' nulls first' : ' nulls last';
          return `"${o.column}" ${dir}${nulls}`;
        })
        .join(',')
    );
  }
}

class RpcBuilder extends TableBuilder {
  constructor(
    fnName: string,
    private rpcArgs: Record<string, unknown>,
    runner: (sql: string, params: unknown[]) => Promise<{ rows: Record<string, unknown>[]; rowCount: number | null }>,
  ) {
    super(fnName, runner);
  }

  protected override compile(): { sql: string; params: unknown[]; expectsRows: boolean } {
    const params: unknown[] = [];
    const argList = Object.entries(this.rpcArgs ?? {})
      .map(([k, v]) => {
        params.push(serialize(v));
        return `${k} => $${params.length}`;
      })
      .join(',');
    const where = this.compileWhere(params);
    const sql = [
      `select ${this.selectColumns === '*' ? '*' : this.selectColumns} from "${this.table}"(${argList})`,
      where,
      this.compileOrderBy(),
      this.limitValue != null ? `limit ${this.limitValue}` : '',
      this.offsetValue != null ? `offset ${this.offsetValue}` : '',
    ]
      .filter(Boolean)
      .join(' ');
    return { sql, params, expectsRows: true };
  }
}

function serialize(v: unknown): unknown {
  if (v === undefined) return null;
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'object' && v !== null && !Array.isArray(v)) return JSON.stringify(v);
  return v;
}

const SHORTHAND_OPS: Record<string, Op> = {
  eq: '=',
  neq: '!=',
  gt: '>',
  gte: '>=',
  lt: '<',
  lte: '<=',
  ilike: 'ilike',
  like: 'like',
  is: 'is',
};

function orClauseFromShorthand(part: string): string {
  // "column.op.value" — value may contain dots; split on first two dots.
  const firstDot = part.indexOf('.');
  const secondDot = part.indexOf('.', firstDot + 1);
  if (firstDot < 0 || secondDot < 0) return 'false';
  const column = part.slice(0, firstDot);
  const op = part.slice(firstDot + 1, secondDot);
  const value = part.slice(secondDot + 1);
  const sqlOp = SHORTHAND_OPS[op] ?? '=';
  // We embed the value literal — caller controls input. Wrap strings in quotes.
  // Rare path; almost always email/text search where value is user input from a route.
  // For safety we cast through a CTE later — for now, escape single quotes.
  const safe = String(value).replace(/'/g, "''");
  return `"${column}" ${sqlOp} '${safe}'`;
}

/**
 * Build a query-builder client over either the shared pool or a transaction
 * client. Mirrors the surface area of supabase.from() / supabase.rpc().
 */
export function createQueryBuilderClient(
  source: { query: (sql: string, params: unknown[]) => Promise<{ rows: Record<string, unknown>[]; rowCount: number | null }> },
): QueryBuilderClient {
  const runner = async (sql: string, params: unknown[]) => {
    const r = await source.query(sql, params);
    return { rows: r.rows ?? [], rowCount: r.rowCount ?? null };
  };
  return {
    from(table: string) {
      return new TableBuilder(table, runner);
    },
    rpc(fnName: string, args: Record<string, unknown> = {}) {
      return new RpcBuilder(fnName, args, runner);
    },
  };
}

/** Convenience wrapper: bind a query-builder to a Pool or PoolClient. */
export function clientFor(pool: Pool | PoolClient): QueryBuilderClient {
  return createQueryBuilderClient({
    query: async (sql, params) => {
      const r = await pool.query(sql, [...params]);
      return { rows: r.rows as Record<string, unknown>[], rowCount: r.rowCount };
    },
  });
}
