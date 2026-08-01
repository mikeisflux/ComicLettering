/* LetterMyComic desktop wrapper.
   A thin shell around lettermycomic.com/app whose real job is OS
   integration: it owns the .lmc file type (icon + double-click-to-open,
   registered by the installer via electron-builder's fileAssociations)
   and hands opened files to the web app through window.lmcOpenProject
   (see Editor.tsx). The studio itself always runs the live site, so the
   wrapper never goes stale. */
const { app, BrowserWindow, shell } = require("electron");
const fs = require("fs");
const path = require("path");

const APP_URL = process.env.LMC_URL || "https://lettermycomic.com/app";

let win = null;
let ready = false;            // web app finished loading
const pendingFiles = [];      // .lmc paths waiting for the app to be ready

function queueFile(p) {
  if (!p || !/\.lmc$/i.test(p) || !fs.existsSync(p)) return;
  pendingFiles.push(p);
  if (ready) flushFiles();
}

function flushFiles() {
  if (!win) return;
  while (pendingFiles.length) {
    const p = pendingFiles.shift();
    let text;
    try { text = fs.readFileSync(p, "utf8"); } catch { continue; }
    const name = path.basename(p);
    win.webContents.executeJavaScript(
      `window.lmcOpenProject && window.lmcOpenProject(${JSON.stringify(text)}, ${JSON.stringify(name)})`
    ).catch(() => {});
  }
}

function createWindow() {
  win = new BrowserWindow({
    width: 1440,
    height: 920,
    icon: path.join(__dirname, "build", "icon.png"),
    autoHideMenuBar: true,            // the studio has its own menu bar
    webPreferences: { sandbox: true },
  });
  /* outbound links (pricing, blog, PayPal…) belong in the real browser */
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
  win.webContents.on("did-finish-load", () => { ready = true; flushFiles(); });
  win.on("closed", () => { win = null; ready = false; });
  win.loadURL(APP_URL);
}

/* single instance: a double-clicked .lmc while the app runs lands here */
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", (_e, argv) => {
    argv.forEach(queueFile);
    if (win) { if (win.isMinimized()) win.restore(); win.focus(); }
  });
  /* macOS delivers opened files as events (may arrive before ready) */
  app.on("open-file", (e, p) => { e.preventDefault(); queueFile(p); });
  /* Windows/Linux deliver them as argv */
  process.argv.slice(1).forEach(queueFile);

  app.whenReady().then(() => {
    createWindow();
    app.on("activate", () => { if (!win) createWindow(); });
  });
  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
}
