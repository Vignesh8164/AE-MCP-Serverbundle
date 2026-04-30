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
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

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
const ASSIGNED_TIMEOUT_MS = Number(process.env.AE_ASSIGNED_TIMEOUT_MS) || 30000;
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
const DEBUG_LOG_ENABLED = process.env.AE_DEBUG_LOG !== "false";
const COMMAND_AUDIT_LIMIT = Number(process.env.AE_COMMAND_AUDIT_LIMIT || 200);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

function parseToolArgHintsFromJsx() {
  const jsxPath = path.join(__dirname, "jsx", "ae-bridge.jsx");
  if (!fs.existsSync(jsxPath)) {
    return {};
  }

  const source = fs.readFileSync(jsxPath, "utf8");
  const dispatchMatch = source.match(/function\s+dispatchCommand\(command,\s*params\)\s*\{([\s\S]*?)\n\}/);
  if (!dispatchMatch) {
    return {};
  }

  const block = dispatchMatch[1];
  const hintMap = {};
  const casePattern = /case\s+"([^"]+)":\s*\n\s*return\s+[^(]+\(([^)]*)\);/g;
  let match;

  while ((match = casePattern.exec(block))) {
    const tool = match[1];
    const argList = match[2]
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean)
      .map((entry) => {
        const token = entry.match(/^params\.([A-Za-z0-9_]+)/);
        return token ? token[1] : entry;
      });
    hintMap[tool] = argList;
  }

  return hintMap;
}

const TOOL_ARG_HINTS = parseToolArgHintsFromJsx();

const STRICT_REQUIRED_FIELDS = {
  create_composition: ["name", "width", "height", "duration"],
  add_layer: ["compName", "layerName", "layerType"],
  modify_property: ["compName", "layerName", "property", "value"],
  apply_expression: ["layerName", "propertyName", "expression"],
  add_effect: ["layerName", "effectMatchName"],
  set_keyframe: ["layerName", "propertyName", "timeInSeconds", "value"],
  render_comp: ["compName"],
  set_text_content: ["layerName", "text"],
  set_comp_background_color: ["compName", "color"],
  add_to_render_queue: ["compName"],
  set_render_output: ["compName"],
  execute_arbitrary_jsx: ["jsxCode"],
  marker_manager: ["action"],
  comp_settings: ["compName"],
};

function inferSchemaForParam(paramName) {
  const name = String(paramName || "");
  const lower = name.toLowerCase();

  if (!name) return {};

  if (
    lower === "layernames" ||
    lower === "propertynames" ||
    lower === "layerindices"
  ) {
    const itemType = lower === "layerindices" ? "number" : "string";
    return {
      type: "array",
      items: { type: itemType },
      description: `${name} list`,
    };
  }

  if (lower.endsWith("color") || lower.includes("position") || lower.includes("point")) {
    return {
      type: "array",
      items: { type: "number" },
      description: `${name} numeric array`,
    };
  }

  if (
    lower.startsWith("is") ||
    lower.startsWith("has") ||
    lower.startsWith("enable") ||
    lower.startsWith("lock") ||
    lower.startsWith("shy") ||
    lower.includes("casesensitive") ||
    lower.includes("opennewcomp") ||
    lower.includes("moveallattributes")
  ) {
    return { type: "boolean", description: name };
  }

  if (
    lower.includes("width") ||
    lower.includes("height") ||
    lower.includes("duration") ||
    lower.includes("time") ||
    lower.includes("rate") ||
    lower.includes("fps") ||
    lower.includes("index") ||
    lower.includes("count") ||
    lower.includes("size") ||
    lower.includes("zoom") ||
    lower.includes("opacity") ||
    lower.includes("rotation") ||
    lower.includes("amount") ||
    lower.includes("frequency") ||
    lower.includes("influence") ||
    lower.includes("speed") ||
    lower.includes("percent") ||
    lower.includes("offset") ||
    lower.includes("intensity") ||
    lower.includes("miter") ||
    lower.includes("pixelaspect") ||
    lower.includes("strokewidth") ||
    lower.includes("number")
  ) {
    return { type: "number", description: name };
  }

  if (
    lower === "settings" ||
    lower === "style" ||
    lower === "propertyvalues" ||
    lower === "params"
  ) {
    return { type: "object", additionalProperties: true, description: name };
  }

  if (lower === "value") {
    return { description: "Property value" };
  }

  return { type: "string", description: name };
}

