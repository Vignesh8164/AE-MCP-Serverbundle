# After Effects MCP Server — 101-Tool HTTP Edition

**Production-ready MCP server for controlling Adobe After Effects through natural language via Azure AI Foundry, deployed on Heroku.**

One command in a chat window:

> "Create a 1920×1080 composition called MainComp, add a text layer that says 'Hello World', make it bounce, add a glow effect, and render it."

The AI breaks that into 5+ tool calls, each one executes inside your local After Effects in real time.

---

## Architecture

```
┌────────────────────────────────┐
│       Azure AI Foundry         │   You type natural language here.
│   (LLM brain, runs in cloud)  │   Foundry calls /mcp on Heroku.
└──────────────┬─────────────────┘
               │  MCP Streamable HTTP (JSON-RPC)
               ▼
┌─────────────────────────────────────────┐
│    Heroku: mcp-wrapper-http.mjs         │   One Node process.
│                                         │   101 tools registered.
│    /mcp             → Azure Foundry     │   In-memory command queue.
│    /tools /command   → REST helpers     │
│    /api/commands/pending  → AE panel    │
│    /api/command/:id/result              │
└──────────────┬──────────────────────────┘
               │  HTTPS polling (500 ms)
               ▼
┌─────────────────────────────────────────┐
│   Your PC: After Effects + CEP Panel    │   Panel polls Heroku,
│   (CSXS/mcp-panel.js)                  │   runs ExtendScript locally,
│   → executes commands via evalScript()  │   posts result back.
└─────────────────────────────────────────┘
```

**Single process, single queue.** Azure Foundry, the REST API, and the AE panel all share the same command queue inside one Heroku dyno. That is the whole trick.

---

## Quick Start

### Local (no Heroku yet)

```bash
npm install
npm start                    # launches mcp-wrapper-http.mjs on port 3000
```

```
==================================================================
  ae-mcp-server v1.0.0  -  HTTP MCP for After Effects
==================================================================
  Listening on              : 0.0.0.0:3000
  Public URL (SERVER_URL)   : http://localhost:3000
  Tools registered          : 101

  >> For Azure AI Foundry, paste this as the Remote MCP endpoint:
        http://localhost:3000/mcp
==================================================================
```

Smoke-test:

```bash
curl http://localhost:3000/health        # → { "status": "ok", "tools": 101 }
curl http://localhost:3000/tools         # → full tool list
```

### Deploy to Heroku

See [`HEROKU-DEPLOY.md`](HEROKU-DEPLOY.md) for the full step-by-step guide. The short version:

```bash
heroku create ae-mcp-server
heroku config:set SERVER_URL=https://ae-mcp-server.herokuapp.com
git push heroku main
```

Then paste `https://ae-mcp-server.herokuapp.com/mcp` into Azure AI Foundry as the **Remote MCP Server endpoint**.

---

## 101 Tools — Full Reference

### Composition Management (9 tools)

| Tool | Description |
|------|-------------|
| `create_composition` | Create a new composition |
| `create_comp_advanced` | Create comp with pixel aspect ratio + background color |
| `duplicate_comp` | Duplicate composition |
| `get_active_comp_info` | Get info about active composition |
| `comp_settings` | Update width / height / duration / frameRate / bgColor / name |
| `set_comp_work_area` | Set comp work area start + duration |
| `set_comp_background_color` | Set comp background color [r, g, b] |
| `get_project_info` | Project metadata + counts |
| `auto_crop` | Crop comp to bounding box of all layers |

### Layer Creation (7 tools)

| Tool | Description |
|------|-------------|
| `add_layer` | Add a layer to composition |
| `add_null_layer` | Add null with name + position |
| `add_shape_layer` | Create shape layer |
| `add_shape_layer_advanced` | Shape with fill / stroke / size / position |
| `add_camera` | Add a camera layer |
| `add_camera_advanced` | Camera with position / POI / zoom |
| `add_light` | Add a light layer |
| `add_light_advanced` | Light with type / color / intensity |

### Layer Operations (16 tools)

| Tool | Description |
|------|-------------|
| `duplicate_layer` | Duplicate a layer |
| `duplicate_with_children` | Duplicate a layer and its children |
| `duplicate_with_offset` | Duplicate N times with position + time offset |
| `delete_layer` | Delete a layer |
| `set_layer_parent` | Parent a layer to another (or null) |
| `set_layer_3d` | Toggle 3D on layer |
| `set_layer_motion_blur` | Toggle motion blur on layer |
| `lock_layer` | Lock / unlock layer |
| `shy_layer` | Toggle shy flag |
| `set_blend_mode` | Set blend mode and track matte |
| `set_layer_blend_mode` | Set layer blend mode |
| `layer_splitter` | Split layer at specified time |
| `layer_sequencer` | Sequence layers in time with overlap |
| `layer_organizer` | Sort layer stack by name / time / duration / type |
| `layer_aligner` | Align layers (left / right / hcenter / top / bottom / vcenter) |
| `distribute_layer` | Distribute layers along x / y with spacing |

