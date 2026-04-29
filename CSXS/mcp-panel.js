let csInterface = (typeof CSInterface !== "undefined") ? new CSInterface() : null;
let connected = false;
let serverUrl = "";

function getBaseUrl() {
  let input = document.getElementById('serverUrl').value.trim();
  let cleanUrl = input.replace(/^https?:\/\//i, '');
  
  if (cleanUrl.includes('herokuapp.com')) {
    return 'https://' + cleanUrl;
  } else {
    return 'http://' + cleanUrl;
  }
}
let pollInterval = null;

window.addEventListener("DOMContentLoaded", () => {
  if (!csInterface) log("Warning: CSInterface unavailable. JSX exec disabled.");
  log("Panel ready.");
});

function log(msg) {
  const logEl = document.getElementById("log");
  const countEl = document.getElementById("logCount");
  const timestamp = new Date().toLocaleTimeString();
  const lower = String(msg).toLowerCase();
  const cls = (lower.includes("error") || lower.includes("failed") || lower.includes("fail")) ? "err"
            : (lower.includes("connected") || lower.includes("completed") || lower.includes("ready")) ? "ok"
            : "";
  const line = document.createElement("span");
  line.className = "line";
  line.innerHTML = `<span class="ts">[${timestamp}]</span><span class="${cls}">${msg}</span>`;
  logEl.appendChild(line);
  logEl.appendChild(document.createTextNode("\n"));
  logEl.scrollTop = logEl.scrollHeight;
  if (countEl) countEl.textContent = `${logEl.querySelectorAll(".line").length} lines`;
}

function updateStatus(isConnected) {
  connected = isConnected;
  const statusEl = document.getElementById("status");
  statusEl.textContent = isConnected ? "Connected" : "Disconnected";
  statusEl.className = `status ${isConnected ? "connected" : "disconnected"}`;
}

function connect() {
  const urlInput = document.getElementById("serverUrl");
  serverUrl = urlInput.value || "ae-mcp-server-2026.herokuapp.com";

  const base = getBaseUrl();
  log(`Connecting to ${base}...`);
  fetch(`${base}/api/commands/pending`)
    .then(res => {
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
      return res.json();
    })
    .then(() => {
      updateStatus(true);
      log(`Connected to MCP server at ${base}`);
      startPolling();
    })
    .catch(err => {
      log(`Connection failed: ${err.message} (URL: ${base}/api/commands/pending)`);
      updateStatus(false);
    });
}

function disconnect() {
  stopPolling();
  updateStatus(false);
  log("Disconnected");
}

function startPolling() {
  if (pollInterval) clearInterval(pollInterval);

  pollInterval = setInterval(() => {
    if (!connected) return;

    const base = getBaseUrl();
    fetch(`${base}/api/commands/pending`)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
        return res.json();
      })
      .then(commands => {
        if (commands.length === 0) return;

        commands.forEach(cmd => {
          log(`Executing: ${cmd.type} (${cmd.id})`);
          executeCommand(cmd);
        });
      })
      .catch(err => {
        log(`Poll error: ${err.message} (URL: ${base}/api/commands/pending)`);
        updateStatus(false);
      });
  }, 500);
}

function stopPolling() {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
}

function executeCommand(cmd) {
  try {
    let jsxCode = "";

    switch (cmd.type) {
      case "create_composition":
        jsxCode = buildCreateComp(cmd.params);
        break;
      case "add_layer":
        jsxCode = buildAddLayer(cmd.params);
        break;
      case "modify_property":
        jsxCode = buildModifyProperty(cmd.params);
        break;
      case "duplicate_layer":
        jsxCode = buildDuplicateLayer(cmd.params);
        break;
      case "delete_layer":
        jsxCode = buildDeleteLayer(cmd.params);
        break;
      case "set_blend_mode":
        jsxCode = buildSetBlendMode(cmd.params);
        break;
      case "add_shape_layer":
        jsxCode = buildAddShapeLayer(cmd.params);
        break;
      case "set_3d_property":
        jsxCode = buildSet3DProperty(cmd.params);
        break;
      case "batch_modify_property":
        jsxCode = buildBatchModifyProperty(cmd.params);
        break;
      case "get_active_comp_info":
        jsxCode = "JSON.stringify(getActiveCompInfo())";
        break;
      case "apply_expression":
        jsxCode = buildApplyExpression(cmd.params);
        break;
      case "add_effect":
        jsxCode = buildAddEffect(cmd.params);
        break;
      case "set_keyframe":
        jsxCode = buildSetKeyframe(cmd.params);
        break;
      case "create_null_and_parent":
        jsxCode = buildCreateNullAndParent(cmd.params);
        break;
      case "render_comp":
        jsxCode = buildRenderComp(cmd.params);
        break;
      case "execute_arbitrary_jsx":
        jsxCode = cmd.params.jsxCode;
        break;
      default:
        jsxCode = `JSON.stringify(dispatchCommand("${cmd.type}", ${JSON.stringify(cmd.params || {})}))`;
        break;
    }

    log(`JSX: ${jsxCode.substring(0, 50)}...`);

    if (!csInterface) {
      reportResult(cmd.id, "failed", null, "CSInterface unavailable");
      return;
    }
    csInterface.evalScript(jsxCode, (result) => {
      reportResult(cmd.id, "completed", result, null);
    });
  } catch (err) {
    reportResult(cmd.id, "failed", null, err.message);
  }
}

