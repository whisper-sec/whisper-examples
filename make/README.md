# Whisper Agent Identity - Make (Integromat) app

A [Make](https://www.make.com) custom app that puts the whole Whisper agent identity
surface in your scenarios - **two tiers in one app**, per the Robustness Principle:

| Tier | Needs | Modules |
|------|-------|---------|
| 1 - keyless | nothing | Verify agent identity · Lookup RDAP record · Get transparency log · Get inbound lookups · Get my egress IP · Query security graph (threat posture) · Run a graph recipe (typosquat variants) |
| 2 - keyed | a `whisper_live_…` API key (one Make connection) | Register Agent · List · Set Policy · Get Logs · Get connection (egress) details · Revoke · Run raw Cypher on the security graph |

Every Whisper agent gets a real, routable **IPv6 `/128`** from `2a04:2a01::/32`
(AS219419), anchored in DNS - reverse PTR, forward-confirming AAAA, DNSSEC-signed
DANE-TLSA, and a signed identity document. The keyless tier lets *anyone* check an
address (`is_whisper_agent`, RDAP, tamper-evident transparency log). The keyed tier is
the control plane: mint agents (each with its own `/128` and key), set DNS policy, read
logs, revoke.

**The security graph, too.** *Query security graph* and *Run a graph recipe* hit the Whisper
security graph (3.6B+ nodes of DNS / BGP / threat intelligence) **keyless** - a labelled threat
posture for any host, or the registered typosquats of a brand, with no API key. *Run raw Cypher*
is the keyed escape hatch for any read the named recipes do not cover
([catalog](https://github.com/whisper-sec/whisper-catalog)).

## Use it

The app is live as a private custom app (label **“Whisper Agent Identity”**). Until it
appears in Make's public app directory, install it from an invite link - or push this
source into your own Make account:

```sh
# one-time: create the app shell in your account (Make → Custom apps), note its name,
# then sync every section from this folder:
MAKE_API_TOKEN=<your Make token> ./push.sh <your-app-name> [zone] [version]
```

`push.sh` PUTs `app/base.json`, the connection, the in-product `app/readme.md`, and every
module under `app/modules/` idempotently - the app is live to your organization as soon as
the sections are saved.

## Layout

```
app/
  app.json               # label, description, theme
  base.json              # base URL (https://rdap.whisper.online) + error template
  readme.md              # the in-product readme shown in Make
  connection/            # the API-key connection (validated with a live list call;
                         #   the key is sanitized from Make's logs)
  modules/<name>/        # one folder per module:
    module.json          #   metadata (label, description, keyless ⇔ "connection": null)
    api.json             #   the request template + response/error mapping
    expect.json          #   user-facing fields
    interface.json       #   typed output spec
    samples.json         #   sample output bundle
```

## Design notes

- **Keyless modules carry `"connection": null`** - they run with no connection at all,
  so a key-less user still gets real value (verify / RDAP / transparency / lookups /
  egress-IP). The keyed modules require the one API-key connection.
- **Secrets stay out of scenario history.** The API key is a Make `password` field,
  sanitized from request logs on every keyed module. *Get connection (egress) details*
  **strips** the bearer-embedding fields (`http_proxy`, `connection_string`) by default;
  opting in is explicit and warned.
- **Control-plane results** come back as `columns` + positional `rows`; the frequent
  fields (agent, address, fqdn, ptr, api_key, status) are also mapped to named outputs.
- **Propagation:** a fresh identity is DNS/RDAP-visible everywhere within seconds. If a
  scenario verifies an agent *immediately* after registering it, add a short Sleep
  between the two modules.
- Make scenarios run from Make's own IPs, so agent-sourced **egress happens where you
  run the agent**, not inside Make - *Get my egress IP* makes that visible.

## Proven end-to-end

The shipped app was proven against the live control plane from a real Make scenario run
(register → sleep → verify → RDAP → egress-IP, then revoke - every module exercised):

```
registerAgent  → address 2a04:2a01:9a92:3603:f0d7:1601:e46c:c888   (x-api-key: <your key - redacted>)
dig -x         → af0d…c888.t8b0f…fe9f.agents.whisper.online.
verifyIdentity → is_whisper_agent: true, dane_ok: true, jws_ok: true
lookupRdap     → HTTP 200 (application/rdap+json)
revokeAgent    → status: revoked
dig -x (after) → NXDOMAIN on both authoritatives; RDAP 404; verify false
```

MIT licensed.
