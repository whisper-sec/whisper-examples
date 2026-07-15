// SPDX-License-Identifier: MIT
// Whisper MCP tools for the Cloudflare Agents SDK (or any @modelcontextprotocol/sdk McpServer).
//
// Two tiers, per Postel's Law:
//   keyless - whisper_verify / whisper_rdap / whisper_assess work with NO key: anyone can
//             check an agent identity or ask the security graph's direct read verbs.
//   keyed   - whisper_agents / whisper_egress_fetch / whisper_graph_query /
//             whisper_graph_recipe unlock the control plane, real /128 egress, raw Cypher,
//             and the catalog flows when the WHISPER_API_KEY secret is set.
//             The LLM never sees the key.
import { z } from "zod";
import { verify, verifyDetails, rdap, control, agentEgress, graph } from "whisper-edge";

const GRAPH_URL = "https://graph.whisper.security/api/query";

const text = (obj) => ({ content: [{ type: "text", text: JSON.stringify(obj, null, 2) }] });
const NO_KEY = text({
  error: "WHISPER_API_KEY is not set - this tool needs a key. Keyless tools (whisper_verify, whisper_rdap, whisper_assess) still work.",
});

/** One parameterised Cypher read against the graph. Keyless works (rate-limited taste);
 *  the key, when present, rides as X-API-Key and lifts the limit. */
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

/**
 * Register the Whisper tools on an MCP server.
 * @param {import("@modelcontextprotocol/sdk/server/mcp.js").McpServer} server
 * @param {{ WHISPER_API_KEY?: string, WHISPER_AGENT?: string }} env  Worker env (key from a secret, never in code).
 */
export function registerWhisperTools(server, env = {}) {
  server.tool(
    "whisper_verify",
    "Verify that an IPv6 address or FQDN is a real Whisper agent identity (reverse-DNS + DANE + DNSSEC + transparency). Keyless - no API key needed.",
    { address: z.string().describe("agent /128 IPv6 address or FQDN") },
    async ({ address }) => {
      const is_whisper_agent = await verify(address);
      return text({ address, is_whisper_agent, details: is_whisper_agent ? await verifyDetails(address) : null });
    },
  );

  server.tool(
    "whisper_rdap",
    "Fetch the RDAP registration record for a Whisper agent /128 (who it is, when allocated, under which tenant). Keyless.",
    { address: z.string().describe("agent /128 IPv6 address") },
    async ({ address }) => text(await rdap(address)),
  );

  server.tool(
    "whisper_agents",
    "Whisper control plane: register/identity/list/agent/policy/logs/connect/revoke agents on the Whisper network. Needs the WHISPER_API_KEY secret.",
    {
      op: z.enum(["register", "identity", "list", "agent", "policy", "logs", "connect", "revoke"]),
      args: z.record(z.unknown()).optional().describe("op arguments, e.g. {label:'my-agent'} for register"),
    },
    async ({ op, args }) => {
      if (!env.WHISPER_API_KEY) return NO_KEY;
      const res = await control(env.WHISPER_API_KEY).agents(op, args ?? {});
      return text(res.records);
    },
  );

  server.tool(
    "whisper_assess",
    "Threat posture + vendor identity for hostnames/IPs from the Whisper security graph (3.6B+ nodes of DNS/BGP/threat intelligence): whisper.assess (malicious/benign label + severity band + evidence) and whisper.identify (who operates it). Keyless - no API key needed; the key, when set, lifts the rate limit.",
    { hosts: z.array(z.string()).min(1).describe("hostnames or IPs to assess, e.g. ['api.openai.com','8.8.8.8']") },
    async ({ hosts }) => {
      // Sequential, not parallel: the keyless tier allows only ONE concurrent query, so two
      // in-flight reads would trip "max concurrent queries". A key lifts that limit.
      const threat = await graphRead("CALL whisper.assess($v) YIELD host, label, band, coverage, evidence", { v: hosts }, env.WHISPER_API_KEY);
      const vendor = await graphRead("CALL whisper.identify($v) YIELD host, canonical_name, category, roles, band", { v: hosts }, env.WHISPER_API_KEY);
      return text({ threat: threat.rows, vendor: vendor.rows });
    },
  );

  server.tool(
    "whisper_graph_query",
    "Run a raw read-only Cypher query against the Whisper security graph (3.6B+ nodes: HOSTNAME, IPV4/IPV6, ORGANIZATION, ASN; relationships like RESOLVES_TO, NAMESERVER_FOR, LINKS_TO). Values go in `params` and are bound server-side as $-parameters. `CALL db.schema()` describes the graph. Needs the WHISPER_API_KEY secret.",
    {
      cypher: z.string().describe("the Cypher read, e.g. \"CALL whisper.walk($seed) YIELD ...\" or a MATCH"),
      params: z.record(z.unknown()).optional().describe("$-parameters referenced by the query"),
    },
    async ({ cypher, params }) => {
      if (!env.WHISPER_API_KEY) return NO_KEY;
      const res = await graph(env.WHISPER_API_KEY).query(cypher, params ?? {});
      return text({ columns: res.columns, rows: res.rows });
    },
  );

  server.tool(
    "whisper_graph_recipe",
    "Run a named recipe from the Whisper graph catalog (github.com/whisper-sec/whisper-catalog): multi-step investigation flows like typosquat, attack-surface, subdomain-takeover, bgp-hijack-exposure, indicator-enrichment. Inputs are the flow's entities keyed by name, e.g. {domain:'paypal.com'}. Needs the WHISPER_API_KEY secret.",
    {
      slug: z.string().describe("the catalog flow id, e.g. 'typosquat'"),
      inputs: z.record(z.string()).optional().describe("flow inputs keyed by name, e.g. {domain:'paypal.com'}"),
      params: z.record(z.unknown()).optional().describe("tunable knobs, e.g. {level:'standard'}"),
    },
    async ({ slug, inputs, params }) => {
      if (!env.WHISPER_API_KEY) return NO_KEY;
      const res = await graph(env.WHISPER_API_KEY).runFlow(slug, inputs ?? {}, params ?? {});
      return text({
        slug: res.slug,
        steps: res.steps.map((s) => ({ step: s.id, title: s.title, rows: s.rows?.length ?? 0 })),
        columns: res.columns,
        rows: res.rows,
      });
    },
  );

  server.tool(
    "whisper_egress_fetch",
    "Fetch a URL so the request leaves from a Whisper agent's routable /128 (its verifiable identity) instead of Cloudflare's IP. Needs the WHISPER_API_KEY secret.",
    {
      url: z.string().url(),
      agent: z.string().optional().describe("agent id or /128 to egress as; omit for your most recent agent"),
    },
    async ({ url, agent }) => {
      if (!env.WHISPER_API_KEY) return NO_KEY;
      // transport "forward": workerd cannot nest TLS inside a raw CONNECT tunnel (startTls()
      // pins the server name to the proxy host), so https:// targets need the fetch-forward
      // gateway - one HTTPS hop, credential inside TLS, works on every runtime.
      const egress = await agentEgress(env.WHISPER_API_KEY, agent || env.WHISPER_AGENT, { transport: "forward" });
      try {
        const res = await egress.fetch(url);
        return text({
          status: res.status,
          egress_address: egress.transport.address,
          egress_fqdn: egress.transport.fqdn,
          body: (await res.text()).slice(0, 10_000),
        });
      } finally {
        egress.close();
      }
    },
  );
}
