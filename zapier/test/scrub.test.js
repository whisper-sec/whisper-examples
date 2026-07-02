// SPDX-License-Identifier: MIT
// Unit tests: secret-stripping before anything reaches persisted Zap task data (offline).
/* globals describe, it, expect */
'use strict';

const { scrub } = require('../lib/scrub');

describe('scrub (bearer hygiene)', () => {
  it('drops every secret-carrying field', () => {
    const out = scrub({
      tier: 'socks5',
      address: '2a04:2a01:0:42::1',
      http_proxy: 'http://w:et_deadbeef00@example.invalid:443',
      connection_string: 'socks5h://w:et_deadbeef00@example.invalid:443',
      client_private_key: 'AAAA',
      wireguard_config: '[Interface]\nPrivateKey = AAAA\n',
      api_key: 'whisper_live_x',
    });
    expect(out).toEqual({ tier: 'socks5', address: '2a04:2a01:0:42::1' });
  });

  it('pattern-redacts stray bearers and private keys in remaining strings', () => {
    const out = scrub({ note: 'use et_deadbeef00 here', cfg: 'PrivateKey = abc123' });
    expect(out.note).toBe('use <redacted> here');
    expect(out.cfg).toBe('<redacted>');
  });

  it('honours the keep list (register returns its one-time api_key)', () => {
    const out = scrub({ api_key: 'whisper_live_once', agent: 'a1' }, ['api_key']);
    expect(out.api_key).toBe('whisper_live_once');
    expect(out.agent).toBe('a1');
  });

  it('tolerates null/empty records', () => {
    expect(scrub(null)).toEqual({});
    expect(scrub({})).toEqual({});
  });
});
