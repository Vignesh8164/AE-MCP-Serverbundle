#!/usr/bin/env node
/**
 * AE MCP Server - HTTP version (Heroku / Azure AI Foundry ready)
 * ================================================================
 *
 * ONE single self-contained Node process that hosts THREE different
 * surfaces on the same port. Splitting them across processes would break
 * the command queue, so everything must run together on Heroku.
 *
 * --------------------------------------------------------------
 * SECTION 1 - FOR AZURE AI FOUNDRY (the LLM brain)
 * --------------------------------------------------------------
 *  Official MCP Streamable HTTP transport (what Foundry actually speaks):
 *     POST   /mcp        -> JSON-RPC requests from the model
 *     GET    /mcp        -> SSE stream for server -> client notifications
 *     DELETE /mcp        -> session termination
 *
 *  Simple REST helpers (handy for curl / Postman tests, and supported as
 *  a fallback by some Foundry-style remote tool integrations):
 *     GET    /tools      -> list all tools
 *     POST   /command    -> { tool, args } -> execute one tool
 *     GET    /health     -> health check
 *     GET    /           -> human-readable index page
 *
 *  In Azure AI Foundry, paste:   <PUBLIC_URL>/mcp
 *  as the Remote MCP Server endpoint.
 *
 * --------------------------------------------------------------
 * SECTION 2 - FOR THE AFTER EFFECTS CEP PANEL (the hands)
 * --------------------------------------------------------------
 *  The CEP panel inside After Effects polls these endpoints, runs the
 *  ExtendScript locally, and posts the result back:
 *     GET    /api/commands/pending     -> panel poll
 *     POST   /api/command/:id/result   -> panel result reporting
 *
 *  Plus the legacy stdio-wrapper compatibility endpoints:
 *     GET    /api/tools
 *     POST   /api/command
 *
 * --------------------------------------------------------------
 * IMPORTANT - what to change in CSXS/mcp-panel.js after deploy
 * --------------------------------------------------------------
 *  Today the panel uses `localhost:3000` (see CSXS/mcp-panel.js around
 *  lines 35-40 and 248). After Heroku deploy you must change the panel's
 *  serverUrl input default (or just type it into the panel UI) to the
 *  Heroku domain WITHOUT scheme, e.g.
 *      ae-mcp-server.herokuapp.com
 *  AND change the two `fetch("http://${serverUrl}/...")` calls to use
 *  `https://` instead of `http://` (Heroku is HTTPS-only).
 *  No other panel code needs to change - the API surface is identical.
 *
 * --------------------------------------------------------------
 * Environment variables
 * --------------------------------------------------------------
 *  PORT                   Heroku-injected port. Default 3000 locally.
 *  SERVER_URL / AE_MCP_URL  Public URL of THIS server (used only for
 *                         logs and the index page so you can copy/paste
 *                         it into Azure Foundry). Default http://localhost:3000.
 *  AE_COMMAND_TIMEOUT_MS  How long /command waits for AE to respond.
 */

import express from "express";
import cors from "cors";
import { randomUUID } from "node:crypto";

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

// --------------------------------------------------------------------------
// Configuration
// --------------------------------------------------------------------------

const PORT = Number(process.env.PORT) || 3000;
const COMMAND_TIMEOUT_MS = Number(process.env.AE_COMMAND_TIMEOUT_MS) || 60000;
// Public URL of this server. Used only for log output and the index page,
// so after `heroku config:set SERVER_URL=https://your-app.herokuapp.com`
// the startup banner shows the exact URL to paste into Azure Foundry.
const SERVER_URL =
  process.env.SERVER_URL ||
  process.env.AE_MCP_URL ||
  `http://localhost:${PORT}`;
const SERVER_NAME = "ae-mcp-server";
const SERVER_VERSION = "1.0.0";
const FOUNDRY_AGENT_RULE =
  "You MUST follow tool descriptions strictly. If a tool says 'ONLY for NEW', never use it for existing items. If a tool says 'ONLY for EXISTING', never use it to create new items. Prefer the most specific matching tool.";

// --------------------------------------------------------------------------
// Tool registry - 102 After Effects tools
// Each tool uses a permissive input schema (additionalProperties: true) so
// LLMs can pass whatever args the underlying ExtendScript handler expects.
// --------------------------------------------------------------------------

