# Whisper on Deno Deploy

```ts
import { verify, agentEgress } from "npm:whisper-edge@^0.3.0";
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
Deno from the agent's routable Whisper `/128`, not Deno's IP. On Deno, `agentEgress` opens a
`Deno.connect` CONNECT tunnel; the transport is chosen for you.

Run locally: `deno run --allow-net --allow-env main.ts` → `curl 'localhost:8000/?addr=<ipv6>'`,
or `curl 'localhost:8000/?egress=1'` with `WHISPER_API_KEY` exported in the shell.
Typecheck: `deno check main.ts`.
Deploy: `deployctl deploy --project=<project> main.ts` (or connect the repo in the Deno Deploy
dashboard, then set `WHISPER_API_KEY` under the project's environment variables).

Status: both tiers are live code paths, proven against the Whisper control plane and gateway from
Node (same SDK, same code path `agentEgress` calls into). An actual Deno Deploy deployment is
yours to run - this repo ships the handler, not a live URL.
