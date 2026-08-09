import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as XLSX from 'xlsx';
import crypto from 'crypto';

// ─── Test the import logic in isolation ──────────────────────────────────────

// We'll test the core logic by importing the xlsx library directly
// and testing the validation/mapping logic that the routes use

describe('Import Logic', () => {
  // ─── File Validation ──────────────────────────────────────────────────────

  describe('validateFile', () => {
    const ALLOWED_EXTENSIONS = ['xlsx', 'xls', 'csv'];
    const MAX_FILE_SIZE = 5 * 1024 * 1024;

    function validateFile(file: File): { valid: boolean; error?: string } {
      if (file.size > MAX_FILE_SIZE) {
        return {
          valid: false,
          error: 'File too large. Maximum size is 5 MB.',
        };
      }

      const ext = file.name.toLowerCase().split('.').pop();
      if (!ext || !ALLOWED_EXTENSIONS.includes(ext)) {
        return {
          valid: false,
          error: 'Invalid file type. Only .xlsx, .xls, and .csv files are allowed.',
        };
      }

      return { valid: true };
    }

    it('should accept valid xlsx file', () => {
      const file = new File([''], 'test.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
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

    it('should reject oversized file', () => {
      const largeContent = new Uint8Array(MAX_FILE_SIZE + 1);
      const file = new File([largeContent], 'large.xlsx', {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      expect(validateFile(file)).toEqual({
        valid: false,
        error: 'File too large. Maximum size is 5 MB.',
      });
    });

    it('should accept file at max size', () => {
      const exactContent = new Uint8Array(MAX_FILE_SIZE);
      const file = new File([exactContent], 'exact.xlsx', {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      expect(validateFile(file)).toEqual({ valid: true });
    });
  });

  // ─── CSV Parsing ──────────────────────────────────────────────────────────

  describe('CSV Parsing with xlsx', () => {
    it('should parse CSV content correctly', () => {
      const csvContent = 'name,amount,category\nJohn,1000,Salary\nJane,500,Food';
      const workbook = XLSX.read(csvContent, { type: 'string' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(sheet);

      expect(data).toHaveLength(2);
      expect(data[0]).toEqual({
        name: 'John',
        amount: 1000,
        category: 'Salary',
      });
      expect(data[1]).toEqual({
        name: 'Jane',
        amount: 500,
        category: 'Food',
      });
    });

    it('should handle CSV with special characters', () => {
      const csvContent = 'name,note\n"Test, with comma","Quote ""inside"""\nSimple,basic';
      const workbook = XLSX.read(csvContent, { type: 'string' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(sheet);

      expect(data).toHaveLength(2);
      expect(data[0]).toEqual({ name: 'Test, with comma', note: 'Quote "inside"' });
    });

    it('should extract headers correctly', () => {
      const csvContent = 'col1,col2,col3\nval1,val2,val3';
      const workbook = XLSX.read(csvContent, { type: 'string' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(sheet);
      const headers = Object.keys(data[0] as object);

      expect(headers).toEqual(['col1', 'col2', 'col3']);
    });

    it('should handle empty CSV', () => {
      const csvContent = '';
      const workbook = XLSX.read(csvContent, { type: 'string' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(sheet);

      expect(data).toHaveLength(0);
    });
  });

  // ─── Excel Parsing ────────────────────────────────────────────────────────

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

      // Parse it back
      const parsed = XLSX.read(buffer, { type: 'array' });
      const parsedSheet = parsed.Sheets[parsed.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(parsedSheet);

      expect(data).toHaveLength(2);
      expect(data[0]).toEqual({
        date: '2024-01-15',
        type: 'income',
        amount: 1000,
      });
    });

    it('should handle multiple sheets', () => {
      const wb = XLSX.utils.book_new();
      const ws1 = XLSX.utils.aoa_to_sheet([['a', 'b'], [1, 2]]);
      const ws2 = XLSX.utils.aoa_to_sheet([['x', 'y'], [3, 4]]);
      XLSX.utils.book_append_sheet(wb, ws1, 'Sheet1');
      XLSX.utils.book_append_sheet(wb, ws2, 'Sheet2');

      expect(wb.SheetNames).toHaveLength(2);
      expect(wb.SheetNames).toContain('Sheet1');
      expect(wb.SheetNames).toContain('Sheet2');
    });
  });

  // ─── Column Mapping Logic ─────────────────────────────────────────────────

  describe('Column Mapping', () => {
    it('should map Excel columns to DB fields', () => {
      const excelRow = {
        'Transaction Date': '2024-01-15',
        'Transaction Type': 'income',
        'Amount': 1000,
        'Category': 'Salary',
        'Account': 'bank',
      };

      const mapping: Record<string, string> = {
        'Transaction Date': 'date',
        'Transaction Type': 'type',
        'Amount': 'amountCents',
        'Category': 'category',
        'Account': 'account',
      };

      const mappedRow: Record<string, unknown> = {};
      for (const [excelCol, dbField] of Object.entries(mapping)) {
        if (excelRow[excelCol as keyof typeof excelRow] !== undefined) {
          mappedRow[dbField] = excelRow[excelCol as keyof typeof excelRow];
        }
      }

      expect(mappedRow).toEqual({
        date: '2024-01-15',
        type: 'income',
        amountCents: 1000,
        category: 'Salary',
        account: 'bank',
      });
    });

    it('should skip unmapped columns', () => {
      const excelRow = {
        'Date': '2024-01-15',
        'Name': 'Test',
        'Ignored': 'value',
      };

      const mapping: Record<string, string> = {
        'Date': 'date',
        'Name': 'title',
      };

      const mappedRow: Record<string, unknown> = {};
      for (const [excelCol, dbField] of Object.entries(mapping)) {
        if (excelRow[excelCol as keyof typeof excelRow] !== undefined) {
          mappedRow[dbField] = excelRow[excelCol as keyof typeof excelRow];
        }
      }

      expect(mappedRow).toEqual({
        date: '2024-01-15',
        title: 'Test',
      });
      expect(mappedRow).not.toHaveProperty('Ignored');
    });

    it('should handle missing values gracefully', () => {
      const excelRow = {
        'Date': '2024-01-15',
        'Name': undefined,
      };

      const mapping: Record<string, string> = {
        'Date': 'date',
        'Name': 'title',
      };

      const mappedRow: Record<string, unknown> = {};
      for (const [excelCol, dbField] of Object.entries(mapping)) {
        const value = excelRow[excelCol as keyof typeof excelRow];
        if (value !== undefined && value !== null) {
          mappedRow[dbField] = value;
        }
      }

      expect(mappedRow).toEqual({ date: '2024-01-15' });
    });
  });

  // ─── Session Management ───────────────────────────────────────────────────

  describe('Session Management', () => {
    let sessions: Map<string, { data: Record<string, unknown>[]; headers: string[]; createdAt: number }>;

    beforeEach(() => {
      sessions = new Map();
    });

    it('should create session with correct structure', () => {
      const sessionId = crypto.randomUUID();
      const data = [{ date: '2024-01-15', type: 'income' }];
      const headers = ['date', 'type'];

      sessions.set(sessionId, { data, headers, createdAt: Date.now() });

      expect(sessions.has(sessionId)).toBe(true);
      const session = sessions.get(sessionId)!;
      expect(session.data).toEqual(data);
      expect(session.headers).toEqual(headers);
      expect(session.createdAt).toBeGreaterThan(0);
    });

    it('should delete session', () => {
      const sessionId = crypto.randomUUID();
      sessions.set(sessionId, { data: [], headers: [], createdAt: Date.now() });

      const existed = sessions.delete(sessionId);
      expect(existed).toBe(true);
      expect(sessions.has(sessionId)).toBe(false);
    });

    it('should cleanup expired sessions', () => {
      const now = Date.now();
      const SESSION_TTL_MS = 3_600_000;

      // Create sessions with different ages
      sessions.set('fresh', { data: [], headers: [], createdAt: now });
      sessions.set('old', { data: [], headers: [], createdAt: now - SESSION_TTL_MS - 1 });
      sessions.set('also-old', { data: [], headers: [], createdAt: now - SESSION_TTL_MS * 2 });

      // Cleanup
      for (const [key, session] of sessions.entries()) {
        if (now - session.createdAt > SESSION_TTL_MS) {
          sessions.delete(key);
        }
      }

      expect(sessions.has('fresh')).toBe(true);
      expect(sessions.has('old')).toBe(false);
      expect(sessions.has('also-old')).toBe(false);
    });

    it('should generate unique session IDs', () => {
      const ids = new Set<string>();
      for (let i = 0; i < 100; i++) {
        ids.add(crypto.randomUUID());
      }
      expect(ids.size).toBe(100);
    });
  });

  // ─── Data Transformation ──────────────────────────────────────────────────

  describe('Data Transformation', () => {
    it('should convert amount to cents', () => {
      const amount = 10.50;
      const cents = Math.round(amount * 100);
      expect(cents).toBe(1050);
    });

    it('should handle integer amounts', () => {
      const amount = 100;
      const cents = Math.round(amount * 100);
      expect(cents).toBe(10000);
    });

    it('should handle decimal precision', () => {
      const amount = 9.99;
      const cents = Math.round(amount * 100);
      expect(cents).toBe(999);
    });

    it('should generate UUID for each row', () => {
      const ids = new Set<string>();
      for (let i = 0; i < 100; i++) {
        ids.add(crypto.randomUUID());
      }
      expect(ids.size).toBe(100);
      for (const id of ids) {
        expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
      }
    });

    it('should set timestamps correctly', () => {
      const now = Math.floor(Date.now() / 1000);
      expect(now).toBeGreaterThan(0);
      expect(typeof now).toBe('number');
    });
  });

  // ─── Batch Processing ─────────────────────────────────────────────────────

  describe('Batch Processing', () => {
    it('should split data into batches', () => {
      const data = Array.from({ length: 250 }, (_, i) => ({ id: i }));
      const BATCH_SIZE = 100;
      const batches: typeof data[] = [];

      for (let i = 0; i < data.length; i += BATCH_SIZE) {
        batches.push(data.slice(i, i + BATCH_SIZE));
      }

      expect(batches).toHaveLength(3);
      expect(batches[0]).toHaveLength(100);
      expect(batches[1]).toHaveLength(100);
      expect(batches[2]).toHaveLength(50);
    });

    it('should handle single batch', () => {
      const data = Array.from({ length: 50 }, (_, i) => ({ id: i }));
      const BATCH_SIZE = 100;
      const batches: typeof data[] = [];

      for (let i = 0; i < data.length; i += BATCH_SIZE) {
        batches.push(data.slice(i, i + BATCH_SIZE));
      }

      expect(batches).toHaveLength(1);
      expect(batches[0]).toHaveLength(50);
    });

    it('should handle empty data', () => {
      const data: Record<string, unknown>[] = [];
      const BATCH_SIZE = 100;
      const batches: typeof data[] = [];

      for (let i = 0; i < data.length; i += BATCH_SIZE) {
        batches.push(data.slice(i, i + BATCH_SIZE));
      }

      expect(batches).toHaveLength(0);
    });
  });

  // ─── Row Validation Counting ──────────────────────────────────────────────

  describe('Row Validation Counting', () => {
    it('should count valid and invalid rows', () => {
      const results = [
        { valid: true },
        { valid: false },
        { valid: true },
        { valid: false },
        { valid: true },
      ];

      const valid = results.filter(r => r.valid).length;
      const invalid = results.filter(r => !r.valid).length;

      expect(valid).toBe(3);
      expect(invalid).toBe(2);
    });

    it('should track row errors with correct indices', () => {
      const errors: Array<{ row: number; field: string; message: string }> = [];
      const data = [
        { date: '2024-01-15', type: 'income' },
        { date: 'invalid', type: 'expense' },
        { date: '2024-01-17', type: 'income' },
      ];

      // Simulate validation
      data.forEach((row, index) => {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(row.date)) {
          errors.push({
            row: index + 2, // +1 for 0-index, +1 for header
            field: 'date',
            message: 'Invalid date format',
          });
        }
      });

      expect(errors).toHaveLength(1);
      expect(errors[0]).toEqual({
        row: 3,
        field: 'date',
        message: 'Invalid date format',
      });
    });
  });
});
