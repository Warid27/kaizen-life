// Cloudflare Workers global types for D1 database
// These are provided at runtime by the Workers runtime.
// For local dev with `wrangler dev`, these types are injected automatically.
// This declaration ensures TypeScript and bun build can resolve the types.

interface D1Database {
  exec(sql: string): Promise<D1ExecResult>;
  prepare(sql: string): D1PreparedStatement;
  batch(stmts: D1ExecInput[]): Promise<D1ExecResult[]>;
  dump(): Promise<ArrayBuffer>;
}

interface D1ExecResult {
  count: number;
  duration: number;
  rows?: Record<string, unknown>[];
  success: boolean;
}

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  run(): Promise<D1ExecResult>;
  all<T = Record<string, unknown>>(): Promise<D1ExecResult & { results: T[] }>;
  first<T = Record<string, unknown>>(colName?: string): Promise<T | null>;
  raw<T = unknown[]>(): Promise<D1ExecResult & { results: T[] }>;
  columns(): Promise<D1ColumnDefinition[]>;
}

type D1ExecInput = D1PreparedStatement | { sql: string; params?: unknown[] };

interface D1ColumnDefinition {
  name: string;
  type: string;
}
