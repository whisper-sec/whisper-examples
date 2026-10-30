// SPDX-License-Identifier: MIT
// Unit tests (offline): a revoke that matches nothing surfaces as NotFoundError, for both
// the NOT_FOUND error of current control planes and the status:not_found row of older ones.
/* globals describe, it, expect */
'use strict';

const revoke = require('../creates/revoke_agent');

const MSG = "nothing was revoked: no agent of yours matches 'a1'. If you revoked it before, there is nothing left to revoke";

class ZError extends Error {
  constructor(message, code, status) {
    super(message);
    this.code = code;
    this.status = status;
  }
}
class ZThrottled extends Error {}

// A fake z whose request() answers with the given HTTP status and body, recording each call.
const fakeZ = (status, data) => {
  const calls = [];
  return {
    calls,
    errors: { Error: ZError, ThrottledError: ZThrottled },
    request: async (req) => {
      calls.push(req);
      return { status, data };
    },
  };
};
const bundle = { authData: { api_key: 'test' }, inputData: { agent: 'a1' } };
const COLS = ['op', 'ok', 'status', 'result', 'error', 'retry_after', 'elapsed_ms'];
const okRow = (rows) => ({
  columns: COLS,
  rows: [{ op: 'revoke', ok: true, status: 200, result: { columns: ['agent', 'status'], rows }, error: null }],
});

describe('revoke_agent', () => {
  it('returns the record when the agent is revoked', async () => {
    const z = fakeZ(200, okRow([['a1', 'revoked']]));
    const out = await revoke.operation.perform(z, bundle);
    expect(out).toMatchObject({ agent: 'a1', status: 'revoked' });
  });

  it('throws NotFoundError with the server message for the in-row NOT_FOUND (HTTP 200)', async () => {
    const z = fakeZ(200, {
      columns: COLS,
      rows: [{ op: 'revoke', ok: false, status: 404, result: null,
        error: { code: 'NOT_FOUND', message: MSG, retryable: false } }],
    });
    const err = await revoke.operation.perform(z, bundle).catch((e) => e);
    expect(err).toBeInstanceOf(ZError);
    expect(err).not.toBeInstanceOf(ZThrottled);
    expect(err.code).toBe('NotFoundError');
    expect(err.status).toBe(404);
    expect(err.message).toBe(MSG);
    expect(z.calls).toHaveLength(1);
  });

  it('throws NotFoundError for a positional in-row NOT_FOUND', async () => {
    const z = fakeZ(200, { columns: COLS,
      rows: [['revoke', false, 404, null, { code: 'NOT_FOUND', message: MSG, retryable: false }, null, 5]] });
    const err = await revoke.operation.perform(z, bundle).catch((e) => e);
    expect(err.code).toBe('NotFoundError');
    expect(err.message).toBe(MSG);
  });

  it('throws NotFoundError for the flat 404 NOT_FOUND envelope', async () => {
    const z = fakeZ(404, { ok: false, status: 404, error: { code: 'NOT_FOUND', message: MSG } });
    const err = await revoke.operation.perform(z, bundle).catch((e) => e);
    expect(err.code).toBe('NotFoundError');
    expect(err.message).toBe(MSG);
  });

  it('throws NotFoundError for an older plane\'s ok row with status not_found, without retrying', async () => {
    const z = fakeZ(200, okRow([['a1', 'not_found']]));
    const err = await revoke.operation.perform(z, { ...bundle, inputData: { agent: '2a04:2a01::1' } }).catch((e) => e);
    expect(err.code).toBe('NotFoundError');
    expect(err.status).toBe(404);
    expect(err.message).toMatch(/Nothing was revoked/);
    expect(z.calls).toHaveLength(1);
  });

  it('throws NotFoundError for a not_found row under item', async () => {
    const z = fakeZ(200, {
      columns: COLS,
      rows: [{ op: 'revoke', ok: true, status: 200, error: null,
        result: { columns: ['item'], rows: [[{ agent: 'a1', status: 'not_found', message: MSG }]] } }],
    });
    const err = await revoke.operation.perform(z, bundle).catch((e) => e);
    expect(err.code).toBe('NotFoundError');
    expect(err.message).toBe(MSG);
  });

  it('keys on the code, not on a bare 404', async () => {
    const z = fakeZ(200, { columns: COLS,
      rows: [{ op: 'revoke', ok: false, status: 404, result: null, error: { code: 'NO_ROUTE', message: 'gone' } }] });
    const err = await revoke.operation.perform(z, bundle).catch((e) => e);
    expect(err.code).toBe('ControlPlaneError');
    expect(err.message).toBe('gone');
  });
});