function buildSchemaFromHints(toolName) {
  const argHints = TOOL_ARG_HINTS[toolName] || [];
  const properties = {};
  argHints.forEach((arg) => {
    properties[arg] = inferSchemaForParam(arg);
  });

  return {
    type: "object",
    properties,
    required: STRICT_REQUIRED_FIELDS[toolName] || [],
    additionalProperties: true,
  };
}

const TOOL_SCHEMAS = TOOL_DEFS.reduce((acc, [toolName]) => {
  acc[toolName] = buildSchemaFromHints(toolName);
  return acc;
}, {});

TOOL_SCHEMAS.create_composition = {
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

const COMMAND_ALIASES = {
  create_text_layer: "__macro_create_text_layer",
  get_active_comp: "get_active_comp_info",
  set_text_layer_content: "set_text_content",
  render_composition: "render_comp",
};

const commandAuditLog = [];

function pushCommandAudit(event, payload) {
  const entry = {
    ts: new Date().toISOString(),
    event,
    payload: sanitizeForLog(payload),
  };
  commandAuditLog.push(entry);
  if (commandAuditLog.length > COMMAND_AUDIT_LIMIT) {
    commandAuditLog.splice(0, commandAuditLog.length - COMMAND_AUDIT_LIMIT);
  }
}

function sanitizeForLog(value, depth = 0) {
  if (depth > 3) return "[max-depth]";
  if (value === null || value === undefined) return value;
  if (typeof value === "string") {
    return value.length > 500 ? `${value.slice(0, 500)}...[truncated]` : value;
  }
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) {
    const arr = value.slice(0, 20).map((v) => sanitizeForLog(v, depth + 1));
    if (value.length > 20) arr.push(`[+${value.length - 20} more]`);
    return arr;
  }
  if (typeof value === "object") {
    const out = {};
    const keys = Object.keys(value).slice(0, 30);
    keys.forEach((k) => {
      out[k] = sanitizeForLog(value[k], depth + 1);
    });
    if (Object.keys(value).length > 30) {
      out.__truncated = `+${Object.keys(value).length - 30} more keys`;
    }
    return out;
  }
  return String(value);
}

function logEvent(level, event, payload = {}) {
  if (!DEBUG_LOG_ENABLED && level === "debug") return;
  const line = {
    ts: new Date().toISOString(),
    level,
    event,
    ...sanitizeForLog(payload),
  };
  const serialized = JSON.stringify(line);
  if (level === "error") {
    console.error(serialized);
  } else if (level === "warn") {
    console.warn(serialized);
  } else {
    console.log(serialized);
  }
}

function coerceNumber(value, fallback = undefined) {
  if (value === null || value === undefined || value === "") return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function coerceBoolean(value, fallback = undefined) {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  const normalized = String(value).trim().toLowerCase();
  if (["true", "1", "yes", "y", "on"].includes(normalized)) return true;
  if (["false", "0", "no", "n", "off"].includes(normalized)) return false;
  return fallback;
}

function coerceNumberArray(value) {
  if (Array.isArray(value)) {
    return value.map((v) => Number(v)).filter((v) => Number.isFinite(v));
  }
  if (typeof value === "string") {
    return value
      .split(",")
      .map((v) => Number(v.trim()))
      .filter((v) => Number.isFinite(v));
  }
  return value;
}

function coerceStringArray(value) {
  if (Array.isArray(value)) {
    return value.map((v) => String(v));
  }
  if (typeof value === "string") {
    return value
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);
  }
  return value;
}

function normalizeValueByName(name, value) {
  const lower = String(name || "").toLowerCase();

  if (lower === "layernames" || lower === "propertynames") {
    return coerceStringArray(value);
  }
  if (lower === "layerindices") {
    return coerceNumberArray(value);
  }
  if (lower.endsWith("color") || lower.includes("position") || lower.includes("point")) {
    return coerceNumberArray(value);
  }
  if (
    lower.startsWith("is") ||
    lower.startsWith("has") ||
    lower.startsWith("enable") ||
    lower.startsWith("lock") ||
    lower.startsWith("shy") ||
    lower.includes("casesensitive") ||
    lower.includes("opennewcomp") ||
    lower.includes("moveallattributes")
  ) {
    return coerceBoolean(value, value);
  }
  if (
    lower.includes("width") ||
    lower.includes("height") ||
    lower.includes("duration") ||
    lower.includes("time") ||
    lower.includes("rate") ||
    lower.includes("fps") ||
    lower.includes("index") ||
    lower.includes("count") ||
    lower.includes("size") ||
    lower.includes("zoom") ||
    lower.includes("opacity") ||
    lower.includes("rotation") ||
    lower.includes("amount") ||
    lower.includes("frequency") ||
    lower.includes("influence") ||
    lower.includes("percent") ||
    lower.includes("offset") ||
    lower.includes("intensity") ||
    lower.includes("miter") ||
    lower.includes("pixelaspect") ||
    lower.includes("strokewidth") ||
    lower.includes("number")
  ) {
    return coerceNumber(value, value);
  }
  return value;
}

