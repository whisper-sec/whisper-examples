// SPDX-License-Identifier: MIT
// KEYED polling trigger: fires when a new agent appears in your fleet -
// whisper.agents({op:'list'}), deduplicated on the agent ID.
'use strict';

const { callControl } = require('../lib/control');

const perform = async (z, bundle) => {
  const { records } = await callControl(z, bundle, 'list', { kind: 'agents' });
  return records
    .map((r) => (r.item && typeof r.item === 'object' ? r.item : r))
    .filter((item) => item.agent || item.address)
    .map((item) => ({ id: item.agent || item.address, ...item }));
};

module.exports = {
  key: 'new_agent',
  noun: 'Agent',
  display: {
    label: 'New Agent',
    description:
      'Triggers when a new agent is registered in your Whisper fleet. Needs an API key.',
  },
  operation: {
    type: 'polling',
    perform,
    sample: {
      id: 'agt_0000000000000001',
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
    ],
  },
};
