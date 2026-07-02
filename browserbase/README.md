# Whisper on Browserbase (BYOP)

Give a [Browserbase](https://www.browserbase.com) cloud browser a **real, routable identity**:
point its external-proxy config at the Whisper egress and every page it loads leaves the
internet from **your agent's `/128`** - verifiable by anyone with `dig -x` or RDAP, no key.

```js
const session = await bb.sessions.create({
  projectId,
  proxies: [{ type: "external",
              server: "http://connect.whisper.online:443",
              username: "w",
              password: process.env.WHISPER_PROXY_PASS }], // the agent's egress bearer
});
const browser = await chromium.connectOverCDP(session.connectUrl);
```

Browserbase turns `username`/`password` into a Basic `Proxy-Authorization` header on its
CONNECT to `connect.whisper.online:443` - exactly Whisper's scheme (user `w`, password = the
agent's egress bearer). It validates the proxy at session-creation time, so a bad credential
fails fast at `sessions.create`, never mid-run.

## Tier 1 - keyless verify (works right now, no key)

```
node index.mjs verify <agent /128 or fqdn>
→ { address, is_whisper_agent, rdap }
```

Pure HTTPS via `whisper-edge` - anyone can check whether an address is a Whisper agent and
read its RDAP record. No Whisper key, no Browserbase key.

## Tier 2 - keyed egress (needs your Browserbase key + the agent's egress credential)

```
node index.mjs
→ { tier: "egress", session, seen_ip, is_whisper_agent, expected, matches_agent_address: true }
```

`seen_ip` comes back from `https://v6.ident.me/` loaded **inside the cloud browser** - the
page request left Browserbase through the Whisper egress and sourced from the agent's routable
`/128`, not a datacenter pool IP. The sample then closes the loop with the keyless tier:
`verify(seen_ip)` confirms the observed address is a registered Whisper agent.

Set everything in the environment - never in code, never committed:

```sh
export BROWSERBASE_API_KEY=bb_...          # from the Browserbase dashboard
export BROWSERBASE_PROJECT_ID=...          # your Browserbase project
export WHISPER_PROXY_PASS=...              # the agent's egress bearer (whisper CLI / control plane)
export WHISPER_AGENT_128=2a04:2a01:...     # optional: assert the observed IP equals it
```

Don't have an agent yet? `npx whisper-cli create` (or `whisper.agents({op:'register'})` on the
control plane) provisions one and returns its `/128` + egress credential.

## Run

```
npm i
node index.mjs
```

Note: external proxies are a **paid** Browserbase feature - on the free plan `sessions.create`
with a `proxies` array returns `402 Payment Required`. On a paid plan it just works; the keyless
verify tier works on any plan.

Worth knowing: Browserbase's own egress is **IPv4-only**, so routing a session through the
Whisper proxy is what gives the cloud browser a routable **IPv6** identity at all - on top of
making that address independently verifiable (`dig -x` / RDAP).

Status: **proven end-to-end.** A real Browserbase session routed through the Whisper egress
observed its own agent `/128` (`matches_agent_address: true`, `is_whisper_agent: true`) - the
cloud browser's traffic sourced from the agent's routable Whisper identity. The keyless verify +
RDAP tier is likewise proven live.
