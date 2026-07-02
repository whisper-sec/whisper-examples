// SPDX-License-Identifier: MIT
// KEYED create: fully revoke an agent (irreversible — identity, DNS, RDAP, key all torn
// down) — whisper.agents({op:'revoke'}). Liberal-accept: takes an agent ID or a /128;
// if the control plane can't match the /128 directly, it is resolved to its agent ID
// via op:agent and the revoke is retried — the user never has to care which form they had.
'use strict';

const { callControl } = require('../lib/control');

const revokeOnce = async (z, bundle, agent) => {
  const { records } = await callControl(z, bundle, 'revoke', { agent });
  return records[0] || {};
};

const perform = async (z, bundle) => {
  const ref = (bundle.inputData.agent || '').trim();
  let r = await revokeOnce(z, bundle, ref);
  let status = r.status || r.state;
  if (status === 'not_found' && ref.includes(':')) {
    // A /128 the revoke op didn't match — resolve it to the agent ID and retry.
    const { records } = await callControl(z, bundle, 'agent', { address: ref });
    const detail = records[0] || {};
    if (detail.agent) {
      r = await revokeOnce(z, bundle, detail.agent);
      status = r.status || r.state;
    }
  }
  if (status === 'not_found') {
    throw new z.errors.Error(
      `No agent matches "${ref}" in your tenant — check the agent ID (agent-…) or its IPv6 /128.`,
      'NotFoundError',
      404,
    );
  }
  return { id: ref, ...r, agent: r.agent || ref, status: status || 'revoked' };
};

module.exports = {
  key: 'revoke_agent',
  noun: 'Agent',
  display: {
    label: 'Revoke Agent',
    description:
      'Fully revokes an agent — its /128 identity, reverse DNS, RDAP record, and key are torn down. Irreversible. Needs an API key with admin:dns.',
  },
  operation: {
    perform,
    inputFields: [
      {
        key: 'agent',
        label: 'Agent',
        type: 'string',
        required: true,
        helpText: 'The agent ID (`agt_…`) or its IPv6 /128 address.',
      },
    ],
    sample: { id: 'agt_0000000000000001', agent: 'agt_0000000000000001', status: 'revoked' },
    outputFields: [
      { key: 'agent', label: 'Agent' },
      { key: 'status', label: 'Status' },
    ],
  },
};
