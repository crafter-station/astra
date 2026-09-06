// Proof-of-pixels: drives headless Chrome over the DevTools Protocol, waits
// for the vgpu renderer to report ready, then captures the hero at several
// moments plus a simulated drag and hover. Needs Node >= 22 (built-in
// WebSocket) and Google Chrome; `next dev` must be serving the URL.
//
//   pnpm capture [url] [outDir]     -> captures/*.png

import { spawn } from 'node:child_process';

if (typeof WebSocket === 'undefined') {
  console.error(`capture.mjs needs Node >= 22 (built-in WebSocket); running ${process.version}. Try: nvm use 22`);
  process.exit(1);
}
import { mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const S = process.argv[3] ?? new URL('../captures/', import.meta.url).pathname;
const PAGE_URL = process.argv[2] ?? 'http://localhost:3000/';
mkdirSync(S, { recursive: true });
const PORT = 9333;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const chrome = spawn(
  CHROME,
  [
    '--headless=new', '--no-first-run', '--no-default-browser-check',
    `--user-data-dir=${join(tmpdir(), "gpt-6-astra-chrome-cdp")}`, '--ignore-gpu-blocklist',
    '--enable-unsafe-webgpu', '--enable-features=WebGPU', '--use-angle=metal',
    '--hide-scrollbars', '--window-size=1440,900', `--remote-debugging-port=${PORT}`,
    'about:blank',
  ],
  { stdio: 'ignore' },
);
const kill = () => { try { chrome.kill('SIGKILL'); } catch {} };
process.on('exit', kill);

let ok = false;
for (let i = 0; i < 100 && !ok; i++) {
  try { await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json(); ok = true; } catch { await sleep(200); }
}
if (!ok) throw new Error('DevTools endpoint never came up');
const targets = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
const page = targets.find((t) => t.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });

let nextId = 0;
const pending = new Map();
const events = [];
ws.onmessage = (m) => {
  const msg = JSON.parse(m.data);
  if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
  else if (msg.method) events.push(msg);
};
const send = (method, params = {}) => new Promise((res) => {
  const id = ++nextId; pending.set(id, res); ws.send(JSON.stringify({ id, method, params }));
});
const evaluate = async (expression) => {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  return r.result?.result?.value ?? r.result?.exceptionDetails?.text;
};
const capture = async (name) => {
  const r = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(`${S}/${name}.png`, Buffer.from(r.result.data, 'base64'));
  console.log('captured', name);
};

await send('Runtime.enable'); await send('Log.enable'); await send('Page.enable');
await send('Page.navigate', { url: PAGE_URL });

const status = () => evaluate(
  `(document.querySelector('.title small')?.textContent || '') + ' | ' + (document.querySelector('.status')?.textContent || '')`,
);
const t0 = Date.now();
let st = '';
while (Date.now() - t0 < 25000) {
  st = await status();
  if (st && !st.startsWith('Compiling') && st.trim() !== '|') break;
  await sleep(250);
}
console.log(`status after ${Date.now() - t0} ms: ${st}`);
console.log('adapter:', await evaluate(`navigator.gpu ? navigator.gpu.requestAdapter().then(a => a ? JSON.stringify({vendor: a.info?.vendor, architecture: a.info?.architecture, device: a.info?.device, description: a.info?.description}) : 'no adapter') : 'navigator.gpu missing'`));

await capture('cdp-1-start');
await sleep(2200); await capture('cdp-2-intro');
await sleep(6500); await capture('cdp-3-settled');

// Simulated drag: press, sweep right/down, capture mid-drag, release.
await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 640, y: 480 });
await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: 640, y: 480, button: 'left', buttons: 1, clickCount: 1 });
for (let i = 1; i <= 16; i++) {
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 640 + i * 14, y: 480 + i * 5, button: 'left', buttons: 1 });
  await sleep(25);
}
await sleep(150); await capture('cdp-4-drag');
await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 640 + 16 * 14, y: 480 + 16 * 5, button: 'left', buttons: 0, clickCount: 1 });
await sleep(1200); await capture('cdp-5-release');

// Hover sweep for the repel simulation.
for (let i = 0; i <= 30; i++) { await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 400 + i * 20, y: 420 + Math.sin(i / 4) * 40 }); await sleep(16); }
await sleep(120); await capture('cdp-6-hover');

const errors = events.filter((e) =>
  e.method === 'Runtime.exceptionThrown' ||
  (e.method === 'Log.entryAdded' && e.params.entry.level === 'error') ||
  (e.method === 'Runtime.consoleAPICalled' && (e.params.type === 'error' || e.params.type === 'warning')),
);
console.log('console errors/warnings:', errors.length);
for (const e of errors.slice(0, 12)) console.log('  ', JSON.stringify(e.params).slice(0, 500));
ws.close();
kill();
