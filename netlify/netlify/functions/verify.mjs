// SPDX-License-Identifier: MIT
// Whisper on Netlify Functions (Web API). npm i whisper-id  ·  netlify deploy
import { verify, rdap } from "whisper-id";

export default async (req) => {
  const addr = new URL(req.url).searchParams.get("addr");
  if (!addr) return new Response("usage: ?addr=<agent /128 or fqdn>\n", { status: 400 });
  const isAgent = await verify(addr); // keyless
  return Response.json({ address: addr, is_whisper_agent: isAgent, rdap: isAgent ? await rdap(addr) : null });
};
