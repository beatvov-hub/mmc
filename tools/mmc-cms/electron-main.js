"use strict";

const fs = require("node:fs");
const fsp = require("node:fs/promises");
const http = require("node:http");
const path = require("node:path");
const { app, BrowserWindow, dialog } = require("electron");
const { findMmcRepoRoot, isMmcRepoRoot } = require("./lib/repo-locator");

const PORT = Number(process.env.MMC_CMS_PORT || 4310);
const LOCAL_URL = `http://127.0.0.1:${PORT}/`;
let mainWindow = null;
let ownedServer = null;

function statusIsHealthy() {
  return new Promise((resolve) => {
    const request = http.get(`${LOCAL_URL}api/status`, { timeout: 1500 }, (response) => {
      let body = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => { body += chunk; });
      response.on("end", () => {
        try {
          resolve(response.statusCode === 200 && JSON.parse(body).ok === true);
        } catch {
          resolve(false);
        }
      });
    });
    request.on("timeout", () => { request.destroy(); resolve(false); });
    request.on("error", () => resolve(false));
  });
}

function repoSettingPath() {
  return path.join(app.getPath("userData"), "repo-root.json");
}

function loadSavedRepoRoot() {
  try {
    const saved = JSON.parse(fs.readFileSync(repoSettingPath(), "utf8"));
    return isMmcRepoRoot(saved.repoRoot) ? path.resolve(saved.repoRoot) : "";
  } catch {
    return "";
  }
}

async function saveRepoRoot(repoRoot) {
  await fsp.mkdir(path.dirname(repoSettingPath()), { recursive: true });
  await fsp.writeFile(repoSettingPath(), `${JSON.stringify({ repoRoot }, null, 2)}\n`, "utf8");
}

async function chooseRepoRoot() {
  const selected = await dialog.showOpenDialog({
    title: "MMCリポジトリを選択",
    message: "src、scripts、toolsフォルダーが入っているmmcフォルダーを選択してください。",
    properties: ["openDirectory"]
  });
  if (selected.canceled || !selected.filePaths[0]) return "";
  if (!isMmcRepoRoot(selected.filePaths[0])) {
    await dialog.showMessageBox({
      type: "error",
      title: "MMC Workline",
      message: "選択したフォルダーはMMCリポジトリではありません。",
      detail: "src/data/loungeLogs.json と既存の生成スクリプトを確認できませんでした。"
    });
    return chooseRepoRoot();
  }
  return path.resolve(selected.filePaths[0]);
}

async function resolveRepoRoot() {
  const detected = findMmcRepoRoot([
    process.env.MMC_REPO_ROOT,
    process.env.PORTABLE_EXECUTABLE_DIR,
    path.dirname(process.execPath),
    process.cwd(),
    app.getAppPath()
  ]);
  if (detected) return detected;
  const saved = loadSavedRepoRoot();
  if (saved) return saved;
  return chooseRepoRoot();
}

function startServer(repoRoot) {
  process.env.MMC_REPO_ROOT = repoRoot;
  const { createServer } = require("./server");
  return new Promise((resolve, reject) => {
    const server = createServer();
    const onError = (error) => reject(error);
    server.once("error", onError);
    server.listen(PORT, "127.0.0.1", () => {
      server.off("error", onError);
      ownedServer = server;
      resolve();
    });
  });
}

function createWindow(repoRoot) {
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 900,
    minWidth: 980,
    minHeight: 680,
    show: false,
    title: "MMC Workline",
    icon: path.join(repoRoot, "favicon.ico"),
    backgroundColor: "#f3efe3",
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true
    }
  });
  mainWindow.removeMenu();
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  mainWindow.webContents.on("will-navigate", (event, targetUrl) => {
    if (!targetUrl.startsWith(LOCAL_URL)) event.preventDefault();
  });
  mainWindow.once("ready-to-show", () => mainWindow.show());
  mainWindow.on("closed", () => { mainWindow = null; });
  mainWindow.loadURL(LOCAL_URL);
}

async function launch() {
  const repoRoot = await resolveRepoRoot();
  if (!repoRoot) {
    app.quit();
    return;
  }
  await saveRepoRoot(repoRoot);
  if (!(await statusIsHealthy())) {
    try {
      await startServer(repoRoot);
    } catch (error) {
      await dialog.showMessageBox({
        type: "error",
        title: "MMC Workline",
        message: "MMC Worklineを起動できませんでした。",
        detail: error.code === "EADDRINUSE"
          ? `ポート ${PORT} は別のアプリで使用されています。`
          : String(error.message || error)
      });
      app.quit();
      return;
    }
  }
  createWindow(repoRoot);
}

const hasLock = app.requestSingleInstanceLock();
if (!hasLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  });
  app.whenReady().then(launch).catch(async (error) => {
    await dialog.showMessageBox({ type: "error", title: "MMC Workline", message: String(error.message || error) });
    app.quit();
  });
}

app.on("window-all-closed", () => app.quit());
app.on("before-quit", () => {
  if (ownedServer) ownedServer.close();
});
