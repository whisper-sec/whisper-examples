# Whisper on Vercel Functions

```js
import { verify, agentEgress } from "whisper-edge";
if (await verify(addr)) { /* keyless — no key needed */ }
const egress = await agentEgress(apiKey); // with a key — real egress from the agent's /128
```

## Tier 1 — keyless verify (works right now, no key)

```
GET /api/verify?addr=<agent /128 or fqdn>
→ { address, is_whisper_agent, rdap }
```

## Tier 2 — keyed egress (needs `WHISPER_API_KEY`)

```
GET /api/verify?egress=1
→ { tier: "egress", agent, seen_ip, egress_source_header, matches_agent_address: true }
```

`seen_ip` comes back from `https://v6.ident.me/` **through** `egress.fetch` — the request left
Vercel from the agent's routable Whisper `/128`, not Vercel's IP. On a standard (Node) Vercel
Function `agentEgress` opens a `node:net`/`node:tls` CONNECT tunnel; on Vercel *Edge* Functions it
auto-selects the fetch-forward gateway instead — same code, no config either way.

Set `WHISPER_API_KEY` in the project's environment variables before deploying (`vercel env add`).

## AI SDK tool

`whisper-tool.js` exports `whisperVerifyTool` (keyless) and `whisperEgressTool` (keyed) for the
[Vercel AI SDK](https://sdk.vercel.ai)'s `tool()` — an LLM can verify an agent identity or ask for
a fetch to leave from the agent's `/128` without ever seeing the API key.

## Deploy

```
npm i
vercel deploy
```

Status: both tiers are live code paths, proven against the Whisper control plane and gateway from
Node (same SDK, same code path `agentEgress` calls into). An actual Vercel account deploy is
yours to run — this repo ships the function, not a live URL.
