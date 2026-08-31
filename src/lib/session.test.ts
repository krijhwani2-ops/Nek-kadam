import { describe, it, expect } from 'vitest';
import { isPrivateNetwork } from './session';

describe('session', () => {
  describe('isPrivateNetwork', () => {
    it('returns true for localhost and loopback', () => {
      expect(isPrivateNetwork('localhost')).toBe(true);
      expect(isPrivateNetwork('127.0.0.1')).toBe(true);
    });

    it('returns true for empty string or nullish values', () => {
      expect(isPrivateNetwork('')).toBe(true);
      expect(isPrivateNetwork(undefined as any)).toBe(true);
      expect(isPrivateNetwork(null as any)).toBe(true);
    });

    it('returns true for 192.168.x.x addresses', () => {
      expect(isPrivateNetwork('192.168.0.1')).toBe(true);
      expect(isPrivateNetwork('192.168.1.100')).toBe(true);
      expect(isPrivateNetwork('192.168.255.255')).toBe(true);
    });

    it('returns true for 10.x.x.x addresses', () => {
      expect(isPrivateNetwork('10.0.0.1')).toBe(true);
      expect(isPrivateNetwork('10.10.10.10')).toBe(true);
      expect(isPrivateNetwork('10.255.255.255')).toBe(true);
    });

    it('returns true for 172.16.x.x to 172.31.x.x addresses', () => {
      expect(isPrivateNetwork('172.16.0.1')).toBe(true);
      expect(isPrivateNetwork('172.20.10.2')).toBe(true);
      expect(isPrivateNetwork('172.31.255.255')).toBe(true);
    });

    it('returns false for public 172.x.x.x addresses (outside 16-31)', () => {
      expect(isPrivateNetwork('172.15.255.255')).toBe(false);
      expect(isPrivateNetwork('172.32.0.1')).toBe(false);
      expect(isPrivateNetwork('172.100.0.1')).toBe(false);
    });

    it('returns false for public IP addresses', () => {
      expect(isPrivateNetwork('8.8.8.8')).toBe(false);
      expect(isPrivateNetwork('1.1.1.1')).toBe(false);
      expect(isPrivateNetwork('142.250.190.46')).toBe(false);
    });

    it('returns false for public domain names', () => {
      expect(isPrivateNetwork('google.com')).toBe(false);
      expect(isPrivateNetwork('example.org')).toBe(false);
      expect(isPrivateNetwork('api.my-service.net')).toBe(false);
    });
  });
});
