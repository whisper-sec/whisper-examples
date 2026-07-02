# Whisper on Modal

Give a [Modal](https://modal.com) function a **real, routable identity**: route its outbound
requests through the Whisper egress and they leave the internet from **your agent's `/128`** -
verifiable by anyone with `dig -x` or RDAP, no key.

This is the Python sample of the repo. The container installs the PyPI
[`whisper-id`](https://pypi.org/project/whisper-id/) SDK straight in the image -
`modal.Image.debian_slim().pip_install("whisper-id")` - no CLI, no daemon, stateless.

## Tier 1 - keyless verify (works right now, no key)

```sh
pip install modal && modal setup     # once
modal run verify.py --addr <agent /128 or fqdn>
→ { "address", "is_whisper_agent", "rdap" }
```

Pure HTTPS via `whisper-id` - anyone can check whether an address is a Whisper agent and read
its RDAP record. No Whisper key, no Modal Secret, nothing to configure.

## Tier 2 - keyed egress (needs the agent's egress credential)

```sh
modal secret create whisper-egress \
  WHISPER_PROXY_URL='https://w:<egress bearer>@connect.whisper.online:443' \
  WHISPER_AGENT_128='2a04:2a01:...'   # optional: assert the observed IP equals it

modal run egress.py
→ { "tier": "egress", "seen_ip", "is_whisper_agent": true, "expected", "matches_agent_address": true }
```

`seen_ip` comes back from `https://v6.ident.me` fetched **inside the Modal function** - the
request left Modal through the Whisper egress and sourced from the agent's routable `/128`,
not Modal's IP pool. The sample then closes the loop with the keyless tier:
`whisper_id.verify(seen_ip)` confirms the observed address is a registered Whisper agent.

The egress endpoint speaks HTTP CONNECT over TLS - `requests`/`urllib3` (and `curl --proxy`)
handle the `https://user:pass@host:443` proxy form natively, so tier 2 is still pure
`pip install`, zero extra machinery. The bearer lives only in the Modal Secret - never in code,
never in the image, never in a committed file.

Don't have an agent yet? `npx whisper-cli create` (or `whisper.agents({op:'register'})` on the
control plane) provisions one and returns its `/128` + egress credential - or, from Python,
`whisper_id.register("my-agent")` with `WHISPER_API_KEY` set.

## Worth knowing

- **Two files by design.** `modal run` hydrates *every* function in an app - Secrets included -
  so a single-file sample would make the keyless tier fail for users who haven't created the
  secret yet. One file per tier keeps tier 1 truly zero-config.
- Modal containers don't allow WireGuard (no `NET_ADMIN`), so the routed tunnel form of a
  Whisper identity stays off Modal. The egress proxy is the mechanism here - and it needs
  nothing but the Secret.

Status: **proven end-to-end.** A real `modal run` fetched the IPv6 echo through the Whisper
egress and observed the agent's own `/128` (`matches_agent_address: true`,
`is_whisper_agent: true`); the keyless verify + RDAP tier is likewise proven live from a
Modal container.
