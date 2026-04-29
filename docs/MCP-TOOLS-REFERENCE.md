# MCP Tools Reference - Complete API Documentation

26 tools for complete After Effects automation via Claude AI.

## Tools by Category

| Category | Tools | Purpose |
|----------|-------|---------|
| **CRUD** | create_composition, add_layer, modify_property, duplicate_layer, delete_layer | Basic project manipulation |
| **Info** | get_active_comp_info | Query composition state |
| **Effects** | add_effect, set_blend_mode | Apply visual effects |
| **Animation** | apply_expression, set_keyframe | Create dynamic animations |
| **Structure** | create_null_and_parent | Hierarchical layer control |
| **Shapes** | add_shape_layer | Shape layer creation |
| **3D** | set_3d_property | Enable 3D and Z transforms |
| **Batch** | batch_modify_property | Bulk property updates |
| **Output** | render_comp | Queue for export |
| **Advanced** | execute_arbitrary_jsx | Custom scripting (gated) |

---

## 1. `create_composition` - Create New Composition

**Input:**
```json
{
  "name": "string (required)",
  "width": "number (required, pixels)",
  "height": "number (required, pixels)",
  "duration": "number (required, seconds)",
  "frameRate": "number (required, fps)"
}
```

**Examples:**
- HD: `{name: "Main", width: 1920, height: 1080, duration: 10, frameRate: 24}`
- 4K: `{name: "4K", width: 3840, height: 2160, duration: 30, frameRate: 60}`
- Mobile: `{name: "Story", width: 1080, height: 1920, duration: 15, frameRate: 30}`

**Response:** `{ success: true, compName: "Main" }`

---

## 2. `add_layer` - Add Layer to Composition

**Input:**
```json
{
  "compName": "string (required)",
  "layerName": "string (required)",
  "layerType": "solid|text|null (required)"
}
```

**Layer Types:**
- `solid` → Colored rectangle (white by default)
- `text` → Editable text layer
- `null` → Controller (no visual, for parenting)

**Examples:**
```json
{"compName": "Main", "layerName": "Background", "layerType": "solid"}
{"compName": "Main", "layerName": "Title", "layerType": "text"}
{"compName": "Main", "layerName": "Control", "layerType": "null"}
```

---

## 3. `modify_property` - Change Layer Property

**Input:**
```json
{
  "compName": "string (required)",
  "layerName": "string (required)",
  "property": "position|opacity|scale|rotation (required)",
  "value": "number|array (required)"
}
```

**Property Types:**

| Property | Type | Example |
|----------|------|---------|
| `position` | `[x, y]` | `[960, 540]` |
| `opacity` | number | `50` (50%) |
| `scale` | number | `75` (75%) |
| `rotation` | number | `45` (degrees) |

**Examples:**
```json
{"compName": "Main", "layerName": "Title", "property": "position", "value": [960, 540]}
{"compName": "Main", "layerName": "Title", "property": "opacity", "value": 50}
{"compName": "Main", "layerName": "Title", "property": "scale", "value": 200}
{"compName": "Main", "layerName": "Title", "property": "rotation", "value": 45}
```

---

## 4. `get_active_comp_info` - Query Composition Details

**Input:** (none required)

**Response:**
```json
{
  "success": true,
  "name": "Main",
  "width": 1920,
  "height": 1080,
  "duration": 10.5,
  "frameRate": 24,
  "numLayers": 5,
  "currentTime": 0
}
```

**When to Use:** Verify comp before operations, check layer count, confirm settings.

---

## 5. `apply_expression` - Set JavaScript Expression

**Input:**
```json
{
  "layerName": "string (required)",
  "propertyName": "string (required)",
  "expression": "string (required)"
}
```

**Common Expressions:**

Bouncing: `Math.sin(time * 3) * 50 + 540`  
Fade in: `linear(time, 0, 3, 0, 100)`  
Link to layer: `thisLayer.position + [100, 0]`  
Scale over time: `100 + time * 20`

**Examples:**
```json
{
  "layerName": "Title",
  "propertyName": "position",
  "expression": "var sine = Math.sin(time * 3) * 30; [960, 540 + sine]"
}
```

