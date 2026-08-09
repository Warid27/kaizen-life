import { describe, it, expect } from 'vitest';
import {
  EntityTypeSchema,
  TransactionImportSchema,
  TaskImportSchema,
  HabitImportSchema,
  CheckinImportSchema,
  ProjectImportSchema,
  ClientImportSchema,
  GoalImportSchema,
  CourseImportSchema,
  AssignmentImportSchema,
  ENTITY_FIELD_DEFINITIONS,
  ENTITY_VALIDATION_SCHEMAS,
} from './import';

// ─── EntityType Schema ──────────────────────────────────────────────────────

describe('EntityTypeSchema', () => {
  it('should accept valid entity types', () => {
    expect(EntityTypeSchema.parse('transactions')).toBe('transactions');
    expect(EntityTypeSchema.parse('tasks')).toBe('tasks');
    expect(EntityTypeSchema.parse('habits')).toBe('habits');
    expect(EntityTypeSchema.parse('reminders')).toBe('reminders');
  });

  it('should reject invalid entity types', () => {
    expect(() => EntityTypeSchema.parse('invalid')).toThrow();
    expect(() => EntityTypeSchema.parse('')).toThrow();
    expect(() => EntityTypeSchema.parse('Transactions')).toThrow(); // case-sensitive
  });
});

// ─── Transaction Import Schema ──────────────────────────────────────────────

describe('TransactionImportSchema', () => {
  it('should accept valid transaction data', () => {
    const valid = {
      date: '2024-01-15',
      type: 'income',
      amountCents: 1050,
      category: 'Salary',
      account: 'bank',
    };
    expect(TransactionImportSchema.parse(valid)).toEqual(valid);
  });

  it('should accept transaction with optional note', () => {
    const valid = {
      date: '2024-01-15',
      type: 'expense',
      amountCents: 50000,
      category: 'Food',
      account: 'cash',
      note: 'Lunch at warung',
    };
    expect(TransactionImportSchema.parse(valid)).toEqual(valid);
  });

  it('should reject invalid date format', () => {
    expect(() =>
      TransactionImportSchema.parse({
        date: '15-01-2024', // wrong format
        type: 'income',
        amountCents: 1000,
        category: 'Test',
        account: 'bank',
      })
    ).toThrow();
  });

  it('should reject invalid type', () => {
    expect(() =>
      TransactionImportSchema.parse({
        date: '2024-01-15',
        type: 'transfer', // not income or expense
        amountCents: 1000,
        category: 'Test',
        account: 'bank',
      })
    ).toThrow();
  });

  it('should reject negative amount', () => {
    expect(() =>
      TransactionImportSchema.parse({
        date: '2024-01-15',
        type: 'income',
        amountCents: -1000,
        category: 'Test',
        account: 'bank',
      })
    ).toThrow();
  });

  it('should reject missing required fields', () => {
    expect(() =>
      TransactionImportSchema.parse({
        date: '2024-01-15',
        // missing type, amountCents, category, account
      })
    ).toThrow();
  });
});

// ─── Task Import Schema ─────────────────────────────────────────────────────

describe('TaskImportSchema', () => {
  it('should accept valid task with all fields', () => {
    const valid = {
      title: 'Complete homework',
      description: 'Math chapter 5',
      date: '2024-01-20',
      startTime: '09:00',
      endTime: '11:00',
      priority: 'high',
      status: 'todo',
    };
    expect(TaskImportSchema.parse(valid)).toEqual(valid);
  });

  it('should accept task with only required title', () => {
    const valid = { title: 'Simple task' };
    const result = TaskImportSchema.parse(valid);
    expect(result.title).toBe('Simple task');
    expect(result.priority).toBe('medium'); // default
    expect(result.status).toBe('todo'); // default
  });

  it('should reject empty title', () => {
    expect(() => TaskImportSchema.parse({ title: '' })).toThrow();
  });

  it('should reject title exceeding 200 chars', () => {
    expect(() =>
      TaskImportSchema.parse({ title: 'a'.repeat(201) })
    ).toThrow();
  });

  it('should reject invalid priority', () => {
    expect(() =>
      TaskImportSchema.parse({ title: 'Test', priority: 'critical' })
    ).toThrow();
  });

  it('should reject invalid status', () => {
    expect(() =>
      TaskImportSchema.parse({ title: 'Test', status: 'pending' })
    ).toThrow();
  });
});

