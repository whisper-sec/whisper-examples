// SPDX-License-Identifier: MIT
// Whisper on Deno Deploy — two-tier agent identity + egress at the edge.
// Deploy: `deno deploy` (or connect the repo in the Deno Deploy dashboard)
// Local:  `deno run --allow-net --allow-env main.ts`
//
// Tier 1 (keyless): GET /?addr=<agent /128 or fqdn>
// Tier 2 (keyed):   GET /?egress=1   — a real fetch out through the agent's routable /128
//   Unlock it with EITHER credential (set as a Deno Deploy env var, never in code):
//     WHISPER_API_KEY        your owner key — one call, the SDK provisions the transport; or
//     WHISPER_EGRESS_BEARER  a pre-provisioned egress bearer (`et_…` from `op:connect`) —
//                            least privilege: the edge function never holds the owner key.
//                            Optional companions: WHISPER_AGENT_128 (the expected source /128),
//                            WHISPER_FORWARD_URL (self-host / pre-prod gateway override).
import { agentEgress, DEFAULT_FORWARD_URL, forwardFetch, rdap, rdapDomain, verify } from "npm:whisper-edge@^0.3.1";

interface Egress {
  fetch: typeof fetch;
  transport: Record<string, unknown>;
  expected: string | null;
  close(): void;
}

/** Build the tier-2 egress from whichever credential the environment offers. */
async function openEgress(): Promise<Egress | null> {
  const apiKey = Deno.env.get("WHISPER_API_KEY");
  if (apiKey) {
    const egress = await agentEgress(apiKey);
    return { fetch: egress.fetch, transport: { ...egress.transport }, expected: egress.transport.address, close: () => egress.close() };
  }
  const bearer = Deno.env.get("WHISPER_EGRESS_BEARER");
  if (bearer) {
    const expected = Deno.env.get("WHISPER_AGENT_128") ?? null;
    const user = Deno.env.get("WHISPER_PROXY_USER") ?? "w";
    // Preferred on full Deno (local, and the current Deno Deploy): the runtime's native
    // CONNECT-proxy client — every fetch tunnels through the Whisper proxy and leaves
    // from the agent's /128. One object, no extra hop.
    if (typeof Deno.createHttpClient === "function") {
      try {
        const server = Deno.env.get("WHISPER_PROXY_SERVER") ?? "connect.whisper.online:443";
        const client = Deno.createHttpClient({
          proxy: { url: `http://${server}`, basicAuth: { username: user, password: bearer } },
        });
        const f = ((input: RequestInfo | URL, init?: RequestInit) =>
          fetch(input, { ...init, client })) as typeof fetch;
        return {
          fetch: f,
          transport: { mechanism: "CONNECT proxy (Deno.createHttpClient)", tokenProtected: false },
          expected,
          close: () => client.close(),
        };
      } catch { /* no raw sockets here — fall through to the forward gateway */ }
    }
    // Universal fallback (fetch-only sandboxes, Deno Deploy Classic): the fetch-forward
    // gateway — one HTTPS hop, sourced from the /128, bearer protected inside TLS.
    // Liberal in what we accept: the override may or may not already carry the /forward path.
    const base = Deno.env.get("WHISPER_FORWARD_URL") ?? DEFAULT_FORWARD_URL;
    const forwardUrl = base.endsWith("/forward") ? base : `${base.replace(/\/+$/, "")}/forward`;
    const f = forwardFetch(`Basic ${btoa(`${user}:${bearer}`)}`, { forwardUrl });
    return {
      fetch: f,
      transport: { mechanism: "fetch-forward gateway (pre-provisioned bearer)", tokenProtected: true },
      expected,
      close: () => {},
    };
  }
  return null;
}

// IP echoes, tried in order — one flaky echo service must never fail the demo (RFC 761).
// A fixed allowlist, never a caller-supplied target: this handler's credential must not
// become an open proxy.
const ECHOES: Array<{ url: string; ip: (body: string) => string | null }> = [
  { url: "https://rdap.whisper.online/egress-ip", ip: (b) => JSON.parse(b).ip ?? null },
  { url: "https://www.cloudflare.com/cdn-cgi/trace", ip: (b) => b.match(/^ip=(.+)$/m)?.[1] ?? null },
  { url: "https://v6.ident.me/", ip: (b) => b.trim() || null },
];

async function handle(req: Request): Promise<Response> {
  const url = new URL(req.url);

  if (url.searchParams.has("egress")) {
    const egress = await openEgress();
    if (!egress) {
      return Response.json(
        { error: "set WHISPER_API_KEY (owner key) or WHISPER_EGRESS_BEARER (egress token) to unlock tier 2 egress" },
        { status: 400 },
      );
    }
    try {
      let lastError = "no echo service reachable";
      for (const echo of ECHOES) {
        try {
          const upstream = await egress.fetch(echo.url);
          const body = await upstream.text();
          if (!upstream.ok) {
            lastError = `${echo.url} → ${upstream.status}`;
            continue;
          }
          const seenIp = echo.ip(body);
          if (!seenIp) {
            lastError = `${echo.url} → unparseable body`;
            continue;
          }
          return Response.json({
            tier: "egress",
            agent: egress.transport,
            echo: echo.url,
            seen_ip: seenIp,
            egress_source_header: upstream.headers.get("x-whisper-egress-source"),
            matches_agent_address: egress.expected !== null && seenIp === egress.expected,
          });
        } catch (e) {
          lastError = `${echo.url} → ${e instanceof Error ? e.message : String(e)}`;
        }
      }
      return Response.json({ tier: "egress", error: lastError }, { status: 502 });
    } finally {
      egress.close();
    }
  }

  const addr = url.searchParams.get("addr");
  if (!addr) {
    return new Response(
      "usage: ?addr=<agent /128 or fqdn>  |  ?egress=1 (needs WHISPER_API_KEY or WHISPER_EGRESS_BEARER)\n",
      { status: 400 },
    );
  }
  const isAgent = await verify(addr); // keyless: no CLI, no key
  return Response.json({
    address: addr,
    is_whisper_agent: isAgent,
    // Liberal in what we accept: an IPv6 /128 or an agent fqdn, each via its RDAP class.
    rdap: isAgent ? (addr.includes(":") ? await rdap(addr) : await rdapDomain(addr)) : null,
  });
}

// Never an opaque 500: whatever goes wrong, answer with a clear, actionable error.
Deno.serve(async (req: Request) => {
  try {
    return await handle(req);
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 502 });
  }
});
