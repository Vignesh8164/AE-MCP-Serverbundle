import express from 'express';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import { createLLMProvider } from '../llm/factory';

const app = express();
app.use(cors());
app.use(express.json());

const PORT = 3000;

const tools = [
  { name: "create_composition", description: "Create a new composition" },
  { name: "add_layer", description: "Add a layer to composition" },
  { name: "modify_property", description: "Modify layer property" },
  { name: "get_active_comp_info", description: "Get info about active composition" },
  { name: "apply_expression", description: "Apply expression to layer property" },
  { name: "add_effect", description: "Add effect to layer" },
  { name: "set_keyframe", description: "Set keyframe on property" },
  { name: "create_null_and_parent", description: "Create null and parent layer" },
  { name: "render_comp", description: "Add comp to render queue" },
  { name: "execute_arbitrary_jsx", description: "Execute raw ExtendScript (gated)" },
  { name: "duplicate_layer", description: "Duplicate a layer" },
  { name: "delete_layer", description: "Delete a layer" },
  { name: "set_blend_mode", description: "Set blend mode and track matte" },
  { name: "add_shape_layer", description: "Create shape layer" },
  { name: "set_3d_property", description: "Enable 3D and set Z properties" },
  { name: "batch_modify_property", description: "Modify property on multiple layers" },
  { name: "add_camera", description: "Add a camera layer" },
  { name: "add_light", description: "Add a light layer" },
  { name: "apply_preset", description: "Apply an animation preset (.ffx)" },
  { name: "precompose_layers", description: "Precompose an array of layer indices" },
  { name: "set_text_content", description: "Set text content of a text layer" },
  { name: "add_marker", description: "Add a marker to a layer" },
  { name: "batch_apply_expression", description: "Apply an expression to multiple layers" },
  { name: "set_layer_blend_mode", description: "Set layer blend mode" },
  { name: "duplicate_with_children", description: "Duplicate a layer and its children" },
  { name: "export_as_mogrt", description: "Export composition as a MOGRT file" },
  { name: "create_comp_advanced", description: "Create comp with pixel aspect + bg color" },
  { name: "duplicate_comp", description: "Duplicate composition" },
  { name: "set_comp_work_area", description: "Set comp work area start + duration" },
  { name: "set_comp_background_color", description: "Set comp background color [r,g,b]" },
  { name: "save_project", description: "Save current project" },
  { name: "save_project_as", description: "Save project to specific path" },
  { name: "close_project", description: "Close project without saving" },
  { name: "new_project", description: "Create new empty project" },
  { name: "add_null_layer", description: "Add null with name + position" },
  { name: "add_shape_layer_advanced", description: "Shape with fill/stroke/size/position" },
  { name: "add_camera_advanced", description: "Camera with position/POI/zoom" },
  { name: "add_light_advanced", description: "Light with type/color/intensity" },
  { name: "set_layer_parent", description: "Parent a layer to another (or null)" },
  { name: "set_layer_3d", description: "Toggle 3D on layer" },
  { name: "set_layer_motion_blur", description: "Toggle motion blur on layer" },
  { name: "lock_layer", description: "Lock/unlock layer" },
  { name: "shy_layer", description: "Toggle shy flag" },
  { name: "set_text_content_advanced", description: "Text + fontSize/font/justify" },
  { name: "apply_text_style", description: "Apply text style object" },
  { name: "set_text_fill_color", description: "Set text fill color" },
  { name: "set_text_stroke", description: "Set text stroke color + width" },
  { name: "animate_text_position", description: "Animate position from->to over duration" },
  { name: "apply_text_wiggle", description: "Apply wiggle expression to text position" },
  { name: "add_effect_advanced", description: "Add effect + set property values" },
  { name: "apply_wiggle_smart", description: "Wiggle on any property with auto resolve" },
  { name: "apply_loop_out", description: "Apply loopOut(type) expression" },
  { name: "set_keyframe_ease", description: "Set ease in/out on keyframe by index" },
  { name: "add_marker_advanced", description: "Marker w/ duration, chapter, url" },
  { name: "apply_expression_smart", description: "Smart expression apply with group fallback" },
  { name: "batch_wiggle", description: "Apply wiggle to many layers at once" },
  { name: "create_ramp_effect", description: "Add gradient ramp effect to layer" },
  { name: "add_to_render_queue", description: "Add comp to render queue" },
  { name: "set_render_output", description: "Configure output module path/template" },
  { name: "start_render", description: "Start render queue" },
  { name: "export_frame_as_image", description: "Queue single-frame PNG export" },
  { name: "precompose_with_options", description: "Precompose by layer names with options" },
  { name: "execute_jsx_file", description: "Run external .jsx file (gated)" },
  { name: "get_project_info", description: "Project metadata + counts" },
  { name: "auto_crop", description: "Crop comp to bounding box of all layers" },
  { name: "curve_editor", description: "Set bezier in/out speed+influence on key" },
  { name: "time_reverse", description: "Reverse layer playback via time remap" },
  { name: "random_layer_order", description: "Shuffle layer stacking order" },
  { name: "auto_sway", description: "Sway rotation expression (sin)" },
  { name: "anchor_point_tool", description: "Move anchor to corner/edge/center, keep position" },
  { name: "expression_cleanup", description: "Strip expressions on layers/properties" },
  { name: "scale_about_centre", description: "Center anchor then scale" },
  { name: "mask_convertor", description: "Convert mask path to shape layer" },
  { name: "layer_sequencer", description: "Sequence layers in time with overlap" },
  { name: "layer_organizer", description: "Sort layer stack by name/time/duration/type" },
  { name: "wiggle_controller", description: "Null + sliders driving wiggle expression" },
  { name: "property_revealer", description: "List animated properties on layer" },
  { name: "split_by_marker", description: "Split layer at every marker" },
  { name: "centre_anchor", description: "Move anchor to layer center" },
  { name: "quick_search", description: "Regex search layer names" },
  { name: "text_path_tool", description: "Bind text layer to mask path" },
  { name: "effect_browser", description: "List common effect match names (filterable)" },
  { name: "shape_morph", description: "Keyframe morph between two shape layer paths" },
  { name: "path_trimmer", description: "Add Trim Paths with start/end/offset" },
  { name: "layer_splitter", description: "Split layer at specified time" },
  { name: "marker_manager", description: "list/add/delete-all/delete-at markers" },
  { name: "stroke_caps", description: "Set shape stroke line cap/join/miter" },
  { name: "duplicate_with_offset", description: "Duplicate N times with position+time offset" },
  { name: "property_shifter", description: "Shift all keyframes of property by delta" },
  { name: "find_replace", description: "Regex replace in layer-names or text content" },
  { name: "easy_ease", description: "Apply easy ease (F9) to keys of property" },
  { name: "comp_settings", description: "Update comp width/height/duration/frameRate/bgColor/name" },
  { name: "batch_rename", description: "Rename layers with prefix/suffix/replaceWith/numbering" },
  { name: "property_linker", description: "Link target property to source via expression" },
  { name: "distribute_layer", description: "Distribute layers along x/y with spacing" },
  { name: "layer_aligner", description: "Align layers (left/right/hcenter/top/bottom/vcenter)" },
  { name: "text_animator", description: "Add text animator (position/scale/rotation/opacity/fillColor)" },
  { name: "expression_builder", description: "Build common expression templates" },
  { name: "expression_picker", description: "Copy expression from source to target property" },
  { name: "keyframe_copier", description: "Copy all keys from source to dest property" },
  { name: "shape_transfer", description: "Copy first shape path from src to dst layer" }
];

