const http = require('http');
const { createCanvas } = require('canvas');
const GIFEncoder = require('gif-encoder-2');

// 1er avril 2026, 17h00 heure de l'Est (UTC-4 en avril)
const TARGET = new Date('2026-04-01T17:00:00-04:00').getTime();

const WIDTH = 480;
const HEIGHT = 120;
const FRAMES = 15;
const DELAY = 1000;

// Cache: GIF pre-genere, renouvele toutes les 30 secondes
let cachedGIF = null;
let cacheTime = 0;
const CACHE_TTL = 30000;

function pad(n) {
  return String(n).padStart(2, '0');
}

function calcTime(offset) {
  let diff = TARGET - Date.now() - (offset * 1000);
  if (diff < 0) diff = 0;

  const d = Math.floor(diff / 86400000); diff %= 86400000;
  const h = Math.floor(diff / 3600000);  diff %= 3600000;
  const m = Math.floor(diff / 60000);    diff %= 60000;
  const s = Math.floor(diff / 1000);

  return { d, h, m, s, expired: diff <= 0 && d === 0 && h === 0 && m === 0 && s === 0 };
}

function drawFrame(ctx, time) {
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  if (time.expired) {
    ctx.fillStyle = '#111111';
    ctx.font = 'bold 22px Arial, Helvetica, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText("L'offre est terminee!", WIDTH / 2, HEIGHT / 2);
    return;
  }

  const units = [
    { val: pad(time.d), label: 'JOURS' },
    { val: pad(time.h), label: 'HEURES' },
    { val: pad(time.m), label: 'MINUTES' },
    { val: pad(time.s), label: 'SECONDES' },
  ];

  const boxW = 90;
  const boxH = 80;
  const gap = 12;
  const sepW = 14;
  const totalW = (units.length * boxW) + ((units.length - 1) * (gap + sepW + gap));
  const startX = (WIDTH - totalW) / 2;
  const boxY = (HEIGHT - boxH) / 2;

  units.forEach((unit, i) => {
    const x = startX + i * (boxW + gap + sepW + gap);

    ctx.fillStyle = '#f5f5f5';
    roundRect(ctx, x, boxY, boxW, boxH, 10);
    ctx.fill();

    ctx.strokeStyle = '#e8e8e8';
    ctx.lineWidth = 1;
    roundRect(ctx, x, boxY, boxW, boxH, 10);
    ctx.stroke();

    ctx.fillStyle = '#111111';
    ctx.font = 'bold 32px Arial, Helvetica, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(unit.val, x + boxW / 2, boxY + boxH / 2 - 6);

    ctx.fillStyle = '#999999';
    ctx.font = '500 8px Arial, Helvetica, sans-serif';
    ctx.fillText(unit.label, x + boxW / 2, boxY + boxH - 14);

    if (i < units.length - 1) {
      const sepX = x + boxW + gap + sepW / 2;
      ctx.fillStyle = '#cccccc';
      ctx.font = '300 24px Arial, Helvetica, sans-serif';
      ctx.fillText(':', sepX, boxY + boxH / 2 - 8);
    }
  });
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function generateGIF() {
  return new Promise((resolve, reject) => {
    const canvas = createCanvas(WIDTH, HEIGHT);
    const ctx = canvas.getContext('2d');
    const encoder = new GIFEncoder(WIDTH, HEIGHT);

    encoder.setDelay(DELAY);
    encoder.setRepeat(0);
    encoder.setQuality(20);

    const chunks = [];
    encoder.createReadStream()
      .on('data', chunk => chunks.push(chunk))
      .on('end', () => resolve(Buffer.concat(chunks)))
      .on('error', reject);

    encoder.start();

    for (let i = 0; i < FRAMES; i++) {
      const time = calcTime(i);
      drawFrame(ctx, time);
      encoder.addFrame(ctx);
    }

    encoder.finish();
  });
}

async function getCachedGIF() {
  const now = Date.now();
  if (cachedGIF && (now - cacheTime) < CACHE_TTL) {
    return cachedGIF;
  }
  cachedGIF = await generateGIF();
  cacheTime = now;
  return cachedGIF;
}

// Pre-generer le GIF au demarrage
generateGIF().then(gif => {
  cachedGIF = gif;
  cacheTime = Date.now();
  console.log('GIF pre-genere et mis en cache');
});

const PORT = process.env.PORT || 3000;

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.url === '/countdown.gif' || req.url === '/') {
    try {
      const gif = await getCachedGIF();
      res.writeHead(200, {
        'Content-Type': 'image/gif',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      });
      res.end(gif);
    } catch (err) {
      console.error(err);
      res.writeHead(500);
      res.end('Erreur de generation');
    }
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

server.listen(PORT, () => {
  console.log(`Countdown GIF server running on http://localhost:${PORT}`);
  console.log(`Open http://localhost:${PORT}/countdown.gif to see the GIF`);
});
