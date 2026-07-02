// SPDX-License-Identifier: MIT
// KEYED create: set (or read back) the per-tenant DNS resolver policy —
// whisper.agents({op:'policy'}). Liberal-accept: leave every field blank to read the
// current policy instead of writing one.
'use strict';

const { callControl } = require('../lib/control');

const splitList = (v) => {
  if (!v) return [];
  if (Array.isArray(v)) return v.map((s) => String(s).trim()).filter(Boolean);
  return String(v)
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
};

const perform = async (z, bundle) => {
  const args = {};
  if (bundle.inputData.default) args.default = bundle.inputData.default;
  const block = splitList(bundle.inputData.block);
  const allow = splitList(bundle.inputData.allow);
  if (block.length) args.block = block;
  if (allow.length) args.allow = allow;
  const { records } = await callControl(z, bundle, 'policy', args);
  // key/value rows → one flat policy object.
  const policy = {};
  for (const r of records) {
    if (r.key !== undefined) policy[r.key] = r.value;
  }
  return { id: 'policy', mode: Object.keys(args).length ? 'set' : 'read', ...policy };
};

module.exports = {
  key: 'set_policy',
  noun: 'DNS Policy',
  display: {
    label: 'Set DNS Policy',
    description:
      'Sets your tenant’s DNS resolver policy (default allow/deny plus block/allow lists) — or reads it back if you leave every field blank. Needs an API key with admin:dns.',
  },
  operation: {
    perform,
    inputFields: [
      {
        key: 'default',
        label: 'Default',
        type: 'string',
        required: false,
        choices: ['allow', 'deny'],
        helpText: 'Default decision for names not on either list.',
      },
      {
        key: 'block',
        label: 'Block List',
        type: 'string',
        list: true,
        required: false,
        helpText: 'Names to block (max 1000 combined with the allow list).',
      },
      {
        key: 'allow',
        label: 'Allow List',
        type: 'string',
        list: true,
        required: false,
        helpText: 'Names to allow.',
      },
    ],
    sample: { id: 'policy', mode: 'set', default: 'allow', block: ['evil.example'], allow: [] },
    outputFields: [
      { key: 'mode', label: 'Mode (set/read)' },
      { key: 'default', label: 'Default Decision' },
    ],
  },
};
