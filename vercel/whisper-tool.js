// SPDX-License-Identifier: MIT
// Vercel AI SDK tools: let an LLM verify a Whisper agent identity (keyless), query the
// Whisper security graph (keyless assess + identify; keyed raw Cypher), and, with a key,
// egress a real HTTP request through the agent's routable /128. Pairs with `ai`'s `tool()`.
//   import { tool } from "ai"; import { z } from "zod";
//   import { whisperVerifyTool, whisperAssessTool, whisperGraphQueryTool, whisperEgressTool } from "./whisper-tool.js";
import { verify, verifyDetails, agentEgress, graph } from "whisper-edge";

const GRAPH_URL = "https://graph.whisper.security/api/query";

// One parameterised Cypher read via plain fetch. Keyless works (rate-limited); a key lifts it.
async function graphRead(query, parameters, apiKey) {
  const res = await fetch(GRAPH_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "user-agent": "whisper-examples/1.0 (+https://whisper.online)",
      ...(apiKey ? { "x-api-key": apiKey } : {}),
    },
    body: JSON.stringify({ query, parameters }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.detail || body.title || `graph returned ${res.status}`);
  return body; // { columns, rows, statistics }
}

export const whisperVerifyTool = {
  description: "Verify that an IPv6 address (or FQDN) is a real Whisper agent identity (DANE+DNSSEC+reverse-DNS+JWS). Keyless.",
  // parameters: use your schema lib, e.g. z.object({ address: z.string() })
  parameters: { type: "object", properties: { address: { type: "string" } }, required: ["address"] },
  execute: async ({ address }) => {
    const details = await verifyDetails(address);
    return { is_whisper_agent: await verify(address), details };
  },
};

export const whisperAssessTool = {
  description:
    "Assess hosts/IPs against the Whisper security graph (3.6B+ nodes of DNS/BGP/threat intelligence): " +
    "whisper.assess (malicious/benign label + severity band + evidence) and whisper.identify (operator/vendor). Keyless.",
  parameters: {
    type: "object",
    properties: { hosts: { type: "array", items: { type: "string" } } },
    required: ["hosts"],
  },
  execute: async ({ hosts }) => {
    const apiKey = process.env.WHISPER_API_KEY; // optional: lifts the keyless rate limit
    // Sequential, not parallel: the keyless tier allows only ONE concurrent query, so two
    // in-flight reads would trip "max concurrent queries". A key lifts that limit.
    const threat = await graphRead("CALL whisper.assess($v) YIELD host, label, band, coverage, evidence", { v: hosts }, apiKey);
    const vendor = await graphRead("CALL whisper.identify($v) YIELD host, canonical_name, category, roles, band", { v: hosts }, apiKey);
    return { threat: threat.rows, vendor: vendor.rows };
  },
};

export const whisperGraphQueryTool = {
  description:
    "Run a raw read-only Cypher query against the Whisper security graph. Values go in `params` and are bound " +
    "server-side as $-parameters. `CALL db.schema()` describes the graph. Needs the WHISPER_API_KEY env var.",
  parameters: {
    type: "object",
    properties: { cypher: { type: "string" }, params: { type: "object" } },
    required: ["cypher"],
  },
  execute: async ({ cypher, params }) => {
    const apiKey = process.env.WHISPER_API_KEY;
    if (!apiKey) return { error: "WHISPER_API_KEY is not set - raw Cypher is keyed (whisperAssessTool stays keyless)" };
    const res = await graph(apiKey).query(cypher, params ?? {});
    return { columns: res.columns, rows: res.rows };
  },
};

export const whisperEgressTool = {
  description:
    "Fetch a URL so the request leaves from the caller's Whisper agent /128 instead of Vercel's IP. " +
    "Needs the WHISPER_API_KEY environment variable - the LLM never sees the key.",
  parameters: { type: "object", properties: { url: { type: "string" } }, required: ["url"] },
  execute: async ({ url }) => {
    const apiKey = process.env.WHISPER_API_KEY;
    if (!apiKey) return { error: "WHISPER_API_KEY is not set - tier 2 egress is unavailable" };
    const egress = await agentEgress(apiKey);
    try {
      const res = await egress.fetch(url);
      return { status: res.status, egress_address: egress.transport.address, body: await res.text() };
    } finally {
      egress.close();
    }
  },
};
