// SPDX-License-Identifier: MIT
// The Whisper security graph on Vercel Functions - 3.6B+ nodes of DNS/BGP/threat
// intelligence, queryable with plain fetch. No dependencies.
//
// Tier 1 (keyless): GET /api/graph?host=<fqdn or IP>   - threat posture + vendor identity
//                   GET /api/graph?variants=<domain>    - registered look-alike domains
//                   The direct read verbs (whisper.assess / identify / variants, ...)
//                   answer with NO key: rate-limited, real answers, zero secrets.
// Tier 2 (keyed):   GET /api/graph?typosquat=<domain>   - the "typosquat" catalog flow
//                   (multi-step brand-impersonation scan). Set WHISPER_API_KEY in the
//                   project's env vars. A key on ANY call lifts the keyless rate limit.
//
// Docs: https://www.whisper.security/docs  ·  catalog: https://github.com/whisper-sec/whisper-catalog

const GRAPH = "https://graph.whisper.security/api/query";
const FLOW_RUN = "https://console.whisper.security/api/gallery/run";
// A descriptive User-Agent: the edge blocks anonymous/scripting UAs, so name every request.
const UA = "whisper-examples/1.0 (+https://whisper.online)";

/** POST one parameterised Cypher read. Rows come back as objects keyed by column. */
async function cypher(query, parameters, apiKey) {
  const res = await fetch(GRAPH, {
    method: "POST",
    headers: { "content-type": "application/json", "user-agent": UA, ...(apiKey ? { "x-api-key": apiKey } : {}) },
    body: JSON.stringify({ query, parameters }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.detail || body.title || `graph returned ${res.status}`);
  return body; // { columns, rows, statistics }
}

/** Run a named catalog FLOW via the gallery runner and fold its SSE stream into steps. */
async function runFlow(slug, inputs, apiKey) {
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

export default async function handler(req, res) {
  const apiKey = process.env.WHISPER_API_KEY; // optional: keyless works, a key lifts the rate limit

  try {
    const host = req.query.host;
    if (host) {
      // Sequential, not parallel: the keyless tier allows only ONE concurrent query, so two
      // in-flight reads would trip "max concurrent queries". A key lifts that limit.
      const threat = await cypher("CALL whisper.assess($v) YIELD host, label, band, coverage, evidence", { v: [host] }, apiKey);
      const vendor = await cypher("CALL whisper.identify($v) YIELD host, canonical_name, category, roles, band", { v: [host] }, apiKey);
      return res.status(200).json({ host, threat: threat.rows, vendor: vendor.rows });
    }

    const brand = req.query.variants;
    if (brand) {
      const out = await cypher(
        "CALL whisper.variants($v) YIELD variant, method, exists, confidence",
        { v: brand },
        apiKey,
      );
      return res.status(200).json({ domain: brand, registered_lookalikes: out.rows.filter((r) => r.exists) });
    }

    const target = req.query.typosquat;
    if (target) {
      if (!apiKey) {
        return res.status(400).json({
          error: "catalog flows are keyed - set WHISPER_API_KEY (the ?host= and ?variants= reads stay keyless)",
        });
      }
      return res.status(200).json({ domain: target, steps: await runFlow("typosquat", { domain: target }, apiKey) });
    }

    return res
      .status(400)
      .send("usage: ?host=<fqdn|ip> (keyless threat+vendor)  |  ?variants=<domain> (keyless look-alikes)  |  ?typosquat=<domain> (keyed flow)");
  } catch (e) {
    // Never an opaque 500: surface the graph's own clear detail.
    return res.status(502).json({ error: e.message });
  }
}
