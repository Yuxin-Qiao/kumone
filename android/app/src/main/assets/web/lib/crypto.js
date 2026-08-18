// NetEase Cloud Music request encryption (weapi / eapi) for Android & Web.
'use strict';

const WEAPI_PRESET_KEY = '0CoJUm6Qyw8W8jud';
const WEAPI_IV = '0102030405060708';
const WEAPI_SECRET_KEY = 'kumone2026abcDEF';
const WEAPI_ENC_SEC_KEY =
  '38cef2efdbcc1cfd6a44d81620dae5d23091f50ef27e01a1b1bb7e998e0fde2d' +
  '7ab6002a9e79a3c195f661cbde80e21e6245997b11b54d28407115822f95d447' +
  '7cc06b5a77de46fab6568410abf1229abef81b4c8588f386149010d190bb0b04' +
  'f064be330bd877a4d4b99514febbdb4335b10744b13d9f7ee24d314d6e62cdc9';
const EAPI_KEY = 'e82ckenh8dichen8';

let nodeCrypto = null;
try {
  if (typeof require === 'function') {
    nodeCrypto = require('crypto');
  }
} catch (_) {}

function weapi(jsonText) {
  if (typeof window !== 'undefined' && window.AndroidBridge && typeof window.AndroidBridge.weapi === 'function') {
    try {
      const res = JSON.parse(window.AndroidBridge.weapi(jsonText));
      return { params: res.params, encSecKey: res.encSecKey || WEAPI_ENC_SEC_KEY };
    } catch (_) {}
  }

  if (nodeCrypto) {
    const aesEncrypt = (data, key, iv) => {
      const cipher = nodeCrypto.createCipheriv(
        `aes-128-${iv ? 'cbc' : 'ecb'}`,
        Buffer.from(key, 'utf8'),
        iv ? Buffer.from(iv, 'utf8') : null
      );
      return Buffer.concat([cipher.update(Buffer.from(data, 'utf8')), cipher.final()]);
    };
    const first = aesEncrypt(jsonText, WEAPI_PRESET_KEY, WEAPI_IV).toString('base64');
    const second = aesEncrypt(first, WEAPI_SECRET_KEY, WEAPI_IV).toString('base64');
    return { params: second, encSecKey: WEAPI_ENC_SEC_KEY };
  }

  return { params: '', encSecKey: WEAPI_ENC_SEC_KEY };
}

function eapi(apiPath, jsonText) {
  if (typeof window !== 'undefined' && window.AndroidBridge && typeof window.AndroidBridge.eapi === 'function') {
    try {
      const res = JSON.parse(window.AndroidBridge.eapi(apiPath, jsonText));
      return { params: res.params };
    } catch (_) {}
  }

  if (nodeCrypto) {
    const md5hex = (s) => nodeCrypto.createHash('md5').update(s, 'utf8').digest('hex');
    const aesEncrypt = (data, key) => {
      const cipher = nodeCrypto.createCipheriv('aes-128-ecb', Buffer.from(key, 'utf8'), null);
      return Buffer.concat([cipher.update(Buffer.from(data, 'utf8')), cipher.final()]);
    };
    const message = `nobody${apiPath}use${jsonText}md5forencrypt`;
    const digest = md5hex(message);
    const data = `${apiPath}-36cd479b6b5-${jsonText}-36cd479b6b5-${digest}`;
    const encrypted = aesEncrypt(data, EAPI_KEY);
    return { params: encrypted.toString('hex').toUpperCase() };
  }

  return { params: '' };
}

const NeteaseCrypto = { weapi, eapi };

if (typeof module !== 'undefined' && module.exports) {
  module.exports = NeteaseCrypto;
}
if (typeof window !== 'undefined') {
  window.NeteaseCrypto = NeteaseCrypto;
}
