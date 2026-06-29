// SPDX-License-Identifier: MIT
// Whisper on Vercel Functions - keyless agent-identity verification.  npm i whisper-id
import { verify, rdap } from "whisper-id";

export default async function handler(req, res) {
  const addr = req.query.addr;
  if (!addr) return res.status(400).send("usage: ?addr=<agent /128 or fqdn>");
  const isAgent = await verify(addr); // keyless
  res.status(200).json({ address: addr, is_whisper_agent: isAgent, rdap: isAgent ? await rdap(addr) : null });
}
