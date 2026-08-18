// NetEase Cloud Music client transport layer for Web & PWA.
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    const exported = factory();
    if (typeof window !== 'undefined') window.NeteaseClient = exported;
    if (typeof globalThis !== 'undefined') globalThis.NeteaseClient = exported;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const USER_AGENT =
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

  class NeteaseClient {
    constructor() {
      this.cookies = {};
      this.load();
    }

    load() {
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          const raw = window.localStorage.getItem('kumone_cookies');
          if (raw) this.cookies = JSON.parse(raw);
        }
      } catch (_) {
        this.cookies = {};
      }
    }

    get isLoggedIn() {
      return Boolean(this.cookies['MUSIC_U']);
    }

    persist() {
      try {
        const raw = JSON.stringify(this.cookies);
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem('kumone_cookies', raw);
        }
      } catch (_) {}
    }

    setCookies(newCookies) {
      Object.assign(this.cookies, newCookies);
      this.persist();
    }

    ingestCookieString(raw) {
      const parsed = {};
      for (const cookie of String(raw).split(';;')) {
        const pair = cookie.split(';')[0];
        const eq = pair.indexOf('=');
        if (eq <= 0) continue;
        const name = pair.slice(0, eq).trim();
        const value = pair.slice(eq + 1).trim();
        if (name && value && value !== '""') parsed[name] = value;
      }
      if (Object.keys(parsed).length) this.setCookies(parsed);
    }

    clearAuthCookies() {
      delete this.cookies['MUSIC_U'];
      delete this.cookies['__csrf'];
      this.persist();
    }

    cookieHeader(extra) {
      const all = { ...this.cookies };
      for (const [k, v] of Object.entries(extra || {})) {
        if (all[k] === undefined) all[k] = v;
      }
      return Object.entries(all).map(([k, v]) => `${k}=${v}`).join('; ');
    }

    absorbSetCookies(resOrCookies) {
      try {
        let raws = [];
        if (Array.isArray(resOrCookies)) {
          raws = resOrCookies;
        } else if (resOrCookies && typeof resOrCookies.headers === 'object') {
          const xSetCookie = resOrCookies.headers.get('x-set-cookie');
          if (xSetCookie) {
            raws = xSetCookie.split(';;');
          } else if (typeof resOrCookies.headers.getSetCookie === 'function') {
            raws = resOrCookies.headers.getSetCookie();
          } else if (resOrCookies.headers.get('set-cookie')) {
            raws = [resOrCookies.headers.get('set-cookie')];
          }
        }
        const parsed = {};
        const expand = [];
        for (const raw of raws) {
          const s = String(raw);
          const parts = s.split(/, (?=[A-Za-z_][\w-]*=)/);
          for (const p of parts) expand.push(p);
        }
        for (const raw of expand) {
          const pair = String(raw).split(';')[0];
          const eq = pair.indexOf('=');
          if (eq <= 0) continue;
          const name = pair.slice(0, eq).trim();
          const value = pair.slice(eq + 1).trim();
          if (name && value && value !== '""') parsed[name] = value;
        }
        if (Object.keys(parsed).length) this.setCookies(parsed);
      } catch (_) {}
    }

    getProxyUrl(targetUrl) {
      if (typeof window === 'undefined') return targetUrl;
      const customProxy = (window.localStorage && window.localStorage.getItem('kumone_proxy_url')) || '';
      if (customProxy && customProxy.trim().length > 0) {
        let base = customProxy.trim();
        if (base.includes('?')) return base + '&target=' + encodeURIComponent(targetUrl);
        return base.replace(/\/+$/, '') + (base.endsWith('/api/netease') ? '?target=' : '/api/netease?target=') + encodeURIComponent(targetUrl);
      }
      if (window.location && !window.location.hostname.endsWith('github.io')) {
        return '/api/netease?target=' + encodeURIComponent(targetUrl);
      }
      return targetUrl;
    }

    async perform(url, form) {
      const bodyStr = Object.entries(form)
        .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
        .join('&');

      const cookieStr = this.cookieHeader({ os: 'pc', appver: '3.1.17', osver: 'Version 14.0 (Build 23A344)' });
      const finalUrl = this.getProxyUrl(url);
      const isProxied = finalUrl !== url;

      const headers = {
        'Content-Type': 'application/x-www-form-urlencoded',
      };
      if (isProxied) {
        headers['X-Netease-Cookie'] = cookieStr;
      } else {
        headers['User-Agent'] = USER_AGENT;
        headers['Referer'] = 'https://music.163.com';
        headers['Cookie'] = cookieStr;
      }

      let res;
      try {
        res = await fetch(finalUrl, {
          method: 'POST',
          headers,
          body: bodyStr,
        });
      } catch (err) {
        if (typeof window !== 'undefined' && window.location && window.location.hostname.endsWith('github.io')) {
          const customProxy = window.localStorage ? window.localStorage.getItem('kumone_proxy_url') : null;
          if (!customProxy) {
            const e = new Error('由于浏览器跨域 (CORS) 限制，请在「设置 → 网络代理」中配置代理，或使用 Docker / 自建部署。');
            e.kind = 'cors';
            throw e;
          }
        }
        throw err;
      }

      this.absorbSetCookies(res);
      if (!res.ok) {
        const err = new Error(`网络错误 (${res.status})`);
        err.httpStatus = res.status;
        throw err;
      }
      return res.arrayBuffer();
    }

    async weapi(path, payload = {}) {
      const cryptoMod = (typeof window !== 'undefined' && window.NeteaseCrypto)
        ? window.NeteaseCrypto
        : (typeof require === 'function' ? require('./crypto') : {});
      const body = { ...payload, csrf_token: this.cookies['__csrf'] || '' };
      const form = cryptoMod.weapi(JSON.stringify(body));
      let fullPath = path;
      const csrf = this.cookies['__csrf'];
      if (csrf) fullPath += (fullPath.includes('?') ? '&' : '?') + 'csrf_token=' + csrf;
      return this.perform('https://music.163.com/weapi' + fullPath, form);
    }

    async eapi(path, payload = {}) {
      const cryptoMod = (typeof window !== 'undefined' && window.NeteaseCrypto)
        ? window.NeteaseCrypto
        : (typeof require === 'function' ? require('./crypto') : {});
      const apiPath = '/api' + path;
      const header = {
        os: 'web',
        appver: '2.9.7',
        osver: 'Mac OS',
        deviceId: 'kumone-web',
        requestId: String(Math.floor(20000000 + Math.random() * 10000000)),
        clientSign: '',
        versioncode: '140',
        buildver: String(Math.floor(Date.now() / 1000)),
        resolution: '1920x1080',
        channel: '',
      };
      if (this.cookies['MUSIC_U']) header['MUSIC_U'] = this.cookies['MUSIC_U'];
      if (this.cookies['__csrf']) header['__csrf'] = this.cookies['__csrf'];
      const form = cryptoMod.eapi(apiPath, JSON.stringify({ ...payload, header }));
      return this.perform('https://interface.music.163.com/eapi' + path, form);
    }
  }

  async function decode(buf) {
    let text = '';
    if (typeof buf === 'string') {
      text = buf;
    } else if (typeof TextDecoder !== 'undefined') {
      text = new TextDecoder('utf-8').decode(buf);
    } else {
      text = Buffer.from(buf).toString('utf8');
    }

    let obj;
    try {
      obj = JSON.parse(text);
    } catch (e) {
      const err = new Error('数据解析失败');
      err.kind = 'decoding';
      throw err;
    }
    if (obj && typeof obj === 'object' && 'code' in obj && obj.code !== 200) {
      if (obj.code === 301) {
        const err = new Error('需要登录');
        err.kind = 'needLogin';
        throw err;
      }
      const err = new Error(obj.message || obj.msg || `接口错误 (${obj.code})`);
      err.kind = 'business';
      err.code = obj.code;
      throw err;
    }
    return obj;
  }

  const clientInstance = new NeteaseClient();

  return { client: clientInstance, decode, USER_AGENT };
});
