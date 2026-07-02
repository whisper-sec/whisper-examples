# Whisper on AWS Lambda

```js
import { verify, agentEgress } from "whisper-edge";
if (await verify(addr)) { /* keyless — no key needed */ }
const egress = await agentEgress(apiKey); // with a key — real egress from the agent's /128
```

## Tier 1 — keyless verify (works right now, no key)

```
GET ?addr=<agent /128 or fqdn>
→ { address, is_whisper_agent, rdap }
```

## Tier 2 — keyed egress (needs `WHISPER_API_KEY`)

```
GET ?egress=1
→ { tier: "egress", agent, seen_ip, egress_source_header, matches_agent_address: true }
```

`seen_ip` comes back from `https://v6.ident.me/` **through** `egress.fetch` — the request left
Lambda from the agent's routable Whisper `/128`, not Lambda's IP. On Lambda's Node runtime
`agentEgress` opens a `node:net`/`node:tls` CONNECT tunnel; the transport is chosen for you.

Set `WHISPER_API_KEY` as a function environment variable before deploying.

## Deploy

Zip `handler.mjs` + `node_modules` (after `npm i`) and upload, or point a Function URL / API
Gateway route at `handler.handler`. Node 18+ runtime (global `fetch` required).

Status: both tiers are live code paths, proven against the Whisper control plane and gateway from
Node (same SDK, same code path `agentEgress` calls into — Lambda's Node runtime is the same
engine this was tested on). An actual Lambda deploy is yours to run — this repo ships the
handler, not a live Function URL.
