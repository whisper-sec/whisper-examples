// SPDX-License-Identifier: MIT
// KEYED search: recent agent activity (DNS / connections / allocations) from warm storage -
// whisper.agents({op:'logs'}).
'use strict';

const { callControl } = require('../lib/control');

const perform = async (z, bundle) => {
  const args = {};
  const { agent, kind, from, to, limit } = bundle.inputData;
  if (agent) args.agent = agent.trim();
  if (kind) args.kind = kind;
  if (from) args.from = from;
  if (to) args.to = to;
  if (limit) args.limit = Number(limit);
  const { records } = await callControl(z, bundle, 'logs', args);
  return records.map((r, i) => ({ id: `${r.ts || 'log'}-${i}`, ...r }));
};

module.exports = {
  key: 'get_logs',
  noun: 'Log Event',
  display: {
    label: 'Get Agent Logs',
    description:
      'Fetches recent activity for your agents - DNS queries, connections, allocations. Needs an API key.',
  },
  operation: {
    perform,
    inputFields: [
      {
        key: 'agent',
        label: 'Agent',
        type: 'string',
        required: false,
        helpText: 'Agent ID or IPv6 /128. Leave blank for the whole tenant.',
      },
      {
        key: 'kind',
        label: 'Kind',
        type: 'string',
        required: false,
        choices: ['dns', 'conn', 'alloc'],
        helpText: 'Filter by event kind. Leave blank for all.',
      },
      {
        key: 'from',
        label: 'From',
        type: 'string',
        required: false,
        helpText: 'Window start - RFC-3339, epoch-ms, or relative like `-1h`.',
      },
      { key: 'to', label: 'To', type: 'string', required: false },
      {
        key: 'limit',
        label: 'Limit',
        type: 'integer',
        required: false,
        helpText: 'Max events (default 1000, cap 10000).',
      },
    ],
    sample: {
      id: '2026-07-01T12:00:00Z-0',
      ts: '2026-07-01T12:00:00Z',
      kind: 'dns',
      qname: 'api.example.com.',
      qtype: 'AAAA',
      rcode: 'NOERROR',
      decision: 'allow',
      agent: 'agt_0000000000000001',
      latency_ms: 3,
    },
    outputFields: [
      { key: 'ts', label: 'Timestamp' },
      { key: 'kind', label: 'Kind' },
      { key: 'qname', label: 'Query Name' },
      { key: 'decision', label: 'Decision' },
      { key: 'agent', label: 'Agent ID' },
    ],
  },
};
