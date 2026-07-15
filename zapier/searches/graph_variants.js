// SPDX-License-Identifier: MIT
// KEYLESS search: the Whisper catalog recipe "Typosquat Variant Generator" (whisper.variants) -
// generate look-alike domain variants of a brand and see which are actually registered.
// No API key needed; a key lifts the rate limit. Catalog: github.com/whisper-sec/whisper-catalog
'use strict';

const { runCypher } = require('../lib/graph');

const perform = async (z, bundle) => {
  const domain = (bundle.inputData.domain || '').trim();
  const registeredOnly = bundle.inputData.registered_only !== false;
  const { rows } = await runCypher(
    z,
    'CALL whisper.variants($v) YIELD variant, method, exists, confidence RETURN variant, method, exists, confidence ORDER BY confidence DESC',
    { v: domain },
  );
  return rows
    .filter((r) => (registeredOnly ? r.exists : true))
    .map((r) => ({ id: r.variant, ...r }));
};

module.exports = {
  key: 'graph_variants',
  noun: 'Variant',
  display: {
    label: 'Find Look-alike Domains (Typosquat Recipe)',
    description:
      'Run the Whisper "Typosquat Variant Generator" recipe: generate look-alike variants of a brand domain (bit-squats, homoglyphs, omissions) and see which are registered. Keyless - no API key needed.',
  },
  operation: {
    perform,
    inputFields: [
      {
        key: 'domain',
        label: 'Brand Domain',
        type: 'string',
        required: true,
        helpText: 'The domain to generate look-alikes of, e.g. `paypal.com`.',
      },
      {
        key: 'registered_only',
        label: 'Registered only',
        type: 'boolean',
        required: false,
        default: 'yes',
        helpText: 'Return only variants that are actually registered (the dangerous ones). Default yes.',
      },
    ],
    sample: {
      id: 'paypa1.com',
      variant: 'paypa1.com',
      method: 'HOMOGLYPH',
      exists: true,
      confidence: 0.9,
    },
    outputFields: [
      { key: 'variant', label: 'Variant Domain' },
      { key: 'method', label: 'Method' },
      { key: 'exists', label: 'Registered', type: 'boolean' },
      { key: 'confidence', label: 'Confidence', type: 'number' },
    ],
  },
};
