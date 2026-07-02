# SPDX-License-Identifier: MIT
# Whisper on AWS Lambda (Python) - two-tier identity + egress.
#
# Uses the public `whisper-id-egress` layer (whisper-id + requests + PySocks,
# pure Python, python3.12/3.13, x86_64 + arm64) - see README.md for the ARN.
#
# Tier 1 (keyless): ?addr=<agent /128 or fqdn> - verify + RDAP, no credentials.
# Tier 2 (keyed):   ?egress=1 - a real HTTPS fetch that leaves the network from
#                   your agent's routable Whisper /128, not Lambda's IP.
#
# Environment (tier 2 only - set on the function, never in code):
#   WHISPER_EGRESS       https://w:<egress-token>@connect.whisper.online:443
#   WHISPER_FORWARD_URL  https://forward.whisper.online   (fallback gateway, optional)
#   WHISPER_AGENT        your agent's /128 (optional - enables matches_agent_address)
import base64
import json
import os
import time
from urllib.parse import urlsplit

import requests
import whisper_id

ECHO = "https://v6.ident.me"  # answers with the caller's IPv6


def _reply(status, body):
    return {
        "statusCode": status,
        "headers": {"content-type": "application/json"},
        "body": json.dumps(body),
    }


def _via_connect_proxy(proxy_url):
    """CONNECT through the Whisper egress proxy (TLS-in-TLS; token stays inside TLS).

    A freshly minted egress token can take a moment to reach every anycast node,
    so a 407 from the proxy is retried for ~50s before giving up.
    """
    proxies = {"http": proxy_url, "https": proxy_url}
    last = None
    for _ in range(6):
        try:
            r = requests.get(ECHO, proxies=proxies, timeout=20)
            if r.status_code == 200:
                return r.text.strip(), r.headers.get("x-whisper-egress-source")
            last = f"HTTP {r.status_code} from echo"
            if r.status_code == 429:
                time.sleep(int(r.headers.get("retry-after", "8")))
                continue
            break
        except requests.exceptions.RequestException as exc:  # includes ProxyError(407)
            last = str(exc)
            time.sleep(8)
    raise RuntimeError(f"connect-proxy egress failed: {last}")


def _via_forward_gateway(forward_url, user, token):
    """One-hop fallback: POST the fetch to the Whisper forward gateway."""
    auth = base64.b64encode(f"{user}:{token}".encode()).decode()
    last = None
    for _ in range(6):
        r = requests.post(
            forward_url.rstrip("/") + "/forward",
            headers={"Authorization": f"Basic {auth}", "X-Whisper-Target": ECHO,
                     "X-Whisper-Method": "GET"},
            timeout=20,
        )
        if r.status_code == 200:
            return r.text.strip(), r.headers.get("x-whisper-egress-source")
        last = f"HTTP {r.status_code} from forward gateway"
        if r.status_code in (407, 429):  # token still propagating / rate limited
            time.sleep(int(r.headers.get("retry-after", "8")))
            continue
        break
    raise RuntimeError(f"forward-gateway egress failed: {last}")


def handler(event, context=None):
    qs = (event or {}).get("queryStringParameters") or event or {}

    # ---- Tier 2: keyed egress -------------------------------------------------
    if qs.get("egress") is not None:
        proxy_url = os.environ.get("WHISPER_EGRESS")
        if not proxy_url:
            return _reply(400, {"error": "set WHISPER_EGRESS to unlock tier 2 egress"})
        method = "connect-proxy"
        try:
            seen, src = _via_connect_proxy(proxy_url)
        except Exception as exc:
            forward = os.environ.get("WHISPER_FORWARD_URL")
            if not forward:
                return _reply(502, {"error": str(exc)})
            method = "forward-gateway"
            parts = urlsplit(proxy_url)
            try:
                seen, src = _via_forward_gateway(forward, parts.username or "w",
                                                 parts.password or "")
            except Exception as exc2:
                return _reply(502, {"error": f"{exc} | {exc2}"})
        expected = os.environ.get("WHISPER_AGENT")
        return _reply(200, {
            "tier": "egress",
            "method": method,
            "seen_ip": seen,
            "egress_source_header": src,
            "is_whisper_agent": whisper_id.verify(seen),
            "expected": expected,
            "matches_agent_address": (seen == expected) if expected else None,
        })

    # ---- Tier 1: keyless verify -----------------------------------------------
    addr = qs.get("addr")
    if not addr:
        return _reply(400, {"usage": "?addr=<agent /128 or fqdn>  |  ?egress=1 (needs WHISPER_EGRESS)"})
    is_agent = whisper_id.verify(addr)
    return _reply(200, {
        "address": addr,
        "is_whisper_agent": is_agent,
        "rdap": whisper_id.rdap(addr) if is_agent else None,
    })
