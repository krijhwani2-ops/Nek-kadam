import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as tokenService from './tokenService';

// To mock fetch, we can replace global.fetch
describe('tokenService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('apiCall', () => {
    it('should catch network errors and return error message', async () => {
      // Create a mock fetch that throws an error
      const mockFetch = vi.fn().mockRejectedValue(new Error('Simulated network error'));
      vi.stubGlobal('fetch', mockFetch);

      // Call any exported function that uses apiCall
      const result = await tokenService.fetchDepartments();

      expect(mockFetch).toHaveBeenCalled();
      expect(result).toEqual({ error: 'Simulated network error' });
    });

    it('should return default Network error if error has no message', async () => {
      // Create a mock fetch that throws an error without a message string
      const mockFetch = vi.fn().mockRejectedValue('String error');
      vi.stubGlobal('fetch', mockFetch);

      const result = await tokenService.fetchDepartments();

      expect(mockFetch).toHaveBeenCalled();
      expect(result).toEqual({ error: 'Network error' });
    });
  });
});
