// SPDX-License-Identifier: MIT
// Offline check of the Revoke module's response handling (app/modules/revokeAgent/api.json):
// a revoke that matches nothing must fail the module with the server's message, in both
// shapes the control plane has used (the in-row NOT_FOUND at HTTP 200, and an older plane's
// ok row with status not_found), while a real revoke still passes.
//
// Make evaluates these IML expressions itself; this file evaluates the same strings with a
// small stand-in for the three IML functions the module uses (get with 1-based indexes,
// ifempty, if), so the logic is pinned against real wire bodies.
// Run: node --test make/test/*.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const api = JSON.parse(readFileSync(new URL("../app/modules/revokeAgent/api.json", import.meta.url)));

const get = (o, k) => (o == null ? undefined : Array.isArray(o) && typeof k === "number" ? o[k - 1] : o[k]);
const ifempty = (a, b) => (a === undefined || a === null || a === "" ? b : a);
const iif = (c, a, b) => (c ? a : b);

function iml(template, ctx) {
  const parts = template.split(/\{\{([\s\S]*?)\}\}/);
  const out = parts.map((p, i) => {
    if (i % 2 === 0) return p;
    const js = p.replace(/\bif\(/g, "iif(");
    return new Function("body", "statusCode", "parameters", "get", "ifempty", "iif", `return (${js});`)(
      ctx.body, ctx.statusCode, ctx.parameters, get, ifempty, iif);
  });
  return parts.length === 3 && parts[0] === "" && parts[2] === "" ? out[1] : out.join("");
}

const run = (statusCode, body) => {
  const ctx = { statusCode, body, parameters: { agent: "2a04:2a01::1" } };
  const r = api.response;
  return { valid: r.valid === undefined ? true : iml(r.valid, ctx), message: iml(r.error.message, ctx) };
};

const MSG = "nothing was revoked: no agent of yours matches '2a04:2a01::1'. If you revoked it before, there is nothing left to revoke";
const COLS = ["op", "ok", "status", "result", "error", "retry_after", "elapsed_ms"];
const okRow = (rows) => ({ columns: COLS, rows: [{ op: "revoke", ok: true, status: 200, result: { columns: ["agent", "status"], rows }, error: null, retry_after: null, elapsed_ms: 511 }] });

test("a real revoke is valid", () => {
  assert.equal(run(200, okRow([["a0000000000000001", "revoked"]])).valid, true);
});

test("the in-row NOT_FOUND at HTTP 200 fails the module with the server message and code", () => {
  const r = run(200, { columns: COLS, rows: [{ op: "revoke", ok: false, status: 404, result: null, error: { code: "NOT_FOUND", message: MSG, retryable: false }, retry_after: null, elapsed_ms: 64 }] });
  assert.equal(r.valid, false);
  assert.equal(r.message, `[NOT_FOUND] Whisper revoke: ${MSG}`);
});

test("an older plane's ok row with status not_found fails the module as NOT_FOUND", () => {
  const r = run(200, okRow([["a0000000000000001", "not_found"]]));
  assert.equal(r.valid, false);
  assert.match(r.message, /^\[NOT_FOUND\] Whisper revoke: nothing was revoked: no agent of yours matches 2a04:2a01::1\./);
});

test("a flat 404 NOT_FOUND envelope fails with its message", () => {
  const r = run(404, { ok: false, status: 404, error: { code: "NOT_FOUND", message: MSG } });
  assert.equal(r.valid, false);
  assert.equal(r.message, `[NOT_FOUND] Whisper revoke: ${MSG}`);
});

test("another in-row failure keeps its own code and message", () => {
  const r = run(200, { columns: COLS, rows: [{ op: "revoke", ok: false, status: 403, result: null, error: { code: "FORBIDDEN", message: "scope admin:dns required", retryable: false } }] });
  assert.equal(r.valid, false);
  assert.equal(r.message, "[FORBIDDEN] Whisper revoke: scope admin:dns required");
});
