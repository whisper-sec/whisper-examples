# Whisper on Vercel Functions

```js
import { verify, agentEgress } from "whisper-edge";
if (await verify(addr)) { /* keyless - no key needed */ }
const egress = await agentEgress(apiKey); // with a key - real egress from the agent's /128
```

## Tier 1 - keyless verify (works right now, no key)

```
GET /api/verify?addr=<agent /128 or fqdn>
→ { address, is_whisper_agent, rdap }
```

## Tier 2 - keyed egress (needs `WHISPER_API_KEY`)

```
GET /api/verify?egress=1
→ { tier: "egress", agent, seen_ip, egress_source_header, matches_agent_address: true }
```

`seen_ip` comes back from `https://v6.ident.me/` **through** `egress.fetch` - the request left
Vercel from the agent's routable Whisper `/128`, not Vercel's IP. On a standard (Node) Vercel
Function `agentEgress` opens a `node:net`/`node:tls` CONNECT tunnel; on Vercel *Edge* Functions it
auto-selects the fetch-forward gateway instead - same code, no config either way.

Set `WHISPER_API_KEY` in the project's environment variables before deploying (`vercel env add`).

## Query the security graph

[`api/graph.js`](api/graph.js) queries the Whisper security graph (3.6B+ nodes of DNS / BGP /
threat intelligence) with plain `fetch` - no dependency:

```
GET /api/graph?host=<fqdn|ip>     -> keyless: threat posture + operator identity
GET /api/graph?variants=<domain>  -> keyless: registered look-alike domains
GET /api/graph?typosquat=<domain> -> keyed:   the "typosquat" catalog flow (set WHISPER_API_KEY)
```

The direct read verbs answer keyless (rate-limited, real answers); raw Cypher and the catalog
flows unlock with a key.

## AI SDK tools

`whisper-tool.js` exports `whisperVerifyTool` and `whisperAssessTool` (keyless), plus
`whisperGraphQueryTool` and `whisperEgressTool` (keyed) for the
[Vercel AI SDK](https://sdk.vercel.ai)'s `tool()` - an LLM can verify an agent identity, assess a
host against the security graph, run raw Cypher, or ask for a fetch to leave from the agent's
`/128`, all without ever seeing the API key.

## Deploy

```
npm i
vercel deploy
```

Status: both tiers are live code paths, proven against the Whisper control plane and gateway from
Node (same SDK, same code path `agentEgress` calls into). An actual Vercel account deploy is
yours to run - this repo ships the function, not a live URL.
