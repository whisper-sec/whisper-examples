// SPDX-License-Identifier: MIT
// KEYLESS search: verify whether an IP/hostname is a Whisper agent (DANE + JWS evidence).
// Always returns a verdict object — is_whisper_agent true/false — so a Zap can branch on
// it instead of dying on "no results" (Postel: maximum reliability, minimum resistance).
'use strict';

const { keylessGet } = require('../lib/keyless');

const perform = async (z, bundle) => {
  const addr = (bundle.inputData.address || '').trim();
  const response = await keylessGet(z, '/verify-identity', { ip: addr });
  if (response.status === 200) {
    return [{ id: addr, ...response.data }];
  }
  if (response.status === 404) {
    const detail =
      (response.data && response.data.detail) || 'Not a Whisper agent identity.';
    return [{ id: addr, is_whisper_agent: false, detail }];
  }
  const detail =
    (response.data && (response.data.detail || response.data.title)) ||
    `verify-identity returned status ${response.status}`;
  throw new z.errors.Error(detail, 'VerifyError', response.status);
};

module.exports = {
  key: 'verify_identity',
  noun: 'Identity',
  display: {
    label: 'Verify Agent Identity',
    description:
      'Checks whether an IP address (or agent hostname) is a verified Whisper agent — keyless, no API key needed. Returns the verdict with DANE/JWS evidence.',
  },
  operation: {
    perform,
    inputFields: [
      {
        key: 'address',
        label: 'IP Address or Hostname',
        type: 'string',
        required: true,
        helpText: 'The IPv6 /128 (or agent FQDN) to verify, e.g. `2a04:2a01:0:42::1`.',
      },
    ],
    sample: {
      id: '2a04:2a01:0:42::1',
      is_whisper_agent: true,
      fqdn: 'a0000000000000001.t0000000000000000000000000000000.agents.whisper.online',
      operator: 'Whisper Security',
      tenant: 't0000000000000000000000000000000',
      dane_ok: true,
      jws_ok: true,
      verified_at: '2026-07-01T12:00:00Z',
      detail: 'Verified Whisper agent identity.',
    },
    outputFields: [
      { key: 'is_whisper_agent', label: 'Is Whisper Agent', type: 'boolean' },
      { key: 'fqdn', label: 'Agent FQDN' },
      { key: 'operator', label: 'Operator' },
      { key: 'tenant', label: 'Tenant' },
      { key: 'dane_ok', label: 'DANE OK', type: 'boolean' },
      { key: 'jws_ok', label: 'JWS OK', type: 'boolean' },
      { key: 'verified_at', label: 'Verified At' },
      { key: 'detail', label: 'Detail' },
    ],
  },
};
