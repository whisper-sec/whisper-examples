# Whisper for self-hosted agent platforms

If you self-host your agent platform you control the host, so you get **both halves** of Whisper:

1. **Identity (in-product):** the Whisper **MCP server** - `whisper_verify` + `whisper_rdap` tools,
   keyless. Add it to any MCP-capable platform.
2. **Egress (host):** the Whisper **sidecar** - the platform's containers leave from your `/128`.

Both pieces are the same validated building blocks used everywhere else (the MCP server is listed
in the official [MCP Registry](https://registry.modelcontextprotocol.io) as
`io.github.whisper-sec/whisper`; the sidecar is the official `ghcr.io/whisper-sec/whisper` image).

## 1. Add the Whisper MCP server

**Stdio (most platforms / MCP clients):**
```jsonc
// mcpServers entry - runs the server in a container over stdio
{ "whisper": { "command": "docker", "args": ["run", "-i", "--rm", "ghcr.io/whisper-sec/whisper", "mcp"] } }
```
…or, if the `whisper` CLI is on the host, `{ "command": "whisper", "args": ["mcp"] }`.
…or install from the MCP Registry by name: `io.github.whisper-sec/whisper`.

## 2. Egress from your /128 (sidecar)

Add the sidecar to your platform's `docker-compose.yml` and point the app container at it
(shared network namespace), exactly like the [compose example](../) - or run `whisper init compose`:

```yaml
services:
  whisper:
    image: ghcr.io/whisper-sec/whisper:latest
    command: ["connect", "--agent", "<YOUR-AGENT-/128>"]
    environment: { WHISPER_API_KEY: ${WHISPER_API_KEY:?set it} }
    restart: unless-stopped
  # then on your platform's api/worker service:
  #   network_mode: "service:whisper"      # share the sidecar's netns → egress from the /128
```

## Per-platform notes

| Platform | MCP | Egress |
|----------|-----|--------|
| **Dify** | Add as an MCP tool (Dify supports MCP; use the stdio container, or an HTTP-MCP gateway if you run one) | sidecar on the `api`/`worker` services |
| **RAGFlow** | MCP tool entry (stdio container) | sidecar on the RAGFlow server |
| **Qwen-Agent** | MCP server in the agent's `mcpServers`, or the keyless `whisper-id` Python SDK as a `BaseTool` | `whisper connect` on the host / sidecar |
| **FastGPT** | HTTP tool → the MCP server (stdio container) | sidecar on the FastGPT containers |
| **Coze Studio** | Plugin → MCP server | sidecar |
| **Manus** | Custom MCP server (point Manus at it) | host egress |
| **Google Antigravity** | Add the MCP server + a Whisper skill | host egress |
| **Amp / coding harness** | Add `io.github.whisper-sec/whisper` to the harness's MCP config | host egress |
| **Open-AutoGLM** | identity/control tool (keyless SDK) | server-side egress |

> **Verify it works:** after wiring the sidecar, run `whisper ip` (or `curl https://api64.ipify.org`)
> from inside an app container - it should report a `2a04:2a01:…` **/128**. For the MCP server, your
> platform should list the `whisper_verify` / `whisper_rdap` tools.

These recipes compose validated parts (registry-listed MCP server + proven egress sidecar); the
final wiring is platform-specific - follow your platform's MCP-tool and compose conventions.