### Properties & Transforms (7 tools)

| Tool | Description |
|------|-------------|
| `modify_property` | Modify layer property |
| `batch_modify_property` | Modify property on multiple layers |
| `set_3d_property` | Enable 3D and set Z properties |
| `anchor_point_tool` | Move anchor to corner / edge / center, keep position |
| `centre_anchor` | Move anchor to layer center |
| `scale_about_centre` | Center anchor then scale |
| `property_revealer` | List animated properties on layer |

### Text (8 tools)

| Tool | Description |
|------|-------------|
| `set_text_content` | Set text content of a text layer |
| `set_text_content_advanced` | Text + fontSize / font / justify |
| `apply_text_style` | Apply text style object |
| `set_text_fill_color` | Set text fill color |
| `set_text_stroke` | Set text stroke color + width |
| `animate_text_position` | Animate position from → to over duration |
| `apply_text_wiggle` | Apply wiggle expression to text position |
| `text_animator` | Add text animator (position / scale / rotation / opacity / fillColor) |

### Effects (4 tools)

| Tool | Description |
|------|-------------|
| `add_effect` | Add effect to layer |
| `add_effect_advanced` | Add effect + set property values |
| `create_ramp_effect` | Add gradient ramp effect to layer |
| `effect_browser` | List common effect match names (filterable) |

### Expressions (10 tools)

| Tool | Description |
|------|-------------|
| `apply_expression` | Apply expression to layer property |
| `apply_expression_smart` | Smart expression apply with group fallback |
| `batch_apply_expression` | Apply an expression to multiple layers |
| `apply_wiggle_smart` | Wiggle on any property with auto resolve |
| `batch_wiggle` | Apply wiggle to many layers at once |
| `apply_loop_out` | Apply loopOut(type) expression |
| `apply_text_wiggle` | Apply wiggle expression to text position |
| `expression_builder` | Build common expression templates |
| `expression_picker` | Copy expression from source to target property |
| `expression_cleanup` | Strip expressions on layers / properties |

### Keyframes & Animation (8 tools)

| Tool | Description |
|------|-------------|
| `set_keyframe` | Set keyframe on property |
| `set_keyframe_ease` | Set ease in / out on keyframe by index |
| `easy_ease` | Apply easy ease (F9) to keys of property |
| `curve_editor` | Set bezier in / out speed + influence on key |
| `keyframe_copier` | Copy all keys from source to dest property |
| `property_shifter` | Shift all keyframes of property by delta |
| `time_reverse` | Reverse layer playback via time remap |
| `auto_sway` | Sway rotation expression (sin) |

### Shape Tools (6 tools)

| Tool | Description |
|------|-------------|
| `path_trimmer` | Add Trim Paths with start / end / offset |
| `shape_morph` | Keyframe morph between two shape layer paths |
| `shape_transfer` | Copy first shape path from src to dst layer |
| `stroke_caps` | Set shape stroke line cap / join / miter |
| `mask_convertor` | Convert mask path to shape layer |
| `text_path_tool` | Bind text layer to mask path |

### Markers (4 tools)

| Tool | Description |
|------|-------------|
| `add_marker` | Add a marker to a layer |
| `add_marker_advanced` | Marker with duration, chapter, url |
| `marker_manager` | list / add / delete-all / delete-at markers |
| `split_by_marker` | Split layer at every marker |

### Render & Export (5 tools)

| Tool | Description |
|------|-------------|
| `render_comp` | Add comp to render queue |
| `add_to_render_queue` | Add comp to render queue |
| `set_render_output` | Configure output module path / template |
| `start_render` | Start render queue |
| `export_frame_as_image` | Queue single-frame PNG export |

### Project Management (5 tools)

| Tool | Description |
|------|-------------|
| `save_project` | Save current project |
| `save_project_as` | Save project to specific path |
| `close_project` | Close project without saving |
| `new_project` | Create new empty project |
| `export_as_mogrt` | Export composition as a MOGRT file |

### Structure & Hierarchy (4 tools)

