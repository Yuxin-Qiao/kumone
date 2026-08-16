// Kumone for Windows — Electron main process.
// Owns the window and proxies all NetEase API calls (no CORS in the main process).
'use strict';
const { app, BrowserWindow, ipcMain, shell, Menu, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const NeteaseAPI = require('./lib/api');
const unblock = require('./lib/unblock');

const APP_VERSION = require('./package.json').version;
const UPSTREAM_RELEASES = 'https://github.com/missuo/kumone/releases';

// API channel whitelist: renderer → main.
const CHANNELS = {
  qrKey: () => NeteaseAPI.qrKey(),
  qrCheck: ({ key }) => NeteaseAPI.qrCheck(key),
  logout: () => NeteaseAPI.logout(),
  refreshLogin: () => NeteaseAPI.refreshLogin(),
  userAccount: () => NeteaseAPI.userAccount(),
  isLoggedIn: () => NeteaseAPI.client.isLoggedIn,
  userPlaylists: ({ uid }) => NeteaseAPI.userPlaylists(uid),
  likedTrackIDs: ({ uid }) => NeteaseAPI.likedTrackIDs(uid),
  likeTrack: ({ id, like }) => NeteaseAPI.likeTrack(id, like),
  likedAlbums: () => NeteaseAPI.likedAlbums(),
  likedArtists: () => NeteaseAPI.likedArtists(),
  playRecords: ({ uid, week }) => NeteaseAPI.playRecords(uid, week),
  cloudSongs: () => NeteaseAPI.cloudSongs(),
  cloudDelete: ({ id }) => NeteaseAPI.cloudDelete(id),
  personalizedPlaylists: () => NeteaseAPI.personalizedPlaylists(),
  recommendResource: () => NeteaseAPI.recommendResource(),
  dailyRecommendSongs: () => NeteaseAPI.dailyRecommendSongs(),
  playlistDetail: ({ id }) => NeteaseAPI.playlistDetail(id),
  toplists: () => NeteaseAPI.toplists(),
  highQualityPlaylists: ({ before }) => NeteaseAPI.highQualityPlaylists('全部', 12, before || 0),
  newAlbums: () => NeteaseAPI.newAlbums('ALL', 12),
  personalizedNewSongs: () => NeteaseAPI.personalizedNewSongs(12),
  songDetails: ({ ids }) => NeteaseAPI.songDetails(ids),
  songURL: ({ id, level }) => NeteaseAPI.songURL([id], level).then((d) => d[0] || null),
  lyric: ({ id }) => NeteaseAPI.lyric(id),
  search: ({ keywords, type, limit, offset }) => NeteaseAPI.search(keywords, type, limit, offset),
  searchSuggest: ({ keywords }) => NeteaseAPI.searchSuggest(keywords),
  searchDefaultKeyword: () => NeteaseAPI.searchDefaultKeyword(),
  album: ({ id }) => NeteaseAPI.album(id),
  albumDynamic: ({ id }) => NeteaseAPI.albumDynamic(id),
  artist: ({ id }) => NeteaseAPI.artist(id),
  artistAlbums: ({ id }) => NeteaseAPI.artistAlbums(id),
  similarSongs: ({ id }) => NeteaseAPI.similarSongs(id),
  similarArtists: ({ id }) => NeteaseAPI.similarArtists(id),
  topArtists: ({ limit }) => NeteaseAPI.topArtists(limit || 100),
  subscribePlaylist: ({ id, subscribe }) => NeteaseAPI.subscribePlaylist(id, subscribe),
  subscribeAlbum: ({ id, subscribe }) => NeteaseAPI.subscribeAlbum(id, subscribe),
  subscribeArtist: ({ id, subscribe }) => NeteaseAPI.subscribeArtist(id, subscribe),
  createPlaylist: ({ name, isPrivate }) => NeteaseAPI.createPlaylist(name, isPrivate),
  deletePlaylist: ({ id }) => NeteaseAPI.deletePlaylist(id),
  playlistTracks: ({ op, playlistID, trackIDs }) => NeteaseAPI.playlistTracks(op, playlistID, trackIDs),
  scrobble: ({ trackID, sourceID, seconds }) => NeteaseAPI.scrobble(trackID, sourceID, seconds),
  intelligenceList: ({ songID, playlistID }) => NeteaseAPI.intelligenceList(songID, playlistID),
  personalFM: () => NeteaseAPI.personalFM(),
  fmTrash: ({ id }) => NeteaseAPI.fmTrash(id),
  unblock: ({ track }) => unblock.resolve(track),
};

for (const [channel, handler] of Object.entries(CHANNELS)) {
  ipcMain.handle(channel, async (_event, args) => {
    try {
      return { ok: true, data: await handler(args || {}) };
    } catch (e) {
      return { ok: false, error: e.message || String(e), kind: e.kind || null, code: e.code || null };
    }
  });
}

// QR code rendering for the login sheet.
ipcMain.handle('qrImage', async (_event, { text }) => {
  const QRCode = require('qrcode');
  return QRCode.toDataURL(text, { width: 240, margin: 1 });
});

// Version check against upstream GitHub releases (informational only —
// upstream publishes macOS builds; Windows users download manually).
ipcMain.handle('checkUpdate', async () => {
  try {
    const res = await fetch('https://api.github.com/repos/missuo/kumone/releases/latest', {
      headers: { 'User-Agent': `Kumone/${APP_VERSION}` },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return { latest: null, current: APP_VERSION };
    const release = await res.json();
    return { latest: release.tag_name || null, current: APP_VERSION, url: release.html_url || UPSTREAM_RELEASES };
  } catch (_) {
    return { latest: null, current: APP_VERSION };
  }
});

ipcMain.handle('openReleases', () => { shell.openExternal(UPSTREAM_RELEASES); });

// Clipboard: navigator.clipboard is unavailable on file:// pages.
ipcMain.handle('copyText', (_event, { text }) => {
  require('electron').clipboard.writeText(String(text || ''));
  return true;
});

function createWindow() {
  const iconPath = path.join(__dirname, 'build', 'icon.ico');
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: '#17171a',
    title: 'Kumone',
    autoHideMenuBar: true,
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  // Open external links (login links etc.) in the system browser.
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
  // Hardware media keys (works on Windows keyboards / headsets).
  const MEDIA_KEYS = ['MediaPlayPause', 'MediaNextTrack', 'MediaPreviousTrack', 'MediaStop'];
  win.webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown' && MEDIA_KEYS.includes(input.key)) {
      win.webContents.send('media-key', input.key);
      event.preventDefault();
    }
  });
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
