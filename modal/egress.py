# SPDX-License-Identifier: MIT
# Whisper on Modal - Tier 2 (keyed): the function's outbound traffic leaves the
# internet from YOUR agent's routable /128, via the Whisper egress proxy.
#
# One-time setup (the bearer lives only in a Modal Secret, never in code):
#   modal secret create whisper-egress \
#     WHISPER_PROXY_URL='https://w:<egress bearer>@connect.whisper.online:443' \
#     WHISPER_AGENT_128='2a04:2a01:...'   # optional: assert the observed IP equals it
#
# Run:
#   modal run egress.py
import json
import os

import modal

image = modal.Image.debian_slim().pip_install("whisper-id", "requests")
app = modal.App("whisper-egress", image=image)

ECHO_URL = "https://v6.ident.me"  # IPv6 echo: returns the caller's public address


@app.function(secrets=[modal.Secret.from_name("whisper-egress")])
def check_egress() -> dict:
    """Fetch through the Whisper egress - the request sources from the agent's /128."""
    import requests
    import whisper_id

    # https://w:<egress bearer>@connect.whisper.online:443 - HTTP CONNECT over TLS,
    # spoken natively by requests/urllib3 (and curl --proxy).
    proxy = os.environ["WHISPER_PROXY_URL"]
    seen_ip = requests.get(
        ECHO_URL, proxies={"http": proxy, "https": proxy}, timeout=30
    ).text.strip()
    expected = os.environ.get("WHISPER_AGENT_128")
    return {
        "tier": "egress",
        "seen_ip": seen_ip,
        "is_whisper_agent": whisper_id.verify(seen_ip),  # close the loop, keyless
        **({"expected": expected, "matches_agent_address": seen_ip == expected} if expected else {}),
    }


@app.local_entrypoint()
def main():
    result = check_egress.remote()
    print(json.dumps(result, indent=2))
    if not result["is_whisper_agent"] or result.get("matches_agent_address") is False:
        raise SystemExit(1)
