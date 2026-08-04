/**
 * In-memory D1 test double for workflow persistence tests.
 *
 * Supports the SQL subset the Wave 8 workflow module issues:
 *   - INSERT INTO <t> (cols) VALUES (?, ...)
 *   - SELECT [COUNT(*)|*] FROM <t> [WHERE ...] [ORDER BY col ASC|DESC] [LIMIT ?] [OFFSET ?]
 *   - UPDATE <t> SET col = ?, ... WHERE <cond>
 *   - db.batch([...])
 *
 * Rows are stored as objects keyed by id within per-table maps, so
 * append→query roundtrips genuinely exercise the persistence mapping code.
 */

type Row = Record<string, unknown>;

export class InMemoryD1 {
  readonly tables: Record<string, Map<string, Row>> = {};

  constructor() {
    // PRG-022: workflow_instances added so startWorkflow() INSERT is captured
    // rather than silently no-oping when InMemoryD1.execute() finds no table.
    this.tables['workflow_instances'] = new Map();
    this.tables['workflow_events'] = new Map();
    this.tables['task_instances'] = new Map();
    this.tables['approval_gates'] = new Map();
    this.tables['workflow_timers'] = new Map();
    this.tables['task_queue'] = new Map();
  }

  prepare(sql: string): D1PreparedStatement {
    const self = this;
    return {
      bind(...values: unknown[]): D1PreparedStatement {
        return {
          async run(): Promise<D1Result> {
            self.execute(sql, values);
            return { success: true, meta: {} } as D1Result;
          },
          async first<T = unknown>(colName?: string): Promise<T | null> {
            const rows = self.execute(sql, values, true) as Row[];
            const row = rows[0];
            if (!row) return null;
            if (colName) return row[colName] as T;
            return row as T;
          },
          async all<T = unknown>(): Promise<D1Result<T>> {
            const rows = self.execute(sql, values, true) as Row[];
            return { success: true, results: rows as T[], meta: {} } as D1Result<T>;
          },
          async raw<T = unknown>(): Promise<T[]> {
            return self.execute(sql, values, true) as T[];
          },
        } as unknown as D1PreparedStatement;
      },
      async run(): Promise<D1Result> {
        self.execute(sql, []);
        return { success: true, meta: {} } as D1Result;
      },
      async first<T = unknown>(): Promise<T | null> {
        const rows = self.execute(sql, [], true) as Row[];
        return (rows[0] ?? null) as T | null;
      },
      async all<T = unknown>(): Promise<D1Result<T>> {
        const rows = self.execute(sql, [], true) as Row[];
        return { success: true, results: rows as T[], meta: {} } as D1Result<T>;
      },
      async raw<T = unknown>(): Promise<T[]> {
        return self.execute(sql, [], true) as T[];
      },
    } as unknown as D1PreparedStatement;
  }

  async batch(statements: D1PreparedStatement[]): Promise<D1Result[]> {
    const results: D1Result[] = [];
    for (const s of statements) {
      await s.run();
      results.push({ success: true, meta: {} } as D1Result);
    }
    return results;
  }

  private execute(rawSql: string, values: unknown[], select = false): unknown {
    const stmt = rawSql.trim();
    const table = /(?:INTO|FROM|UPDATE)\s+([A-Za-z_][A-Za-z0-9_]*)/.exec(stmt)?.[1];
    if (!table || !this.tables[table]) return select ? [] : undefined;

    let idx = 0;

    if (/^INSERT/i.test(stmt)) {
      const colsMatch = /\(([^)]+)\)\s*VALUES/i.exec(stmt);
      const cols = (colsMatch?.[1] ?? '').split(',').map((c) => c.trim());
      const row: Row = {};
      for (const col of cols) row[col] = values[idx++] ?? null;
      this.tables[table].set(String(row.id ?? crypto.randomUUID()), row);
      return undefined;
    }

