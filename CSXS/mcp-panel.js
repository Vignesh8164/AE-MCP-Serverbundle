let csInterface = (typeof CSInterface !== "undefined") ? new CSInterface() : null;
let connected = false;
let serverUrl = "";
let pollInterval = null;
let bridgeLoaded = false;
let bridgeLoading = false;
let bridgeCallbacks = [];

function getBaseUrl() {
  let input = document.getElementById("serverUrl").value.trim();
  let cleanUrl = input.replace(/^https?:\/\//i, "");

  if (cleanUrl.includes("herokuapp.com")) {
    return "https://" + cleanUrl;
  }
  return "http://" + cleanUrl;
}

window.addEventListener("DOMContentLoaded", () => {
  if (!csInterface) {
    log("Warning: CSInterface unavailable. JSX execution disabled.");
    log("Panel ready.");
    return;
  }

  ensureBridgeLoaded((ok, detail) => {
    if (ok) {
      log("AE bridge script loaded.");
    } else {
      log("Bridge load failed: " + detail);
    }
    log("Panel ready.");
  });
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

function flushBridgeCallbacks(ok, detail) {
  const callbacks = bridgeCallbacks.slice();
  bridgeCallbacks = [];
  callbacks.forEach((cb) => {
    try {
      cb(ok, detail);
    } catch (_err) {
      // Ignore callback errors
    }
  });
}

function ensureBridgeLoaded(callback) {
  if (!csInterface) {
    callback(false, "CSInterface unavailable");
    return;
  }

  if (bridgeLoaded) {
    callback(true, "already loaded");
    return;
  }

  bridgeCallbacks.push(callback);

  if (bridgeLoading) {
    return;
  }

  bridgeLoading = true;

  const extensionRoot = String(csInterface.getSystemPath(SystemPath.EXTENSION) || "").replace(/\\/g, "/");
  const bridgePath = `${extensionRoot}/jsx/ae-bridge.jsx`;

  const loaderScript = `(function(){\n`
    + `  try {\n`
    + `    var bridgeFile = new File(${JSON.stringify(bridgePath)});\n`
    + `    if (!bridgeFile.exists) {\n`
    + `      return "__AE_BRIDGE_MISSING__:" + bridgeFile.fsName;\n`
    + `    }\n`
    + `    $.evalFile(bridgeFile);\n`
    + `    if (typeof dispatchCommand !== "function") {\n`
    + `      return "__AE_BRIDGE_INVALID__";\n`
    + `    }\n`
    + `    return "__AE_BRIDGE_READY__";\n`
    + `  } catch (e) {\n`
    + `    return "__AE_BRIDGE_ERROR__:" + e.toString();\n`
    + `  }\n`
    + `})()`;

  csInterface.evalScript(loaderScript, (result) => {
    bridgeLoading = false;
    const resultText = String(result || "");

    if (resultText === "__AE_BRIDGE_READY__") {
      bridgeLoaded = true;
      flushBridgeCallbacks(true, "ready");
      return;
    }

    const detail = resultText || "Unknown bridge load failure";
    flushBridgeCallbacks(false, detail);
  });
}

function connect() {
  const urlInput = document.getElementById("serverUrl");
  serverUrl = urlInput.value || "ae-mcp-server-2026.herokuapp.com";

  ensureBridgeLoaded((bridgeOk, bridgeDetail) => {
    if (!bridgeOk) {
      log(`Connection blocked: AE bridge unavailable (${bridgeDetail})`);
      updateStatus(false);
      return;
    }

    const base = getBaseUrl();
    log(`Connecting to ${base}...`);
    fetch(`${base}/api/commands/pending`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
        return res.json();
      })
      .then(() => {
        updateStatus(true);
        log(`Connected to MCP server at ${base}`);
        startPolling();
      })
      .catch((err) => {
        log(`Connection failed: ${err.message} (URL: ${base}/api/commands/pending)`);
        updateStatus(false);
      });
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
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
        return res.json();
      })
      .then((commands) => {
        if (!Array.isArray(commands) || commands.length === 0) return;

        commands.forEach((cmd) => {
          log(`Executing: ${cmd.type} (${cmd.id})`);
          executeCommand(cmd);
        });
      })
      .catch((err) => {
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

function buildDispatchCommand(tool, params) {
  const safeTool = JSON.stringify(String(tool || ""));
  const safeParams = JSON.stringify(params || {});
  return `JSON.stringify(dispatchCommand(${safeTool}, ${safeParams}))`;
}

function executeCommand(cmd) {
  if (!cmd || !cmd.id) {
    return;
  }

  try {
    if (!csInterface) {
      reportResult(cmd.id, "failed", null, "CSInterface unavailable", {
        command: cmd.type,
      });
      return;
    }

    ensureBridgeLoaded((bridgeOk, bridgeDetail) => {
      if (!bridgeOk) {
        reportResult(cmd.id, "failed", null, `AE bridge unavailable: ${bridgeDetail}`, {
          command: cmd.type,
        });
        return;
      }

      const params = cmd.params || {};
      const jsxCode = buildDispatchCommand(cmd.type, params);
      const jsxPreview = jsxCode.substring(0, 400);
      log(`JSX: ${jsxPreview}${jsxCode.length > 400 ? "..." : ""}`);

      csInterface.evalScript(jsxCode, (result) => {
        let parsed = result;
        let parseError = null;

        try {
          if (typeof result === "string") {
            parsed = JSON.parse(result);
          }
        } catch (err) {
          parseError = err && err.message ? err.message : String(err);
          parsed = result;
        }

        const resultText = typeof parsed === "string" ? parsed : JSON.stringify(parsed);
        log(`AE result: ${resultText}`);

        const debugInfo = {
          command: cmd.type,
          jsxPreview,
          rawResult: typeof result === "string" ? result : String(result),
          parseError,
          parsedType: typeof parsed,
        };

        if (typeof parsed === "object" && parsed !== null && parsed.success === false) {
          reportResult(cmd.id, "failed", null, parsed.error || "AE operation failed", debugInfo);
          return;
        }

        if (typeof parsed === "string" && parsed.toLowerCase().includes("error")) {
          reportResult(cmd.id, "failed", null, parsed, debugInfo);
          return;
        }

        reportResult(cmd.id, "completed", parsed, null, debugInfo);
      });
    });
  } catch (err) {
    reportResult(cmd.id, "failed", null, err.message, {
      command: cmd.type,
    });
  }
}

function reportResult(cmdId, status, result, error, debug) {
  const base = getBaseUrl();
  const url = `${base}/api/command/${cmdId}/result`;
  fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status, result, error, debug })
  })
    .then((res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
      log(`Result reported: ${cmdId} = ${status}`);
    })
    .catch((err) => {
      log(`Report error: ${err.message} (URL: ${url})`);
    });
}
