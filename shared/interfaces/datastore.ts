/** Row shape returned by a parameterized query. */
export interface QueryResult<T = Record<string, unknown>> {
  results: T[];
}

export interface DataStore {
  /** Execute a prepared SQL statement with bindings. */
  query<T = Record<string, unknown>>(
    sql: string,
    bindings?: unknown[],
  ): Promise<QueryResult<T>>;
  /** Execute a statement that returns a single row, or null. */
  first<T = Record<string, unknown>>(
    sql: string,
    bindings?: unknown[],
  ): Promise<T | null>;
  /** Run multiple statements in a transaction. */
  batch(statements: Array<{ sql: string; bindings?: unknown[] }>): Promise<void>;
}
