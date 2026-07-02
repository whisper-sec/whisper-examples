// SPDX-License-Identifier: MIT
// Whisper on Vercel Functions — two-tier agent identity + egress.  npm i whisper-edge
//
// Tier 1 (keyless): GET /api/verify?addr=<agent /128 or fqdn>
// Tier 2 (keyed):   GET /api/verify?egress=1   — a real fetch out through the agent's
//                    routable /128 (set WHISPER_API_KEY in the project's env vars first)
import { verify, rdap, agentEgress } from "whisper-edge";

export default async function handler(req, res) {
  if (req.query.egress !== undefined) {
    const apiKey = process.env.WHISPER_API_KEY;
    if (!apiKey) return res.status(400).json({ error: "set WHISPER_API_KEY to unlock tier 2 egress" });
    const egress = await agentEgress(apiKey);
    try {
      const upstream = await egress.fetch("https://v6.ident.me/");
      const seenIp = (await upstream.text()).trim();
      return res.status(200).json({
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

  const addr = req.query.addr;
  if (!addr) return res.status(400).send("usage: ?addr=<agent /128 or fqdn>  |  ?egress=1 (needs WHISPER_API_KEY)");
  const isAgent = await verify(addr); // keyless
  res.status(200).json({ address: addr, is_whisper_agent: isAgent, rdap: isAgent ? await rdap(addr) : null });
}
