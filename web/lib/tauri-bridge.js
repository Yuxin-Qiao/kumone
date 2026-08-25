// Kumone Tauri platform bridge.
//
// The Web/PWA build keeps using the browser NetEase client. When the same UI is
// hosted by Tauri, this adapter replaces the stable business operations with
// Rust commands and lets WebView2's Media Session integration surface playback
// controls through Windows System Media Transport Controls (SMTC).
(function () {
  'use strict';

  const STORAGE_KEY = 'kumone.tauri.session.v1';
  const tauri = typeof window !== 'undefined' ? window.__TAURI__ : null;
  const invoke = tauri && tauri.core && typeof tauri.core.invoke === 'function'
    ? tauri.core.invoke
    : null;

  function installMediaSession() {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;

    const click = (id) => {
      const button = document.getElementById(id);
      if (button) button.click();
    };
    const safeHandler = (action, handler) => {
      try { navigator.mediaSession.setActionHandler(action, handler); } catch (_) {}
    };

    safeHandler('play', () => click('bp-btn-play'));
    safeHandler('pause', () => click('bp-btn-play'));
    safeHandler('nexttrack', () => click('bp-btn-next'));
    safeHandler('previoustrack', () => click('bp-btn-prev'));

    let lastMetadataKey = '';
    let lastPlaybackState = '';
    const sync = () => {
      const title = (document.getElementById('bp-title')?.textContent || '').trim();
      const artist = (document.getElementById('bp-artist')?.textContent || '').trim();
      const cover = document.getElementById('bp-cover')?.getAttribute('src') || '';
      const key = `${title}\u0000${artist}\u0000${cover}`;

      if (title && key !== lastMetadataKey && typeof MediaMetadata !== 'undefined') {
        try {
          navigator.mediaSession.metadata = new MediaMetadata({
            title,
            artist,
            album: 'Kumone',
            artwork: cover ? [{ src: cover }] : [],
          });
          lastMetadataKey = key;
        } catch (_) {}
      }

      const playButton = document.getElementById('bp-btn-play');
      const state = playButton && playButton.textContent === '⏸' ? 'playing' : 'paused';
      if (state !== lastPlaybackState) {
        try { navigator.mediaSession.playbackState = state; } catch (_) {}
        lastPlaybackState = state;
      }
    };

    const observer = new MutationObserver(sync);
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['src'],
    });
    sync();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', installMediaSession, { once: true });
  } else {
    installMediaSession();
  }

  // No Rust bridge in a normal browser/PWA. Media Session support above remains
  // useful there and the existing browser implementation is left untouched.
  if (!invoke) return;

  function loadStoredSession() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch (_) {
      return {};
    }
  }

  async function persistSession() {
    try {
      const values = await invoke('session_export');
      localStorage.setItem(STORAGE_KEY, JSON.stringify(values || {}));
    } catch (_) {}
  }

  const ready = invoke('session_import', { values: loadStoredSession() }).catch(() => {});
  const call = async (command, args) => {
    await ready;
    return invoke(command, args || {});
  };

  const api = window.NeteaseAPI || {};
  const original = { ...api };
  let lastQr = null;

  Object.assign(api, {
    async qrKey() {
      lastQr = await call('netease_qr_begin');
      return lastQr.key;
    },

    qrLoginURL(key) {
      if (lastQr && lastQr.key === key) return lastQr.url;
      return `https://music.163.com/login?codekey=${encodeURIComponent(key)}`;
    },

    async qrCheck(key) {
      const result = await call('netease_qr_check', { key });
      if (result && result.code === 803) await persistSession();
      return result;
    },

    async logout() {
      await call('session_logout');
      await persistSession();
    },

    async userAccount() {
      const profile = await call('netease_account');
      await persistSession();
      return profile || null;
    },

    async userPlaylists(uid, limit = 2000, offset = 0) {
      return call('netease_user_playlists', { uid, limit, offset });
    },

    async personalizedPlaylists(limit = 30) {
      return call('netease_personalized_playlists', { limit });
    },

    async recommendResource() {
      return call('netease_recommended_playlists');
    },

    async dailyRecommendSongs() {
      return call('netease_daily_songs');
    },

    async playlistDetail(id) {
      const detail = await call('netease_playlist_detail', { id });
      if (!detail) return { playlist: null };
      return {
        code: 200,
        playlist: {
          ...detail.summary,
          tracks: detail.tracks || [],
        },
      };
    },

    async search(keywords, type, limit = 30, offset = 0) {
      // Only song search has a stabilized Rust model today. Preserve the Web
      // implementation for album/artist/playlist search until those contracts
      // move into kumone-core as well.
      if (Number(type) !== 1 && typeof original.search === 'function') {
        return original.search.call(api, keywords, type, limit, offset);
      }
      const result = await call('netease_search_songs', { keywords, limit, offset });
      return {
        songs: result?.songs || [],
        songCount: result?.total || 0,
      };
    },

    async songURL(ids, level = 'standard') {
      const list = Array.isArray(ids) ? ids : [ids];
      return Promise.all(list.map(async (id) => {
        const levels = [...new Set([level, 'lossless', 'exhigh', 'standard'])];
        for (const candidateLevel of levels) {
          try {
            return await call('netease_resolve_playback', {
              trackId: Number(id),
              level: candidateLevel,
            });
          } catch (_) {
            // A restricted/trial URL at one quality is not a terminal error;
            // try the next shared-core quality before Unblock runs.
          }
        }
        // Existing player logic treats a missing URL as the signal to invoke
        // Unblock. Returning a stable placeholder keeps that behavior intact.
        return { id: Number(id), url: null, code: 404 };
      }));
    },
    async checkForUpdate() {
      return call('check_for_update');
    },
    async exportDiagnostics() {
      return call('diagnostics_export');
    },
  });
  window.NeteaseAPI = api;

  const browserUnblock = window.Unblock || {};
  window.Unblock = {
    ...browserUnblock,
    async resolve(track) {
      const artistName = track?.artist
        || (Array.isArray(track?.artists) ? track.artists.map((artist) => artist?.name).filter(Boolean).join(' / ') : '')
        || '';
      const durationMs = Number(track?.durationMS ?? track?.durationMs ?? track?.dt ?? 0);
      return call('netease_unblock_track', {
        track: {
          id: Number(track?.id || 0),
          name: String(track?.name || ''),
          artistName: String(artistName),
          durationMs: Number.isFinite(durationMs) ? durationMs : 0,
        },
      });
    },
  };

  window.KumoneTauri = Object.freeze({
    invoke: call,
    persistSession,
    checkForUpdate: () => call('check_for_update'),
    exportDiagnostics: () => call('diagnostics_export'),
  });
})();
