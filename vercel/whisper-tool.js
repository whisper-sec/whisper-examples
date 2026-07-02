// SPDX-License-Identifier: MIT
// Two Vercel AI SDK tools: let an LLM verify a Whisper agent identity (keyless) and, with a
// key, egress a real HTTP request through the agent's routable /128. Pairs with `ai`'s `tool()`.
//   import { tool } from "ai"; import { z } from "zod";
//   import { whisperVerifyTool, whisperEgressTool } from "./whisper-tool.js";
import { verify, verifyDetails, agentEgress } from "whisper-edge";

export const whisperVerifyTool = {
  description: "Verify that an IPv6 address (or FQDN) is a real Whisper agent identity (DANE+DNSSEC+reverse-DNS+JWS). Keyless.",
  // parameters: use your schema lib, e.g. z.object({ address: z.string() })
  parameters: { type: "object", properties: { address: { type: "string" } }, required: ["address"] },
  execute: async ({ address }) => {
    const details = await verifyDetails(address);
    return { is_whisper_agent: await verify(address), details };
  },
};

export const whisperEgressTool = {
  description:
    "Fetch a URL so the request leaves from the caller's Whisper agent /128 instead of Vercel's IP. " +
    "Needs the WHISPER_API_KEY environment variable — the LLM never sees the key.",
  parameters: { type: "object", properties: { url: { type: "string" } }, required: ["url"] },
  execute: async ({ url }) => {
    const apiKey = process.env.WHISPER_API_KEY;
    if (!apiKey) return { error: "WHISPER_API_KEY is not set — tier 2 egress is unavailable" };
    const egress = await agentEgress(apiKey);
    try {
      const res = await egress.fetch(url);
      return { status: res.status, egress_address: egress.transport.address, body: await res.text() };
    } finally {
      egress.close();
    }
  },
};
