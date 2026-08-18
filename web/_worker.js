// Cloudflare Pages / Worker Edge handler for Kumone Web & PWA
export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, X-Netease-Cookie, Cookie, Authorization',
          'Access-Control-Expose-Headers': 'X-Set-Cookie, Set-Cookie',
        },
      });
    }

    const url = new URL(request.url);

    // 1. NetEase Reverse Proxy Endpoint
    if (url.pathname.startsWith('/api/netease')) {
      const targetUrlStr = url.searchParams.get('target');
      if (!targetUrlStr) {
        return new Response(JSON.stringify({ error: 'Missing target parameter' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const customCookie = request.headers.get('x-netease-cookie') || request.headers.get('cookie') || '';
      const neteaseRes = await fetch(targetUrlStr, {
        method: request.method,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
          'Referer': 'https://music.163.com',
          'Content-Type': request.headers.get('content-type') || 'application/x-www-form-urlencoded',
          'Cookie': customCookie,
        },
        body: ['POST', 'PUT', 'PATCH'].includes(request.method) ? await request.arrayBuffer() : undefined,
      });

      const resHeaders = new Headers(neteaseRes.headers);
      resHeaders.set('Access-Control-Allow-Origin', '*');
      resHeaders.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      resHeaders.set('Access-Control-Allow-Headers', 'Content-Type, X-Netease-Cookie, Cookie, Authorization');
      resHeaders.set('Access-Control-Expose-Headers', 'X-Set-Cookie, Set-Cookie');

      const setCookies = typeof neteaseRes.headers.getSetCookie === 'function'
        ? neteaseRes.headers.getSetCookie()
        : (neteaseRes.headers.get('set-cookie') ? [neteaseRes.headers.get('set-cookie')] : []);
      if (setCookies.length) {
        resHeaders.set('X-Set-Cookie', setCookies.join(';;'));
      }

      return new Response(neteaseRes.body, {
        status: neteaseRes.status,
        headers: resHeaders,
      });
    }

    // 2. Fallback to static assets on Cloudflare Pages
    if (env && env.ASSETS && typeof env.ASSETS.fetch === 'function') {
      return env.ASSETS.fetch(request);
    }

    return new Response('Not Found', { status: 404 });
  }
};
