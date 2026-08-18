// NetEase Cloud Music request encryption (weapi / eapi) for Android & Web.
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    const exported = factory();
    if (typeof window !== 'undefined') window.NeteaseCrypto = exported;
    if (typeof globalThis !== 'undefined') globalThis.NeteaseCrypto = exported;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
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

  const SBOX = Uint8Array.from(`
    63 7c 77 7b f2 6b 6f c5 30 01 67 2b fe d7 ab 76
    ca 82 c9 7d fa 59 47 f0 ad d4 a2 af 9c a4 72 c0
    b7 fd 93 26 36 3f f7 cc 34 a5 e5 f1 71 d8 31 15
    04 c7 23 c3 18 96 05 9a 07 12 80 e2 eb 27 b2 75
    09 83 2c 1a 1b 6e 5a a0 52 3b d6 b3 29 e3 2f 84
    53 d1 00 ed 20 fc b1 5b 6a cb be 39 4a 4c 58 cf
    d0 ef aa fb 43 4d 33 85 45 f9 02 7f 50 3c 9f a8
    51 a3 40 8f 92 9d 38 f5 bc b6 da 21 10 ff f3 d2
    cd 0c 13 ec 5f 97 44 17 c4 a7 7e 3d 64 5d 19 73
    60 81 4f dc 22 2a 90 88 46 ee b8 14 de 5e 0b db
    e0 32 3a 0a 49 06 24 5c c2 d3 ac 62 91 95 e4 79
    e7 c8 37 6d 8d d5 4e a9 6c 56 f4 ea 65 7a ae 08
    ba 78 25 2e 1c a6 b4 c6 e8 dd 74 1f 4b bd 8b 8a
    70 3e b5 66 48 03 f6 0e 61 35 57 b9 86 c1 1d 9e
    e1 f8 98 11 69 d9 8e 94 9b 1e 87 e9 ce 55 28 df
    8c a1 89 0d bf e6 42 68 41 99 2d 0f b0 54 bb 16
  `.trim().split(/\s+/).map((x) => parseInt(x, 16)));
  const RCON = Uint8Array.from([0x00, 0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80, 0x1b, 0x36]);

  function xtime(a) {
    return ((a << 1) ^ ((a & 0x80) ? 0x1b : 0)) & 0xff;
  }

  function utf8Bytes(str) {
    if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(str);
    const encoded = unescape(encodeURIComponent(str));
    const out = new Uint8Array(encoded.length);
    for (let i = 0; i < encoded.length; i++) out[i] = encoded.charCodeAt(i);
    return out;
  }

  function bytesToBase64(bytes) {
    if (typeof Buffer !== 'undefined') return Buffer.from(bytes).toString('base64');
    let bin = '';
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  }

  function bytesToHex(bytes) {
    let hex = '';
    for (let i = 0; i < bytes.length; i++) hex += bytes[i].toString(16).padStart(2, '0');
    return hex.toUpperCase();
  }

  function keyExpansion(key) {
    const w = new Uint8Array(176);
    w.set(key);
    for (let i = 4; i < 44; i++) {
      let t0 = w[(i - 1) * 4];
      let t1 = w[(i - 1) * 4 + 1];
      let t2 = w[(i - 1) * 4 + 2];
      let t3 = w[(i - 1) * 4 + 3];
      if (i % 4 === 0) {
        const r0 = t0;
        t0 = SBOX[t1] ^ RCON[i / 4];
        t1 = SBOX[t2];
        t2 = SBOX[t3];
        t3 = SBOX[r0];
      }
      w[i * 4] = w[(i - 4) * 4] ^ t0;
      w[i * 4 + 1] = w[(i - 4) * 4 + 1] ^ t1;
      w[i * 4 + 2] = w[(i - 4) * 4 + 2] ^ t2;
      w[i * 4 + 3] = w[(i - 4) * 4 + 3] ^ t3;
    }
    return w;
  }

  function encryptBlock(input, w) {
    const state = new Uint8Array(input);
    const addRoundKey = (round) => {
      const off = round * 16;
      for (let i = 0; i < 16; i++) state[i] ^= w[off + i];
    };
    addRoundKey(0);
    for (let round = 1; round < 10; round++) {
      for (let i = 0; i < 16; i++) state[i] = SBOX[state[i]];
      let t = state[1];
      state[1] = state[5]; state[5] = state[9]; state[9] = state[13]; state[13] = t;
      t = state[2]; const t2 = state[6];
      state[2] = state[10]; state[6] = state[14]; state[10] = t; state[14] = t2;
      t = state[15];
      state[15] = state[11]; state[11] = state[7]; state[7] = state[3]; state[3] = t;
      for (let c = 0; c < 4; c++) {
        const i = c * 4;
        const a = state[i], b = state[i + 1], cc = state[i + 2], d = state[i + 3];
        state[i] = xtime(a) ^ xtime(b) ^ b ^ cc ^ d;
        state[i + 1] = a ^ xtime(b) ^ xtime(cc) ^ cc ^ d;
        state[i + 2] = a ^ b ^ xtime(cc) ^ xtime(d) ^ d;
        state[i + 3] = xtime(a) ^ a ^ b ^ cc ^ xtime(d);
      }
      addRoundKey(round);
    }
    for (let i = 0; i < 16; i++) state[i] = SBOX[state[i]];
    let tf = state[1];
    state[1] = state[5]; state[5] = state[9]; state[9] = state[13]; state[13] = tf;
    tf = state[2]; const t2f = state[6];
    state[2] = state[10]; state[6] = state[14]; state[10] = tf; state[14] = t2f;
    tf = state[15];
    state[15] = state[11]; state[11] = state[7]; state[7] = state[3]; state[3] = tf;
    addRoundKey(10);
    return state;
  }

  function aes128Encrypt(plain, keyStr, ivStr) {
    const w = keyExpansion(utf8Bytes(keyStr));
    const raw = typeof plain === 'string' ? utf8Bytes(plain) : plain;
    const pad = 16 - (raw.length % 16);
    const padded = new Uint8Array(raw.length + pad);
    padded.set(raw);
    padded.fill(pad, raw.length);
    const out = new Uint8Array(padded.length);
    let prev = ivStr ? utf8Bytes(ivStr) : null;
    for (let i = 0; i < padded.length; i += 16) {
      const block = padded.slice(i, i + 16);
      if (prev) {
        for (let j = 0; j < 16; j++) block[j] ^= prev[j];
      }
      const enc = encryptBlock(block, w);
      out.set(enc, i);
      if (prev) prev = enc;
    }
    return out;
  }

  function weapiJs(jsonText) {
    const first = bytesToBase64(aes128Encrypt(jsonText, WEAPI_PRESET_KEY, WEAPI_IV));
    const second = bytesToBase64(aes128Encrypt(first, WEAPI_SECRET_KEY, WEAPI_IV));
    return { params: second, encSecKey: WEAPI_ENC_SEC_KEY };
  }

  function eapiJs(apiPath, jsonText) {
    const message = 'nobody' + apiPath + 'use' + jsonText + 'md5forencrypt';
    const digest = md5(message);
    const data = apiPath + '-36cd479b6b5-' + jsonText + '-36cd479b6b5-' + digest;
    return { params: bytesToHex(aes128Encrypt(data, EAPI_KEY, null)) };
  }

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

    return weapiJs(jsonText);
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

    return eapiJs(apiPath, jsonText);
  }

  function md5(string) {
    if (nodeCrypto) {
      return nodeCrypto.createHash('md5').update(String(string), 'utf8').digest('hex');
    }
    function rotateLeft(lValue, iShiftBits) {
      return (lValue << iShiftBits) | (lValue >>> (32 - iShiftBits));
    }
    function addUnsigned(lX, lY) {
      var lX4, lY4, lX8, lY8, lResult;
      lX8 = (lX & 0x80000000); lY8 = (lY & 0x80000000);
      lX4 = (lX & 0x40000000); lY4 = (lY & 0x40000000);
      lResult = (lX & 0x3FFFFFFF) + (lY & 0x3FFFFFFF);
      if (lX4 & lY4) return (lResult ^ 0x80000000 ^ lX8 ^ lY8);
      if (lX4 | lY4) {
        if (lResult & 0x40000000) return (lResult ^ 0xC0000000 ^ lX8 ^ lY8);
        else return (lResult ^ 0x40000000 ^ lX8 ^ lY8);
      } else return (lResult ^ lX8 ^ lY8);
    }
    function F(x, y, z) { return (x & y) | ((~x) & z); }
    function G(x, y, z) { return (x & z) | (y & (~z)); }
    function H(x, y, z) { return (x ^ y ^ z); }
    function I(x, y, z) { return (y ^ (x | (~z))); }
    function FF(a, b, c, d, x, s, ac) {
      a = addUnsigned(a, addUnsigned(addUnsigned(F(b, c, d), x), ac));
      return addUnsigned(rotateLeft(a, s), b);
    }
    function GG(a, b, c, d, x, s, ac) {
      a = addUnsigned(a, addUnsigned(addUnsigned(G(b, c, d), x), ac));
      return addUnsigned(rotateLeft(a, s), b);
    }
    function HH(a, b, c, d, x, s, ac) {
      a = addUnsigned(a, addUnsigned(addUnsigned(H(b, c, d), x), ac));
      return addUnsigned(rotateLeft(a, s), b);
    }
    function II(a, b, c, d, x, s, ac) {
      a = addUnsigned(a, addUnsigned(addUnsigned(I(b, c, d), x), ac));
      return addUnsigned(rotateLeft(a, s), b);
    }
    function convertToWordArray(string) {
      var lWordCount;
      var lMessageLength = string.length;
      var lNumberOfWordsTempOne = lMessageLength + 8;
      var lNumberOfWordsTempTwo = (lNumberOfWordsTempOne - (lNumberOfWordsTempOne % 64)) / 64;
      var lNumberOfWords = (lNumberOfWordsTempTwo + 1) * 16;
      var lWordArray = Array(lNumberOfWords - 1);
      var lBytePosition = 0;
      var lByteCount = 0;
      while (lByteCount < lMessageLength) {
        lWordCount = (lByteCount - (lByteCount % 4)) / 4;
        lBytePosition = (lByteCount % 4) * 8;
        lWordArray[lWordCount] = (lWordArray[lWordCount] | (string.charCodeAt(lByteCount) << lBytePosition));
        lByteCount++;
      }
      lWordCount = (lByteCount - (lByteCount % 4)) / 4;
      lBytePosition = (lByteCount % 4) * 8;
      lWordArray[lWordCount] = lWordArray[lWordCount] | (0x80 << lBytePosition);
      lWordArray[lNumberOfWords - 2] = lMessageLength << 3;
      lWordArray[lNumberOfWords - 1] = lMessageLength >>> 29;
      return lWordArray;
    }
    function wordToHex(lValue) {
      var WordToHexValue = '', WordToHexValueTemp = '', lByte, lCount;
      for (lCount = 0; lCount <= 3; lCount++) {
        lByte = (lValue >>> (lCount * 8)) & 255;
        WordToHexValueTemp = '0' + lByte.toString(16);
        WordToHexValue = WordToHexValue + WordToHexValueTemp.substr(WordToHexValueTemp.length - 2, 2);
      }
      return WordToHexValue;
    }
    function utf8Encode(string) {
      return unescape(encodeURIComponent(string));
    }
    var x = Array();
    var k, AA, BB, CC, DD, a, b, c, d;
    var S11 = 7, S12 = 12, S13 = 17, S14 = 22;
    var S21 = 5, S22 = 9, S23 = 14, S24 = 20;
    var S31 = 4, S32 = 11, S33 = 16, S34 = 23;
    var S41 = 6, S42 = 10, S43 = 15, S44 = 21;
    string = utf8Encode(string);
    x = convertToWordArray(string);
    a = 0x67452301; b = 0xEFCDAB89; c = 0x98BADCFE; d = 0x10325476;
    for (k = 0; k < x.length; k += 16) {
      AA = a; BB = b; CC = c; DD = d;
      a = FF(a, b, c, d, x[k + 0], S11, 0xD76AA478);
      d = FF(d, a, b, c, x[k + 1], S12, 0xE8C7B756);
      c = FF(c, d, a, b, x[k + 2], S13, 0x242070DB);
      b = FF(b, c, d, a, x[k + 3], S14, 0xC1BDCEEE);
      a = FF(a, b, c, d, x[k + 4], S11, 0xF57C0FAF);
      d = FF(d, a, b, c, x[k + 5], S12, 0x4787C62A);
      c = FF(c, d, a, b, x[k + 6], S13, 0xA8304613);
      b = FF(b, c, d, a, x[k + 7], S14, 0xFD469501);
      a = FF(a, b, c, d, x[k + 8], S11, 0x698098D8);
      d = FF(d, a, b, c, x[k + 9], S12, 0x8B44F7AF);
      c = FF(c, d, a, b, x[k + 10], S13, 0xFFFF5BB1);
      b = FF(b, c, d, a, x[k + 11], S14, 0x895CD7BE);
      a = FF(a, b, c, d, x[k + 12], S11, 0x6B901122);
      d = FF(d, a, b, c, x[k + 13], S12, 0xFD987193);
      c = FF(c, d, a, b, x[k + 14], S13, 0xA679438E);
      b = FF(b, c, d, a, x[k + 15], S14, 0x49B40821);
      a = GG(a, b, c, d, x[k + 1], S21, 0xF61E2562);
      d = GG(d, a, b, c, x[k + 6], S22, 0xC040B340);
      c = GG(c, d, a, b, x[k + 11], S23, 0x265E5A51);
      b = GG(b, c, d, a, x[k + 0], S24, 0xE9B6C7AA);
      a = GG(a, b, c, d, x[k + 5], S21, 0xD62F105D);
      d = GG(d, a, b, c, x[k + 10], S22, 0x2441453);
      c = GG(c, d, a, b, x[k + 15], S23, 0xD8A1E681);
      b = GG(b, c, d, a, x[k + 4], S24, 0xE7D3FBC8);
      a = GG(a, b, c, d, x[k + 9], S21, 0x21E1CDE6);
      d = GG(d, a, b, c, x[k + 14], S22, 0xC33707D6);
      c = GG(c, d, a, b, x[k + 3], S23, 0xF4D50D87);
      b = GG(b, c, d, a, x[k + 8], S24, 0x455A14ED);
      a = GG(a, b, c, d, x[k + 13], S21, 0xA9E3E905);
      d = GG(d, a, b, c, x[k + 2], S22, 0xFCEFA3F8);
      c = GG(c, d, a, b, x[k + 7], S23, 0x676F02D9);
      b = GG(b, c, d, a, x[k + 12], S24, 0x8D2A4C8A);
      a = HH(a, b, c, d, x[k + 5], S31, 0xFFFA3942);
      d = HH(d, a, b, c, x[k + 8], S32, 0x8771F681);
      c = HH(c, d, a, b, x[k + 11], S33, 0x6D9D6122);
      b = HH(b, c, d, a, x[k + 14], S34, 0xFDE5380C);
      a = HH(a, b, c, d, x[k + 1], S31, 0xA4BEEA44);
      d = HH(d, a, b, c, x[k + 4], S32, 0x4BDECFA9);
      c = HH(c, d, a, b, x[k + 7], S33, 0xF6BB4B60);
      b = HH(b, c, d, a, x[k + 10], S34, 0xBEBFBC70);
      a = HH(a, b, c, d, x[k + 13], S31, 0x289B7EC6);
      d = HH(d, a, b, c, x[k + 0], S32, 0xEAA127FA);
      c = HH(c, d, a, b, x[k + 3], S33, 0xD4EF3085);
      b = HH(b, c, d, a, x[k + 6], S34, 0x4881D05);
      a = HH(a, b, c, d, x[k + 9], S31, 0xD9D4D039);
      d = HH(d, a, b, c, x[k + 12], S32, 0xE6DB99E5);
      c = HH(c, d, a, b, x[k + 15], S33, 0x1FA27CF8);
      b = HH(b, c, d, a, x[k + 2], S34, 0xC4AC5665);
      a = II(a, b, c, d, x[k + 0], S41, 0xF4292244);
      d = II(d, a, b, c, x[k + 7], S42, 0x432AFF97);
      c = II(c, d, a, b, x[k + 14], S43, 0xAB9423A7);
      b = II(b, c, d, a, x[k + 5], S44, 0xFC93A039);
      a = II(a, b, c, d, x[k + 12], S41, 0x655B59C3);
      d = II(d, a, b, c, x[k + 3], S42, 0x8F0CCC92);
      c = II(c, d, a, b, x[k + 10], S43, 0xFFEFF47D);
      b = II(b, c, d, a, x[k + 1], S44, 0x85845DD1);
      a = II(a, b, c, d, x[k + 8], S41, 0x6FA87E4F);
      d = II(d, a, b, c, x[k + 15], S42, 0xFE2CE6E0);
      c = II(c, d, a, b, x[k + 6], S43, 0xA3014314);
      b = II(b, c, d, a, x[k + 13], S44, 0x4E0811A1);
      a = II(a, b, c, d, x[k + 4], S41, 0xF7537E82);
      d = II(d, a, b, c, x[k + 11], S42, 0xBD3AF235);
      c = II(c, d, a, b, x[k + 2], S43, 0x2AD7D2BB);
      b = II(b, c, d, a, x[k + 9], S44, 0xEB86D391);
      a = addUnsigned(a, AA); b = addUnsigned(b, BB);
      c = addUnsigned(c, CC); d = addUnsigned(d, DD);
    }
    return (wordToHex(a) + wordToHex(b) + wordToHex(c) + wordToHex(d)).toLowerCase();
  }

  return { weapi, eapi, md5, weapiJs, eapiJs };
});
