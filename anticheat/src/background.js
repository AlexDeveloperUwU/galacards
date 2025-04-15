import { io } from "./assets/socketio.js";

let socket = null;
let lastEmitTimestamp = 0;

function initializeSocket(url, sendResponse = null) {
  const { origin, searchParams } = new URL(url);
  const playerId = `${searchParams.get("id")}-ac`;

  socket?.disconnect();
  socket = io(origin, { auth: { id: playerId }, transports: ["websocket"] });

  socket.on("connect", () => {
    console.log("Conectado al servidor:", origin);
    if (sendResponse) sendResponse({ status: "connected" });

    handleYouTubeTabs();

    chrome.webRequest.onBeforeRequest.addListener(handleWebRequest, {
      urls: ["*://*.youtube.com/*", "*://youtu.be/*"],
    });
    chrome.tabs.onUpdated.addListener(handleTabUpdate);
  });

  socket.on("connect_error", (error) => {
    console.error("Error al conectar al servidor:", error.message);
    if (sendResponse) sendResponse({ status: "error", message: error.message });
  });

  socket.on("disconnect", () => {
    console.log("Desconectado del servidor:", origin);
    chrome.webRequest.onBeforeRequest.removeListener(handleWebRequest);
    chrome.tabs.onUpdated.removeListener(handleTabUpdate);
  });
}

function handleYouTubeTabs() {
  if (!socket?.connected) return;

  chrome.tabs.query({}, (tabs) => {
    tabs.forEach((tab) => {
      if (isManagedYouTubeURL(tab.url)) {
        console.log("Cerrando pestaña de YouTube ya abierta:", tab.url);
        emitYouTubeDetected(tab.url, true);
        chrome.tabs.remove(tab.id);
      }
    });
  });
}

function handleWebRequest(details) {
  if (!socket?.connected) return;

  if (isManagedYouTubeURL(details.url)) {
    console.log("Se detectó el uso de YouTube:", details.url);
    emitYouTubeDetected(details.url);
  }
}

function handleTabUpdate(tabId, changeInfo, tab) {
  if (!socket?.connected) return;

  if (isManagedYouTubeURL(tab.url)) {
    console.log("Cerrando pestaña de YouTube:", tab.url);
    emitYouTubeDetected(tab.url);
    chrome.tabs.remove(tabId);
  }
}

function emitYouTubeDetected(url, forceEmit = false) {
  if (!socket?.connected) return;

  const now = Date.now();
  if (!forceEmit && now - lastEmitTimestamp < 2000) {
    console.log("Cooldown activo, no se enviará el evento para URL:", url);
    return;
  }

  console.log("Emitiendo evento ac:youtubeDetected para URL:", url);
  socket.emit("ac:youtubeDetected", { url });
  lastEmitTimestamp = now;
}

function isManagedYouTubeURL(url) {
  const regexPatterns = [
    /^https:\/\/www\.youtube\.com\/$/, // Página principal
    /^https:\/\/youtube\.com$/, // Página principal sin "www"
    /^https:\/\/www\.youtube\.com\/@[^/]+$/, // Páginas de usuario con handle
    /^https:\/\/www\.youtube\.com\/watch\?v=[^&]+$/, // Videos específicos
    /^https:\/\/youtu\.be\/[^/]+$/, // Videos con URL corta
  ];

  for (const regex of regexPatterns) {
    if (regex.test(url)) {
      return true;
    }
  }
  return false;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const { action, url } = message;

  if (action === "start") {
    chrome.storage.local.set({ savedUrl: url });
    initializeSocket(url, sendResponse);
    return true;
  } else if (action === "stop") {
    socket?.disconnect();
    socket = null;
    chrome.storage.local.remove("savedUrl");
    sendResponse({ status: "disconnected" });
  } else if (action === "getSavedUrl") {
    chrome.storage.local.get("savedUrl", ({ savedUrl }) => sendResponse({ url: savedUrl || "" }));
    return true;
  }
});

chrome.runtime.onStartup.addListener(() => {
  chrome.storage.local.get("savedUrl", ({ savedUrl }) => {
    if (savedUrl) {
      console.log("Inicializando socket tras recarga con URL guardada:", savedUrl);
      initializeSocket(savedUrl);
    }
  });
  return true;
});
