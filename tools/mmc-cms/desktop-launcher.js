const { spawn, spawnSync } = require("child_process");
const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = Number(process.env.MMC_CMS_PORT || 4310);
const LOCAL_URL = `http://127.0.0.1:${PORT}/`;
const ROOT = path.resolve(__dirname, "../..");
const PROFILE_DIR = path.join(__dirname, ".workline-app-profile");

function checkStatus() {
  return new Promise((resolve) => {
    const request = http.get(`${LOCAL_URL}api/status`, { timeout: 1200 }, (response) => {
      let body = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => { body += chunk; });
      response.on("end", () => {
        try {
          const parsed = JSON.parse(body);
          resolve(response.statusCode === 200 && parsed.ok === true);
        } catch {
          resolve(false);
        }
      });
    });
    request.on("timeout", () => { request.destroy(); resolve(false); });
    request.on("error", () => resolve(false));
  });
}

async function waitForServer(timeoutMs = 10000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await checkStatus()) return true;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return false;
}

function findAppBrowser() {
  const candidates = [
    path.join(process.env.ProgramFiles || "", "Microsoft/Edge/Application/msedge.exe"),
    path.join(process.env["ProgramFiles(x86)"] || "", "Microsoft/Edge/Application/msedge.exe"),
    path.join(process.env.LocalAppData || "", "Microsoft/Edge/Application/msedge.exe"),
    path.join(process.env.ProgramFiles || "", "Google/Chrome/Application/chrome.exe"),
    path.join(process.env["ProgramFiles(x86)"] || "", "Google/Chrome/Application/chrome.exe"),
    path.join(process.env.LocalAppData || "", "Google/Chrome/Application/chrome.exe"),
    path.join(process.env.ProgramFiles || "", "BraveSoftware/Brave-Browser/Application/brave.exe"),
    path.join(process.env["ProgramFiles(x86)"] || "", "BraveSoftware/Brave-Browser/Application/brave.exe")
  ].filter(Boolean);
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  const where = spawnSync("where", ["msedge", "chrome", "brave"], { encoding: "utf8", windowsHide: true });
  if (where.status === 0) {
    const first = where.stdout.split(/\r?\n/).map((line) => line.trim()).find(Boolean);
    if (first && fs.existsSync(first)) return first;
  }
  return "";
}

function startServer() {
  return spawn(process.execPath, ["server.js", "--no-open"], {
    cwd: __dirname,
    env: { ...process.env, MMC_CMS_NO_OPEN: "1", MMC_CMS_PORT: String(PORT) },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true
  });
}

function pipeServerLog(server) {
  server.stdout.on("data", (chunk) => process.stdout.write(chunk));
  server.stderr.on("data", (chunk) => process.stderr.write(chunk));
}

function openAppWindow() {
  const browser = findAppBrowser();
  if (!browser) {
    throw new Error("Edge / Chrome / Brave が見つかりません。Workline専用ウィンドウの起動には、いずれかのブラウザのアプリモードが必要です。");
  }
  fs.mkdirSync(PROFILE_DIR, { recursive: true });
  return spawn(browser, [
    `--app=${LOCAL_URL}`,
    `--user-data-dir=${PROFILE_DIR}`,
    "--window-size=1280,860",
    "--no-first-run",
    "--disable-features=Translate"
  ], {
    cwd: ROOT,
    stdio: "ignore",
    windowsHide: true
  });
}

async function main() {
  console.log("MMC Workline app launcher");
  let server = null;
  let startedServer = false;

  if (!(await checkStatus())) {
    server = startServer();
    startedServer = true;
    pipeServerLog(server);
    const ready = await waitForServer();
    if (!ready) {
      if (server && !server.killed) server.kill();
      throw new Error(`MMC Workline を起動できませんでした。ポート ${PORT} を確認してください。`);
    }
  }

  const app = openAppWindow();
  console.log(`MMC Workline: ${LOCAL_URL}`);
  console.log("専用ウィンドウを閉じると、今回起動したWorklineサーバーも終了します。");

  app.on("exit", () => {
    if (startedServer && server && !server.killed) server.kill();
    process.exit(0);
  });

  process.on("SIGINT", () => {
    if (!app.killed) app.kill();
    if (startedServer && server && !server.killed) server.kill();
    process.exit(0);
  });
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