---

## 6. `add_effect` - Apply Visual Effect

**Input:**
```json
{
  "layerName": "string (required)",
  "effectMatchName": "string (required)"
}
```

**Common Effects:**

| Effect | Match Name |
|--------|-----------|
| Glow | `ADBE Glow` |
| Blur | `ADBE Blur` |
| Color Balance | `ADBE Color Balance` |
| Drop Shadow | `ADBE Drop Shadow` |
| Hue/Saturation | `ADBE Hue Saturation` |
| Levels | `ADBE Levels` |
| Channel Mixer | `ADBE Channel Mixer` |

**Examples:**
```json
{"layerName": "Title", "effectMatchName": "ADBE Glow"}
{"layerName": "Background", "effectMatchName": "ADBE Blur"}
```

---

## 7. `set_keyframe` - Create Keyframe Animation

**Input:**
```json
{
  "layerName": "string (required)",
  "propertyName": "string (required)",
  "timeInSeconds": "number (required)",
  "value": "number|array (required)"
}
```

**Examples:**
```json
{"layerName": "Title", "propertyName": "position", "timeInSeconds": 0, "value": [100, 100]}
{"layerName": "Title", "propertyName": "position", "timeInSeconds": 5, "value": [1800, 980]}
{"layerName": "Title", "propertyName": "opacity", "timeInSeconds": 3, "value": 0}
```

**Usage:** Call multiple times to create animation sequence (fade, move, etc.)

---

## 8. `create_null_and_parent` - Create Control Hierarchy

**Input:**
```json
{
  "targetLayerName": "string (required)",
  "nullName": "string (optional)"
}
```

**Purpose:** Parent layer to control null for easy animation.

**Examples:**
```json
{"targetLayerName": "Title", "nullName": "Title Controller"}
{"targetLayerName": "Background", "nullName": "Scene Master"}
```

**Result:** Null layer created + target parented → move null = moves all children.

---

## 9. `render_comp` - Queue for Export

**Input:**
```json
{
  "compName": "string (required)",
  "outputPath": "string (optional)"
}
```

**Examples:**
```json
{"compName": "Main"}
{"compName": "Main", "outputPath": "C:/output/video.mp4"}
{"compName": "Main", "outputPath": "/Users/name/Desktop/export.mp4"}
```

**Next:** Click **Render** in AE render queue to start export.

---

## 10. `execute_arbitrary_jsx` - Custom ExtendScript (Gated)

**Input:**
```json
{
  "jsxCode": "string (required)"
}
```

**Blocks (Safety):**
- `app.quit` ❌
- `system()` ❌
- `File.remove()` ❌
- Etc.

**Examples:**

Get all layer names:
```javascript
var comp = app.project.activeItem;
var names = [];
for (var i = 1; i <= comp.numLayers; i++) {
  names.push(comp.layer(i).name);
}
names
```

Count layers:
```javascript
app.project.activeItem.numLayers
```

---

## 11. `duplicate_layer` - Duplicate Layer

**Input:**
```json
{
  "layerName": "string (required)",
  "newName": "string (optional)"
}
```

**Examples:**
```json
{"layerName": "Title"}
{"layerName": "Title", "newName": "Title Copy"}
```

**Notes:** Operates on the active composition.

---

## 12. `delete_layer` - Delete Layer

**Input:**
```json
{
  "layerName": "string (required)"
}
```

**Examples:**
```json
{"layerName": "Title"}
```

**Notes:** Operates on the active composition.

---

## 13. `set_blend_mode` - Set Blend Mode + Track Matte

**Input:**
```json
{
  "layerName": "string (required)",
  "blendMode": "normal|darken|multiply|screen|overlay|soft-light|hard-light|add|subtract|lighten|color-dodge (required)",
  "trackMatte": "none|alpha|alpha-invert|luma|luma-invert (optional)"
}
```

**Examples:**
```json
{"layerName": "Title", "blendMode": "screen"}
{"layerName": "Title", "blendMode": "multiply", "trackMatte": "alpha"}
```

---

## 14. `add_shape_layer` - Add Shape Layer

