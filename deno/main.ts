// SPDX-License-Identifier: MIT
// Whisper on Deno Deploy - keyless agent-identity verification at the edge.
// Deploy: `deployctl deploy --project=<p> main.ts`  ·  Local: `deno run --allow-net main.ts`
import { verify, rdap } from "npm:whisper-id@^0.2.0";

Deno.serve(async (req: Request) => {
  const addr = new URL(req.url).searchParams.get("addr");
  if (!addr) return new Response("usage: ?addr=<agent /128 or fqdn>\n", { status: 400 });
  const isAgent = await verify(addr);           // keyless: no CLI, no key
  return Response.json({
    address: addr,
    is_whisper_agent: isAgent,
    rdap: isAgent ? await rdap(addr) : null,
  });
});
