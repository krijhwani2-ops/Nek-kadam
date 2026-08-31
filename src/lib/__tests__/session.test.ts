import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { setServerIp, getServerIp } from '../session';

describe('session utils', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    // Spy on localStorage methods
    vi.spyOn(Storage.prototype, 'setItem');
    vi.spyOn(Storage.prototype, 'removeItem');
    vi.spyOn(Storage.prototype, 'getItem');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('setServerIp', () => {
    it('should set the server IP in localStorage when a valid IP is provided', () => {
      setServerIp('10.0.0.1');
      expect(localStorage.setItem).toHaveBeenCalledWith('NEK_KADAM_SERVER_IP', '10.0.0.1');
      expect(localStorage.getItem('NEK_KADAM_SERVER_IP')).toBe('10.0.0.1');
    });

    it('should remove the server IP from localStorage when an empty string is provided', () => {
      localStorage.setItem('NEK_KADAM_SERVER_IP', '10.0.0.1');
      setServerIp('');
      expect(localStorage.removeItem).toHaveBeenCalledWith('NEK_KADAM_SERVER_IP');
      expect(localStorage.getItem('NEK_KADAM_SERVER_IP')).toBeNull();
    });

    it('should remove the server IP from localStorage when undefined is provided', () => {
      localStorage.setItem('NEK_KADAM_SERVER_IP', '10.0.0.1');
      // @ts-expect-error - testing invalid input
      setServerIp(undefined);
      expect(localStorage.removeItem).toHaveBeenCalledWith('NEK_KADAM_SERVER_IP');
      expect(localStorage.getItem('NEK_KADAM_SERVER_IP')).toBeNull();
    });

    it('should remove the server IP from localStorage when null is provided', () => {
      localStorage.setItem('NEK_KADAM_SERVER_IP', '10.0.0.1');
      // @ts-expect-error - testing invalid input
      setServerIp(null);
      expect(localStorage.removeItem).toHaveBeenCalledWith('NEK_KADAM_SERVER_IP');
      expect(localStorage.getItem('NEK_KADAM_SERVER_IP')).toBeNull();
    });
  });

  describe('getServerIp', () => {
    it('should return the saved IP if it exists in localStorage', () => {
      localStorage.setItem('NEK_KADAM_SERVER_IP', '192.168.1.100');
      const ip = getServerIp();
      expect(ip).toBe('192.168.1.100');
    });

    it('should return the default IP if nothing is saved in localStorage', () => {
      const ip = getServerIp();
      expect(ip).toBe('192.168.29.180');
    });
  });
});
