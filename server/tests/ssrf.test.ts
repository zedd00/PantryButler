import { describe, it, expect } from 'vitest';
import { isBlockedIpv4, isBlockedIpv6, isBlockedAddress } from '../src/utils/ssrf';

describe('isBlockedIpv4', () => {
  it('blocks loopback, private, link-local, and reserved ranges', () => {
    expect(isBlockedIpv4('127.0.0.1')).toBe(true);
    expect(isBlockedIpv4('10.0.0.1')).toBe(true);
    expect(isBlockedIpv4('172.16.0.1')).toBe(true);
    expect(isBlockedIpv4('192.168.1.1')).toBe(true);
    expect(isBlockedIpv4('169.254.169.254')).toBe(true);
    expect(isBlockedIpv4('0.0.0.0')).toBe(true);
    expect(isBlockedIpv4('100.64.0.1')).toBe(true);
  });

  it('allows public addresses', () => {
    expect(isBlockedIpv4('8.8.8.8')).toBe(false);
    expect(isBlockedIpv4('1.1.1.1')).toBe(false);
  });
});

describe('isBlockedIpv6 (SSRF guard)', () => {
  it('blocks unspecified, loopback, ULA, link-local, and multicast', () => {
    expect(isBlockedIpv6('::')).toBe(true);
    expect(isBlockedIpv6('::1')).toBe(true);
    expect(isBlockedIpv6('fc00::1')).toBe(true);
    expect(isBlockedIpv6('fd12:3456::1')).toBe(true);
    expect(isBlockedIpv6('fe80::1')).toBe(true);
    expect(isBlockedIpv6('ff02::1')).toBe(true);
  });

  it('blocks dotted-form IPv4-mapped private addresses', () => {
    expect(isBlockedIpv6('::ffff:127.0.0.1')).toBe(true);
    expect(isBlockedIpv6('::ffff:10.0.0.1')).toBe(true);
    expect(isBlockedIpv6('::ffff:169.254.169.254')).toBe(true);
  });

  it('blocks HEX-form IPv4-mapped private addresses (the classic bypass)', () => {
    // 0:0:0:0:0:ffff:7f00:1 == ::ffff:127.0.0.1
    expect(isBlockedIpv6('0:0:0:0:0:ffff:7f00:1')).toBe(true);
    // ::ffff:a9fe:a9fe == ::ffff:169.254.169.254 (cloud metadata)
    expect(isBlockedIpv6('::ffff:a9fe:a9fe')).toBe(true);
    // ::ffff:ac1f:000a == ::ffff:172.31.0.10
    expect(isBlockedIpv6('0:0:0:0:0:ffff:ac1f:000a')).toBe(true);
    // ::ffff:c0a8:0101 == ::ffff:192.168.1.1
    expect(isBlockedIpv6('::ffff:c0a8:0101')).toBe(true);
  });

  it('blocks 6to4 addresses embedding private IPv4', () => {
    // 2002:7f00:1:: == 6to4 for 127.0.0.1
    expect(isBlockedIpv6('2002:7f00:1::')).toBe(true);
    // 2002:a9fe:a9fe:: == 6to4 for 169.254.169.254
    expect(isBlockedIpv6('2002:a9fe:a9fe::')).toBe(true);
    // 2002:ac1f:000a:: == 6to4 for 172.31.0.10
    expect(isBlockedIpv6('2002:ac1f:000a::')).toBe(true);
  });

  it('blocks NAT64 addresses embedding private IPv4', () => {
    // 64:ff9b::7f00:1 == NAT64 for 127.0.0.1
    expect(isBlockedIpv6('64:ff9b::7f00:1')).toBe(true);
    // 64:ff9b::a9fe:a9fe == NAT64 for 169.254.169.254
    expect(isBlockedIpv6('64:ff9b::a9fe:a9fe')).toBe(true);
  });

  it('blocks Teredo server addresses resolving to private IPv4', () => {
    // Teredo: the server IPv4 is hextets 2-3 XOR 0xffff. For 127.0.0.1 the
    // obfuscated hextets are 0x8000 0xfffe -> 2001:0000:8000:fffe:...
    expect(isBlockedIpv6('2001:0:8000:fffe::')).toBe(true);
    // 169.254.169.254 -> 0x5601 0x5601 -> 2001:0:5601:5601::
    expect(isBlockedIpv6('2001:0:5601:5601::')).toBe(true);
  });

  it('allows public global-unicast addresses', () => {
    expect(isBlockedIpv6('2606:4700:4700::1111')).toBe(false);
    expect(isBlockedIpv6('2001:4860:4860::8888')).toBe(false);
  });
});

describe('isBlockedAddress', () => {
  it('routes IPv4 and IPv6 to the right guard and blocks unknown input', () => {
    expect(isBlockedAddress('127.0.0.1')).toBe(true);
    expect(isBlockedAddress('::ffff:7f00:1')).toBe(true);
    expect(isBlockedAddress('8.8.8.8')).toBe(false);
    expect(isBlockedAddress('not-an-ip')).toBe(true);
  });
});