const TOOL_DEFS = [
  ["create_composition",          "Create a new composition"],
  ["add_layer",                   "Add a layer to composition"],
  ["modify_property",             "Modify layer property"],
  ["get_active_comp_info",        "Get info about active composition"],
  ["apply_expression",            "Apply expression to layer property"],
  ["add_effect",                  "Add effect to layer"],
  ["set_keyframe",                "Set keyframe on property"],
  ["create_null_and_parent",      "Create null and parent layer"],
  ["render_comp",                 "Add comp to render queue"],
  ["execute_arbitrary_jsx",       "Execute raw ExtendScript (gated)"],
  ["duplicate_layer",             "Duplicate a layer"],
  ["delete_layer",                "Delete a layer"],
  ["set_blend_mode",              "Set blend mode and track matte"],
  ["add_shape_layer",             "Create shape layer"],
  ["set_3d_property",             "Enable 3D and set Z properties"],
  ["batch_modify_property",       "Modify property on multiple layers"],
  ["add_camera",                  "Add a camera layer"],
  ["add_light",                   "Add a light layer"],
  ["apply_preset",                "Apply an animation preset (.ffx)"],
  ["precompose_layers",           "Precompose an array of layer indices"],
  ["set_text_content",            "Set text content of a text layer"],
  ["add_marker",                  "Add a marker to a layer"],
  ["batch_apply_expression",      "Apply an expression to multiple layers"],
  ["set_layer_blend_mode",        "Set layer blend mode"],
  ["duplicate_with_children",     "Duplicate a layer and its children"],
  ["export_as_mogrt",             "Export composition as a MOGRT file"],
  ["create_comp_advanced",        "Create comp with pixel aspect + bg color"],
  ["duplicate_comp",              "Duplicate composition"],
  ["set_comp_work_area",          "Set comp work area start + duration"],
  ["set_comp_background_color",   "Set comp background color [r,g,b]"],
  ["save_project",                "Save current project"],
  ["save_project_as",             "Save project to specific path"],
  ["close_project",               "Close project without saving"],
  ["new_project",                 "Create new empty project"],
  ["add_null_layer",              "Add null with name + position"],
  ["add_shape_layer_advanced",    "Shape with fill/stroke/size/position"],
  ["add_camera_advanced",         "Camera with position/POI/zoom"],
  ["add_light_advanced",          "Light with type/color/intensity"],
  ["set_layer_parent",            "Parent a layer to another (or null)"],
  ["set_layer_3d",                "Toggle 3D on layer"],
  ["set_layer_motion_blur",       "Toggle motion blur on layer"],
  ["lock_layer",                  "Lock/unlock layer"],
  ["shy_layer",                   "Toggle shy flag"],
  ["set_text_content_advanced",   "Text + fontSize/font/justify"],
  ["apply_text_style",            "Apply text style object"],
  ["set_text_fill_color",         "Set text fill color"],
  ["set_text_stroke",             "Set text stroke color + width"],
  ["animate_text_position",       "Animate position from->to over duration"],
  ["apply_text_wiggle",           "Apply wiggle expression to text position"],
  ["add_effect_advanced",         "Add effect + set property values"],
  ["apply_wiggle_smart",          "Wiggle on any property with auto resolve"],
  ["apply_loop_out",              "Apply loopOut(type) expression"],
  ["set_keyframe_ease",           "Set ease in/out on keyframe by index"],
  ["add_marker_advanced",         "Marker w/ duration, chapter, url"],
  ["apply_expression_smart",      "Smart expression apply with group fallback"],
  ["batch_wiggle",                "Apply wiggle to many layers at once"],
  ["create_ramp_effect",          "Add gradient ramp effect to layer"],
  ["add_to_render_queue",         "Add comp to render queue"],
  ["set_render_output",           "Configure output module path/template"],
  ["start_render",                "Start render queue"],
  ["export_frame_as_image",       "Queue single-frame PNG export"],
  ["precompose_with_options",     "Precompose by layer names with options"],
  ["execute_jsx_file",            "Run external .jsx file (gated)"],
  ["get_project_info",            "Project metadata + counts"],
  ["auto_crop",                   "Crop comp to bounding box of all layers"],
  ["curve_editor",                "Set bezier in/out speed+influence on key"],
  ["time_reverse",                "Reverse layer playback via time remap"],
  ["random_layer_order",          "Shuffle layer stacking order"],
  ["auto_sway",                   "Sway rotation expression (sin)"],
  ["anchor_point_tool",           "Move anchor to corner/edge/center, keep position"],
  ["expression_cleanup",          "Strip expressions on layers/properties"],
  ["scale_about_centre",          "Center anchor then scale"],
  ["mask_convertor",              "Convert mask path to shape layer"],
  ["layer_sequencer",             "Sequence layers in time with overlap"],
  ["layer_organizer",             "Sort layer stack by name/time/duration/type"],
  ["wiggle_controller",           "Null + sliders driving wiggle expression"],
  ["property_revealer",           "List animated properties on layer"],
  ["split_by_marker",             "Split layer at every marker"],
  ["centre_anchor",               "Move anchor to layer center"],
  ["quick_search",                "Regex search layer names"],
  ["text_path_tool",              "Bind text layer to mask path"],
  ["effect_browser",              "List common effect match names (filterable)"],
  ["shape_morph",                 "Keyframe morph between two shape layer paths"],
  ["path_trimmer",                "Add Trim Paths with start/end/offset"],
  ["layer_splitter",              "Split layer at specified time"],
  ["marker_manager",              "list/add/delete-all/delete-at markers"],
  ["stroke_caps",                 "Set shape stroke line cap/join/miter"],
  ["duplicate_with_offset",       "Duplicate N times with position+time offset"],
  ["property_shifter",            "Shift all keyframes of property by delta"],
  ["find_replace",                "Regex replace in layer-names or text content"],
  ["easy_ease",                   "Apply easy ease (F9) to keys of property"],
  ["comp_settings",               "Update comp width/height/duration/frameRate/bgColor/name"],
  ["batch_rename",                "Rename layers with prefix/suffix/replaceWith/numbering"],
  ["property_linker",             "Link target property to source via expression"],
  ["distribute_layer",            "Distribute layers along x/y with spacing"],
  ["layer_aligner",               "Align layers (left/right/hcenter/top/bottom/vcenter)"],
  ["text_animator",               "Add text animator (position/scale/rotation/opacity/fillColor)"],
  ["expression_builder",          "Build common expression templates"],
  ["expression_picker",           "Copy expression from source to target property"],
  ["keyframe_copier",             "Copy all keys from source to dest property"],
  ["shape_transfer",              "Copy first shape path from src to dst layer"],
];

