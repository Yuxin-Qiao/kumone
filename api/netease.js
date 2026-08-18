// Vercel Serverless Function for NetEase API Reverse Proxy
'use strict';

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Netease-Cookie, Cookie, Authorization');
  res.setHeader('Access-Control-Expose-Headers', 'X-Set-Cookie, Set-Cookie');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const targetUrl = req.query.target;
  if (!targetUrl) {
    return res.status(400).json({ error: 'Missing target query parameter' });
  }

  const customCookie = req.headers['x-netease-cookie'] || req.headers['cookie'] || '';

  try {
    let body = req.body;
    if (body && typeof body === 'object' && !Buffer.isBuffer(body)) {
      body = Object.entries(body)
        .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
        .join('&');
    }

    const neteaseRes = await fetch(targetUrl, {
      method: req.method,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        'Referer': 'https://music.163.com',
        'Content-Type': req.headers['content-type'] || 'application/x-www-form-urlencoded',
        'Cookie': customCookie,
      },
      body: ['POST', 'PUT', 'PATCH'].includes(req.method) ? body : undefined,
    });

    const setCookies = typeof neteaseRes.headers.getSetCookie === 'function'
      ? neteaseRes.headers.getSetCookie()
      : (neteaseRes.headers.get('set-cookie') ? [neteaseRes.headers.get('set-cookie')] : []);
    if (setCookies.length) {
      res.setHeader('X-Set-Cookie', setCookies.join(';;'));
    }

    res.setHeader('Content-Type', neteaseRes.headers.get('content-type') || 'application/json; charset=utf-8');
    res.status(neteaseRes.status);
    const buf = await neteaseRes.arrayBuffer();
    return res.send(Buffer.from(buf));
  } catch (err) {
    return res.status(502).json({ error: err.message });
  }
};
