// SPDX-License-Identifier: MIT
// Offline tests: whisper_agents reports a revoke that matched nothing as a tool error
// (isError, status not_found, not retryable, the server's message) for both shapes the
// control plane has used. fetch is stubbed; no network, no key.
import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { registerWhisperTools } from "../whisper-mcp.js";

const MSG = "nothing was revoked: no agent of yours matches 'a1'. If you revoked it before, there is nothing left to revoke";
const COLS = ["op", "ok", "status", "result", "error", "retry_after", "elapsed_ms"];
const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; });

function answer(body, status = 200) {
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  };
  return calls;
}

function tools() {
  const t = {};
  registerWhisperTools({ tool: (name, _d, _s, handler) => { t[name] = handler; } }, { WHISPER_API_KEY: "test" });
  return t;
}

const parse = (res) => JSON.parse(res.content[0].text);
const okRow = (rows) => ({ columns: COLS, rows: [{ op: "revoke", ok: true, status: 200, result: { columns: ["agent", "status"], rows }, error: null }] });

test("a revoke that works returns its record", async () => {
  answer(okRow([["a1", "revoked"]]));
  const res = await tools().whisper_agents({ op: "revoke", args: { agent: "a1" } });
  assert.equal(res.isError, undefined);
  assert.deepEqual(parse(res), [{ agent: "a1", status: "revoked" }]);
});

test("the in-row NOT_FOUND (HTTP 200) is a tool error, not retryable, with the server message", async () => {
  const calls = answer({ columns: COLS, rows: [{ op: "revoke", ok: false, status: 404, result: null, error: { code: "NOT_FOUND", message: MSG, retryable: false } }] });
  const res = await tools().whisper_agents({ op: "revoke", args: { agent: "a1" } });
  assert.equal(res.isError, true);
  assert.deepEqual(parse(res), { ok: false, revoked: false, status: "not_found", code: "NOT_FOUND", retryable: false, message: MSG });
  assert.equal(calls.length, 1);
});

test("an older plane's ok row with status not_found is the same tool error", async () => {
  answer(okRow([["a1", "not_found"]]));
  const res = await tools().whisper_agents({ op: "revoke", args: { agent: "a1" } });
  assert.equal(res.isError, true);
  assert.equal(parse(res).status, "not_found");
  assert.match(parse(res).message, /nothing was revoked/);
});

test("a not_found row under item is the same tool error", async () => {
  answer({ columns: COLS, rows: [{ op: "revoke", ok: true, status: 200, error: null, result: { columns: ["item"], rows: [[{ agent: "a1", status: "not_found", message: MSG }]] } }] });
  const res = await tools().whisper_agents({ op: "revoke", args: { agent: "a1" } });
  assert.equal(res.isError, true);
  assert.equal(parse(res).message, MSG);
});

test("another in-row failure is not mistaken for not-found", async () => {
  answer({ columns: COLS, rows: [{ op: "revoke", ok: false, status: 403, result: null, error: { code: "FORBIDDEN", message: "scope admin:dns required", retryable: false } }] });
  await assert.rejects(tools().whisper_agents({ op: "revoke", args: { agent: "a1" } }), (e) => e.code !== "NOT_FOUND");
});
