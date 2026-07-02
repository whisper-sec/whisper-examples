// SPDX-License-Identifier: MIT
// Whisper control-plane client: deterministic Cypher builder + two-shape envelope decoder.
// One verb — CALL whisper.agents({op, args}) — POSTed to the control endpoint with the
// user's X-API-Key header (injected by middleware.js). Matches the reference `whisper` CLI.
'use strict';

const CONTROL_URL = 'https://graph.whisper.security/api/query';

// Conservative-emit: render a JS value as a Cypher literal. Strings are single-quoted with
// `'` and `\` doubled (can never break out); map keys are sorted so output is byte-stable.
const cypherValue = (v) => {
  if (v === null || v === undefined) return 'null';
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (Array.isArray(v)) return `[${v.map(cypherValue).join(',')}]`;
  if (typeof v === 'object') {
    return `{${Object.keys(v)
      .sort()
      .map((k) => `${k}:${cypherValue(v[k])}`)
      .join(',')}}`;
  }
  return `'${String(v).replace(/\\/g, '\\\\').replace(/'/g, "''")}'`;
};

const buildQuery = (op, args) =>
  `CALL whisper.agents({op:${cypherValue(op)}, args:${cypherValue(args || {})}})`;

// Liberal-accept: unwrap either envelope shape —
//   A. procedure-row table {columns:[op,ok,status,result,error,retry_after], rows:[{…}|[…]]}
//   B. flat {ok, status, result, error}
const unwrapEnvelope = (data) => {
  let env = data || {};
  if (env.ok === undefined && Array.isArray(env.rows) && Array.isArray(env.columns)) {
    const row = env.rows[0];
    env = Array.isArray(row)
      ? Object.fromEntries(env.columns.map((c, i) => [c, row[i]]))
      : row || {};
  }
  return env;
};

// result.rows are positional arrays aligned to result.columns → [{column: value}, …].
const toRecords = (result) => {
  if (!result || !Array.isArray(result.rows)) return [];
  const cols = result.columns || [];
  return result.rows.map((r) =>
    Array.isArray(r) ? Object.fromEntries(cols.map((c, i) => [c, r[i]])) : r,
  );
};

// Surface a problem+json error helpfully: detail > title > type, plus suggestions.
const problemMessage = (err, status) => {
  if (!err || typeof err !== 'object') {
    return `Whisper control plane returned status ${status}`;
  }
  let msg = err.detail || err.title || err.type || `status ${status}`;
  if (Array.isArray(err.suggestions) && err.suggestions.length) {
    msg += ` — ${err.suggestions.join('; ')}`;
  }
  return msg;
};

// Call one control op. Requires a key: keyless connections get a clear, actionable error.
const callControl = async (z, bundle, op, args) => {
  if (!bundle.authData || !bundle.authData.api_key) {
    throw new z.errors.Error(
      `The "${op}" action needs a Whisper API key (whisper_live_…). ` +
        'Edit your Whisper connection and add one — keyless connections can only ' +
        'verify identities and look up RDAP records. Get a key at https://whisper.online.',
      'AuthenticationError',
      401,
    );
  }
  const response = await z.request({
    url: CONTROL_URL,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: { query: buildQuery(op, args) },
    skipThrowForStatus: true,
  });
  const env = unwrapEnvelope(response.data);
  const ok = env.ok === true && response.status < 400;
  if (!ok) {
    const status = env.status || response.status;
    const err = env.error || (response.status >= 400 ? response.data : null);
    const retryAfter = env.retry_after || (err && err.retry_after);
    if ((status === 429 || status === 503) && retryAfter) {
      throw new z.errors.ThrottledError(problemMessage(err, status), Number(retryAfter));
    }
    if (status === 401 || status === 403) {
      throw new z.errors.Error(problemMessage(err, status), 'AuthenticationError', status);
    }
    throw new z.errors.Error(problemMessage(err, status), 'ControlPlaneError', status);
  }
  return { result: env.result, records: toRecords(env.result) };
};

module.exports = { CONTROL_URL, cypherValue, buildQuery, unwrapEnvelope, toRecords, callControl };
