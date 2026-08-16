// Transport layer for NetEase Cloud Music: cookie jar + weapi/eapi requests.
// Port of Sources/Kumone/Core/API/NeteaseClient.swift.
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const ncrypto = require('./crypto');

const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

function storageDir() {
  try {
    // When running under Electron.
    const { app } = require('electron');
    if (app && app.getPath) {
      const dir = path.join(app.getPath('userData'), 'Kumone');
      fs.mkdirSync(dir, { recursive: true });
      return dir;
    }
  } catch (_) { /* plain node (tests) */ }
  const dir = path.join(os.homedir(), '.kumone-test');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

class NeteaseClient {
  constructor() {
    this.cookies = {};
    this.cookieFile = path.join(storageDir(), 'cookies.json');
    try {
      this.cookies = JSON.parse(fs.readFileSync(this.cookieFile, 'utf8'));
    } catch (_) { cookies: {} }
  }

  get isLoggedIn() { return Boolean(this.cookies['MUSIC_U']); }

  persist() {
    try { fs.writeFileSync(this.cookieFile, JSON.stringify(this.cookies)); } catch (_) {}
  }

  setCookies(newCookies) {
    Object.assign(this.cookies, newCookies);
    this.persist();
  }

  /// Ingests a `;;`-joined raw cookie string as returned by the QR login check.
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
    for (const [k, v] of Object.entries(extra || {})) if (all[k] === undefined) all[k] = v;
    return Object.entries(all).map(([k, v]) => `${k}=${v}`).join('; ');
  }

  absorbSetCookies(res) {
    const raws = typeof res.headers.getSetCookie === 'function'
      ? res.headers.getSetCookie()
      : (res.headers.get('set-cookie') ? [res.headers.get('set-cookie')] : []);
    const parsed = {};
    for (const raw of raws) {
      const pair = raw.split(';')[0];
      const eq = pair.indexOf('=');
      if (eq <= 0) continue;
      const name = pair.slice(0, eq).trim();
      const value = pair.slice(eq + 1).trim();
      if (name && value && value !== '""') parsed[name] = value;
    }
    if (Object.keys(parsed).length) this.setCookies(parsed);
  }

  async perform(url, form) {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'User-Agent': USER_AGENT,
        'Referer': 'https://music.163.com',
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': this.cookieHeader({ os: 'pc', appver: '3.1.17' }),
      },
      body: Object.entries(form)
        .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
        .join('&'),
      signal: AbortSignal.timeout(15000),
    });
    this.absorbSetCookies(res);
    if (!res.ok) {
      const err = new Error(`网络错误 (${res.status})`);
      err.httpStatus = res.status;
      throw err;
    }
    return res.arrayBuffer();
  }

  /// POST to `https://music.163.com/weapi<path>` with weapi encryption.
  async weapi(path, payload = {}) {
    const body = { ...payload, csrf_token: this.cookies['__csrf'] || '' };
    const form = ncrypto.weapi(JSON.stringify(body));
    let fullPath = path;
    const csrf = this.cookies['__csrf'];
    if (csrf) fullPath += (fullPath.includes('?') ? '&' : '?') + 'csrf_token=' + csrf;
    return this.perform('https://music.163.com/weapi' + fullPath, form);
  }

  /// POST to `https://interface.music.163.com/eapi<path>` with eapi encryption.
  async eapi(path, payload = {}) {
    const apiPath = '/api' + path;
    const header = {
      os: 'pc',
      appver: '3.1.17',
      osver: 'Version 14.0 (Build 23A344)',
      deviceId: 'kumone',
      requestId: String(Math.floor(20000000 + Math.random() * 10000000)),
      clientSign: '',
      versioncode: '140',
      buildver: String(Math.floor(Date.now() / 1000)),
      resolution: '1920x1080',
      channel: '',
    };
    if (this.cookies['MUSIC_U']) header['MUSIC_U'] = this.cookies['MUSIC_U'];
    if (this.cookies['__csrf']) header['__csrf'] = this.cookies['__csrf'];
    const form = ncrypto.eapi(apiPath, JSON.stringify({ ...payload, header }));
    return this.perform('https://interface.music.163.com/eapi' + path, form);
  }
}

/// Performs a request and decodes JSON, surfacing business-level errors.
async function decode(buf) {
  const text = Buffer.from(buf).toString('utf8');
  let obj;
  try { obj = JSON.parse(text); } catch (e) {
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

module.exports = { client: new NeteaseClient(), decode, USER_AGENT };
