// Native reimplementation of UnblockNeteaseMusic's core providers for Web & PWA.
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    const exported = factory();
    if (typeof window !== 'undefined') window.Unblock = exported;
    if (typeof globalThis !== 'undefined') globalThis.Unblock = exported;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  async function get(urlString, userAgent = 'Mozilla/5.0') {
    try {
      let fetchUrl = urlString;
      if (typeof window !== 'undefined' && window.location && window.location.origin) {
        // Route through worker proxy to avoid mixed content & CORS issues
        fetchUrl = `${window.location.origin}/api/netease?target=${encodeURIComponent(urlString)}`;
      }
      const res = await fetch(fetchUrl, {
        headers: { 'User-Agent': userAgent },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) return null;
      return await res.text();
    } catch (_) { return null; }
  }

  const getJSON = async (url, userAgent) => {
    const text = await get(url, userAgent);
    if (!text) return null;
    try { return JSON.parse(text); } catch (_) { return null; }
  };

  function keyword(track) {
    const artistName = track.artists && track.artists[0] ? track.artists[0].name : (track.artist || '');
    return `${track.name} ${artistName}`.trim();
  }

  function selectMatch(list, durationMS) {
    const match = list.slice(0, 5).find((s) => s.durationMS > 0 && Math.abs(s.durationMS - durationMS) < 5000);
    return match || list[0];
  }

  // MARK: - Provider 1: pyncmd / GD Studio / Meting
  async function pyncmd(track) {
    try {
      const obj = await getJSON(`https://music-api.gdstudio.xyz/api.php?types=url&source=netease&id=${track.id}&br=320`);
      if (obj && obj.br > 0 && typeof obj.url === 'string' && obj.url.startsWith('http')) {
        return obj.url.replace(/^http:/, 'https:');
      }
    } catch (_) {}

    try {
      const metingObj = await getJSON(`https://api.injahow.cn/meting/?type=url&id=${track.id}`);
      if (metingObj && typeof metingObj.url === 'string' && metingObj.url.startsWith('http')) {
        return metingObj.url.replace(/^http:/, 'https:');
      }
    } catch (_) {}

    return null;
  }

  // MARK: - Provider 2: kuwo (High fidelity MP3 stream)
  async function kuwo(track) {
    const query = encodeURIComponent(keyword(track));
    const searchURL = 'http://search.kuwo.cn/r.s?&correct=1&vipver=1&stype=comprehensive&encoding=utf8'
      + `&rformat=json&mobi=1&show_copyright_off=1&searchapi=6&all=${query}`;
    const obj = await getJSON(searchURL);
    const content = obj && obj.content;
    if (!Array.isArray(content) || content.length < 2) return null;
    const abslist = content[1].musicpage && content[1].musicpage.abslist;
    if (!Array.isArray(abslist) || !abslist.length) return null;

    const songs = [];
    for (const item of abslist) {
      const musicrid = item['MUSICRID'];
      if (typeof musicrid !== 'string') continue;
      const rid = musicrid.split('_').pop();
      const duration = parseInt(item['DURATION'] || '0', 10) || 0;
      songs.push({ rid, durationMS: duration * 1000 });
    }
    const match = selectMatch(songs, track.durationMS || 0);
    if (!match) return null;

    const convertURL = `http://antiserver.kuwo.cn/anti.s?type=convert_url&format=mp3&response=url&rid=MUSIC_${match.rid}`;
    const text = await get(convertURL, 'okhttp/3.10.0');
    if (!text) return null;
    const m = text.match(/http[^\s$"]+/);
    return m ? m[0] : null;
  }

  // MARK: - Provider 3: kugou (MD5 signed CDN)
  function md5(string) {
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

  async function kugou(track) {
    const query = encodeURIComponent(keyword(track));
    const searchURL = `http://songsearch.kugou.com/song_search_v2?keyword=${query}&page=1&pagesize=10&filter=0&bitrate=0&isfp=0&format=json`;
    const obj = await getJSON(searchURL);
    const lists = obj && obj.data && obj.data.lists;
    if (!Array.isArray(lists) || !lists.length) return null;

    const songs = [];
    for (const item of lists) {
      const hash = item['FileHash'];
      const albumID = item['AlbumID'];
      const duration = item['Duration'] || 0;
      if (typeof hash !== 'string' || !hash.length) continue;
      songs.push({ hash, albumID: typeof albumID === 'string' ? albumID : '', durationMS: duration * 1000 });
    }
    const match = selectMatch(songs, track.durationMS || 0);
    if (!match) return null;

    const key = md5(`${match.hash}kgcloudv2`);
    const trackURL = `http://trackercdn.kugou.com/i/v2/?key=${key}&hash=${match.hash}`
      + `&appid=1005&pid=2&cmd=25&behavior=play&album_id=${match.albumID}`;
    const obj2 = await getJSON(trackURL);
    const urls = obj2 && obj2.url;
    return Array.isArray(urls) && urls.length ? urls[0] : null;
  }

  async function resolve(track) {
    if (!track || !track.id || !track.name) return null;
    try {
      const pyn = await pyncmd(track);
      if (pyn) return { url: pyn, source: 'pyncmd' };
    } catch (_) {}
    try {
      const kw = await kuwo(track);
      if (kw) return { url: kw, source: '酷我音乐' };
    } catch (_) {}
    try {
      const kg = await kugou(track);
      if (kg) return { url: kg, source: '酷狗音乐' };
    } catch (_) {}
    return null;
  }

  return { resolve, pyncmd, kuwo, kugou };
});
