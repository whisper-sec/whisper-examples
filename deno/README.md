# Whisper on Deno Deploy

```ts
import { verify, agentEgress } from "npm:whisper-edge@^0.3.1";
if (await verify(addr)) { /* keyless - no key needed */ }
const egress = await agentEgress(apiKey); // with a key - real egress from the agent's /128
```

## Tier 1 - keyless verify (works right now, no key)

```
GET /?addr=<agent /128 or fqdn>
→ { address, is_whisper_agent, rdap }
```

## Tier 2 - keyed egress

```
GET /?egress=1
→ { tier: "egress", agent, seen_ip, egress_source_header, matches_agent_address: true }
```

`seen_ip` comes back from `https://v6.ident.me/` **through** the Whisper egress - the request
left Deno from the agent's routable Whisper `/128`, not Deno's per-invocation IP. Unlock it with
either credential, set as a Deno Deploy env var (never in code):

| Env var | What it is | Trade-off |
|---|---|---|
| `WHISPER_API_KEY` | your owner key | one call - the SDK provisions the transport itself |
| `WHISPER_EGRESS_BEARER` | a pre-provisioned egress bearer (`et_…` from `op:connect`) | least privilege - the function never holds the owner key |

With the bearer you may also set `WHISPER_AGENT_128` (the expected source address, echoed into
`matches_agent_address`), `WHISPER_PROXY_SERVER` (CONNECT proxy override, default
`connect.whisper.online:443`) and `WHISPER_FORWARD_URL` (self-host / pre-prod gateway override).

On full Deno (local, and the current Deno Deploy) the bearer path uses the runtime's native
`Deno.createHttpClient({ proxy })` - every fetch tunnels through the Whisper CONNECT proxy and
leaves from the agent's `/128`. On fetch-only sandboxes (Deno Deploy Classic) it falls back to
the fetch-forward gateway automatically. The demo fetch tries an ordered chain of IP echoes so
one flaky echo service never fails the demo.

## Run it

Local: `deno run --allow-net --allow-env main.ts`, then
`curl 'localhost:8000/?addr=<ipv6>'` or `curl 'localhost:8000/?egress=1'` with a credential
exported in the shell.

Deploy: `deno deploy` from this directory (the modern Deno Deploy - `deployctl`/Classic works
too but retires in July 2026), then add the credential under the app's environment variables:

```
deno deploy env add WHISPER_EGRESS_BEARER <et_token>
deno deploy env add WHISPER_AGENT_128     <the agent /128>
```

Typecheck: `deno task check`.

Proven end-to-end on Deno Deploy: `GET /?egress=1` on a deployed app returned
`seen_ip == WHISPER_AGENT_128` with `matches_agent_address: true` - the fetch left the edge
sandbox through the Whisper CONNECT proxy, sourced from the agent's routable Whisper `/128`
(confirmed by both the Whisper echo and an independent `cdn-cgi/trace`).
