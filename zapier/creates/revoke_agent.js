// SPDX-License-Identifier: MIT
// KEYED create: fully revoke an agent (irreversible - identity, DNS, RDAP, key all torn
// down) - whisper.agents({op:'revoke'}). The control plane matches every spelling of an
// agent itself: its id (with or without the agent- prefix), its /128 or its label.
//
// A revoke that matches nothing means nothing was revoked: the agent was revoked already,
// or it is not in your account. Current planes answer that with error.code NOT_FOUND
// (callControl throws NotFoundError for it); older planes answered an ok row with status
// not_found. Both halt the step with the same NotFoundError and the server's message, and
// neither is worth a retry.
'use strict';

const { callControl } = require('../lib/control');

const rowNotFound = (rec) => {
  const row = rec && typeof rec.item === 'object' && rec.item ? rec.item : rec || {};
  return (row.status || row.state) === 'not_found' ? row : null;
};

const perform = async (z, bundle) => {
  const ref = (bundle.inputData.agent || '').trim();
  const { records } = await callControl(z, bundle, 'revoke', { agent: ref });
  const r = records[0] || {};
  const missing = rowNotFound(r);
  if (missing) {
    throw new z.errors.Error(
      missing.message ||
        missing.detail ||
        `Nothing was revoked: no agent of yours matches "${ref}". If you revoked it before, ` +
          'there is nothing left to revoke.',
      'NotFoundError',
      404,
    );
  }
  return { id: ref, ...r, agent: r.agent || ref, status: r.status || r.state || 'revoked' };
};

module.exports = {
  key: 'revoke_agent',
  noun: 'Agent',
  display: {
    label: 'Revoke Agent',
    description:
      'Fully revokes an agent - its /128 identity, reverse DNS, RDAP record, and key are torn down. Irreversible. Needs an API key with admin:dns.',
  },
  operation: {
    perform,
    inputFields: [
      {
        key: 'agent',
        label: 'Agent',
        type: 'string',
        required: true,
        helpText:
          'The agent ID (`agent-a…` or `a…`), its IPv6 /128 address, or its label. Revoking an agent that is already revoked, or not yours, stops the step with "Nothing was revoked".',
      },
    ],
    sample: { id: 'agt_0000000000000001', agent: 'agt_0000000000000001', status: 'revoked' },
    outputFields: [
      { key: 'agent', label: 'Agent' },
      { key: 'status', label: 'Status' },
    ],
  },
};
