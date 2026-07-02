# Whisper Identity - OpenAPI (keyless)

`whisper-identity.yaml` describes the **keyless** Whisper identity API (no key): verify an agent,
look up its RDAP record, and read your egress IP.

Import it to build a connector on any low-code platform:
- **Power Platform / Power Automate** - *Custom connector → Import an OpenAPI file*.
- **Zapier** - prefer the native two-tier app in [`zapier/`](../zapier/) (keyless verify + full
  control plane). **Make / Pipedream** - import the OpenAPI (or map the three GET actions).

All three operations are pure HTTPS GETs against `https://rdap.whisper.online`, no authentication.
For agent *creation* / policy (authenticated control plane), use the `whisper` CLI or `whisper-id` SDK.