**Input:**
```json
{
  "shapeType": "string (required)",
  "layerName": "string (optional)",
  "position": "[x, y] (optional)",
  "size": "number (optional, scale percent)"
}
```

**Examples:**
```json
{"shapeType": "rect", "layerName": "Badge", "position": [960, 540], "size": 80}
{"shapeType": "ellipse"}
```

**Notes:** Creates an empty shape layer and applies transform values. Shape contents are not created yet.

---

## 15. `set_3d_property` - Enable 3D + Z Controls

**Input:**
```json
{
  "layerName": "string (required)",
  "enable3D": "boolean (required)",
  "zPosition": "number (optional)",
  "zRotation": "number (optional, degrees)"
}
```

**Examples:**
```json
{"layerName": "Title", "enable3D": true, "zPosition": 400, "zRotation": 30}
{"layerName": "Title", "enable3D": false}
```

---

## 16. `batch_modify_property` - Modify Multiple Layers

**Input:**
```json
{
  "layerNames": "array of strings (required)",
  "propertyName": "position|opacity|scale|rotation (required)",
  "value": "number|array (required)"
}
```

**Examples:**
```json
{"layerNames": ["Title", "Subhead"], "propertyName": "opacity", "value": 80}
{"layerNames": ["Box", "Badge"], "propertyName": "position", "value": [960, 540]}
```

**Response:**
```json
{
  "success": true,
  "modifiedLayers": ["Title", "Subhead"],
  "failedLayers": []
}
```

---

## 17. `add_camera` - Add Camera

**Input:**
```json
{
  "name": "string (optional)",
  "centerPoint": "[x, y] (optional)"
}
```
**Examples:**
```json
{"name": "Main Camera", "centerPoint": [960, 540]}
```

---

## 18. `add_light` - Add Light

**Input:**
```json
{
  "name": "string (optional)",
  "centerPoint": "[x, y] (optional)"
}
```
**Examples:**
```json
{"name": "Key Light", "centerPoint": [960, 540]}
```

---

## 19. `apply_preset` - Apply Animation Preset

**Input:**
```json
{
  "layerName": "string (required)",
  "presetPath": "string (required)"
}
```
**Examples:**
```json
{"layerName": "Title", "presetPath": "C:/Presets/FadeIn.ffx"}
```

---

## 20. `precompose_layers` - Precompose Layers

**Input:**
```json
{
  "layerIndices": "array of numbers (required)",
  "name": "string (optional)",
  "moveAllAttributes": "boolean (optional)"
}
```
**Examples:**
```json
{"layerIndices": [1, 2, 3], "name": "Scene 1", "moveAllAttributes": true}
```

---

## 21. `set_text_content` - Update Text Content

**Input:**
```json
{
  "layerName": "string (required)",
  "text": "string (required)"
}
```
**Examples:**
```json
{"layerName": "Title", "text": "Hello World"}
```

---

## 22. `add_marker` - Add Layer Marker

**Input:**
```json
{
  "layerName": "string (required)",
  "timeInSeconds": "number (required)",
  "comment": "string (optional)"
}
```
**Examples:**
```json
{"layerName": "Action Layer", "timeInSeconds": 2.5, "comment": "Explosion"}
```

---

## 23. `batch_apply_expression` - Batch Apply Expression

**Input:**
```json
{
  "layerNames": "array of strings (required)",
  "propertyName": "string (required)",
  "expression": "string (required)"
}
```
**Examples:**
```json
{"layerNames": ["L1", "L2"], "propertyName": "opacity", "expression": "wiggle(1,50)"}
```

---

## 24. `set_layer_blend_mode` - Set Layer Blend Mode

**Input:**
```json
{
  "layerName": "string (required)",
  "blendMode": "string (required)"
}
```
**Examples:**
```json
{"layerName": "Glow Layer", "blendMode": "screen"}
```

---

## 25. `duplicate_with_children` - Duplicate with Children

**Input:**
```json
{
  "layerName": "string (required)"
}
```
**Examples:**
```json
{"layerName": "Master Null"}
```

---

## 26. `export_as_mogrt` - Export as MOGRT

