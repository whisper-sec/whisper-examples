// SPDX-License-Identifier: MIT
// KEYED create: fetch the egress configuration bound to an agent's /128 —
// whisper.agents({op:'connect'}). Secret hygiene: a Zapier step cannot bring up a local
// proxy, and Zap task data is persisted — so every secret-carrying field (et_ bearers,
// WireGuard private keys, full connection strings) is STRIPPED before it is returned.
// Use the `whisper` CLI or the whisper-edge SDK on a host you control for live egress.
'use strict';

const { callControl } = require('../lib/control');
const { scrub } = require('../lib/scrub');

const perform = async (z, bundle) => {
  const args = { tier: bundle.inputData.tier || 'socks5' };
  if (bundle.inputData.agent) args.agent = bundle.inputData.agent.trim();
  if (bundle.inputData.public_key) args.public_key = bundle.inputData.public_key.trim();
  const { records } = await callControl(z, bundle, 'connect', args);
  const cfg = scrub(records[0] || {});
  return {
    id: cfg.address || cfg.fqdn || 'egress',
    ...cfg,
    secrets_stripped: true,
    note:
      'Bearer/private-key material is never returned to Zapier. Run `whisper connect` (CLI) or agentEgress() (whisper-edge SDK) on a host you control to use this egress.',
  };
};

module.exports = {
  key: 'connect_egress',
  noun: 'Egress Config',
  display: {
    label: 'Get Egress Config',
    description:
      'Provisions/reads the egress configuration bound to an agent’s /128 (SOCKS5, WireGuard, or AnyIP endpoints). Secret material is stripped — pair with the whisper CLI/SDK on your own host for live egress. Needs an API key.',
  },
  operation: {
    perform,
    inputFields: [
      {
        key: 'agent',
        label: 'Agent',
        type: 'string',
        required: false,
        helpText: 'Agent ID or /128. Leave blank to reuse your most recent agent.',
      },
      {
        key: 'tier',
        label: 'Tier',
        type: 'string',
        required: false,
        choices: ['socks5', 'wireguard', 'anyip'],
        default: 'socks5',
      },
      {
        key: 'public_key',
        label: 'WireGuard Public Key',
        type: 'string',
        required: false,
        helpText: 'For the wireguard tier: your locally-generated public key (base64).',
      },
    ],
    sample: {
      id: '2a04:2a01:0:42::1',
      tier: 'socks5',
      address: '2a04:2a01:0:42::1',
      fqdn: 'a0000000000000001.t0000000000000000000000000000000.agents.whisper.online',
      socks5_endpoint: 'connect.whisper.online:443',
      secrets_stripped: true,
      note: 'Bearer/private-key material is never returned to Zapier.',
    },
    outputFields: [
      { key: 'tier', label: 'Tier' },
      { key: 'address', label: 'IPv6 /128' },
      { key: 'fqdn', label: 'FQDN' },
      { key: 'socks5_endpoint', label: 'SOCKS5 Endpoint' },
      { key: 'secrets_stripped', label: 'Secrets Stripped', type: 'boolean' },
    ],
  },
};
