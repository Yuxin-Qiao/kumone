// Kumone Web & PWA — 1:1 Port of macOS Swift App Architecture
'use strict';

(function () {
  const getAPI = () => (typeof window !== 'undefined' && window.NeteaseAPI ? window.NeteaseAPI : (typeof require === 'function' ? require('./lib/api') : {}));
  const getClientMod = () => (typeof window !== 'undefined' && window.NeteaseClient ? window.NeteaseClient : (typeof require === 'function' ? require('./lib/client') : {}));
  const getCryptoMod = () => (typeof window !== 'undefined' && window.NeteaseCrypto ? window.NeteaseCrypto : (typeof require === 'function' ? require('./lib/crypto') : {}));
  const getUnblockMod = () => (typeof window !== 'undefined' && window.Unblock ? window.Unblock : (typeof require === 'function' ? require('./lib/unblock') : {}));

  const NeteaseAPI = new Proxy({}, {
    get(target, prop) {
      const api = getAPI();
      if (api && prop in api) {
        return typeof api[prop] === 'function' ? api[prop].bind(api) : api[prop];
      }
      return target[prop];
    }
  });

  const NeteaseClient = new Proxy({}, {
    get(target, prop) {
      const client = getClientMod();
      if (client && prop in client) {
        return typeof client[prop] === 'function' ? client[prop].bind(client) : client[prop];
      }
      return target[prop];
    }
  });

  const state = {
    user: null,
    likedIds: new Set(),
    createdPlaylists: [],
    subscribedPlaylists: [],
    queue: [],
    playNextQueue: [],
    historyQueue: [],
    currentTrack: null,
    currentIndex: -1,
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    playMode: 'loop', // 'loop' | 'one' | 'shuffle'
    quality: 'lossless',
    unblockEnabled: true,
    lyrics: [],
    activeLyricIndex: -1,
    currentView: 'home',
    viewParams: {},
    navHistory: [{ view: 'home', params: {} }],
    navHistoryIndex: 0,
    searchKeyword: '',
    searchType: 1,
    actionTrack: null,
    qrPollTimer: null,
    currentUnikey: null,
    isNowPlayingActive: false,
    audioElem: null,
  };

  const el = {};

  function initElements() {
    el.viewContainer = document.getElementById('view-container');
    el.mainScroll = document.getElementById('main-scroll-view');
    el.appSidebar = document.getElementById('app-sidebar');
    
    // Top Bar & Navigation
    el.btnNavBack = document.getElementById('btn-nav-back');
    el.btnNavForward = document.getElementById('btn-nav-forward');
    el.topSearchInput = document.getElementById('top-search-input');
    el.btnBrandHome = document.getElementById('btn-brand-home');
    el.btnMobileBrand = document.getElementById('btn-mobile-brand');
    el.btnAccount = document.getElementById('btn-account');
    el.userAvatar = document.getElementById('user-avatar');
    el.userName = document.getElementById('user-name');

    // Sidebar Items
    el.sidebarAccountBtn = document.getElementById('sidebar-account-btn');
    el.sidebarUserAvatar = document.getElementById('sidebar-user-avatar');
    el.sidebarUserName = document.getElementById('sidebar-user-name');
    el.sidebarUserVip = document.getElementById('sidebar-user-vip');
    el.sidebarUserSub = document.getElementById('sidebar-user-sub');
    el.sidebarCreatedSection = document.getElementById('sidebar-created-section');
    el.sidebarCreatedList = document.getElementById('sidebar-created-list');
    el.sidebarSubscribedSection = document.getElementById('sidebar-subscribed-section');
    el.sidebarSubscribedList = document.getElementById('sidebar-subscribed-list');

    // Floating Capsule Player Bar
    el.bottomPlayerBar = document.getElementById('bottom-player-bar') || document.getElementById('floating-player-bar');
    el.fpArtworkBtn = document.getElementById('fp-artwork-btn');
    el.bpCover = document.getElementById('bp-cover');
    el.bpTitle = document.getElementById('bp-title');
    el.bpVipBadge = document.getElementById('bp-vip-badge');
    el.bpArtist = document.getElementById('bp-artist');
    el.bpBtnLike = document.getElementById('bp-btn-like');
    el.bpBtnShuffle = document.getElementById('bp-btn-shuffle');
    el.bpBtnPrev = document.getElementById('bp-btn-prev');
    el.bpBtnPlay = document.getElementById('bp-btn-play');
    el.bpBtnNext = document.getElementById('bp-btn-next');
    el.bpBtnRepeat = document.getElementById('bp-btn-repeat');
    el.bpSliderTrack = document.getElementById('bp-slider-track');
    el.bpProgressFill = document.getElementById('bp-progress-fill');
    el.bpTimeCurrent = document.getElementById('bp-time-current');
    el.bpTimeTotal = document.getElementById('bp-time-total');
    el.bpQualityBadge = document.getElementById('bp-quality-badge');
    el.bpBtnLyrics = document.getElementById('bp-btn-lyrics');
    el.bpBtnQueue = document.getElementById('bp-btn-queue');
    el.bpVolumeSlider = document.getElementById('bp-volume-slider');

    // Fullscreen Immersive Player View (NowPlayingView.swift)
    el.fullscreenPlayer = document.getElementById('fullscreen-player');
    el.fsBackdrop = document.getElementById('fs-backdrop');
    el.fsBtnClose = document.getElementById('fs-btn-close');
    el.fsBtnLyricsToggle = document.getElementById('fs-btn-lyrics-toggle');
    el.fsTitle = document.getElementById('fs-title');
    el.fsArtist = document.getElementById('fs-artist');
    el.fsCover = document.getElementById('fs-cover');
    el.fsTrackName = document.getElementById('fs-track-name');
    el.fsArtistName = document.getElementById('fs-artist-name');
    el.fsLyricsView = document.getElementById('fs-lyrics-view');
    el.fsLyricsContent = document.getElementById('fs-lyrics-content');

    // Bottom Navigation Bar (Mobile)
    el.bottomNav = document.getElementById('bottom-nav');

    // Sheets & Modals
    el.actionSheetBackdrop = document.getElementById('action-sheet-backdrop');
    el.actionSheetCover = document.getElementById('action-sheet-cover');
    el.actionSheetTitle = document.getElementById('action-sheet-title');
    el.actionSheetArtist = document.getElementById('action-sheet-artist');
    el.actionPlayNext = document.getElementById('action-play-next');
    el.actionLike = document.getElementById('action-like');
    el.actionLikeIcon = document.getElementById('action-like-icon');
    el.actionLikeText = document.getElementById('action-like-text');
    el.actionAlbum = document.getElementById('action-album');
    el.actionArtist = document.getElementById('action-artist');
    el.actionSimi = document.getElementById('action-simi');
    el.actionCopyLink = document.getElementById('action-copy-link');
    el.btnCancelAction = document.getElementById('btn-cancel-action');

    el.queueSheetBackdrop = document.getElementById('queue-sheet-backdrop');
    el.queueListContainer = document.getElementById('queue-list-container');
    el.btnClearQueue = document.getElementById('btn-clear-queue');
    el.btnCloseQueue = document.getElementById('btn-close-queue');

    el.loginSheetBackdrop = document.getElementById('login-sheet-backdrop');
    el.loginQrBox = document.querySelector('.login-qr-box');
    el.loginQrImg = document.getElementById('login-qr-img');
    el.loginQrSpinner = document.getElementById('login-qr-spinner');
    el.loginQrOverlay = document.getElementById('login-qr-overlay');
    el.loginQrOverlayContent = document.getElementById('login-qr-overlay-content');
    el.loginQrStatus = document.getElementById('login-qr-status');
    el.btnCloseLogin = document.getElementById('btn-close-login');

    el.accountCardBackdrop = document.getElementById('account-card-backdrop');
    el.accountCardAvatar = document.getElementById('account-card-avatar');
    el.accountCardNickname = document.getElementById('account-card-nickname');
    el.accountCardVip = document.getElementById('account-card-vip');
    el.accountCardSignature = document.getElementById('account-card-signature');
    el.btnAccountLogout = document.getElementById('btn-account-logout');
    el.btnCloseAccountCard = document.getElementById('btn-close-account-card');

    el.toastContainer = document.getElementById('toast-container');
  }

  // ==========================================================================
  // Formatting & Utility
  // ==========================================================================
  function formatTime(seconds) {
    if (isNaN(seconds) || seconds < 0) return '00:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
  }

  function formatCount(num) {
    if (!num) return '0';
    if (num >= 100000000) return (num / 100000000).toFixed(1) + '亿';
    if (num >= 10000) return (num / 10000).toFixed(1) + '万';
    return String(num);
  }

  function formatArtists(artists) {
    if (!artists || !artists.length) return '未知歌手';
    return artists.map((a) => a.name).join(' / ');
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>"']/g, (m) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    })[m]);
  }

  function showToast(msg) {
    if (!el.toastContainer) return;
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    el.toastContainer.appendChild(t);
    setTimeout(() => {
      if (t.parentNode) t.parentNode.removeChild(t);
    }, 2600);
  }

  function normalizeTrack(raw) {
    if (!raw) return null;
    const artists = raw.ar || raw.artists || [];
    const album = raw.al || raw.album || {};
    const durationMS = raw.dt || raw.duration || 0;
    let picUrl = album.picUrl || raw.picUrl || '';
    if (!picUrl && album.id) {
      picUrl = `https://p1.music.126.net/6y-UleORITEDbvlOLx0DEg==/${album.pic || 0}.jpg`;
    }
    if (picUrl && picUrl.startsWith('http://')) {
      picUrl = picUrl.replace('http://', 'https://');
    }

    return {
      id: raw.id,
      name: raw.name || '未知曲目',
      artists: artists.map((a) => ({ id: a.id, name: a.name })),
      artist: formatArtists(artists),
      album: { id: album.id, name: album.name || '', picUrl },
      durationMS,
      duration: Math.floor(durationMS / 1000),
      picUrl,
      fee: raw.fee || 0,
      servedSource: raw.servedSource || null,
    };
  }

  // ==========================================================================
  // Audio Player Core Engine
  // ==========================================================================
  function playAudio(url, track, startPosMs = 0) {
    state.isPlaying = true;
    updatePlayPauseButtons();

    if (!state.audioElem) {
      state.audioElem = new Audio();
      state.audioElem.addEventListener('timeupdate', () => {
        onNativePlaybackProgress(!state.audioElem.paused, Math.floor(state.audioElem.currentTime * 1000), Math.floor(state.audioElem.duration * 1000));
      });
      state.audioElem.addEventListener('ended', () => {
        onNativePlaybackComplete();
      });
    }
    state.audioElem.src = url;
    if (startPosMs > 0) {
      state.audioElem.currentTime = startPosMs / 1000;
    }
    state.audioElem.play().catch(() => {});
  }

  function pauseAudio() {
    state.isPlaying = false;
    updatePlayPauseButtons();
    if (state.audioElem) state.audioElem.pause();
  }

  function resumeAudio() {
    state.isPlaying = true;
    updatePlayPauseButtons();
    if (state.audioElem) state.audioElem.play().catch(() => {});
  }

  function seekAudio(posMs) {
    state.currentTime = Math.floor(posMs / 1000);
    if (state.audioElem) {
      state.audioElem.currentTime = posMs / 1000;
    }
  }

  function onNativePlaybackProgress(isPlaying, posMs, durMs) {
    state.isPlaying = isPlaying;
    state.currentTime = Math.floor(posMs / 1000);
    if (durMs > 0) state.duration = Math.floor(durMs / 1000);

    updatePlayPauseButtons();
    updateProgressUI();
    updateActiveLyric(posMs);
  }

  function onNativePlaybackComplete() {
    if (state.playMode === 'one') {
      if (state.currentTrack) playTrack(state.currentTrack);
    } else {
      playNextTrack(false);
    }
  }

  function onNativeNext() {
    playNextTrack(true);
  }

  function onNativePrev() {
    playPrevTrack();
  }

  function updatePlayPauseButtons() {
    const icon = state.isPlaying ? '⏸' : '▶';
    if (el.bpBtnPlay) el.bpBtnPlay.textContent = icon;
  }

  function updateProgressUI() {
    const cur = state.currentTime;
    const dur = state.duration || (state.currentTrack ? state.currentTrack.duration : 0) || 1;
    const pct = Math.min(100, Math.max(0, (cur / dur) * 100));

    if (el.bpProgressFill) el.bpProgressFill.style.width = `${pct}%`;
    if (el.bpTimeCurrent) el.bpTimeCurrent.textContent = formatTime(cur);
    if (el.bpTimeTotal) el.bpTimeTotal.textContent = formatTime(dur);
  }

  async function playTrack(track, queueContext = null) {
    if (!track) return;
    const normalized = normalizeTrack(track);
    state.currentTrack = normalized;

    if (queueContext) {
      state.queue = queueContext.map(normalizeTrack);
      state.currentIndex = state.queue.findIndex((t) => t.id === normalized.id);
    }

    updateNowPlayingUI(normalized);
    loadLyrics(normalized.id);

    try {
      let playUrl = null;
      let servedSource = null;
      let isTrial = false;

      try {
        const urls = await NeteaseAPI.songURL([normalized.id], state.quality);
        if (urls && urls[0]) {
          const u = urls[0];
          if (u.url) {
            playUrl = u.url;
            servedSource = u.level || state.quality;
          }
          if (u.freeTrialInfo != null || (u.freeTimeTrialPrivilege && u.freeTimeTrialPrivilege.remainTime > 0) || (u.freeTrialPrivilege && u.freeTrialPrivilege.cannotListenReason === 1) || u.code === 404) {
            isTrial = true;
          }
        }
      } catch (_) {}

      // If NetEase refused OR returned a 30s VIP trial snippet, resolve full track from third-party sources (UnblockNeteaseMusic 1:1)
      if ((!playUrl || isTrial) && state.unblockEnabled) {
        const unblock = typeof window !== 'undefined' && window.Unblock ? window.Unblock : (typeof require === 'function' ? require('./lib/unblock') : null);
        if (unblock) {
          const unblockRes = await unblock.resolve(normalized);
          if (unblockRes && unblockRes.url) {
            playUrl = unblockRes.url;
            servedSource = unblockRes.source || '第三方音源';
            isTrial = false;
            showToast(`已使用第三方音源：${servedSource}`);
          }
        }
      }

      if (!playUrl) {
        showToast('该歌曲暂无可用播放链接');
        setTimeout(() => playNextTrack(false), 1500);
        return;
      }

      if (isTrial) {
        showToast('VIP 歌曲，当前为试听片段');
      }

      normalized.servedSource = servedSource;
      updateQualityBadge(servedSource);

      playAudio(playUrl, normalized, 0);
      NeteaseAPI.scrobble(normalized.id, 0, normalized.duration);
    } catch (e) {
      showToast('播放失败: ' + (e.message || '网络错误'));
    }
  }

  function playNextTrack(isManual = false) {
    if (state.playNextQueue.length > 0) {
      const nextTrack = state.playNextQueue.shift();
      playTrack(nextTrack);
      return;
    }

    if (!state.queue.length) return;

    if (state.playMode === 'shuffle') {
      const nextIdx = Math.floor(Math.random() * state.queue.length);
      state.currentIndex = nextIdx;
      playTrack(state.queue[nextIdx]);
      return;
    }

    let nextIdx = state.currentIndex + 1;
    if (nextIdx >= state.queue.length) {
      if (state.playMode === 'loop' || isManual) nextIdx = 0;
      else return;
    }
    state.currentIndex = nextIdx;
    playTrack(state.queue[nextIdx]);
  }

  function playPrevTrack() {
    if (!state.queue.length) return;
    let prevIdx = state.currentIndex - 1;
    if (prevIdx < 0) prevIdx = state.queue.length - 1;
    state.currentIndex = prevIdx;
    playTrack(state.queue[prevIdx]);
  }

  function togglePlay() {
    if (!state.currentTrack) {
      if (state.queue.length > 0) playTrack(state.queue[0]);
      return;
    }
    if (state.isPlaying) pauseAudio();
    else resumeAudio();
  }

  function toggleLikeCurrent() {
    if (!state.currentTrack) return;
    const id = state.currentTrack.id;
    const isLiked = state.likedIds.has(id);
    toggleLikeTrack(id, !isLiked);
  }

  async function toggleLikeTrack(id, like) {
    try {
      await NeteaseAPI.likeTrack(id, like);
      if (like) state.likedIds.add(id);
      else state.likedIds.delete(id);
      updateLikeButtons();
      showToast(like ? '已添加到我喜欢的音乐' : '已取消喜欢');
    } catch (e) {
      showToast(e.message || '操作失败');
    }
  }

  function updateLikeButtons() {
    if (!state.currentTrack) return;
    const isLiked = state.likedIds.has(state.currentTrack.id);
    const text = isLiked ? '❤️' : '♡';
    if (el.bpBtnLike) {
      el.bpBtnLike.textContent = text;
      el.bpBtnLike.classList.toggle('active', isLiked);
    }
  }

  function updateNowPlayingUI(track) {
    const coverUrl = track.picUrl || '';
    if (el.bpCover) el.bpCover.src = coverUrl;
    if (el.bpTitle) el.bpTitle.textContent = track.name;
    if (el.bpArtist) el.bpArtist.textContent = track.artist;
    if (el.bpVipBadge) el.bpVipBadge.style.display = track.fee === 1 ? 'inline-block' : 'none';

    if (el.fsCover) el.fsCover.src = coverUrl;
    if (el.fsTitle) el.fsTitle.textContent = track.name;
    if (el.fsArtist) el.fsArtist.textContent = track.artist;
    if (el.fsTrackName) el.fsTrackName.textContent = track.name;
    if (el.fsArtistName) el.fsArtistName.textContent = track.artist;
    if (coverUrl && el.fsBackdrop) {
      el.fsBackdrop.style.backgroundImage = `url('${coverUrl}')`;
    }

    updateLikeButtons();
    updateQualityBadge(track.servedSource);
  }

  function updateQualityBadge(source) {
    let text = '标准';
    if (source === 'lossless') text = '无损 FLAC';
    else if (source === 'hires') text = 'Hi-Res';
    else if (source === 'exhigh') text = '极高 320k';
    else if (source === 'higher') text = '较高 192k';
    else if (source) text = source;
    if (el.bpQualityBadge) el.bpQualityBadge.textContent = text;
  }

  function cyclePlayMode() {
    if (state.playMode === 'loop') {
      state.playMode = 'one';
      if (el.bpBtnRepeat) el.bpBtnRepeat.textContent = '🔂';
      showToast('单曲循环');
    } else if (state.playMode === 'one') {
      state.playMode = 'shuffle';
      if (el.bpBtnRepeat) el.bpBtnRepeat.textContent = '🔀';
      showToast('随机播放');
    } else {
      state.playMode = 'loop';
      if (el.bpBtnRepeat) el.bpBtnRepeat.textContent = '🔁';
      showToast('列表循环');
    }
  }

  // ==========================================================================
  // Lyrics Engine (Synchronized Scroll & Bilingual)
  // ==========================================================================
  function parseLrc(lrcText, tlyricText = '') {
    if (!lrcText) return [];
    const lines = lrcText.split('\n');
    const tlines = tlyricText ? tlyricText.split('\n') : [];
    const transMap = new Map();

    const timeRegex = /\[(\d{2}):(\d{2})\.(\d{2,3})\]/g;
    for (const line of tlines) {
      let match;
      timeRegex.lastIndex = 0;
      while ((match = timeRegex.exec(line)) !== null) {
        const min = parseInt(match[1], 10);
        const sec = parseInt(match[2], 10);
        const msStr = match[3].length === 2 ? match[3] + '0' : match[3];
        const ms = parseInt(msStr, 10);
        const timeMs = min * 60000 + sec * 1000 + ms;
        const text = line.replace(timeRegex, '').trim();
        if (text) transMap.set(timeMs, text);
      }
    }

    const parsed = [];
    for (const line of lines) {
      let match;
      timeRegex.lastIndex = 0;
      while ((match = timeRegex.exec(line)) !== null) {
        const min = parseInt(match[1], 10);
        const sec = parseInt(match[2], 10);
        const msStr = match[3].length === 2 ? match[3] + '0' : match[3];
        const ms = parseInt(msStr, 10);
        const timeMs = min * 60000 + sec * 1000 + ms;
        const text = line.replace(timeRegex, '').trim();
        if (text) {
          parsed.push({
            timeMs,
            text,
            translation: transMap.get(timeMs) || '',
          });
        }
      }
    }

    parsed.sort((a, b) => a.timeMs - b.timeMs);
    return parsed;
  }

  async function loadLyrics(songId) {
    state.lyrics = [];
    state.activeLyricIndex = -1;
    if (el.fsLyricsContent) {
      el.fsLyricsContent.innerHTML = '<div class="lyrics-empty-state">歌词加载中…</div>';
    }

    try {
      const res = await NeteaseAPI.lyric(songId);
      let lrc = res && res.lrc ? res.lrc.lyric : '';
      let tlyric = res && res.tlyric ? res.tlyric.lyric : '';

      if (!lrc) {
        try {
          const fallbackLrc = await fetch(`https://api.injahow.cn/meting/?type=lrc&id=${songId}`).then(r => r.text());
          if (fallbackLrc && fallbackLrc.includes('[')) {
            lrc = fallbackLrc;
          }
        } catch (_) {}
      }

      state.lyrics = parseLrc(lrc, tlyric);
      renderLyrics();
    } catch (_) {
      if (el.fsLyricsContent) {
        el.fsLyricsContent.innerHTML = '<div class="lyrics-empty-state">暂无歌词</div>';
      }
    }
  }

  function renderLyrics() {
    if (!el.fsLyricsContent) return;
    if (!state.lyrics.length) {
      el.fsLyricsContent.innerHTML = '<div class="lyrics-empty-state">纯音乐，请欣赏</div>';
      return;
    }

    el.fsLyricsContent.innerHTML = state.lyrics.map((line, idx) => `
      <div class="lyric-line" data-index="${idx}" data-time="${line.timeMs}">
        <div class="lyric-text">${escapeHtml(line.text)}</div>
        ${line.translation ? `<div class="lyric-translation">${escapeHtml(line.translation)}</div>` : ''}
      </div>
    `).join('');

    // Click lyric line to seek
    el.fsLyricsContent.querySelectorAll('.lyric-line').forEach((item) => {
      item.onclick = () => {
        const timeMs = parseInt(item.getAttribute('data-time'), 10);
        if (!isNaN(timeMs)) seekAudio(timeMs);
      };
    });
  }

  function updateActiveLyric(posMs) {
    if (!state.lyrics.length || !el.fsLyricsContent) return;

    let activeIdx = -1;
    for (let i = 0; i < state.lyrics.length; i++) {
      if (posMs >= state.lyrics[i].timeMs) {
        activeIdx = i;
      } else {
        break;
      }
    }

    if (activeIdx !== state.activeLyricIndex) {
      state.activeLyricIndex = activeIdx;
      const prevActive = el.fsLyricsContent.querySelector('.lyric-line.active');
      if (prevActive) prevActive.classList.remove('active');

      if (activeIdx >= 0) {
        const curActive = el.fsLyricsContent.querySelector(`.lyric-line[data-index="${activeIdx}"]`);
        if (curActive) {
          curActive.classList.add('active');
          if (el.fsLyricsView) {
            const containerHeight = el.fsLyricsView.clientHeight;
            const lineTop = curActive.offsetTop;
            const lineHeight = curActive.clientHeight;
            el.fsLyricsView.scrollTo({
              top: lineTop - containerHeight / 2 + lineHeight / 2,
              behavior: 'smooth'
            });
          }
        }
      }
    }
  }

  function openNowPlaying() {
    if (!state.currentTrack) {
      showToast('当前未在播放任何歌曲');
      return;
    }
    state.isNowPlayingActive = true;
    if (el.fullscreenPlayer) el.fullscreenPlayer.classList.add('active');
  }

  function closeNowPlaying() {
    state.isNowPlayingActive = false;
    if (el.fullscreenPlayer) el.fullscreenPlayer.classList.remove('active');
  }

  // ==========================================================================
  // Navigation & View Router (MainWindow.swift)
  // ==========================================================================
  function navigateTo(view, params = {}, addToHistory = true) {
    state.currentView = view;
    state.viewParams = params;

    if (addToHistory) {
      state.navHistory = state.navHistory.slice(0, state.navHistoryIndex + 1);
      state.navHistory.push({ view, params });
      state.navHistoryIndex = state.navHistory.length - 1;
    }

    updateNavHistoryButtons();

    // Update Sidebar Item Active State
    document.querySelectorAll('.sidebar-nav-item').forEach((item) => {
      const nav = item.getAttribute('data-nav');
      item.classList.toggle('active', nav === view);
    });

    // Update Bottom Nav Tab (Mobile)
    document.querySelectorAll('.nav-tab').forEach((tab) => {
      const t = tab.getAttribute('data-tab');
      tab.classList.toggle('active', t === view);
    });

    // Scroll to top
    if (el.mainScroll) el.mainScroll.scrollTop = 0;

    switch (view) {
      case 'home':
        renderHomeView();
        break;
      case 'explore':
        renderExploreView(params.category || '全部');
        break;
      case 'fm':
        renderFMView();
        break;
      case 'liked':
      case 'library':
        renderLibraryView();
        break;
      case 'daily':
        openDailyRecommend();
        break;
      case 'recents':
        renderRecentsView();
        break;
      case 'collections':
        renderCollectionsView();
        break;
      case 'cloud':
        renderCloudView();
        break;
      case 'search':
        renderSearchView(params);
        break;
      case 'playlist':
        renderPlaylistView(params.id);
        break;
      case 'album':
        renderAlbumView(params.id);
        break;
      case 'artist':
        renderArtistView(params.id);
        break;
      case 'settings':
        renderSettingsView();
        break;
      default:
        renderHomeView();
    }
  }

  function handleNavBack() {
    if (state.navHistoryIndex > 0) {
      state.navHistoryIndex--;
      const entry = state.navHistory[state.navHistoryIndex];
      navigateTo(entry.view, entry.params, false);
    }
  }

  function handleNavForward() {
    if (state.navHistoryIndex < state.navHistory.length - 1) {
      state.navHistoryIndex++;
      const entry = state.navHistory[state.navHistoryIndex];
      navigateTo(entry.view, entry.params, false);
    }
  }

  function updateNavHistoryButtons() {
    if (el.btnNavBack) el.btnNavBack.disabled = state.navHistoryIndex <= 0;
    if (el.btnNavForward) el.btnNavForward.disabled = state.navHistoryIndex >= state.navHistory.length - 1;
  }

  // ==========================================================================
  // View 1: Home View (HomeView.swift 1:1)
  // ==========================================================================
  async function renderHomeView() {
    el.viewContainer.innerHTML = '<div style="padding:40px 0;text-align:center;color:var(--text-muted)">正在加载推荐内容…</div>';

    try {
      const isLoggedIn = NeteaseClient.isLoggedIn;
      const todayDate = new Date().getDate();

      const [recRes, topRes, albumRes, artistRes] = await Promise.allSettled([
        NeteaseAPI.personalizedPlaylists(12),
        NeteaseAPI.toplists(),
        NeteaseAPI.newAlbums('ALL', 10),
        NeteaseAPI.topArtists(6),
      ]);

      const recPlaylists = recRes.status === 'fulfilled' && Array.isArray(recRes.value) ? recRes.value : [];
      const toplists = topRes.status === 'fulfilled' && Array.isArray(topRes.value) ? topRes.value : [];
      const newAlbums = albumRes.status === 'fulfilled' && Array.isArray(albumRes.value) ? albumRes.value : [];
      const artists = artistRes.status === 'fulfilled' && Array.isArray(artistRes.value) ? artistRes.value : [];

      let html = '';

      // 1. Feature Cards Row (HomeView.swift featureCards)
      html += `
        <div class="feature-cards-row">
          ${isLoggedIn ? `
            <div class="feature-card daily" id="btn-feature-daily">
              <div class="feature-card-top">
                <span class="feature-card-icon">📅</span>
                <span class="feature-card-date-badge">${todayDate}</span>
              </div>
              <div class="feature-card-bottom">
                <div class="feature-card-title">每日推荐</div>
                <div class="feature-card-subtitle">根据你的口味生成</div>
              </div>
            </div>

            <div class="feature-card fm" id="btn-feature-fm">
              <div class="feature-card-top">
                <span class="feature-card-icon">📻</span>
              </div>
              <div class="feature-card-bottom">
                <div class="feature-card-title">私人漫游</div>
                <div class="feature-card-subtitle">从喜欢的歌开始漫游</div>
              </div>
            </div>

            <div class="feature-card heartbeat" id="btn-feature-heartbeat">
              <div class="feature-card-top">
                <span class="feature-card-icon">💓</span>
              </div>
              <div class="feature-card-bottom">
                <div class="feature-card-title">心动模式</div>
                <div class="feature-card-subtitle">红心歌曲与相似推荐</div>
              </div>
            </div>
          ` : `
            <div class="feature-card daily" id="btn-feature-login" style="flex:0 0 320px">
              <div class="feature-card-top">
                <span class="feature-card-icon">👤</span>
              </div>
              <div class="feature-card-bottom">
                <div class="feature-card-title">登录网易云音乐</div>
                <div class="feature-card-subtitle">解锁每日推荐、私人漫游与云端歌单</div>
              </div>
            </div>
          `}
        </div>
      `;

      // 2. 推荐歌单 (Recommend Playlists Shelf)
      if (recPlaylists && recPlaylists.length) {
        html += `
          <div class="shelf-section">
            <div class="shelf-header">
              <div class="shelf-title">推荐歌单</div>
              <div class="shelf-see-all" data-nav="explore">查看全部 ›</div>
            </div>
            <div class="cards-grid">
              ${recPlaylists.map((p) => `
                <div class="cover-card" data-action="open-playlist" data-id="${p.id}">
                  <div class="cover-card-artwork-wrapper">
                    <img class="cover-card-img" src="${p.picUrl}?param=300y300" loading="lazy" alt="">
                    <div class="cover-card-playcount">▷ ${formatCount(p.playCount)}</div>
                    <button class="cover-card-play-btn" data-play-playlist="${p.id}" title="播放歌单">▶</button>
                  </div>
                  <div class="cover-card-title">${escapeHtml(p.name)}</div>
                  <div class="cover-card-subtitle">${escapeHtml(p.copywriter || '')}</div>
                </div>
              `).join('')}
            </div>
          </div>
        `;
      }

      // 3. 排行榜 (Toplists Shelf)
      if (toplists && toplists.length) {
        const top4 = toplists.filter(t => [19723756, 3779629, 2884035, 3778678].includes(t.id)).slice(0, 4);
        const displayLists = top4.length ? top4 : toplists.slice(0, 4);
        html += `
          <div class="shelf-section">
            <div class="shelf-header">
              <div class="shelf-title">排行榜</div>
            </div>
            <div class="cards-grid" style="grid-template-columns:repeat(auto-fill, minmax(180px, 1fr))">
              ${displayLists.map((t) => `
                <div class="cover-card" data-action="open-playlist" data-id="${t.id}">
                  <div class="cover-card-artwork-wrapper">
                    <img class="cover-card-img" src="${t.coverImgUrl}?param=300y300" loading="lazy" alt="">
                    <div class="cover-card-playcount">▷ ${formatCount(t.playCount)}</div>
                    <button class="cover-card-play-btn" data-play-playlist="${t.id}" title="播放榜单">▶</button>
                  </div>
                  <div class="cover-card-title">${escapeHtml(t.name)}</div>
                  <div class="cover-card-subtitle">${escapeHtml(t.updateFrequency || '')}</div>
                </div>
              `).join('')}
            </div>
          </div>
        `;
      }

      // 4. 新碟上架 (New Albums Shelf)
      if (newAlbums && newAlbums.length) {
        html += `
          <div class="shelf-section">
            <div class="shelf-header">
              <div class="shelf-title">新碟上架</div>
            </div>
            <div class="cards-grid">
              ${newAlbums.slice(0, 6).map((a) => `
                <div class="cover-card" data-action="open-album" data-id="${a.id}">
                  <div class="cover-card-artwork-wrapper">
                    <img class="cover-card-img" src="${a.picUrl}?param=300y300" loading="lazy" alt="">
                  </div>
                  <div class="cover-card-title">${escapeHtml(a.name)}</div>
                  <div class="cover-card-subtitle">${escapeHtml(a.artist ? a.artist.name : '')}</div>
                </div>
              `).join('')}
            </div>
          </div>
        `;
      }

      el.viewContainer.innerHTML = html;
      attachCardEvents();

      // Feature card events
      const btnDaily = document.getElementById('btn-feature-daily');
      if (btnDaily) btnDaily.onclick = openDailyRecommend;
      const btnFm = document.getElementById('btn-feature-fm');
      if (btnFm) btnFm.onclick = () => navigateTo('fm');
      const btnHeartbeat = document.getElementById('btn-feature-heartbeat');
      if (btnHeartbeat) btnHeartbeat.onclick = startHeartbeatMode;
      const btnLogin = document.getElementById('btn-feature-login');
      if (btnLogin) btnLogin.onclick = showLoginModal;
    } catch (e) {
      el.viewContainer.innerHTML = `
        <div style="padding:60px 20px;text-align:center;color:var(--text-muted)">
          <div style="font-size:32px;margin-bottom:12px">⚠️</div>
          <div style="font-size:15px;color:var(--text-primary);font-weight:600;margin-bottom:8px">加载失败</div>
          <div style="font-size:13px;margin-bottom:20px">${escapeHtml(e.message)}</div>
          <button class="cover-card-play-btn" id="btn-retry-home" style="opacity:1;transform:none;position:static;margin:auto">重试</button>
        </div>
      `;
      const retryBtn = document.getElementById('btn-retry-home');
      if (retryBtn) retryBtn.onclick = renderHomeView;
    }
  }

  // ==========================================================================
  // View 2: Explore View (ExploreView.swift 1:1)
  // ==========================================================================
  const EXPLORE_CATEGORIES = [
    "全部", "推荐歌单", "精品歌单", "排行榜", "华语", "流行", "摇滚", "民谣",
    "电子", "轻音乐", "说唱", "爵士", "古典", "影视原声", "ACG", "古风",
    "怀旧", "治愈", "放松", "伤感", "快乐", "学习", "工作", "运动", "驾车", "夜晚"
  ];

  async function renderExploreView(selectedCat = '全部') {
    let pillsHtml = `
      <div class="category-pills-scroll">
        ${EXPLORE_CATEGORIES.map(cat => `
          <button class="category-pill ${cat === selectedCat ? 'active' : ''}" data-cat="${cat}">${cat}</button>
        `).join('')}
      </div>
      <div id="explore-grid-container" style="min-height:300px">
        <div style="padding:40px 0;text-align:center;color:var(--text-muted)">加载中…</div>
      </div>
    `;

    el.viewContainer.innerHTML = pillsHtml;

    // Attach pill switcher
    el.viewContainer.querySelectorAll('.category-pill').forEach(btn => {
      btn.onclick = () => {
        const cat = btn.getAttribute('data-cat');
        renderExploreView(cat);
      };
    });

    const gridContainer = document.getElementById('explore-grid-container');
    try {
      let playlists = [];
      if (selectedCat === '排行榜') {
        const lists = await NeteaseAPI.toplists();
        playlists = (lists || []).map(t => ({
          id: t.id,
          name: t.name,
          picUrl: t.coverImgUrl,
          playCount: t.playCount,
          copywriter: t.updateFrequency
        }));
      } else if (selectedCat === '推荐歌单') {
        playlists = await NeteaseAPI.personalizedPlaylists(30);
      } else if (selectedCat === '精品歌单') {
        const res = await NeteaseAPI.highQualityPlaylists();
        playlists = (res && res.playlists) || [];
      } else {
        const catParam = selectedCat === '全部' ? '全部' : selectedCat;
        const res = await NeteaseAPI.topPlaylists(catParam, 'hot', 30);
        playlists = (res && res.playlists) || [];
      }

      if (!playlists.length) {
        gridContainer.innerHTML = '<div style="padding:40px 0;text-align:center;color:var(--text-muted)">暂无分类歌单</div>';
        return;
      }

      gridContainer.innerHTML = `
        <div class="cards-grid">
          ${playlists.map(p => `
            <div class="cover-card" data-action="open-playlist" data-id="${p.id}">
              <div class="cover-card-artwork-wrapper">
                <img class="cover-card-img" src="${(p.picUrl || p.coverImgUrl)}?param=300y300" loading="lazy" alt="">
                <div class="cover-card-playcount">▷ ${formatCount(p.playCount)}</div>
                <button class="cover-card-play-btn" data-play-playlist="${p.id}" title="播放歌单">▶</button>
              </div>
              <div class="cover-card-title">${escapeHtml(p.name)}</div>
              <div class="cover-card-subtitle">${escapeHtml(p.copywriter || '')}</div>
            </div>
          `).join('')}
        </div>
      `;
      attachCardEvents();
    } catch (e) {
      gridContainer.innerHTML = `<div style="padding:40px 0;text-align:center;color:var(--text-muted)">加载失败: ${escapeHtml(e.message)}</div>`;
    }
  }

  // ==========================================================================
  // View 3: FM View (FMView.swift 1:1)
  // ==========================================================================
  async function renderFMView() {
    el.viewContainer.innerHTML = '<div style="padding:40px 0;text-align:center;color:var(--text-muted)">正在进入私人漫游…</div>';

    if (!NeteaseClient.isLoggedIn) {
      el.viewContainer.innerHTML = `
        <div style="padding:80px 20px;text-align:center;color:var(--text-muted)">
          <div style="font-size:48px;margin-bottom:16px">📻</div>
          <div style="font-size:16px;color:var(--text-primary);font-weight:600;margin-bottom:8px">私人漫游需要登录</div>
          <div style="font-size:13px;margin-bottom:20px">登录网易云音乐账号后即可享受个性化推荐电台</div>
          <button class="account-card-logout-btn" id="btn-fm-login" style="max-width:160px;margin:auto">立即登录</button>
        </div>
      `;
      const btnLogin = document.getElementById('btn-fm-login');
      if (btnLogin) btnLogin.onclick = showLoginModal;
      return;
    }

    try {
      const fmTracks = await NeteaseAPI.personalFM();
      if (!fmTracks || !fmTracks.length) {
        throw new Error('未获取到 FM 曲目');
      }

      state.queue = fmTracks.map(normalizeTrack);
      state.currentIndex = 0;
      playTrack(state.queue[0]);

      el.viewContainer.innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;padding:40px 20px;text-align:center">
          <div class="fs-artwork-card" style="width:260px;height:260px;margin-bottom:20px">
            <img class="fs-artwork-img" id="fm-view-cover" src="${state.queue[0].picUrl}" alt="">
          </div>
          <div style="font-size:18px;font-weight:700;margin-bottom:6px">${escapeHtml(state.queue[0].name)}</div>
          <div style="font-size:13px;color:var(--text-secondary);margin-bottom:24px">${escapeHtml(state.queue[0].artist)}</div>
          <div style="display:flex;gap:20px;align-items:center">
            <button class="fp-btn-icon" id="btn-fm-trash" title="不喜欢，换一首" style="font-size:20px">🗑️</button>
            <button class="fp-btn-play" id="btn-fm-play" style="width:48px;height:48px;font-size:18px">⏸</button>
            <button class="fp-btn-icon" id="btn-fm-next" title="下一首" style="font-size:20px">⏭</button>
          </div>
        </div>
      `;

      const btnTrash = document.getElementById('btn-fm-trash');
      if (btnTrash) btnTrash.onclick = () => {
        if (state.currentTrack) NeteaseAPI.fmTrash(state.currentTrack.id);
        playNextTrack(true);
      };
      const btnPlay = document.getElementById('btn-fm-play');
      if (btnPlay) btnPlay.onclick = togglePlay;
      const btnNext = document.getElementById('btn-fm-next');
      if (btnNext) btnNext.onclick = () => playNextTrack(true);
    } catch (e) {
      el.viewContainer.innerHTML = `<div style="padding:60px 0;text-align:center;color:var(--text-muted)">加载 FM 失败: ${escapeHtml(e.message)}</div>`;
    }
  }

  // ==========================================================================
  // View 4: Library & Liked Songs
  // ==========================================================================
  async function renderLibraryView() {
    if (!NeteaseClient.isLoggedIn) {
      el.viewContainer.innerHTML = `
        <div style="padding:80px 20px;text-align:center;color:var(--text-muted)">
          <div style="font-size:48px;margin-bottom:16px">❤️</div>
          <div style="font-size:16px;color:var(--text-primary);font-weight:600;margin-bottom:8px">登录后查看我的音乐</div>
          <div style="font-size:13px;margin-bottom:20px">同步歌单、我喜欢的音乐和云盘资产</div>
          <button class="account-card-logout-btn" id="btn-lib-login" style="max-width:160px;margin:auto">立即登录</button>
        </div>
      `;
      const btnLogin = document.getElementById('btn-lib-login');
      if (btnLogin) btnLogin.onclick = showLoginModal;
      return;
    }

    el.viewContainer.innerHTML = '<div style="padding:40px 0;text-align:center;color:var(--text-muted)">正在加载我的音乐库…</div>';

    try {
      const uid = state.user ? state.user.userId : null;
      const playlists = uid ? await NeteaseAPI.userPlaylists(uid) : [];
      const likedPlaylist = playlists.find(p => p.name && (p.name.includes('喜欢的音乐') || p.specialType === 5));

      if (likedPlaylist) {
        renderPlaylistView(likedPlaylist.id);
      } else if (playlists.length) {
        renderPlaylistView(playlists[0].id);
      } else {
        el.viewContainer.innerHTML = '<div style="padding:40px 0;text-align:center;color:var(--text-muted)">暂无歌单</div>';
      }
    } catch (e) {
      el.viewContainer.innerHTML = `<div style="padding:40px 0;text-align:center;color:var(--text-muted)">加载失败: ${escapeHtml(e.message)}</div>`;
    }
  }

  async function openDailyRecommend() {
    if (!NeteaseClient.isLoggedIn) {
      showLoginModal();
      return;
    }
    el.viewContainer.innerHTML = '<div style="padding:40px 0;text-align:center;color:var(--text-muted)">正在生成今日每日推荐…</div>';

    try {
      const tracks = await NeteaseAPI.dailyRecommendSongs();
      if (!tracks || !tracks.length) {
        el.viewContainer.innerHTML = '<div style="padding:40px 0;text-align:center;color:var(--text-muted)">暂无推荐歌曲</div>';
        return;
      }

      el.viewContainer.innerHTML = `
        <div style="margin-bottom:24px">
          <div style="font-size:22px;font-weight:700;color:var(--text-primary);margin-bottom:6px">📅 每日推荐</div>
          <div style="font-size:12.5px;color:var(--text-secondary);margin-bottom:14px">根据你的音乐口味每日 6:00 更新</div>
          <button class="account-card-logout-btn" id="btn-play-all-daily" style="max-width:140px">▶ 播放全部</button>
        </div>
        <div class="track-list">
          ${tracks.map((t, idx) => renderTrackItemHtml(t, idx, tracks)).join('')}
        </div>
      `;
      attachTrackEvents(tracks);

      const btnPlayAll = document.getElementById('btn-play-all-daily');
      if (btnPlayAll) {
        btnPlayAll.onclick = () => {
          state.queue = tracks.map(normalizeTrack);
          state.currentIndex = 0;
          playTrack(state.queue[0]);
        };
      }
    } catch (e) {
      el.viewContainer.innerHTML = `<div style="padding:40px 0;text-align:center;color:var(--text-muted)">加载每日推荐失败: ${escapeHtml(e.message)}</div>`;
    }
  }

  async function renderRecentsView() {
    el.viewContainer.innerHTML = '<div style="padding:40px 0;text-align:center;color:var(--text-muted)">正在加载最近播放…</div>';
    try {
      const tracks = await NeteaseAPI.recordRecentSongs();
      if (!tracks || !tracks.length) {
        el.viewContainer.innerHTML = '<div style="padding:40px 0;text-align:center;color:var(--text-muted)">暂无最近播放记录</div>';
        return;
      }
      el.viewContainer.innerHTML = `
        <div style="margin-bottom:20px;font-size:20px;font-weight:700">🕒 最近播放</div>
        <div class="track-list">
          ${tracks.map((t, idx) => renderTrackItemHtml(t, idx, tracks)).join('')}
        </div>
      `;
      attachTrackEvents(tracks);
    } catch (e) {
      el.viewContainer.innerHTML = `<div style="padding:40px 0;text-align:center;color:var(--text-muted)">加载失败: ${escapeHtml(e.message)}</div>`;
    }
  }

  async function renderCollectionsView() {
    el.viewContainer.innerHTML = '<div style="padding:40px 0;text-align:center;color:var(--text-muted)">正在加载收藏…</div>';
    try {
      const albums = await NeteaseAPI.sublistAlbums();
      if (!albums || !albums.length) {
        el.viewContainer.innerHTML = '<div style="padding:40px 0;text-align:center;color:var(--text-muted)">暂无收藏专辑</div>';
        return;
      }
      el.viewContainer.innerHTML = `
        <div style="margin-bottom:20px;font-size:20px;font-weight:700">⭐ 收藏专辑</div>
        <div class="cards-grid">
          ${albums.map(a => `
            <div class="cover-card" data-action="open-album" data-id="${a.id}">
              <div class="cover-card-artwork-wrapper">
                <img class="cover-card-img" src="${a.picUrl}?param=300y300" loading="lazy" alt="">
              </div>
              <div class="cover-card-title">${escapeHtml(a.name)}</div>
              <div class="cover-card-subtitle">${escapeHtml(a.artists ? a.artists.map(x=>x.name).join('/') : '')}</div>
            </div>
          `).join('')}
        </div>
      `;
      attachCardEvents();
    } catch (e) {
      el.viewContainer.innerHTML = `<div style="padding:40px 0;text-align:center;color:var(--text-muted)">加载失败: ${escapeHtml(e.message)}</div>`;
    }
  }

  async function renderCloudView() {
    el.viewContainer.innerHTML = '<div style="padding:40px 0;text-align:center;color:var(--text-muted)">正在加载音乐云盘…</div>';
    try {
      const res = await NeteaseAPI.userCloud();
      const tracks = (res && res.data) ? res.data.map(item => item.simpleSong) : [];
      if (!tracks.length) {
        el.viewContainer.innerHTML = '<div style="padding:40px 0;text-align:center;color:var(--text-muted)">云盘暂无歌曲</div>';
        return;
      }
      el.viewContainer.innerHTML = `
        <div style="margin-bottom:20px;font-size:20px;font-weight:700">☁️ 音乐云盘</div>
        <div class="track-list">
          ${tracks.map((t, idx) => renderTrackItemHtml(t, idx, tracks)).join('')}
        </div>
      `;
      attachTrackEvents(tracks);
    } catch (e) {
      el.viewContainer.innerHTML = `<div style="padding:40px 0;text-align:center;color:var(--text-muted)">加载失败: ${escapeHtml(e.message)}</div>`;
    }
  }

  // ==========================================================================
  // View 5: Playlist, Album, Artist Detail Views
  // ==========================================================================
  async function renderPlaylistView(playlistId) {
    el.viewContainer.innerHTML = '<div style="padding:40px 0;text-align:center;color:var(--text-muted)">正在加载歌单…</div>';

    try {
      const res = await NeteaseAPI.playlistDetail(playlistId);
      const playlist = res && res.playlist;
      if (!playlist) throw new Error('未找到歌单');

      let tracks = playlist.tracks || [];
      if (tracks.length < (playlist.trackCount || 0) && playlist.trackIds && playlist.trackIds.length) {
        const ids = playlist.trackIds.slice(0, 500).map(t => t.id);
        const details = await NeteaseAPI.songDetails(ids);
        if (details && details.songs) tracks = details.songs;
      }

      el.viewContainer.innerHTML = `
        <div style="display:flex;gap:24px;margin-bottom:32px;align-items:flex-end">
          <img src="${playlist.coverImgUrl}?param=300y300" style="width:160px;height:160px;border-radius:var(--radius-lg);box-shadow:0 8px 24px rgba(0,0,0,0.4)" alt="">
          <div style="display:flex;flex-direction:column;gap:8px">
            <div style="font-size:11.5px;font-weight:600;color:var(--accent);letter-spacing:0.04em">PLAYLIST</div>
            <div style="font-size:24px;font-weight:800;color:#ffffff;line-height:1.2">${escapeHtml(playlist.name)}</div>
            <div style="font-size:12.5px;color:var(--text-secondary)">${escapeHtml(playlist.creator ? playlist.creator.nickname : '')} · ${playlist.trackCount || tracks.length} 首歌曲</div>
            <button class="account-card-logout-btn" id="btn-play-all-playlist" style="max-width:140px;margin-top:6px">▶ 播放全部</button>
          </div>
        </div>
        <div class="track-list">
          ${tracks.map((t, idx) => renderTrackItemHtml(t, idx, tracks)).join('')}
        </div>
      `;

      attachTrackEvents(tracks);
      const btnPlayAll = document.getElementById('btn-play-all-playlist');
      if (btnPlayAll) {
        btnPlayAll.onclick = () => {
          state.queue = tracks.map(normalizeTrack);
          state.currentIndex = 0;
          playTrack(state.queue[0]);
        };
      }
    } catch (e) {
      el.viewContainer.innerHTML = `<div style="padding:40px 0;text-align:center;color:var(--text-muted)">歌单加载失败: ${escapeHtml(e.message)}</div>`;
    }
  }

  async function renderAlbumView(albumId) {
    el.viewContainer.innerHTML = '<div style="padding:40px 0;text-align:center;color:var(--text-muted)">正在加载专辑…</div>';
    try {
      const res = await NeteaseAPI.album(albumId);
      const album = res && res.album;
      const songs = res && res.songs ? res.songs : [];

      el.viewContainer.innerHTML = `
        <div style="display:flex;gap:24px;margin-bottom:32px;align-items:flex-end">
          <img src="${album.picUrl}?param=300y300" style="width:160px;height:160px;border-radius:var(--radius-lg);box-shadow:0 8px 24px rgba(0,0,0,0.4)" alt="">
          <div style="display:flex;flex-direction:column;gap:8px">
            <div style="font-size:11.5px;font-weight:600;color:var(--accent);letter-spacing:0.04em">ALBUM</div>
            <div style="font-size:24px;font-weight:800;color:#ffffff">${escapeHtml(album.name)}</div>
            <div style="font-size:12.5px;color:var(--text-secondary)">${escapeHtml(album.artist ? album.artist.name : '')} · ${songs.length} 首歌曲</div>
            <button class="account-card-logout-btn" id="btn-play-all-album" style="max-width:140px;margin-top:6px">▶ 播放全部</button>
          </div>
        </div>
        <div class="track-list">
          ${songs.map((t, idx) => renderTrackItemHtml(t, idx, songs)).join('')}
        </div>
      `;

      attachTrackEvents(songs);
      const btnPlayAll = document.getElementById('btn-play-all-album');
      if (btnPlayAll) {
        btnPlayAll.onclick = () => {
          state.queue = songs.map(normalizeTrack);
          state.currentIndex = 0;
          playTrack(state.queue[0]);
        };
      }
    } catch (e) {
      el.viewContainer.innerHTML = `<div style="padding:40px 0;text-align:center;color:var(--text-muted)">专辑加载失败: ${escapeHtml(e.message)}</div>`;
    }
  }

  async function renderArtistView(artistId) {
    el.viewContainer.innerHTML = '<div style="padding:40px 0;text-align:center;color:var(--text-muted)">正在加载歌手…</div>';
    try {
      const res = await NeteaseAPI.artist(artistId);
      const artist = res && res.artist;
      const hotSongs = res && res.hotSongs ? res.hotSongs : [];

      el.viewContainer.innerHTML = `
        <div style="display:flex;gap:24px;margin-bottom:32px;align-items:center">
          <img src="${artist.picUrl}?param=300y300" style="width:140px;height:140px;border-radius:50%;object-fit:cover;box-shadow:0 8px 24px rgba(0,0,0,0.4)" alt="">
          <div style="display:flex;flex-direction:column;gap:6px">
            <div style="font-size:24px;font-weight:800;color:#ffffff">${escapeHtml(artist.name)}</div>
            <div style="font-size:12.5px;color:var(--text-secondary)">热门单曲 ${hotSongs.length} 首</div>
          </div>
        </div>
        <div class="track-list">
          ${hotSongs.map((t, idx) => renderTrackItemHtml(t, idx, hotSongs)).join('')}
        </div>
      `;
      attachTrackEvents(hotSongs);
    } catch (e) {
      el.viewContainer.innerHTML = `<div style="padding:40px 0;text-align:center;color:var(--text-muted)">歌手加载失败: ${escapeHtml(e.message)}</div>`;
    }
  }

  // ==========================================================================
  // View 6: Search View (SearchView.swift)
  // ==========================================================================
  async function renderSearchView(params = {}) {
    const keyword = params.keyword || '';
    if (!keyword) {
      el.viewContainer.innerHTML = `
        <div style="padding:60px 20px;text-align:center;color:var(--text-muted)">
          <div style="font-size:36px;margin-bottom:12px">🔍</div>
          <div style="font-size:14px">在上方输入框中搜索音乐、歌手或专辑</div>
        </div>
      `;
      return;
    }

    el.viewContainer.innerHTML = `<div style="padding:40px 0;text-align:center;color:var(--text-muted)">正在搜索 “${escapeHtml(keyword)}”…</div>`;

    try {
      const res = await NeteaseAPI.search(keyword, 1, 30);
      const songs = (res && res.result && res.result.songs) ? res.result.songs : [];

      if (!songs.length) {
        el.viewContainer.innerHTML = `<div style="padding:60px 0;text-align:center;color:var(--text-muted)">未找到与 “${escapeHtml(keyword)}” 相关的歌曲</div>`;
        return;
      }

      el.viewContainer.innerHTML = `
        <div style="margin-bottom:20px;font-size:16px;font-weight:600;color:var(--text-primary)">
          搜索结果：<span style="color:var(--accent)">${escapeHtml(keyword)}</span>
        </div>
        <div class="track-list">
          ${songs.map((t, idx) => renderTrackItemHtml(t, idx, songs)).join('')}
        </div>
      `;
      attachTrackEvents(songs);
    } catch (e) {
      el.viewContainer.innerHTML = `<div style="padding:40px 0;text-align:center;color:var(--text-muted)">搜索失败: ${escapeHtml(e.message)}</div>`;
    }
  }

  // ==========================================================================
  // View 7: Settings View
  // ==========================================================================
  function renderSettingsView() {
    el.viewContainer.innerHTML = `
      <div style="max-width:560px;margin:auto;padding:20px 0">
        <div style="font-size:22px;font-weight:700;margin-bottom:24px">⚙️ 设置</div>
        
        <div style="background:var(--bg-surface);border:1px solid var(--border-subtle);border-radius:var(--radius-lg);padding:18px;margin-bottom:18px">
          <div style="font-size:14px;font-weight:600;margin-bottom:12px">音质设置</div>
          <div style="display:flex;gap:10px">
            <button class="category-pill ${state.quality === 'standard' ? 'active' : ''}" data-quality="standard">标准 128k</button>
            <button class="category-pill ${state.quality === 'exhigh' ? 'active' : ''}" data-quality="exhigh">极高 320k</button>
            <button class="category-pill ${state.quality === 'lossless' ? 'active' : ''}" data-quality="lossless">无损 FLAC</button>
          </div>
        </div>

        <div style="background:var(--bg-surface);border:1px solid var(--border-subtle);border-radius:var(--radius-lg);padding:18px;margin-bottom:18px">
          <div style="font-size:14px;font-weight:600;margin-bottom:4px">Kumone Web</div>
          <div style="font-size:12px;color:var(--text-muted);margin-bottom:12px">版本 0.2.1 · 1:1 macOS 原生对齐版</div>
          <div style="font-size:12px;color:var(--text-secondary);line-height:1.6">
            基于 Cloudflare Workers 边缘计算与标准 Web 技术构建，完全移植自上游 missuo/kumone。
          </div>
        </div>
      </div>
    `;

    el.viewContainer.querySelectorAll('[data-quality]').forEach(btn => {
      btn.onclick = () => {
        state.quality = btn.getAttribute('data-quality');
        showToast('音质已切换为: ' + state.quality);
        renderSettingsView();
      };
    });
  }

  // ==========================================================================
  // Track List Item HTML & Event Binding
  // ==========================================================================
  function renderTrackItemHtml(trackRaw, index, trackList) {
    const t = normalizeTrack(trackRaw);
    const isCurrent = state.currentTrack && state.currentTrack.id === t.id;
    return `
      <div class="track-item ${isCurrent ? 'playing' : ''}" data-track-index="${index}">
        <div class="track-index">${index + 1}</div>
        <img class="track-cover" src="${t.picUrl}?param=80y80" loading="lazy" alt="">
        <div class="track-meta">
          <div class="track-name-row">
            <span class="track-name">${escapeHtml(t.name)}</span>
            ${t.fee === 1 ? '<span class="account-vip-badge">VIP</span>' : ''}
          </div>
          <div class="track-sub">${escapeHtml(t.artist)} · ${escapeHtml(t.album.name)}</div>
        </div>
        <div class="track-right-actions">
          <div class="track-duration">${formatTime(t.duration)}</div>
          <button class="track-btn-more" data-action-menu="${index}" title="更多操作">⋯</button>
        </div>
      </div>
    `;
  }

  function attachTrackEvents(rawTracks) {
    el.viewContainer.querySelectorAll('.track-item').forEach(item => {
      item.onclick = (e) => {
        if (e.target.closest('.track-btn-more')) return;
        const idx = parseInt(item.getAttribute('data-track-index'), 10);
        if (!isNaN(idx) && rawTracks[idx]) {
          state.queue = rawTracks.map(normalizeTrack);
          state.currentIndex = idx;
          playTrack(state.queue[idx]);
        }
      };
    });

    el.viewContainer.querySelectorAll('[data-action-menu]').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.getAttribute('data-action-menu'), 10);
        if (!isNaN(idx) && rawTracks[idx]) {
          openActionSheet(normalizeTrack(rawTracks[idx]));
        }
      };
    });
  }

  function attachCardEvents() {
    el.viewContainer.querySelectorAll('[data-action="open-playlist"]').forEach(card => {
      card.onclick = (e) => {
        if (e.target.closest('[data-play-playlist]')) return;
        const id = card.getAttribute('data-id');
        if (id) navigateTo('playlist', { id });
      };
    });

    el.viewContainer.querySelectorAll('[data-action="open-album"]').forEach(card => {
      card.onclick = () => {
        const id = card.getAttribute('data-id');
        if (id) navigateTo('album', { id });
      };
    });

    el.viewContainer.querySelectorAll('[data-play-playlist]').forEach(btn => {
      btn.onclick = async (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-play-playlist');
        if (id) {
          try {
            const res = await NeteaseAPI.playlistDetail(id);
            if (res && res.playlist && res.playlist.tracks && res.playlist.tracks.length) {
              state.queue = res.playlist.tracks.map(normalizeTrack);
              state.currentIndex = 0;
              playTrack(state.queue[0]);
              showToast('开始播放歌单: ' + res.playlist.name);
            }
          } catch (err) {
            showToast('播放失败: ' + err.message);
          }
        }
      };
    });

    el.viewContainer.querySelectorAll('[data-nav="explore"]').forEach(link => {
      link.onclick = () => navigateTo('explore');
    });
  }

  async function startHeartbeatMode() {
    if (!NeteaseClient.isLoggedIn) {
      showLoginModal();
      return;
    }
    try {
      const uid = state.user ? state.user.userId : null;
      const playlists = uid ? await NeteaseAPI.userPlaylists(uid) : [];
      const liked = playlists.find(p => p.name && (p.name.includes('喜欢的音乐') || p.specialType === 5));
      if (!liked) throw new Error('未找到我喜欢的音乐歌单');

      const detail = await NeteaseAPI.playlistDetail(liked.id);
      const tracks = detail && detail.playlist ? detail.playlist.tracks : [];
      if (!tracks || !tracks.length) throw new Error('先收藏一些喜欢的歌曲吧');

      const seed = tracks[Math.floor(Math.random() * tracks.length)];
      const simi = await NeteaseAPI.simiSongs(seed.id);
      if (simi && simi.length) {
        state.queue = [seed, ...simi].map(normalizeTrack);
        state.currentIndex = 0;
        playTrack(state.queue[0]);
        showToast('已开启心动模式: 从《' + seed.name + '》开始推荐');
      }
    } catch (e) {
      showToast(e.message || '心动模式启动失败');
    }
  }

  // ==========================================================================
  // Action Sheet & Queue Sheet Handlers
  // ==========================================================================
  function openActionSheet(track) {
    if (!track) return;
    state.actionTrack = track;
    if (el.actionSheetCover) el.actionSheetCover.src = track.picUrl || '';
    if (el.actionSheetTitle) el.actionSheetTitle.textContent = track.name;
    if (el.actionSheetArtist) el.actionSheetArtist.textContent = track.artist;
    if (el.actionSheetBackdrop) el.actionSheetBackdrop.classList.add('active');
  }

  function hideActionSheet() {
    if (el.actionSheetBackdrop) el.actionSheetBackdrop.classList.remove('active');
  }

  function showQueueSheet() {
    if (!el.queueSheetBackdrop) return;
    el.queueSheetBackdrop.classList.add('active');
    if (!el.queueListContainer) return;

    if (!state.queue.length) {
      el.queueListContainer.innerHTML = '<div style="padding:30px 0;text-align:center;color:var(--text-muted)">队列暂无歌曲</div>';
      return;
    }

    el.queueListContainer.innerHTML = state.queue.map((t, idx) => `
      <div class="track-item ${state.currentIndex === idx ? 'playing' : ''}" data-queue-idx="${idx}">
        <div class="track-index">${idx + 1}</div>
        <div class="track-meta">
          <div class="track-name">${escapeHtml(t.name)}</div>
          <div class="track-sub">${escapeHtml(t.artist)}</div>
        </div>
      </div>
    `).join('');

    el.queueListContainer.querySelectorAll('.track-item').forEach(item => {
      item.onclick = () => {
        const idx = parseInt(item.getAttribute('data-queue-idx'), 10);
        if (!isNaN(idx) && state.queue[idx]) {
          state.currentIndex = idx;
          playTrack(state.queue[idx]);
          hideQueueSheet();
        }
      };
    });
  }

  function hideQueueSheet() {
    if (el.queueSheetBackdrop) el.queueSheetBackdrop.classList.remove('active');
  }

  // ==========================================================================
  // Account & Profile System (SidebarView.swift 1:1)
  // ==========================================================================
  async function checkAccountStatus() {
    try {
      const status = await NeteaseAPI.loginStatus();
      if (status && status.profile) {
        state.user = status.profile;
        if (status.bindings) {
          const cookie = NeteaseClient.getAuthCookie();
          if (cookie) NeteaseClient.setAuthCookie(cookie);
        }
      }
    } catch (_) {}
    updateAccountUI();
  }

  function updateAccountUI() {
    const isLoggedIn = NeteaseClient.isLoggedIn && state.user;
    const nickname = isLoggedIn ? state.user.nickname : '未登录';
    const avatarUrl = (isLoggedIn && state.user.avatarUrl) ? state.user.avatarUrl : "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%2371717a'%3E%3Cpath d='M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z'/%3E%3C/svg%3E";
    const isVip = isLoggedIn && state.user.vipType > 0;

    if (el.userName) el.userName.textContent = nickname;
    if (el.userAvatar) el.userAvatar.src = avatarUrl;
    if (el.sidebarUserName) el.sidebarUserName.textContent = nickname;
    if (el.sidebarUserAvatar) el.sidebarUserAvatar.src = avatarUrl;
    if (el.sidebarUserVip) el.sidebarUserVip.style.display = isVip ? 'inline-block' : 'none';
    if (el.sidebarUserSub) el.sidebarUserSub.textContent = isLoggedIn ? (state.user.signature || '网易云音乐用户') : '点击登录网易云';

    if (isLoggedIn) {
      loadUserSidebarPlaylists();
    } else {
      if (el.sidebarCreatedSection) el.sidebarCreatedSection.style.display = 'none';
      if (el.sidebarSubscribedSection) el.sidebarSubscribedSection.style.display = 'none';
    }
  }

  async function loadUserSidebarPlaylists() {
    if (!state.user || !state.user.userId) return;
    try {
      const playlists = await NeteaseAPI.userPlaylists(state.user.userId);
      if (!playlists || !playlists.length) return;

      const created = playlists.filter(p => p.creator && p.creator.userId === state.user.userId);
      const subscribed = playlists.filter(p => p.creator && p.creator.userId !== state.user.userId);

      if (created.length && el.sidebarCreatedList && el.sidebarCreatedSection) {
        el.sidebarCreatedSection.style.display = 'block';
        el.sidebarCreatedList.innerHTML = created.map(p => `
          <div class="sidebar-playlist-item" data-id="${p.id}">${escapeHtml(p.name)}</div>
        `).join('');
      }

      if (subscribed.length && el.sidebarSubscribedList && el.sidebarSubscribedSection) {
        el.sidebarSubscribedSection.style.display = 'block';
        el.sidebarSubscribedList.innerHTML = subscribed.map(p => `
          <div class="sidebar-playlist-item" data-id="${p.id}">${escapeHtml(p.name)}</div>
        `).join('');
      }

      document.querySelectorAll('.sidebar-playlist-item').forEach(item => {
        item.onclick = () => {
          const id = item.getAttribute('data-id');
          if (id) navigateTo('playlist', { id });
        };
      });
    } catch (_) {}
  }

  function showAccountCard() {
    if (!state.user) return;
    if (el.accountCardAvatar) el.accountCardAvatar.src = state.user.avatarUrl || '';
    if (el.accountCardNickname) el.accountCardNickname.textContent = state.user.nickname || '';
    if (el.accountCardVip) el.accountCardVip.style.display = (state.user.vipType > 0) ? 'inline-block' : 'none';
    if (el.accountCardSignature) el.accountCardSignature.textContent = state.user.signature || '暂无个性签名';
    if (el.accountCardBackdrop) el.accountCardBackdrop.classList.add('active');
  }

  function hideAccountCard() {
    if (el.accountCardBackdrop) el.accountCardBackdrop.classList.remove('active');
  }

  async function handleLogout() {
    hideAccountCard();
    try {
      await NeteaseAPI.logout();
    } catch (_) {}
    NeteaseClient.setAuthCookie('');
    state.user = null;
    state.likedIds.clear();
    updateAccountUI();
    showToast('已退出登录');
    navigateTo('home');
  }

  // ==========================================================================
  // QR Code Login (LoginSheet.swift 1:1)
  // ==========================================================================
  async function showLoginModal() {
    if (el.loginSheetBackdrop) el.loginSheetBackdrop.classList.add('active');
    startQrLogin();
  }

  function hideLoginModal() {
    if (state.qrPollTimer) {
      clearInterval(state.qrPollTimer);
      state.qrPollTimer = null;
    }
    if (el.loginSheetBackdrop) el.loginSheetBackdrop.classList.remove('active');
  }

  async function startQrLogin() {
    if (state.qrPollTimer) {
      clearInterval(state.qrPollTimer);
      state.qrPollTimer = null;
    }

    if (el.loginQrSpinner) el.loginQrSpinner.style.display = 'block';
    if (el.loginQrImg) el.loginQrImg.style.display = 'none';
    if (el.loginQrOverlay) el.loginQrOverlay.style.display = 'none';
    if (el.loginQrBox) el.loginQrBox.classList.remove('overlay-active');
    if (el.loginQrStatus) el.loginQrStatus.textContent = '正在获取二维码…';

    try {
      const keyRes = await NeteaseAPI.loginQrKey();
      if (!keyRes || !keyRes.unikey) throw new Error('获取扫码凭证失败');
      const unikey = keyRes.unikey;
      state.currentUnikey = unikey;

      const qrUrl = `https://music.163.com/login?codekey=${unikey}`;
      const qrcodeGen = typeof window !== 'undefined' && window.QRCode ? window.QRCode : (typeof require === 'function' ? require('./lib/qrcode.min') : null);

      if (qrcodeGen) {
        qrcodeGen.toDataURL(qrUrl, { width: 180, margin: 1 }, (err, dataUrl) => {
          if (!err && dataUrl && el.loginQrImg) {
            el.loginQrImg.src = dataUrl;
            el.loginQrImg.style.display = 'block';
            if (el.loginQrSpinner) el.loginQrSpinner.style.display = 'none';
          }
        });
      }

      if (el.loginQrStatus) el.loginQrStatus.textContent = '打开网易云音乐 App，扫一扫登录';
      pollQrCode(unikey);
    } catch (e) {
      if (el.loginQrStatus) el.loginQrStatus.textContent = '获取二维码失败: ' + e.message;
      if (el.loginQrSpinner) el.loginQrSpinner.style.display = 'none';
    }
  }

  function pollQrCode(unikey) {
    state.qrPollTimer = setInterval(async () => {
      try {
        const check = await NeteaseAPI.loginQrCheck(unikey);
        if (!check) return;

        if (check.code === 800) {
          clearInterval(state.qrPollTimer);
          state.qrPollTimer = null;
          if (el.loginQrBox) el.loginQrBox.classList.add('overlay-active');
          if (el.loginQrOverlay) {
            el.loginQrOverlay.style.display = 'flex';
            if (el.loginQrOverlayContent) {
              el.loginQrOverlayContent.innerHTML = `
                <div style="font-size:13px;font-weight:600;margin-bottom:8px">二维码已过期</div>
                <button class="account-card-logout-btn" id="btn-refresh-qr" style="padding:4px 12px;font-size:12px">点击刷新</button>
              `;
              const btnRefresh = document.getElementById('btn-refresh-qr');
              if (btnRefresh) btnRefresh.onclick = startQrLogin;
            }
          }
          if (el.loginQrStatus) el.loginQrStatus.textContent = '二维码已过期，请刷新';
        } else if (check.code === 802) {
          if (el.loginQrBox) el.loginQrBox.classList.add('overlay-active');
          if (el.loginQrOverlay) {
            el.loginQrOverlay.style.display = 'flex';
            if (el.loginQrOverlayContent) {
              el.loginQrOverlayContent.innerHTML = `
                <div style="font-size:24px;margin-bottom:4px">📱</div>
                <div style="font-size:13px;font-weight:600">扫描成功</div>
                <div style="font-size:11px;color:var(--text-muted);margin-top:2px">请在手机上点击确认登录</div>
              `;
            }
          }
          if (el.loginQrStatus) el.loginQrStatus.textContent = '扫描成功，请在手机上确认';
        } else if (check.code === 803) {
          clearInterval(state.qrPollTimer);
          state.qrPollTimer = null;
          if (check.cookie) NeteaseClient.setAuthCookie(check.cookie);
          hideLoginModal();
          await checkAccountStatus();
          showToast('欢迎回来，' + (state.user ? state.user.nickname : ''));
          navigateTo('home');
        }
      } catch (_) {}
    }, 2000);
  }

  // ==========================================================================
  // Event Listeners Setup
  // ==========================================================================
  function setupEventListeners() {
    // Brand click -> Home
    if (el.btnBrandHome) el.btnBrandHome.onclick = () => navigateTo('home');
    if (el.btnMobileBrand) el.btnMobileBrand.onclick = () => navigateTo('home');

    // Sidebar navigation clicks
    document.querySelectorAll('.sidebar-nav-item').forEach(item => {
      item.onclick = () => {
        const nav = item.getAttribute('data-nav');
        if (nav) navigateTo(nav);
      };
    });

    // Mobile bottom nav clicks
    document.querySelectorAll('.nav-tab').forEach(tab => {
      tab.onclick = () => {
        const nav = tab.getAttribute('data-tab');
        if (nav) navigateTo(nav);
      };
    });

    // Navigation arrows
    if (el.btnNavBack) el.btnNavBack.onclick = handleNavBack;
    if (el.btnNavForward) el.btnNavForward.onclick = handleNavForward;

    // Top Search Input
    if (el.topSearchInput) {
      el.topSearchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          const kw = el.topSearchInput.value.trim();
          if (kw) navigateTo('search', { keyword: kw });
        }
      });
    }

    // Account Buttons
    if (el.sidebarAccountBtn) {
      el.sidebarAccountBtn.onclick = () => {
        if (NeteaseClient.isLoggedIn) showAccountCard();
        else showLoginModal();
      };
    }
    if (el.btnAccount) {
      el.btnAccount.onclick = () => {
        if (NeteaseClient.isLoggedIn) showAccountCard();
        else showLoginModal();
      };
    }

    // Floating Capsule Player Controls
    if (el.fpArtworkBtn) el.fpArtworkBtn.onclick = openNowPlaying;
    if (el.bpTitle) el.bpTitle.onclick = openNowPlaying;
    if (el.bpArtist) el.bpArtist.onclick = openNowPlaying;
    const fpInfoEl = document.querySelector('.fp-info');
    if (fpInfoEl) fpInfoEl.onclick = openNowPlaying;
    if (el.bpBtnPlay) el.bpBtnPlay.onclick = togglePlay;
    if (el.bpBtnPrev) el.bpBtnPrev.onclick = playPrevTrack;
    if (el.bpBtnNext) el.bpBtnNext.onclick = () => playNextTrack(true);
    if (el.bpBtnLike) el.bpBtnLike.onclick = toggleLikeCurrent;
    if (el.bpBtnRepeat) el.bpBtnRepeat.onclick = cyclePlayMode;
    if (el.bpBtnShuffle) el.bpBtnShuffle.onclick = () => {
      state.playMode = 'shuffle';
      if (el.bpBtnRepeat) el.bpBtnRepeat.textContent = '🔀';
      showToast('已开启随机播放');
    };
    if (el.bpBtnLyrics) el.bpBtnLyrics.onclick = openNowPlaying;
    if (el.bpBtnQueue) el.bpBtnQueue.onclick = showQueueSheet;

    // Volume Slider
    if (el.bpVolumeSlider) {
      el.bpVolumeSlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        if (state.audioElem) state.audioElem.volume = val;
      });
    }

    // Scrubber click seek
    if (el.bpSliderTrack) {
      el.bpSliderTrack.onclick = (e) => {
        const rect = el.bpSliderTrack.getBoundingClientRect();
        const pct = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
        const dur = state.duration || (state.currentTrack ? state.currentTrack.duration : 0) || 1;
        seekAudio(pct * dur * 1000);
      };
    }

    // Fullscreen Player Controls
    if (el.fsBtnClose) el.fsBtnClose.onclick = closeNowPlaying;
    if (el.fsBtnLyricsToggle) el.fsBtnLyricsToggle.onclick = () => {
      // Toggle between layout views
      showToast('歌词排版已同步');
    };

    // Action Sheet & Queue Sheet Backdrops
    if (el.actionSheetBackdrop) {
      el.actionSheetBackdrop.onclick = (e) => {
        if (e.target === el.actionSheetBackdrop) hideActionSheet();
      };
    }
    if (el.btnCancelAction) el.btnCancelAction.onclick = hideActionSheet;

    if (el.actionPlayNext) {
      el.actionPlayNext.onclick = () => {
        if (state.actionTrack) {
          state.playNextQueue.unshift(state.actionTrack);
          showToast('已添加到下一首播放');
          hideActionSheet();
        }
      };
    }
    if (el.actionLike) {
      el.actionLike.onclick = () => {
        if (state.actionTrack) {
          const id = state.actionTrack.id;
          toggleLikeTrack(id, !state.likedIds.has(id));
          hideActionSheet();
        }
      };
    }
    if (el.actionAlbum) {
      el.actionAlbum.onclick = () => {
        if (state.actionTrack && state.actionTrack.album && state.actionTrack.album.id) {
          hideActionSheet();
          navigateTo('album', { id: state.actionTrack.album.id });
        }
      };
    }
    if (el.actionArtist) {
      el.actionArtist.onclick = () => {
        if (state.actionTrack && state.actionTrack.artists && state.actionTrack.artists[0]) {
          hideActionSheet();
          navigateTo('artist', { id: state.actionTrack.artists[0].id });
        }
      };
    }
    if (el.actionCopyLink) {
      el.actionCopyLink.onclick = () => {
        if (state.actionTrack) {
          const url = `https://music.163.com/song?id=${state.actionTrack.id}`;
          if (navigator.clipboard) navigator.clipboard.writeText(url);
          showToast('已复制歌曲链接');
          hideActionSheet();
        }
      };
    }

    if (el.queueSheetBackdrop) {
      el.queueSheetBackdrop.onclick = (e) => {
        if (e.target === el.queueSheetBackdrop) hideQueueSheet();
      };
    }
    if (el.btnClearQueue) {
      el.btnClearQueue.onclick = () => {
        state.queue = [];
        state.playNextQueue = [];
        showQueueSheet();
        showToast('已清空播放队列');
      };
    }
    if (el.btnCloseQueue) el.btnCloseQueue.onclick = hideQueueSheet;

    // Login & Account Modals
    if (el.loginSheetBackdrop) {
      el.loginSheetBackdrop.onclick = (e) => {
        if (e.target === el.loginSheetBackdrop) hideLoginModal();
      };
    }
    if (el.btnCloseLogin) el.btnCloseLogin.onclick = hideLoginModal;

    if (el.accountCardBackdrop) {
      el.accountCardBackdrop.onclick = (e) => {
        if (e.target === el.accountCardBackdrop) hideAccountCard();
      };
    }
    if (el.btnCloseAccountCard) el.btnCloseAccountCard.onclick = hideAccountCard;
    if (el.btnAccountLogout) el.btnAccountLogout.onclick = handleLogout;
  }

  async function init() {
    initElements();
    setupEventListeners();
    await checkAccountStatus();
    navigateTo('home');
  }

  window.kumoneApp = {
    onNativePlaybackProgress,
    onNativePlaybackComplete,
    onNativeNext,
    onNativePrev,
    navigateTo,
    playTrack,
  };

  document.addEventListener('DOMContentLoaded', init);
})();
