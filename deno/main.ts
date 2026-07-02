// SPDX-License-Identifier: MIT
// Whisper on Deno Deploy — two-tier agent identity + egress at the edge.
// Deploy: `deployctl deploy --project=<p> main.ts`
// Local:  `deno run --allow-net --allow-env main.ts`
//
// Tier 1 (keyless): GET /?addr=<agent /128 or fqdn>
// Tier 2 (keyed):   GET /?egress=1   — a real fetch out through the agent's routable /128
//                    (set the WHISPER_API_KEY environment variable first)
import { verify, rdap, agentEgress } from "npm:whisper-edge@^0.3.0";

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);

  if (url.searchParams.has("egress")) {
    const apiKey = Deno.env.get("WHISPER_API_KEY");
    if (!apiKey) return Response.json({ error: "set WHISPER_API_KEY to unlock tier 2 egress" }, { status: 400 });
    const egress = await agentEgress(apiKey);
    try {
      const upstream = await egress.fetch("https://v6.ident.me/");
      const seenIp = (await upstream.text()).trim();
      return Response.json({
        tier: "egress",
        agent: egress.transport,
        seen_ip: seenIp,
        egress_source_header: upstream.headers.get("x-whisper-egress-source"),
        matches_agent_address: seenIp === egress.transport.address,
      });
    } finally {
      egress.close();
    }
  }

  const addr = url.searchParams.get("addr");
  if (!addr) {
    return new Response("usage: ?addr=<agent /128 or fqdn>  |  ?egress=1 (needs WHISPER_API_KEY)\n", { status: 400 });
  }
  const isAgent = await verify(addr); // keyless: no CLI, no key
  return Response.json({
    address: addr,
    is_whisper_agent: isAgent,
    rdap: isAgent ? await rdap(addr) : null,
  });
});