function normalizeArgs(toolName, args) {
  const input = args && typeof args === "object" ? args : {};
  const normalized = {};

  Object.entries(input).forEach(([key, value]) => {
    normalized[key] = normalizeValueByName(key, value);
  });

  if (toolName === "create_composition") {
    normalized.name =
      normalized.name ||
      normalized.compName ||
      normalized.compositionName ||
      normalized.comp_name ||
      "TestComp";
    normalized.width = coerceNumber(normalized.width ?? normalized.compWidth ?? normalized.w, 1920);
    normalized.height = coerceNumber(normalized.height ?? normalized.compHeight ?? normalized.h, 1080);
    normalized.duration = coerceNumber(
      normalized.duration ?? normalized.durationSeconds ?? normalized.seconds,
      10
    );
    normalized.frameRate = coerceNumber(normalized.frameRate ?? normalized.fps, 30);
  }

  return normalized;
}

function validateArgs(toolName, args) {
  const schema = TOOL_SCHEMAS[toolName] || { required: [], properties: {} };
  const required = Array.isArray(schema.required) ? schema.required : [];
  const missing = required.filter((field) => {
    const value = args[field];
    return value === undefined || value === null || value === "";
  });

  if (missing.length > 0) {
    return { valid: false, errors: missing.map((field) => `Missing required field: ${field}`) };
  }

  const typeErrors = [];
  const properties = schema.properties || {};
  Object.entries(properties).forEach(([field, fieldSchema]) => {
    if (!fieldSchema || !fieldSchema.type || !(field in args)) return;
    const value = args[field];
    if (value === undefined || value === null) return;

    if (fieldSchema.type === "array" && !Array.isArray(value)) {
      typeErrors.push(`Field ${field} must be array`);
      return;
    }
    if (fieldSchema.type === "object" && (typeof value !== "object" || Array.isArray(value))) {
      typeErrors.push(`Field ${field} must be object`);
      return;
    }
    if (fieldSchema.type === "string" && typeof value !== "string") {
      typeErrors.push(`Field ${field} must be string`);
      return;
    }
    if (fieldSchema.type === "number" && typeof value !== "number") {
      typeErrors.push(`Field ${field} must be number`);
      return;
    }
    if (fieldSchema.type === "boolean" && typeof value !== "boolean") {
      typeErrors.push(`Field ${field} must be boolean`);
    }
  });

  if (typeErrors.length > 0) {
    return { valid: false, errors: typeErrors };
  }

  return { valid: true, errors: [] };
}

function parseCommandEnvelope(payload) {
  const body = payload && typeof payload === "object" ? payload : {};
  if (typeof body.action === "string") {
    return { action: body.action, params: body.params || {}, protocol: "action" };
  }
  if (typeof body.tool === "string") {
    return { action: body.tool, params: body.args ?? body.params ?? {}, protocol: "tool" };
  }
  if (body.command && typeof body.command === "object") {
    return parseCommandEnvelope(body.command);
  }
  throw new Error("Invalid command envelope. Use { action, params } or { tool, args }.");
}

function expandActionToCommands(action, params) {
  const resolved = COMMAND_ALIASES[action] || action;
  const safeParams = params && typeof params === "object" ? params : {};

  if (resolved === "__macro_create_text_layer") {
    const compName =
      safeParams.compName ||
      safeParams.compositionName ||
      safeParams.composition ||
      safeParams.comp;
    if (!compName) {
      throw new Error("create_text_layer requires params.compName (or compositionName)");
    }
    if (!safeParams.text) {
      throw new Error("create_text_layer requires params.text");
    }
    const layerName = safeParams.layerName || `Text_${Date.now()}`;
    const commands = [
      {
        tool: "add_layer",
        params: { compName, layerName, layerType: "text" },
      },
      {
        tool: "set_text_content",
        params: { layerName, text: safeParams.text },
      },
    ];

    if (Array.isArray(safeParams.position)) {
      commands.push({
        tool: "modify_property",
        params: {
          compName,
          layerName,
          property: "position",
          value: safeParams.position,
        },
      });
    }

    return commands;
  }

  if (!TOOL_NAMES.has(resolved)) {
    throw new Error(`Unknown action/tool: ${action}`);
  }

  return [{ tool: resolved, params: safeParams }];
}

