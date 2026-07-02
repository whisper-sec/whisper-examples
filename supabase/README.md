# Whisper on Supabase Edge Functions

```ts
import { verify, agentEgress } from "npm:whisper-edge@^0.3.0";
if (await verify(addr)) { /* keyless - no key needed */ }
const egress = await agentEgress(apiKey); // with a key - real egress from the agent's /128
```

## Tier 1 - keyless verify (works right now, no key)

```
GET /functions/v1/verify?addr=<agent /128 or fqdn>
→ { address, is_whisper_agent, rdap }
```

## Tier 2 - keyed egress (needs `WHISPER_API_KEY`)

```
GET /functions/v1/verify?egress=1
→ { tier: "egress", agent, seen_ip, egress_source_header, matches_agent_address: true }
```

`seen_ip` comes back from `https://v6.ident.me/` **through** `egress.fetch` - the request left
Supabase from the agent's routable Whisper `/128`, not Supabase's IP. Supabase Edge Functions run
on Deno, so `agentEgress` opens a `Deno.connect` CONNECT tunnel; the transport is chosen for you.

Set the secret before deploying: `supabase secrets set WHISPER_API_KEY=whisper_live_...`.

## Deploy

```
supabase functions deploy verify
```

Status: both tiers are live code paths, proven against the Whisper control plane and gateway from
Node (same SDK, same code path `agentEgress` calls into). An actual Supabase project deploy is
yours to run - this repo ships the function, not a live URL.