const GLOBAL_TOOL_SELECTION_RULES = [
  "Tool Selection Rules:",
  "- Follow this tool description strictly.",
  "- If this tool says ONLY for NEW items, never use it for existing items.",
  "- If this tool says ONLY for EXISTING items, never use it to create new items.",
  "- Prefer the most specific tool over generic alternatives.",
  "- Do not switch tools unless required args are missing or unsupported.",
].join("\n");

const TOOL_DESCRIPTION_OVERRIDES = {
  create_composition:
    "Use ONLY when creating a NEW composition from scratch. Never use for updating existing compositions. Required intent: create a brand-new comp. Typical args: name, width, height, duration, frameRate.",
  create_comp_advanced:
    "Use ONLY when creating a NEW composition from scratch with advanced options (pixel aspect, background color). Never use for updating existing compositions.",
  comp_settings:
    "Use ONLY when updating an EXISTING composition's settings (size, duration, frame rate, bg color, name). Never use for creating new compositions. For new comps use create_composition or create_comp_advanced.",
  add_layer:
    "Use ONLY when adding a NEW layer into an existing composition. Never use for modifying existing layer properties.",
  modify_property:
    "Use ONLY when changing an EXISTING property on an existing layer. Never use for creating new compositions or new layers.",
  apply_expression:
    "Use ONLY when applying a direct expression string to a known layer property. Never use for non-expression property edits.",
  apply_expression_smart:
    "Use ONLY when expression target resolution is ambiguous and smart fallback is required. Prefer apply_expression when exact property target is known.",
  add_effect:
    "Use ONLY when adding a NEW effect to an existing layer. Never use for editing an already-added effect's parameters.",
  add_effect_advanced:
    "Use ONLY when adding a NEW effect and setting initial parameter values in one step. Never use for unrelated layer/property edits.",
  set_keyframe:
    "Use ONLY when creating or updating keyframes on an existing animatable property. Never use for static, non-animated changes.",
  set_keyframe_ease:
    "Use ONLY when adjusting interpolation/ease on EXISTING keyframes. Never use for creating compositions or layers.",
};

