// Native reimplementation of UnblockNeteaseMusic's core providers.
// Port of Sources/Kumone/Core/Player/UnblockService.swift.
// Provider order: 1. pyncmd (GD Studio API) 2. kuwo 3. kugou.
'use strict';
const crypto = require('crypto');
const { USER_AGENT } = require('./client');

async function get(urlString, userAgent = 'Mozilla/5.0') {
  try {
    const res = await fetch(urlString, {
      headers: { 'User-Agent': userAgent },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    return await res.text();
  } catch (_) { return null; }
}

const getJSON = async (url) => {
  const text = await get(url);
  if (!text) return null;
  try { return JSON.parse(text); } catch (_) { return null; }
};

function keyword(track) {
  return `${track.name} ${track.artists[0] ? track.artists[0].name : ''}`.trim();
}

/// UNM's `select`: first of the top 5 within ±5 s of the target duration, else the first.
function selectMatch(list, durationMS) {
  const match = list.slice(0, 5).find((s) => s.durationMS > 0 && Math.abs(s.durationMS - durationMS) < 5000);
  return match || list[0];
}

// MARK: - pyncmd
async function pyncmd(track) {
  const obj = await getJSON(`https://music-api.gdstudio.xyz/api.php?types=url&source=netease&id=${track.id}&br=320`);
  if (!obj || !(obj.br > 0) || typeof obj.url !== 'string') return null;
  return obj.url.replace(/^http:/, 'https:');
}

// MARK: - kuwo
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
  const match = selectMatch(songs, track.durationMS);
  if (!match) return null;

  const convertURL = `http://antiserver.kuwo.cn/anti.s?type=convert_url&format=mp3&response=url&rid=MUSIC_${match.rid}`;
  const text = await get(convertURL, 'okhttp/3.10.0');
  if (!text) return null;
  const m = text.match(/http[^\s$"]+/);
  return m ? m[0] : null;
}

// MARK: - kugou
async function kugou(track) {
  const query = encodeURIComponent(keyword(track));
  const searchURL = `http://mobilecdn.kugou.com/api/v3/search/song?format=json&keyword=${query}&page=1&pagesize=10`;
  const obj = await getJSON(searchURL);
  const info = obj && obj.data && obj.data.info;
  if (!Array.isArray(info) || !info.length) return null;

  const songs = info.map((item) => ({
    hash: item.hash,
    albumID: String(item.album_id || 0),
    durationMS: (item.duration || 0) * 1000,
  })).filter((s) => typeof s.hash === 'string');
  const match = selectMatch(songs, track.durationMS);
  if (!match) return null;

  const key = crypto.createHash('md5')
    .update(`${match.hash}kgcloudv2`, 'utf8').digest('hex');
  const trackURL = `http://trackercdn.kugou.com/i/v2/?key=${key}&hash=${match.hash}`
    + `&appid=1005&pid=2&cmd=25&behavior=play&album_id=${match.albumID}`;
  const obj2 = await getJSON(trackURL);
  const urls = obj2 && obj2.url;
  return Array.isArray(urls) && urls.length ? urls[0] : null;
}

async function resolve(track) {
  // `track` is the renderer-normalized track: { id, name, artists: [{name}], durationMS }
  if (typeof track.id !== 'number' || !track.name) return null;
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

module.exports = { resolve };
