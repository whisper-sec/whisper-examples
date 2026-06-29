// SPDX-License-Identifier: MIT
// Whisper on Cloudflare Workers - keyless agent-identity verification at the edge.
// Deploy: `wrangler deploy`  ·  npm i whisper-id
import { verify, rdap } from "whisper-id";

export default {
  async fetch(request) {
    const addr = new URL(request.url).searchParams.get("addr");
    if (!addr) return new Response("usage: ?addr=<agent /128 or fqdn>\n", { status: 400 });
    const isAgent = await verify(addr); // keyless: no CLI, no key
    return Response.json({ address: addr, is_whisper_agent: isAgent, rdap: isAgent ? await rdap(addr) : null });
  },
};
