import { describe, it, expect, vi, afterEach } from 'vitest';
import { Hono } from 'hono';
import * as XLSX from 'xlsx';
import {
  validateFile,
  purgeExpiredSessions,
  SESSION_TTL_MS,
  MAX_IMPORT_ROWS,
  MAX_IMPORT_COLUMNS,
} from './import';
import importRouter from './import';
import type { Bindings, AppDb } from '../db/client';
import { ENTITY_VALIDATION_SCHEMAS } from '@kaizenlife/shared';

type RouteApp = Hono<{ Bindings: Bindings; Variables: { db: AppDb; userId: string } }>;

function makeApp(): RouteApp {
  const app: RouteApp = new Hono();
  app.use('*', async (c, next) => {
    c.set('db', {} as AppDb);
    c.set('userId', 'u1');
    await next();
  });
  app.route('/', importRouter);
  return app;
}

async function uploadCsv(app: RouteApp, csv: string, name = 'data.csv'): Promise<Response> {
  const form = new FormData();
  form.append('file', new File([csv], name, { type: 'text/csv' }));
  return app.request('/import/upload', { method: 'POST', body: form });
}

function previewBody(sessionId: string): string {
  return JSON.stringify({
    sessionId,
    entityType: 'transactions',
    mapping: { A: 'date', B: 'category' },
  });
}

const jsonInit = (body: string) => ({
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body,
});