function toExecutionPlan(payload) {
  const { action, params, protocol } = parseCommandEnvelope(payload);
  const expanded = expandActionToCommands(action, params);
  const commands = expanded.map((item) => {
    const normalizedParams = normalizeArgs(item.tool, item.params);
    const validation = validateArgs(item.tool, normalizedParams);
    if (!validation.valid) {
      throw new Error(`Validation failed for ${item.tool}: ${validation.errors.join("; ")}`);
    }
    return { tool: item.tool, params: normalizedParams };
  });
  return { action, protocol, commands };
}

// --------------------------------------------------------------------------
// Command queue (in-memory). Same shape the AE panel already understands.
// --------------------------------------------------------------------------

/** @type {Array<{
 *    id: string,
 *    traceId: string,
 *    source: string,
 *    tool: string,
 *    type: string,
 *    params: any,
 *    jsxPreview?: string,
 *    status: 'pending' | 'assigned' | 'completed' | 'failed',
 *    result?: any,
 *    error?: string,
 *    debug?: any,
 *    createdAt: number,
 *    assignedAt?: number,
 *    completedAt?: number,
 *    resolve?: (v: any) => void,
 *    reject?: (e: Error) => void,
 *    timer?: any,
 * }> } */
let commandQueue = [];

function buildJsxPreview(tool, params) {
  if (tool === "execute_arbitrary_jsx" && params && typeof params.jsxCode === "string") {
    return params.jsxCode.slice(0, 500);
  }
  const snippet = `JSON.stringify(dispatchCommand(${JSON.stringify(tool)}, ${JSON.stringify(params || {})}))`;
  return snippet.length > 500 ? `${snippet.slice(0, 500)}...[truncated]` : snippet;
}

function enqueueCommand(tool, params, meta = {}) {
  const id = randomUUID();
  const cmd = {
    id,
    traceId: meta.traceId || randomUUID(),
    source: meta.source || "unknown",
    tool,
    type: tool,
    params: params || {},
    jsxPreview: buildJsxPreview(tool, params),
    status: "pending",
    createdAt: Date.now(),
  };
  commandQueue.push(cmd);
  pushCommandAudit("command_queued", {
    id: cmd.id,
    traceId: cmd.traceId,
    source: cmd.source,
    tool: cmd.tool,
    params: cmd.params,
    jsxPreview: cmd.jsxPreview,
  });
  logEvent("info", "command_queued", {
    commandId: cmd.id,
    traceId: cmd.traceId,
    source: cmd.source,
    tool: cmd.tool,
  });
  return cmd;
}

function awaitCommand(cmd) {
  return new Promise((resolve, reject) => {
    cmd.resolve = resolve;
    cmd.reject = reject;
    cmd.timer = setTimeout(() => {
      if (cmd.status === "pending" || cmd.status === "assigned") {
        cmd.status = "failed";
        cmd.error = `Timeout after ${COMMAND_TIMEOUT_MS}ms - is the AE CEP panel connected?`;
        cmd.completedAt = Date.now();
        pushCommandAudit("command_timeout", {
          id: cmd.id,
          traceId: cmd.traceId,
          tool: cmd.tool,
          error: cmd.error,
        });
        logEvent("error", "command_timeout", {
          commandId: cmd.id,
          traceId: cmd.traceId,
          tool: cmd.tool,
          error: cmd.error,
        });
        reject(new Error(cmd.error));
      }
    }, COMMAND_TIMEOUT_MS);
  });
}

function recoverStuckAssignedCommands(now = Date.now()) {
  let recovered = 0;

  commandQueue.forEach((cmd) => {
    if (cmd.status !== "assigned") {
      return;
    }

    const assignedAt = Number(cmd.assignedAt || 0);
    if (!assignedAt || now - assignedAt <= ASSIGNED_TIMEOUT_MS) {
      return;
    }

    if (cmd.timer) {
      clearTimeout(cmd.timer);
    }

    cmd.status = "failed";
    cmd.error = `Assigned command timed out after ${ASSIGNED_TIMEOUT_MS}ms without ACK`;
    cmd.completedAt = now;

    pushCommandAudit("command_assigned_timeout", {
      id: cmd.id,
      traceId: cmd.traceId,
      tool: cmd.tool,
      assignedAt,
      completedAt: cmd.completedAt,
      error: cmd.error,
    });
    logEvent("error", "command_assigned_timeout", {
      commandId: cmd.id,
      traceId: cmd.traceId,
      tool: cmd.tool,
      assignedAt,
      completedAt: cmd.completedAt,
      error: cmd.error,
    });

    if (cmd.reject) {
      cmd.reject(new Error(cmd.error));
    }

    recovered += 1;
  });

  return recovered;
}

