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

  // Pure JavaScript AES-128 implementation (FIPS-197 compliant)
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
    0xe0, 0x32, 0x3a, 0x0a, 0x49, 0x06, 0x24, 0x5c, 0xc2, 0xd3, 0xac, 0x62, 0x91, 0x95, 0xe4, 0x79,
    0xe7, 0xc8, 0x37, 0x6d, 0x8d, 0xd5, 0x4e, 0xa9, 0x6c, 0x56, 0xf4, 0xea, 0x65, 0x7a, 0xae, 0x08,
    0xba, 0x78, 0x25, 0x2e, 0x1c, 0xa6, 0xb4, 0xc6, 0xe8, 0xdd, 0x74, 0x1f, 0x4b, 0xbd, 0x8b, 0x8a,
    0x70, 0x3e, 0xb5, 0x66, 0x48, 0x03, 0xf6, 0x0e, 0x61, 0x35, 0x57, 0xb9, 0x86, 0xc1, 0x1d, 0x9e,
    0xe1, 0xf8, 0x98, 0x11, 0x69, 0xd9, 0x8e, 0x94, 0x9b, 0x1e, 0x87, 0xe9, 0xce, 0x55, 0x28, 0xdf,
    0x8c, 0xa1, 0x89, 0x0d, 0xbf, 0xe6, 0x42, 0x68, 0x41, 0x99, 0x2d, 0x0f, 0xb0, 0x54, 0xbb, 0x16
  ];
  const RCON = [0x00, 0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80, 0x1b, 0x36];

  function keyExpansion(key) {
    const w = new Uint8Array(176);
    for (let i = 0; i < 16; i++) w[i] = key[i];
    for (let i = 4; i < 44; i++) {
      let t0 = w[(i - 1) * 4];
      let t1 = w[(i - 1) * 4 + 1];
      let t2 = w[(i - 1) * 4 + 2];
      let t3 = w[(i - 1) * 4 + 3];

      if (i % 4 === 0) {
        const tmp = t0;
        t0 = S_BOX[t1] ^ RCON[i / 4];
        t1 = S_BOX[t2];
        t2 = S_BOX[t3];
        t3 = S_BOX[tmp];
      }
      w[i * 4] = w[(i - 4) * 4] ^ t0;
      w[i * 4 + 1] = w[(i - 4) * 4 + 1] ^ t1;
      w[i * 4 + 2] = w[(i - 4) * 4 + 2] ^ t2;
      w[i * 4 + 3] = w[(i - 4) * 4 + 3] ^ t3;
    }
    return w;
  }

  function xtime(a) {
    return ((a << 1) ^ (((a >>> 7) & 1) * 0x1b)) & 0xff;
  }

  function cipherBlock(input, w) {
    let s0 = input[0] ^ w[0], s4 = input[4] ^ w[4], s8 = input[8] ^ w[8], s12 = input[12] ^ w[12];
    let s1 = input[1] ^ w[1], s5 = input[5] ^ w[5], s9 = input[9] ^ w[9], s13 = input[13] ^ w[13];
    let s2 = input[2] ^ w[2], s6 = input[6] ^ w[6], s10 = input[10] ^ w[10], s14 = input[14] ^ w[14];
    let s3 = input[3] ^ w[3], s7 = input[7] ^ w[7], s11 = input[11] ^ w[11], s15 = input[15] ^ w[15];

    for (let r = 1; r < 10; r++) {
      const t0 = S_BOX[s0], t4 = S_BOX[s4], t8 = S_BOX[s8], t12 = S_BOX[s12];
      const t1 = S_BOX[s5], t5 = S_BOX[s9], t9 = S_BOX[s13], t13 = S_BOX[s1];
      const t2 = S_BOX[s10], t6 = S_BOX[s14], t10 = S_BOX[s2], t14 = S_BOX[s6];
      const t3 = S_BOX[s15], t7 = S_BOX[s3], t11 = S_BOX[s7], t15 = S_BOX[s11];

      let a = t0 ^ t1 ^ t2 ^ t3;
      s0 = t0 ^ a ^ xtime(t0 ^ t1) ^ w[r * 16];
      s1 = t1 ^ a ^ xtime(t1 ^ t2) ^ w[r * 16 + 1];
      s2 = t2 ^ a ^ xtime(t2 ^ t3) ^ w[r * 16 + 2];
      s3 = t3 ^ a ^ xtime(t3 ^ t0) ^ w[r * 16 + 3];

      a = t4 ^ t5 ^ t6 ^ t7;
      s4 = t4 ^ a ^ xtime(t4 ^ t5) ^ w[r * 16 + 4];
      s5 = t5 ^ a ^ xtime(t5 ^ t6) ^ w[r * 16 + 5];
      s6 = t6 ^ a ^ xtime(t6 ^ t7) ^ w[r * 16 + 6];
      s7 = t7 ^ a ^ xtime(t7 ^ t4) ^ w[r * 16 + 7];

      a = t8 ^ t9 ^ t10 ^ t11;
      s8 = t8 ^ a ^ xtime(t8 ^ t9) ^ w[r * 16 + 8];
      s9 = t9 ^ a ^ xtime(t9 ^ t10) ^ w[r * 16 + 9];
      s10 = t10 ^ a ^ xtime(t10 ^ t11) ^ w[r * 16 + 10];
      s11 = t11 ^ a ^ xtime(t11 ^ t8) ^ w[r * 16 + 11];

      a = t12 ^ t13 ^ t14 ^ t15;
      s12 = t12 ^ a ^ xtime(t12 ^ t13) ^ w[r * 16 + 12];
      s13 = t13 ^ a ^ xtime(t13 ^ t14) ^ w[r * 16 + 13];
      s14 = t14 ^ a ^ xtime(t14 ^ t15) ^ w[r * 16 + 14];
      s15 = t15 ^ a ^ xtime(t15 ^ t12) ^ w[r * 16 + 15];
    }

    const out = new Uint8Array(16);
    out[0] = S_BOX[s0] ^ w[160];
    out[1] = S_BOX[s5] ^ w[161];
    out[2] = S_BOX[s10] ^ w[162];
    out[3] = S_BOX[s15] ^ w[163];

    out[4] = S_BOX[s4] ^ w[164];
    out[5] = S_BOX[s9] ^ w[165];
    out[6] = S_BOX[s14] ^ w[166];
    out[7] = S_BOX[s3] ^ w[167];

    out[8] = S_BOX[s8] ^ w[168];
    out[9] = S_BOX[s13] ^ w[169];
    out[10] = S_BOX[s2] ^ w[170];
    out[11] = S_BOX[s7] ^ w[171];

    out[12] = S_BOX[s12] ^ w[172];
    out[13] = S_BOX[s1] ^ w[173];
    out[14] = S_BOX[s6] ^ w[174];
    out[15] = S_BOX[s11] ^ w[175];

    return out;
  }

  function strToUtf8(str) {
    if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(str);
    const utf8 = unescape(encodeURIComponent(str));
    const res = new Uint8Array(utf8.length);
    for (let i = 0; i < utf8.length; i++) res[i] = utf8.charCodeAt(i);
    return res;
  }

  function bytesToBase64(bytes) {
    if (typeof Buffer !== 'undefined') return Buffer.from(bytes).toString('base64');
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

  function aesCbcEncryptJs(dataStr, keyStr, ivStr) {
    const dataBytes = strToUtf8(dataStr);
    const keyBytes = strToUtf8(keyStr);
    const ivBytes = strToUtf8(ivStr);

    const padLen = 16 - (dataBytes.length % 16);
    const padded = new Uint8Array(dataBytes.length + padLen);
    padded.set(dataBytes);
    padded.fill(padLen, dataBytes.length);

    const w = keyExpansion(keyBytes);
    const output = new Uint8Array(padded.length);
    let prev = new Uint8Array(ivBytes);

    for (let i = 0; i < padded.length; i += 16) {
      const block = padded.slice(i, i + 16);
      for (let k = 0; k < 16; k++) block[k] ^= prev[k];
      const enc = cipherBlock(block, w);
      output.set(enc, i);
      prev = enc;
    }
    return output;
  }

  function aesEcbEncryptJs(dataStr, keyStr) {
    const dataBytes = strToUtf8(dataStr);
    const keyBytes = strToUtf8(keyStr);

    const padLen = 16 - (dataBytes.length % 16);
    const padded = new Uint8Array(dataBytes.length + padLen);
    padded.set(dataBytes);
    padded.fill(padLen, dataBytes.length);

    const w = keyExpansion(keyBytes);
    const output = new Uint8Array(padded.length);

    for (let i = 0; i < padded.length; i += 16) {
      const block = padded.slice(i, i + 16);
      const enc = cipherBlock(block, w);
      output.set(enc, i);
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

    const firstBytes = aesCbcEncryptJs(jsonText, WEAPI_PRESET_KEY, WEAPI_IV);
    const firstBase64 = bytesToBase64(firstBytes);
    const secondBytes = aesCbcEncryptJs(firstBase64, WEAPI_SECRET_KEY, WEAPI_IV);
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
    const encryptedBytes = aesEcbEncryptJs(data, EAPI_KEY);
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
