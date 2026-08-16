// NetEase Cloud Music request encryption (weapi / eapi).
// Port of Sources/Kumone/Core/API/NeteaseCrypto.swift — algorithm must match exactly.
'use strict';
const crypto = require('crypto');

const WEAPI_PRESET_KEY = '0CoJUm6Qyw8W8jud';
const WEAPI_IV = '0102030405060708';
// The secret key is chosen by us, so its RSA ciphertext ships precomputed.
const WEAPI_SECRET_KEY = 'kumone2026abcDEF';
const WEAPI_ENC_SEC_KEY =
  '38cef2efdbcc1cfd6a44d81620dae5d23091f50ef27e01a1b1bb7e998e0fde2d' +
  '7ab6002a9e79a3c195f661cbde80e21e6245997b11b54d28407115822f95d447' +
  '7cc06b5a77de46fab6568410abf1229abef81b4c8588f386149010d190bb0b04' +
  'f064be330bd877a4d4b99514febbdb4335b10744b13d9f7ee24d314d6e62cdc9';
const EAPI_KEY = 'e82ckenh8dichen8';

const md5hex = (s) => crypto.createHash('md5').update(s, 'utf8').digest('hex');

const aesEncrypt = (data, key, iv) => {
  const cipher = crypto.createCipheriv(
    `aes-128-${iv ? 'cbc' : 'ecb'}`,
    Buffer.from(key, 'utf8'),
    iv ? Buffer.from(iv, 'utf8') : null
  );
  return Buffer.concat([cipher.update(Buffer.from(data, 'utf8')), cipher.final()]);
};

/// weapi: two rounds of AES-128-CBC over the JSON payload (PKCS7 default),
/// first with the preset key, then with the client-chosen secret key.
function weapi(jsonText) {
  const first = aesEncrypt(jsonText, WEAPI_PRESET_KEY, WEAPI_IV).toString('base64');
  const second = aesEncrypt(first, WEAPI_SECRET_KEY, WEAPI_IV).toString('base64');
  return { params: second, encSecKey: WEAPI_ENC_SEC_KEY };
}

/// eapi: AES-128-ECB over "path + payload + md5 digest", uppercase hex output.
function eapi(apiPath, jsonText) {
  const text = jsonText;
  const message = `nobody${apiPath}use${text}md5forencrypt`;
  const digest = md5hex(message);
  const data = `${apiPath}-36cd479b6b5-${text}-36cd479b6b5-${digest}`;
  const encrypted = aesEncrypt(data, EAPI_KEY, null);
  return { params: encrypted.toString('hex').toUpperCase() };
}

module.exports = { weapi, eapi };
