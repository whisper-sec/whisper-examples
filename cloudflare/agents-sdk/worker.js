// SPDX-License-Identifier: MIT
// A Cloudflare Agents SDK (Durable Object) MCP server exposing the Whisper tools.
// Connect any MCP client (an Agents SDK `this.mcp.connect(url)`, the MCP Inspector, a chat app)
// to  https://<your-worker>/mcp  (streamable HTTP)  or  /sse  (legacy SSE).
import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerWhisperTools } from "./whisper-mcp.js";

export class WhisperMcp extends McpAgent {
  server = new McpServer({ name: "whisper", version: "1.0.0" });

  async init() {
    registerWhisperTools(this.server, this.env);
  }
}

export default {
  async fetch(request, env, ctx) {
    const { pathname } = new URL(request.url);
    if (pathname.startsWith("/sse")) return WhisperMcp.serveSSE("/sse").fetch(request, env, ctx);
    if (pathname.startsWith("/mcp")) return WhisperMcp.serve("/mcp").fetch(request, env, ctx);
    return new Response("whisper mcp: connect an MCP client to /mcp (streamable HTTP) or /sse\n", { status: 404 });
  },
};
