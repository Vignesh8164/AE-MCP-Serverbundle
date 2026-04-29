#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const BASE_URL = process.env.AE_MCP_URL || "http://localhost:3000";
const REQUEST_TIMEOUT_MS = Number(process.env.AE_MCP_TIMEOUT_MS || 60000);

async function fetchJSON(url, opts = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      ...opts,
      signal: controller.signal,
      headers: { "Content-Type": "application/json", ...(opts.headers || {}) },
    });
    const text = await res.text();
    let body;
    try { body = text ? JSON.parse(text) : {}; } catch { body = { raw: text }; }
    if (!res.ok) {
      const msg = body && (body.error || body.message) || `HTTP ${res.status}`;
      throw new Error(msg);
    }
    return body;
  } finally {
    clearTimeout(timer);
  }
}

async function loadTools() {
  const data = await fetchJSON(`${BASE_URL}/api/tools`);
  const list = Array.isArray(data) ? data : data.tools || [];
  return list.map((t) => ({
    name: t.name,
    description: t.description || `AE tool: ${t.name}`,
    inputSchema: t.inputSchema || {
      type: "object",
      properties: {},
      additionalProperties: true,
    },
  }));
}

const server = new Server(
  { name: "ae-mcp-bridge", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  try {
    const tools = await loadTools();
    return { tools };
  } catch (err) {
    process.stderr.write(`[ae-mcp-bridge] tools/list failed: ${err.message}\n`);
    return { tools: [] };
  }
});

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args } = req.params;
  try {
    const data = await fetchJSON(`${BASE_URL}/api/command`, {
      method: "POST",
      body: JSON.stringify({ tool: name, args: args || {}, wait: true }),
    });
    const payload = data && data.result !== undefined ? data.result : data;
    return {
      content: [
        {
          type: "text",
          text:
            typeof payload === "string"
              ? payload
              : JSON.stringify(payload, null, 2),
        },
      ],
    };
  } catch (err) {
    return {
      isError: true,
      content: [{ type: "text", text: `Error: ${err.message}` }],
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write(
    `[ae-mcp-bridge] stdio MCP ready. backend=${BASE_URL}\n`
  );
}

main().catch((err) => {
  process.stderr.write(`[ae-mcp-bridge] fatal: ${err.stack || err.message}\n`);
  process.exit(1);
});
