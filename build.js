/**
 * Build script: src/ -> after/
 *  - conservative CSS/JS/HTML minification (no external dependencies)
 *  - content-hash fingerprinting for long-term caching
 *  - responsive images (WebP srcset + JPEG fallback) generated with sharp
 * Usage: node tools/build.js   (needs: npm i sharp)
 */
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const sharp = require(process.env.SHARP_PATH || 'sharp');
const ROOT = path.join(__dirname, '..'), SRC = path.join(ROOT, 'src'), OUT = path.join(ROOT, 'after'), IMG_IN = path.join(ROOT, 'before/images');
const dests = JSON.parse(fs.readFileSync(path.join(SRC, 'destinations.json')));

const hash = s => crypto.createHash('md5').update(s).digest('hex').slice(0, 8);
const write = (p, c) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, c); };

/** CSS: strip comments/whitespace. */
const minCSS = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ').replace(/\s*([{}:;,>])\s*/g, '$1').replace(/;}/g, '}').trim();

/** JS: remove comments with a small state machine that respects strings, then trim lines.
 *  Newlines are preserved so automatic semicolon insertion behaviour never changes. */
function minJS(src) {
  let out = '', i = 0, q = null;
  while (i < src.length) {
    const c = src[i], n = src[i + 1];
    if (q) { out += c; if (c === '\\') { out += n; i += 2; continue; } if (c === q) q = null; i++; continue; }
    if (c === '"' || c === "'" || c === '`') { q = c; out += c; i++; continue; }
    if (c === '/' && n === '/') { while (i < src.length && src[i] !== '\n') i++; continue; }
    if (c === '/' && n === '*') { i = src.indexOf('*/', i + 2) + 2; continue; }
    out += c; i++;
  }
  return out.split('\n').map(l => l.replace(/[ \t]+/g, ' ').trim()).filter(Boolean).join('\n');
}
const minHTML = s => s.replace(/<!--(?!\[)[\s\S]*?-->/g, '').replace(/>\s+</g, '><').replace(/\n\s*/g, ' ').trim();

(async () => {
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(path.join(OUT, 'images'), { recursive: true });

  // ---- images ----
  const W = [480, 800, 1200], HW = [640, 1200, 1920];
  for (const d of dests) {
    const f = path.join(IMG_IN, d.id + '.jpg');
    for (const w of W) await sharp(f).resize({ width: w }).webp({ quality: 72 }).toFile(path.join(OUT, 'images', `${d.id}-${w}.webp`));
    await sharp(f).resize({ width: 800 }).jpeg({ quality: 75, mozjpeg: true }).toFile(path.join(OUT, 'images', `${d.id}-800.jpg`));
  }
  for (const w of HW) await sharp(path.join(IMG_IN, 'hero.jpg')).resize({ width: w }).webp({ quality: 70 }).toFile(path.join(OUT, 'images', `hero-${w}.webp`));
  await sharp(path.join(IMG_IN, 'hero.jpg')).resize({ width: 1200 }).jpeg({ quality: 72, mozjpeg: true }).toFile(path.join(OUT, 'images', 'hero-1200.jpg'));

  // ---- css / js with fingerprints ----
  const css = minCSS(fs.readFileSync(path.join(SRC, 'css/style.css'), 'utf8'));
  const cssName = `style.${hash(css)}.css`; write(path.join(OUT, 'css', cssName), css);
  const rev = minJS(fs.readFileSync(path.join(SRC, 'js/reviews.js'), 'utf8'));
  const revName = `reviews.${hash(rev)}.js`; write(path.join(OUT, 'js', revName), rev);
  const main = minJS(fs.readFileSync(path.join(SRC, 'js/main.js'), 'utf8')).replace('%REVIEWS%', revName);
  const mainName = `main.${hash(main)}.js`; write(path.join(OUT, 'js', mainName), main);

  // ---- html ----
  const srcset = (id, ws) => ws.map(w => `images/${id}-${w}.webp ${w}w`).join(', ');
  const cards = dests.map(d => `<div class="card"><picture><source type="image/webp" srcset="${srcset(d.id, W)}" sizes="(min-width:900px) 25vw, (min-width:560px) 50vw, 100vw"><img src="images/${d.id}-800.jpg" width="800" height="533" alt="${d.alt}" loading="lazy" decoding="async"></picture><h3>${d.title}</h3><p>${d.text}</p><a href="#" class="btn">Explore <span class="sr-only">${d.title}</span></a></div>`).join('\n');
  const heroSizes = '100vw';
  const heroImg = `<picture><source type="image/webp" srcset="${srcset('hero', HW)}" sizes="${heroSizes}"><img src="images/hero-1200.jpg" width="1200" height="600" alt="" fetchpriority="high" decoding="async"></picture>`;
  const preload = `<link rel="preload" as="image" type="image/webp" imagesrcset="${srcset('hero', HW)}" imagesizes="${heroSizes}" fetchpriority="high">`;
  let html = fs.readFileSync(path.join(SRC, 'index.html'), 'utf8')
    .replace('%CSS%', cssName).replace('%MAIN%', mainName)
    .replace('<!--HERO_PRELOAD-->', preload).replace('<!--HERO_IMG-->', heroImg).replace('<!--CARDS-->', cards);
  write(path.join(OUT, 'index.html'), minHTML(html));

  // ---- host config for real deployments ----
  write(path.join(OUT, '_headers'), `/*\n  X-Content-Type-Options: nosniff\n/index.html\n  Cache-Control: no-cache\n/css/*\n  Cache-Control: public, max-age=31536000, immutable\n/js/*\n  Cache-Control: public, max-age=31536000, immutable\n/images/*\n  Cache-Control: public, max-age=2592000\n`);
  write(path.join(OUT, '.htaccess'), `# Apache: compression + caching\n<IfModule mod_deflate.c>\n  AddOutputFilterByType DEFLATE text/html text/css application/javascript\n</IfModule>\n<IfModule mod_expires.c>\n  ExpiresActive On\n  ExpiresByType text/html "access plus 0 seconds"\n  ExpiresByType text/css "access plus 1 year"\n  ExpiresByType application/javascript "access plus 1 year"\n  ExpiresByType image/webp "access plus 30 days"\n  ExpiresByType image/jpeg "access plus 30 days"\n</IfModule>\n`);
  console.log('Built:', cssName, mainName, revName);
})();
