// SPDX-License-Identifier: MIT
// KEYLESS search: threat posture + vendor identity for a host/IP from the Whisper security
// graph - whisper.assess (malicious/benign label, severity band, evidence) and
// whisper.identify (operator/vendor). No API key needed; a key lifts the rate limit.
'use strict';

const { runCypher } = require('../lib/graph');

const perform = async (z, bundle) => {
  const host = (bundle.inputData.host || '').trim();
  // Sequential, not parallel: the keyless tier allows only ONE concurrent query, so two
  // in-flight reads would trip "max concurrent queries". A key lifts that limit.
  const threat = await runCypher(z, 'CALL whisper.assess($v) YIELD host, label, band, coverage, evidence', { v: [host] });
  const vendor = await runCypher(z, 'CALL whisper.identify($v) YIELD host, canonical_name, category, roles, band', { v: [host] });
  const t = threat.rows[0] || {};
  const d = vendor.rows[0] || {};
  // Always return one verdict object so a Zap can branch on it instead of dying on "no results".
  return [
    {
      id: host,
      host,
      label: t.label ?? 'unknown',
      band: t.band ?? 'UNKNOWN',
      coverage: t.coverage ?? null,
      evidence: t.evidence ?? [],
      vendor: d.canonical_name ?? null,
      category: d.category ?? null,
      roles: d.roles ?? [],
    },
  ];
};

module.exports = {
  key: 'graph_assess',
  noun: 'Assessment',
  display: {
    label: 'Assess Host (Security Graph)',
    description:
      'Look up a hostname or IP in the Whisper security graph (3.6B+ nodes of DNS/BGP/threat intelligence): its threat label, severity band, evidence, and the vendor/operator behind it. Keyless - no API key needed.',
  },
  operation: {
    perform,
    inputFields: [
      {
        key: 'host',
        label: 'Host or IP',
        type: 'string',
        required: true,
        helpText: 'The hostname or IP to assess, e.g. `theblackservicenetwork.com`, `api.openai.com`, or `8.8.8.8`.',
      },
    ],
    sample: {
      id: 'theblackservicenetwork.com',
      host: 'theblackservicenetwork.com',
      label: 'malicious',
      band: 'CRITICAL',
      coverage: 'malicious-evidenced',
      evidence: ['coverage:malicious-evidenced', 'band:CRITICAL', 'feed-source-count:4'],
      vendor: null,
      category: null,
      roles: [],
    },
    outputFields: [
      { key: 'host', label: 'Host' },
      { key: 'label', label: 'Threat Label' },
      { key: 'band', label: 'Severity Band' },
      { key: 'coverage', label: 'Coverage' },
      { key: 'vendor', label: 'Vendor / Operator' },
      { key: 'category', label: 'Category' },
    ],
  },
};
