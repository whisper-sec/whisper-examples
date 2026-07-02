# Whisper on Cloudflare Workers

```js
import { verify, agentEgress } from "whisper-edge";
if (await verify(addr)) { /* keyless - no key needed */ }
const egress = await agentEgress(apiKey); // with a key - real egress from the agent's /128
```

## Tier 1 - keyless verify (works right now, no key)

```
GET /?addr=<agent /128 or fqdn>
→ { address, is_whisper_agent, rdap }
```

## Tier 2 - keyed egress (needs `WHISPER_API_KEY`)

```
GET /?egress=1
→ { tier: "egress", agent, seen_ip, egress_source_header, matches_agent_address: true }
```

`seen_ip` comes back from `https://v6.ident.me/` **through** `egress.fetch` - the request left
the Cloudflare edge from the agent's routable Whisper `/128`, not Cloudflare's IP. On Workers,
`agentEgress` opens a `cloudflare:sockets` CONNECT tunnel; the transport is chosen for you.

Set the secret before deploying: `wrangler secret put WHISPER_API_KEY`. Local dev: put it in
`.dev.vars` (`WHISPER_API_KEY=whisper_live_...`, never commit it) and run `wrangler dev`.

## Deploy

```
npm i
wrangler deploy
```

Status: tier 1 and tier 2 are both live code paths, proven against the Whisper control plane and
gateway from Node (same SDK, same code path `agentEgress` calls into). An actual Cloudflare
account deploy is yours to run - this repo ships the worker, not a live URL.
