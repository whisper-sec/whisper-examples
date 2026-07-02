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
picks the best egress transport (a raw CONNECT tunnel on Node/Deno/Cloudflare Workers, or the
fetch-forward gateway on fetch-only sandboxes) - the sample code never changes.

| Runtime | Folder | Deploy |
|---------|--------|--------|
| Cloudflare Workers | [`cloudflare/`](cloudflare/) | `wrangler deploy` |
| Vercel Functions (+ AI SDK tools) | [`vercel/`](vercel/) | `vercel deploy` |
| Deno Deploy | [`deno/`](deno/) | `deployctl deploy` |
| AWS Lambda | [`lambda/`](lambda/) | zip + Function URL / API Gateway |
| Supabase Edge Functions | [`supabase/`](supabase/) | `supabase functions deploy` |
| Netlify Functions | [`netlify/`](netlify/) | `netlify deploy` |
| Browserbase (cloud browser, BYOP) | [`browserbase/`](browserbase/) | `node index.mjs` |

**Self-hosting an agent platform** (Dify, RAGFlow, Qwen-Agent, FastGPT, Coze, …)? See
[`self-hosted/`](self-hosted/) - add the Whisper MCP server *and* egress from your `/128`.

**Low-code / RPA** (Power Platform, Zapier, Make, Pipedream)? Import the keyless
[OpenAPI spec](openapi/) to build a connector with verify / RDAP / egress-IP actions.

**Cloud browsers** (Browserbase)? Bring your own proxy: point the session's external-proxy
config at the Whisper egress - [`browserbase/`](browserbase/) - and the browser's public
address becomes your agent's routable `/128`.

## Status

Every tier-1 and tier-2 code path in these samples is proven end-to-end against the live Whisper
control plane and egress gateway - same SDK, same code `agentEgress` calls into. Deploying a
sample onto your own Vercel/Netlify/Cloudflare/AWS/Supabase/Deno account is account-gated and
yours to run; these folders ship the code, not a hosted URL.

MIT licensed.
