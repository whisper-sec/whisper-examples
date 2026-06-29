# whisper-examples

Runnable examples for using [Whisper](https://whisper.online) - a real, routable IPv6 identity
and safe egress for agents - from popular runtimes. Each folder is a minimal, copy-paste sample
built on the [`whisper-id`](https://www.npmjs.com/package/whisper-id) SDK.

All of these use Whisper's **keyless** identity surface - `verify` / `verifyDetails` / `rdap` /
`egressIp` - which is pure HTTPS: **no CLI, no key**, so it runs in serverless and edge runtimes.

```js
import { verify, rdap } from "whisper-id";   // npm  (or: npm:whisper-id  in Deno)
if (await verify(addr)) console.log((await rdap(addr)).name);
```

| Runtime | Folder | Deploy |
|---------|--------|--------|
| Cloudflare Workers | [`cloudflare/`](cloudflare/) | `wrangler deploy` |
| Vercel Functions (+ AI SDK tool) | [`vercel/`](vercel/) | `vercel deploy` |
| Deno Deploy | [`deno/`](deno/) | `deployctl deploy` |
| AWS Lambda | [`lambda/`](lambda/) | zip + Function URL / API Gateway |
| Supabase Edge Functions | [`supabase/`](supabase/) | `supabase functions deploy` |
| Netlify Functions | [`netlify/`](netlify/) | `netlify deploy` |

Each sample verifies an agent identity at the edge: `GET /?addr=<agent /128 or fqdn>` →
`{ is_whisper_agent, rdap }`.

**Self-hosting an agent platform** (Dify, RAGFlow, Qwen-Agent, FastGPT, Coze, …)? See
[`self-hosted/`](self-hosted/) - add the Whisper MCP server *and* egress from your `/128`.

> **Identity vs egress.** These edge runtimes run on the provider's IPs, so the samples do
> **identity/verify/resolve** (keyless). To make traffic *leave from* your `/128`, run the
> Whisper CLI or the [container sidecar](https://github.com/whisper-sec/whisper-cli) on a host
> you control (`whisper connect`, `whisper init compose`).

MIT licensed.
