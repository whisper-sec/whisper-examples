// SPDX-License-Identifier: MIT
// Whisper on Supabase Edge Functions (Deno). supabase functions deploy verify
import { verify, rdap } from "npm:whisper-id@^0.2.0";

Deno.serve(async (req: Request) => {
  const addr = new URL(req.url).searchParams.get("addr");
  if (!addr) return new Response("usage: ?addr=<agent /128 or fqdn>\n", { status: 400 });
  const isAgent = await verify(addr); // keyless
  return Response.json({ address: addr, is_whisper_agent: isAgent, rdap: isAgent ? await rdap(addr) : null });
});
