# Whisper MCP tools for the Cloudflare Agents SDK

A Durable-Object MCP server (Cloudflare [Agents SDK](https://developers.cloudflare.com/agents/))
that gives any MCP client — or any other CF Agent via `this.mcp.connect(url)` — the Whisper tools:

| tool | tier | what it does |
|---|---|---|
| `whisper_verify` | keyless | verify an IPv6 /128 or FQDN is a real Whisper agent identity |
| `whisper_rdap` | keyless | RDAP registration record for an agent /128 |
| `whisper_agents` | keyed | control plane: register / identity / list / policy / logs / connect / revoke |
| `whisper_egress_fetch` | keyed | fetch a URL so it leaves from the agent's routable /128, not Cloudflare's IP |

Keyless tools work with **zero secrets**. Set `WHISPER_API_KEY` to unlock the control plane and
real egress (the LLM never sees the key — it stays in the Worker env):

```
npm i
wrangler secret put WHISPER_API_KEY   # optional — keyless tools work without it
wrangler deploy
```

Then point an MCP client at `https://<your-worker>/mcp` (streamable HTTP) or `/sse`.

Or use the tools inside your **own** Agent — `whisper-mcp.js` registers on any
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
