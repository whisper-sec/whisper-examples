# whisper-examples

Runnable examples for using [Whisper](https://whisper.online) - a real, routable IPv6 identity
and safe egress for agents - from popular serverless & edge runtimes. Each folder is a minimal,
copy-paste sample built on the [`whisper-edge`](https://www.npmjs.com/package/whisper-edge) SDK.

```js
import { verify, agentEgress } from "whisper-edge";       // npm  (or: npm:whisper-edge  in Deno)
if (await verify(addr)) { /* keyless - no key needed */ }
const egress = await agentEgress(apiKey);                  // with a key - real egress
const res = await egress.fetch("https://api.example.com"); // this request LEAVES from the /128
```

## Two tiers, every sample

| Tier | Needs | What it does |
|------|-------|---------------|
| 1 - keyless | nothing | `verify` / `rdap` an agent identity - pure HTTPS, works everywhere |
| 2 - keyed | `WHISPER_API_KEY` | `agentEgress` - a real fetch that leaves from the agent's routable `/128` |

Every sample exposes both: `GET /?addr=<agent /128 or fqdn>` for tier 1, `GET /?egress=1` for
tier 2 (exact paths per platform - see each folder). `whisper-edge` auto-detects the runtime and
picks the best egress transport (a raw CONNECT tunnel on Node/Deno, or the fetch-forward
gateway on fetch-only sandboxes; on Cloudflare Workers pass `{ transport: "forward" }` -
workerd cannot nest the target's TLS inside a raw tunnel) - the sample code barely changes.

| Runtime | Folder | Deploy |
|---------|--------|--------|
| Cloudflare Workers | [`cloudflare/`](cloudflare/) | `wrangler deploy` |
| Cloudflare Agents SDK (MCP tools) | [`cloudflare/agents-sdk/`](cloudflare/agents-sdk/) | `wrangler deploy` |
| Vercel Functions (+ AI SDK tools) | [`vercel/`](vercel/) | `vercel deploy` |
| Deno Deploy | [`deno/`](deno/) | `deployctl deploy` |
| AWS Lambda | [`lambda/`](lambda/) | zip + Function URL / API Gateway |
| Supabase Edge Functions | [`supabase/`](supabase/) | `supabase functions deploy` |
| Netlify Functions | [`netlify/`](netlify/) | `netlify deploy` |
| Browserbase (cloud browser, BYOP) | [`browserbase/`](browserbase/) | `node index.mjs` |
| Modal (Python) | [`modal/`](modal/) | `modal run egress.py` |
| Zapier (native two-tier app) | [`zapier/`](zapier/) | `zapier push` |

**Self-hosting an agent platform** (Dify, RAGFlow, Qwen-Agent, FastGPT, Coze, …)? See
[`self-hosted/`](self-hosted/) - add the Whisper MCP server *and* egress from your `/128`.

**Low-code / RPA?** Native two-tier apps for **Zapier** ([`zapier/`](zapier/)), **Make** ([`make/`](make/)),
and **Pipedream** - keyless verify/RDAP plus the full keyed control plane (register / policy / logs / revoke).
For Power Platform (and any OpenAPI host), import the keyless [OpenAPI spec](openapi/).

**Python?** [`modal/`](modal/) is the Python sample - the PyPI
[`whisper-id`](https://pypi.org/project/whisper-id/) SDK baked into a Modal image, keyless
verify plus real egress from the agent's `/128` through the Whisper proxy.

**Cloud browsers** (Browserbase)? Bring your own proxy: point the session's external-proxy
config at the Whisper egress - [`browserbase/`](browserbase/) - and the browser's public
address becomes your agent's routable `/128`.

## Query the security graph

The same two-tier idea, for **intelligence**. The Whisper security graph is 3.6B+ nodes of
DNS / BGP / threat intelligence (`HOSTNAME`, `IPV4`/`IPV6`, `ORGANIZATION`, `ASN`; relationships
like `RESOLVES_TO`, `NAMESERVER_FOR`, `LINKS_TO`). The **direct read verbs** answer **keyless** -
no key, no account, one HTTPS POST - so an edge function can label a host, name its operator, or
enumerate typosquats with **zero secrets to manage**. Raw Cypher and the multi-step catalog
recipes unlock with an API key.

```js
// Keyless: threat posture for a host. Runs in any runtime - no key, no SDK.
const res = await fetch("https://graph.whisper.security/api/query", {
  method: "POST",
  headers: { "content-type": "application/json", "user-agent": "my-app/1.0" },
  body: JSON.stringify({
    query: "CALL whisper.assess($v) YIELD host, label, band, coverage, evidence",
    parameters: { v: ["theblackservicenetwork.com"] },
  }),
});
const { columns, rows } = await res.json();   // rows are objects keyed by column
// -> [{ host: "theblackservicenetwork.com", label: "malicious", band: "CRITICAL", ... }]
```

```sh
# The same call, keyless, from a shell:
curl -s https://graph.whisper.security/api/query \
  -H 'content-type: application/json' \
  -d '{"query":"CALL whisper.identify($v) YIELD host, canonical_name, category, roles","parameters":{"v":["api.openai.com"]}}'
```

Every serverless folder ships a copy-paste `graph` example with the same two tiers:

| Runtime | Graph example |
|---------|---------------|
| Cloudflare Workers | [`cloudflare/graph/`](cloudflare/graph/) |
| Cloudflare Agents SDK (MCP tools) | `whisper_assess` (keyless) · `whisper_graph_query` / `whisper_graph_recipe` (keyed) in [`cloudflare/agents-sdk/`](cloudflare/agents-sdk/) |
| Vercel Functions (+ AI SDK tools) | [`vercel/api/graph.js`](vercel/api/graph.js) · `whisperAssessTool` / `whisperGraphQueryTool` in [`vercel/whisper-tool.js`](vercel/whisper-tool.js) |
| Deno Deploy | [`deno/graph.ts`](deno/graph.ts) |
| AWS Lambda | [`lambda/graph.mjs`](lambda/graph.mjs) |
| Supabase Edge Functions | [`supabase/functions/graph/`](supabase/functions/graph/) |
| Netlify Functions | [`netlify/netlify/functions/graph.mjs`](netlify/netlify/functions/graph.mjs) |
| Modal (Python) | [`modal/graph.py`](modal/graph.py) |
| Zapier | Assess Host · Find Look-alike Domains (keyless) · Run Cypher Query (keyed) in [`zapier/`](zapier/) |
| Make | Query security graph · Run a graph recipe (keyless) · Run raw Cypher (keyed) in [`make/`](make/) |

- **Two tiers.** The 13 direct read verbs (`assess`, `identify`, `variants`, `walk`, `explain`,
  `origins`, `history`, `psl-*`, `asSet`, `lookupTorRelay`, `db.schema`) are keyless and
  rate-limited (~100/window). Raw Cypher, the multi-step flows, and `submit` need `X-API-Key`;
  sending a key on any call also lifts the keyless rate limit.
- **Parameterise.** Pass values in `parameters` and reference them as `$name` in the query - they
  are bound server-side, so a value can never break out of the Cypher, however hostile.
- **One concurrent keyless query.** The keyless tier serves one query at a time per caller, so run
  keyless reads sequentially (not `Promise.all`); a key lifts that limit.
- **Named recipes** live in the [`whisper-catalog`](https://github.com/whisper-sec/whisper-catalog)
  (typosquat, attack-surface, subdomain-takeover, bgp-hijack-exposure, ...). Docs:
  [www.whisper.security/docs](https://www.whisper.security/docs) - each verb has a page under
  `/docs/whisper-graph/procedures`, each recipe under `/docs/recipes`.

## Status

Every tier-1 and tier-2 code path in these samples is proven end-to-end against the live Whisper
control plane and egress gateway - same SDK, same code `agentEgress` calls into. Deploying a
sample onto your own Vercel/Netlify/Cloudflare/AWS/Supabase/Deno account is account-gated and
yours to run; these folders ship the code, not a hosted URL.

MIT licensed.