// ─── Habit Import Schema ────────────────────────────────────────────────────

describe('HabitImportSchema', () => {
  it('should accept valid habit', () => {
    const valid = {
      name: 'Exercise',
      icon: '💪',
      category: 'health',
      frequency: 'daily',
    };
    const result = HabitImportSchema.parse(valid);
    expect(result.name).toBe('Exercise');
    expect(result.icon).toBe('💪');
    expect(result.category).toBe('health');
    expect(result.frequency).toBe('daily');
    expect(result.targetCountPerPeriod).toBe(1); // default
    expect(result.active).toBe(true); // default
    expect(result.sortOrder).toBe(0); // default
  });

  it('should reject missing name', () => {
    expect(() =>
      HabitImportSchema.parse({ frequency: 'daily' })
    ).toThrow();
  });

  it('should reject invalid frequency', () => {
    expect(() =>
      HabitImportSchema.parse({ name: 'Test', frequency: 'monthly' })
    ).toThrow();
  });
});

// ─── Checkin Import Schema ──────────────────────────────────────────────────

describe('CheckinImportSchema', () => {
  it('should accept valid checkin', () => {
    const valid = {
      date: '2024-01-15',
      bedTime: '23:00',
      wakeTime: '07:00',
      sleepQuality: 4,
      mood: 8,
      energy: 7,
      stress: 3,
    };
    const result = CheckinImportSchema.parse(valid);
    expect(result.date).toBe('2024-01-15');
    expect(result.bedTime).toBe('23:00');
    expect(result.wakeTime).toBe('07:00');
    expect(result.sleepQuality).toBe(4);
    expect(result.mood).toBe(8);
    expect(result.energy).toBe(7);
    expect(result.stress).toBe(3);
    expect(result.napMinutes).toBe(0); // default
  });

  it('should reject sleepQuality out of range (1-5)', () => {
    expect(() =>
      CheckinImportSchema.parse({
        date: '2024-01-15',
        sleepQuality: 6,
      })
    ).toThrow();
  });

  it('should reject mood out of range (1-10)', () => {
    expect(() =>
      CheckinImportSchema.parse({
        date: '2024-01-15',
        mood: 11,
      })
    ).toThrow();
  });
});

// ─── Project Import Schema ──────────────────────────────────────────────────

describe('ProjectImportSchema', () => {
  it('should accept valid project', () => {
    const valid = {
      name: 'KaizenLife',
      status: 'active',
      priority: 'high',
      deadline: '2024-06-30',
      progressPct: 50,
    };
    expect(ProjectImportSchema.parse(valid)).toEqual(valid);
  });

  it('should reject missing name', () => {
    expect(() => ProjectImportSchema.parse({ status: 'active' })).toThrow();
  });

  it('should reject invalid status', () => {
    expect(() =>
      ProjectImportSchema.parse({ name: 'Test', status: 'blocked' })
    ).toThrow();
  });
});

// ─── Client Import Schema ───────────────────────────────────────────────────

describe('ClientImportSchema', () => {
  it('should accept valid client', () => {
    const valid = {
      name: 'PT Maju Jaya',
      company: 'PT Maju Jaya',
      contactInfo: '08123456789',
    };
    expect(ClientImportSchema.parse(valid)).toEqual(valid);
  });

  it('should reject missing name', () => {
    expect(() => ClientImportSchema.parse({ company: 'Test' })).toThrow();
  });
});

// ─── Goal Import Schema ─────────────────────────────────────────────────────

