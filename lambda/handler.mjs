// SPDX-License-Identifier: MIT
// Whisper on AWS Lambda (Node, Function URL or API Gateway) - two-tier identity + egress.
// npm i whisper-edge
//
// Tier 1 (keyless): ?addr=<agent /128 or fqdn>
// Tier 2 (keyed):   ?egress=1   - a real fetch out through the agent's routable /128
//                    (set the WHISPER_API_KEY environment variable on the function first)
import { verify, rdap, agentEgress } from "whisper-edge";

export const handler = async (event) => {
  const qs = event?.queryStringParameters ?? {};

  if (qs.egress !== undefined) {
    const apiKey = process.env.WHISPER_API_KEY;
    if (!apiKey) {
      return { statusCode: 400, body: JSON.stringify({ error: "set WHISPER_API_KEY to unlock tier 2 egress" }) };
    }
    const egress = await agentEgress(apiKey);
    try {
      const upstream = await egress.fetch("https://v6.ident.me/");
      const seenIp = (await upstream.text()).trim();
      return {
        statusCode: 200,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          tier: "egress",
          agent: egress.transport,
          seen_ip: seenIp,
          egress_source_header: upstream.headers.get("x-whisper-egress-source"),
          matches_agent_address: seenIp === egress.transport.address,
        }),
      };
    } finally {
      egress.close();
    }
  }

  const addr = qs.addr;
  if (!addr) return { statusCode: 400, body: "usage: ?addr=<agent /128 or fqdn>  |  ?egress=1 (needs WHISPER_API_KEY)" };
  const isAgent = await verify(addr); // keyless
  return {
    statusCode: 200,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ address: addr, is_whisper_agent: isAgent, rdap: isAgent ? await rdap(addr) : null }),
  };
};
