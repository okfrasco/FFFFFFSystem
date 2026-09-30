// Verifica nel browser senza interfaccia: apre l'host (npm run dev acceso), carica una
// patch, preme Play, aspetta, salva uno screenshot e stampa eccezioni ed errori.
//
//   node scripts/browser-check.mjs patches/demo.json [secondi] [file.wav] [nodi con campione]
//   node scripts/browser-check.mjs patch.json 4 suono.wav gr,sa
//
// Serve Google Chrome (percorso macOS qui sotto, o CHROME=...). Porta del dev server: PORT (5199).
// Screenshot in browser-check.png. WebGL passa da SwiftShader (lento ma funziona).
// Nota: readPixels dopo la composizione dà nero, per le immagini servono gli screenshot.
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const [patchPath, seconds = '4', wav, wavNodes = ''] = process.argv.slice(2);
if (!patchPath) {
  console.error('uso: node scripts/browser-check.mjs <patch.json> [secondi] [file.wav] [nodo,nodo]');
  process.exit(1);
}
const patch = JSON.parse(readFileSync(patchPath, 'utf8'));
const port = process.env.PORT ?? '5199';
const chromePath = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const chrome = spawn(chromePath, [
  '--headless=new', '--remote-debugging-port=9339', '--autoplay-policy=no-user-gesture-required',
  `--window-size=${process.env.WIN ?? '1560,1000'}`, '--enable-unsafe-swiftshader', '--use-angle=swiftshader',
  '--user-data-dir=/tmp/ffffff-browser-check', 'about:blank',
], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let targets;
for (let i = 0; i < 50; i++) {
  try { targets = await (await fetch('http://127.0.0.1:9339/json')).json(); break; } catch { await sleep(200); }
}
const ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r));
let id = 0;
const pending = new Map();
const logs = [];
ws.addEventListener('message', (m) => {
  const d = JSON.parse(m.data);
  if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); }
  if (d.method === 'Runtime.exceptionThrown') logs.push('ECCEZIONE ' + (d.params.exceptionDetails.exception?.description ?? d.params.exceptionDetails.text ?? '').slice(0, 400));
  if (d.method === 'Runtime.consoleAPICalled' && d.params.type === 'error') logs.push('ERRORE ' + d.params.args.map((a) => a.value ?? a.description).join(' ').slice(0, 300));
});
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (e) => (await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true, userGesture: true })).result?.result?.value;
await send('Runtime.enable');
await send('Page.navigate', { url: `http://localhost:${port}/` });
await sleep(1500);
await ev(`localStorage.setItem('ffffff.patch.v1', ${JSON.stringify(JSON.stringify(patch))}); location.reload(); true`);
await sleep(2500);
if (wav) {
  await send('DOM.enable');
  const doc = await send('DOM.getDocument', { depth: -1 });
  for (const node of wavNodes.split(',').filter(Boolean)) {
    const q = await send('DOM.querySelector', { nodeId: doc.result.root.nodeId, selector: `.node[data-node="${node}"] input[type=file]` });
    if (q.result?.nodeId) await send('DOM.setFileInputFiles', { nodeId: q.result.nodeId, files: [resolve(wav)] });
    else logs.push(`nessun caricamento file nel nodo ${node}`);
  }
  await sleep(1500);
}
await ev(`document.querySelector('[data-a=play]').click(); true`);
await sleep(Number(seconds) * 1000);
console.log('nodi:', await ev(`JSON.stringify(window.ffffff.engine.patch.nodes.map((n) => n.id))`));
console.log('livelli audio (rms):', await ev(`JSON.stringify(Object.fromEntries([...window.ffffff.host.scopes].map(([k, s]) => [k, +s.rms.toFixed(3)])))`));
console.log('stato:', await ev(`document.querySelector('.status, #status')?.textContent ?? ''`));
const shot = await send('Page.captureScreenshot', { format: 'png' });
writeFileSync('browser-check.png', Buffer.from(shot.result.data, 'base64'));
console.log(logs.join('\n') || 'nessuna eccezione');
ws.close();
chrome.kill();
