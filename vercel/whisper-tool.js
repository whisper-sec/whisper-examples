// SPDX-License-Identifier: MIT
// A Vercel AI SDK tool: let an LLM verify a Whisper agent identity. Pairs with `ai`'s `tool()`.
//   import { tool } from "ai"; import { z } from "zod"; import { whisperVerifyTool } from "./whisper-tool.js";
import { verify, verifyDetails } from "whisper-id";

export const whisperVerifyTool = {
  description: "Verify that an IPv6 address (or FQDN) is a real Whisper agent identity (DANE+DNSSEC+reverse-DNS+JWS).",
  // parameters: use your schema lib, e.g. z.object({ address: z.string() })
  parameters: { type: "object", properties: { address: { type: "string" } }, required: ["address"] },
  execute: async ({ address }) => {
    const details = await verifyDetails(address);
    return { is_whisper_agent: (await verify(address)), details };
  },
};
