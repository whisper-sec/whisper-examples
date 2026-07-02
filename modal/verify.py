# SPDX-License-Identifier: MIT
# Whisper on Modal - Tier 1 (keyless): verify + RDAP any Whisper agent identity.
# pip install "whisper-id" happens in the image; no key, no secret, nothing to configure.
#
#   modal run verify.py --addr <agent /128 or fqdn>
import json

import modal

image = modal.Image.debian_slim().pip_install("whisper-id")
app = modal.App("whisper-verify", image=image)


@app.function()
def check_identity(addr: str) -> dict:
    """Is this address a Whisper agent? Pure HTTPS - anyone can ask."""
    import whisper_id

    is_agent = whisper_id.verify(addr)
    return {
        "address": addr,
        "is_whisper_agent": is_agent,
        "rdap": whisper_id.rdap(addr) if is_agent else None,
    }


@app.local_entrypoint()
def main(addr: str):
    result = check_identity.remote(addr)
    print(json.dumps(result, indent=2))
    if not result["is_whisper_agent"]:
        raise SystemExit(1)
