import { describe, it, expect, vi, beforeEach } from 'vitest';
import { parseMedicines } from '../utils';
import { db } from '../db';

// Mock the db dependency
vi.mock('../db', () => ({
  db: {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    in: vi.fn(),
  }
}));

describe('parseMedicines', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return an empty array if input is empty or null', async () => {
    expect(await parseMedicines('')).toEqual([]);
    // @ts-expect-error - testing runtime behavior for null/undefined
    expect(await parseMedicines(null)).toEqual([]);
    // @ts-expect-error - testing runtime behavior for undefined
    expect(await parseMedicines(undefined)).toEqual([]);
  });

  it('should return an empty array if input contains only separators or spaces', async () => {
    expect(await parseMedicines('  +  ,  ')).toEqual([]);
  });

  it('should correctly parse comma and plus separated medicine codes and return mock db results', async () => {
    const mockData = [
      { code: 'MED1', name: 'Medicine One' },
      { code: 'MED2', name: 'Medicine Two' }
    ];

    (db.in as any).mockResolvedValue({ data: mockData, error: null });

    const result = await parseMedicines('med1 + med2, MED3');

    // db.in should be called with uppercased codes
    expect(db.in).toHaveBeenCalledWith('code', ['MED1', 'MED2', 'MED3']);

    expect(result).toEqual([
      { code: 'MED1', name: 'Medicine One', found: true },
      { code: 'MED2', name: 'Medicine Two', found: true },
      { code: 'MED3', name: 'Unknown Medicine', found: false },
    ]);
  });

  it('should handle case insensitivity correctly', async () => {
    const mockData = [
      { code: 'mEd1', name: 'Medicine One' } // simulate db returning varying case code
    ];

    (db.in as any).mockResolvedValue({ data: mockData, error: null });

    const result = await parseMedicines('mEd1');
    expect(db.in).toHaveBeenCalledWith('code', ['MED1']);

    expect(result).toEqual([
      { code: 'MED1', name: 'Medicine One', found: true },
    ]);
  });

  it('should return empty array and log error on db error', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    (db.in as any).mockResolvedValue({ data: null, error: new Error('DB Error') });

    const result = await parseMedicines('MED1');

    expect(result).toEqual([]);
    expect(consoleSpy).toHaveBeenCalledWith("Error fetching medicines:", expect.any(Error));

    consoleSpy.mockRestore();
  });
});
