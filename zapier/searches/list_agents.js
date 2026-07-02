// SPDX-License-Identifier: MIT
// KEYED search: list the tenant's fleet — whisper.agents({op:'list'}).
'use strict';

const { callControl } = require('../lib/control');

const perform = async (z, bundle) => {
  const kind = bundle.inputData.kind || 'agents';
  const { records } = await callControl(z, bundle, 'list', { kind });
  return records.map((r, i) => {
    const item = r.item && typeof r.item === 'object' ? r.item : r;
    return { id: item.agent || item.address || item.fqdn || String(i), kind: r.kind || kind, ...item };
  });
};

module.exports = {
  key: 'list_agents',
  noun: 'Agent',
  display: {
    label: 'Find Agents',
    description: 'Lists your agent fleet (agents, identities, or DNS records). Needs an API key.',
  },
  operation: {
    perform,
    inputFields: [
      {
        key: 'kind',
        label: 'Kind',
        type: 'string',
        required: false,
        choices: ['agents', 'identities', 'records'],
        default: 'agents',
        helpText: 'What to list — defaults to `agents`.',
      },
    ],
    sample: {
      id: 'agt_0000000000000001',
      kind: 'agents',
      agent: 'agt_0000000000000001',
      label: 'my-agent',
      address: '2a04:2a01:0:42::1',
      fqdn: 'a0000000000000001.t0000000000000000000000000000000.agents.whisper.online',
      created: '2026-07-01T12:00:00Z',
      state: 'active',
    },
    outputFields: [
      { key: 'agent', label: 'Agent ID' },
      { key: 'label', label: 'Label' },
      { key: 'address', label: 'IPv6 /128' },
      { key: 'fqdn', label: 'FQDN' },
      { key: 'state', label: 'State' },
      { key: 'created', label: 'Created' },
    ],
  },
};