describe('Import Logic (production implementations)', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  describe('validateFile', () => {
    it('should accept valid xlsx file', () => {
      const file = new File([''], 'test.xlsx', {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      expect(validateFile(file)).toEqual({ valid: true });
    });

    it('should accept valid xls file', () => {
      const file = new File([''], 'test.xls', { type: 'application/vnd.ms-excel' });
      expect(validateFile(file)).toEqual({ valid: true });
    });

    it('should accept valid csv file', () => {
      const file = new File([''], 'test.csv', { type: 'text/csv' });
      expect(validateFile(file)).toEqual({ valid: true });
    });

    it('should reject pdf file', () => {
      const file = new File([''], 'test.pdf', { type: 'application/pdf' });
      expect(validateFile(file)).toEqual({
        valid: false,
        error: 'Invalid file type. Only .xlsx, .xls, and .csv files are allowed.',
      });
    });

    it('should reject file without extension', () => {
      const file = new File([''], 'test', { type: 'text/plain' });
      expect(validateFile(file)).toEqual({
        valid: false,
        error: 'Invalid file type. Only .xlsx, .xls, and .csv files are allowed.',
      });
    });

    it('should reject oversized file beyond the 5 MB budget', () => {
      const largeContent = new Uint8Array(5 * 1024 * 1024 + 1);
      const file = new File([largeContent], 'large.xlsx', {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      expect(validateFile(file)).toEqual({
        valid: false,
        error: 'File too large. Maximum size is 5 MB.',
      });
    });

    it('should accept file at max size', () => {
      const exactContent = new Uint8Array(5 * 1024 * 1024);
      const file = new File([exactContent], 'exact.xlsx', {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      expect(validateFile(file)).toEqual({ valid: true });
    });

    it('normalizes uppercase extensions', () => {
      const file = new File([''], 'report.CSV', { type: 'text/csv' });
      expect(validateFile(file)).toEqual({ valid: true });
    });
  });

  describe('upload caps and session creation (real route)', () => {
    it('creates a session with headers, totalRows, and preview rows', async () => {
      const app = makeApp();
      const res = await uploadCsv(app, 'date,type\nclean,ok');
      expect(res.status).toBe(200);
      const json = (await res.json()) as {
        sessionId: string;
        headers: string[];
        totalRows: number;
        previewRows: unknown[];
      };
      expect(json.sessionId).toMatch(/^[0-9a-f-]{36}$/);
      expect(json.headers).toEqual(['date', 'type']);
      expect(json.totalRows).toBe(1);
      expect(json.previewRows).toEqual([{ date: 'clean', type: 'ok' }]);
    });

    it('rejects files with more than MAX_IMPORT_ROWS rows', async () => {
      const app = makeApp();
      const rows = ['date,type'];
      for (let i = 0; i <= MAX_IMPORT_ROWS; i++) rows.push(`2024-01-${String((i % 28) + 1).padStart(2, '0')},income`);
      const res = await uploadCsv(app, rows.join('\n'));
      expect(res.status).toBe(400);
      const json = (await res.json()) as { error: { code: string; message: string } };
      expect(json.error.code).toBe('VALIDATION_ERROR');
      expect(json.error.message).toContain(String(MAX_IMPORT_ROWS));
    });

    it('rejects files with more than MAX_IMPORT_COLUMNS columns', async () => {
      const app = makeApp();
      const cols = Array.from({ length: MAX_IMPORT_COLUMNS + 1 }, (_, i) => `col${i}`);
      const res = await uploadCsv(app, `${cols.join(',')}\n${cols.map(() => 'x').join(',')}`);
      expect(res.status).toBe(400);
      const json = (await res.json()) as { error: { code: string; message: string } };
      expect(json.error.code).toBe('VALIDATION_ERROR');
      expect(json.error.message).toContain(String(MAX_IMPORT_COLUMNS));
    });

    it('rejects files with no data rows', async () => {
      const app = makeApp();
      const res = await uploadCsv(app, '');
      expect(res.status).toBe(400);
      const json = (await res.json()) as { error: { code: string; message: string } };
      expect(json.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('Session Management (production session store)', () => {
    it('keeps SESSION_TTL_MS at one hour', () => {
      expect(SESSION_TTL_MS).toBe(3_600_000);
    });

    it('purgeExpiredSessions runs safely against the live store', () => {
      expect(() => purgeExpiredSessions()).not.toThrow();
      expect(() => purgeExpiredSessions()).not.toThrow();
    });

    it('expires sessions after the TTL so previews 404', async () => {
      const app = makeApp();
      const uploaded = await uploadCsv(app, 'date,type\n2024-01-15,income');
      expect(uploaded.status).toBe(200);
      const { sessionId } = (await uploaded.json()) as { sessionId: string };

      const fresh = await app.request('/import/preview', jsonInit(previewBody(sessionId)));
      expect(fresh.status).toBe(200);

      const realNow = Date.now();
      vi.useFakeTimers();
      vi.setSystemTime(realNow + SESSION_TTL_MS + 1000);

      const gone = await app.request('/import/preview', jsonInit(previewBody(sessionId)));
      expect(gone.status).toBe(404);
      const goneJson = (await gone.json()) as { error: { code: string } };
      expect(goneJson.error.code).toBe('NOT_FOUND');
    });
  });

  describe('Row validation (ENTITY_VALIDATION_SCHEMAS)', () => {
    const schema = ENTITY_VALIDATION_SCHEMAS.transactions;

    it('accepts a fully mapped transaction row', () => {
      const result = schema.safeParse({
        date: '2024-01-15',
        type: 'income',
        amountCents: 1050,
        category: 'Salary',
        account: 'bank',
      });
      expect(result.success).toBe(true);
    });

    it('flags invalid dates with the offending field path', () => {
      const result = schema.safeParse({
        date: 'invalid',
        type: 'expense',
        amountCents: 500,
        category: 'Food',
        account: 'cash',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0]?.path).toEqual(['date']);
      }
    });

    it('rejects negative amounts', () => {
      const result = schema.safeParse({
        date: '2024-01-15',
        type: 'income',
        amountCents: -1,
        category: 'Salary',
        account: 'bank',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0]?.path).toEqual(['amountCents']);
      }
    });

    it('coerces numeric strings coming from spreadsheets', () => {
      const result = schema.safeParse({
        date: '2024-01-15',
        type: 'income',
        amountCents: '1050',
        category: 'Salary',
        account: 'bank',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect((result.data as { amountCents: number }).amountCents).toBe(1050);
      }
    });

    it('rejects unmapped account values', () => {
      const result = schema.safeParse({
        date: '2024-01-15',
        type: 'income',
        amountCents: 10,
        category: 'Salary',
        account: 'paypal',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0]?.path).toEqual(['account']);
      }
    });
  });

  describe('CSV Parsing with xlsx', () => {
    it('should parse CSV content correctly', () => {
      const csvContent = 'name,amount,category\nJohn,1000,Salary\nJane,500,Food';
      const workbook = XLSX.read(csvContent, { type: 'string' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]!]!;
      const data = XLSX.utils.sheet_to_json(sheet);

      expect(data).toHaveLength(2);
      expect(data[0]).toEqual({ name: 'John', amount: 1000, category: 'Salary' });
      expect(data[1]).toEqual({ name: 'Jane', amount: 500, category: 'Food' });
    });

    it('should handle CSV with special characters', () => {
      const csvContent = 'name,note\n"Test, with comma","Quote ""inside"""\nSimple,basic';
      const workbook = XLSX.read(csvContent, { type: 'string' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]!]!;
      const data = XLSX.utils.sheet_to_json(sheet);

      expect(data).toHaveLength(2);
      expect(data[0]).toEqual({ name: 'Test, with comma', note: 'Quote "inside"' });
    });

    it('should extract headers correctly', () => {
      const csvContent = 'col1,col2,col3\nval1,val2,val3';
      const workbook = XLSX.read(csvContent, { type: 'string' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]!]!;
      const data = XLSX.utils.sheet_to_json(sheet);
      const headers = Object.keys(data[0] as object);

      expect(headers).toEqual(['col1', 'col2', 'col3']);
    });

    it('should handle empty CSV', () => {
      const csvContent = '';
      const workbook = XLSX.read(csvContent, { type: 'string' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]!]!;
      const data = XLSX.utils.sheet_to_json(sheet);

      expect(data).toHaveLength(0);
    });
  });

  describe('Excel Parsing with xlsx', () => {
    it('should create and parse Excel file', () => {
      const ws = XLSX.utils.aoa_to_sheet([
        ['date', 'type', 'amount'],
        ['2024-01-15', 'income', 1000],
        ['2024-01-16', 'expense', 500],
      ]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
      const buffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });

      const parsed = XLSX.read(buffer, { type: 'array' });
      const parsedSheet = parsed.Sheets[parsed.SheetNames[0]!]!;
      const data = XLSX.utils.sheet_to_json(parsedSheet);

      expect(data).toHaveLength(2);
      expect(data[0]).toEqual({ date: '2024-01-15', type: 'income', amount: 1000 });
    });

    it('should handle multiple sheets', () => {
      const wb = XLSX.utils.book_new();
      const ws1 = XLSX.utils.aoa_to_sheet([
        ['a', 'b'],
        [1, 2],
      ]);
      const ws2 = XLSX.utils.aoa_to_sheet([
        ['x', 'y'],
        [3, 4],
      ]);
      XLSX.utils.book_append_sheet(wb, ws1, 'Sheet1');
      XLSX.utils.book_append_sheet(wb, ws2, 'Sheet2');

      expect(wb.SheetNames).toHaveLength(2);
      expect(wb.SheetNames).toContain('Sheet1');
      expect(wb.SheetNames).toContain('Sheet2');
    });
  });
});
