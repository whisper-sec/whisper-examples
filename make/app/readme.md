# Whisper Agent Identity

Every Whisper agent gets a real, routable **IPv6 /128 identity** — allocated from
`2a04:2a01::/32` (AS219419, viaGraph B.V.) and anchored in DNS (reverse PTR,
forward-confirming AAAA, DNSSEC-signed DANE-TLSA, and a signed identity document).

This app is **two tiers in one**:

- **Keyless** — no account, credentials, or API key. Read the public identity surface at
  `https://rdap.whisper.online`.
- **Keyed** — add a Whisper **API key** connection to unlock the control plane at
  `https://graph.whisper.security`: create, govern, and revoke your own agents.

## Keyless modules (no connection)

- **Verify agent identity** — run the full verification chain server-side for one IPv6
  address (reverse PTR → forward-confirm AAAA → DANE-TLSA pin → signed identity document)
  and get a single verdict: is this a real Whisper agent, its canonical hostname, its
  operator, and the supporting evidence.
- **Lookup RDAP record** — the RDAP (RFC 9082/9083) IP-network record for an agent /128:
  handle, name, registrant entity, status, country, events, and related links.
- **Get transparency log** — the public, append-only, tamper-evident issuance/revocation
  feed for an agent /128, hash-chained and signed (ES256) with a Merkle ledger proof.
- **Get inbound lookups** — the feed of who has resolved or queried an agent's name
  (PTR / AAAA / TLSA / RDAP), each row k-anonymised to the source prefix.
- **Get my egress IP** — the public IP this call reaches Whisper from, as seen by the
  Whisper edge. Scenario steps run from Make's own addresses, so this shows a Make IP —
  agent-sourced egress happens where you run the agent, not inside Make.

## Keyed modules (require the Whisper API key connection)

Create one **Whisper API key** connection and paste your `whisper_live_…` owner key. The
key is stored encrypted by Make and sent only to the Whisper control plane over TLS; it is
never logged.

- **Register Agent** — mint a new agent with its own routable /128 and its own API key
  (returned once — capture it). Needs `admin:dns` scope.
- **Set Policy** — set your tenant's DNS resolver policy: default action (allow/block),
  block/allow domain lists, and named posture bundles. Replaces the whole policy each call.
- **Get Logs** — recent per-tenant activity (DNS, connections, allocations), optionally
  narrowed to one agent, kind, and time window.
- **List** — list your fleet: agents, identities, or DNS records.
- **Revoke** — fully and irreversibly revoke an agent (withdraws its /128, PTR, tokens, key).
- **Get connection (egress) details** — allocate or reuse an agent's SOCKS5 egress on its
  routable /128 and return the endpoint, resolver, and DoH details. The bearer-embedding
  credential fields are **stripped by default**; opt in only if you accept that they become
  part of the scenario's execution history.

## Notes

- A **negative verify** (not a Whisper agent) and an **RDAP miss** come back as HTTP 404;
  Make surfaces these as a clear, handled error carrying the reason — attach an error
  handler (or set the module to *Resume*) to treat "not an agent" as a normal branch.
- The **transparency** and **lookups** feeds always return a result (empty for an unknown
  address). Iterate their arrays downstream.
- Control-plane results are returned as `columns` + positional `rows` (each row aligned to
  `columns`). **Register** and **Revoke** also expose named fields directly. Iterate `rows`
  with an Iterator downstream for the multi-row modules (**List**, **Get Logs**).

Learn more: <https://whisper.online> · RDAP service: <https://rdap.whisper.online>
