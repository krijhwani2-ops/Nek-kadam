import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchBatches } from './educationService';
import * as sessionModule from './session';

// Mock the session module
vi.mock('./session', () => ({
  getStoredSession: vi.fn(),
}));

describe('educationService - apiCall error handling', () => {
  const originalFetch = global.fetch;


  beforeEach(() => {
    // Reset mocks before each test
    vi.resetAllMocks();

    // Default session mock
    vi.mocked(sessionModule.getStoredSession).mockResolvedValue({ sessionId: 'test-session-id' });

    // Mock window to control getBaseUrl behavior if needed, or leave undefined to test fallback
    // We will leave it undefined to take the local storage / default path for getBaseUrl
  });

  afterEach(() => {
    // Restore global fetch
    global.fetch = originalFetch;
  });

  it('handles non-ok response with JSON error', async () => {
    // Mock fetch to return a 400 Bad Request with a JSON body
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: () => Promise.resolve({ error: 'Custom Server Error Message' }),
    });

    const result = await fetchBatches();
    expect(result).toEqual({ error: 'Custom Server Error Message' });
  });

  it('handles non-ok response without JSON error (fallback to status)', async () => {
    // Mock fetch to return a 500 Internal Server Error without valid JSON body
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.reject(new Error('Invalid JSON')),
    });

    const result = await fetchBatches();
    expect(result).toEqual({ error: 'Server Error: 500' });
  });

  it('handles TimeoutError', async () => {
    // Mock fetch to throw a TimeoutError
    const timeoutError = new Error('The operation timed out.');
    timeoutError.name = 'TimeoutError';
    global.fetch = vi.fn().mockRejectedValue(timeoutError);

    const result = await fetchBatches();
    expect(result).toEqual({ error: 'Request timed out. Please try again.' });
  });

  it('handles generic network error', async () => {
    // Mock fetch to throw a generic error
    global.fetch = vi.fn().mockRejectedValue(new Error('Failed to fetch'));

    const result = await fetchBatches();
    expect(result).toEqual({ error: 'Failed to fetch' });
  });

  it('handles fetch error without a message', async () => {
    // Mock fetch to throw an error without a message property
    global.fetch = vi.fn().mockRejectedValue({});

    const result = await fetchBatches();
    expect(result).toEqual({ error: 'Network error' });
  });
});