interface PendingCmd {
  id: string;
  tool: string;
  params: any;
  type: string;
  status: 'pending' | 'completed' | 'failed';
  result?: any;
  error?: string;
  resolve?: (v: any) => void;
  reject?: (e: any) => void;
  timer?: NodeJS.Timeout;
}

let commandQueue: PendingCmd[] = [];
const COMMAND_TIMEOUT_MS = 30000;

const llmProvider = createLLMProvider();

app.get('/api/tools', (_req, res) => {
  res.json({ tools, count: tools.length });
});

app.post('/api/command', (req, res) => {
  const tool = req.body.tool;
  const params = req.body.args ?? req.body.params ?? {};
  const wait = req.body.wait !== false;
  const commandId = uuidv4();
  const cmd: PendingCmd = { id: commandId, tool, params, type: tool, status: 'pending' };
  commandQueue.push(cmd);

  if (!wait) {
    res.json({ commandId, status: 'queued' });
    return;
  }

  cmd.timer = setTimeout(() => {
    if (cmd.status === 'pending') {
      cmd.status = 'failed';
      cmd.error = 'Timeout waiting for AE panel result';
      cmd.reject && cmd.reject(new Error(cmd.error));
    }
  }, COMMAND_TIMEOUT_MS);

  new Promise((resolve, reject) => {
    cmd.resolve = resolve;
    cmd.reject = reject;
  })
    .then((result) => res.json({ commandId, status: 'completed', result }))
    .catch((err) => res.status(504).json({ commandId, status: 'failed', error: err.message }));
});

app.get('/api/commands/pending', (_req, res) => {
  const pending = commandQueue
    .filter((c) => c.status === 'pending')
    .map((c) => ({ id: c.id, tool: c.tool, type: c.tool, params: c.params }));
  res.json(pending);
});

function finalizeCommand(id: string, status: 'completed' | 'failed', result: any, error?: string) {
  const cmd = commandQueue.find((c) => c.id === id);
  if (!cmd) return false;
  if (cmd.timer) clearTimeout(cmd.timer);
  cmd.status = status;
  cmd.result = result;
  cmd.error = error;
  if (status === 'completed' && cmd.resolve) cmd.resolve(result);
  if (status === 'failed' && cmd.reject) cmd.reject(new Error(error || 'failed'));
  return true;
}

app.post('/api/command/:id/result', (req, res) => {
  const { id } = req.params;
  const { result, error, status } = req.body;
  const finalStatus = status === 'failed' ? 'failed' : 'completed';
  const ok = finalizeCommand(id, finalStatus, result, error);
  res.json({ status: ok ? 'ok' : 'unknown-id' });
});

if (process.argv.includes('--cli')) {
  console.log(`\nAE MCP Server - ${tools.length} Tools Ready`);
  console.log('Type tool name or "help" or "exit"\n');
  const readline = require('readline').createInterface({ input: process.stdin, output: process.stdout });
  readline.on('line', (input: string) => {
    if (input === 'exit') process.exit(0);
    if (input === 'help') {
      console.log(tools.map(t => `- ${t.name}`).join('\n'));
      return;
    }
    console.log(`\n[CLI] ${input}\n`);
  });
}

app.listen(PORT, () => {
  console.log(`MCP Server running on http://localhost:${PORT}`);
  console.log(`Total Tools: ${tools.length}`);
});

export default app;