function buildCreateComp(params) {
  const { name, width, height, duration, frameRate } = params;
  return `JSON.stringify(createComposition("${name}", ${width}, ${height}, ${duration}, ${frameRate}))`;
}

function buildAddLayer(params) {
  const { compName, layerName, layerType } = params;
  return `JSON.stringify(addLayer("${compName}", "${layerName}", "${layerType}"))`;
}

function buildModifyProperty(params) {
  const { compName, layerName, property, value } = params;
  const valStr = Array.isArray(value) ? `[${value.join(", ")}]` : value;
  return `JSON.stringify(modifyLayerProperty("${compName}", "${layerName}", "${property}", ${valStr}))`;
}

function buildDuplicateLayer(params) {
  const { layerName, newName } = params;
  const newNameStr = newName ? `"${newName}"` : "undefined";
  return `JSON.stringify(duplicateLayer("${layerName}", ${newNameStr}))`;
}

function buildDeleteLayer(params) {
  const { layerName } = params;
  return `JSON.stringify(deleteLayer("${layerName}"))`;
}

function buildSetBlendMode(params) {
  const { layerName, blendMode, trackMatte } = params;
  const matteStr = trackMatte ? `"${trackMatte}"` : "undefined";
  return `JSON.stringify(setBlendMode("${layerName}", "${blendMode}", ${matteStr}))`;
}

function buildAddShapeLayer(params) {
  const { shapeType, layerName, position, size } = params;
  const nameStr = layerName ? `"${layerName}"` : "undefined";
  const posStr = Array.isArray(position) ? `[${position.join(", ")}]` : "undefined";
  const sizeStr = typeof size === "number" ? size : "undefined";
  return `JSON.stringify(addShapeLayer("${shapeType}", ${nameStr}, ${posStr}, ${sizeStr}))`;
}

function buildSet3DProperty(params) {
  const { layerName, enable3D, zPosition, zRotation } = params;
  const zPosStr = typeof zPosition === "number" ? zPosition : "undefined";
  const zRotStr = typeof zRotation === "number" ? zRotation : "undefined";
  return `JSON.stringify(set3DProperty("${layerName}", ${enable3D}, ${zPosStr}, ${zRotStr}))`;
}

function buildBatchModifyProperty(params) {
  const { layerNames, propertyName, value } = params;
  const layersStr = JSON.stringify(layerNames || []);
  const valStr = Array.isArray(value) ? `[${value.join(", ")}]` : value;
  return `JSON.stringify(batchModifyProperty(${layersStr}, "${propertyName}", ${valStr}))`;
}

function buildApplyExpression(params) {
  const { layerName, propertyName, expression } = params;
  return `JSON.stringify(applyExpression("${layerName}", "${propertyName}", ${JSON.stringify(expression)}))`;
}

function buildAddEffect(params) {
  const { layerName, effectMatchName } = params;
  return `JSON.stringify(addEffect("${layerName}", "${effectMatchName}"))`;
}

function buildSetKeyframe(params) {
  const { layerName, propertyName, timeInSeconds, value } = params;
  const valStr = Array.isArray(value) ? `[${value.join(", ")}]` : value;
  return `JSON.stringify(setKeyframe("${layerName}", "${propertyName}", ${timeInSeconds}, ${valStr}))`;
}

function buildCreateNullAndParent(params) {
  const { targetLayerName, nullName } = params;
  const nullNameStr = nullName ? `"${nullName}"` : "undefined";
  return `JSON.stringify(createNullAndParent("${targetLayerName}", ${nullNameStr}))`;
}

function buildRenderComp(params) {
  const { compName, outputPath } = params;
  const pathStr = outputPath ? `"${outputPath}"` : "undefined";
  return `JSON.stringify(renderComp("${compName}", ${pathStr}))`;
}

function reportResult(cmdId, status, result, error) {
  const base = getBaseUrl();
  const url = `${base}/api/command/${cmdId}/result`;
  fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status, result, error })
  })
  .then(res => {
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
    log(`Result reported: ${cmdId} = ${status}`);
  })
  .catch(err => {
    log(`Report error: ${err.message} (URL: ${url})`);
  });
}
