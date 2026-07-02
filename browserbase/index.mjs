// SPDX-License-Identifier: MIT
// Whisper on Browserbase — a cloud browser whose traffic leaves from YOUR agent's
// routable Whisper /128, via Browserbase's external-proxy support (BYOP).
//
// Tier 1 (keyless):  node index.mjs verify <agent /128 or fqdn>
//                    — verify + RDAP any Whisper agent identity. No key of any kind.
// Tier 2 (keyed):    node index.mjs
//                    — creates a Browserbase session that tunnels through the Whisper
//                      egress proxy, loads an IPv6 echo, and proves the browser's
//                      public address IS the agent's /128.
//
// Env (tier 2):  BROWSERBASE_API_KEY     your bb_ key            (required)
//                BROWSERBASE_PROJECT_ID  your Browserbase project (required)
//                WHISPER_PROXY_PASS      the agent's egress bearer (required)
//                WHISPER_PROXY_SERVER    default connect.whisper.online:443
//                WHISPER_PROXY_USER      default w
//                WHISPER_AGENT_128       optional — assert the observed IP equals it
import Browserbase from "@browserbasehq/sdk";
import { chromium } from "playwright-core";
import { verify, rdap } from "whisper-edge";

const ECHO_URL = "https://v6.ident.me/"; // IPv6-only echo: returns the caller's address

// ---- Tier 1: keyless verify — works for anyone, no key needed ----------------------
if (process.argv[2] === "verify") {
  const addr = process.argv[3];
  if (!addr) {
    console.error("usage: node index.mjs verify <agent /128 or fqdn>");
    process.exit(2);
  }
  const [isAgent, record] = await Promise.all([
    verify(addr),
    rdap(addr).catch(() => null),
  ]);
  console.log(JSON.stringify({ address: addr, is_whisper_agent: isAgent, rdap: record }, null, 2));
  process.exit(isAgent ? 0 : 1);
}

// ---- Tier 2: keyed egress — the cloud browser leaves from the agent's /128 ---------
const need = (name) => {
  const v = process.env[name];
  if (!v) {
    console.error(`missing ${name} — set it in the environment (never in code).`);
    console.error("keyless tier still works: node index.mjs verify <addr>");
    process.exit(2);
  }
  return v;
};

const apiKey = need("BROWSERBASE_API_KEY");
const projectId = need("BROWSERBASE_PROJECT_ID");
const proxyPass = need("WHISPER_PROXY_PASS");
const proxyServer = process.env.WHISPER_PROXY_SERVER ?? "connect.whisper.online:443";
const proxyUser = process.env.WHISPER_PROXY_USER ?? "w";
const expected = process.env.WHISPER_AGENT_128 ?? null;

const bb = new Browserbase({ apiKey });

// Browserbase validates the proxy at create time (it connects to it), so a valid
// Whisper egress bearer is required here — fail happens at create, not mid-run.
const session = await bb.sessions.create({
  projectId,
  proxies: [
    {
      type: "external",
      server: proxyServer.includes("://") ? proxyServer : `http://${proxyServer}`,
      username: proxyUser,
      password: proxyPass,
    },
  ],
});
console.error(`session ${session.id} (${session.status}) — connecting over CDP…`);

const browser = await chromium.connectOverCDP(session.connectUrl);
try {
  const context = browser.contexts()[0] ?? (await browser.newContext());
  const page = context.pages()[0] ?? (await context.newPage());

  await page.goto(ECHO_URL, { waitUntil: "domcontentloaded", timeout: 60_000 });
  const seenIp = (await page.evaluate(() => document.body.innerText)).trim();

  // Close the loop with the keyless tier: anyone can verify this IP, no key needed.
  const isAgent = await verify(seenIp).catch(() => null);

  const result = {
    tier: "egress",
    session: session.id,
    seen_ip: seenIp,
    is_whisper_agent: isAgent,
    ...(expected && { expected, matches_agent_address: seenIp === expected }),
  };
  console.log(JSON.stringify(result, null, 2));

  if (expected && seenIp !== expected) {
    console.error("FAIL: observed egress IP does not match WHISPER_AGENT_128");
    process.exitCode = 1;
  }
} finally {
  await browser.close();
}
