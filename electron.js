import fs from "fs";
import { app, BrowserWindow, ipcMain } from "electron";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log("ELECTRON __dirname =", __dirname);
const preloadPath = path.join(__dirname, "preload.js");
console.log("PRELOAD PATH =", preloadPath);
console.log("PRELOAD EXISTS =", fs.existsSync(preloadPath));

function createWindow() {
  const win = new BrowserWindow({
    width: 1100,
    height: 800,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  // Load Vite build output
  win.loadFile(path.join(__dirname, "dist/index.html"));

  // Open DevTools automatically for debugging
  win.webContents.openDevTools();
}
ipcMain.handle("ollama-chat", async (_event, prompt) => {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: "127.0.0.1",
        port: 11434,
        path: "/api/generate",
        method: "POST",
        headers: { "Content-Type": "application/json" }
      },
      (res) => {
        let body = "";
        res.on("data", (chunk) => (body += chunk.toString()));
        res.on("end", () => {
          try {
            const json = JSON.parse(body);
            resolve(json.response);
          } catch (e) {
            reject(e);
          }
        });
      }
    );

    req.on("error", reject);

    req.write(
      JSON.stringify({
        model: "gemma:2b",
        prompt,
        stream: false
      })
    );
    req.end();
  });
});
app.whenReady().then(createWindow);