**Input:**
```json
{
  "compName": "string (required)",
  "outputPath": "string (optional)"
}
```
**Examples:**
```json
{"compName": "Lower Third", "outputPath": "C:/Exports/lower_third.mogrt"}
```

---

## Complete Workflow Example

**Goal:** "Create 5-second title animation: fade in + bounce + glow"

```
1. create_composition
   → name: "TitleAnim", width: 1920, height: 1080, duration: 5, frameRate: 24

2. add_layer
   → compName: "TitleAnim", layerName: "Background", layerType: "solid"

3. add_layer
   → compName: "TitleAnim", layerName: "Title", layerType: "text"

4. modify_property
   → compName: "TitleAnim", layerName: "Title", property: "opacity", value: 0

5. set_keyframe
   → layerName: "Title", propertyName: "opacity", timeInSeconds: 0, value: 0

6. set_keyframe
   → layerName: "Title", propertyName: "opacity", timeInSeconds: 2, value: 100

7. apply_expression
   → layerName: "Title", propertyName: "position",
     expression: "[960, 540 + Math.sin(time * 3) * 30]"

8. add_effect
   → layerName: "Title", effectMatchName: "ADBE Glow"

9. render_comp
   → compName: "TitleAnim", outputPath: "/output/title.mp4"

Result: 5-second animation ready to export
```

---

## Error Handling

All tools return:
```json
{
  "success": false,
  "error": "Error message"
}
```

**Common Errors:**

| Error | Cause | Fix |
|-------|-------|-----|
| "No active composition" | No comp selected | Select in AE |
| "Composition not found" | Name typo | Check exact name |
| "Layer not found" | Layer doesn't exist | Create first |
| "Blocked dangerous command" | Used blocked fn | Different approach |
| "Command timeout" | AE not responding | Restart AE |

---

## Performance Tips

1. **Batch operations** → Multiple steps in one call
2. **Check first** → Query before modify
3. **Cache names** → Copy exact from AE
4. **Plan keyframes** → All at once
5. **Avoid loops** → Single tool call instead of N

---

## Integration with Claude

Claude understands all 16 tools and calls them automatically.

Example:
```
User: "Create a bouncing title with glow effect and fade animation"
Claude: (calls 9 tools automatically in correct order)
```

---

## Limitations

❌ **Not supported (yet):**
- Bézier paths
- Full 3D transforms (X/Y rotation) and camera/lights
- Adjustment layers
- Effect parameter tuning
- Audio sync keyframes

---

## Quick Reference

| Task | Tool | Key Params |
|------|------|-----------|
| Create | `create_composition` | name, width, height, duration, fps |
| Add | `add_layer` | compName, layerName, layerType |
| Duplicate | `duplicate_layer` | layerName, newName |
| Delete | `delete_layer` | layerName |
| Change | `modify_property` | compName, layerName, property, value |
| Blend | `set_blend_mode` | layerName, blendMode, trackMatte |
| Shape | `add_shape_layer` | shapeType, layerName, position, size |
| 3D | `set_3d_property` | layerName, enable3D, zPosition, zRotation |
| Query | `get_active_comp_info` | (none) |
| Animate | `apply_expression` | layerName, propertyName, expression |
| Effect | `add_effect` | layerName, effectMatchName |
| Keyframe | `set_keyframe` | layerName, propertyName, timeInSeconds, value |
| Control | `create_null_and_parent` | targetLayerName, nullName |
| Batch | `batch_modify_property` | layerNames, propertyName, value |
| Export | `render_comp` | compName, outputPath |
| Custom | `execute_arbitrary_jsx` | jsxCode |
| Camera | `add_camera` | name, centerPoint |
| Light | `add_light` | name, centerPoint |
| Preset | `apply_preset` | layerName, presetPath |
| Precomp | `precompose_layers` | layerIndices, name, moveAllAttributes |
| Text | `set_text_content` | layerName, text |
| Marker | `add_marker` | layerName, timeInSeconds, comment |
| B.Expr | `batch_apply_expression` | layerNames, propertyName, expression |
| Blend | `set_layer_blend_mode` | layerName, blendMode |
| DupChild| `duplicate_with_children` | layerName |
| MOGRT | `export_as_mogrt` | compName, outputPath |