    if (/^UPDATE/i.test(stmt)) {
      const setMatch = /SET\s+([\s\S]*?)\s+WHERE/i.exec(stmt);
      const setClause = setMatch?.[1] ?? '';
      const assignments = setClause.split(',').map((a) => a.trim());
      const sets: Array<[string, unknown]> = [];
      for (const a of assignments) {
        const m = /^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*\?/.exec(a);
        const literal = /^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*([^?,]+)$/.exec(a);
        if (m) {
          sets.push([m[1], values[idx++]]);
        } else if (literal) {
          sets.push([literal[1], literal[2].trim().replace(/'/g, '')]);
        }
      }
      const whereMatch = /WHERE\s+([\s\S]*)$/.exec(stmt);
      const cond = this.buildCond(whereMatch?.[1] ?? '', values, () => idx++);
      for (const r of this.tables[table].values()) {
        if (cond(r)) for (const [k, v] of sets) r[k] = v;
      }
      return undefined;
    }

    // SELECT
    const isCount = /COUNT\(\s*\*\s*\)/i.test(stmt);
    const rows = [...this.tables[table].values()];

    let whereText = '';
    const whereIdx = stmt.search(/\sWHERE\s/i);
    const orderIdx = stmt.search(/\sORDER\s+BY\s/i);
    const limitIdx = stmt.search(/\sLIMIT\s/i);
    if (whereIdx !== -1) {
      const end = [orderIdx, limitIdx].filter((i) => i !== -1).sort((a, b) => a - b)[0];
      whereText = stmt.slice(whereIdx + ' WHERE '.length, end === undefined ? undefined : end).trim();
    }

    const cond = this.buildCond(whereText, values, () => idx++);

    let filtered = isCount ? rows : rows.filter((r) => cond(r));

    if (!isCount && orderIdx !== -1) {
      const orderEnd = limitIdx !== -1 ? limitIdx : undefined;
      const orderClause = stmt.slice(orderIdx + ' ORDER BY '.length, orderEnd).trim();
      const m = /^(\S+)\s+(ASC|DESC)$/i.exec(orderClause) || /^(\S+)$/.exec(orderClause);
      const dir = m?.[2]?.toUpperCase() === 'DESC' ? -1 : 1;
      const col = m?.[1] ?? '';
      filtered = [...filtered].sort((a, b) => {
        const av = (a as Row)[col] ?? 0;
        const bv = (b as Row)[col] ?? 0;
        return av < bv ? -1 * dir : av > bv ? 1 * dir : 0;
      });
    }

    if (limitIdx !== -1) {
      const limitText = stmt.slice(limitIdx + ' LIMIT '.length).split(/\s+OFFSET\s/)[0].trim();
      const limit = limitText === '?' ? Number(values[idx++]) : Number(limitText);
      let offset = 0;
      const offIdx = stmt.search(/\sOFFSET\s/i);
      if (offIdx !== -1) {
        const offText = stmt.slice(offIdx + ' OFFSET '.length).trim();
        offset = offText === '?' ? Number(values[idx++]) : Number(offText);
      }
      filtered = filtered.slice(offset, offset + limit);
    }

    if (isCount) {
      const total = rows.filter((r) => cond(r)).length;
      return [{ cnt: total }];
    }
    return filtered;
  }

  /** Builds a predicate from a WHERE clause with `?` placeholders. */
  private buildCond(whereText: string, values: unknown[], next: () => number): (r: Row) => boolean {
    const txt = whereText.trim();
    if (!txt || txt.toLowerCase() === 'where') return () => true;
    const parts = txt.split(/\s+AND\s+/i).map((p) => p.trim());
    return (row: Row) => {
      for (let part of parts) {
        const parenOnly = part.startsWith('(') && part.endsWith(')') && !part.includes(' AND ');
        if (parenOnly) part = part.slice(1, -1);
        if (!this.singleCond(part, row, values, next)) return false;
      }
      return true;
    };
  }

  private singleCond(part: string, row: Row, values: unknown[], next: () => number): boolean {
    const inMatch = /^([A-Za-z_][A-Za-z0-9_]*)\s+IN\s*\((.*)\)$/s.exec(part);
    if (inMatch) {
      const placeholders = (inMatch[2].match(/\?/g) || []).length;
      const vals = Array.from({ length: placeholders }, () => values[next()]);
      return vals.includes(row[inMatch[1]]);
    }
    const opMatch = /^([A-Za-z_][A-Za-z0-9_]*)\s*(=|>=|<=|<>|>|<)\s*\?$/.exec(part);
    if (opMatch) {
      const col = opMatch[1];
      const op = opMatch[2];
      const v = values[next()] as number | string | boolean | null;
      const got = row[col] as number | string | boolean | null | undefined;
      switch (op) {
        case '=': return got === v;
        case '>=': return got !== undefined && got !== null && Number(got) >= Number(v);
        case '<=': return got !== undefined && got !== null && Number(got) <= Number(v);
        case '>': return got !== undefined && got !== null && Number(got) > Number(v);
        case '<': return got !== undefined && got !== null && Number(got) < Number(v);
        case '<>': return got !== v;
        default: return true;
      }
    }
    const litMatch = /^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*'([^']*)'$/.exec(part);
    if (litMatch) return row[litMatch[1]] === litMatch[2];
    const valMatch = /^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*\?$/.exec(part);
    if (valMatch) return row[valMatch[1]] === values[next()];
    // IS NULL check
    const isNullMatch = /^([A-Za-z_][A-Za-z0-9_]*)\s+IS\s+NULL$/i.exec(part);
    if (isNullMatch) return row[isNullMatch[1]] === null || row[isNullMatch[1]] === undefined;
    return true;
  }
}

/** Convenience factory matching the Env.DB shape of existing tests. */
export function createInMemoryDb(): InMemoryD1 {
  return new InMemoryD1();
}
