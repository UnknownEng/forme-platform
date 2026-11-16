// Renders the narrated Forme pitch video.
// 1) screenshots of the real product, 2) Windows text-to-speech narration per scene,
// 3) deterministic frame-by-frame render of pitch.html, 4) ffmpeg mux.
// Usage: node pitch.js [publicUrlShownAtTheEnd]
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { launch, sleep, OUT } = require('./lib');

const URL_TEXT = process.argv[2] || 'forme-platform.vercel.app';
const FPS = 30;
const VOICE = process.env.FORME_VOICE || 'Microsoft Zira Desktop';

const NARRATION = [
  "Every day, shoppers across Pakistan order clothes online, and then the size is wrong. This is Forme: fit tech for Pakistan's fashion brands.",
  "Clothing has the highest return rates in online shopping, often thirty to forty percent, and size is the number one reason. In Pakistan it is worse, because most orders are cash on delivery, and a size doubt at the door becomes a refused parcel.",
  "Every one of those parcels costs a courier trip out and back, handling and restocking, a lost sale, and the shopper's trust.",
  "Forme removes the guesswork. A shopper answers three quick questions: height, weight, and how they like their clothes to fit. Then they get their size on every product, from lawn kurtas to denim.",
  "Brands sync their size charts. Our engine compares the shopper with each garment's own measurements, and returns a size, a confidence score, and fit notes for every area. And it is honest when it is only estimating.",
  "It ships as a one line widget, a REST API, a merchant console with live analytics, and an admin panel to run the whole platform.",
  "And it learns. Every keep, return or refusal feeds back into the engine, so products that run small or large are corrected automatically.",
  "Even a cautious ten percent drop in size returns adds up. For a brand shipping fifty thousand orders a month, that is about thirty lakh rupees a year in courier and handling costs alone.",
  "Brands start free. Growing brands pay nine thousand nine hundred and ninety nine rupees a month, and large brands pay a share of the savings we can measure.",
  "Our edge: sizing built for how Pakistan shops, from kurtas to shalwar kameez. Built to cut refused parcels. Live in an afternoon. And a model that learns from every return.",
  "Let's run a pilot. One category, four to eight weeks, free for pilot brands, with the results measured together. Forme. The right size, the first time."
];

const sh = (cmd, args) => execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const dur = f => Number(sh('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).trim());

async function screenshots(context) {
  const { createApp } = require('../src/app');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'forme-pitch-'));
  const app = createApp({ DATA_DIR: dir, LOG_REQUESTS: false });
  await new Promise(r => app.server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${app.server.address().port}`;
  const page = await context.newPage();
  const shot = async opts => `data:image/jpeg;base64,${(await page.screenshot({ type: 'jpeg', quality: 88, ...opts })).toString('base64')}`;
  const out = {};

  await page.goto(base + '/', { waitUntil: 'networkidle' }); await sleep(3500);
  out.landing = await shot({});

  await page.goto(base + '/demo#/p/NL-KRT-11', { waitUntil: 'networkidle' }); await sleep(800);
  await page.locator('[data-forme-sku] >> .trigger').click(); await sleep(700);
  await page.locator('[data-forme-panel] >> input[name=height]').fill('160');
  await page.locator('[data-forme-panel] >> input[name=weight]').fill('55');
  await page.locator('[data-forme-panel] >> .card[data-v=female]').click();
  await page.locator('[data-forme-panel] >> .foot .btn').click(); await sleep(500);
  await page.locator('[data-forme-panel] >> .foot .btn:not(.ghost)').click(); await sleep(3000);
  out.widget = await shot({ clip: { x: 1480, y: 64, width: 440, height: 680 } });

  await page.goto(base + '/console', { waitUntil: 'networkidle' });
  await page.locator('#demo-btn').click(); await page.waitForSelector('.kpi'); await sleep(3500);
  out.console = await shot({});
  await page.close();
  await new Promise(r => app.server.close(r));
  return out;
}

function narrate(dir) {
  fs.mkdirSync(dir, { recursive: true });
  const ps = [
    'Add-Type -AssemblyName System.Speech',
    '$s = New-Object System.Speech.Synthesis.SpeechSynthesizer',
    `$s.SelectVoice('${VOICE}')`,
    '$s.Rate = 0',
    ...NARRATION.map((text, i) => `$s.SetOutputToWaveFile('${path.join(dir, `vo${i}.wav`)}'); $s.Speak('${text.replace(/'/g, "''")}')`),
    '$s.Dispose()',
  ].join('; ');
  sh('powershell', ['-NoProfile', '-Command', ps]);
  return NARRATION.map((_, i) => path.join(dir, `vo${i}.wav`));
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const { browser, context } = await launch();
  console.log('Capturing product screenshots…');
  const imgs = await screenshots(context);

  console.log('Generating narration…');
  const wavs = narrate(path.join(OUT, 'vo'));
  const LEAD = 0.5, TAIL = 0.9;
  const durs = wavs.map(w => Math.max(5, +(dur(w) + LEAD + TAIL).toFixed(2)));
  durs[durs.length - 1] += 1.5;

  // Build the page with garments and screenshots inlined.
  const { garment, artBox } = await import('../public/js/art.js');
  let html = fs.readFileSync(path.join(__dirname, 'pitch.html'), 'utf8')
    .replace(/\{\{G:([^:]+):(\d+)\}\}/g, (_, c, n) => garment(c, Number(n)))
    .replace(/\{\{A:([^:]+):(\d+)\}\}/g, (_, c, n) => artBox(c, Number(n)))
    .replace(/\{\{IMG:(\w+)\}\}/g, (_, k) => imgs[k])
    .replace('{{URL}}', URL_TEXT);
  const built = path.join(OUT, 'pitch-built.html');
  fs.writeFileSync(built, html);

  console.log('Rendering frames…');
  const page = await context.newPage();
  await page.goto('file:///' + built.replace(/\\/g, '/'), { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  const total = await page.evaluate(d => window.__setTimeline(d), durs);
  const framesDir = path.join(OUT, 'pitch-frames');
  fs.rmSync(framesDir, { recursive: true, force: true });
  fs.mkdirSync(framesDir, { recursive: true });
  const n = Math.ceil(total * FPS);
  for (let i = 0; i < n; i++) {
    await page.evaluate(t => window.__seek(t), i / FPS);
    fs.writeFileSync(path.join(framesDir, `p${String(i).padStart(5, '0')}.jpg`), await page.screenshot({ type: 'jpeg', quality: 90 }));
    if (i % 300 === 0) console.log(`  frame ${i}/${n}`);
  }
  await browser.close();

  console.log('Mixing audio and encoding…');
  const args = ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', path.join(framesDir, 'p%05d.jpg')];
  wavs.forEach(w => args.push('-i', w));
  const chains = wavs.map((_, i) => `[${i + 1}:a]aresample=48000,adelay=${LEAD * 1000}:all=1,apad,atrim=0:${durs[i]}[a${i}]`);
  const filter = `${chains.join(';')};${wavs.map((_, i) => `[a${i}]`).join('')}concat=n=${wavs.length}:v=0:a=1,loudnorm=I=-16:TP=-1.5[aout]`;
  const outFile = path.join(OUT, 'forme-pitch.mp4');
  args.push('-filter_complex', filter, '-map', '0:v', '-map', '[aout]', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', outFile);
  execFileSync('ffmpeg', args, { stdio: 'inherit' });
  console.log(`Saved ${outFile} (${total.toFixed(1)}s)`);
})().catch(e => { console.error(e); process.exit(1); });