function assignPendingCommands(now = Date.now()) {
  const assigned = [];

  commandQueue.forEach((cmd) => {
    if (cmd.status !== "pending") {
      return;
    }

    cmd.status = "assigned";
    cmd.assignedAt = now;
    assigned.push(cmd);

    pushCommandAudit("command_assigned", {
      id: cmd.id,
      traceId: cmd.traceId,
      source: cmd.source,
      tool: cmd.tool,
      assignedAt: cmd.assignedAt,
    });
    logEvent("info", "command_assigned", {
      commandId: cmd.id,
      traceId: cmd.traceId,
      source: cmd.source,
      tool: cmd.tool,
      assignedAt: cmd.assignedAt,
    });
  });

  return assigned;
}

function finalizeCommand(id, status, result, error, debug) {
  const cmd = commandQueue.find((c) => c.id === id);
  if (!cmd) return false;
  if (cmd.timer) clearTimeout(cmd.timer);
  cmd.status = status;
  cmd.result = result;
  cmd.error = error;
  cmd.debug = debug;
  cmd.completedAt = Date.now();
  pushCommandAudit("command_completed", {
    id: cmd.id,
    traceId: cmd.traceId,
    tool: cmd.tool,
    status,
    error,
    result,
    debug,
  });
  logEvent(status === "failed" ? "error" : "info", "command_completed", {
    commandId: cmd.id,
    traceId: cmd.traceId,
    tool: cmd.tool,
    status,
    error,
  });
  if (status === "completed" && cmd.resolve) cmd.resolve(result);
  if (status === "failed" && cmd.reject) cmd.reject(new Error(error || "failed"));
  return true;
}

// Periodic cleanup of finished commands so the queue does not grow forever.
setInterval(() => {
  recoverStuckAssignedCommands(Date.now());
  const cutoff = Date.now() - 5 * 60 * 1000; // 5 minutes
  commandQueue = commandQueue.filter(
    (c) => c.status === "pending" || c.status === "assigned" || (c.completedAt || c.createdAt) > cutoff
  );
}, 60 * 1000).unref?.();

/**
 * Run a tool by queuing it and waiting for the AE panel to report a result.
 * Returns the result payload (whatever AE sent back) or throws on failure.
 */
async function runToolWithMeta(toolName, args, meta = {}) {
  if (!TOOL_NAMES.has(toolName)) {
    throw new Error(`Unknown tool: ${toolName}`);
  }

  const normalizedArgs = normalizeArgs(toolName, args || {});
  const validation = validateArgs(toolName, normalizedArgs);
  if (!validation.valid) {
    throw new Error(`Validation failed for ${toolName}: ${validation.errors.join("; ")}`);
  }

  const cmd = enqueueCommand(toolName, normalizedArgs, meta);
  const result = await awaitCommand(cmd);
  return { commandId: cmd.id, result };
}

async function runTool(toolName, args, meta = {}) {
  const execution = await runToolWithMeta(toolName, args, meta);
  return execution.result;
}

async function executePlannedCommands(plan, options = {}) {
  const wait = options.wait !== false;
  const source = options.source || "rest";
  const traceId = options.traceId || randomUUID();
  const results = [];

  for (const item of plan.commands) {
    if (!wait) {
      const queued = enqueueCommand(item.tool, item.params, { traceId, source });
      results.push({
        commandId: queued.id,
        status: "queued",
        tool: item.tool,
      });
      continue;
    }

    const execution = await runToolWithMeta(item.tool, item.params, { traceId, source });
    results.push({
      commandId: execution.commandId,
      status: "completed",
      tool: item.tool,
      result: execution.result,
    });
  }

  return {
    traceId,
    action: plan.action,
    protocol: plan.protocol,
    commands: plan.commands.map((c) => ({ tool: c.tool, params: c.params })),
    results,
  };
}

