(function () {
  "use strict";
  const start = document.getElementById("server-start-button");
  const stop = document.getElementById("server-stop-button");
  const refresh = document.getElementById("server-refresh-button");
  const status = document.getElementById("server-status");
  const memory = document.getElementById("server-memory");
  if (!start || !stop || !refresh || !status || !memory) return;

  function nativeBridge() {
    return window.FreeAppNativePhone || null;
  }

  function render() {
    const bridge = nativeBridge();
    if (!bridge || typeof bridge.getLocalServerStatus !== "function") {
      status.textContent = "Phone server controls are available inside the Android app.";
      memory.textContent = "Open this screen in the FreeApp AI Android app to inspect device memory.";
      return;
    }
    try {
      const data = JSON.parse(bridge.getLocalServerStatus());
      status.textContent = data.running ? "Server is listening on this phone at 127.0.0.1:8765." : "Server is stopped or still starting.";
      memory.textContent = JSON.stringify(data.memory || data, null, 2);
    } catch (error) {
      status.textContent = "Could not read server status: " + error.message;
    }
  }

  start.addEventListener("click", function () {
    const bridge = nativeBridge();
    if (!bridge || typeof bridge.startLocalServer !== "function") {
      status.textContent = "Start the server from the FreeApp AI Android app.";
      return;
    }
    bridge.startLocalServer();
    status.textContent = "Starting local server…";
    window.setTimeout(render, 900);
    window.setTimeout(render, 2500);
  });

  stop.addEventListener("click", function () {
    const bridge = nativeBridge();
    if (!bridge || typeof bridge.stopLocalServer !== "function") {
      status.textContent = "Server controls require the Android app.";
      return;
    }
    bridge.stopLocalServer();
    status.textContent = "Stopping local server…";
    window.setTimeout(render, 700);
  });

  refresh.addEventListener("click", render);
  render();
  window.setInterval(render, 10000);
})();