| Tool | Description |
|------|-------------|
| `create_null_and_parent` | Create null and parent layer |
| `precompose_layers` | Precompose an array of layer indices |
| `precompose_with_options` | Precompose by layer names with options |
| `wiggle_controller` | Null + sliders driving wiggle expression |

### Utility & Search (5 tools)

| Tool | Description |
|------|-------------|
| `quick_search` | Regex search layer names |
| `find_replace` | Regex replace in layer-names or text content |
| `batch_rename` | Rename layers with prefix / suffix / replaceWith / numbering |
| `property_linker` | Link target property to source via expression |
| `random_layer_order` | Shuffle layer stacking order |

### Advanced / Scripting (3 tools)

| Tool | Description |
|------|-------------|
| `execute_arbitrary_jsx` | Execute raw ExtendScript (gated) |
| `execute_jsx_file` | Run external .jsx file (gated) |
| `apply_preset` | Apply an animation preset (.ffx) |

---

## Endpoints

### For Azure AI Foundry (MCP)

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/mcp` | MCP Streamable HTTP — JSON-RPC requests from the model |
| `GET` | `/mcp` | SSE stream — server-to-client notifications |
| `DELETE` | `/mcp` | Session termination |

### Simple REST (curl / Postman)

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/health` | Health check (status, tool count, uptime) |
| `GET` | `/tools` | List all 101 tools |
| `POST` | `/command` | `{ "tool": "...", "args": {...} }` — execute one tool |
| `GET` | `/` | Human-readable index page |