function buildStrictToolDescription(name, baseDescription) {
  const lower = String(name || "").toLowerCase();
  const base = String(baseDescription || "").trim();

  if (TOOL_DESCRIPTION_OVERRIDES[name]) {
    return `${GLOBAL_TOOL_SELECTION_RULES}\n\n${TOOL_DESCRIPTION_OVERRIDES[name]}`;
  }

  if (lower.startsWith("create_") || lower.startsWith("new_")) {
    return `${GLOBAL_TOOL_SELECTION_RULES}\n\nUse ONLY when creating a NEW item. Never use this tool for updating existing items. Action: ${base}.`;
  }

  if (lower.startsWith("add_")) {
    return `${GLOBAL_TOOL_SELECTION_RULES}\n\nUse ONLY when adding a NEW item into an existing target. Never use this tool for modifying existing item settings. Action: ${base}.`;
  }

  if (lower.startsWith("set_") || lower.endsWith("_settings") || lower === "comp_settings") {
    return `${GLOBAL_TOOL_SELECTION_RULES}\n\nUse ONLY when updating an EXISTING item. Never use this tool to create new items. Action: ${base}.`;
  }

  if (lower.startsWith("modify_") || lower.startsWith("apply_") || lower.startsWith("animate_") || lower.startsWith("batch_")) {
    return `${GLOBAL_TOOL_SELECTION_RULES}\n\nUse ONLY when modifying EXISTING items or properties. Never use this tool for initial creation when a create/add tool exists. Action: ${base}.`;
  }

  if (lower.startsWith("get_") || lower.includes("search") || lower.includes("browser") || lower.includes("revealer") || lower.includes("info")) {
    return `${GLOBAL_TOOL_SELECTION_RULES}\n\nUse ONLY for read/query/inspection. Never use this tool for mutations. Action: ${base}.`;
  }

  if (lower.startsWith("delete_") || lower.includes("cleanup") || lower.includes("close_project")) {
    return `${GLOBAL_TOOL_SELECTION_RULES}\n\nUse ONLY for destructive/removal operations. Never use this tool for creation or updates. Action: ${base}.`;
  }

  if (lower.startsWith("duplicate_")) {
    return `${GLOBAL_TOOL_SELECTION_RULES}\n\nUse ONLY when cloning existing items. Never use this tool as a substitute for create/add with custom initialization. Action: ${base}.`;
  }

  if (lower.includes("render") || lower.includes("export") || lower.includes("save_project")) {
    return `${GLOBAL_TOOL_SELECTION_RULES}\n\nUse ONLY for output/render/export/save workflows. Never use this tool for structural timeline edits unless explicitly part of render setup. Action: ${base}.`;
  }

  return `${GLOBAL_TOOL_SELECTION_RULES}\n\nUse this tool ONLY for its stated action. Action: ${base}.`;
}

const TOOL_SCHEMAS = {
  create_composition: {
    type: "object",
    properties: {
      name: { type: "string", description: "Composition name" },
      width: { type: "number", description: "Comp width in pixels" },
      height: { type: "number", description: "Comp height in pixels" },
      duration: { type: "number", description: "Duration in seconds" },
      frameRate: { type: "number", description: "Frames per second" },
    },
    required: ["name", "width", "height", "duration"],
    additionalProperties: true,
  },
};

const TOOLS = TOOL_DEFS.map(([name, description]) => ({
  name,
  description: buildStrictToolDescription(name, description),
  inputSchema:
    TOOL_SCHEMAS[name] || {
      type: "object",
      properties: {},
      additionalProperties: true,
    },
}));

const TOOL_NAMES = new Set(TOOLS.map((t) => t.name));

// --------------------------------------------------------------------------
// Command queue (in-memory). Same shape the AE panel already understands.
// --------------------------------------------------------------------------

/** @type {Array<{
 *    id: string,
 *    tool: string,
 *    type: string,
 *    params: any,
 *    status: 'pending' | 'completed' | 'failed',
 *    result?: any,
 *    error?: string,
 *    createdAt: number,
 *    resolve?: (v: any) => void,
 *    reject?: (e: Error) => void,
 *    timer?: any,
 * }> } */