describe('GoalImportSchema', () => {
  it('should accept valid goal', () => {
    const valid = {
      title: 'Read 12 books',
      type: 'annual',
      periodStart: '2024-01-01',
      periodEnd: '2024-12-31',
      targetValue: 12,
      unit: 'books',
    };
    const result = GoalImportSchema.parse(valid);
    expect(result.title).toBe('Read 12 books');
    expect(result.type).toBe('annual');
    expect(result.periodStart).toBe('2024-01-01');
    expect(result.periodEnd).toBe('2024-12-31');
    expect(result.targetValue).toBe(12);
    expect(result.unit).toBe('books');
    expect(result.currentValue).toBe(0); // default
    expect(result.status).toBe('not_started'); // default
  });

  it('should reject invalid type', () => {
    expect(() =>
      GoalImportSchema.parse({
        title: 'Test',
        type: 'daily',
        periodStart: '2024-01-01',
        periodEnd: '2024-12-31',
      })
    ).toThrow();
  });
});

// ─── Course Import Schema ───────────────────────────────────────────────────

describe('CourseImportSchema', () => {
  it('should accept valid course', () => {
    const valid = {
      semesterId: 'semester-123',
      name: 'Linear Algebra',
      code: 'MATH201',
      lecturer: 'Dr. Smith',
      room: 'Room 101',
    };
    expect(CourseImportSchema.parse(valid)).toEqual(valid);
  });
});

// ─── Assignment Import Schema ───────────────────────────────────────────────

describe('AssignmentImportSchema', () => {
  it('should accept valid assignment', () => {
    const valid = {
      courseId: 'course-123',
      title: 'Homework 1',
      dueDate: '2024-01-20',
      priority: 'medium',
      status: 'not_started',
    };
    expect(AssignmentImportSchema.parse(valid)).toEqual(valid);
  });

  it('should reject missing courseId', () => {
    expect(() =>
      AssignmentImportSchema.parse({ title: 'Test', dueDate: '2024-01-20' })
    ).toThrow();
  });

  it('should reject missing title', () => {
    expect(() =>
      AssignmentImportSchema.parse({ courseId: 'course-123', dueDate: '2024-01-20' })
    ).toThrow();
  });

  it('should reject missing dueDate', () => {
    expect(() =>
      AssignmentImportSchema.parse({ courseId: 'course-123', title: 'Test' })
    ).toThrow();
  });
});

// ─── Entity Field Definitions ───────────────────────────────────────────────

describe('ENTITY_FIELD_DEFINITIONS', () => {
  it('should have definitions for all 22 entity types', () => {
    expect(Object.keys(ENTITY_FIELD_DEFINITIONS)).toHaveLength(22);
  });

  it('each definition should have required fields', () => {
    for (const [entityType, def] of Object.entries(ENTITY_FIELD_DEFINITIONS)) {
      expect(def.entityType).toBe(entityType);
      expect(def.label).toBeTruthy();
      expect(def.fields.length).toBeGreaterThan(0);

      for (const field of def.fields) {
        expect(field.key).toBeTruthy();
        expect(field.label).toBeTruthy();
        expect(['string', 'number', 'date', 'enum', 'boolean']).toContain(field.type);
        expect(typeof field.required).toBe('boolean');

        if (field.type === 'enum') {
          expect(field.enumValues).toBeDefined();
          expect(field.enumValues!.length).toBeGreaterThan(0);
        }
      }
    }
  });
});

// ─── Entity Validation Schemas Map ──────────────────────────────────────────

describe('ENTITY_VALIDATION_SCHEMAS', () => {
  it('should have schemas for all 22 entity types', () => {
    expect(Object.keys(ENTITY_VALIDATION_SCHEMAS)).toHaveLength(22);
  });

  it('each entity type should have a validation schema', () => {
    const entityTypes = EntityTypeSchema.options;
    for (const entityType of entityTypes) {
      expect(ENTITY_VALIDATION_SCHEMAS[entityType]).toBeDefined();
    }
  });
});
