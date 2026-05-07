import { describe, expect, test } from 'vitest';
import { truncateIp } from './route';

describe('truncateIp', () => {
  test('IPv4 zero-fills the last octet for /24', () => {
    expect(truncateIp('192.168.1.42')).toBe('192.168.1.0');
  });

  test('IPv6 keeps first three groups and appends ::', () => {
    expect(truncateIp('2001:db8:85a3:0:0:8a2e:370:7334')).toBe('2001:db8:85a3::');
  });

  test('empty string returns empty', () => {
    expect(truncateIp('')).toBe('');
  });

  test('non-IP-shaped string is returned unchanged (defensive)', () => {
    expect(truncateIp('not-an-ip')).toBe('not-an-ip');
  });
});