const AZURE_OPENAI_CONFIG = {
  endpoint: process.env.AZURE_OPENAI_ENDPOINT,
  apiKey: process.env.AZURE_OPENAI_API_KEY,
  deployment: process.env.AZURE_OPENAI_DEPLOYMENT,
  apiVersion: process.env.AZURE_OPENAI_API_VERSION || "2024-10-21",
};

function isAzureConfigured() {
  return Boolean(
    AZURE_OPENAI_CONFIG.endpoint &&
    AZURE_OPENAI_CONFIG.apiKey &&
    AZURE_OPENAI_CONFIG.deployment
  );
}

function buildPromptTemplate() {
  const toolList = TOOLS.map((t) => t.name).join(", ");
  return [
    "You are a deterministic command planner for Adobe After Effects MCP.",
    "Return ONLY valid JSON. No markdown. No explanations outside JSON.",
    "Schema:",
    "{",
    '  "commands": [',
    "    {",
    '      "action": "<one_tool_name_from_allowed_list>",',
    '      "params": { "key": "value" }',
    "    }",
    "  ]",
    "}",
    "Rules:",
    "- Always emit at least one command.",
    "- Use only actions from the allowed list.",
    "- Keep params minimal but executable.",
    "- Do not invent unsupported parameters.",
    "- If user asks for text layer creation, use action create_text_layer with params { compName, layerName, text, position? }.",
    `Allowed actions: ${toolList}, create_text_layer`,
  ].join("\n");
}

function extractFirstJsonBlock(text) {
  if (!text || typeof text !== "string") {
    throw new Error("Model returned empty response");
  }
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("Model response did not contain JSON object");
  }
  return text.slice(start, end + 1);
}

async function parsePromptWithAzure(prompt, context = {}) {
  if (!isAzureConfigured()) {
    throw new Error(
      "Azure OpenAI is not configured. Set AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_API_KEY, AZURE_OPENAI_DEPLOYMENT."
    );
  }

  const endpoint = String(AZURE_OPENAI_CONFIG.endpoint).replace(/\/$/, "");
  const url = `${endpoint}/openai/deployments/${AZURE_OPENAI_CONFIG.deployment}/chat/completions?api-version=${AZURE_OPENAI_CONFIG.apiVersion}`;

  const messages = [
    { role: "system", content: buildPromptTemplate() },
    {
      role: "user",
      content: JSON.stringify({
        prompt,
        context,
      }),
    },
  ];

  logEvent("info", "llm_prompt_received", { prompt, context });

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": AZURE_OPENAI_CONFIG.apiKey,
    },
    body: JSON.stringify({
      messages,
      temperature: 0,
      max_tokens: 800,
    }),
  });

  const body = await response.json();
  if (!response.ok) {
    throw new Error(`Azure OpenAI error: ${response.status} ${JSON.stringify(body)}`);
  }

  const content = body?.choices?.[0]?.message?.content;
  const parsed = JSON.parse(extractFirstJsonBlock(content));
  if (!parsed || !Array.isArray(parsed.commands) || parsed.commands.length === 0) {
    throw new Error("LLM returned invalid command plan");
  }

  const normalized = parsed.commands.map((command) => {
    const plan = toExecutionPlan({
      action: command.action,
      params: command.params || {},
    });
    return plan.commands;
  }).flat();

  return {
    prompt,
    raw: content,
    commands: normalized,
  };
}

// --------------------------------------------------------------------------
// Express app
// --------------------------------------------------------------------------

const app = express();
app.use(cors({ origin: "*", exposedHeaders: ["Mcp-Session-Id"] }));
app.use(express.json({ limit: "5mb" }));

