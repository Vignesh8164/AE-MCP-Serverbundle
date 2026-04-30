function CSInterface() {}
CSInterface.prototype.evalScript = function (script, callback) {
  if (typeof window.__adobe_cep__ !== "undefined") {
    window.__adobe_cep__.evalScript(script, callback || function () {});
  } else {
    if (callback) callback("EvalScript error: __adobe_cep__ not available");
  }
};
CSInterface.prototype.getHostEnvironment = function () {
  return typeof window.__adobe_cep__ !== "undefined"
    ? JSON.parse(window.__adobe_cep__.getHostEnvironment())
    : {};
};
CSInterface.prototype.getSystemPath = function (pathType) {
  return typeof window.__adobe_cep__ !== "undefined"
    ? window.__adobe_cep__.getSystemPath(pathType)
    : "";
};
CSInterface.prototype.openURLInDefaultBrowser = function (url) {
  if (typeof cep !== "undefined") cep.util.openURLInDefaultBrowser(url);
};
