# Whisper on Cloudflare Workers

```js
import { verify, agentEgress } from "whisper-edge";
if (await verify(addr)) { /* keyless - no key needed */ }
const egress = await agentEgress(apiKey, agent, { transport: "forward" }); // real egress from the agent's /128
```

## Tier 1 - keyless verify (works right now, no key)

```
GET /?addr=<agent /128 or fqdn>
→ { address, is_whisper_agent, rdap }
```

## Tier 2 - keyed egress (needs `WHISPER_API_KEY`)

```
GET /?egress=1[&agent=<agent id or /128>]
→ { tier: "egress", agent, seen_ip, egress_source_header, matches_agent_address: true }
```

`seen_ip` comes back from `https://v6.ident.me/` **through** `egress.fetch` - the request left
the Cloudflare edge from the agent's routable Whisper `/128`, not Cloudflare's IP. Pin which of
your agents sources the traffic with `?agent=` or a `WHISPER_AGENT` var; omit both to reuse your
most recent agent.

On Workers, use `transport: "forward"` (the fetch-forward gateway): workerd's `startTls()` pins
the TLS server name to the host passed to `connect()`, so a raw `cloudflare:sockets` CONNECT
tunnel cannot add the *target's* TLS layer - `https://` targets through the raw tunnel fail their
handshake. The gateway is one HTTPS hop, works for every target, and carries the egress
credential *inside* TLS (`tokenProtected: true`).

Set the secret before deploying: `wrangler secret put WHISPER_API_KEY`. Local dev: put it in
`.dev.vars` (`WHISPER_API_KEY=whisper_live_...`, never commit it) and run `wrangler dev`.

## Deploy

```
npm i
wrangler deploy
```

Proven end-to-end on a real `workers.dev` deploy: tier 1 verified a live agent keylessly, and
tier 2 fetched `https://v6.ident.me/` with `seen_ip` equal to the agent's `/128`
(`matches_agent_address: true`, `X-Whisper-Egress-Source` stamped by the gateway).

## Also here: query the security graph

[`graph/`](./graph/) is a second Worker that queries the Whisper security graph (3.6B+ nodes of
DNS / BGP / threat intelligence) with plain `fetch` - no SDK, no dependency:

```
GET /?host=<fqdn|ip>     -> keyless: threat posture (whisper.assess) + operator (whisper.identify)
GET /?variants=<domain>  -> keyless: registered look-alike domains (whisper.variants)
GET /?typosquat=<domain> -> keyed:   the "typosquat" catalog flow (set WHISPER_API_KEY)
```

The direct read verbs answer keyless (rate-limited, real answers); raw Cypher and the catalog
flows unlock with a key. Deploy: `cd graph && wrangler deploy`.

## Also here: MCP tools for the Cloudflare Agents SDK

[`agents-sdk/`](./agents-sdk/) ships the same two tiers as MCP tools on a Durable-Object
`McpAgent` - `whisper_verify` / `whisper_rdap` / `whisper_assess` (keyless) and `whisper_agents` /
`whisper_egress_fetch` / `whisper_graph_query` / `whisper_graph_recipe` (keyed) - for any MCP
client or another CF Agent.