// Lightweight request log (one line per request) - helpful on Heroku.
app.use((req, _res, next) => {
  req.requestId = randomUUID();
  _res.setHeader("x-request-id", req.requestId);
  const t0 = Date.now();
  _res.on("finish", () => {
    const ms = Date.now() - t0;
    logEvent("info", "http_request", {
      requestId: req.requestId,
      method: req.method,
      path: req.originalUrl,
      statusCode: _res.statusCode,
      durationMs: ms,
    });
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
    commandAuditEntries: commandAuditLog.length,
    azurePromptParserConfigured: isAzureConfigured(),
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
  GET  /prompt-template              Deterministic LLM prompt template
  GET  /debug/commands               Recent command lifecycle logs
  POST /command                      { action, params } OR { tool, args }
  POST /command/batch                { commands: [ ... ] }
  POST /command/from-prompt          { prompt, context? } -> strict JSON commands
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

app.get("/prompt-template", (_req, res) => {
  res.type("text/plain").send(buildPromptTemplate());
});

app.get("/debug/commands", (req, res) => {
  const limit = Math.max(1, Math.min(Number(req.query?.limit || 50), 200));
  const recentAudit = commandAuditLog.slice(-limit);
  const recentQueue = commandQueue.slice(-limit).map((cmd) => ({
    id: cmd.id,
    traceId: cmd.traceId,
    source: cmd.source,
    tool: cmd.tool,
    status: cmd.status,
    error: cmd.error,
    createdAt: cmd.createdAt,
    completedAt: cmd.completedAt,
    jsxPreview: cmd.jsxPreview,
    debug: cmd.debug,
  }));
  res.json({
    count: recentAudit.length,
    audit: recentAudit,
    queue: recentQueue,
  });
});

app.post("/command/from-prompt", async (req, res) => {
  const traceId = randomUUID();
  try {
    const prompt = req.body?.prompt;
    const context = req.body?.context || {};
    const dryRun = req.body?.dryRun === true;

    if (!prompt || typeof prompt !== "string") {
      return res.status(400).json({ error: "Body must include { prompt: string }" });
    }

    const parsed = await parsePromptWithAzure(prompt, context);
    logEvent("info", "llm_prompt_parsed", {
      traceId,
      prompt,
      commandCount: parsed.commands.length,
      commands: parsed.commands,
    });
    pushCommandAudit("llm_prompt_parsed", {
      traceId,
      prompt,
      commands: parsed.commands,
    });

    if (dryRun) {
      return res.json({
        status: "parsed",
        traceId,
        prompt,
        commands: parsed.commands,
      });
    }

    const plan = {
      action: "llm_prompt_plan",
      protocol: "llm",
      commands: parsed.commands,
    };
    const execution = await executePlannedCommands(plan, {
      wait: req.body?.wait !== false,
      source: "llm_prompt",
      traceId,
    });
    res.json({ status: "completed", ...execution });
  } catch (err) {
    logEvent("error", "llm_prompt_failed", {
      traceId,
      error: err?.message || String(err),
    });
    res.status(500).json({
      status: "failed",
      traceId,
      error: err?.message || String(err),
    });
  }
});

app.post("/command", async (req, res) => {
  const traceId = randomUUID();
  try {
    const plan = toExecutionPlan(req.body || {});
    logEvent("info", "command_received", {
      traceId,
      requestId: req.requestId,
      protocol: plan.protocol,
      action: plan.action,
      commands: plan.commands,
    });
    pushCommandAudit("command_received", {
      traceId,
      requestId: req.requestId,
      protocol: plan.protocol,
      action: plan.action,
      commands: plan.commands,
      rawBody: req.body,
    });

    const execution = await executePlannedCommands(plan, {
      wait: req.body?.wait !== false,
      source: "rest_command",
      traceId,
    });
    res.json({ status: req.body?.wait === false ? "queued" : "completed", ...execution });
  } catch (err) {
    const message = err?.message || String(err);
    const statusCode = /timeout/i.test(message) ? 504 : 400;
    logEvent("error", "command_failed", {
      traceId,
      requestId: req.requestId,
      error: message,
      rawBody: req.body,
    });
    pushCommandAudit("command_failed", {
      traceId,
      requestId: req.requestId,
      error: message,
      rawBody: req.body,
    });
    res.status(statusCode).json({ status: "failed", traceId, error: message });
  }
});

app.post("/command/batch", async (req, res) => {
  const traceId = randomUUID();
  try {
    const envelopes = Array.isArray(req.body?.commands) ? req.body.commands : null;
    if (!envelopes || envelopes.length === 0) {
      return res.status(400).json({ error: "Body must include { commands: [...] }" });
    }

    const commands = envelopes
      .map((envelope) => toExecutionPlan(envelope).commands)
      .flat();

    const execution = await executePlannedCommands(
      {
        action: "batch",
        protocol: "batch",
        commands,
      },
      {
        wait: req.body?.wait !== false,
        source: "rest_batch_command",
        traceId,
      }
    );

    res.json({ status: req.body?.wait === false ? "queued" : "completed", ...execution });
  } catch (err) {
    const message = err?.message || String(err);
    const statusCode = /timeout/i.test(message) ? 504 : 400;
    res.status(statusCode).json({ status: "failed", traceId, error: message });
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

app.post("/api/command", async (req, res) => {
  const traceId = randomUUID();
  try {
    const plan = toExecutionPlan(req.body || {});
    const wait = req.body?.wait !== false;

    logEvent("info", "legacy_command_received", {
      traceId,
      requestId: req.requestId,
      protocol: plan.protocol,
      action: plan.action,
      commands: plan.commands,
      wait,
    });
    pushCommandAudit("legacy_command_received", {
      traceId,
      requestId: req.requestId,
      protocol: plan.protocol,
      action: plan.action,
      commands: plan.commands,
      wait,
      rawBody: req.body,
    });

    const execution = await executePlannedCommands(plan, {
      wait,
      source: "legacy_api_command",
      traceId,
    });

    if (!wait) {
      const queuedIds = execution.results.map((r) => r.commandId).filter(Boolean);
      if (queuedIds.length === 1) {
        return res.json({ commandId: queuedIds[0], status: "queued", traceId });
      }
      return res.json({ commandIds: queuedIds, status: "queued", traceId });
    }

    if (execution.results.length === 1) {
      const single = execution.results[0];
      return res.json({
        commandId: single.commandId || null,
        status: single.status,
        traceId,
        tool: single.tool,
        result: single.result,
      });
    }

    return res.json({
      status: "completed",
      traceId,
      action: execution.action,
      results: execution.results,
      commands: execution.commands,
    });
  } catch (err) {
    const message = err?.message || String(err);
    const statusCode = /timeout/i.test(message) ? 504 : 400;
    logEvent("error", "legacy_command_failed", {
      traceId,
      requestId: req.requestId,
      error: message,
      rawBody: req.body,
    });
    pushCommandAudit("legacy_command_failed", {
      traceId,
      requestId: req.requestId,
      error: message,
      rawBody: req.body,
    });
    return res.status(statusCode).json({ status: "failed", traceId, error: message });
  }
});

app.get("/api/commands/pending", (req, res) => {
  recoverStuckAssignedCommands(Date.now());
  const assigned = assignPendingCommands(Date.now())
    .map((c) => ({
      id: c.id,
      status: c.status,
      assignedAt: c.assignedAt,
      traceId: c.traceId,
      source: c.source,
      tool: c.tool,
      type: c.tool,
      params: c.params,
      jsxPreview: c.jsxPreview,
    }));

  if (assigned.length > 0) {
    logEvent("info", "pending_commands_assigned_batch", {
      requestId: req.requestId,
      count: assigned.length,
      commandIds: assigned.map((c) => c.id),
    });
  }

  res.json(assigned);
});

app.post("/api/command/:id/result", (req, res) => {
  const { id } = req.params;
  const { result, error, status, success, debug } = req.body || {};
  const cmd = commandQueue.find((c) => c.id === id);

  if (!cmd) {
    logEvent("warn", "panel_result_unknown_command", {
      commandId: id,
      payload: req.body,
    });
    return res.json({ status: "unknown-id" });
  }

  if (cmd.status === "completed" || cmd.status === "failed") {
    return res.json({ status: "already-finalized", commandStatus: cmd.status });
  }

  const normalizedStatus = String(
    status || (success === false ? "failed" : "success")
  ).toLowerCase();
  const finalStatus = normalizedStatus === "failed" ? "failed" : "completed";

  logEvent("info", "panel_result_received", {
    commandId: id,
    traceId: cmd.traceId,
    previousStatus: cmd.status,
    finalStatus,
  });

  pushCommandAudit("panel_result_received", {
    id: cmd.id,
    traceId: cmd.traceId,
    previousStatus: cmd.status,
    finalStatus,
    result,
    error,
    debug,
  });

  const ok = finalizeCommand(id, finalStatus, result, error, debug);
  if (!ok) {
    logEvent("warn", "panel_result_unknown_command", {
      commandId: id,
      payload: req.body,
    });
  }
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
    const traceId = randomUUID();
    try {
      logEvent("info", "mcp_tool_call", {
        traceId,
        tool: name,
        args: args || {},
      });
      pushCommandAudit("mcp_tool_call", {
        traceId,
        tool: name,
        args: args || {},
      });
      const result = await runTool(name, args || {}, {
        source: "mcp_tool_call",
        traceId,
      });
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
      logEvent("error", "mcp_tool_error", {
        traceId,
        tool: name,
        error: err?.message || String(err),
      });
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
    `  Simple REST execute       : POST ${base}/command   { action, params }`,
    `  Natural language execute  : POST ${base}/command/from-prompt { prompt }`,
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
