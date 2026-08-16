// Typed NetEase Cloud Music API surface, port of NeteaseAPI.swift.
// All functions return plain decoded JSON objects.
'use strict';
const { client, decode } = require('./client');

const call = async (kind, path, payload) =>
  decode(await client[kind](path, payload));

const weapi = (path, payload) => call('weapi', path, payload);
const eapi = (path, payload) => call('eapi', path, payload);

const NeteaseAPI = {
  client,

  // MARK: - Auth
  async qrKey() {
    return (await weapi('/login/qrcode/unikey', { type: 1 })).unikey;
  },
  qrLoginURL(unikey) {
    return `https://music.163.com/login?codekey=${unikey}`;
  },
  /// Codes: 800 expired · 801 waiting · 802 scanned · 803 success.
  /// On 803 the auth cookies arrive via Set-Cookie / body cookie field.
  async qrCheck(unikey) {
    const raw = Buffer.from(await client.weapi('/login/qrcode/client/login', { key: unikey, type: 1 })).toString('utf8');
    const obj = JSON.parse(raw);
    if (obj && typeof obj.cookie === 'string' && obj.cookie.length) {
      client.ingestCookieString(obj.cookie);
    }
    return obj;
  },
  async logout() {
    try { await client.weapi('/logout'); } catch (_) {}
    client.clearAuthCookies();
  },
  async refreshLogin() {
    try { await client.weapi('/login/token/refresh'); } catch (_) {}
  },
  async userAccount() {
    return (await weapi('/w/nuser/account/get')).profile || null;
  },

  // MARK: - User library
  async userPlaylists(uid, limit = 2000, offset = 0) {
    return (await weapi('/user/playlist',
      { uid, limit, offset, includeVideo: true })).playlist;
  },
  async likedTrackIDs(uid) {
    return (await weapi('/song/like/get', { uid })).ids;
  },
  async likeTrack(id, like) {
    const resp = await weapi(`/radio/like?alg=itembased&trackId=${id}&time=3`,
      { trackId: id, like });
    if (resp.code !== 200) throw new Error('操作失败，专辑下架或版权锁定');
  },
  async likedAlbums(limit = 500, offset = 0) {
    return (await weapi('/album/sublist', { limit, offset, total: true })).data;
  },
  async likedArtists(limit = 500, offset = 0) {
    return (await weapi('/artist/sublist', { limit, offset, total: true })).data;
  },
  async playRecords(uid, week) {
    const resp = await weapi('/v1/play/record', { uid, type: week ? 1 : 0 });
    return (week ? resp.weekData : resp.allData) || [];
  },
  async cloudSongs(limit = 1000, offset = 0) {
    return weapi('/v1/cloud/get', { limit, offset });
  },
  async cloudDelete(id) {
    await weapi('/cloud/del', { songIds: `[${id}]` });
  },

  // MARK: - Playlists
  async personalizedPlaylists(limit = 30) {
    return (await weapi('/personalized/playlist',
      { limit, total: true, n: 1000 })).result;
  },
  async recommendResource() {
    return (await weapi('/v1/discovery/recommend/resource')).recommend;
  },
  async dailyRecommendSongs() {
    return (await weapi('/v3/discovery/recommend/songs')).data.dailySongs;
  },
  async playlistDetail(id) {
    return weapi('/v6/playlist/detail', { id, n: 100000, s: 8 });
  },
  async songDetails(ids) {
    if (!ids.length) return { songs: [], privileges: [] };
    const c = '[' + ids.map((i) => `{"id":${i}}`).join(',') + ']';
    return weapi('/v3/song/detail', { c });
  },
  async topPlaylists(category, order = 'hot', limit = 50, offset = 0) {
    return weapi('/playlist/list',
      { cat: category, order, limit, offset, total: true });
  },
  async highQualityPlaylists(category = '全部', limit = 50, before = 0) {
    return weapi('/playlist/highquality/list',
      { cat: category, limit, lasttime: before, total: true });
  },
  async toplists() {
    return (await eapi('/toplist', {})).list;
  },
  async createPlaylist(name, isPrivate) {
    return weapi('/playlist/create', { name, privacy: isPrivate ? 10 : 0, type: 'NORMAL' });
  },
  async deletePlaylist(id) {
    await weapi('/playlist/remove', { ids: `[${id}]` });
  },
  async subscribePlaylist(id, subscribe) {
    await weapi(`/playlist/${subscribe ? 'subscribe' : 'unsubscribe'}`, { id });
  },
  async playlistTracks(op, playlistID, trackIDs) {
    const ids = '[' + trackIDs.join(',') + ']';
    try {
      await client.weapi('/playlist/manipulate/tracks',
        { op, pid: playlistID, trackIds: ids, imme: 'true' });
    } catch (e) {
      // 512: already-in-playlist quirk — retry with doubled ids like the reference impl
      if (e.code === 512 && op === 'add') {
        await client.weapi('/playlist/manipulate/tracks',
          { op, pid: playlistID, trackIds: '[' + trackIDs.concat(trackIDs).join(',') + ']', imme: 'true' });
        return;
      }
      throw e;
    }
  },
  async intelligenceList(songID, playlistID) {
    const resp = await weapi('/playmode/intelligence/list',
      { songId: songID, type: 'fromPlayOne', playlistId: playlistID, startMusicId: songID, count: 1 });
    return resp.data.map((i) => i.songInfo).filter(Boolean);
  },

  // MARK: - Tracks
  async songURL(ids, level) {
    const payload = { ids: '[' + ids.join(',') + ']', level, encodeType: 'flac' };
    if (level === 'sky') payload.immerseType = 'c51';
    return (await eapi('/song/enhance/player/url/v1', payload)).data;
  },
  async lyric(id) {
    return weapi('/song/lyric', { id, lv: -1, kv: -1, tv: -1, rv: -1 });
  },
  async personalFM() {
    return (await weapi('/v1/radio/get')).data;
  },
  async fmTrash(id) {
    await weapi(`/radio/trash/add?alg=RT&songId=${id}&time=25`, { songId: id });
  },
  async similarSongs(id, limit = 30) {
    return (await weapi('/v1/discovery/simiSong',
      { songid: id, limit, offset: 0 })).songs;
  },

  // MARK: - Albums / Artists
  async album(id) {
    return weapi(`/v1/album/${id}`);
  },
  async newAlbums(area = 'ALL', limit = 30, offset = 0) {
    return (await weapi('/album/new',
      { area, limit, offset, total: true })).albums;
  },
  async albumDynamic(id) {
    return eapi('/album/detail/dynamic', { id });
  },
  async subscribeAlbum(id, subscribe) {
    await weapi(`/album/${subscribe ? 'sub' : 'unsub'}`, { id });
  },
  async artist(id) {
    return weapi(`/v1/artist/${id}`);
  },
  async artistAlbums(id, limit = 100, offset = 0) {
    return weapi(`/artist/albums/${id}`, { limit, offset, total: true });
  },
  async subscribeArtist(id, subscribe) {
    await weapi(`/artist/${subscribe ? 'sub' : 'unsub'}`,
      { artistId: id, artistIds: `[${id}]` });
  },
  async topArtists(limit = 100) {
    return (await weapi('/toplist/artist',
      { type: 1, limit, offset: 0, total: true })).list.artists;
  },
  async similarArtists(id) {
    return (await weapi('/discovery/simiArtist', { artistid: id })).artists;
  },

  // MARK: - Search
  async search(keywords, type, limit = 30, offset = 0) {
    const resp = await eapi('/cloudsearch/pc',
      { s: keywords, type, limit, offset, total: true });
    return resp.result || {};
  },
  async searchSuggest(keywords) {
    return (await weapi('/search/suggest/web', { s: keywords })).result || null;
  },
  async searchDefaultKeyword() {
    const resp = await eapi('/search/defaultkeyword/get', {});
    return (resp.data && resp.data.showKeyword) || null;
  },

  // MARK: - Personalized extras
  async personalizedNewSongs(limit = 10) {
    const resp = await weapi('/personalized/newsong',
      { type: 'recommend', limit, areaId: 0 });
    return resp.result.map((i) => i.song).filter(Boolean);
  },

  // MARK: - Scrobble
  async scrobble(trackID, sourceID, seconds) {
    const log = [{
      action: 'play',
      json: {
        download: 0, end: 'playend', id: trackID,
        sourceId: String(sourceID), time: seconds,
        type: 'song', wifi: 0, source: 'list',
      },
    }];
    try {
      await client.weapi('/feedback/weblog', { logs: JSON.stringify(log) });
    } catch (_) {}
  },
};

module.exports = NeteaseAPI;
