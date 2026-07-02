// SPDX-License-Identifier: MIT
// Whisper on Cloudflare Workers — two-tier agent identity + egress at the edge.
// Deploy: `wrangler deploy`  ·  npm i whisper-edge
//
// Tier 1 (keyless):  GET /?addr=<agent /128 or fqdn>   — verify + RDAP, no key needed
// Tier 2 (keyed):    GET /?egress=1[&agent=<128>]       — a real fetch out through the
//                     agent's routable /128 (set the WHISPER_API_KEY secret first:
//                     `wrangler secret put WHISPER_API_KEY`). Pin WHICH of your agents
//                     sources the traffic with ?agent=<id or /128> or a WHISPER_AGENT var;
//                     omit both to reuse your most recent agent.
import { verify, rdap, agentEgress } from "whisper-edge";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.searchParams.has("egress")) {
      const apiKey = env.WHISPER_API_KEY;
      if (!apiKey) {
        return Response.json({ error: "set the WHISPER_API_KEY secret to unlock tier 2 egress" }, { status: 400 });
      }
      const agent = url.searchParams.get("agent") || env.WHISPER_AGENT || undefined;
      let egress;
      try {
        // transport "forward": on Workers the raw cloudflare:sockets CONNECT tunnel cannot add
        // the TARGET's TLS layer (workerd's startTls() pins the server name to the host given to
        // connect() — the proxy), so https:// targets need the fetch-forward gateway instead.
        // Bonus: the egress credential rides INSIDE the HTTPS session (tokenProtected: true).
        egress = await agentEgress(apiKey, agent, { transport: "forward" });
      } catch (e) {
        const hint = agent ? ` (is "${agent}" one of your agents?)` : "";
        return Response.json({ error: `egress setup failed: ${e.message}${hint}` }, { status: e.status || 502 });
      }
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
      } catch (e) {
        return Response.json({ error: `egress fetch failed: ${e.message}` }, { status: e.status || 502 });
      } finally {
        egress.close();
      }
    }

    const addr = url.searchParams.get("addr");
    if (!addr) {
      return new Response("usage: ?addr=<agent /128 or fqdn>  |  ?egress=1 (needs WHISPER_API_KEY)\n", { status: 400 });
    }
    const isAgent = await verify(addr); // keyless: no CLI, no key
    return Response.json({ address: addr, is_whisper_agent: isAgent, rdap: isAgent ? await rdap(addr) : null });
  },
};
