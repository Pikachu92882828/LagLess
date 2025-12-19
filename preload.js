const { contextBridge, ipcRenderer } = require("electron");

console.log("✅ PRELOAD BOOTED");

contextBridge.exposeInMainWorld("ollama", {
  chat: (prompt) => ipcRenderer.invoke("ollama-chat", prompt)
});