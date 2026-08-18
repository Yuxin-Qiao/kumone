// NetEase Cloud Music request encryption (weapi / eapi) for Web & PWA.
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

  let nodeCrypto = null;
  try {
    if (typeof require === 'function') {
      nodeCrypto = require('crypto');
    }
  } catch (_) {}

  // Pure JavaScript AES-128 implementation (CBC & ECB with PKCS#7)
  const S_BOX = [
    0x63, 0x7c, 0x77, 0x7b, 0xf2, 0x6b, 0x6f, 0xc5, 0x30, 0x01, 0x67, 0x2b, 0xfe, 0xd7, 0xab, 0x76,
    0xca, 0x82, 0xc9, 0x7d, 0xfa, 0x59, 0x47, 0xf0, 0xad, 0xd4, 0xa2, 0xaf, 0x9c, 0xa4, 0x72, 0xc0,
    0xb7, 0xfd, 0x93, 0x26, 0x36, 0x3f, 0xf7, 0xcc, 0x34, 0xa5, 0xe5, 0xf1, 0x71, 0xd8, 0x31, 0x15,
    0x04, 0xc7, 0x23, 0xc3, 0x18, 0x96, 0x05, 0x9a, 0x07, 0x12, 0x80, 0xe2, 0xeb, 0x27, 0xb2, 0x75,
    0x09, 0x83, 0x2c, 0x1a, 0x1b, 0x6e, 0x5a, 0xa0, 0x52, 0x3b, 0xd6, 0xb3, 0x29, 0xe3, 0x2f, 0x84,
    0x53, 0xd1, 0x00, 0xed, 0x20, 0xfc, 0xb1, 0x5b, 0x6a, 0xcb, 0xbe, 0x39, 0x4a, 0x4c, 0x58, 0xcf,
    0xd0, 0xef, 0xaa, 0xfb, 0x43, 0x4d, 0x33, 0x85, 0x45, 0xf9, 0x02, 0x7f, 0x50, 0x3c, 0x9f, 0xa8,
    0x51, 0xa3, 0x40, 0x8f, 0x92, 0x9d, 0x38, 0xf5, 0xbc, 0xb6, 0xda, 0x21, 0x10, 0xff, 0xf3, 0xd2,
    0xcd, 0x0c, 0x13, 0xec, 0x5f, 0x97, 0x44, 0x17, 0xc4, 0xa7, 0x7e, 0x3d, 0x64, 0x5d, 0x19, 0x73,
    0x60, 0x81, 0x4f, 0xdc, 0x22, 0x2a, 0x90, 0x88, 0x46, 0xee, 0xb8, 0x14, 0xde, 0x5e, 0x0b, 0xdb,
    0xe0, 0x32, 0x3a, 0x0a, 0x49, 0x06, 0x24, 0x5e, 0xc2, 0xd3, 0xac, 0x62, 0x91, 0x95, 0xe4, 0x79,
    0xe7, 0xc8, 0x37, 0x6d, 0x8d, 0xd5, 0x4e, 0xa9, 0x6c, 0x56, 0xf4, 0xea, 0x65, 0x7a, 0xae, 0x08,
    0xba, 0x78, 0x25, 0x2e, 0x1c, 0xa6, 0xb4, 0xc6, 0xe8, 0xdd, 0x74, 0x1f, 0x4b, 0xbd, 0x8b, 0x8a,
    0x70, 0x3e, 0xb5, 0x66, 0x48, 0x03, 0xf6, 0x0e, 0x61, 0x35, 0x57, 0xb9, 0x86, 0xc1, 0x1d, 0x9e,
    0xe1, 0xf8, 0x98, 0x11, 0x69, 0xd9, 0x8e, 0x94, 0x9b, 0x1e, 0x87, 0xe9, 0xce, 0x55, 0x28, 0xdf,
    0x8c, 0xa1, 0x89, 0x0d, 0xbf, 0xe6, 0x42, 0x68, 0x41, 0x99, 0x2d, 0x0f, 0xb0, 0x54, 0xbb, 0x16
  ];
  const RCON = [0x00, 0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80, 0x1b, 0x36];

  function keyExpansion(keyBytes) {
    const w = new Uint32Array(44);
    for (let i = 0; i < 4; i++) {
      w[i] = (keyBytes[4 * i] << 24) | (keyBytes[4 * i + 1] << 16) | (keyBytes[4 * i + 2] << 8) | keyBytes[4 * i + 3];
    }
    for (let i = 4; i < 44; i++) {
      let temp = w[i - 1];
      if (i % 4 === 0) {
        temp = (temp << 8) | (temp >>> 24);
        temp = (S_BOX[(temp >>> 24) & 0xff] << 24) |
               (S_BOX[(temp >>> 16) & 0xff] << 16) |
               (S_BOX[(temp >>> 8) & 0xff] << 8) |
               S_BOX[temp & 0xff];
        temp ^= (RCON[i / 4] << 24);
      }
      w[i] = (w[i - 4] ^ temp) >>> 0;
    }
    return w;
  }

  function xtime(a) {
    return ((a << 1) ^ (((a >>> 7) & 1) * 0x11b)) & 0xff;
  }

  function encryptBlock(state, w) {
    const s = new Uint8Array(state);
    // AddRoundKey 0
    for (let i = 0; i < 4; i++) {
      const k = w[i];
      s[4 * i] ^= (k >>> 24) & 0xff;
      s[4 * i + 1] ^= (k >>> 16) & 0xff;
      s[4 * i + 2] ^= (k >>> 8) & 0xff;
      s[4 * i + 3] ^= k & 0xff;
    }
    // 9 Rounds
    for (let round = 1; round < 10; round++) {
      // SubBytes & ShiftRows
      const s0 = S_BOX[s[0]], s4 = S_BOX[s[4]], s8 = S_BOX[s[8]], s12 = S_BOX[s[12]];
      const s1 = S_BOX[s[5]], s5 = S_BOX[s[9]], s9 = S_BOX[s[13]], s13 = S_BOX[s[1]];
      const s2 = S_BOX[s[10]], s6 = S_BOX[s[14]], s10 = S_BOX[s[2]], s14 = S_BOX[s[6]];
      const s3 = S_BOX[s[15]], s7 = S_BOX[s[3]], s11 = S_BOX[s[7]], s15 = S_BOX[s[11]];
      // MixColumns
      const c = [
        [s0, s1, s2, s3],
        [s4, s5, s6, s7],
        [s8, s9, s10, s11],
        [s12, s13, s14, s15]
      ];
      for (let i = 0; i < 4; i++) {
        const a0 = c[i][0], a1 = c[i][1], a2 = c[i][2], a3 = c[i][3];
        const t = a0 ^ a1 ^ a2 ^ a3;
        s[4 * i] = a0 ^ t ^ xtime(a0 ^ a1);
        s[4 * i + 1] = a1 ^ t ^ xtime(a1 ^ a2);
        s[4 * i + 2] = a2 ^ t ^ xtime(a2 ^ a3);
        s[4 * i + 3] = a3 ^ t ^ xtime(a3 ^ a0);
      }
      // AddRoundKey
      for (let i = 0; i < 4; i++) {
        const k = w[round * 4 + i];
        s[4 * i] ^= (k >>> 24) & 0xff;
        s[4 * i + 1] ^= (k >>> 16) & 0xff;
        s[4 * i + 2] ^= (k >>> 8) & 0xff;
        s[4 * i + 3] ^= k & 0xff;
      }
    }
    // Round 10: SubBytes, ShiftRows, AddRoundKey (No MixColumns)
    const out0 = S_BOX[s[0]], out4 = S_BOX[s[4]], out8 = S_BOX[s[8]], out12 = S_BOX[s[12]];
    const out1 = S_BOX[s[5]], out5 = S_BOX[s[9]], out9 = S_BOX[s[13]], out13 = S_BOX[s[1]];
    const out2 = S_BOX[s[10]], out6 = S_BOX[s[14]], out10 = S_BOX[s[2]], out14 = S_BOX[s[6]];
    const out3 = S_BOX[s[15]], out7 = S_BOX[s[3]], out11 = S_BOX[s[7]], out15 = S_BOX[s[11]];
    const res = [
      out0, out1, out2, out3,
      out4, out5, out6, out7,
      out8, out9, out10, out11,
      out12, out13, out14, out15
    ];
    for (let i = 0; i < 4; i++) {
      const k = w[40 + i];
      res[4 * i] ^= (k >>> 24) & 0xff;
      res[4 * i + 1] ^= (k >>> 16) & 0xff;
      res[4 * i + 2] ^= (k >>> 8) & 0xff;
      res[4 * i + 3] ^= k & 0xff;
    }
    return new Uint8Array(res);
  }

  function strToUtf8Bytes(str) {
    if (typeof TextEncoder !== 'undefined') {
      return new TextEncoder().encode(str);
    }
    const utf8 = unescape(encodeURIComponent(str));
    const arr = new Uint8Array(utf8.length);
    for (let i = 0; i < utf8.length; i++) arr[i] = utf8.charCodeAt(i);
    return arr;
  }

  function bytesToBase64(bytes) {
    if (typeof Buffer !== 'undefined') {
      return Buffer.from(bytes).toString('base64');
    }
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  }

  function bytesToHex(bytes) {
    let hex = '';
    for (let i = 0; i < bytes.length; i++) {
      hex += bytes[i].toString(16).padStart(2, '0');
    }
    return hex;
  }

  function aesEncryptJs(dataStr, keyStr, ivStr) {
    const dataBytes = strToUtf8Bytes(dataStr);
    const keyBytes = strToUtf8Bytes(keyStr);
    const ivBytes = ivStr ? strToUtf8Bytes(ivStr) : null;

    // PKCS#7 padding
    const padLen = 16 - (dataBytes.length % 16);
    const padded = new Uint8Array(dataBytes.length + padLen);
    padded.set(dataBytes);
    padded.fill(padLen, dataBytes.length);

    const w = keyExpansion(keyBytes);
    const blocksCount = padded.length / 16;
    const output = new Uint8Array(padded.length);
    let prevBlock = ivBytes ? new Uint8Array(ivBytes) : null;

    for (let b = 0; b < blocksCount; b++) {
      const block = padded.slice(b * 16, b * 16 + 16);
      if (prevBlock) {
        for (let i = 0; i < 16; i++) block[i] ^= prevBlock[i];
      }
      const encrypted = encryptBlock(block, w);
      output.set(encrypted, b * 16);
      if (prevBlock) prevBlock = encrypted;
    }
    return output;
  }

  function weapi(jsonText) {
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

    const firstBytes = aesEncryptJs(jsonText, WEAPI_PRESET_KEY, WEAPI_IV);
    const firstBase64 = bytesToBase64(firstBytes);
    const secondBytes = aesEncryptJs(firstBase64, WEAPI_SECRET_KEY, WEAPI_IV);
    return { params: bytesToBase64(secondBytes), encSecKey: WEAPI_ENC_SEC_KEY };
  }

  function eapi(apiPath, jsonText) {
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

    const message = `nobody${apiPath}use${jsonText}md5forencrypt`;
    const digest = md5(message);
    const data = `${apiPath}-36cd479b6b5-${jsonText}-36cd479b6b5-${digest}`;
    const encryptedBytes = aesEncryptJs(data, EAPI_KEY, null);
    return { params: bytesToHex(encryptedBytes).toUpperCase() };
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

  return { weapi, eapi, md5 };
});
