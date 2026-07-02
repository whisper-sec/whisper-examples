// SPDX-License-Identifier: MIT
// Secret hygiene: strip/redact bearer- and private-key-carrying material before anything
// is returned to Zapier (Zap task data is persisted). Belt and braces: known secret
// fields are dropped entirely, and any remaining string is pattern-redacted.
'use strict';

// Fields whose values embed a bearer or private key — never persisted to Zap data.
const SECRET_FIELDS = [
  'http_proxy',
  'connection_string',
  'client_private_key',
  'wireguard_config',
  'bearer',
  'token',
  'api_key',
];
const SECRET_PATTERN = /et_[A-Za-z0-9]+|PrivateKey\s*=\s*\S+/g;

// keep: field names exempt from the drop-list (e.g. register's one-time api_key).
const scrub = (record, keep = []) => {
  const out = {};
  for (const [k, v] of Object.entries(record || {})) {
    if (SECRET_FIELDS.includes(k) && !keep.includes(k)) continue;
    out[k] = typeof v === 'string' && !keep.includes(k) ? v.replace(SECRET_PATTERN, '<redacted>') : v;
  }
  return out;
};

module.exports = { scrub, SECRET_FIELDS, SECRET_PATTERN };
