// SPDX-License-Identifier: MIT
// KEYED search: run an arbitrary read-only Cypher query against the Whisper security graph.
// The escape hatch for any query the named recipes do not cover. `params` are bound
// server-side as $-parameters. Needs a whisper_live_ API key connection (injected by
// middleware.js on the graph host); `CALL db.schema()` describes the graph model.
'use strict';

const { runCypher } = require('../lib/graph');

const perform = async (z, bundle) => {
  if (!bundle.authData || !bundle.authData.api_key) {
    throw new z.errors.Error(
      'Raw Cypher is keyed - add your Whisper API key (whisper_live_…) to this connection. ' +
        'Keyless connections can still use "Assess Host" and "Find Look-alike Domains". ' +
        'Get a key at https://whisper.online.',
      'AuthenticationError',
      401,
    );
  }
  let params = {};
  if (bundle.inputData.params) {
    try {
      params = typeof bundle.inputData.params === 'string' ? JSON.parse(bundle.inputData.params) : bundle.inputData.params;
    } catch (e) {
      throw new z.errors.Error(`"Parameters" must be a JSON object: ${e.message}`, 'InputError', 400);
    }
  }
  const { columns, rows } = await runCypher(z, (bundle.inputData.cypher || '').trim(), params);
  // Zapier searches return an array of objects; each row is already {column: value}. Give each a
  // stable id so the Zap can reference it, and echo the column order once on the first row.
  return rows.map((row, i) => ({ id: String(i), ...row, _columns: i === 0 ? columns : undefined }));
};

module.exports = {
  key: 'graph_query',
  noun: 'Row',
  display: {
    label: 'Run Cypher Query (Security Graph)',
    description:
      'Run a read-only Cypher query against the Whisper security graph (3.6B+ nodes: HOSTNAME, IPV4/IPV6, ORGANIZATION, ASN; RESOLVES_TO, NAMESERVER_FOR, LINKS_TO). The escape hatch beyond the named recipes. Needs a Whisper API key.',
  },
  operation: {
    perform,
    inputFields: [
      {
        key: 'cypher',
        label: 'Cypher Query',
        type: 'text',
        required: true,
        helpText:
          'A read-only Cypher query, e.g. `CALL whisper.identify($v) YIELD host, canonical_name, category`. Reference values as `$name` and supply them under Parameters. Start with `CALL db.schema()`.',
      },
      {
        key: 'params',
        label: 'Parameters (JSON)',
        type: 'text',
        required: false,
        helpText: 'A JSON object of $-parameters bound server-side, e.g. `{"v":["api.openai.com"]}`. Optional.',
      },
    ],
    sample: { id: '0', host: 'api.openai.com', canonical_name: 'Cloudflare', category: 'cdn' },
    outputFields: [{ key: 'id', label: 'Row Index' }],
  },
};
