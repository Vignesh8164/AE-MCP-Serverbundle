console.log("AE MCP Bridge Loaded");
let csInterface = (typeof CSInterface !== "undefined") ? new CSInterface() : null;
let connected = false;
let pollInterval = null;
let bridgeLoaded = false;
let bridgeLoading = false;
let bridgeCallbacks = [];
const inFlightCommandIds = new Set();
const processedCommandIds = new Set();
const reportRetryTimers = new Map();

function normalizeBaseUrl(rawUrl) {
  const input = String(rawUrl || "").trim();
  if (!input) {
    return "";
  }

  const hasHttp = /^http:\/\//i.test(input);
  const cleanHost = input
    .replace(/^(?:https?:\/\/)+/i, "")
    .replace(/\/+$/, "");

  if (!cleanHost) {
    return "";
  }

  const protocol = hasHttp ? "http://" : "https://";
  return protocol + cleanHost;
}

function xhrRequest(method, url, body) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, url, true);
    xhr.timeout = 15000;

    if (method !== "GET") {
      xhr.setRequestHeader("Content-Type", "application/json");
    }

    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) {
        return;
      }

      const responseText = xhr.responseText || "";
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve({
          status: xhr.status,
          statusText: xhr.statusText || "OK",
          responseText,
        });
      } else {
        reject({
          type: "http",
          status: xhr.status,
          statusText: xhr.statusText || "",
          responseText,
          url,
          method,
        });
      }
    };

    xhr.onerror = function () {
      reject({
        type: "network",
        message: "Network request failed",
        status: xhr.status || 0,
        statusText: xhr.statusText || "",
        url,
        method,
      });
    };

    xhr.ontimeout = function () {
      reject({
        type: "timeout",
        message: "Network request timed out",
        status: xhr.status || 0,
        statusText: xhr.statusText || "",
        url,
        method,
      });
    };

    xhr.send(body ? JSON.stringify(body) : null);
  });
}

function getBaseUrl() {
  const urlInput = document.getElementById("serverUrl");
  return normalizeBaseUrl(urlInput ? urlInput.value : "");
}

window.addEventListener("DOMContentLoaded", () => {
  updateStatus(false);

  const connectBtn = document.getElementById("connectBtn");
  const disconnectBtn = document.getElementById("disconnectBtn");

  if (connectBtn) {
    connectBtn.addEventListener("click", connectToServer);
  }

  if (disconnectBtn) {
    disconnectBtn.addEventListener("click", disconnectFromServer);
  }

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
  const message = String(msg);
  console.log(message);

  const consoleBox = document.getElementById("console");
  const countEl = document.getElementById("logCount");

  if (!consoleBox) {
    return;
  }

  const timestamp = new Date().toLocaleTimeString();
  const line = document.createElement("div");
  line.className = "line";
  line.innerText = `[${timestamp}] ${message}`;

  consoleBox.appendChild(line);
  consoleBox.scrollTop = consoleBox.scrollHeight;

  if (countEl) {
    countEl.textContent = `${consoleBox.querySelectorAll(".line").length} lines`;
  }
}

function updateStatus(isConnected) {
  connected = isConnected;

  const statusEl = document.getElementById("status");
  const sysStatusEl = document.getElementById("sysStatus");
  const text = isConnected ? "SYS: ONLINE" : "SYS: OFFLINE";
  const color = isConnected ? "green" : "red";

  if (statusEl) {
    statusEl.innerText = text;
    statusEl.style.color = color;
    statusEl.className = `status ${isConnected ? "connected" : "disconnected"}`;
  }

  if (sysStatusEl) {
    sysStatusEl.innerText = text;
    sysStatusEl.style.color = color;
  }
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

async function connectToServer() {
  const url = getBaseUrl();

  if (!url) {
    log("Connection failed: Server URL is empty");
    updateStatus(false);
    return;
  }

  const healthUrl = url + "/health";
  log("Attempting connection to " + healthUrl);

  try {
    const res = await xhrRequest("GET", healthUrl);

    log(`Connected successfully (HTTP ${res.status} ${res.statusText}) URL: ${healthUrl}`);
    updateStatus(true);
    startPolling();
  } catch (err) {
    if (err && err.type === "http") {
      log(`Connection failed: HTTP ${err.status} ${err.statusText} URL: ${healthUrl}`);
      if (err.responseText) {
        log(`Connection response: ${err.responseText.substring(0, 500)}`);
      }
    } else {
      const message = err && err.message ? err.message : String(err);
      log(`Connection failed: ${message} URL: ${healthUrl}`);
    }
    stopPolling();
    updateStatus(false);
  }
}

function disconnectFromServer() {
  stopPolling();
  updateStatus(false);
  log("Disconnected");
}

function connect() {
  return connectToServer();
}

function disconnect() {
  return disconnectFromServer();
}

function startPolling() {
  if (pollInterval) clearInterval(pollInterval);

  pollInterval = setInterval(() => {
    if (!connected) return;

    const base = getBaseUrl();
    const pendingUrl = `${base}/api/commands/pending`;
    xhrRequest("GET", pendingUrl)
      .then((res) => {
        const commands = res.responseText ? JSON.parse(res.responseText) : [];
        if (!Array.isArray(commands) || commands.length === 0) return;

        commands.forEach((cmd) => {
          if (!cmd || !cmd.id) {
            return;
          }
          if (processedCommandIds.has(cmd.id) || inFlightCommandIds.has(cmd.id)) {
            return;
          }
          inFlightCommandIds.add(cmd.id);
          log(`Executing: ${cmd.type} (${cmd.id})`);
          executeCommand(cmd);
        });
      })
      .catch((err) => {
        if (err && err.type === "http") {
          log(`Poll error: HTTP ${err.status} ${err.statusText} (URL: ${pendingUrl})`);
        } else {
          const message = err && err.message ? err.message : String(err);
          log(`Poll error: ${message} (URL: ${pendingUrl})`);
        }
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

function clearCommandTracking(commandId) {
  inFlightCommandIds.delete(commandId);
  const timer = reportRetryTimers.get(commandId);
  if (timer) {
    clearTimeout(timer);
    reportRetryTimers.delete(commandId);
  }
}

function scheduleReportRetry(commandId, payload) {
  if (reportRetryTimers.has(commandId)) {
    return;
  }
  const timer = setTimeout(() => {
    reportRetryTimers.delete(commandId);
    reportResult(commandId, payload.status, payload.result, payload.error, payload.debug, true);
  }, 1000);
  reportRetryTimers.set(commandId, timer);
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

  if (processedCommandIds.has(cmd.id)) {
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
  if (processedCommandIds.has(cmdId)) {
    return;
  }

  const base = getBaseUrl();
  const url = `${base}/api/command/${cmdId}/result`;
  const payload = {
    success: status !== "failed",
    status,
    result: result || {},
    error: error || null,
    debug,
  };

  xhrRequest("POST", url, payload)
    .then(() => {
      processedCommandIds.add(cmdId);
      clearCommandTracking(cmdId);
      log(`Result reported: ${cmdId} = ${status} (URL: ${url})`);
    })
    .catch((err) => {
      if (err && err.type === "http") {
        log(`Report error: HTTP ${err.status} ${err.statusText} (URL: ${url})`);
      } else {
        const message = err && err.message ? err.message : String(err);
        log(`Report error: ${message} (URL: ${url})`);
      }

      scheduleReportRetry(cmdId, payload);
    });
}
