# SPDX-License-Identifier: MIT
# The Whisper security graph on Modal - 3.6B+ nodes of DNS/BGP/threat intelligence,
# queryable from pure stdlib (urllib). No pip packages, no key for the read verbs.
#
#   Tier 1 (keyless):  modal run graph.py --host theblackservicenetwork.com
#                      modal run graph.py --variants paypal.com
#                      The direct read verbs (whisper.assess / identify / variants, ...)
#                      answer with NO key: rate-limited, real answers, zero secrets.
#   Tier 2 (keyed):    WHISPER_API_KEY=whisper_live_... modal run graph.py --typosquat paypal.com
#                      The "typosquat" catalog flow (multi-step brand-impersonation scan).
#                      A key on ANY call lifts the keyless rate limit.
#
# Docs: https://www.whisper.security/docs  ·  catalog: https://github.com/whisper-sec/whisper-catalog
import json
import os

import modal

GRAPH = "https://graph.whisper.security/api/query"
FLOW_RUN = "https://console.whisper.security/api/gallery/run"

app = modal.App("whisper-graph", image=modal.Image.debian_slim())

# The key is optional (Postel): keyless with nothing set; export WHISPER_API_KEY locally and
# it rides into the container as an ad-hoc Secret (or use `modal secret create` + from_name).
_key = os.environ.get("WHISPER_API_KEY")
secrets = [modal.Secret.from_dict({"WHISPER_API_KEY": _key})] if _key else []


def _post(url: str, payload: dict, api_key: str | None) -> tuple[int, str]:
    """POST JSON with stdlib urllib; return (status, body). Never raises on HTTP errors."""
    from urllib.error import HTTPError
    from urllib.request import Request, urlopen

    # A descriptive User-Agent is required: the stock "Python-urllib/x.y" UA is blocked at the
    # edge (Cloudflare 1010). Any honest UA passes - be conservative in what we emit.
    headers = {"content-type": "application/json", "user-agent": "whisper-examples-modal/1.0 (+https://whisper.online)"}
    if api_key:
        headers["x-api-key"] = api_key
    req = Request(url, data=json.dumps(payload).encode(), headers=headers)
    try:
        with urlopen(req, timeout=120) as res:
            return res.status, res.read().decode()
    except HTTPError as e:
        return e.code, e.read().decode()


def _cypher(query: str, parameters: dict, api_key: str | None) -> dict:
    """One parameterised Cypher read. Rows come back as objects keyed by column."""
    status, body = _post(GRAPH, {"query": query, "parameters": parameters}, api_key)
    data = json.loads(body)
    if status >= 400:
        raise RuntimeError(data.get("detail") or data.get("title") or f"graph returned {status}")
    return data  # {columns, rows, statistics}


def _run_flow(slug: str, inputs: dict, api_key: str) -> list[dict]:
    """Run a named catalog FLOW via the gallery runner and fold its SSE stream into steps."""
    status, body = _post(FLOW_RUN, {"slug": slug, "inputs": inputs, "params": {}}, api_key)
    if status >= 400:
        try:
            err = json.loads(body)
            raise RuntimeError(err.get("message") or err.get("detail") or f"flow {slug} returned {status}")
        except json.JSONDecodeError:
            raise RuntimeError(f"flow {slug} returned {status}")
    steps = []
    for block in body.split("\n\n"):
        lines = block.split("\n")
        event = next((l[7:] for l in lines if l.startswith("event: ")), None)
        data = "".join(l[6:] for l in lines if l.startswith("data: "))
        if not data:
            continue
        if event == "error":
            raise RuntimeError(json.loads(data).get("message") or data)
        if event == "step":
            s = json.loads(data)
            steps.append({"step": s.get("id"), "title": s.get("title"), "columns": s.get("columns"), "rows": s.get("rows")})
    return steps


@app.function(secrets=secrets)
def query_graph(host: str = "", variants: str = "", typosquat: str = "") -> dict:
    api_key = os.environ.get("WHISPER_API_KEY")  # optional: keyless works, a key lifts the rate limit

    if host:
        threat = _cypher("CALL whisper.assess($v) YIELD host, label, band, coverage, evidence", {"v": [host]}, api_key)
        vendor = _cypher("CALL whisper.identify($v) YIELD host, canonical_name, category, roles, band", {"v": [host]}, api_key)
        return {"host": host, "threat": threat["rows"], "vendor": vendor["rows"]}

    if variants:
        out = _cypher("CALL whisper.variants($v) YIELD variant, method, exists, confidence", {"v": variants}, api_key)
        return {"domain": variants, "registered_lookalikes": [r for r in out["rows"] if r.get("exists")]}

    if typosquat:
        if not api_key:
            return {"error": "catalog flows are keyed - create the whisper-api Modal Secret (the --host and --variants reads stay keyless)"}
        return {"domain": typosquat, "steps": _run_flow("typosquat", {"domain": typosquat}, api_key)}

    return {"usage": "--host <fqdn|ip> (keyless threat+vendor) | --variants <domain> (keyless look-alikes) | --typosquat <domain> (keyed flow)"}


@app.local_entrypoint()
def main(host: str = "", variants: str = "", typosquat: str = ""):
    result = query_graph.remote(host=host, variants=variants, typosquat=typosquat)
    print(json.dumps(result, indent=2))
    if "error" in result:
        raise SystemExit(1)