### After Effects CEP Panel

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/commands/pending` | Panel polls for queued commands |
| `POST` | `/api/command/:id/result` | Panel posts execution result |
| `GET` | `/api/tools` | Legacy tool list |
| `POST` | `/api/command` | Legacy command queue |

---

## Two Server Versions

| Version | File | Transport | Use Case |
|---------|------|-----------|----------|
| **HTTP (new)** | `mcp-wrapper-http.mjs` | Streamable HTTP + REST | Heroku deploy, Azure Foundry, remote access |
| **stdio (legacy)** | `mcp-wrapper.mjs` | stdin/stdout | Local clients (Cursor, Claude Desktop) |

Both share the same 101 tools and the same command queue shape. The old stdio wrapper still works — it just proxies to localhost. The HTTP wrapper is the one you deploy.

---

## Installation

### 1. Dependencies

```bash
npm install
```

Installs: `@modelcontextprotocol/sdk`, `express`, `cors`, `uuid`.

### 2. CEP Panel (for After Effects)

**Windows:**
```bash
xcopy CSXS\*.* "C:\Program Files (x86)\Common Files\Adobe\CEP\extensions\ae-mcp-bridge\" /E /Y
```

**macOS:**
```bash
cp -r CSXS/* ~/Library/Application\ Support/Adobe/CEP/extensions/ae-mcp-bridge/
```

### 3. Enable CEP Debug Mode

**Windows Registry:**
```
HKEY_CURRENT_USER\Software\Adobe\CSXS.11
PlayerDebugMode = "1"
```

**macOS Terminal:**
```bash
defaults write com.adobe.CSXS.11 PlayerDebugMode 1
```

---

## Azure AI Foundry Integration

1. Deploy the server to Heroku (see [`HEROKU-DEPLOY.md`](HEROKU-DEPLOY.md)).
2. In Azure AI Foundry, add a **Remote MCP Server** tool:
   - Endpoint: `https://your-app.herokuapp.com/mcp`
3. Save and reload — Foundry discovers all 101 tools automatically.
4. Type natural language in the Foundry chat. The model calls tools, the server queues commands, and your local After Effects executes them.

---

## Examples

### Create & Animate

```
You: Create a 10-second title animation:
     - 1920×1080 comp
     - Text "Hello World" centered
     - Fade in over 2 seconds
     - Bounce for duration
     - Add glow effect
     - Export to video.mp4

Foundry: (automatically calls create_composition, add_layer,
          set_keyframe ×2, apply_expression, add_effect,
          render_comp)
Result: Animation ready in render queue
```

### Query State

```
You: What's in the active composition?

Foundry: calls get_active_comp_info
Result: Name, dimensions, duration, fps, layer count
```

### Custom Script

```
You: Count all effects on each layer

Foundry: calls execute_arbitrary_jsx
Result: Detailed breakdown of effects per layer
```

### Batch Operations

```
You: Rename all layers to start with "v2_" and
     distribute them evenly across the timeline

Foundry: calls batch_rename, layer_sequencer
Result: All layers renamed and sequenced
```

---

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Listening port (Heroku injects this automatically) |
| `SERVER_URL` | `http://localhost:3000` | Public URL — shown in startup banner and `/health` |
| `AE_MCP_URL` | — | Alias for `SERVER_URL` |
| `AE_COMMAND_TIMEOUT_MS` | `60000` | How long `/command` waits for AE to respond (ms) |

### CEP Panel URL

After Heroku deploy, update `CSXS/mcp-panel.js`:
- Change `localhost:3000` → `your-app.herokuapp.com`
- Change `http://` → `https://` in `fetch()` calls
- Or just type the Heroku domain into the panel's URL input field

---

## File Structure

```
AE-MCP-Server/
├── mcp-wrapper-http.mjs       # HTTP MCP server (deploy this to Heroku)
├── mcp-wrapper.mjs            # stdio MCP wrapper (local Cursor / Claude Desktop)
├── package.json               # Dependencies + start script
├── Procfile                   # Heroku entry point
├── .gitignore
├── HEROKU-DEPLOY.md           # Step-by-step deploy guide
├── README.md                  # This file
├── .mcp.json                  # MCP metadata
│
├── src/mcp/server.ts          # Original TypeScript source (legacy)
├── dist/mcp/server.js         # Compiled legacy server (not used on Heroku)
│
├── jsx/
│   └── ae-bridge.jsx          # ExtendScript handlers (all tools)
│
├── CSXS/
│   ├── manifest.xml           # CEP extension manifest
│   ├── mcp-panel.html         # CEP panel UI
│   ├── mcp-panel.js           # Polling + execution logic
│   └── csinterface.js         # Adobe CSInterface library
│
└── docs/
    ├── MCP-QUICKSTART.md
    ├── MCP-SERVER-SETUP.md
    ├── MCP-TOOLS-REFERENCE.md
    └── EXPANSION-SUMMARY.md
```

---

## Safety

### Blocked Operations

- `app.quit` — cannot quit After Effects
- `system()` — no shell access
- `File.remove()` / `Folder.remove()` — no file deletion
- Other destructive ExtendScript operations — blocked by the bridge

### Safe Operations

- Query composition and layer data
- Create, modify, and delete layers
- Apply effects and expressions
- Set keyframes and animation
- Render and export
- Manage project files (save/open/close)

---

## Debugging

- **Server logs** — every request logged to stdout with timing (`[timestamp] METHOD /path -> status ms`)
- **Health check** — `GET /health` shows uptime, tool count, pending commands
- **CEP logs (Windows)** — `C:\Users\<USER>\AppData\Local\Temp\CEPHtmlEngine*.log`
- **CEP logs (macOS)** — `~/Library/Logs/CSXS/`
- **CEP DevTools** — `http://localhost:8001` (when AE is running)
- **Heroku logs** — `heroku logs --tail`

---

## Performance

| Operation | Typical Latency |
|-----------|----------------|
| Query (get_active_comp_info) | ~20 ms |
| Property change | ~50 ms |
| Keyframe set | ~30 ms |
| Effect apply | ~100 ms |
| Expression apply | ~30 ms |
| Render queue | ~200 ms |

**Full round trip (Foundry → Heroku → AE → back):** ~500 ms on a good connection.

---

## Status

| Milestone | Status |
|-----------|--------|
| 101 tools registered | ✅ |
| HTTP MCP transport (Streamable HTTP) | ✅ |
| Simple REST API (`/tools`, `/command`, `/health`) | ✅ |
| AE CEP panel bridge | ✅ |
| Legacy stdio wrapper | ✅ |
| Heroku-ready (`Procfile`, `process.env.PORT`) | ✅ |
| Azure AI Foundry compatible | ✅ |
| Safety gating (dangerous ops blocked) | ✅ |
| Request logging | ✅ |
| Graceful shutdown (SIGTERM/SIGINT) | ✅ |
| Documented | ✅ |

---

## Documentation

- **Deploy Guide** → [`HEROKU-DEPLOY.md`](HEROKU-DEPLOY.md)
- **Quick Start** → [`docs/MCP-QUICKSTART.md`](docs/MCP-QUICKSTART.md)
- **Setup Guide** → [`docs/MCP-SERVER-SETUP.md`](docs/MCP-SERVER-SETUP.md)
- **Tools Reference** → [`docs/MCP-TOOLS-REFERENCE.md`](docs/MCP-TOOLS-REFERENCE.md)

---

## License

MIT

---

**Version:** 1.0.0
**Tools:** 101
**Transport:** HTTP (MCP Streamable HTTP + REST)
**Deploy Target:** Heroku
**AI Integration:** Azure AI Foundry (Remote MCP Server)
**Last Updated:** 2026-04-29
