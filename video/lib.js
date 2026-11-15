// Shared helpers: launch the installed Chrome, capture frames, encode with ffmpeg.
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { chromium } = require('playwright-core');

const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(p => fs.existsSync(p));
const OUT = path.join(__dirname, 'out');
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function launch({ width = 1920, height = 1080 } = {}) {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--hide-scrollbars', '--force-color-profile=srgb', '--disable-features=Translate'] });
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, bypassCSP: true, colorScheme: 'dark' });
  return { browser, context };
}

// Real-time capture via Chrome's screencast. Frames arrive when the screen changes,
// each with a timestamp, so the encoder can hold each frame for the right duration.
async function screencast(page, dir, { width = 1920, height = 1080 } = {}) {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const cdp = await page.context().newCDPSession(page);
  const frames = [];
  cdp.on('Page.screencastFrame', async f => {
    const file = path.join(dir, `f${String(frames.length).padStart(6, '0')}.jpg`);
    fs.writeFileSync(file, Buffer.from(f.data, 'base64'));
    frames.push({ file, t: f.metadata.timestamp });
    cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {});
  });
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 88, maxWidth: width, maxHeight: height, everyNthFrame: 1 });
  return {
    async stop() { await cdp.send('Page.stopScreencast').catch(() => {}); await sleep(300); return frames; },
  };
}

// Variable-frame-rate list -> constant 30fps H.264 MP4.
function encodeFrames(frames, dir, outFile, { audio = null, width = 1920, height = 1080 } = {}) {
  const list = path.join(dir, 'list.txt');
  const lines = [];
  frames.forEach((f, i) => {
    const next = frames[i + 1];
    const dur = next ? Math.max(0.001, next.t - f.t) : 1.5;
    lines.push(`file '${f.file.replace(/\\/g, '/')}'`, `duration ${dur.toFixed(4)}`);
  });
  lines.push(`file '${frames[frames.length - 1].file.replace(/\\/g, '/')}'`);
  fs.writeFileSync(list, lines.join('\n'));
  const args = ['-y', '-f', 'concat', '-safe', '0', '-i', list];
  if (audio) args.push('-i', audio);
  args.push('-vf', `scale=${width}:${height}:flags=lanczos,fps=30,format=yuv420p`, '-c:v', 'libx264', '-preset', 'slow', '-crf', '20', '-movflags', '+faststart');
  if (audio) args.push('-c:a', 'aac', '-b:a', '192k', '-shortest');
  args.push(outFile);
  execFileSync('ffmpeg', args, { stdio: ['ignore', 'ignore', 'pipe'] });
}

// Caption bar + visible cursor, injected into every page of the walkthrough.
const OVERLAY = `(() => {
  const mount = () => {
    if (document.getElementById('__cap')) return;
    const st = document.createElement('style');
    st.textContent = '#__cap{position:fixed;left:50%;bottom:44px;transform:translateX(-50%) translateY(20px);z-index:2147483647;max-width:72%;padding:16px 28px;border-radius:18px;background:rgba(8,11,15,.86);color:#eef3ea;font:600 26px/1.35 Manrope,system-ui,sans-serif;letter-spacing:-.01em;text-align:center;box-shadow:0 20px 60px -20px rgba(0,0,0,.8),inset 0 0 0 1px rgba(255,255,255,.12);backdrop-filter:blur(12px);opacity:0;transition:opacity .45s,transform .45s cubic-bezier(.22,1,.36,1);pointer-events:none}' +
      '#__cap.on{opacity:1;transform:translateX(-50%)}#__cap b{color:#d4f36b;font-weight:800}' +
      '#__cur{position:fixed;z-index:2147483647;left:0;top:0;width:26px;height:26px;margin:-13px 0 0 -13px;border-radius:50%;background:rgba(212,243,107,.35);border:2px solid #d4f36b;pointer-events:none;transition:transform .15s,background .15s;box-shadow:0 0 20px rgba(212,243,107,.5)}#__cur.down{transform:scale(.7);background:rgba(212,243,107,.8)}';
    document.documentElement.appendChild(st);
    const cap = document.createElement('div'); cap.id = '__cap'; document.documentElement.appendChild(cap);
    const cur = document.createElement('div'); cur.id = '__cur'; cur.style.left = '-50px'; document.documentElement.appendChild(cur);
    addEventListener('mousemove', e => { cur.style.left = e.clientX + 'px'; cur.style.top = e.clientY + 'px'; }, true);
    addEventListener('mousedown', () => cur.classList.add('down'), true);
    addEventListener('mouseup', () => cur.classList.remove('down'), true);
    window.__cap = html => { if (!html) { cap.classList.remove('on'); return; } cap.classList.remove('on'); setTimeout(() => { cap.innerHTML = html; cap.classList.add('on'); }, html === cap.innerHTML ? 0 : 200); };
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();
})();`;

module.exports = { launch, screencast, encodeFrames, sleep, OUT, OVERLAY };
