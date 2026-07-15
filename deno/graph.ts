// SPDX-License-Identifier: MIT
// The Whisper security graph on Deno Deploy - 3.6B+ nodes of DNS/BGP/threat intelligence,
// queryable with plain fetch. No dependencies.
// Local: `deno run --allow-net --allow-env graph.ts`  ·  Deploy: `deno deploy`
//
// Tier 1 (keyless): GET /?host=<fqdn or IP>     - threat posture + vendor identity
//                   GET /?variants=<domain>      - registered look-alike domains
//                   The direct read verbs (whisper.assess / identify / variants, ...)
//                   answer with NO key: rate-limited, real answers, zero secrets.
// Tier 2 (keyed):   GET /?typosquat=<domain>     - the "typosquat" catalog flow (multi-step
//                   brand-impersonation scan). Set WHISPER_API_KEY as an env var.
//                   A key on ANY call lifts the keyless rate limit.
//
// Docs: https://www.whisper.security/docs  ·  catalog: https://github.com/whisper-sec/whisper-catalog

const GRAPH = "https://graph.whisper.security/api/query";
const FLOW_RUN = "https://console.whisper.security/api/gallery/run";
// A descriptive User-Agent: the edge blocks anonymous/scripting UAs, so name every request.
const UA = "whisper-examples/1.0 (+https://whisper.online)";

interface GraphEnvelope {
  columns: string[];
  rows: Record<string, unknown>[];
  statistics?: Record<string, unknown>;
}

interface FlowStep {
  step: string;
  title: string;
  columns?: string[];
  rows?: Record<string, unknown>[];
}

/** POST one parameterised Cypher read. Rows come back as objects keyed by column. */
async function cypher(query: string, parameters: Record<string, unknown>, apiKey?: string): Promise<GraphEnvelope> {
  const res = await fetch(GRAPH, {
    method: "POST",
    headers: { "content-type": "application/json", "user-agent": UA, ...(apiKey ? { "x-api-key": apiKey } : {}) },
    body: JSON.stringify({ query, parameters }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.detail || body.title || `graph returned ${res.status}`);
  return body as GraphEnvelope;
}

/** Run a named catalog FLOW via the gallery runner and fold its SSE stream into steps. */
async function runFlow(slug: string, inputs: Record<string, string>, apiKey: string): Promise<FlowStep[]> {
  const res = await fetch(FLOW_RUN, {
    method: "POST",
    headers: { "content-type": "application/json", "user-agent": UA, "x-api-key": apiKey },
    body: JSON.stringify({ slug, inputs, params: {} }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || body.detail || `flow ${slug} returned ${res.status}`);
  }
  const steps: FlowStep[] = [];
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

async function handle(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const apiKey = Deno.env.get("WHISPER_API_KEY"); // optional: keyless works, a key lifts the rate limit

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
}

// Never an opaque 500: whatever goes wrong, answer with a clear, actionable error.
Deno.serve(async (req: Request) => {
  try {
    return await handle(req);
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 502 });
  }
});
