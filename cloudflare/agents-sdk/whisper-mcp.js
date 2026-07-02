// SPDX-License-Identifier: MIT
// Whisper MCP tools for the Cloudflare Agents SDK (or any @modelcontextprotocol/sdk McpServer).
//
// Two tiers, per Postel's Law:
//   keyless — whisper_verify / whisper_rdap work with NO key: anyone can check an agent identity.
//   keyed   — whisper_agents / whisper_egress_fetch unlock the control plane + real /128 egress
//             when the WHISPER_API_KEY secret is set. The LLM never sees the key.
import { z } from "zod";
import { verify, verifyDetails, rdap, control, agentEgress } from "whisper-edge";

const text = (obj) => ({ content: [{ type: "text", text: JSON.stringify(obj, null, 2) }] });
const NO_KEY = text({
  error: "WHISPER_API_KEY is not set — this tool needs a key. Keyless tools (whisper_verify, whisper_rdap) still work.",
});

/**
 * Register the Whisper tools on an MCP server.
 * @param {import("@modelcontextprotocol/sdk/server/mcp.js").McpServer} server
 * @param {{ WHISPER_API_KEY?: string, WHISPER_AGENT?: string }} env  Worker env (key from a secret, never in code).
 */
export function registerWhisperTools(server, env = {}) {
  server.tool(
    "whisper_verify",
    "Verify that an IPv6 address or FQDN is a real Whisper agent identity (reverse-DNS + DANE + DNSSEC + transparency). Keyless — no API key needed.",
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
      // gateway — one HTTPS hop, credential inside TLS, works on every runtime.
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
