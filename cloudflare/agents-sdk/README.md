# Whisper MCP tools for the Cloudflare Agents SDK

A Durable-Object MCP server (Cloudflare [Agents SDK](https://developers.cloudflare.com/agents/))
that gives any MCP client - or any other CF Agent via `this.mcp.connect(url)` - the Whisper tools:

| tool | tier | what it does |
|---|---|---|
| `whisper_verify` | keyless | verify an IPv6 /128 or FQDN is a real Whisper agent identity |
| `whisper_rdap` | keyless | RDAP registration record for an agent /128 |
| `whisper_assess` | keyless | security-graph threat posture (`whisper.assess`) + operator (`whisper.identify`) for a host/IP |
| `whisper_agents` | keyed | control plane: register / identity / list / policy / logs / connect / revoke |
| `whisper_egress_fetch` | keyed | fetch a URL so it leaves from the agent's routable /128, not Cloudflare's IP |
| `whisper_graph_query` | keyed | run raw read-only Cypher against the security graph (3.6B+ nodes) |
| `whisper_graph_recipe` | keyed | run a named catalog recipe (typosquat, attack-surface, ...) |

`whisper_assess`, `whisper_graph_query`, and `whisper_graph_recipe` put the whole Whisper security
graph in the agent's hands: an LLM can label a host, name its operator, run arbitrary Cypher, or
launch a multi-step investigation - the keyless `whisper_assess` needs no secret at all.

Keyless tools work with **zero secrets**. Set `WHISPER_API_KEY` to unlock the control plane and
real egress (the LLM never sees the key - it stays in the Worker env):

```
npm i
wrangler secret put WHISPER_API_KEY   # optional - keyless tools work without it
wrangler deploy
```

Then point an MCP client at `https://<your-worker>/mcp` (streamable HTTP) or `/sse`.

Or use the tools inside your **own** Agent - `whisper-mcp.js` registers on any
`@modelcontextprotocol/sdk` `McpServer`:

```js
import { registerWhisperTools } from "./whisper-mcp.js";

export class MyAgent extends McpAgent {
  server = new McpServer({ name: "my-agent", version: "1.0.0" });
  async init() {
    registerWhisperTools(this.server, this.env); // + your own tools
  }
}
```
