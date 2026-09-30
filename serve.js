/**
 * Tiny static server used for measurement.
 *  mode "naive":     no compression, Cache-Control: no-cache (a badly configured host)
 *  mode "optimised": Brotli/gzip for text, immutable caching for fingerprinted assets, 30d for images
 */
const http = require('http'), fs = require('fs'), path = require('path'), zlib = require('zlib');
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'application/javascript', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.json': 'application/json' };

function start(dir, port, mode) {
  return new Promise(resolve => {
    const srv = http.createServer((req, res) => {
      let p = decodeURIComponent(req.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html';
      const file = path.join(dir, path.normalize(p));
      if (!file.startsWith(dir) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end('Not found'); }
      const ext = path.extname(file); let body = fs.readFileSync(file);
      const h = { 'Content-Type': TYPES[ext] || 'application/octet-stream' };
      if (mode === 'optimised') {
        h['Cache-Control'] = /\.[0-9a-f]{8}\.(css|js)$/.test(file) ? 'public, max-age=31536000, immutable' : ext === '.html' ? 'no-cache' : 'public, max-age=2592000';
        if (/\.(html|css|js|svg|json)$/.test(ext)) {
          const ae = req.headers['accept-encoding'] || '';
          if (ae.includes('br')) { body = zlib.brotliCompressSync(body); h['Content-Encoding'] = 'br'; }
          else if (ae.includes('gzip')) { body = zlib.gzipSync(body); h['Content-Encoding'] = 'gzip'; }
          h['Vary'] = 'Accept-Encoding';
        }
      } else { h['Cache-Control'] = 'no-cache'; }
      h['Content-Length'] = body.length; res.writeHead(200, h); res.end(body);
    }).listen(port, () => resolve(srv));
  });
}
module.exports = { start };
if (require.main === module) { const [d, p, m] = process.argv.slice(2); start(path.resolve(d), +p || 8080, m || 'optimised').then(() => console.log(`Serving ${d} on http://localhost:${p || 8080} (${m || 'optimised'})`)); }
