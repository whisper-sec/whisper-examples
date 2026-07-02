# Whisper on Netlify Functions

```js
import { verify, agentEgress } from "whisper-edge";
if (await verify(addr)) { /* keyless — no key needed */ }
const egress = await agentEgress(apiKey); // with a key — real egress from the agent's /128
```

## Tier 1 — keyless verify (works right now, no key)

```
GET /.netlify/functions/verify?addr=<agent /128 or fqdn>
→ { address, is_whisper_agent, rdap }
```

## Tier 2 — keyed egress (needs `WHISPER_API_KEY`)

```
GET /.netlify/functions/verify?egress=1
→ { tier: "egress", agent, seen_ip, egress_source_header, matches_agent_address: true }
```

`seen_ip` comes back from `https://v6.ident.me/` **through** `egress.fetch` — the request left
Netlify from the agent's routable Whisper `/128`, not Netlify's IP. Netlify Functions run on
Node, so `agentEgress` opens a `node:net`/`node:tls` CONNECT tunnel; the transport is chosen for
you. (Netlify *Edge* Functions are fetch-only and would auto-select the fetch-forward gateway
instead — same code either way.)

Set `WHISPER_API_KEY` in the site's environment variables before deploying (`netlify env:set`).

## Deploy

```
npm i
netlify deploy
```

Status: both tiers are live code paths, proven against the Whisper control plane and gateway from
Node (same SDK, same code path `agentEgress` calls into). An actual Netlify site deploy is yours
to run — this repo ships the function, not a live URL.
