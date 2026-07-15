// SPDX-License-Identifier: MIT
// The Whisper security graph - 3.6B+ nodes of DNS/BGP/threat intelligence, queryable over
// one POST to https://graph.whisper.security/api/query. Two tiers, per Postel's Law:
//   keyless - the direct read verbs (whisper.assess / identify / variants / walk / ...) answer
//             with NO key: rate-limited (~100/window), real production-shaped answers.
//   keyed   - raw Cypher and the multi-step flows need the X-API-Key (injected by middleware).
// A key on ANY call lifts the keyless rate limit. Rows come back as objects keyed by column.
'use strict';

const GRAPH_URL = 'https://graph.whisper.security/api/query';

// Surface a problem+json error helpfully: detail > title > type.
const problemMessage = (data, status) => {
  if (data && typeof data === 'object') {
    return data.detail || data.title || data.type || `graph returned status ${status}`;
  }
  return `graph returned status ${status}`;
};

// Run one Cypher read. `params` are bound server-side as $-parameters (never spliced into the
// query), so a value can never break out of the Cypher, however hostile. The key, when the
// connection carries one, is attached by middleware.js only on this graph host.
const runCypher = async (z, query, params) => {
  const response = await z.request({
    url: GRAPH_URL,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      // A descriptive User-Agent: the edge blocks anonymous/scripting UAs, so name every request.
      'User-Agent': 'whisper-examples-zapier/1.0 (+https://whisper.online)',
    },
    body: { query, parameters: params || {} },
    skipThrowForStatus: true,
  });
  if (response.status >= 400) {
    throw new z.errors.Error(problemMessage(response.data, response.status), 'GraphError', response.status);
  }
  const data = response.data || {};
  return { columns: data.columns || [], rows: Array.isArray(data.rows) ? data.rows : [] };
};

module.exports = { GRAPH_URL, runCypher };
