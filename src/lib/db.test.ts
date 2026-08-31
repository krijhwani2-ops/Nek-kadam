
import { cleanPatientId } from './db';

describe('db', () => {
  describe('cleanPatientId', () => {
    it('returns empty string for null or undefined', () => {
      expect(cleanPatientId(null)).toBe('');
      expect(cleanPatientId(undefined)).toBe('');
    });

    it('returns the same string for standard string input', () => {
      expect(cleanPatientId('12345')).toBe('12345');
      expect(cleanPatientId('abcde')).toBe('abcde');
    });

    it('trims whitespace from string input', () => {
      expect(cleanPatientId('  12345  ')).toBe('12345');
      expect(cleanPatientId('\t12345\n')).toBe('12345');
    });

    it('converts number to string', () => {
      expect(cleanPatientId(12345)).toBe('12345');
      expect(cleanPatientId(0)).toBe('0');
    });

    it('removes trailing .0 from string', () => {
      expect(cleanPatientId('12345.0')).toBe('12345');
      expect(cleanPatientId('123.0.0')).toBe('123.0'); // Only removes the last .0
    });

    it('handles numeric input with .0 correctly', () => {
      // In JavaScript, 12345.0 is just 12345, so String(12345.0) is '12345'
      expect(cleanPatientId(12345.0)).toBe('12345');
    });

    it('handles string with spaces and .0 correctly', () => {
      expect(cleanPatientId('  12345.0  ')).toBe('12345');
    });
  });
});
