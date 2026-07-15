// SPDX-License-Identifier: MIT
// The Whisper security graph on Supabase Edge Functions (Deno) - 3.6B+ nodes of
// DNS/BGP/threat intelligence, queryable with plain fetch. No dependencies.
// Deploy: `supabase functions deploy graph --no-verify-jwt`
//
// Tier 1 (keyless): ?host=<fqdn or IP>     - threat posture + vendor identity
//                   ?variants=<domain>      - registered look-alike domains
//                   The direct read verbs (whisper.assess / identify / variants, ...)
//                   answer with NO key: rate-limited, real answers, zero secrets.
// Tier 2 (keyed):   ?typosquat=<domain>     - the "typosquat" catalog flow (multi-step
//                   brand-impersonation scan). `supabase secrets set WHISPER_API_KEY=...`
//                   A key on ANY call lifts the keyless rate limit.
//
// Docs: https://www.whisper.security/docs  ·  catalog: https://github.com/whisper-sec/whisper-catalog

const GRAPH = "https://graph.whisper.security/api/query";
const FLOW_RUN = "https://console.whisper.security/api/gallery/run";
// A descriptive User-Agent: the edge blocks anonymous/scripting UAs, so name every request.
const UA = "whisper-examples/1.0 (+https://whisper.online)";

/** POST one parameterised Cypher read. Rows come back as objects keyed by column. */
async function cypher(query: string, parameters: Record<string, unknown>, apiKey?: string) {
  const res = await fetch(GRAPH, {
    method: "POST",
    headers: { "content-type": "application/json", "user-agent": UA, ...(apiKey ? { "x-api-key": apiKey } : {}) },
    body: JSON.stringify({ query, parameters }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.detail || body.title || `graph returned ${res.status}`);
  return body as { columns: string[]; rows: Record<string, unknown>[] };
}

/** Run a named catalog FLOW via the gallery runner and fold its SSE stream into steps. */
async function runFlow(slug: string, inputs: Record<string, string>, apiKey: string) {
  const res = await fetch(FLOW_RUN, {
    method: "POST",
    headers: { "content-type": "application/json", "user-agent": UA, "x-api-key": apiKey },
    body: JSON.stringify({ slug, inputs, params: {} }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || body.detail || `flow ${slug} returned ${res.status}`);
  }
  const steps = [];
  for (const block of (await res.text()).split("\n\n")) {
    const event = block.match(/^event: (.+)$/m)?.[1];
    const data = block.split("\n").filter((l) => l.startsWith("data: ")).map((l) => l.slice(6)).join("");
    if (!data) continue;
    if (event === "error") throw new Error(JSON.parse(data).message || data);
    if (event === "step") {
      const s = JSON.parse(data);
      steps.push({ step: s.id, title: s.title, columns: s.columns, rows: s.rows });
    }
  }
  return steps;
}

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const apiKey = Deno.env.get("WHISPER_API_KEY"); // optional: keyless works, a key lifts the rate limit

  try {
    const host = url.searchParams.get("host");
    if (host) {
      // Sequential, not parallel: the keyless tier allows only ONE concurrent query, so two
      // in-flight reads would trip "max concurrent queries". A key lifts that limit.
      const threat = await cypher("CALL whisper.assess($v) YIELD host, label, band, coverage, evidence", { v: [host] }, apiKey);
      const vendor = await cypher("CALL whisper.identify($v) YIELD host, canonical_name, category, roles, band", { v: [host] }, apiKey);
      return Response.json({ host, threat: threat.rows, vendor: vendor.rows });
    }

    const brand = url.searchParams.get("variants");
    if (brand) {
      const out = await cypher(
        "CALL whisper.variants($v) YIELD variant, method, exists, confidence",
        { v: brand },
        apiKey,
      );
      return Response.json({ domain: brand, registered_lookalikes: out.rows.filter((r) => r.exists) });
    }

    const target = url.searchParams.get("typosquat");
    if (target) {
      if (!apiKey) {
        return Response.json(
          { error: "catalog flows are keyed - set WHISPER_API_KEY (the ?host= and ?variants= reads stay keyless)" },
          { status: 400 },
        );
      }
      return Response.json({ domain: target, steps: await runFlow("typosquat", { domain: target }, apiKey) });
    }

    return new Response(
      "usage: ?host=<fqdn|ip> (keyless threat+vendor)  |  ?variants=<domain> (keyless look-alikes)  |  ?typosquat=<domain> (keyed flow)\n",
      { status: 400 },
    );
  } catch (e) {
    // Never an opaque 500: surface the graph's own clear detail.
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 502 });
  }
});
