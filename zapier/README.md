# Whisper on Zapier

A native Zapier integration for [Whisper](https://whisper.online) - give every agent a real,
routable IPv6 identity and govern it from a Zap. Built with the Zapier Platform CLI.

**Two tiers, one app** (Postel's Law - auth is optional):

| Tier | Needs | Steps |
|------|-------|-------|
| 1 - keyless | nothing (leave the key blank) | **Verify Agent Identity**, **RDAP Lookup**, **Get Egress IP** |
| 2 - control plane | your `whisper_live_…` API key | **New Agent** (trigger), **Register Agent**, **Find Agents**, **Set DNS Policy**, **Get Agent Logs**, **Get Egress Config**, **Revoke Agent** |

A Zap can mint a real agent - `Register Agent` returns its routable `/128`, FQDN, reverse
DNS, and the agent's own API key (once) - then any keyless step (or anyone on the internet)
can verify that identity: DANE + JWS evidence via `Verify Agent Identity`.

## Use it

Search for **Whisper Agent Identity** in the Zap editor. When connecting, either leave the
API key blank (keyless verify tier) or paste your `whisper_live_…` key (full control plane).

## Run your own copy

```bash
cd zapier && npm install
zapier register "Whisper Agent Identity" -a private -y   # once
zapier push
```

`npm test` runs the offline unit tests (Cypher builder, envelope decoder, secret scrub);
`zapier validate` checks the app; `zapier invoke` runs any step locally (auth data in `.env`,
e.g. `api_key=whisper_live_…` - never commit it).

## Notes

- **Secret hygiene.** Zap task data is persisted, so `Get Egress Config` strips every
  bearer/private-key field before returning. For live egress from the `/128`, pair the Zap
  with the `whisper` CLI or the [`whisper-edge`](https://www.npmjs.com/package/whisper-edge)
  SDK on a host you control.
- **Wire format.** Control calls are `CALL whisper.agents({op, args})` POSTed to
  `https://graph.whisper.security/api/query` with the key in `X-API-Key` - args rendered as
  a deterministic Cypher literal (sorted keys, quote-doubling), both response envelope
  shapes accepted. Keyless calls are plain GETs against `https://rdap.whisper.online`.
- Prefer raw HTTP? The keyless surface is also published as an
  [OpenAPI spec](../openapi/).

MIT licensed.
