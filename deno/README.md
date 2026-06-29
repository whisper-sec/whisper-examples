# Whisper on Deno Deploy

Verify a Whisper agent identity at the edge - **keyless, no CLI**.

```ts
import { verify, rdap } from "npm:whisper-id@^0.2.0";
const ok = await verify(addr);     // is this a real Whisper agent? (DANE+DNSSEC+reverse-DNS+JWS)
```

Run locally: `deno run --allow-net main.ts` → `curl 'localhost:8000/?addr=<ipv6>'`
Deploy: `deployctl deploy --project=<project> main.ts` (or connect the repo in the Deno Deploy dashboard).

`verify` / `verifyDetails` / `rdap` / `egressIp` are keyless HTTPS - they work in any Deno runtime.
(Egress *from* a /128 needs the host CLI/sidecar; on Deno Deploy you get identity/verify/resolve.)