let commandQueue = [];

function enqueueCommand(tool, params) {
  const id = randomUUID();
  const cmd = {
    id,
    tool,
    type: tool,
    params: params || {},
    status: "pending",
    createdAt: Date.now(),
  };
  commandQueue.push(cmd);
  return cmd;
}

function awaitCommand(cmd) {
  return new Promise((resolve, reject) => {
    cmd.resolve = resolve;
    cmd.reject = reject;
    cmd.timer = setTimeout(() => {
      if (cmd.status === "pending") {
        cmd.status = "failed";
        cmd.error = `Timeout after ${COMMAND_TIMEOUT_MS}ms - is the AE CEP panel connected?`;
        reject(new Error(cmd.error));
      }
    }, COMMAND_TIMEOUT_MS);
  });
}

function finalizeCommand(id, status, result, error) {
  const cmd = commandQueue.find((c) => c.id === id);
  if (!cmd) return false;
  if (cmd.timer) clearTimeout(cmd.timer);
  cmd.status = status;
  cmd.result = result;
  cmd.error = error;
  if (status === "completed" && cmd.resolve) cmd.resolve(result);
  if (status === "failed" && cmd.reject) cmd.reject(new Error(error || "failed"));
  return true;
}

// Periodic cleanup of finished commands so the queue does not grow forever.
setInterval(() => {
  const cutoff = Date.now() - 5 * 60 * 1000; // 5 minutes
  commandQueue = commandQueue.filter(
    (c) => c.status === "pending" || c.createdAt > cutoff
  );
}, 60 * 1000).unref?.();

/**
 * Run a tool by queuing it and waiting for the AE panel to report a result.
 * Returns the result payload (whatever AE sent back) or throws on failure.
 */
async function runTool(toolName, args) {
  if (!TOOL_NAMES.has(toolName)) {
    throw new Error(`Unknown tool: ${toolName}`);
  }

  const normalizeNumber = (value, fallback) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  };

  let normalizedArgs = args || {};
  if (toolName === "create_composition") {
    normalizedArgs = {
      ...normalizedArgs,
      name:
        normalizedArgs.name ||
        normalizedArgs.compName ||
        normalizedArgs.compositionName ||
        normalizedArgs.comp_name ||
        "TestComp",
      width: normalizeNumber(
        normalizedArgs.width ?? normalizedArgs.compWidth ?? normalizedArgs.w,
        1920
      ),
      height: normalizeNumber(
        normalizedArgs.height ?? normalizedArgs.compHeight ?? normalizedArgs.h,
        1080
      ),
      duration: normalizeNumber(
        normalizedArgs.duration ?? normalizedArgs.durationSeconds ?? normalizedArgs.seconds,
        10
      ),
      frameRate: normalizeNumber(
        normalizedArgs.frameRate ?? normalizedArgs.fps,
        30
      ),
    };
  }

  const cmd = enqueueCommand(toolName, normalizedArgs);
  return awaitCommand(cmd);
}

// --------------------------------------------------------------------------
// Express app
// --------------------------------------------------------------------------

const app = express();
app.use(cors({ origin: "*", exposedHeaders: ["Mcp-Session-Id"] }));
app.use(express.json({ limit: "5mb" }));

