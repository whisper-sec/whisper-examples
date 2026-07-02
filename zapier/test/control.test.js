// SPDX-License-Identifier: MIT
// Unit tests: deterministic Cypher builder + two-shape envelope decoder (offline).
/* globals describe, it, expect */
'use strict';

const { cypherValue, buildQuery, unwrapEnvelope, toRecords } = require('../lib/control');

describe('cypherValue (conservative-emit)', () => {
  it('doubles single quotes so a value can never break out', () => {
    expect(cypherValue("Tim O'Reilly")).toBe("'Tim O''Reilly'");
  });

  it('doubles backslashes', () => {
    expect(cypherValue('a\\b')).toBe("'a\\\\b'");
  });

  it('survives a hostile injection attempt', () => {
    expect(cypherValue("'}) CALL evil({")).toBe("'''}) CALL evil({'");
  });

  it('emits map keys in sorted order (byte-stable)', () => {
    expect(cypherValue({ b: 1, a: 'x' })).toBe("{a:'x',b:1}");
  });

  it('handles numbers, booleans, null, arrays, nesting', () => {
    expect(cypherValue({ n: 2, t: true, z: null, l: ['a', 'b'] })).toBe(
      "{l:['a','b'],n:2,t:true,z:null}",
    );
  });

  it('builds the documented policy example byte-for-byte', () => {
    expect(
      buildQuery('policy', { default: 'deny', block: ['x.com', 'y.com'], allow: ['z.com'] }),
    ).toBe(
      "CALL whisper.agents({op:'policy', args:{allow:['z.com'],block:['x.com','y.com'],default:'deny'}})",
    );
  });
});

describe('unwrapEnvelope (liberal-accept, both shapes)', () => {
  const inner = { columns: ['kind', 'item'], rows: [['agents', { agent: 'a1' }]] };

  it('unwraps the live procedure-row table (object row)', () => {
    const env = unwrapEnvelope({
      columns: ['op', 'ok', 'status', 'result', 'error', 'retry_after'],
      rows: [{ op: 'list', ok: true, status: 200, result: inner, error: null }],
    });
    expect(env.ok).toBe(true);
    expect(env.result).toEqual(inner);
  });

  it('unwraps the live procedure-row table (positional-array row)', () => {
    const env = unwrapEnvelope({
      columns: ['op', 'ok', 'status', 'result', 'error', 'retry_after'],
      rows: [['list', true, 200, inner, null, null]],
    });
    expect(env.ok).toBe(true);
    expect(env.result).toEqual(inner);
  });

  it('accepts the flat dev-guide shape as-is', () => {
    const env = unwrapEnvelope({ ok: false, status: 403, error: { detail: 'nope' } });
    expect(env.ok).toBe(false);
    expect(env.error.detail).toBe('nope');
  });

  it('tolerates an empty body', () => {
    expect(unwrapEnvelope(null)).toEqual({});
  });
});

describe('toRecords', () => {
  it('aligns positional rows to columns', () => {
    expect(
      toRecords({ columns: ['a', 'b'], rows: [[1, 2], [3, 4]] }),
    ).toEqual([{ a: 1, b: 2 }, { a: 3, b: 4 }]);
  });

  it('passes through object rows and empty results', () => {
    expect(toRecords({ columns: ['a'], rows: [{ a: 9 }] })).toEqual([{ a: 9 }]);
    expect(toRecords(null)).toEqual([]);
    expect(toRecords({ columns: [], rows: [] })).toEqual([]);
  });
});
