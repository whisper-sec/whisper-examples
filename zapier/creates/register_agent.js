// SPDX-License-Identifier: MIT
// KEYED create: mint a new agent with its own routable IPv6 /128 identity + its own API
// key — whisper.agents({op:'register'}). The new agent's api_key is returned ONCE.
'use strict';

const { callControl } = require('../lib/control');

const perform = async (z, bundle) => {
  const args = { label: (bundle.inputData.label || '').trim() };
  if (bundle.inputData.contact_email) args.contact_email = bundle.inputData.contact_email.trim();
  const { records } = await callControl(z, bundle, 'register', args);
  const agent = records[0] || {};
  return { id: agent.agent || agent.address, ...agent };
};

module.exports = {
  key: 'register_agent',
  noun: 'Agent',
  display: {
    label: 'Register Agent',
    description:
      'Mints a new Whisper agent: a real, routable IPv6 /128 identity with reverse DNS, RDAP, and its own API key (returned once — store it safely). Needs an API key with admin:dns.',
  },
  operation: {
    perform,
    inputFields: [
      {
        key: 'label',
        label: 'Label',
        type: 'string',
        required: true,
        helpText: 'A human name for the agent, e.g. `billing-crawler`.',
      },
      {
        key: 'contact_email',
        label: 'Contact Email',
        type: 'string',
        required: false,
        helpText: 'Published in the agent’s RDAP record. Optional.',
      },
    ],
    sample: {
      id: 'agt_0000000000000001',
      agent: 'agt_0000000000000001',
      address: '2a04:2a01:0:42::1',
      fqdn: 'a0000000000000001.t0000000000000000000000000000000.agents.whisper.online',
      ptr: 'a0000000000000001.t0000000000000000000000000000000.agents.whisper.online',
      state: 'active',
      api_key: 'whisper_live_EXAMPLE_RETURNED_ONCE',
    },
    outputFields: [
      { key: 'agent', label: 'Agent ID' },
      { key: 'address', label: 'IPv6 /128' },
      { key: 'fqdn', label: 'FQDN' },
      { key: 'ptr', label: 'Reverse DNS (PTR)' },
      { key: 'state', label: 'State' },
      { key: 'api_key', label: 'Agent API Key (shown once)' },
    ],
  },
};
