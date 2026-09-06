// Renders the Open Graph card from the real WebGPU scene: loads /og in headless
// Chrome at 1200x630, waits for the intro to settle, and writes the frame to
// app/opengraph-image.png (Next's file convention picks it up from there).
//
//   pnpm og [url]        default http://localhost:3000/og
//
// Needs Node >= 22 (built-in WebSocket) and Google Chrome.

import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

if (typeof WebSocket === "undefined") {
  console.error(`og.mjs needs Node >= 22 (built-in WebSocket); running ${process.version}. Try: nvm use 22`);
  process.exit(1);
}

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PAGE_URL = process.argv[2] ?? "http://localhost:3000/og";
const OUT = new URL("../app/opengraph-image.png", import.meta.url);
const WIDTH = 1200;
const HEIGHT = 630;
/** The intro runs 5.5s; give it margin so the field is fully settled. */
const SETTLE_MS = 9000;
const PORT = 9477;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const chrome = spawn(CHROME, [
  "--headless=new", "--no-first-run", "--no-default-browser-check",
  `--user-data-dir=${join(tmpdir(), "astra-og-chrome")}`,
  "--ignore-gpu-blocklist", "--enable-unsafe-webgpu", "--enable-features=WebGPU",
  "--use-angle=metal", "--hide-scrollbars", "--force-device-scale-factor=1",
  `--window-size=${WIDTH},${HEIGHT}`, `--remote-debugging-port=${PORT}`, "about:blank",
], { stdio: "ignore" });
const kill = () => { try { chrome.kill("SIGKILL"); } catch {} };
process.on("exit", kill);

let up = false;
for (let i = 0; i < 100 && !up; i++) {
  try { await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json(); up = true; } catch { await sleep(200); }
}
if (!up) throw new Error("Chrome DevTools endpoint never came up");

const target = (await (await fetch(`http://127.0.0.1:${PORT}/json`)).json()).find((t) => t.type === "page");
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let id = 0;
const pending = new Map();
ws.onmessage = (m) => {
  const msg = JSON.parse(m.data);
  if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
};
const send = (method, params = {}) => new Promise((res) => {
  const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params }));
});
const evaluate = async (expression) =>
  (await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true })).result?.result?.value;

await send("Runtime.enable");
await send("Page.enable");
// Lock the viewport so the card is exactly 1200x630 regardless of window chrome.
await send("Emulation.setDeviceMetricsOverride", { width: WIDTH, height: HEIGHT, deviceScaleFactor: 1, mobile: false });
await send("Page.navigate", { url: PAGE_URL });
// Next's dev-tools badge renders into a portal outside the app tree; the card
// is captured from whichever server is running, so hide it either way.
await send("Page.addScriptToEvaluateOnNewDocument", {
  source: `document.addEventListener('DOMContentLoaded', () => {
    const style = document.createElement('style');
    style.textContent = 'nextjs-portal, [data-nextjs-toast], #__next-build-watcher { display: none !important; }';
    document.head.appendChild(style);
  });`,
});
await send("Page.reload", { ignoreCache: false });
await sleep(SETTLE_MS);

const drew = await evaluate(`(() => {
  const c = document.querySelector('canvas');
  return !!c && c.width > 0 && c.height > 0;
})()`);
if (!drew) throw new Error("No canvas on the page; the renderer did not start");

const shot = await send("Page.captureScreenshot", {
  format: "png",
  clip: { x: 0, y: 0, width: WIDTH, height: HEIGHT, scale: 1 },
  captureBeyondViewport: false,
});
const bytes = Buffer.from(shot.result.data, "base64");

// A frame that never rendered is a near-uniform image; refuse to ship one.
const distinct = new Set();
for (let i = 0; i < bytes.length; i += 997) distinct.add(bytes[i]);
if (distinct.size < 16) throw new Error("Captured frame looks blank; refusing to write");

writeFileSync(OUT, bytes);
console.log(`wrote ${OUT.pathname} (${WIDTH}x${HEIGHT}, ${(bytes.length / 1024).toFixed(0)} KB)`);
ws.close();
kill();
