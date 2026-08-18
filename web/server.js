#!/usr/bin/env node
// Kumone Web Server (Zero-dependency Node.js HTTP server + NetEase CORS Reverse Proxy)
'use strict';

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const STATIC_DIR = __dirname;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
};

const server = http.createServer((req, res) => {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Netease-Cookie, Cookie, Authorization');
  res.setHeader('Access-Control-Expose-Headers', 'X-Set-Cookie, Set-Cookie');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const hostHeader = req.headers.host || `localhost:${PORT}`;
  const parsedUrl = new URL(req.url, `http://${hostHeader}`);
  const pathname = parsedUrl.pathname;

  // 1. NetEase Reverse Proxy Endpoint: /api/netease?target=https://...
  if (pathname.startsWith('/api/netease')) {
    const targetUrlStr = parsedUrl.searchParams.get('target');
    if (!targetUrlStr) {
      res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: 'Missing target query parameter' }));
      return;
    }

    let bodyChunks = [];
    req.on('data', (chunk) => bodyChunks.push(chunk));
    req.on('end', async () => {
      const rawBody = Buffer.concat(bodyChunks);
      const customCookie = req.headers['x-netease-cookie'] || req.headers['cookie'] || '';

      try {
        const neteaseRes = await fetch(targetUrlStr, {
          method: req.method,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
            'Referer': 'https://music.163.com',
            'Content-Type': req.headers['content-type'] || 'application/x-www-form-urlencoded',
            'Cookie': customCookie,
          },
          body: ['POST', 'PUT', 'PATCH'].includes(req.method) ? rawBody : undefined,
        });

        const resHeaders = {
          'Content-Type': neteaseRes.headers.get('content-type') || 'application/json; charset=utf-8',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Expose-Headers': 'X-Set-Cookie, Set-Cookie',
        };

        const setCookies = typeof neteaseRes.headers.getSetCookie === 'function'
          ? neteaseRes.headers.getSetCookie()
          : (neteaseRes.headers.get('set-cookie') ? [neteaseRes.headers.get('set-cookie')] : []);
        if (setCookies.length) {
          resHeaders['X-Set-Cookie'] = setCookies.join(';;');
        }

        res.writeHead(neteaseRes.status, resHeaders);
        const arrayBuf = await neteaseRes.arrayBuffer();
        res.end(Buffer.from(arrayBuf));
      } catch (err) {
        res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // 2. Static File Serving
  let reqUrl = pathname;
  if (reqUrl === '/' || reqUrl === '') reqUrl = '/index.html';

  const safePath = path.normalize(path.join(STATIC_DIR, reqUrl));
  if (!safePath.startsWith(STATIC_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Forbidden');
    return;
  }

  fs.stat(safePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not Found');
      return;
    }

    const ext = path.extname(safePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': stats.size,
      'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=86400',
    });

    const stream = fs.createReadStream(safePath);
    stream.pipe(res);
  });
});

if (require.main === module) {
  server.listen(PORT, HOST, () => {
    console.log(`Kumone Web Player running at http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}/`);
  });
}

module.exports = server;
