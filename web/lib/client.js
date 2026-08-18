// NetEase Cloud Music client transport layer for Android & Web.
'use strict';

const USER_AGENT =
  'Mozilla/5.0 (Linux; Android 14; Mobile; rv:125.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36';

if (typeof window !== 'undefined') {
  window.__nativeHttpCallbacks = window.__nativeHttpCallbacks || {};
  window.__nativeHttpCallback = function (reqId, err, resp) {
    const cb = window.__nativeHttpCallbacks[reqId];
    if (cb) {
      delete window.__nativeHttpCallbacks[reqId];
      cb(err, resp);
    }
  };
}

function nativeHttpRequest(url, method, headers, body) {
  if (typeof window !== 'undefined' && window.AndroidBridge) {
    if (typeof window.AndroidBridge.asyncHttpRequest === 'function') {
      return new Promise((resolve, reject) => {
        const reqId = 'req_' + Math.random().toString(36).slice(2) + '_' + Date.now();
        window.__nativeHttpCallbacks[reqId] = (err, resp) => {
          if (err) {
            const error = new Error(err);
            reject(error);
          } else {
            resolve(resp);
          }
        };
        try {
          window.AndroidBridge.asyncHttpRequest(
            reqId,
            url,
            method,
            JSON.stringify(headers || {}),
            body || ''
          );
        } catch (e) {
          delete window.__nativeHttpCallbacks[reqId];
          reject(e);
        }
      });
    } else if (typeof window.AndroidBridge.httpRequest === 'function') {
      try {
        const raw = window.AndroidBridge.httpRequest(
          url,
          method,
          JSON.stringify(headers || {}),
          body || ''
        );
        const parsed = JSON.parse(raw);
        if (!parsed.ok && parsed.status === 0 && parsed.error) {
          return Promise.reject(new Error(parsed.error));
        }
        return Promise.resolve(parsed);
      } catch (e) {
        return Promise.reject(e);
      }
    }
  }
  return null;
}

class NeteaseClient {
  constructor() {
    this.cookies = {};
    this.load();
  }

  load() {
    try {
      if (typeof window !== 'undefined') {
        if (window.AndroidBridge && typeof window.AndroidBridge.getPreference === 'function') {
          const raw = window.AndroidBridge.getPreference('kumone_cookies', '{}');
          this.cookies = JSON.parse(raw);
        } else if (window.localStorage) {
          const raw = window.localStorage.getItem('kumone_cookies');
          if (raw) this.cookies = JSON.parse(raw);
        }
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
      if (typeof window !== 'undefined') {
        if (window.AndroidBridge && typeof window.AndroidBridge.setPreference === 'function') {
          window.AndroidBridge.setPreference('kumone_cookies', raw);
        }
        if (window.localStorage) {
          window.localStorage.setItem('kumone_cookies', raw);
        }
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
        raws = typeof resOrCookies.headers.getSetCookie === 'function'
          ? resOrCookies.headers.getSetCookie()
          : (resOrCookies.headers.get('set-cookie') ? [resOrCookies.headers.get('set-cookie')] : []);
      }
      const parsed = {};
      for (const raw of raws) {
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

  async perform(url, form) {
    const bodyStr = Object.entries(form)
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
      .join('&');

    const headers = {
      'User-Agent': USER_AGENT,
      'Referer': 'https://music.163.com',
      'Content-Type': 'application/x-www-form-urlencoded',
      'Cookie': this.cookieHeader({ os: 'android', appver: '8.9.70' }),
    };

    // Try native Android bridge first
    const nativePromise = nativeHttpRequest(url, 'POST', headers, bodyStr);
    if (nativePromise) {
      const resp = await nativePromise;
      if (resp && resp.cookies) {
        this.absorbSetCookies(resp.cookies);
      }
      if (!resp || !resp.ok) {
        const status = (resp && resp.status) || 0;
        const err = new Error(resp && resp.error ? resp.error : `网络错误 (${status})`);
        err.httpStatus = status;
        throw err;
      }
      return resp.data;
    }

    // Browser / Node fallback
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: bodyStr,
    });
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
      : require('./crypto');
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
      : require('./crypto');
    const apiPath = '/api' + path;
    const header = {
      os: 'android',
      appver: '8.9.70',
      osver: '14',
      deviceId: 'kumone-android',
      requestId: String(Math.floor(20000000 + Math.random() * 10000000)),
      clientSign: '',
      versioncode: '140',
      buildver: String(Math.floor(Date.now() / 1000)),
      resolution: '1080x2400',
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

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { client: clientInstance, decode, USER_AGENT };
}
if (typeof window !== 'undefined') {
  window.NeteaseClient = { client: clientInstance, decode, USER_AGENT };
}

