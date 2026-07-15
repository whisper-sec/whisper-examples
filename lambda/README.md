# Whisper on AWS Lambda

Give any Lambda a real, verifiable Whisper agent identity - and make its outbound
traffic leave from the agent's routable IPv6 `/128`, not Lambda's IP.

## The public layer - zero bundling (Python)

```
arn:aws:lambda:eu-north-1:205639151085:layer:whisper-id-egress:1
```

One public MIT layer bundling [`whisper-id`](https://pypi.org/project/whisper-id/) +
`requests` + `PySocks`. Pure Python - the same layer works on **python3.12 and 3.13,
x86_64 and arm64**. Attach it and `import whisper_id` just works:

```bash
aws lambda update-function-configuration --function-name my-fn \
  --layers arn:aws:lambda:eu-north-1:205639151085:layer:whisper-id-egress:1
```

(Layers attach within their region; from another region, copy it once -
`aws lambda get-layer-version-by-arn …` then `publish-layer-version` in yours - or just
vendor the three pip packages.)

## The handler - `handler.py`

Two tiers, per Postel:

**Tier 1 - keyless verify (no credentials at all):**

```
{"addr": "<agent /128 or fqdn>"}   or   GET ?addr=…
→ { address, is_whisper_agent, rdap }
```

`whisper_id.verify()` runs the full server-side trust chain (DANE + DNSSEC +
reverse-DNS + JWS) over one HTTPS GET - works in any runtime, no CLI, no key.

**Tier 2 - keyed egress (your traffic, your `/128`):**

```
{"egress": "1"}   or   GET ?egress=1
→ { tier: "egress", seen_ip, is_whisper_agent, matches_agent_address: true }
```

`seen_ip` comes back from `https://v6.ident.me` fetched **through** the Whisper egress
proxy - the request left AWS from your agent's routable `/128`. The proxy URL is an
`https://` scheme proxy (TLS-in-TLS), so the egress token travels inside TLS end to end.
A freshly minted token is retried on 407 while it propagates across anycast nodes, and
the forward gateway (`WHISPER_FORWARD_URL`) is the automatic one-hop fallback.

## Deploy

```bash
zip function.zip handler.py
aws lambda create-function --function-name whisper-egress \
  --runtime python3.12 --architectures arm64 \
  --role <your-lambda-exec-role-arn> --handler handler.handler --timeout 120 \
  --layers arn:aws:lambda:eu-north-1:205639151085:layer:whisper-id-egress:1 \
  --zip-file fileb://function.zip \
  --environment 'Variables={WHISPER_EGRESS=https://w:<egress-token>@connect.whisper.online:443,WHISPER_FORWARD_URL=https://forward.whisper.online,WHISPER_AGENT=<your /128>}'

aws lambda invoke --function-name whisper-egress \
  --cli-binary-format raw-in-base64-out --payload '{"egress":"1"}' out.json && cat out.json
```

Mint the agent + egress token with the control plane (`pip install whisper-id`, then
`whisper_id.register()` / the `whisper` CLI - `curl get.whisper.online | sh`). Put the
token in the function environment (or Secrets Manager), **never** in code.

Environment (tier 2 only):

| Variable | Value |
|---|---|
| `WHISPER_EGRESS` | `https://w:<egress-token>@connect.whisper.online:443` |
| `WHISPER_FORWARD_URL` | `https://forward.whisper.online` (fallback, optional) |
| `WHISPER_AGENT` | your agent's `/128` (optional - enables `matches_agent_address`) |

Status: **proven end-to-end on a real Lambda** (python3.12, arm64, eu-north-1) - a live
invoke fetched the v6 echo through the Whisper proxy and the observed IP was exactly the
agent's `/128` (`matches_agent_address: true`), with the keyless verify tier confirmed
from inside the same function.

## Node instead?

`handler.mjs` is the same two-tier recipe on the npm
[`whisper-edge`](https://www.npmjs.com/package/whisper-edge) SDK - `npm i whisper-edge`,
zip with `node_modules`, Node 18+ runtime, set `WHISPER_API_KEY` for the egress tier.

## Also here: query the security graph

[`graph.mjs`](graph.mjs) is a **zero-dependency** Node handler (no layer, no bundling) that
queries the Whisper security graph (3.6B+ nodes of DNS / BGP / threat intelligence):

```
?host=<fqdn|ip>     -> keyless: threat posture + operator identity
?variants=<domain>  -> keyless: registered look-alike domains
?typosquat=<domain> -> keyed:   the "typosquat" catalog flow (set WHISPER_API_KEY)
```

The direct read verbs answer keyless (no credentials); raw Cypher and the catalog flows unlock
with a key. Deploy it exactly like `handler.mjs` but with `--handler graph.handler` on a
`nodejs18.x`+ runtime - no layer needed.