---

**Status:** Complete 26-tool API  
**Version:** 1.2  
**Last Updated:** 2026-04-27

---

## Batch 1 Expansion (Tools 27-36)

### 27. `create_comp_advanced`
`{name, width, height, duration, frameRate, pixelAspect?, bgColor?:[r,g,b]}`

### 28. `duplicate_comp`
`{compName, newName?}`

### 29. `set_comp_work_area`
`{compName, start, duration}` — seconds.

### 30. `set_comp_background_color`
`{compName, color:[r,g,b]}` — values 0..1.

### 31. `save_project`
No params. Fails if project never saved.

### 32. `save_project_as`
`{path}` — absolute path to .aep.

### 33. `close_project`
No params. Discards changes.

### 34. `new_project`
No params.

### 35. `add_null_layer`
`{name?, position?:[x,y]}`

### 36. `add_shape_layer_advanced`
`{shapeType:"rect"|"ellipse"|"star"|"polygon", name?, position?, size?, fillColor?:[r,g,b], strokeColor?:[r,g,b], strokeWidth?}`

---

## Batch 2 Expansion (Tools 37-46)

### 37. `add_camera_advanced`
`{name?, position?, pointOfInterest?, zoom?}`

### 38. `add_light_advanced`
`{name?, lightType:"parallel"|"spot"|"point"|"ambient", position?, color?:[r,g,b], intensity?}`

### 39. `set_layer_parent`
`{layerName, parentName?}` — omit parentName to clear.

### 40. `set_layer_3d`
`{layerName, enable3D:bool}`

### 41. `set_layer_blend_mode` (re-registered)
`{layerName, blendMode}` — see existing.

### 42. `set_layer_motion_blur`
`{layerName, enable:bool}`

### 43. `lock_layer`
`{layerName, lock:bool}`

### 44. `shy_layer`
`{layerName, shy:bool}`

### 45. `set_text_content_advanced`
`{layerName, text?, fontSize?, font?, justify?:"left"|"right"|"center"}`

### 46. `apply_text_style`
`{layerName, style:{fontSize?, font?, fillColor?, tracking?, leading?, fauxBold?, fauxItalic?}}`

---

## Batch 3 Expansion (Tools 47-56)

### 47. `set_text_fill_color` `{layerName, color:[r,g,b]}`
### 48. `set_text_stroke` `{layerName, color?, width?}`
### 49. `animate_text_position` `{layerName, fromPos, toPos, durationSec?}`
### 50. `apply_text_wiggle` `{layerName, frequency?, amount?}`
### 51. `add_effect_advanced` `{layerName, effectMatchName, propertyValues?:{name:value}}`
### 52. `apply_wiggle_smart` `{layerName, propertyName, frequency?, amount?}`
### 53. `apply_loop_out` `{layerName, propertyName, loopType:"cycle"|"pingpong"|"offset"|"continue"}`
### 54. `set_keyframe_ease` `{layerName, propertyName, keyIndex, easeIn:{speed,influence}, easeOut:{...}}`
### 55. `add_marker_advanced` `{layerName?, timeInSeconds, comment?, duration?, chapter?, url?}`
### 56. `apply_expression_smart` `{layerName, propertyName, expression, transformGroup?}`

---

## Batch 4 Expansion (Tools 57-66)

### 57. `batch_wiggle` `{layerNames[], propertyName, frequency?, amount?}`
### 58. `create_ramp_effect` `{layerName, startPoint?, endPoint?, startColor?, endColor?, rampShape?:"linear"|"radial"}`
### 59. `add_to_render_queue` `{compName}`
### 60. `set_render_output` `{compName, outputPath?, template?}`
### 61. `start_render` no params
### 62. `export_as_mogrt` `{compName, outputPath?}` (existing)
### 63. `export_frame_as_image` `{compName, timeInSeconds, outputPath?}`
### 64. `precompose_with_options` `{layerNames[], name?, moveAllAttributes?, openNewComp?}`
### 65. `execute_jsx_file` `{filePath}` — gated, blocks .bat/.exe/.sh
### 66. `get_project_info` no params

---

## Total: 66 Tools

