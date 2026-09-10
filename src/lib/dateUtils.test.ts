import { describe, it, expect } from 'vitest';
import { safeParseDate, safeFormatDate, safeFormatTime } from './dateUtils';

describe('dateUtils', () => {
  describe('safeParseDate', () => {
    it('returns null for null, undefined, or empty string', () => {
      expect(safeParseDate(null)).toBeNull();
      expect(safeParseDate(undefined)).toBeNull();
      expect(safeParseDate('')).toBeNull();
    });

    it('returns the same Date object if it is valid', () => {
      const validDate = new Date('2024-01-01T12:00:00Z');
      expect(safeParseDate(validDate)).toBe(validDate);
    });

    it('returns null if the input is an invalid Date object', () => {
      const invalidDate = new Date('invalid');
      expect(safeParseDate(invalidDate)).toBeNull();
    });

    it('parses valid ISO strings', () => {
      const isoString = '2024-01-01T12:00:00Z';
      const result = safeParseDate(isoString);
      expect(result).toBeInstanceOf(Date);
      expect(result?.toISOString()).toBe('2024-01-01T12:00:00.000Z');
    });

    it('parses space-separated ISO strings', () => {
      const spaceSeparated = '2024-01-01 12:00:00';
      const result = safeParseDate(spaceSeparated);
      expect(result).toBeInstanceOf(Date);
      // Depending on local timezone, we just check it's valid
      expect(isNaN(result?.getTime() as number)).toBe(false);
    });

    it('parses timestamps (numbers)', () => {
      const timestamp = 1704110400000; // 2024-01-01T12:00:00Z
      const result = safeParseDate(timestamp);
      expect(result).toBeInstanceOf(Date);
      expect(result?.getTime()).toBe(timestamp);
    });

    it('returns null for invalid strings', () => {
      expect(safeParseDate('not a date')).toBeNull();
    });

    it('returns valid date for fallback parseable strings', () => {
      // Something that Date.parse might handle but not standard ISO
      const result = safeParseDate('Jan 1 2024');
      expect(result).toBeInstanceOf(Date);
      expect(isNaN(result?.getTime() as number)).toBe(false);
    });
  });

  describe('safeFormatDate', () => {
    it('formats a valid date to localized string', () => {
      const date = new Date('2024-01-01T12:00:00Z');
      const result = safeFormatDate(date, undefined, 'en-US');
      expect(typeof result).toBe('string');
      expect(result).not.toBe('N/A');
    });

    it('returns fallback for invalid inputs', () => {
      expect(safeFormatDate(null)).toBe('N/A');
      expect(safeFormatDate('invalid')).toBe('N/A');
    });

    it('returns custom fallback if provided', () => {
      expect(safeFormatDate(null, undefined, undefined, 'Unknown')).toBe('Unknown');
    });

    it('handles format exceptions and returns fallback', () => {
      const date = new Date('2024-01-01T12:00:00Z');
      // Force an exception by passing something that Intl.DateTimeFormat rejects
      expect(safeFormatDate(date, { timeZone: 'INVALID_TZ' } as any)).toBe('N/A');
    });
  });

  describe('safeFormatTime', () => {
    it('formats a valid time to localized string', () => {
      const date = new Date('2024-01-01T12:00:00Z');
      const result = safeFormatTime(date, undefined, 'en-US');
      expect(typeof result).toBe('string');
      expect(result).not.toBe('N/A');
    });

    it('returns fallback for invalid inputs', () => {
      expect(safeFormatTime(null)).toBe('N/A');
      expect(safeFormatTime('invalid')).toBe('N/A');
    });

    it('returns custom fallback if provided', () => {
      expect(safeFormatTime(null, undefined, undefined, 'Unknown')).toBe('Unknown');
    });

    it('handles format exceptions and returns fallback', () => {
      const date = new Date('2024-01-01T12:00:00Z');
      expect(safeFormatTime(date, { timeZone: 'INVALID_TZ' } as any)).toBe('N/A');
    });
  });
});