// Lightweight request log (one line per request) - helpful on Heroku.
app.use((req, _res, next) => {
  const t0 = Date.now();
  _res.on("finish", () => {
    const ms = Date.now() - t0;
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} -> ${_res.statusCode} ${ms}ms`);
  });
  next();
});

// =========================================================================
// SECTION 1 - For Azure AI Foundry  (also useful for direct curl tests)
// =========================================================================

// ---------- Health ----------
app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: SERVER_NAME,
    version: SERVER_VERSION,
    publicUrl: SERVER_URL,
    mcpEndpoint: `${SERVER_URL.replace(/\/$/, "")}/mcp`,
    tools: TOOLS.length,
    pendingCommands: commandQueue.filter((c) => c.status === "pending").length,
    aePanelConnected: commandQueue.some((c) => c.status === "pending")
      ? "unknown (commands pending)"
      : "unknown (no traffic yet)",
    uptimeSec: Math.round(process.uptime()),
  });
});

// ---------- Index ----------
app.get("/", (_req, res) => {
  const base = SERVER_URL.replace(/\/$/, "");
  res.type("text/plain").send(
`AE MCP Server (HTTP) - ${SERVER_NAME} v${SERVER_VERSION}
Tools: ${TOOLS.length}
Public URL: ${base}

FOR AZURE AI FOUNDRY
--------------------
  Paste this as the Remote MCP Server endpoint:
     ${base}/mcp

Simple REST (Foundry / curl / Postman):
  GET  /health                       Health check
  GET  /tools                        List tools
  GET  /agent-instructions           Foundry prompt rule to enforce strict tool use
  POST /command                      { tool, args } - run a tool
  POST /mcp                          Official MCP Streamable HTTP transport
  GET  /mcp                          MCP SSE notifications stream
  DELETE /mcp                        MCP session termination

FOR THE AFTER EFFECTS CEP PANEL
-------------------------------
  GET  /api/tools                    Tool list (legacy stdio wrapper)
  POST /api/command                  Queue a command (legacy stdio wrapper)
  GET  /api/commands/pending         Panel poll endpoint
  POST /api/command/:id/result       Panel result reporting

  After Heroku deploy, edit CSXS/mcp-panel.js and change the two
  fetch("http://...") calls to fetch("https://..."), then point the
  panel at: ${base.replace(/^https?:\/\//, "")}
`
  );
});

// ---------- Simple REST (Azure Foundry / curl) ----------
app.get("/tools", (_req, res) => {
  res.json({ tools: TOOLS, count: TOOLS.length });
});

app.get("/agent-instructions", (_req, res) => {
  res.type("text/plain").send(FOUNDRY_AGENT_RULE);
});

app.post("/command", async (req, res) => {
  try {
    const tool = req.body?.tool;
    const args = req.body?.args ?? req.body?.params ?? {};
    if (!tool || typeof tool !== "string") {
      return res.status(400).json({ error: "Body must include { tool: string, args?: object }" });
    }
    if (!TOOL_NAMES.has(tool)) {
      return res.status(404).json({ error: `Unknown tool: ${tool}` });
    }
    const result = await runTool(tool, args);
    res.json({ status: "completed", tool, result });
  } catch (err) {
    res.status(504).json({ status: "failed", error: err?.message || String(err) });
  }
});

// =========================================================================
// SECTION 2 - For the After Effects CEP panel (mcp-panel.js)
// Kept byte-identical to dist/mcp/server.js so the panel needs no rewrite,
// only a URL/scheme change once you deploy to Heroku (see file header).
// =========================================================================
app.get("/api/tools", (_req, res) => {
  res.json({ tools: TOOLS, count: TOOLS.length });
});

app.post("/api/command", (req, res) => {
  const tool = req.body?.tool;
  const params = req.body?.args ?? req.body?.params ?? {};
  const wait = req.body?.wait !== false;

  if (!tool || typeof tool !== "string") {
    return res.status(400).json({ error: "Body must include { tool: string, args?: object }" });
  }
  if (!TOOL_NAMES.has(tool)) {
    return res.status(404).json({ error: `Unknown tool: ${tool}` });
  }

  const cmd = enqueueCommand(tool, params);

  if (!wait) {
    return res.json({ commandId: cmd.id, status: "queued" });
  }

  awaitCommand(cmd)
    .then((result) => res.json({ commandId: cmd.id, status: "completed", result }))
    .catch((err) =>
      res.status(504).json({ commandId: cmd.id, status: "failed", error: err.message })
    );
});

app.get("/api/commands/pending", (_req, res) => {
  const pending = commandQueue
    .filter((c) => c.status === "pending")
    .map((c) => ({ id: c.id, tool: c.tool, type: c.tool, params: c.params }));
  res.json(pending);
});

app.post("/api/command/:id/result", (req, res) => {
  const { id } = req.params;
  const { result, error, status } = req.body || {};
  const finalStatus = status === "failed" ? "failed" : "completed";
  const ok = finalizeCommand(id, finalStatus, result, error);
  res.json({ status: ok ? "ok" : "unknown-id" });
});

// =========================================================================
// SECTION 1 (continued) - Official MCP Streamable HTTP transport at /mcp
// This is what Azure AI Foundry's "Remote MCP server" actually speaks.
// Each new client (no Mcp-Session-Id header) gets a fresh server+transport;
// the SDK assigns a session id which subsequent requests must echo back.
// =========================================================================

function buildMcpServer() {
  const server = new Server(
    { name: SERVER_NAME, version: SERVER_VERSION },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const { name, arguments: args } = req.params;
    try {
      const result = await runTool(name, args || {});
      return {
        content: [
          {
            type: "text",
            text:
              typeof result === "string"
                ? result
                : JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (err) {
      return {
        isError: true,
        content: [{ type: "text", text: `Error: ${err?.message || String(err)}` }],
      };
    }
  });

  return server;
}

// Stateful sessions keyed by Mcp-Session-Id header.
/** @type {Map<string, { server: any, transport: any }>} */
const mcpSessions = new Map();

async function handleMcpRequest(req, res) {
  try {
    // Streamable HTTP transport requires SSE negotiation headers.
    // Some clients omit them, so we normalize here before handing off to the
    // official @modelcontextprotocol/sdk transport.
    const accept = String(req.headers.accept || "");
    if (!/text\/event-stream/i.test(accept)) {
      req.headers.accept = accept
        ? `${accept}, text/event-stream`
        : "text/event-stream";
    }

    if (req.method === "POST" && !req.headers["content-type"]) {
      req.headers["content-type"] = "application/json";
    }

    const sessionId = req.headers["mcp-session-id"];
    let session = sessionId ? mcpSessions.get(sessionId) : undefined;

    if (!session) {
      // Fresh session - the SDK will assign a session id via the response header.
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (sid) => {
          mcpSessions.set(sid, session);
          console.log(`[mcp] session opened: ${sid}`);
        },
      });
      const server = buildMcpServer();
      session = { server, transport };
      await server.connect(transport);

      transport.onclose = () => {
        if (transport.sessionId) {
          mcpSessions.delete(transport.sessionId);
          console.log(`[mcp] session closed: ${transport.sessionId}`);
        }
      };
    }

    await session.transport.handleRequest(req, res, req.body);
  } catch (err) {
    console.error("[mcp] error:", err);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: { code: -32603, message: `Internal error: ${err?.message || String(err)}` },
        id: null,
      });
    }
  }
}

app.post("/mcp", handleMcpRequest);
app.get("/mcp", handleMcpRequest);
app.delete("/mcp", handleMcpRequest);

// --------------------------------------------------------------------------
// 404 + error handlers
// --------------------------------------------------------------------------

app.use((req, res) => {
  res.status(404).json({ error: `Not found: ${req.method} ${req.originalUrl}` });
});

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error("[express] unhandled:", err);
  if (res.headersSent) return;
  res.status(500).json({ error: err?.message || "Internal server error" });
});

// --------------------------------------------------------------------------
// Start
// --------------------------------------------------------------------------

const httpServer = app.listen(PORT, () => {
  const base = SERVER_URL.replace(/\/$/, "");
  const banner = [
    "",
    "==================================================================",
    `  ${SERVER_NAME} v${SERVER_VERSION}  -  HTTP MCP for After Effects`,
    "==================================================================",
    `  Listening on              : 0.0.0.0:${PORT}`,
    `  Public URL (SERVER_URL)   : ${base}`,
    `  Tools registered          : ${TOOLS.length}`,
    "",
    `  >> For Azure AI Foundry, paste this as the Remote MCP endpoint:`,
    `        ${base}/mcp`,
    "",
    `  Simple REST tool list     : GET  ${base}/tools`,
    `  Simple REST execute       : POST ${base}/command   { tool, args }`,
    `  Health check              : GET  ${base}/health`,
    `  AE CEP panel poll URL     : ${base}/api/commands/pending`,
    `  AE CEP panel result URL   : ${base}/api/command/:id/result`,
    "==================================================================",
    "",
  ].join("\n");
  console.log(banner);
});

function shutdown(signal) {
  console.log(`\n[${signal}] shutting down...`);
  httpServer.close(() => {
    console.log("HTTP server closed.");
    process.exit(0);
  });
  // Hard exit if anything hangs.
  setTimeout(() => process.exit(1), 10000).unref?.();
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

process.on("unhandledRejection", (reason) => {
  console.error("[unhandledRejection]", reason);
});
process.on("uncaughtException", (err) => {
  console.error("[uncaughtException]", err);
});
