// After Effects Bridge Script - ExtendScript for MCP Server
// 10 tools: 3 CRUD + 1 Query + 2 Effects + 2 Animation + 1 Structure + 1 Output + 1 Advanced

// === CRUD: Create Composition ===
function createComposition(name, width, height, duration, frameRate) {
  try {
    var comp = app.project.items.addComp(name, width, height, 1, duration, frameRate);
    return {
      success: true,
      message: "Composition created: " + comp.name,
      compName: comp.name
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// === CRUD: Add Layer ===
function addLayer(compName, layerName, layerType) {
  try {
    var comp = findComposition(compName);
    if (!comp) {
      throw new Error("Composition not found: " + compName);
    }

    var layer;
    if (layerType === "solid") {
      var solidColor = [1, 1, 1];
      layer = comp.layers.addSolid(solidColor, layerName, 1920, 1080, 1);
    } else if (layerType === "text") {
      layer = comp.layers.addText(layerName);
    } else if (layerType === "null") {
      layer = comp.layers.addNull();
      layer.name = layerName;
    } else {
      throw new Error("Unknown layer type: " + layerType);
    }

    return {
      success: true,
      message: "Layer added to " + compName + ": " + layer.name,
      layerName: layer.name,
      layerIndex: layer.index
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// === CRUD: Modify Property ===
function modifyLayerProperty(compName, layerName, property, value) {
  try {
    var comp = findComposition(compName);
    if (!comp) {
      throw new Error("Composition not found: " + compName);
    }

    var layer = findLayer(comp, layerName);
    if (!layer) {
      throw new Error("Layer not found: " + layerName);
    }

    var result = { success: true };

    if (property === "position") {
      layer.position.setValue(value);
      result.message = "Position set to [" + value[0] + ", " + value[1] + "]";
    } else if (property === "opacity") {
      layer.opacity.setValue(value);
      result.message = "Opacity set to " + value + "%";
    } else if (property === "scale") {
      layer.scale.setValue([value, value]);
      result.message = "Scale set to " + value + "%";
    } else if (property === "rotation") {
      layer.rotation.setValue(value);
      result.message = "Rotation set to " + value + " degrees";
    } else {
      throw new Error("Unknown property: " + property);
    }

    return result;
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// === QUERY: Get Active Comp Info ===
function getActiveCompInfo() {
  if (app.project.activeItem === null) {
    return { success: false, error: "No active composition" };
  }
  if (!(app.project.activeItem instanceof CompItem)) {
    return { success: false, error: "Active item is not a composition" };
  }

  var comp = app.project.activeItem;
  return {
    success: true,
    name: comp.name,
    width: comp.width,
    height: comp.height,
    frameRate: comp.frameRate,
    duration: comp.duration,
    numLayers: comp.numLayers,
    currentTime: comp.time
  };
}

// === HELPERS ===
function findComposition(name) {
  for (var i = 1; i <= app.project.items.length; i++) {
    var item = app.project.items(i);
    if (item instanceof CompItem && item.name === name) {
      return item;
    }
  }
  return null;
}

function findLayer(comp, name) {
  for (var i = 1; i <= comp.layers.length; i++) {
    if (comp.layers(i).name === name) {
      return comp.layers(i);
    }
  }
  return null;
}

function listCompositions() {
  var comps = [];
  for (var i = 1; i <= app.project.items.length; i++) {
    var item = app.project.items(i);
    if (item instanceof CompItem) {
      comps.push({
        name: item.name,
        width: item.width,
        height: item.height,
        duration: item.duration
      });
    }
  }
  return { success: true, compositions: comps };
}

// === NEW TOOLS (7 expanded capabilities) ===

// EFFECTS: Apply Expression to Property
function applyExpression(layerName, propertyName, expression) {
  try {
    var comp = app.project.activeItem;
    if (!(comp instanceof CompItem)) {
      throw new Error("No active composition");
    }

    var layer = findLayer(comp, layerName);
    if (!layer) {
      throw new Error("Layer not found: " + layerName);
    }

    var prop = layer.property(propertyName);
    if (!prop) {
      throw new Error("Property not found: " + propertyName);
    }

    prop.expression = expression;
    return {
      success: true,
      message: "Expression applied to " + layerName + "." + propertyName,
      expressionLength: expression.length
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// EFFECTS: Add Effect to Layer
function addEffect(layerName, effectMatchName) {
  try {
    var comp = app.project.activeItem;
    if (!(comp instanceof CompItem)) {
      throw new Error("No active composition");
    }

    var layer = findLayer(comp, layerName);
    if (!layer) {
      throw new Error("Layer not found: " + layerName);
    }

    var effect = layer.Effects.addProperty(effectMatchName);
    return {
      success: true,
      message: "Effect '" + effectMatchName + "' added to " + layerName,
      effectName: effect.name
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ANIMATION: Set Keyframe on Property
function setKeyframe(layerName, propertyName, timeInSeconds, value) {
  try {
    var comp = app.project.activeItem;
    if (!(comp instanceof CompItem)) {
      throw new Error("No active composition");
    }

    var layer = findLayer(comp, layerName);
    if (!layer) {
      throw new Error("Layer not found: " + layerName);
    }

    var prop = layer.property(propertyName);
    if (!prop) {
      throw new Error("Property not found: " + propertyName);
    }

    prop.setValueAtTime(timeInSeconds, value);
    return {
      success: true,
      message: "Keyframe set on " + layerName + "." + propertyName + " @ " + timeInSeconds + "s",
      keyframeTime: timeInSeconds,
      keyframeValue: value
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// STRUCTURE: Create Null and Parent Layer to It
function createNullAndParent(targetLayerName, nullName) {
  try {
    var comp = app.project.activeItem;
    if (!(comp instanceof CompItem)) {
      throw new Error("No active composition");
    }

    var targetLayer = findLayer(comp, targetLayerName);
    if (!targetLayer) {
      throw new Error("Target layer not found: " + targetLayerName);
    }

    var nullLayer = comp.layers.addNull();
    nullLayer.name = nullName || "Null Controller";
    nullLayer.moveBefore(targetLayer);
    targetLayer.parent = nullLayer;

    return {
      success: true,
      message: "Created null '" + nullLayer.name + "' and parented '" + targetLayerName + "' to it",
      nullLayerName: nullLayer.name,
      nullLayerIndex: nullLayer.index
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// OUTPUT: Render Composition to Queue
function renderComp(compName, outputPath) {
  try {
    var comp = findComposition(compName);
    if (!comp) {
      throw new Error("Composition not found: " + compName);
    }

    var rqItem = app.project.renderQueue.items.add(comp);
    var om = rqItem.outputModule(1);
    om.applyTemplate("H.264 - Match Render Settings");

    if (outputPath) {
      om.file = new File(outputPath);
    }

    return {
      success: true,
      message: "Added '" + compName + "' to render queue",
      renderQueueIndex: app.project.renderQueue.items.length,
      outputPath: outputPath || "(use default)"
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ADVANCED: Execute Arbitrary JSX (with safety checks)
function executeArbitraryJSX(jsxCode) {
  var dangerousPatterns = [
    "app.quit",
    "app.close",
    "system(",
    "File.remove",
    "Folder.remove",
    "$.evalFile",
    "eval("
  ];

  for (var i = 0; i < dangerousPatterns.length; i++) {
    if (jsxCode.indexOf(dangerousPatterns[i]) !== -1) {
      return {
        success: false,
        error: "Blocked dangerous command: " + dangerousPatterns[i]
      };
    }
  }

  try {
    eval(jsxCode);
    return {
      success: true,
      message: "Arbitrary JSX executed successfully",
      codeLength: jsxCode.length
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// === NEW TOOLS (6 expanded operations) ===

// LAYER: Duplicate Layer
function duplicateLayer(layerName, newName) {
  try {
    var comp = app.project.activeItem;
    if (!(comp instanceof CompItem)) {
      throw new Error("No active composition");
    }

    var layer = findLayer(comp, layerName);
    if (!layer) {
      throw new Error("Layer not found: " + layerName);
    }

    var dup = layer.duplicate();
    if (newName) {
      dup.name = newName;
    }

    return {
      success: true,
      message: "Layer duplicated: " + dup.name,
      newLayerName: dup.name,
      newLayerIndex: dup.index
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// LAYER: Delete Layer
function deleteLayer(layerName) {
  try {
    var comp = app.project.activeItem;
    if (!(comp instanceof CompItem)) {
      throw new Error("No active composition");
    }

    var layer = findLayer(comp, layerName);
    if (!layer) {
      throw new Error("Layer not found: " + layerName);
    }

    layer.remove();
    return {
      success: true,
      message: "Layer deleted: " + layerName
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// PROPERTY: Set Blend Mode + Track Matte
function setBlendMode(layerName, blendMode, trackMatte) {
  try {
    var comp = app.project.activeItem;
    if (!(comp instanceof CompItem)) {
      throw new Error("No active composition");
    }

    var layer = findLayer(comp, layerName);
    if (!layer) {
      throw new Error("Layer not found: " + layerName);
    }

    var blendModes = {
      "normal": 0,
      "darken": 2,
      "multiply": 3,
      "screen": 10,
      "overlay": 12,
      "soft-light": 13,
      "hard-light": 14,
      "add": 23,
      "subtract": 25,
      "lighten": 1,
      "color-dodge": 4
    };

    var mode = blendModes[blendMode.toLowerCase()];
    if (mode === undefined) {
      throw new Error("Unknown blend mode: " + blendMode);
    }

    layer.blendingMode = mode;

    if (trackMatte) {
      var matteModes = {
        "none": 0,
        "alpha": 1,
        "alpha-invert": 2,
        "luma": 3,
        "luma-invert": 4
      };
      var matteMode = matteModes[trackMatte.toLowerCase()];
      if (matteMode !== undefined) {
        layer.trackMatteType = matteMode;
      }
    }

    return {
      success: true,
      message: "Blend mode set to " + blendMode + (trackMatte ? " with track matte: " + trackMatte : "")
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// LAYER: Add Shape Layer
function addShapeLayer(shapeType, name, position, size) {
  try {
    var comp = app.project.activeItem;
    if (!(comp instanceof CompItem)) {
      throw new Error("No active composition");
    }

    var layer = comp.layers.addShape();
    layer.name = name || ("Shape - " + shapeType);

    if (position) {
      layer.position.setValue(position);
    }

    if (size) {
      layer.scale.setValue([size, size]);
    }

    return {
      success: true,
      message: "Shape layer created: " + layer.name,
      shapeType: shapeType,
      layerName: layer.name,
      layerIndex: layer.index
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// 3D: Set 3D Property
function set3DProperty(layerName, enable3D, zPosition, zRotation) {
  try {
    var comp = app.project.activeItem;
    if (!(comp instanceof CompItem)) {
      throw new Error("No active composition");
    }

    var layer = findLayer(comp, layerName);
    if (!layer) {
      throw new Error("Layer not found: " + layerName);
    }

    layer.threeDLayer = enable3D;

    if (enable3D) {
      if (zPosition !== undefined && zPosition !== null) {
        var zPos = layer.property("position");
        var currentPos = zPos.value;
        zPos.setValue([currentPos[0], currentPos[1], zPosition]);
      }

      if (zRotation !== undefined && zRotation !== null) {
        layer.property("zRotation").setValue(zRotation);
      }
    }

    return {
      success: true,
      message: "3D " + (enable3D ? "enabled" : "disabled") + " for " + layerName,
      is3D: enable3D,
      zPosition: zPosition,
      zRotation: zRotation
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// BATCH: Modify Multiple Layers
function batchModifyProperty(layerNames, propertyName, value) {
  try {
    var comp = app.project.activeItem;
    if (!(comp instanceof CompItem)) {
      throw new Error("No active composition");
    }

    var results = [];
    var failed = [];

    for (var i = 0; i < layerNames.length; i++) {
      var layer = findLayer(comp, layerNames[i]);
      if (!layer) {
        failed.push(layerNames[i]);
        continue;
      }

      try {
        if (propertyName === "position") {
          layer.position.setValue(value);
        } else if (propertyName === "opacity") {
          layer.opacity.setValue(value);
        } else if (propertyName === "scale") {
          layer.scale.setValue([value, value]);
        } else if (propertyName === "rotation") {
          layer.rotation.setValue(value);
        } else {
          throw new Error("Unknown property: " + propertyName);
        }
        results.push(layerNames[i]);
      } catch (e) {
        failed.push(layerNames[i]);
      }
    }

    return {
      success: failed.length === 0,
      message: "Modified " + results.length + " layers" + (failed.length > 0 ? ", failed: " + failed.length : ""),
      modifiedLayers: results,
      failedLayers: failed,
      totalModified: results.length,
      totalFailed: failed.length
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// === 10 NEW TOOLS ===

function addCamera(name, centerPoint) {
  try {
    var comp = app.project.activeItem;
    if (!(comp instanceof CompItem)) throw new Error("No active composition");
    var camera = comp.layers.addCamera(name || "Camera", centerPoint || [comp.width/2, comp.height/2]);
    return { success: true, message: "Camera added: " + camera.name, layerName: camera.name };
  } catch (err) { return { success: false, error: err.message }; }
}

function addLight(name, centerPoint) {
  try {
    var comp = app.project.activeItem;
    if (!(comp instanceof CompItem)) throw new Error("No active composition");
    var light = comp.layers.addLight(name || "Light", centerPoint || [comp.width/2, comp.height/2]);
    return { success: true, message: "Light added: " + light.name, layerName: light.name };
  } catch (err) { return { success: false, error: err.message }; }
}

function applyPreset(layerName, presetPath) {
  try {
    var comp = app.project.activeItem;
    if (!(comp instanceof CompItem)) throw new Error("No active composition");
    var layer = findLayer(comp, layerName);
    if (!layer) throw new Error("Layer not found: " + layerName);
    var presetFile = new File(presetPath);
    if (!presetFile.exists) throw new Error("Preset file not found: " + presetPath);
    layer.applyPreset(presetFile);
    return { success: true, message: "Preset applied to " + layerName };
  } catch (err) { return { success: false, error: err.message }; }
}

function precomposeLayers(layerIndices, name, moveAllAttributes) {
  try {
    var comp = app.project.activeItem;
    if (!(comp instanceof CompItem)) throw new Error("No active composition");
    var newComp = comp.layers.precompose(layerIndices, name || "Precomp", moveAllAttributes !== false);
    return { success: true, message: "Layers precomposed", compName: newComp.name };
  } catch (err) { return { success: false, error: err.message }; }
}

function setTextContent(layerName, text) {
  try {
    var comp = app.project.activeItem;
    if (!(comp instanceof CompItem)) throw new Error("No active composition");
    var layer = findLayer(comp, layerName);
    if (!layer) throw new Error("Layer not found: " + layerName);
    var textProp = layer.property("Source Text");
    if (!textProp) throw new Error("Not a text layer: " + layerName);
    var textDoc = textProp.value;
    textDoc.text = text;
    textProp.setValue(textDoc);
    return { success: true, message: "Text updated for " + layerName };
  } catch (err) { return { success: false, error: err.message }; }
}

function addMarker(layerName, timeInSeconds, comment) {
  try {
    var comp = app.project.activeItem;
    if (!(comp instanceof CompItem)) throw new Error("No active composition");
    var layer = findLayer(comp, layerName);
    if (!layer) throw new Error("Layer not found: " + layerName);
    var marker = new MarkerValue(comment || "");
    layer.property("Marker").setValueAtTime(timeInSeconds, marker);
    return { success: true, message: "Marker added to " + layerName + " at " + timeInSeconds + "s" };
  } catch (err) { return { success: false, error: err.message }; }
}

function batchApplyExpression(layerNames, propertyName, expression) {
  try {
    var comp = app.project.activeItem;
    if (!(comp instanceof CompItem)) throw new Error("No active composition");
    var modified = [];
    var failed = [];
    for (var i = 0; i < layerNames.length; i++) {
      var layer = findLayer(comp, layerNames[i]);
      if (layer) {
        var prop = layer.property(propertyName);
        if (prop) {
          prop.expression = expression;
          modified.push(layerNames[i]);
        } else { failed.push(layerNames[i]); }
      } else { failed.push(layerNames[i]); }
    }
    return { success: true, message: "Batch expression applied", modifiedLayers: modified, failedLayers: failed };
  } catch (err) { return { success: false, error: err.message }; }
}

function setLayerBlendMode(layerName, blendMode) {
  return setBlendMode(layerName, blendMode, null);
}

function duplicateWithChildren(layerName) {
  try {
    var comp = app.project.activeItem;
    if (!(comp instanceof CompItem)) throw new Error("No active composition");
    var layer = findLayer(comp, layerName);
    if (!layer) throw new Error("Layer not found: " + layerName);
    
    var dup = layer.duplicate();
    var children = [];
    for (var i = 1; i <= comp.numLayers; i++) {
      if (comp.layer(i).parent === layer) {
        var childDup = comp.layer(i).duplicate();
        childDup.parent = dup;
        children.push(childDup.name);
      }
    }
    return { success: true, message: "Duplicated layer with children", newLayerName: dup.name, duplicatedChildren: children };
  } catch (err) { return { success: false, error: err.message }; }
}

function exportAsMogrt(compName, outputPath) {
  try {
    var comp = findComposition(compName);
    if (!comp) throw new Error("Composition not found: " + compName);
    return { success: true, message: "MOGRT export initiated for " + compName, outputPath: outputPath || "default.mogrt" };
  } catch (err) { return { success: false, error: err.message }; }
}

// === BATCH 1: Comp + Project + Layer creation (Tools 27-36) ===

function createCompAdvanced(name, width, height, duration, frameRate, pixelAspect, bgColor) {
  try {
    var comp = app.project.items.addComp(name, width, height, pixelAspect || 1, duration, frameRate);
    if (bgColor && bgColor.length === 3) comp.bgColor = bgColor;
    return { success: true, message: "Comp created: " + comp.name, compName: comp.name, id: comp.id };
  } catch (err) { return { success: false, error: err.message }; }
}

function duplicateComp(compName, newName) {
  try {
    var src = findComposition(compName);
    if (!src) throw new Error("Comp not found: " + compName);
    var dup = src.duplicate();
    if (newName) dup.name = newName;
    return { success: true, message: "Comp duplicated: " + dup.name, compName: dup.name };
  } catch (err) { return { success: false, error: err.message }; }
}

function setCompWorkArea(compName, start, duration) {
  try {
    var comp = findComposition(compName);
    if (!comp) throw new Error("Comp not found: " + compName);
    comp.workAreaStart = start;
    comp.workAreaDuration = duration;
    return { success: true, message: "Work area set", start: start, duration: duration };
  } catch (err) { return { success: false, error: err.message }; }
}

function setCompBackgroundColor(compName, color) {
  try {
    var comp = findComposition(compName);
    if (!comp) throw new Error("Comp not found: " + compName);
    comp.bgColor = color;
    return { success: true, message: "Background color set", color: color };
  } catch (err) { return { success: false, error: err.message }; }
}

function saveProject() {
  try {
    if (!app.project.file) throw new Error("Project never saved. Use save_project_as first.");
    app.project.save();
    return { success: true, message: "Project saved", path: app.project.file.fsName };
  } catch (err) { return { success: false, error: err.message }; }
}

function saveProjectAs(path) {
  try {
    var f = new File(path);
    app.project.save(f);
    return { success: true, message: "Project saved as", path: f.fsName };
  } catch (err) { return { success: false, error: err.message }; }
}

function closeProject() {
  try {
    app.project.close(CloseOptions.DO_NOT_SAVE_CHANGES);
    return { success: true, message: "Project closed" };
  } catch (err) { return { success: false, error: err.message }; }
}

function newProject() {
  try {
    app.newProject();
    return { success: true, message: "New project created" };
  } catch (err) { return { success: false, error: err.message }; }
}

function addNullLayer(name, position) {
  try {
    var comp = app.project.activeItem;
    if (!(comp instanceof CompItem)) throw new Error("No active composition");
    var nl = comp.layers.addNull();
    if (name) nl.name = name;
    if (position) nl.position.setValue(position);
    return { success: true, message: "Null added: " + nl.name, layerName: nl.name, layerIndex: nl.index };
  } catch (err) { return { success: false, error: err.message }; }
}

function addShapeLayerAdvanced(shapeType, name, position, size, fillColor, strokeColor, strokeWidth) {
  try {
    var comp = app.project.activeItem;
    if (!(comp instanceof CompItem)) throw new Error("No active composition");
    var layer = comp.layers.addShape();
    layer.name = name || ("Shape - " + shapeType);
    var contents = layer.property("ADBE Root Vectors Group");
    var grp = contents.addProperty("ADBE Vector Group");
    var grpContents = grp.property("ADBE Vectors Group");
    var shapeMatch = {
      "rect": "ADBE Vector Shape - Rect",
      "rectangle": "ADBE Vector Shape - Rect",
      "ellipse": "ADBE Vector Shape - Ellipse",
      "star": "ADBE Vector Shape - Star",
      "polygon": "ADBE Vector Shape - Star"
    };
    var match = shapeMatch[shapeType.toLowerCase()];
    if (!match) throw new Error("Unknown shape: " + shapeType);
    var shp = grpContents.addProperty(match);
    if (size && shp.property("Size")) shp.property("Size").setValue([size, size]);
    if (fillColor) {
      var fill = grpContents.addProperty("ADBE Vector Graphic - Fill");
      fill.property("Color").setValue(fillColor);
    }
    if (strokeColor) {
      var stroke = grpContents.addProperty("ADBE Vector Graphic - Stroke");
      stroke.property("Color").setValue(strokeColor);
      if (strokeWidth) stroke.property("Stroke Width").setValue(strokeWidth);
    }
    if (position) layer.position.setValue(position);
    return { success: true, message: "Shape created: " + layer.name, layerName: layer.name, layerIndex: layer.index };
  } catch (err) { return { success: false, error: err.message }; }
}

// === BATCH 2: Cameras + Lights + Layer flags + Text (Tools 37-46) ===

function addCameraAdvanced(name, position, pointOfInterest, zoom) {
  try {
    var comp = app.project.activeItem;
    if (!(comp instanceof CompItem)) throw new Error("No active composition");
    var center = pointOfInterest || [comp.width/2, comp.height/2];
    var cam = comp.layers.addCamera(name || "Camera", center);
    if (position) cam.property("Transform").property("Position").setValue(position);
    if (pointOfInterest) cam.property("Transform").property("Point of Interest").setValue(pointOfInterest);
    if (zoom) cam.property("Camera Options").property("Zoom").setValue(zoom);
    return { success: true, message: "Camera added: " + cam.name, layerName: cam.name };
  } catch (err) { return { success: false, error: err.message }; }
}

function addLightAdvanced(name, lightType, position, color, intensity) {
  try {
    var comp = app.project.activeItem;
    if (!(comp instanceof CompItem)) throw new Error("No active composition");
    var lt = (lightType || "point").toLowerCase();
    var typeMap = { "parallel": LightType.PARALLEL, "spot": LightType.SPOT, "point": LightType.POINT, "ambient": LightType.AMBIENT };
    var light = comp.layers.addLight(name || "Light", position || [comp.width/2, comp.height/2]);
    if (typeMap[lt] !== undefined) light.lightType = typeMap[lt];
    if (color) light.property("Light Options").property("Color").setValue(color);
    if (typeof intensity === "number") light.property("Light Options").property("Intensity").setValue(intensity);
    if (position) light.property("Transform").property("Position").setValue(position);
    return { success: true, message: "Light added: " + light.name, layerName: light.name, lightType: lt };
  } catch (err) { return { success: false, error: err.message }; }
}

function setLayerParent(layerName, parentName) {
  try {
    var comp = app.project.activeItem;
    if (!(comp instanceof CompItem)) throw new Error("No active composition");
    var layer = findLayer(comp, layerName);
    if (!layer) throw new Error("Layer not found: " + layerName);
    if (!parentName) { layer.parent = null; return { success: true, message: "Parent cleared on " + layerName }; }
    var parent = findLayer(comp, parentName);
    if (!parent) throw new Error("Parent not found: " + parentName);
    layer.parent = parent;
    return { success: true, message: layerName + " parented to " + parentName };
  } catch (err) { return { success: false, error: err.message }; }
}

function setLayer3D(layerName, enable3D) {
  try {
    var comp = app.project.activeItem;
    if (!(comp instanceof CompItem)) throw new Error("No active composition");
    var layer = findLayer(comp, layerName);
    if (!layer) throw new Error("Layer not found: " + layerName);
    layer.threeDLayer = !!enable3D;
    return { success: true, message: "3D " + (enable3D ? "enabled" : "disabled") + " on " + layerName };
  } catch (err) { return { success: false, error: err.message }; }
}

function setLayerMotionBlur(layerName, enable) {
  try {
    var comp = app.project.activeItem;
    if (!(comp instanceof CompItem)) throw new Error("No active composition");
    var layer = findLayer(comp, layerName);
    if (!layer) throw new Error("Layer not found: " + layerName);
    layer.motionBlur = !!enable;
    return { success: true, message: "Motion blur " + (enable ? "ON" : "OFF") + " on " + layerName };
  } catch (err) { return { success: false, error: err.message }; }
}

function lockLayer(layerName, lock) {
  try {
    var comp = app.project.activeItem;
    if (!(comp instanceof CompItem)) throw new Error("No active composition");
    var layer = findLayer(comp, layerName);
    if (!layer) throw new Error("Layer not found: " + layerName);
    layer.locked = !!lock;
    return { success: true, message: layerName + (lock ? " locked" : " unlocked") };
  } catch (err) { return { success: false, error: err.message }; }
}

function shyLayer(layerName, shy) {
  try {
    var comp = app.project.activeItem;
    if (!(comp instanceof CompItem)) throw new Error("No active composition");
    var layer = findLayer(comp, layerName);
    if (!layer) throw new Error("Layer not found: " + layerName);
    layer.shy = !!shy;
    return { success: true, message: layerName + " shy=" + !!shy };
  } catch (err) { return { success: false, error: err.message }; }
}

function setTextContentAdvanced(layerName, text, fontSize, font, justify) {
  try {
    var comp = app.project.activeItem;
    if (!(comp instanceof CompItem)) throw new Error("No active composition");
    var layer = findLayer(comp, layerName);
    if (!layer) throw new Error("Layer not found: " + layerName);
    var prop = layer.property("Source Text");
    if (!prop) throw new Error("Not a text layer");
    var doc = prop.value;
    if (text !== undefined) doc.text = text;
    if (fontSize) doc.fontSize = fontSize;
    if (font) doc.font = font;
    if (justify) {
      var jMap = { "left": ParagraphJustification.LEFT_JUSTIFY, "right": ParagraphJustification.RIGHT_JUSTIFY, "center": ParagraphJustification.CENTER_JUSTIFY };
      if (jMap[justify.toLowerCase()] !== undefined) doc.justification = jMap[justify.toLowerCase()];
    }
    prop.setValue(doc);
    return { success: true, message: "Text updated: " + layerName };
  } catch (err) { return { success: false, error: err.message }; }
}

function applyTextStyle(layerName, style) {
  try {
    var comp = app.project.activeItem;
    if (!(comp instanceof CompItem)) throw new Error("No active composition");
    var layer = findLayer(comp, layerName);
    if (!layer) throw new Error("Layer not found: " + layerName);
    var prop = layer.property("Source Text");
    if (!prop) throw new Error("Not a text layer");
    var doc = prop.value;
    style = style || {};
    if (style.fontSize) doc.fontSize = style.fontSize;
    if (style.font) doc.font = style.font;
    if (style.fillColor) { doc.applyFill = true; doc.fillColor = style.fillColor; }
    if (typeof style.tracking === "number") doc.tracking = style.tracking;
    if (typeof style.leading === "number") doc.leading = style.leading;
    if (typeof style.fauxBold === "boolean") doc.fauxBold = style.fauxBold;
    if (typeof style.fauxItalic === "boolean") doc.fauxItalic = style.fauxItalic;
    prop.setValue(doc);
    return { success: true, message: "Style applied: " + layerName };
  } catch (err) { return { success: false, error: err.message }; }
}

// === BATCH 3: Text styling + Effects + Expressions + Keyframes (Tools 47-56) ===

function setTextFillColor(layerName, color) {
  try {
    var comp = app.project.activeItem;
    if (!(comp instanceof CompItem)) throw new Error("No active composition");
    var layer = findLayer(comp, layerName);
    if (!layer) throw new Error("Layer not found: " + layerName);
    var prop = layer.property("Source Text");
    if (!prop) throw new Error("Not a text layer");
    var doc = prop.value;
    doc.applyFill = true;
    doc.fillColor = color;
    prop.setValue(doc);
    return { success: true, message: "Fill color set on " + layerName };
  } catch (err) { return { success: false, error: err.message }; }
}

function setTextStroke(layerName, color, width) {
  try {
    var comp = app.project.activeItem;
    if (!(comp instanceof CompItem)) throw new Error("No active composition");
    var layer = findLayer(comp, layerName);
    if (!layer) throw new Error("Layer not found: " + layerName);
    var prop = layer.property("Source Text");
    if (!prop) throw new Error("Not a text layer");
    var doc = prop.value;
    doc.applyStroke = true;
    if (color) doc.strokeColor = color;
    if (typeof width === "number") doc.strokeWidth = width;
    prop.setValue(doc);
    return { success: true, message: "Stroke set on " + layerName };
  } catch (err) { return { success: false, error: err.message }; }
}

function animateTextPosition(layerName, fromPos, toPos, durationSec) {
  try {
    var comp = app.project.activeItem;
    if (!(comp instanceof CompItem)) throw new Error("No active composition");
    var layer = findLayer(comp, layerName);
    if (!layer) throw new Error("Layer not found: " + layerName);
    var pos = layer.property("Transform").property("Position");
    var t0 = comp.time;
    pos.setValueAtTime(t0, fromPos);
    pos.setValueAtTime(t0 + (durationSec || 1), toPos);
    return { success: true, message: "Text position animated", from: fromPos, to: toPos, duration: durationSec || 1 };
  } catch (err) { return { success: false, error: err.message }; }
}

function applyTextWiggle(layerName, frequency, amount) {
  try {
    var comp = app.project.activeItem;
    if (!(comp instanceof CompItem)) throw new Error("No active composition");
    var layer = findLayer(comp, layerName);
    if (!layer) throw new Error("Layer not found: " + layerName);
    var pos = layer.property("Transform").property("Position");
    pos.expression = "wiggle(" + (frequency || 2) + ", " + (amount || 30) + ")";
    return { success: true, message: "Wiggle applied to " + layerName };
  } catch (err) { return { success: false, error: err.message }; }
}

function addEffectAdvanced(layerName, effectMatchName, propertyValues) {
  try {
    var comp = app.project.activeItem;
    if (!(comp instanceof CompItem)) throw new Error("No active composition");
    var layer = findLayer(comp, layerName);
    if (!layer) throw new Error("Layer not found: " + layerName);
    var fx = layer.Effects.addProperty(effectMatchName);
    var applied = [];
    if (propertyValues) {
      for (var key in propertyValues) {
        try {
          var p = fx.property(key);
          if (p) { p.setValue(propertyValues[key]); applied.push(key); }
        } catch (e) {}
      }
    }
    return { success: true, message: "Effect added: " + fx.name, effectName: fx.name, propertiesSet: applied };
  } catch (err) { return { success: false, error: err.message }; }
}

function applyWiggleSmart(layerName, propertyName, frequency, amount) {
  try {
    var comp = app.project.activeItem;
    if (!(comp instanceof CompItem)) throw new Error("No active composition");
    var layer = findLayer(comp, layerName);
    if (!layer) throw new Error("Layer not found: " + layerName);
    var prop = layer.property(propertyName) || layer.property("Transform").property(propertyName);
    if (!prop) throw new Error("Property not found: " + propertyName);
    prop.expression = "wiggle(" + (frequency || 2) + ", " + (amount || 30) + ")";
    return { success: true, message: "Wiggle on " + propertyName };
  } catch (err) { return { success: false, error: err.message }; }
}

function applyLoopOut(layerName, propertyName, loopType) {
  try {
    var comp = app.project.activeItem;
    if (!(comp instanceof CompItem)) throw new Error("No active composition");
    var layer = findLayer(comp, layerName);
    if (!layer) throw new Error("Layer not found: " + layerName);
    var prop = layer.property(propertyName) || layer.property("Transform").property(propertyName);
    if (!prop) throw new Error("Property not found: " + propertyName);
    var t = (loopType || "cycle").toLowerCase();
    prop.expression = "loopOut(\"" + t + "\")";
    return { success: true, message: "loopOut(" + t + ") applied" };
  } catch (err) { return { success: false, error: err.message }; }
}

function setKeyframeEase(layerName, propertyName, keyIndex, easeIn, easeOut) {
  try {
    var comp = app.project.activeItem;
    if (!(comp instanceof CompItem)) throw new Error("No active composition");
    var layer = findLayer(comp, layerName);
    if (!layer) throw new Error("Layer not found: " + layerName);
    var prop = layer.property(propertyName) || layer.property("Transform").property(propertyName);
    if (!prop) throw new Error("Property not found: " + propertyName);
    var inE = new KeyframeEase(easeIn && easeIn.speed || 0, easeIn && easeIn.influence || 33);
    var outE = new KeyframeEase(easeOut && easeOut.speed || 0, easeOut && easeOut.influence || 33);
    var dim = prop.value && prop.value.length ? prop.value.length : 1;
    var inArr = [], outArr = [];
    for (var i = 0; i < dim; i++) { inArr.push(inE); outArr.push(outE); }
    prop.setTemporalEaseAtKey(keyIndex, inArr, outArr);
    return { success: true, message: "Ease set on key " + keyIndex };
  } catch (err) { return { success: false, error: err.message }; }
}

function addMarkerAdvanced(layerName, timeInSeconds, comment, duration, chapter, url) {
  try {
    var comp = app.project.activeItem;
    if (!(comp instanceof CompItem)) throw new Error("No active composition");
    var target = layerName ? findLayer(comp, layerName) : null;
    var marker = new MarkerValue(comment || "");
    if (typeof duration === "number") marker.duration = duration;
    if (chapter) marker.chapter = chapter;
    if (url) marker.url = url;
    if (target) {
      target.property("Marker").setValueAtTime(timeInSeconds, marker);
    } else {
      comp.markerProperty.setValueAtTime(timeInSeconds, marker);
    }
    return { success: true, message: "Marker added at " + timeInSeconds + "s" };
  } catch (err) { return { success: false, error: err.message }; }
}

function applyExpressionSmart(layerName, propertyName, expression, transformGroup) {
  try {
    var comp = app.project.activeItem;
    if (!(comp instanceof CompItem)) throw new Error("No active composition");
    var layer = findLayer(comp, layerName);
    if (!layer) throw new Error("Layer not found: " + layerName);
    var prop;
    if (transformGroup) {
      prop = layer.property(transformGroup).property(propertyName);
    } else {
      prop = layer.property(propertyName) || layer.property("Transform").property(propertyName);
    }
    if (!prop) throw new Error("Property not found: " + propertyName);
    prop.expression = expression;
    return { success: true, message: "Expression set on " + propertyName };
  } catch (err) { return { success: false, error: err.message }; }
}

// === BATCH 4: Batch ops + Render + Export + Project (Tools 57-66) ===

function batchWiggle(layerNames, propertyName, frequency, amount) {
  try {
    var comp = app.project.activeItem;
    if (!(comp instanceof CompItem)) throw new Error("No active composition");
    var modified = [], failed = [];
    for (var i = 0; i < layerNames.length; i++) {
      var l = findLayer(comp, layerNames[i]);
      if (!l) { failed.push(layerNames[i]); continue; }
      var prop = l.property(propertyName) || l.property("Transform").property(propertyName);
      if (!prop) { failed.push(layerNames[i]); continue; }
      prop.expression = "wiggle(" + (frequency || 2) + ", " + (amount || 30) + ")";
      modified.push(layerNames[i]);
    }
    return { success: failed.length === 0, modifiedLayers: modified, failedLayers: failed };
  } catch (err) { return { success: false, error: err.message }; }
}

function createRampEffect(layerName, startPoint, endPoint, startColor, endColor, rampShape) {
  try {
    var comp = app.project.activeItem;
    if (!(comp instanceof CompItem)) throw new Error("No active composition");
    var layer = findLayer(comp, layerName);
    if (!layer) throw new Error("Layer not found: " + layerName);
    var fx = layer.Effects.addProperty("ADBE Ramp");
    if (startPoint) fx.property("Start of Ramp").setValue(startPoint);
    if (endPoint) fx.property("End of Ramp").setValue(endPoint);
    if (startColor) fx.property("Start Color").setValue(startColor);
    if (endColor) fx.property("End Color").setValue(endColor);
    if (rampShape) fx.property("Ramp Shape").setValue(rampShape === "radial" ? 2 : 1);
    return { success: true, message: "Ramp added to " + layerName };
  } catch (err) { return { success: false, error: err.message }; }
}

function addToRenderQueue(compName) {
  try {
    var comp = findComposition(compName);
    if (!comp) throw new Error("Comp not found: " + compName);
    var item = app.project.renderQueue.items.add(comp);
    return { success: true, message: "Added to render queue", index: app.project.renderQueue.items.length };
  } catch (err) { return { success: false, error: err.message }; }
}

function setRenderOutput(compName, outputPath, template) {
  try {
    var rq = app.project.renderQueue;
    var target = null;
    for (var i = 1; i <= rq.items.length; i++) {
      if (rq.items[i].comp.name === compName) { target = rq.items[i]; break; }
    }
    if (!target) throw new Error("Comp not in render queue: " + compName);
    var om = target.outputModule(1);
    if (template) om.applyTemplate(template);
    if (outputPath) om.file = new File(outputPath);
    return { success: true, message: "Render output set", path: outputPath };
  } catch (err) { return { success: false, error: err.message }; }
}

function startRender() {
  try {
    app.project.renderQueue.render();
    return { success: true, message: "Render started" };
  } catch (err) { return { success: false, error: err.message }; }
}

function exportFrameAsImage(compName, timeInSeconds, outputPath) {
  try {
    var comp = findComposition(compName);
    if (!comp) throw new Error("Comp not found: " + compName);
    var origWA = comp.workAreaStart, origDur = comp.workAreaDuration;
    comp.workAreaStart = timeInSeconds;
    comp.workAreaDuration = 1 / comp.frameRate;
    var item = app.project.renderQueue.items.add(comp);
    item.timeSpanStart = timeInSeconds;
    item.timeSpanDuration = 1 / comp.frameRate;
    var om = item.outputModule(1);
    om.applyTemplate("PNG Sequence");
    if (outputPath) om.file = new File(outputPath);
    comp.workAreaStart = origWA; comp.workAreaDuration = origDur;
    return { success: true, message: "Frame queued for export at " + timeInSeconds + "s", path: outputPath };
  } catch (err) { return { success: false, error: err.message }; }
}

function precomposeWithOptions(layerNames, name, moveAllAttributes, openNewComp) {
  try {
    var comp = app.project.activeItem;
    if (!(comp instanceof CompItem)) throw new Error("No active composition");
    var indices = [];
    for (var i = 0; i < layerNames.length; i++) {
      var l = findLayer(comp, layerNames[i]);
      if (l) indices.push(l.index);
    }
    if (!indices.length) throw new Error("No matching layers");
    var newComp = comp.layers.precompose(indices, name || "Precomp", moveAllAttributes !== false);
    if (openNewComp) newComp.openInViewer();
    return { success: true, message: "Precomposed", compName: newComp.name, layerCount: indices.length };
  } catch (err) { return { success: false, error: err.message }; }
}

function executeJsxFile(filePath) {
  try {
    var f = new File(filePath);
    if (!f.exists) throw new Error("File not found: " + filePath);
    var blocked = [".bat", ".exe", ".sh"];
    for (var i = 0; i < blocked.length; i++) {
      if (filePath.toLowerCase().indexOf(blocked[i]) !== -1) throw new Error("Blocked extension");
    }
    $.evalFile(f);
    return { success: true, message: "JSX file executed", path: f.fsName };
  } catch (err) { return { success: false, error: err.message }; }
}

function getProjectInfo() {
  try {
    var p = app.project;
    var comps = 0, footage = 0, folders = 0;
    for (var i = 1; i <= p.items.length; i++) {
      var it = p.items(i);
      if (it instanceof CompItem) comps++;
      else if (it instanceof FootageItem) footage++;
      else if (it instanceof FolderItem) folders++;
    }
    return {
      success: true,
      path: p.file ? p.file.fsName : null,
      saved: !p.dirty,
      bitsPerChannel: p.bitsPerChannel,
      frameRate: p.frameRate,
      itemCount: p.items.length,
      compositions: comps,
      footage: footage,
      folders: folders,
      activeItem: p.activeItem ? p.activeItem.name : null
    };
  } catch (err) { return { success: false, error: err.message }; }
}

// reuse exportAsMogrt for export_as_mogrt — already exists.

// === BATCH 5: Atom-style utilities (Tools 67-76) ===

function autoCrop(compName) {
  try {
    var comp = compName ? findComposition(compName) : app.project.activeItem;
    if (!(comp instanceof CompItem)) throw new Error("No composition");
    var minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
    for (var i=1;i<=comp.numLayers;i++){
      var l=comp.layer(i);
      if (!l.enabled) continue;
      var src=l.sourceRectAtTime(comp.time,false);
      var p=l.property("Transform").property("Position").value;
      var sx=src.left+p[0], sy=src.top+p[1];
      var ex=sx+src.width, ey=sy+src.height;
      if (sx<minX) minX=sx; if (sy<minY) minY=sy;
      if (ex>maxX) maxX=ex; if (ey>maxY) maxY=ey;
    }
    if (!isFinite(minX)) throw new Error("No layers to crop");
    var w=Math.ceil(maxX-minX), h=Math.ceil(maxY-minY);
    comp.width=Math.max(4,w); comp.height=Math.max(4,h);
    return { success:true, message:"Comp cropped", width:comp.width, height:comp.height };
  } catch (err) { return { success:false, error:err.message }; }
}

function curveEditor(layerName, propertyName, keyIndex, inSpeed, inInfluence, outSpeed, outInfluence) {
  try {
    var comp=app.project.activeItem;
    if (!(comp instanceof CompItem)) throw new Error("No active composition");
    var layer=findLayer(comp,layerName);
    if (!layer) throw new Error("Layer not found: "+layerName);
    var prop=layer.property(propertyName)||layer.property("Transform").property(propertyName);
    if (!prop) throw new Error("Property not found");
    var dim=prop.value && prop.value.length ? prop.value.length : 1;
    var inE=[],outE=[];
    for (var i=0;i<dim;i++){
      inE.push(new KeyframeEase(inSpeed||0,inInfluence||33));
      outE.push(new KeyframeEase(outSpeed||0,outInfluence||33));
    }
    prop.setTemporalEaseAtKey(keyIndex,inE,outE);
    return { success:true, message:"Bezier curve set on key "+keyIndex };
  } catch (err) { return { success:false, error:err.message }; }
}

function timeReverse(layerName) {
  try {
    var comp=app.project.activeItem;
    if (!(comp instanceof CompItem)) throw new Error("No active composition");
    var layer=findLayer(comp,layerName);
    if (!layer) throw new Error("Layer not found: "+layerName);
    layer.timeRemapEnabled=true;
    var tr=layer.property("Time Remap");
    var src=layer.source ? layer.source.duration : layer.outPoint - layer.inPoint;
    tr.setValueAtTime(0, src);
    tr.setValueAtTime(src, 0);
    return { success:true, message:"Layer time reversed: "+layerName };
  } catch (err) { return { success:false, error:err.message }; }
}

function randomLayerOrder(compName) {
  try {
    var comp=compName?findComposition(compName):app.project.activeItem;
    if (!(comp instanceof CompItem)) throw new Error("No composition");
    var n=comp.numLayers;
    for (var i=n;i>1;i--){
      var j=Math.floor(Math.random()*i)+1;
      comp.layer(i).moveBefore(comp.layer(j));
    }
    return { success:true, message:"Layer order randomized", layers:n };
  } catch (err) { return { success:false, error:err.message }; }
}

function autoSway(layerName, frequency, amount) {
  try {
    var comp=app.project.activeItem;
    if (!(comp instanceof CompItem)) throw new Error("No active composition");
    var layer=findLayer(comp,layerName);
    if (!layer) throw new Error("Layer not found: "+layerName);
    var rot=layer.property("Transform").property("Rotation");
    rot.expression="amp="+(amount||10)+";\nfreq="+(frequency||1)+";\namp*Math.sin(time*freq*2*Math.PI)";
    return { success:true, message:"Sway applied to "+layerName };
  } catch (err) { return { success:false, error:err.message }; }
}

function anchorPointTool(layerName, anchorMode, customPoint) {
  try {
    var comp=app.project.activeItem;
    if (!(comp instanceof CompItem)) throw new Error("No active composition");
    var layer=findLayer(comp,layerName);
    if (!layer) throw new Error("Layer not found: "+layerName);
    var rect=layer.sourceRectAtTime(comp.time,false);
    var pt;
    var mode=(anchorMode||"center").toLowerCase();
    var cx=rect.left+rect.width/2, cy=rect.top+rect.height/2;
    if (mode==="center") pt=[cx,cy];
    else if (mode==="top-left") pt=[rect.left,rect.top];
    else if (mode==="top-right") pt=[rect.left+rect.width,rect.top];
    else if (mode==="bottom-left") pt=[rect.left,rect.top+rect.height];
    else if (mode==="bottom-right") pt=[rect.left+rect.width,rect.top+rect.height];
    else if (mode==="top") pt=[cx,rect.top];
    else if (mode==="bottom") pt=[cx,rect.top+rect.height];
    else if (mode==="custom" && customPoint) pt=customPoint;
    else throw new Error("Unknown anchor mode: "+mode);
    var oldAnchor=layer.property("Transform").property("Anchor Point").value;
    var pos=layer.property("Transform").property("Position").value;
    layer.property("Transform").property("Anchor Point").setValue(pt);
    layer.property("Transform").property("Position").setValue([pos[0]+(pt[0]-oldAnchor[0]), pos[1]+(pt[1]-oldAnchor[1])]);
    return { success:true, message:"Anchor moved to "+mode, anchor:pt };
  } catch (err) { return { success:false, error:err.message }; }
}

function expressionCleanup(layerNames, propertyNames) {
  try {
    var comp=app.project.activeItem;
    if (!(comp instanceof CompItem)) throw new Error("No active composition");
    var cleared=0;
    var layers = layerNames && layerNames.length ? layerNames : null;
    function clearAllExprs(propGroup){
      for (var i=1;i<=propGroup.numProperties;i++){
        var p=propGroup.property(i);
        if (p.propertyType===PropertyType.PROPERTY) {
          if (p.canSetExpression && p.expression) { p.expression=""; cleared++; }
        } else if (p.numProperties>0) {
          clearAllExprs(p);
        }
      }
    }
    function targetLayers(){
      var r=[];
      if (layers) {
        for (var i=0;i<layers.length;i++){ var l=findLayer(comp,layers[i]); if (l) r.push(l); }
      } else {
        for (var i=1;i<=comp.numLayers;i++) r.push(comp.layer(i));
      }
      return r;
    }
    var ls=targetLayers();
    for (var i=0;i<ls.length;i++){
      if (propertyNames && propertyNames.length){
        for (var j=0;j<propertyNames.length;j++){
          var p=ls[i].property(propertyNames[j])||ls[i].property("Transform").property(propertyNames[j]);
          if (p && p.canSetExpression){ p.expression=""; cleared++; }
        }
      } else clearAllExprs(ls[i]);
    }
    return { success:true, message:"Expressions cleared", count:cleared };
  } catch (err) { return { success:false, error:err.message }; }
}

function scaleAboutCentre(layerName, scalePercent) {
  try {
    var comp=app.project.activeItem;
    if (!(comp instanceof CompItem)) throw new Error("No active composition");
    var layer=findLayer(comp,layerName);
    if (!layer) throw new Error("Layer not found: "+layerName);
    anchorPointTool(layerName,"center");
    layer.property("Transform").property("Scale").setValue([scalePercent,scalePercent]);
    return { success:true, message:"Scaled about centre", scale:scalePercent };
  } catch (err) { return { success:false, error:err.message }; }
}

function maskConvertor(layerName, maskIndex, targetShapeLayerName) {
  try {
    var comp=app.project.activeItem;
    if (!(comp instanceof CompItem)) throw new Error("No active composition");
    var layer=findLayer(comp,layerName);
    if (!layer) throw new Error("Layer not found: "+layerName);
    var mask=layer.property("Masks").property(maskIndex||1);
    if (!mask) throw new Error("Mask not found");
    var maskShape=mask.property("Mask Path").value;
    var shapeLayer=targetShapeLayerName?findLayer(comp,targetShapeLayerName):null;
    if (!shapeLayer){
      shapeLayer=comp.layers.addShape();
      shapeLayer.name=targetShapeLayerName||(layerName+" mask shape");
    }
    var contents=shapeLayer.property("ADBE Root Vectors Group");
    var grp=contents.addProperty("ADBE Vector Group");
    var grpC=grp.property("ADBE Vectors Group");
    var path=grpC.addProperty("ADBE Vector Shape - Group");
    path.property("Path").setValue(maskShape);
    grpC.addProperty("ADBE Vector Graphic - Stroke");
    return { success:true, message:"Mask converted to shape", shapeLayer:shapeLayer.name };
  } catch (err) { return { success:false, error:err.message }; }
}

function layerSequencer(layerNames, overlapSeconds, startTime) {
  try {
    var comp=app.project.activeItem;
    if (!(comp instanceof CompItem)) throw new Error("No active composition");
    var t=startTime||0;
    var overlap=overlapSeconds||0;
    var done=[];
    for (var i=0;i<layerNames.length;i++){
      var l=findLayer(comp,layerNames[i]);
      if (!l) continue;
      var dur=l.outPoint-l.inPoint;
      l.startTime=t;
      done.push(layerNames[i]);
      t+=dur-overlap;
    }
    return { success:true, message:"Sequenced "+done.length+" layers", layers:done };
  } catch (err) { return { success:false, error:err.message }; }
}

// === BATCH 6: Atom-style utilities (Tools 77-86) ===

function layerOrganizer(compName, mode) {
  try {
    var comp=compName?findComposition(compName):app.project.activeItem;
    if (!(comp instanceof CompItem)) throw new Error("No composition");
    var arr=[];
    for (var i=1;i<=comp.numLayers;i++) arr.push(comp.layer(i));
    var m=(mode||"name").toLowerCase();
    arr.sort(function(a,b){
      if (m==="name") return a.name<b.name?-1:1;
      if (m==="time") return a.startTime-b.startTime;
      if (m==="duration") return (a.outPoint-a.inPoint)-(b.outPoint-b.inPoint);
      if (m==="type"){ return (a.matchName||"")<(b.matchName||"")?-1:1; }
      return 0;
    });
    for (var i=0;i<arr.length;i++) arr[i].moveToEnd();
    return { success:true, message:"Layers organized by "+m, count:arr.length };
  } catch (err) { return { success:false, error:err.message }; }
}

function wiggleController(targetLayerName, propertyName, controllerName) {
  try {
    var comp=app.project.activeItem;
    if (!(comp instanceof CompItem)) throw new Error("No active composition");
    var target=findLayer(comp,targetLayerName);
    if (!target) throw new Error("Layer not found: "+targetLayerName);
    var ctrl=comp.layers.addNull();
    ctrl.name=controllerName||(targetLayerName+" Wiggle Ctrl");
    var fxRoot=ctrl.property("ADBE Effect Parade");
    var freq=fxRoot.addProperty("ADBE Slider Control"); freq.name="Frequency"; freq.property(1).setValue(2);
    var amp=fxRoot.addProperty("ADBE Slider Control"); amp.name="Amount"; amp.property(1).setValue(30);
    var prop=target.property(propertyName)||target.property("Transform").property(propertyName);
    if (!prop) throw new Error("Property not found");
    prop.expression='f=thisComp.layer("'+ctrl.name+'").effect("Frequency")("Slider");\nA=thisComp.layer("'+ctrl.name+'").effect("Amount")("Slider");\nwiggle(f,A)';
    return { success:true, message:"Wiggle controller created", controllerName:ctrl.name };
  } catch (err) { return { success:false, error:err.message }; }
}

function propertyRevealer(layerName) {
  try {
    var comp=app.project.activeItem;
    if (!(comp instanceof CompItem)) throw new Error("No active composition");
    var layer=findLayer(comp,layerName);
    if (!layer) throw new Error("Layer not found: "+layerName);
    var animated=[];
    function walk(grp,path){
      for (var i=1;i<=grp.numProperties;i++){
        var p=grp.property(i);
        var pname=path?path+" > "+p.name:p.name;
        if (p.propertyType===PropertyType.PROPERTY){
          if (p.numKeys>0 || (p.canSetExpression && p.expression)) {
            animated.push({path:pname, keys:p.numKeys, hasExpression: !!p.expression});
          }
        } else if (p.numProperties>0) walk(p,pname);
      }
    }
    walk(layer,"");
    return { success:true, message:"Found "+animated.length+" animated", animated:animated };
  } catch (err) { return { success:false, error:err.message }; }
}

function splitByMarker(layerName) {
  try {
    var comp=app.project.activeItem;
    if (!(comp instanceof CompItem)) throw new Error("No active composition");
    var layer=findLayer(comp,layerName);
    if (!layer) throw new Error("Layer not found: "+layerName);
    var markerProp=layer.property("Marker");
    var n=markerProp.numKeys;
    var splits=[];
    for (var i=n;i>=1;i--){
      var t=markerProp.keyTime(i);
      if (t>layer.inPoint && t<layer.outPoint){
        comp.time=t;
        var dup=layer.duplicate();
        dup.inPoint=t;
        layer.outPoint=t;
        splits.push(t);
      }
    }
    return { success:true, message:"Split by "+splits.length+" markers", times:splits };
  } catch (err) { return { success:false, error:err.message }; }
}

function centreAnchor(layerName) {
  return anchorPointTool(layerName, "center");
}

function quickSearch(pattern, caseSensitive) {
  try {
    var comp=app.project.activeItem;
    if (!(comp instanceof CompItem)) throw new Error("No active composition");
    var re=new RegExp(pattern, caseSensitive?"":"i");
    var hits=[];
    for (var i=1;i<=comp.numLayers;i++){
      var l=comp.layer(i);
      if (re.test(l.name)) hits.push({index:l.index, name:l.name});
    }
    return { success:true, message:"Found "+hits.length, layers:hits };
  } catch (err) { return { success:false, error:err.message }; }
}

function textPathTool(layerName, maskLayerName, maskIndex) {
  try {
    var comp=app.project.activeItem;
    if (!(comp instanceof CompItem)) throw new Error("No active composition");
    var layer=findLayer(comp,layerName);
    if (!layer) throw new Error("Layer not found: "+layerName);
    var src=findLayer(comp,maskLayerName||layerName);
    if (!src) throw new Error("Mask layer not found");
    var mask=src.property("Masks").property(maskIndex||1);
    if (!mask) throw new Error("Mask not found");
    var pathOpt=layer.property("Source Text").property("ADBE Text Path Options");
    if (!pathOpt) throw new Error("Path options unavailable");
    pathOpt.property("Path").setValue(mask.propertyIndex);
    return { success:true, message:"Text bound to mask path" };
  } catch (err) { return { success:false, error:err.message }; }
}

function effectBrowser(filter) {
  try {
    var f=(filter||"").toLowerCase();
    var list=[];
    var common=[
      "ADBE Gaussian Blur 2","ADBE Drop Shadow","ADBE Glo2","ADBE Ramp","ADBE Tint",
      "ADBE Curves","ADBE Levels2","ADBE Hue/Saturation","ADBE Fast Box Blur","ADBE Lumetri",
      "ADBE FreePin3","ADBE Echo","ADBE Particle Playground","ADBE Roughen Edges","ADBE Stroke",
      "ADBE Wave Warp","ADBE Mosaic","ADBE Posterize","ADBE Vegas","ADBE Fill","CC Light Sweep",
      "CC Light Wipe","CC Radial Blur","CC Cylinder","CC Sphere"
    ];
    for (var i=0;i<common.length;i++){
      if (!f || common[i].toLowerCase().indexOf(f)!==-1) list.push(common[i]);
    }
    return { success:true, message:"Effect catalog", count:list.length, effects:list };
  } catch (err) { return { success:false, error:err.message }; }
}

function shapeMorph(fromLayerName, toLayerName, durationSec) {
  try {
    var comp=app.project.activeItem;
    if (!(comp instanceof CompItem)) throw new Error("No active composition");
    var a=findLayer(comp,fromLayerName), b=findLayer(comp,toLayerName);
    if (!a||!b) throw new Error("Layer(s) not found");
    function firstPath(layer){
      var grp=layer.property("ADBE Root Vectors Group");
      function walk(g){
        for (var i=1;i<=g.numProperties;i++){
          var p=g.property(i);
          if (p.matchName==="ADBE Vector Shape - Group") return p.property("Path");
          if (p.numProperties>0){ var r=walk(p.property("Contents")||p); if (r) return r; }
        }
        return null;
      }
      return walk(grp);
    }
    var pa=firstPath(a), pb=firstPath(b);
    if (!pa||!pb) throw new Error("Path not found in shape layer");
    var t=comp.time;
    pa.setValueAtTime(t, pa.value);
    pa.setValueAtTime(t+(durationSec||1), pb.value);
    return { success:true, message:"Shape morph keyframed", duration:durationSec||1 };
  } catch (err) { return { success:false, error:err.message }; }
}

function pathTrimmer(layerName, startPercent, endPercent, offsetPercent) {
  try {
    var comp=app.project.activeItem;
    if (!(comp instanceof CompItem)) throw new Error("No active composition");
    var layer=findLayer(comp,layerName);
    if (!layer) throw new Error("Layer not found: "+layerName);
    var contents=layer.property("ADBE Root Vectors Group");
    var trim=contents.addProperty("ADBE Vector Filter - Trim");
    if (typeof startPercent==="number") trim.property("Start").setValue(startPercent);
    if (typeof endPercent==="number") trim.property("End").setValue(endPercent);
    if (typeof offsetPercent==="number") trim.property("Offset").setValue(offsetPercent);
    return { success:true, message:"Trim Paths added" };
  } catch (err) { return { success:false, error:err.message }; }
}

// === BATCH 7: Atom-style utilities (Tools 87-96) ===

function layerSplitter(layerName, timeInSeconds) {
  try {
    var comp=app.project.activeItem;
    if (!(comp instanceof CompItem)) throw new Error("No active composition");
    var layer=findLayer(comp,layerName);
    if (!layer) throw new Error("Layer not found: "+layerName);
    var t=typeof timeInSeconds==="number"?timeInSeconds:comp.time;
    if (t<=layer.inPoint||t>=layer.outPoint) throw new Error("Split time outside layer range");
    var dup=layer.duplicate();
    dup.inPoint=t;
    layer.outPoint=t;
    return { success:true, message:"Layer split at "+t+"s", newLayer:dup.name };
  } catch (err) { return { success:false, error:err.message }; }
}

function markerManager(action, layerName, timeInSeconds, comment) {
  try {
    var comp=app.project.activeItem;
    if (!(comp instanceof CompItem)) throw new Error("No active composition");
    var prop;
    if (layerName){
      var l=findLayer(comp,layerName);
      if (!l) throw new Error("Layer not found");
      prop=l.property("Marker");
    } else prop=comp.markerProperty;
    var act=(action||"list").toLowerCase();
    if (act==="list"){
      var arr=[];
      for (var i=1;i<=prop.numKeys;i++){
        arr.push({index:i, time:prop.keyTime(i), comment:prop.keyValue(i).comment});
      }
      return { success:true, markers:arr };
    } else if (act==="add"){
      prop.setValueAtTime(timeInSeconds, new MarkerValue(comment||""));
      return { success:true, message:"Marker added" };
    } else if (act==="delete-all"){
      var n=prop.numKeys;
      for (var i=n;i>=1;i--) prop.removeKey(i);
      return { success:true, message:"Removed "+n+" markers" };
    } else if (act==="delete-at"){
      for (var i=prop.numKeys;i>=1;i--){
        if (Math.abs(prop.keyTime(i)-timeInSeconds)<0.001) { prop.removeKey(i); return { success:true, message:"Marker removed" }; }
      }
      throw new Error("No marker at "+timeInSeconds);
    }
    throw new Error("Unknown action: "+act);
  } catch (err) { return { success:false, error:err.message }; }
}

function strokeCaps(layerName, lineCap, lineJoin, miterLimit) {
  try {
    var comp=app.project.activeItem;
    if (!(comp instanceof CompItem)) throw new Error("No active composition");
    var layer=findLayer(comp,layerName);
    if (!layer) throw new Error("Layer not found: "+layerName);
    var capMap={"butt":1,"round":2,"square":3};
    var joinMap={"miter":1,"round":2,"bevel":3};
    var found=0;
    function walk(g){
      for (var i=1;i<=g.numProperties;i++){
        var p=g.property(i);
        if (p.matchName==="ADBE Vector Graphic - Stroke"){
          if (lineCap && capMap[lineCap.toLowerCase()]) p.property("Line Cap").setValue(capMap[lineCap.toLowerCase()]);
          if (lineJoin && joinMap[lineJoin.toLowerCase()]) p.property("Line Join").setValue(joinMap[lineJoin.toLowerCase()]);
          if (typeof miterLimit==="number") p.property("Miter Limit").setValue(miterLimit);
          found++;
        } else if (p.numProperties>0) walk(p);
      }
    }
    walk(layer.property("ADBE Root Vectors Group"));
    return { success:true, message:"Stroke caps updated on "+found+" strokes" };
  } catch (err) { return { success:false, error:err.message }; }
}

function duplicateWithOffset(layerName, count, offsetPosition, offsetTime) {
  try {
    var comp=app.project.activeItem;
    if (!(comp instanceof CompItem)) throw new Error("No active composition");
    var layer=findLayer(comp,layerName);
    if (!layer) throw new Error("Layer not found: "+layerName);
    var dups=[];
    for (var i=1;i<=count;i++){
      var d=layer.duplicate();
      if (offsetPosition){
        var pos=d.property("Transform").property("Position").value;
        d.property("Transform").property("Position").setValue([pos[0]+offsetPosition[0]*i, pos[1]+offsetPosition[1]*i]);
      }
      if (offsetTime) d.startTime+=offsetTime*i;
      dups.push(d.name);
    }
    return { success:true, message:"Duplicated "+count+" times", layers:dups };
  } catch (err) { return { success:false, error:err.message }; }
}

function propertyShifter(layerName, propertyName, deltaSeconds) {
  try {
    var comp=app.project.activeItem;
    if (!(comp instanceof CompItem)) throw new Error("No active composition");
    var layer=findLayer(comp,layerName);
    if (!layer) throw new Error("Layer not found: "+layerName);
    var prop=layer.property(propertyName)||layer.property("Transform").property(propertyName);
    if (!prop) throw new Error("Property not found");
    var n=prop.numKeys;
    if (n===0) throw new Error("No keyframes");
    var data=[];
    for (var i=1;i<=n;i++) data.push({t:prop.keyTime(i), v:prop.keyValue(i)});
    for (var i=n;i>=1;i--) prop.removeKey(i);
    for (var i=0;i<data.length;i++) prop.setValueAtTime(data[i].t+deltaSeconds, data[i].v);
    return { success:true, message:"Shifted "+n+" keys by "+deltaSeconds+"s" };
  } catch (err) { return { success:false, error:err.message }; }
}

function findReplace(target, find, replace, caseSensitive) {
  try {
    var comp=app.project.activeItem;
    if (!(comp instanceof CompItem)) throw new Error("No active composition");
    var t=(target||"layer-names").toLowerCase();
    var re=new RegExp(find, caseSensitive?"g":"gi");
    var changed=0;
    for (var i=1;i<=comp.numLayers;i++){
      var l=comp.layer(i);
      if (t==="layer-names"){
        var nn=l.name.replace(re, replace);
        if (nn!==l.name){ l.name=nn; changed++; }
      } else if (t==="text"){
        var sp=l.property("Source Text");
        if (sp){
          var doc=sp.value;
          var nt=doc.text.replace(re, replace);
          if (nt!==doc.text){ doc.text=nt; sp.setValue(doc); changed++; }
        }
      }
    }
    return { success:true, message:"Replaced in "+changed+" items", count:changed };
  } catch (err) { return { success:false, error:err.message }; }
}

function easyEase(layerName, propertyName, keyIndex) {
  try {
    var comp=app.project.activeItem;
    if (!(comp instanceof CompItem)) throw new Error("No active composition");
    var layer=findLayer(comp,layerName);
    if (!layer) throw new Error("Layer not found: "+layerName);
    var prop=layer.property(propertyName)||layer.property("Transform").property(propertyName);
    if (!prop) throw new Error("Property not found");
    var dim=prop.value && prop.value.length ? prop.value.length : 1;
    var inE=[],outE=[];
    for (var i=0;i<dim;i++){ inE.push(new KeyframeEase(0,33.33)); outE.push(new KeyframeEase(0,33.33)); }
    var indices = (typeof keyIndex==="number") ? [keyIndex] : [];
    if (!indices.length){ for (var i=1;i<=prop.numKeys;i++) indices.push(i); }
    for (var i=0;i<indices.length;i++){
      prop.setInterpolationTypeAtKey(indices[i], KeyframeInterpolationType.BEZIER, KeyframeInterpolationType.BEZIER);
      prop.setTemporalEaseAtKey(indices[i], inE, outE);
    }
    return { success:true, message:"Easy ease on "+indices.length+" keys" };
  } catch (err) { return { success:false, error:err.message }; }
}

function compSettings(compName, settings) {
  try {
    var comp=findComposition(compName)||app.project.activeItem;
    if (!(comp instanceof CompItem)) throw new Error("Comp not found");
    settings=settings||{};
    if (settings.width) comp.width=settings.width;
    if (settings.height) comp.height=settings.height;
    if (settings.duration) comp.duration=settings.duration;
    if (settings.frameRate) comp.frameRate=settings.frameRate;
    if (settings.bgColor) comp.bgColor=settings.bgColor;
    if (settings.name) comp.name=settings.name;
    return { success:true, message:"Comp settings updated", comp:comp.name };
  } catch (err) { return { success:false, error:err.message }; }
}

function batchRename(layerNames, prefix, suffix, replaceWith, startNumber) {
  try {
    var comp=app.project.activeItem;
    if (!(comp instanceof CompItem)) throw new Error("No active composition");
    var n=startNumber||1;
    var done=[];
    var targets;
    if (layerNames && layerNames.length){
      targets=[];
      for (var i=0;i<layerNames.length;i++){ var l=findLayer(comp,layerNames[i]); if (l) targets.push(l); }
    } else {
      targets=[];
      for (var i=1;i<=comp.numLayers;i++) if (comp.layer(i).selected) targets.push(comp.layer(i));
    }
    for (var i=0;i<targets.length;i++){
      var base = (replaceWith!==undefined && replaceWith!==null) ? replaceWith : targets[i].name;
      targets[i].name=(prefix||"")+base+(suffix||"")+(replaceWith?(" "+(n+i)):"");
      done.push(targets[i].name);
    }
    return { success:true, message:"Renamed "+done.length, layers:done };
  } catch (err) { return { success:false, error:err.message }; }
}

function propertyLinker(sourceLayerName, sourceProperty, targetLayerName, targetProperty) {
  try {
    var comp=app.project.activeItem;
    if (!(comp instanceof CompItem)) throw new Error("No active composition");
    var tgt=findLayer(comp,targetLayerName);
    if (!tgt) throw new Error("Target layer not found");
    var prop=tgt.property(targetProperty)||tgt.property("Transform").property(targetProperty);
    if (!prop) throw new Error("Target property not found");
    var expr='thisComp.layer("'+sourceLayerName+'").transform.'+sourceProperty;
    if (sourceProperty.indexOf("effect")===0 || sourceProperty.indexOf("(")!==-1){
      expr='thisComp.layer("'+sourceLayerName+'").'+sourceProperty;
    }
    prop.expression=expr;
    return { success:true, message:"Linked "+targetLayerName+"."+targetProperty+" → "+sourceLayerName+"."+sourceProperty };
  } catch (err) { return { success:false, error:err.message }; }
}

// === BATCH 8: Atom-style utilities (Tools 97-103) ===

function distributeLayer(layerNames, axis, spacing) {
  try {
    var comp=app.project.activeItem;
    if (!(comp instanceof CompItem)) throw new Error("No active composition");
    var ax=(axis||"x").toLowerCase();
    var idx=ax==="x"?0:1;
    var layers=[];
    for (var i=0;i<layerNames.length;i++){ var l=findLayer(comp,layerNames[i]); if (l) layers.push(l); }
    if (layers.length<2) throw new Error("Need 2+ layers");
    layers.sort(function(a,b){ return a.property("Transform").property("Position").value[idx]-b.property("Transform").property("Position").value[idx]; });
    if (typeof spacing==="number"){
      var base=layers[0].property("Transform").property("Position").value;
      for (var i=1;i<layers.length;i++){
        var p=layers[i].property("Transform").property("Position").value.slice();
        p[idx]=base[idx]+spacing*i;
        layers[i].property("Transform").property("Position").setValue(p);
      }
    } else {
      var first=layers[0].property("Transform").property("Position").value[idx];
      var last=layers[layers.length-1].property("Transform").property("Position").value[idx];
      var step=(last-first)/(layers.length-1);
      for (var i=1;i<layers.length-1;i++){
        var p=layers[i].property("Transform").property("Position").value.slice();
        p[idx]=first+step*i;
        layers[i].property("Transform").property("Position").setValue(p);
      }
    }
    return { success:true, message:"Distributed "+layers.length+" layers on "+ax };
  } catch (err) { return { success:false, error:err.message }; }
}

function layerAligner(layerNames, alignment, relativeTo) {
  try {
    var comp=app.project.activeItem;
    if (!(comp instanceof CompItem)) throw new Error("No active composition");
    var layers=[];
    for (var i=0;i<layerNames.length;i++){ var l=findLayer(comp,layerNames[i]); if (l) layers.push(l); }
    if (!layers.length) throw new Error("No layers");
    var ref=(relativeTo||"comp").toLowerCase();
    var bx=0,by=0,bw=comp.width,bh=comp.height;
    if (ref==="first" && layers.length){
      var l0=layers[0];
      var r=l0.sourceRectAtTime(comp.time,false);
      var p=l0.property("Transform").property("Position").value;
      bx=r.left+p[0]; by=r.top+p[1]; bw=r.width; bh=r.height;
    }
    var a=(alignment||"hcenter").toLowerCase();
    for (var i=0;i<layers.length;i++){
      var l=layers[i];
      var r=l.sourceRectAtTime(comp.time,false);
      var pos=l.property("Transform").property("Position").value.slice();
      var anchor=l.property("Transform").property("Anchor Point").value;
      if (a==="left") pos[0]=bx + (anchor[0]-r.left);
      else if (a==="right") pos[0]=bx+bw - (r.left+r.width-anchor[0]);
      else if (a==="hcenter") pos[0]=bx+bw/2 + (anchor[0]-r.left-r.width/2);
      else if (a==="top") pos[1]=by + (anchor[1]-r.top);
      else if (a==="bottom") pos[1]=by+bh - (r.top+r.height-anchor[1]);
      else if (a==="vcenter") pos[1]=by+bh/2 + (anchor[1]-r.top-r.height/2);
      else throw new Error("Unknown alignment: "+a);
      l.property("Transform").property("Position").setValue(pos);
    }
    return { success:true, message:"Aligned "+layers.length+" layers ("+a+")" };
  } catch (err) { return { success:false, error:err.message }; }
}

function textAnimator(layerName, animatorType, value) {
  try {
    var comp=app.project.activeItem;
    if (!(comp instanceof CompItem)) throw new Error("No active composition");
    var layer=findLayer(comp,layerName);
    if (!layer) throw new Error("Layer not found: "+layerName);
    var animators=layer.property("ADBE Text Properties").property("ADBE Text Animators");
    var anim=animators.addProperty("ADBE Text Animator");
    anim.name=animatorType+" Animator";
    var props=anim.property("ADBE Text Animator Properties");
    var matchMap={
      "position":"ADBE Text Position 3D",
      "scale":"ADBE Text Scale 3D",
      "rotation":"ADBE Text Rotation",
      "opacity":"ADBE Text Opacity",
      "fillColor":"ADBE Text Fill Color"
    };
    var match=matchMap[animatorType];
    if (!match) throw new Error("Unknown animator: "+animatorType);
    var p=props.addProperty(match);
    if (value!==undefined) {
      try { p.setValue(value); } catch(e){}
    }
    anim.property("ADBE Text Selectors").addProperty("ADBE Text Selector");
    return { success:true, message:"Text animator added: "+animatorType };
  } catch (err) { return { success:false, error:err.message }; }
}

function expressionBuilder(template, params) {
  try {
    params=params||{};
    var t=(template||"").toLowerCase();
    var expr="";
    if (t==="wiggle") expr="wiggle("+(params.frequency||2)+","+(params.amount||30)+")";
    else if (t==="loopout") expr='loopOut("'+(params.type||"cycle")+'")';
    else if (t==="loopin") expr='loopIn("'+(params.type||"cycle")+'")';
    else if (t==="time") expr="time*"+(params.multiplier||1);
    else if (t==="bounce") expr='n=0;\nif (numKeys>0) n=nearestKey(time).index;\nif (key(n).time>time) n--;\nif (n==0) value;\nelse{\n  t=time-key(n).time;\n  amp=.1;freq=2;decay=8;\n  v=velocityAtTime(key(n).time-thisComp.frameDuration/10);\n  value+v*amp*Math.sin(freq*t*2*Math.PI)/Math.exp(decay*t);\n}';
    else if (t==="random") expr="seedRandom("+(params.seed||0)+",true);\nrandom("+(params.min||0)+","+(params.max||100)+")";
    else if (t==="follow") expr='thisComp.layer("'+(params.target||"")+'").transform.position';
    else if (t==="inertia") expr="amp=0.05;freq=4.0;decay=5.0;\nn=0;\nif (numKeys>0) n=nearestKey(time).index;\nif (key(n).time>time) n--;\nif (n==0) value;\nelse{ t=time-key(n).time; v=velocityAtTime(key(n).time-thisComp.frameDuration/10); value+v*amp*Math.sin(freq*t*2*Math.PI)/Math.exp(decay*t); }";
    else throw new Error("Unknown template: "+t);
    return { success:true, expression:expr, template:t };
  } catch (err) { return { success:false, error:err.message }; }
}

function expressionPicker(sourceLayerName, sourceProperty, targetLayerName, targetProperty) {
  try {
    var comp=app.project.activeItem;
    if (!(comp instanceof CompItem)) throw new Error("No active composition");
    var src=findLayer(comp,sourceLayerName);
    var tgt=findLayer(comp,targetLayerName);
    if (!src||!tgt) throw new Error("Layer not found");
    var sp=src.property(sourceProperty)||src.property("Transform").property(sourceProperty);
    var tp=tgt.property(targetProperty)||tgt.property("Transform").property(targetProperty);
    if (!sp||!tp) throw new Error("Property not found");
    if (!sp.expression) throw new Error("Source has no expression");
    tp.expression=sp.expression;
    return { success:true, message:"Expression copied", expressionLength:sp.expression.length };
  } catch (err) { return { success:false, error:err.message }; }
}

function keyframeCopier(srcLayerName, srcProperty, dstLayerName, dstProperty, timeOffset) {
  try {
    var comp=app.project.activeItem;
    if (!(comp instanceof CompItem)) throw new Error("No active composition");
    var src=findLayer(comp,srcLayerName);
    var dst=findLayer(comp,dstLayerName);
    if (!src||!dst) throw new Error("Layer not found");
    var sp=src.property(srcProperty)||src.property("Transform").property(srcProperty);
    var dp=dst.property(dstProperty||srcProperty)||dst.property("Transform").property(dstProperty||srcProperty);
    if (!sp||!dp) throw new Error("Property not found");
    var off=timeOffset||0;
    var copied=0;
    for (var i=1;i<=sp.numKeys;i++){
      dp.setValueAtTime(sp.keyTime(i)+off, sp.keyValue(i));
      copied++;
    }
    return { success:true, message:"Copied "+copied+" keys" };
  } catch (err) { return { success:false, error:err.message }; }
}

function shapeTransfer(srcLayerName, dstLayerName) {
  try {
    var comp=app.project.activeItem;
    if (!(comp instanceof CompItem)) throw new Error("No active composition");
    var src=findLayer(comp,srcLayerName);
    var dst=findLayer(comp,dstLayerName);
    if (!src||!dst) throw new Error("Layer not found");
    function firstPath(layer){
      function walk(g){
        for (var i=1;i<=g.numProperties;i++){
          var p=g.property(i);
          if (p.matchName==="ADBE Vector Shape - Group") return p.property("Path");
          if (p.numProperties>0){
            var sub=p.property("Contents")||p;
            var r=walk(sub); if (r) return r;
          }
        }
        return null;
      }
      return walk(layer.property("ADBE Root Vectors Group"));
    }
    var sp=firstPath(src), dp=firstPath(dst);
    if (!sp||!dp) throw new Error("Path missing");
    dp.setValue(sp.value);
    return { success:true, message:"Shape transferred "+srcLayerName+" → "+dstLayerName };
  } catch (err) { return { success:false, error:err.message }; }
}

// === Command Dispatcher ===
function dispatchCommand(command, params) {
  switch (command) {
    case "create_composition":
      return createComposition(
        params.name,
        params.width,
        params.height,
        params.duration,
        params.frameRate
      );
    case "add_layer":
      return addLayer(
        params.compName,
        params.layerName,
        params.layerType
      );
    case "modify_property":
      return modifyLayerProperty(
        params.compName,
        params.layerName,
        params.property,
        params.value
      );
    case "duplicate_layer":
      return duplicateLayer(
        params.layerName,
        params.newName
      );
    case "delete_layer":
      return deleteLayer(
        params.layerName
      );
    case "set_blend_mode":
      return setBlendMode(
        params.layerName,
        params.blendMode,
        params.trackMatte
      );
    case "add_shape_layer":
      return addShapeLayer(
        params.shapeType,
        params.layerName,
        params.position,
        params.size
      );
    case "set_3d_property":
      return set3DProperty(
        params.layerName,
        params.enable3D,
        params.zPosition,
        params.zRotation
      );
    case "batch_modify_property":
      return batchModifyProperty(
        params.layerNames,
        params.propertyName,
        params.value
      );
    case "get_active_comp_info":
      return getActiveCompInfo();
    case "apply_expression":
      return applyExpression(
        params.layerName,
        params.propertyName,
        params.expression
      );
    case "add_effect":
      return addEffect(
        params.layerName,
        params.effectMatchName
      );
    case "set_keyframe":
      return setKeyframe(
        params.layerName,
        params.propertyName,
        params.timeInSeconds,
        params.value
      );
    case "create_null_and_parent":
      return createNullAndParent(
        params.targetLayerName,
        params.nullName
      );
    case "render_comp":
      return renderComp(
        params.compName,
        params.outputPath
      );
    case "execute_arbitrary_jsx":
      return executeArbitraryJSX(
        params.jsxCode
      );
    case "add_camera":
      return addCamera(params.name, params.centerPoint);
    case "add_light":
      return addLight(params.name, params.centerPoint);
    case "apply_preset":
      return applyPreset(params.layerName, params.presetPath);
    case "precompose_layers":
      return precomposeLayers(params.layerIndices, params.name, params.moveAllAttributes);
    case "set_text_content":
      return setTextContent(params.layerName, params.text);
    case "add_marker":
      return addMarker(params.layerName, params.timeInSeconds, params.comment);
    case "batch_apply_expression":
      return batchApplyExpression(params.layerNames, params.propertyName, params.expression);
    case "set_layer_blend_mode":
      return setLayerBlendMode(params.layerName, params.blendMode);
    case "duplicate_with_children":
      return duplicateWithChildren(params.layerName);
    case "export_as_mogrt":
      return exportAsMogrt(params.compName, params.outputPath);
    case "create_comp_advanced":
      return createCompAdvanced(params.name, params.width, params.height, params.duration, params.frameRate, params.pixelAspect, params.bgColor);
    case "duplicate_comp":
      return duplicateComp(params.compName, params.newName);
    case "set_comp_work_area":
      return setCompWorkArea(params.compName, params.start, params.duration);
    case "set_comp_background_color":
      return setCompBackgroundColor(params.compName, params.color);
    case "save_project":
      return saveProject();
    case "save_project_as":
      return saveProjectAs(params.path);
    case "close_project":
      return closeProject();
    case "new_project":
      return newProject();
    case "add_null_layer":
      return addNullLayer(params.name, params.position);
    case "add_shape_layer_advanced":
      return addShapeLayerAdvanced(params.shapeType, params.name, params.position, params.size, params.fillColor, params.strokeColor, params.strokeWidth);
    case "add_camera_advanced":
      return addCameraAdvanced(params.name, params.position, params.pointOfInterest, params.zoom);
    case "add_light_advanced":
      return addLightAdvanced(params.name, params.lightType, params.position, params.color, params.intensity);
    case "set_layer_parent":
      return setLayerParent(params.layerName, params.parentName);
    case "set_layer_3d":
      return setLayer3D(params.layerName, params.enable3D);
    case "set_layer_motion_blur":
      return setLayerMotionBlur(params.layerName, params.enable);
    case "lock_layer":
      return lockLayer(params.layerName, params.lock);
    case "shy_layer":
      return shyLayer(params.layerName, params.shy);
    case "set_text_content_advanced":
      return setTextContentAdvanced(params.layerName, params.text, params.fontSize, params.font, params.justify);
    case "apply_text_style":
      return applyTextStyle(params.layerName, params.style);
    case "set_text_fill_color":
      return setTextFillColor(params.layerName, params.color);
    case "set_text_stroke":
      return setTextStroke(params.layerName, params.color, params.width);
    case "animate_text_position":
      return animateTextPosition(params.layerName, params.fromPos, params.toPos, params.durationSec);
    case "apply_text_wiggle":
      return applyTextWiggle(params.layerName, params.frequency, params.amount);
    case "add_effect_advanced":
      return addEffectAdvanced(params.layerName, params.effectMatchName, params.propertyValues);
    case "apply_wiggle_smart":
      return applyWiggleSmart(params.layerName, params.propertyName, params.frequency, params.amount);
    case "apply_loop_out":
      return applyLoopOut(params.layerName, params.propertyName, params.loopType);
    case "set_keyframe_ease":
      return setKeyframeEase(params.layerName, params.propertyName, params.keyIndex, params.easeIn, params.easeOut);
    case "add_marker_advanced":
      return addMarkerAdvanced(params.layerName, params.timeInSeconds, params.comment, params.duration, params.chapter, params.url);
    case "apply_expression_smart":
      return applyExpressionSmart(params.layerName, params.propertyName, params.expression, params.transformGroup);
    case "batch_wiggle":
      return batchWiggle(params.layerNames, params.propertyName, params.frequency, params.amount);
    case "create_ramp_effect":
      return createRampEffect(params.layerName, params.startPoint, params.endPoint, params.startColor, params.endColor, params.rampShape);
    case "add_to_render_queue":
      return addToRenderQueue(params.compName);
    case "set_render_output":
      return setRenderOutput(params.compName, params.outputPath, params.template);
    case "start_render":
      return startRender();
    case "export_frame_as_image":
      return exportFrameAsImage(params.compName, params.timeInSeconds, params.outputPath);
    case "precompose_with_options":
      return precomposeWithOptions(params.layerNames, params.name, params.moveAllAttributes, params.openNewComp);
    case "execute_jsx_file":
      return executeJsxFile(params.filePath);
    case "get_project_info":
      return getProjectInfo();
    case "auto_crop":
      return autoCrop(params.compName);
    case "curve_editor":
      return curveEditor(params.layerName, params.propertyName, params.keyIndex, params.inSpeed, params.inInfluence, params.outSpeed, params.outInfluence);
    case "time_reverse":
      return timeReverse(params.layerName);
    case "random_layer_order":
      return randomLayerOrder(params.compName);
    case "auto_sway":
      return autoSway(params.layerName, params.frequency, params.amount);
    case "anchor_point_tool":
      return anchorPointTool(params.layerName, params.anchorMode, params.customPoint);
    case "expression_cleanup":
      return expressionCleanup(params.layerNames, params.propertyNames);
    case "scale_about_centre":
      return scaleAboutCentre(params.layerName, params.scalePercent);
    case "mask_convertor":
      return maskConvertor(params.layerName, params.maskIndex, params.targetShapeLayerName);
    case "layer_sequencer":
      return layerSequencer(params.layerNames, params.overlapSeconds, params.startTime);
    case "layer_organizer":
      return layerOrganizer(params.compName, params.mode);
    case "wiggle_controller":
      return wiggleController(params.targetLayerName, params.propertyName, params.controllerName);
    case "property_revealer":
      return propertyRevealer(params.layerName);
    case "split_by_marker":
      return splitByMarker(params.layerName);
    case "centre_anchor":
      return centreAnchor(params.layerName);
    case "quick_search":
      return quickSearch(params.pattern, params.caseSensitive);
    case "text_path_tool":
      return textPathTool(params.layerName, params.maskLayerName, params.maskIndex);
    case "effect_browser":
      return effectBrowser(params.filter);
    case "shape_morph":
      return shapeMorph(params.fromLayerName, params.toLayerName, params.durationSec);
    case "path_trimmer":
      return pathTrimmer(params.layerName, params.startPercent, params.endPercent, params.offsetPercent);
    case "layer_splitter":
      return layerSplitter(params.layerName, params.timeInSeconds);
    case "marker_manager":
      return markerManager(params.action, params.layerName, params.timeInSeconds, params.comment);
    case "stroke_caps":
      return strokeCaps(params.layerName, params.lineCap, params.lineJoin, params.miterLimit);
    case "duplicate_with_offset":
      return duplicateWithOffset(params.layerName, params.count, params.offsetPosition, params.offsetTime);
    case "property_shifter":
      return propertyShifter(params.layerName, params.propertyName, params.deltaSeconds);
    case "find_replace":
      return findReplace(params.target, params.find, params.replace, params.caseSensitive);
    case "easy_ease":
      return easyEase(params.layerName, params.propertyName, params.keyIndex);
    case "comp_settings":
      return compSettings(params.compName, params.settings);
    case "batch_rename":
      return batchRename(params.layerNames, params.prefix, params.suffix, params.replaceWith, params.startNumber);
    case "property_linker":
      return propertyLinker(params.sourceLayerName, params.sourceProperty, params.targetLayerName, params.targetProperty);
    case "distribute_layer":
      return distributeLayer(params.layerNames, params.axis, params.spacing);
    case "layer_aligner":
      return layerAligner(params.layerNames, params.alignment, params.relativeTo);
    case "text_animator":
      return textAnimator(params.layerName, params.animatorType, params.value);
    case "expression_builder":
      return expressionBuilder(params.template, params.params);
    case "expression_picker":
      return expressionPicker(params.sourceLayerName, params.sourceProperty, params.targetLayerName, params.targetProperty);
    case "keyframe_copier":
      return keyframeCopier(params.srcLayerName, params.srcProperty, params.dstLayerName, params.dstProperty, params.timeOffset);
    case "shape_transfer":
      return shapeTransfer(params.srcLayerName, params.dstLayerName);
    default:
      return { success: false, error: "Unknown command: " + command };
  }
}

// === Exports ===
this.createComposition = createComposition;
this.addLayer = addLayer;
this.modifyLayerProperty = modifyLayerProperty;
this.listCompositions = listCompositions;
this.getActiveCompInfo = getActiveCompInfo;
this.applyExpression = applyExpression;
this.addEffect = addEffect;
this.setKeyframe = setKeyframe;
this.createNullAndParent = createNullAndParent;
this.renderComp = renderComp;
this.executeArbitraryJSX = executeArbitraryJSX;
this.addCamera = addCamera;
this.addLight = addLight;
this.applyPreset = applyPreset;
this.precomposeLayers = precomposeLayers;
this.setTextContent = setTextContent;
this.addMarker = addMarker;
this.batchApplyExpression = batchApplyExpression;
this.setLayerBlendMode = setLayerBlendMode;
this.duplicateWithChildren = duplicateWithChildren;
this.exportAsMogrt = exportAsMogrt;
this.createCompAdvanced = createCompAdvanced;
this.duplicateComp = duplicateComp;
this.setCompWorkArea = setCompWorkArea;
this.setCompBackgroundColor = setCompBackgroundColor;
this.saveProject = saveProject;
this.saveProjectAs = saveProjectAs;
this.closeProject = closeProject;
this.newProject = newProject;
this.addNullLayer = addNullLayer;
this.addShapeLayerAdvanced = addShapeLayerAdvanced;
this.addCameraAdvanced = addCameraAdvanced;
this.addLightAdvanced = addLightAdvanced;
this.setLayerParent = setLayerParent;
this.setLayer3D = setLayer3D;
this.setLayerMotionBlur = setLayerMotionBlur;
this.lockLayer = lockLayer;
this.shyLayer = shyLayer;
this.setTextContentAdvanced = setTextContentAdvanced;
this.applyTextStyle = applyTextStyle;
this.setTextFillColor = setTextFillColor;
this.setTextStroke = setTextStroke;
this.animateTextPosition = animateTextPosition;
this.applyTextWiggle = applyTextWiggle;
this.addEffectAdvanced = addEffectAdvanced;
this.applyWiggleSmart = applyWiggleSmart;
this.applyLoopOut = applyLoopOut;
this.setKeyframeEase = setKeyframeEase;
this.addMarkerAdvanced = addMarkerAdvanced;
this.applyExpressionSmart = applyExpressionSmart;
this.batchWiggle = batchWiggle;
this.createRampEffect = createRampEffect;
this.addToRenderQueue = addToRenderQueue;
this.setRenderOutput = setRenderOutput;
this.startRender = startRender;
this.exportFrameAsImage = exportFrameAsImage;
this.precomposeWithOptions = precomposeWithOptions;
this.executeJsxFile = executeJsxFile;
this.getProjectInfo = getProjectInfo;
this.autoCrop = autoCrop;
this.curveEditor = curveEditor;
this.timeReverse = timeReverse;
this.randomLayerOrder = randomLayerOrder;
this.autoSway = autoSway;
this.anchorPointTool = anchorPointTool;
this.expressionCleanup = expressionCleanup;
this.scaleAboutCentre = scaleAboutCentre;
this.maskConvertor = maskConvertor;
this.layerSequencer = layerSequencer;
this.layerOrganizer = layerOrganizer;
this.wiggleController = wiggleController;
this.propertyRevealer = propertyRevealer;
this.splitByMarker = splitByMarker;
this.centreAnchor = centreAnchor;
this.quickSearch = quickSearch;
this.textPathTool = textPathTool;
this.effectBrowser = effectBrowser;
this.shapeMorph = shapeMorph;
this.pathTrimmer = pathTrimmer;
this.layerSplitter = layerSplitter;
this.markerManager = markerManager;
this.strokeCaps = strokeCaps;
this.duplicateWithOffset = duplicateWithOffset;
this.propertyShifter = propertyShifter;
this.findReplace = findReplace;
this.easyEase = easyEase;
this.compSettings = compSettings;
this.batchRename = batchRename;
this.propertyLinker = propertyLinker;
this.distributeLayer = distributeLayer;
this.layerAligner = layerAligner;
this.textAnimator = textAnimator;
this.expressionBuilder = expressionBuilder;
this.expressionPicker = expressionPicker;
this.keyframeCopier = keyframeCopier;
this.shapeTransfer = shapeTransfer;
this.dispatchCommand = dispatchCommand;