---

## Batch 5 - Atom Pack (Tools 67-76)

### 67. `auto_crop` `{compName?}` — comp resized to layer bounding box.
### 68. `curve_editor` `{layerName, propertyName, keyIndex, inSpeed?, inInfluence?, outSpeed?, outInfluence?}`
### 69. `time_reverse` `{layerName}` — enables time remap, swaps endpoints.
### 70. `random_layer_order` `{compName?}`
### 71. `auto_sway` `{layerName, frequency?, amount?}`
### 72. `anchor_point_tool` `{layerName, anchorMode:"center"|"top"|"bottom"|"top-left"|"top-right"|"bottom-left"|"bottom-right"|"custom", customPoint?}`
### 73. `expression_cleanup` `{layerNames?, propertyNames?}` — empty = clear all.
### 74. `scale_about_centre` `{layerName, scalePercent}`
### 75. `mask_convertor` `{layerName, maskIndex?, targetShapeLayerName?}`
### 76. `layer_sequencer` `{layerNames[], overlapSeconds?, startTime?}`

---

## Batch 6 - Atom Pack (Tools 77-86)

### 77. `layer_organizer` `{compName?, mode:"name"|"time"|"duration"|"type"}`
### 78. `wiggle_controller` `{targetLayerName, propertyName, controllerName?}` — null with Frequency/Amount sliders.
### 79. `property_revealer` `{layerName}` — returns animated/expression-driven props.
### 80. `split_by_marker` `{layerName}`
### 81. `centre_anchor` `{layerName}`
### 82. `quick_search` `{pattern, caseSensitive?}`
### 83. `text_path_tool` `{layerName, maskLayerName?, maskIndex?}`
### 84. `effect_browser` `{filter?}`
### 85. `shape_morph` `{fromLayerName, toLayerName, durationSec?}`
### 86. `path_trimmer` `{layerName, startPercent?, endPercent?, offsetPercent?}`

---

## Batch 7 - Atom Pack (Tools 87-96)

### 87. `layer_splitter` `{layerName, timeInSeconds?}`
### 88. `marker_manager` `{action:"list"|"add"|"delete-all"|"delete-at", layerName?, timeInSeconds?, comment?}`
### 89. `stroke_caps` `{layerName, lineCap?:"butt"|"round"|"square", lineJoin?:"miter"|"round"|"bevel", miterLimit?}`
### 90. `duplicate_with_offset` `{layerName, count, offsetPosition?:[x,y], offsetTime?}`
### 91. `property_shifter` `{layerName, propertyName, deltaSeconds}`
### 92. `find_replace` `{target:"layer-names"|"text", find, replace, caseSensitive?}`
### 93. `easy_ease` `{layerName, propertyName, keyIndex?}` — omit keyIndex = all keys.
### 94. `comp_settings` `{compName?, settings:{width?,height?,duration?,frameRate?,bgColor?,name?}}`
### 95. `batch_rename` `{layerNames?, prefix?, suffix?, replaceWith?, startNumber?}`
### 96. `property_linker` `{sourceLayerName, sourceProperty, targetLayerName, targetProperty}`

---

## Batch 8 - Atom Pack (Tools 97-103)

### 97. `distribute_layer` `{layerNames[], axis:"x"|"y", spacing?}` — even distribution if spacing omitted.
### 98. `layer_aligner` `{layerNames[], alignment:"left"|"right"|"hcenter"|"top"|"bottom"|"vcenter", relativeTo?:"comp"|"first"}`
### 99. `text_animator` `{layerName, animatorType:"position"|"scale"|"rotation"|"opacity"|"fillColor", value?}`
### 100. `expression_builder` `{template:"wiggle"|"loopout"|"loopin"|"time"|"bounce"|"random"|"follow"|"inertia", params?}` — returns expression string.
### 101. `expression_picker` `{sourceLayerName, sourceProperty, targetLayerName, targetProperty}`
### 102. `keyframe_copier` `{srcLayerName, srcProperty, dstLayerName, dstProperty?, timeOffset?}`
### 103. `shape_transfer` `{srcLayerName, dstLayerName}`

---

## Total: 103 Tools
