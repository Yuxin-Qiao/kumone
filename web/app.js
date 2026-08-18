// Kumone for Android — Main Application Logic
'use strict';

(function () {
  const NeteaseAPI = (typeof window !== 'undefined' && window.NeteaseAPI)
    ? window.NeteaseAPI
    : (typeof require === 'function' ? require('./lib/api') : null);
  const NeteaseClient = (typeof window !== 'undefined' && window.NeteaseClient)
    ? window.NeteaseClient
    : (typeof require === 'function' ? require('./lib/client') : null);
  const NeteaseCrypto = (typeof window !== 'undefined' && window.NeteaseCrypto)
    ? window.NeteaseCrypto
    : (typeof require === 'function' ? require('./lib/crypto') : null);
  const Unblock = (typeof window !== 'undefined' && window.Unblock)
    ? window.Unblock
    : (typeof require === 'function' ? require('./lib/unblock') : null);

  const state = {
    user: null,
    likedIds: new Set(),
    queue: [],
    playNextQueue: [],
    historyQueue: [],
    currentTrack: null,
    currentIndex: -1,
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    playMode: 'loop',
    quality: 'lossless',
    unblockEnabled: true,
    lyrics: [],
    activeLyricIndex: -1,
    currentView: 'home',
    viewHistory: [],
    searchKeyword: '',
    searchType: 1,
    actionTrack: null,
    qrPollTimer: null,
    currentUnikey: null,
    captchaCountdown: 0,
    captchaTimer: null,
    activeLoginTab: 'phone',
    isLyricsViewActive: false,
    audioElem: null,
  };

  const el = {};

  function initElements() {
    el.viewContainer = document.getElementById('view-container');
    el.mainScroll = document.getElementById('main-scroll-view');
    el.userAvatar = document.getElementById('user-avatar');
    el.userName = document.getElementById('user-name');
    el.btnAccount = document.getElementById('btn-account');
    el.btnBrandHome = document.getElementById('btn-brand-home');

    el.bpProgressFill = document.getElementById('bp-progress-fill');
    el.bpCover = document.getElementById('bp-cover');
    el.bpTitle = document.getElementById('bp-title');
    el.bpArtist = document.getElementById('bp-artist');
    el.bpInfoArea = document.getElementById('bp-info-area');
    el.bpBtnPlay = document.getElementById('bp-btn-play');
    el.bpBtnNext = document.getElementById('bp-btn-next');
    el.bpBtnLike = document.getElementById('bp-btn-like');
    el.bottomPlayerBar = document.getElementById('bottom-player-bar');

    el.fullscreenPlayer = document.getElementById('fullscreen-player');
    el.fsBackdrop = document.getElementById('fs-backdrop');
    el.fsCover = document.getElementById('fs-cover');
    el.fsTitle = document.getElementById('fs-title');
    el.fsArtist = document.getElementById('fs-artist');
    el.fsBtnClose = document.getElementById('fs-btn-close');
    el.fsBtnLyricsToggle = document.getElementById('fs-btn-lyrics-toggle');
    el.fsArtworkView = document.getElementById('fs-artwork-view');
    el.fsLyricsView = document.getElementById('fs-lyrics-view');
    el.fsLyricsContent = document.getElementById('fs-lyrics-content');
    el.fsSeekSlider = document.getElementById('fs-seek-slider');
    el.fsTimeCur = document.getElementById('fs-time-cur');
    el.fsTimeDur = document.getElementById('fs-time-dur');
    el.fsBtnMode = document.getElementById('fs-btn-mode');
    el.fsBtnPrev = document.getElementById('fs-btn-prev');
    el.fsBtnPlay = document.getElementById('fs-btn-play');
    el.fsBtnNext = document.getElementById('fs-btn-next');
    el.fsBtnLike = document.getElementById('fs-btn-like');
    el.fsQualityBadge = document.getElementById('fs-quality-badge');
    el.fsBtnQueue = document.getElementById('fs-btn-queue');

    el.queueSheetBackdrop = document.getElementById('queue-sheet-backdrop');
    el.queueCount = document.getElementById('queue-count');
    el.queueTrackList = document.getElementById('queue-track-list');
    el.btnClearQueue = document.getElementById('btn-clear-queue');

    el.actionSheetBackdrop = document.getElementById('action-sheet-backdrop');
    el.actionTrackTitle = document.getElementById('action-track-title');
    el.actionPlayNext = document.getElementById('action-play-next');
    el.actionLike = document.getElementById('action-like');
    el.actionAlbum = document.getElementById('action-album');
    el.actionArtist = document.getElementById('action-artist');
    el.actionSimi = document.getElementById('action-simi');
    el.actionCopyLink = document.getElementById('action-copy-link');

    el.loginSheetBackdrop = document.getElementById('login-sheet-backdrop');
    el.loginQrImg = document.getElementById('login-qr-img');
    el.loginQrStatus = document.getElementById('login-qr-status');
    el.btnRefreshQr = document.getElementById('btn-refresh-qr');
    el.btnCloseLogin = document.getElementById('btn-close-login');
    el.btnJumpNeteaseApp = document.getElementById('btn-jump-netease-app');

    el.loginTabs = document.querySelectorAll('.login-tab-btn');
    el.inputLoginPhone = document.getElementById('input-login-phone');
    el.inputLoginCaptcha = document.getElementById('input-login-captcha');
    el.inputLoginPassword = document.getElementById('input-login-password');
    el.inputLoginCookie = document.getElementById('input-login-cookie');
    el.btnSendCaptcha = document.getElementById('btn-send-captcha');
    el.btnSubmitPhoneLogin = document.getElementById('btn-submit-phone-login');
    el.btnSubmitCookieLogin = document.getElementById('btn-submit-cookie-login');
    el.rowLoginCaptcha = document.getElementById('row-login-captcha');
    el.rowLoginPassword = document.getElementById('row-login-password');

    el.bottomNav = document.getElementById('bottom-nav');
    el.toastContainer = document.getElementById('toast-container');
  }

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

  function showToast(msg) {
    if (window.AndroidBridge && typeof window.AndroidBridge.toast === 'function') {
      window.AndroidBridge.toast(msg);
      return;
    }
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
    const picUrl = album.picUrl || raw.picUrl || (album.id ? `https://p1.music.126.net/6y-UleORITEDbvlOLx0DEg==/${album.pic || 0}.jpg` : '');

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

  function playAudio(url, track, startPosMs = 0) {
    state.isPlaying = true;
    updatePlayPauseButtons();

    if (window.AndroidBridge && typeof window.AndroidBridge.playAudio === 'function') {
      window.AndroidBridge.playAudio(url, JSON.stringify(track), startPosMs);
    } else {
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
      state.audioElem.play().catch(() => {});
    }
  }

  function pauseAudio() {
    state.isPlaying = false;
    updatePlayPauseButtons();
    if (window.AndroidBridge && typeof window.AndroidBridge.pauseAudio === 'function') {
      window.AndroidBridge.pauseAudio();
    } else if (state.audioElem) {
      state.audioElem.pause();
    }
  }

  function resumeAudio() {
    state.isPlaying = true;
    updatePlayPauseButtons();
    if (window.AndroidBridge && typeof window.AndroidBridge.resumeAudio === 'function') {
      window.AndroidBridge.resumeAudio();
    } else if (state.audioElem) {
      state.audioElem.play().catch(() => {});
    }
  }

  function seekAudio(posMs) {
    state.currentTime = Math.floor(posMs / 1000);
    if (window.AndroidBridge && typeof window.AndroidBridge.seekAudio === 'function') {
      window.AndroidBridge.seekAudio(posMs);
    } else if (state.audioElem) {
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
    el.bpBtnPlay.textContent = icon;
    el.fsBtnPlay.textContent = icon;
  }

  function updateProgressUI() {
    const cur = state.currentTime;
    const dur = state.duration || (state.currentTrack ? state.currentTrack.duration : 0) || 1;
    const pct = Math.min(100, Math.max(0, (cur / dur) * 100));

    el.bpProgressFill.style.width = `${pct}%`;
    el.fsSeekSlider.value = Math.floor((cur / dur) * 1000);
    el.fsTimeCur.textContent = formatTime(cur);
    el.fsTimeDur.textContent = formatTime(dur);
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

      try {
        const urls = await NeteaseAPI.songURL([normalized.id], state.quality);
        if (urls && urls[0] && urls[0].url) {
          playUrl = urls[0].url;
          servedSource = urls[0].level || state.quality;
        }
      } catch (_) {}

      if (!playUrl && state.unblockEnabled) {
        showToast('正在尝试第三方音源匹配…');
        const unblockRes = await Unblock.resolve(normalized);
        if (unblockRes && unblockRes.url) {
          playUrl = unblockRes.url;
          servedSource = unblockRes.source || '解锁音源';
        }
      }

      if (!playUrl) {
        showToast('该歌曲暂无可用播放链接');
        setTimeout(() => playNextTrack(false), 1500);
        return;
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
    el.bpBtnLike.textContent = text;
    el.fsBtnLike.textContent = text;
    if (isLiked) {
      el.bpBtnLike.classList.add('liked');
      el.fsBtnLike.classList.add('liked');
    } else {
      el.bpBtnLike.classList.remove('liked');
      el.fsBtnLike.classList.remove('liked');
    }
  }

  function updateNowPlayingUI(track) {
    const coverUrl = track.picUrl || '';
    el.bpCover.src = coverUrl;
    el.bpTitle.textContent = track.name;
    el.bpArtist.textContent = track.artist;

    el.fsCover.src = coverUrl;
    el.fsTitle.textContent = track.name;
    el.fsArtist.textContent = track.artist;
    if (coverUrl) {
      el.fsBackdrop.style.backgroundImage = `url('${coverUrl}')`;
    }

    updateLikeButtons();
    updateQualityBadge(track.servedSource);
  }

  function updateQualityBadge(source) {
    let text = '标准音质';
    if (source === 'lossless') text = '无损 FLAC';
    else if (source === 'hires') text = 'Hi-Res';
    else if (source === 'exhigh') text = '极高 320k';
    else if (source === 'higher') text = '较高 192k';
    else if (source) text = source;
    el.fsQualityBadge.textContent = text;
  }

  function togglePlayMode() {
    if (state.playMode === 'loop') {
      state.playMode = 'one';
      el.fsBtnMode.textContent = '🔂';
      showToast('单曲循环');
    } else if (state.playMode === 'one') {
      state.playMode = 'shuffle';
      el.fsBtnMode.textContent = '🔀';
      showToast('随机播放');
    } else {
      state.playMode = 'loop';
      el.fsBtnMode.textContent = '🔁';
      showToast('列表循环');
    }
  }

  async function loadLyrics(songId) {
    state.lyrics = [];
    state.activeLyricIndex = -1;
    el.fsLyricsContent.innerHTML = '<div class="lyric-line">歌词加载中…</div>';

    try {
      const data = await NeteaseAPI.lyric(songId);
      if (!data || !data.lrc || !data.lrc.lyric) {
        state.lyrics = [{ time: 0, text: '纯音乐，无歌词' }];
        renderLyrics();
        return;
      }
      state.lyrics = parseLRC(data.lrc.lyric, (data.tlyric && data.tlyric.lyric) || '', (data.romalrc && data.romalrc.lyric) || '');
      renderLyrics();
    } catch (_) {
      state.lyrics = [{ time: 0, text: '歌词加载失败' }];
      renderLyrics();
    }
  }

  function parseLRC(lrcStr, transStr, romaStr) {
    const timeReg = /\[(\d{2}):(\d{2})(?:\.(\d{2,3}))?\]/g;

    function parseText(str) {
      const map = new Map();
      const lines = str.split('\n');
      for (const line of lines) {
        let match;
        timeReg.lastIndex = 0;
        const times = [];
        while ((match = timeReg.exec(line)) !== null) {
          const m = parseInt(match[1], 10);
          const s = parseInt(match[2], 10);
          const ms = match[3] ? parseInt(match[3].padEnd(3, '0').slice(0, 3), 10) : 0;
          times.push(m * 60000 + s * 1000 + ms);
        }
        const text = line.replace(timeReg, '').trim();
        if (text) {
          for (const t of times) map.set(t, text);
        }
      }
      return map;
    }

    const mainMap = parseText(lrcStr);
    const transMap = parseText(transStr);
    const romaMap = parseText(romaStr);

    const sortedTimes = Array.from(mainMap.keys()).sort((a, b) => a - b);
    return sortedTimes.map((time) => ({
      time,
      text: mainMap.get(time) || '',
      trans: transMap.get(time) || '',
      roma: romaMap.get(time) || '',
    }));
  }

  function renderLyrics() {
    if (!state.lyrics.length) {
      el.fsLyricsContent.innerHTML = '<div class="lyric-line">暂无歌词</div>';
      return;
    }
    const html = state.lyrics.map((item, idx) => `
      <div class="lyric-line" data-idx="${idx}" data-time="${item.time}">
        <div>${escapeHtml(item.text)}</div>
        ${item.trans ? `<div class="lyric-trans">${escapeHtml(item.trans)}</div>` : ''}
        ${item.roma ? `<div class="lyric-trans" style="opacity:0.8">${escapeHtml(item.roma)}</div>` : ''}
      </div>
    `).join('');
    el.fsLyricsContent.innerHTML = html;
  }

  function updateActiveLyric(posMs) {
    if (!state.lyrics.length) return;
    let idx = state.lyrics.findIndex((l, i) => {
      const next = state.lyrics[i + 1];
      return posMs >= l.time && (!next || posMs < next.time);
    });

    if (idx === -1 && posMs < state.lyrics[0].time) idx = 0;

    if (idx !== -1 && idx !== state.activeLyricIndex) {
      state.activeLyricIndex = idx;
      const lines = el.fsLyricsContent.querySelectorAll('.lyric-line');
      lines.forEach((l, i) => {
        if (i === idx) {
          l.classList.add('active');
          if (state.isLyricsViewActive) {
            l.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        } else {
          l.classList.remove('active');
        }
      });
    }
  }

  function toggleLyricsView() {
    state.isLyricsViewActive = !state.isLyricsViewActive;
    if (state.isLyricsViewActive) {
      el.fsArtworkView.style.display = 'none';
      el.fsLyricsView.classList.add('active');
      el.fsBtnLyricsToggle.style.color = 'var(--primary)';
    } else {
      el.fsArtworkView.style.display = 'block';
      el.fsLyricsView.classList.remove('active');
      el.fsBtnLyricsToggle.style.color = 'var(--text-secondary)';
    }
  }

  function navigateTo(viewName, params = {}, pushHistory = true) {
    if (pushHistory && state.currentView !== viewName) {
      state.viewHistory.push({ view: state.currentView, params });
    }
    state.currentView = viewName;
    updateNavTabs(viewName);
    el.mainScroll.scrollTop = 0;

    switch (viewName) {
      case 'home': renderHomeView(); break;
      case 'search': renderSearchView(params); break;
      case 'fm': renderFMView(); break;
      case 'library': renderLibraryView(); break;
      case 'settings': renderSettingsView(); break;
      case 'playlist': renderPlaylistView(params.id); break;
      case 'album': renderAlbumView(params.id); break;
      case 'artist': renderArtistView(params.id); break;
      case 'simi': renderSimiView(params.id); break;
      default: renderHomeView(); break;
    }
  }

  function updateNavTabs(viewName) {
    const tabs = el.bottomNav.querySelectorAll('.nav-tab');
    tabs.forEach((tab) => {
      if (tab.dataset.tab === viewName) tab.classList.add('active');
      else tab.classList.remove('active');
    });
  }

  async function renderHomeView() {
    el.viewContainer.innerHTML = '<div style="padding:40px 0;text-align:center;color:var(--text-muted)">正在加载发现内容…</div>';

    try {
      const [recRes, topRes, albumRes, songRes] = await Promise.allSettled([
        NeteaseAPI.personalizedPlaylists(10),
        NeteaseAPI.toplists(),
        NeteaseAPI.newAlbums('ALL', 8),
        NeteaseAPI.personalizedNewSongs(8),
      ]);

      const recPlaylists = recRes.status === 'fulfilled' && Array.isArray(recRes.value) ? recRes.value : [];
      const toplists = topRes.status === 'fulfilled' && Array.isArray(topRes.value) ? topRes.value : [];
      const newAlbums = albumRes.status === 'fulfilled' && Array.isArray(albumRes.value) ? albumRes.value : [];
      const newSongs = songRes.status === 'fulfilled' && Array.isArray(songRes.value) ? songRes.value : [];

      if (!recPlaylists.length && !toplists.length && !newAlbums.length && !newSongs.length) {
        const errorMsg = (recRes.reason && recRes.reason.message) || (topRes.reason && topRes.reason.message) || '网络连接异常，请检查网络设置';
        el.viewContainer.innerHTML = `
          <div style="padding:60px 20px;text-align:center;color:var(--text-muted)">
            <div style="font-size:32px;margin-bottom:12px">📡</div>
            <div style="font-size:15px;color:var(--text);font-weight:600;margin-bottom:8px">加载发现内容失败</div>
            <div style="font-size:13px;margin-bottom:20px">${escapeHtml(errorMsg)}</div>
            <button class="btn btn-primary" id="btn-retry-home" style="padding:8px 24px;border-radius:20px">重新加载</button>
          </div>
        `;
        const retryBtn = document.getElementById('btn-retry-home');
        if (retryBtn) retryBtn.onclick = renderHomeView;
        return;
      }

      let html = `
        <div class="hero-banners">
          <div class="hero-card" id="btn-hero-daily">
            <div class="hero-icon">📅</div>
            <div class="hero-label">每日推荐</div>
          </div>
          <div class="hero-card" id="btn-hero-fm">
            <div class="hero-icon">📻</div>
            <div class="hero-label">私人 FM</div>
          </div>
          <div class="hero-card" id="btn-hero-heartbeat">
            <div class="hero-icon">💓</div>
            <div class="hero-label">心动模式</div>
          </div>
        </div>
      `;

      if (recPlaylists && recPlaylists.length) {
        html += `
          <div class="section-header">
            <div class="section-title">推荐歌单</div>
          </div>
          <div class="horizontal-scroll-list">
            ${recPlaylists.map((p) => `
              <div class="media-card" data-action="open-playlist" data-id="${p.id}">
                <div class="card-cover-wrapper">
                  <img class="card-cover-img" src="${p.picUrl}?param=240y240" loading="lazy" alt="">
                  <div class="card-play-count">▶ ${formatCount(p.playCount)}</div>
                </div>
                <div class="card-title">${escapeHtml(p.name)}</div>
              </div>
            `).join('')}
          </div>
        `;
      }

      if (newSongs && newSongs.length) {
        html += `
          <div class="section-header">
            <div class="section-title">最新音乐</div>
          </div>
          <div class="track-list">
            ${newSongs.map((s, idx) => renderTrackItemHtml(s, idx, newSongs)).join('')}
          </div>
        `;
      }

      if (newAlbums && newAlbums.length) {
        html += `
          <div class="section-header">
            <div class="section-title">新碟上架</div>
          </div>
          <div class="horizontal-scroll-list">
            ${newAlbums.map((a) => `
              <div class="media-card" data-action="open-album" data-id="${a.id}">
                <div class="card-cover-wrapper">
                  <img class="card-cover-img" src="${a.picUrl}?param=240y240" loading="lazy" alt="">
                </div>
                <div class="card-title">${escapeHtml(a.name)}</div>
                <div class="card-subtitle">${escapeHtml(a.artist ? a.artist.name : '')}</div>
              </div>
            `).join('')}
          </div>
        `;
      }

      if (toplists && toplists.length) {
        html += `
          <div class="section-header">
            <div class="section-title">排行榜</div>
          </div>
          <div class="media-grid">
            ${toplists.slice(0, 6).map((t) => `
              <div class="media-card" style="width:100%" data-action="open-playlist" data-id="${t.id}">
                <div class="card-cover-wrapper" style="width:100%;height:auto;aspect-ratio:1">
                  <img class="card-cover-img" src="${t.coverImgUrl}?param=300y300" loading="lazy" alt="">
                  <div class="card-play-count">▶ ${formatCount(t.playCount)}</div>
                </div>
                <div class="card-title">${escapeHtml(t.name)}</div>
              </div>
            `).join('')}
          </div>
        `;
      }

      el.viewContainer.innerHTML = html;
      if (newSongs && newSongs.length) attachTrackEvents(newSongs);
      attachCardEvents();

      const heroDaily = document.getElementById('btn-hero-daily');
      if (heroDaily) heroDaily.onclick = openDailyRecommend;
      const heroFm = document.getElementById('btn-hero-fm');
      if (heroFm) heroFm.onclick = () => navigateTo('fm');
      const heroHeartbeat = document.getElementById('btn-hero-heartbeat');
      if (heroHeartbeat) heroHeartbeat.onclick = startHeartbeatMode;
    } catch (e) {
      el.viewContainer.innerHTML = `
        <div style="padding:60px 20px;text-align:center;color:var(--text-muted)">
          <div style="font-size:32px;margin-bottom:12px">⚠️</div>
          <div style="font-size:15px;color:var(--text);font-weight:600;margin-bottom:8px">加载失败</div>
          <div style="font-size:13px;margin-bottom:20px">${escapeHtml(e.message)}</div>
          <button class="btn btn-primary" id="btn-retry-home" style="padding:8px 24px;border-radius:20px">重新加载</button>
        </div>
      `;
      const retryBtn = document.getElementById('btn-retry-home');
      if (retryBtn) retryBtn.onclick = renderHomeView;
    }
  }

  async function openDailyRecommend() {
    if (!NeteaseAPI.getClient().isLoggedIn) {
      showLoginModal();
      return;
    }
    try {
      showToast('正在加载每日推荐…');
      const songs = await NeteaseAPI.dailyRecommendSongs();
      if (songs && songs.length) {
        state.queue = songs.map(normalizeTrack);
        state.currentIndex = 0;
        playTrack(state.queue[0]);
        showToast(`已加载 ${songs.length} 首每日推荐歌曲`);
      } else {
        showToast('暂无每日推荐');
      }
    } catch (e) {
      showToast(e.message || '加载每日推荐失败');
    }
  }

  async function startHeartbeatMode() {
    if (!state.currentTrack) {
      showToast('请先播放一首种子歌曲');
      return;
    }
    try {
      showToast('正在进入心动模式…');
      const songs = await NeteaseAPI.intelligenceList(state.currentTrack.id, 0);
      if (songs && songs.length) {
        state.queue = [state.currentTrack, ...songs.map(normalizeTrack)];
        state.currentIndex = 0;
        showToast(`心动模式已开启，推荐 ${songs.length} 首相似歌曲`);
      }
    } catch (e) {
      showToast(e.message || '开启心动模式失败');
    }
  }

  async function renderSearchView(params = {}) {
    let defKeyword = '搜索歌曲、歌手、专辑、歌单';
    try {
      const def = await NeteaseAPI.searchDefaultKeyword();
      if (def) defKeyword = def;
    } catch (_) {}

    el.viewContainer.innerHTML = `
      <div class="search-input-wrapper">
        <span class="search-icon-pos">🔍</span>
        <input type="text" class="search-input" id="search-keyword-input" placeholder="${escapeHtml(defKeyword)}" value="${escapeHtml(state.searchKeyword)}">
      </div>
      <div class="search-tabs">
        <div class="search-tab-pill ${state.searchType === 1 ? 'active' : ''}" data-type="1">单曲</div>
        <div class="search-tab-pill ${state.searchType === 1000 ? 'active' : ''}" data-type="1000">歌单</div>
        <div class="search-tab-pill ${state.searchType === 10 ? 'active' : ''}" data-type="10">专辑</div>
        <div class="search-tab-pill ${state.searchType === 100 ? 'active' : ''}" data-type="100">歌手</div>
      </div>
      <div id="search-results-container">
        <div style="text-align:center;padding:40px 0;color:var(--text-muted)">输入关键词并按回车搜索</div>
      </div>
    `;

    const input = document.getElementById('search-keyword-input');
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const kw = input.value.trim() || defKeyword;
        state.searchKeyword = kw;
        performSearch(kw, state.searchType);
      }
    });

    const tabs = el.viewContainer.querySelectorAll('.search-tab-pill');
    tabs.forEach((tab) => {
      tab.onclick = () => {
        tabs.forEach((t) => t.classList.remove('active'));
        tab.classList.add('active');
        state.searchType = parseInt(tab.dataset.type, 10);
        if (state.searchKeyword) {
          performSearch(state.searchKeyword, state.searchType);
        }
      };
    });

    if (state.searchKeyword) {
      performSearch(state.searchKeyword, state.searchType);
    }
  }

  async function performSearch(kw, type) {
    const resContainer = document.getElementById('search-results-container');
    if (!resContainer) return;
    resContainer.innerHTML = '<div style="text-align:center;padding:30px 0;color:var(--text-muted)">正在搜索…</div>';

    try {
      const res = await NeteaseAPI.search(kw, type, 30);
      if (type === 1) {
        const songs = res.songs || [];
        if (!songs.length) {
          resContainer.innerHTML = '<div style="text-align:center;padding:30px 0;color:var(--text-muted)">无匹配单曲</div>';
          return;
        }
        resContainer.innerHTML = `<div class="track-list">${songs.map((s, i) => renderTrackItemHtml(s, i, songs)).join('')}</div>`;
        attachTrackEvents(songs);
      } else if (type === 1000) {
        const playlists = res.playlists || [];
        resContainer.innerHTML = `
          <div class="media-grid">
            ${playlists.map((p) => `
              <div class="media-card" style="width:100%" data-action="open-playlist" data-id="${p.id}">
                <div class="card-cover-wrapper" style="width:100%;height:auto;aspect-ratio:1">
                  <img class="card-cover-img" src="${p.coverImgUrl}?param=300y300" loading="lazy" alt="">
                </div>
                <div class="card-title">${escapeHtml(p.name)}</div>
              </div>
            `).join('')}
          </div>
        `;
        attachCardEvents();
      } else if (type === 10) {
        const albums = res.albums || [];
        resContainer.innerHTML = `
          <div class="media-grid">
            ${albums.map((a) => `
              <div class="media-card" style="width:100%" data-action="open-album" data-id="${a.id}">
                <div class="card-cover-wrapper" style="width:100%;height:auto;aspect-ratio:1">
                  <img class="card-cover-img" src="${a.picUrl}?param=300y300" loading="lazy" alt="">
                </div>
                <div class="card-title">${escapeHtml(a.name)}</div>
              </div>
            `).join('')}
          </div>
        `;
        attachCardEvents();
      } else if (type === 100) {
        const artists = res.artists || [];
        resContainer.innerHTML = `
          <div class="media-grid">
            ${artists.map((ar) => `
              <div class="media-card" style="width:100%" data-action="open-artist" data-id="${ar.id}">
                <div class="card-cover-wrapper" style="width:100%;height:auto;aspect-ratio:1;border-radius:50%">
                  <img class="card-cover-img" src="${ar.picUrl || ar.img1v1Url}?param=300y300" loading="lazy" alt="">
                </div>
                <div class="card-title" style="text-align:center">${escapeHtml(ar.name)}</div>
              </div>
            `).join('')}
          </div>
        `;
        attachCardEvents();
      }
    } catch (e) {
      resContainer.innerHTML = `<div style="text-align:center;padding:30px 0;color:var(--text-muted)">搜索失败: ${escapeHtml(e.message)}</div>`;
    }
  }

  async function renderFMView() {
    el.viewContainer.innerHTML = '<div style="text-align:center;padding:40px 0;color:var(--text-muted)">正在加载私人 FM…</div>';

    try {
      const fms = await NeteaseAPI.personalFM();
      if (!fms || !fms.length) {
        el.viewContainer.innerHTML = '<div style="text-align:center;padding:40px 0;color:var(--text-muted)">私人 FM 暂无歌曲</div>';
        return;
      }
      const track = normalizeTrack(fms[0]);
      el.viewContainer.innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;padding:20px 0;">
          <div class="fs-artwork-container" style="margin-bottom:20px">
            <img class="fs-artwork-img" src="${track.picUrl}?param=400y400" alt="">
          </div>
          <div style="font-size:18px;font-weight:700;margin-bottom:6px">${escapeHtml(track.name)}</div>
          <div style="font-size:14px;color:var(--text-secondary);margin-bottom:24px">${escapeHtml(track.artist)}</div>
          <div style="display:flex;gap:20px;align-items:center">
            <button class="bp-btn" id="btn-fm-trash" style="font-size:22px;background:var(--bg-surface);width:48px;height:48px;border-radius:50%" title="不喜欢">🗑</button>
            <button class="bp-btn bp-btn-play" id="btn-fm-play" style="width:60px;height:60px;font-size:24px">▶</button>
            <button class="bp-btn" id="btn-fm-next" style="font-size:24px;background:var(--bg-surface);width:48px;height:48px;border-radius:50%" title="下一首">⏭</button>
          </div>
        </div>
      `;

      document.getElementById('btn-fm-play').onclick = () => playTrack(track, fms);
      document.getElementById('btn-fm-next').onclick = renderFMView;
      document.getElementById('btn-fm-trash').onclick = async () => {
        try {
          await NeteaseAPI.fmTrash(track.id);
          showToast('已移入垃圾桶，将减少推荐');
          renderFMView();
        } catch (e) {
          showToast(e.message || '操作失败');
        }
      };
    } catch (e) {
      el.viewContainer.innerHTML = `<div style="text-align:center;padding:40px 0;color:var(--text-muted)">加载私人 FM 失败: ${escapeHtml(e.message)}</div>`;
    }
  }

  async function renderLibraryView() {
    if (!NeteaseAPI.getClient().isLoggedIn) {
      el.viewContainer.innerHTML = `
        <div style="text-align:center;padding:60px 20px;">
          <div style="font-size:40px;margin-bottom:12px">🔐</div>
          <div style="font-size:16px;font-weight:700;margin-bottom:8px">登录网易云音乐账号</div>
          <div style="font-size:13px;color:var(--text-muted);margin-bottom:20px">同步歌单、我喜欢的音乐、云盘与听歌记录</div>
          <button class="btn primary" id="btn-lib-login" style="padding:10px 24px;border-radius:var(--radius-full);background:var(--primary);color:#fff;border:none;font-weight:600">扫码登录</button>
        </div>
      `;
      document.getElementById('btn-lib-login').onclick = showLoginModal;
      return;
    }

    el.viewContainer.innerHTML = '<div style="text-align:center;padding:40px 0;color:var(--text-muted)">正在加载我的音乐库…</div>';

    try {
      const uid = state.user ? state.user.userId : 0;
      const [playlists, likedAlbums] = await Promise.all([
        uid ? NeteaseAPI.userPlaylists(uid) : [],
        NeteaseAPI.likedAlbums(20),
      ]);

      const created = (playlists || []).filter((p) => p.userId === uid);
      const subbed = (playlists || []).filter((p) => p.userId !== uid);

      el.viewContainer.innerHTML = `
        <div class="section-header">
          <div class="section-title">创建的歌单 (${created.length})</div>
        </div>
        <div class="media-grid">
          ${created.map((p) => `
            <div class="media-card" style="width:100%" data-action="open-playlist" data-id="${p.id}">
              <div class="card-cover-wrapper" style="width:100%;height:auto;aspect-ratio:1">
                <img class="card-cover-img" src="${p.coverImgUrl}?param=300y300" loading="lazy" alt="">
                <div class="card-play-count">${p.trackCount} 首</div>
              </div>
              <div class="card-title">${escapeHtml(p.name)}</div>
            </div>
          `).join('')}
        </div>

        ${subbed.length ? `
          <div class="section-header">
            <div class="section-title">收藏的歌单 (${subbed.length})</div>
          </div>
          <div class="media-grid">
            ${subbed.map((p) => `
              <div class="media-card" style="width:100%" data-action="open-playlist" data-id="${p.id}">
                <div class="card-cover-wrapper" style="width:100%;height:auto;aspect-ratio:1">
                  <img class="card-cover-img" src="${p.coverImgUrl}?param=300y300" loading="lazy" alt="">
                  <div class="card-play-count">${p.trackCount} 首</div>
                </div>
                <div class="card-title">${escapeHtml(p.name)}</div>
              </div>
            `).join('')}
          </div>
        ` : ''}
      `;

      attachCardEvents();
    } catch (e) {
      el.viewContainer.innerHTML = `<div style="text-align:center;padding:40px 0;color:var(--text-muted)">加载失败: ${escapeHtml(e.message)}</div>`;
    }
  }

  function renderSettingsView() {
    el.viewContainer.innerHTML = `
      <div class="section-header">
        <div class="section-title">播放设置</div>
      </div>
      <div style="background:var(--bg-surface);border-radius:var(--radius-md);padding:14px;margin-bottom:16px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
          <div>
            <div style="font-weight:600">在线播放音质</div>
            <div style="font-size:11px;color:var(--text-muted)">最高音质（VIP 自动回退无损）</div>
          </div>
          <select id="settings-quality-select" style="background:var(--bg-surface-elevated);color:#fff;border:1px solid var(--border-subtle);padding:6px 10px;border-radius:var(--radius-sm);outline:none">
            <option value="standard" ${state.quality === 'standard' ? 'selected' : ''}>标准 (128k)</option>
            <option value="higher" ${state.quality === 'higher' ? 'selected' : ''}>较高 (192k)</option>
            <option value="exhigh" ${state.quality === 'exhigh' ? 'selected' : ''}>极高 (320k)</option>
            <option value="lossless" ${state.quality === 'lossless' ? 'selected' : ''}>无损 (FLAC)</option>
            <option value="hires" ${state.quality === 'hires' ? 'selected' : ''}>Hi-Res</option>
          </select>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div>
            <div style="font-weight:600">灰色无版权歌曲解锁</div>
            <div style="font-size:11px;color:var(--text-muted)">自动回落 pyncmd / 酷我 / 酷狗第三方音源</div>
          </div>
          <input type="checkbox" id="settings-unblock-toggle" ${state.unblockEnabled ? 'checked' : ''} style="width:20px;height:20px;accent-color:var(--primary)">
        </div>
      </div>

      <div class="section-header">
        <div class="section-title">账号与数据</div>
      </div>
      <div style="background:var(--bg-surface);border-radius:var(--radius-md);padding:14px;margin-bottom:16px">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div>
            <div style="font-weight:600">当前登录状态</div>
            <div style="font-size:11px;color:var(--text-muted)">${state.user ? escapeHtml(state.user.nickname) : '未登录'}</div>
          </div>
          <button id="btn-settings-auth" style="padding:6px 14px;border-radius:var(--radius-full);background:var(--primary);color:#fff;border:none;font-weight:600;font-size:12px">
            ${state.user ? '退出登录' : '扫码登录'}
          </button>
        </div>
      </div>

      <div class="section-header">
        <div class="section-title">关于 Kumone</div>
      </div>
      <div style="background:var(--bg-surface);border-radius:var(--radius-md);padding:14px">
        <div style="font-weight:600;margin-bottom:4px">Kumone for Android</div>
        <div style="font-size:12px;color:var(--text-muted);margin-bottom:10px">版本 v0.1.9 · 雲の音 NetEase Cloud Music client</div>
        <div style="font-size:12px;color:var(--primary);cursor:pointer" id="btn-open-repo">GitHub: https://github.com/Yuxin-Qiao/kumone</div>
      </div>
    `;

    document.getElementById('settings-quality-select').onchange = (e) => {
      state.quality = e.target.value;
      showToast('音质已设置为 ' + e.target.value);
    };

    document.getElementById('settings-unblock-toggle').onchange = (e) => {
      state.unblockEnabled = e.target.checked;
      showToast(state.unblockEnabled ? '已开启第三方音源解锁' : '已关闭第三方音源解锁');
    };

    document.getElementById('btn-settings-auth').onclick = () => {
      if (state.user) {
        NeteaseAPI.logout().then(() => {
          state.user = null;
          state.likedIds.clear();
          updateAccountUI();
          renderSettingsView();
          showToast('已退出登录');
        });
      } else {
        showLoginModal();
      }
    };

    document.getElementById('btn-open-repo').onclick = () => {
      if (window.AndroidBridge && typeof window.AndroidBridge.openExternal === 'function') {
        window.AndroidBridge.openExternal('https://github.com/Yuxin-Qiao/kumone');
      } else {
        window.open('https://github.com/Yuxin-Qiao/kumone', '_blank');
      }
    };
  }

  async function renderPlaylistView(playlistId) {
    el.viewContainer.innerHTML = '<div style="text-align:center;padding:40px 0;color:var(--text-muted)">正在加载歌单…</div>';

    try {
      const data = await NeteaseAPI.playlistDetail(playlistId);
      const playlist = data.playlist || {};
      const trackIds = (playlist.trackIds || []).slice(0, 100).map((t) => t.id);

      let tracks = playlist.tracks || [];
      if (trackIds.length > tracks.length) {
        const detailRes = await NeteaseAPI.songDetails(trackIds);
        if (detailRes && detailRes.songs) tracks = detailRes.songs;
      }

      el.viewContainer.innerHTML = `
        <div style="display:flex;gap:14px;margin-bottom:16px;align-items:center">
          <img src="${playlist.coverImgUrl}?param=240y240" style="width:100px;height:100px;border-radius:var(--radius-md);object-fit:cover" alt="">
          <div style="flex:1;min-width:0">
            <div style="font-size:16px;font-weight:700;margin-bottom:4px">${escapeHtml(playlist.name)}</div>
            <div style="font-size:12px;color:var(--text-secondary);margin-bottom:8px">by ${escapeHtml(playlist.creator ? playlist.creator.nickname : '')}</div>
            <button class="btn primary" id="btn-play-all-playlist" style="padding:6px 16px;border-radius:var(--radius-full);background:var(--primary);color:#fff;border:none;font-weight:600;font-size:12px">▶ 播放全部 (${tracks.length})</button>
          </div>
        </div>
        <div class="track-list">
          ${tracks.map((t, idx) => renderTrackItemHtml(t, idx, tracks)).join('')}
        </div>
      `;

      document.getElementById('btn-play-all-playlist').onclick = () => {
        if (tracks.length) playTrack(tracks[0], tracks);
      };

      attachTrackEvents(tracks);
    } catch (e) {
      el.viewContainer.innerHTML = `<div style="text-align:center;padding:40px 0;color:var(--text-muted)">加载歌单失败: ${escapeHtml(e.message)}</div>`;
    }
  }

  async function renderAlbumView(albumId) {
    el.viewContainer.innerHTML = '<div style="text-align:center;padding:40px 0;color:var(--text-muted)">正在加载专辑…</div>';

    try {
      const data = await NeteaseAPI.album(albumId);
      const album = data.album || {};
      const songs = data.songs || [];

      el.viewContainer.innerHTML = `
        <div style="display:flex;gap:14px;margin-bottom:16px;align-items:center">
          <img src="${album.picUrl}?param=240y240" style="width:100px;height:100px;border-radius:var(--radius-md);object-fit:cover" alt="">
          <div style="flex:1;min-width:0">
            <div style="font-size:16px;font-weight:700;margin-bottom:4px">${escapeHtml(album.name)}</div>
            <div style="font-size:12px;color:var(--text-secondary);margin-bottom:8px">歌手: ${escapeHtml(album.artist ? album.artist.name : '')}</div>
            <button class="btn primary" id="btn-play-all-album" style="padding:6px 16px;border-radius:var(--radius-full);background:var(--primary);color:#fff;border:none;font-weight:600;font-size:12px">▶ 播放全部 (${songs.length})</button>
          </div>
        </div>
        <div class="track-list">
          ${songs.map((t, idx) => renderTrackItemHtml(t, idx, songs)).join('')}
        </div>
      `;

      document.getElementById('btn-play-all-album').onclick = () => {
        if (songs.length) playTrack(songs[0], songs);
      };

      attachTrackEvents(songs);
    } catch (e) {
      el.viewContainer.innerHTML = `<div style="text-align:center;padding:40px 0;color:var(--text-muted)">加载专辑失败: ${escapeHtml(e.message)}</div>`;
    }
  }

  async function renderArtistView(artistId) {
    el.viewContainer.innerHTML = '<div style="text-align:center;padding:40px 0;color:var(--text-muted)">正在加载歌手…</div>';

    try {
      const [artistData, albumsData] = await Promise.all([
        NeteaseAPI.artist(artistId),
        NeteaseAPI.artistAlbums(artistId, 12),
      ]);

      const artist = artistData.artist || {};
      const hotSongs = artistData.hotSongs || [];
      const albums = albumsData.hotAlbums || [];

      el.viewContainer.innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;padding:10px 0 20px 0">
          <img src="${artist.picUrl || artist.img1v1Url}?param=300y300" style="width:90px;height:90px;border-radius:50%;object-fit:cover;margin-bottom:8px" alt="">
          <div style="font-size:18px;font-weight:700">${escapeHtml(artist.name)}</div>
        </div>
        <div class="section-header">
          <div class="section-title">热门单曲 (${hotSongs.length})</div>
        </div>
        <div class="track-list">
          ${hotSongs.map((t, idx) => renderTrackItemHtml(t, idx, hotSongs)).join('')}
        </div>
        ${albums.length ? `
          <div class="section-header">
            <div class="section-title">专辑作品</div>
          </div>
          <div class="horizontal-scroll-list">
            ${albums.map((a) => `
              <div class="media-card" data-action="open-album" data-id="${a.id}">
                <div class="card-cover-wrapper">
                  <img class="card-cover-img" src="${a.picUrl}?param=240y240" loading="lazy" alt="">
                </div>
                <div class="card-title">${escapeHtml(a.name)}</div>
              </div>
            `).join('')}
          </div>
        ` : ''}
      `;

      attachTrackEvents(hotSongs);
      attachCardEvents();
    } catch (e) {
      el.viewContainer.innerHTML = `<div style="text-align:center;padding:40px 0;color:var(--text-muted)">加载歌手失败: ${escapeHtml(e.message)}</div>`;
    }
  }

  async function renderSimiView(songId) {
    el.viewContainer.innerHTML = '<div style="text-align:center;padding:40px 0;color:var(--text-muted)">正在寻找相似歌曲…</div>';

    try {
      const songs = await NeteaseAPI.similarSongs(songId);
      if (!songs || !songs.length) {
        el.viewContainer.innerHTML = '<div style="text-align:center;padding:40px 0;color:var(--text-muted)">未找到相似歌曲</div>';
        return;
      }
      el.viewContainer.innerHTML = `
        <div class="section-header">
          <div class="section-title">相似歌曲推荐 (${songs.length})</div>
        </div>
        <div class="track-list">
          ${songs.map((s, idx) => renderTrackItemHtml(s, idx, songs)).join('')}
        </div>
      `;
      attachTrackEvents(songs);
    } catch (e) {
      el.viewContainer.innerHTML = `<div style="text-align:center;padding:40px 0;color:var(--text-muted)">加载失败: ${escapeHtml(e.message)}</div>`;
    }
  }

  function renderTrackItemHtml(trackRaw, index, trackList) {
    const t = normalizeTrack(trackRaw);
    const isPlayingThis = state.currentTrack && state.currentTrack.id === t.id;
    const isLiked = state.likedIds.has(t.id);

    return `
      <div class="track-item ${isPlayingThis ? 'playing' : ''}" data-track-id="${t.id}" data-index="${index}">
        <div class="track-index">${index + 1}</div>
        ${t.picUrl ? `<img class="track-cover" src="${t.picUrl}?param=100y100" loading="lazy" alt="">` : ''}
        <div class="track-info">
          <div class="track-name-row">
            <div class="track-name">${escapeHtml(t.name)}</div>
            ${t.fee === 1 ? '<span class="badge-tag badge-vip">VIP</span>' : ''}
          </div>
          <div class="track-meta">${escapeHtml(t.artist)} · ${escapeHtml(t.album.name || '单曲')}</div>
        </div>
        <div class="track-actions">
          <button class="track-btn ${isLiked ? 'liked' : ''}" data-action="toggle-like" data-track-id="${t.id}" title="喜欢">${isLiked ? '❤️' : '♡'}</button>
          <button class="track-btn" data-action="track-menu" data-track-id="${t.id}" title="更多">⋮</button>
        </div>
      </div>
    `;
  }

  function attachTrackEvents(trackList) {
    const items = el.viewContainer.querySelectorAll('.track-item');
    items.forEach((item) => {
      const trackId = parseInt(item.dataset.trackId, 10);
      const trackObj = trackList.find((t) => t.id === trackId);

      item.onclick = (e) => {
        if (e.target.closest('[data-action]')) return;
        if (trackObj) playTrack(trackObj, trackList);
      };

      const likeBtn = item.querySelector('[data-action="toggle-like"]');
      if (likeBtn) {
        likeBtn.onclick = (e) => {
          e.stopPropagation();
          const isLiked = state.likedIds.has(trackId);
          toggleLikeTrack(trackId, !isLiked);
          likeBtn.textContent = !isLiked ? '❤️' : '♡';
          likeBtn.classList.toggle('liked');
        };
      }

      const menuBtn = item.querySelector('[data-action="track-menu"]');
      if (menuBtn) {
        menuBtn.onclick = (e) => {
          e.stopPropagation();
          if (trackObj) showActionSheet(normalizeTrack(trackObj));
        };
      }
    });
  }

  function attachCardEvents() {
    const cards = el.viewContainer.querySelectorAll('[data-action]');
    cards.forEach((card) => {
      const action = card.dataset.action;
      const id = parseInt(card.dataset.id, 10);
      card.onclick = () => {
        if (action === 'open-playlist') navigateTo('playlist', { id });
        else if (action === 'open-album') navigateTo('album', { id });
        else if (action === 'open-artist') navigateTo('artist', { id });
      };
    });
  }

  function showActionSheet(track) {
    state.actionTrack = track;
    el.actionTrackTitle.textContent = track.name + ' — ' + track.artist;
    el.actionSheetBackdrop.classList.add('active');
  }

  function hideActionSheet() {
    el.actionSheetBackdrop.classList.remove('active');
    state.actionTrack = null;
  }

  function showQueueSheet() {
    el.queueCount.textContent = state.queue.length + state.playNextQueue.length;
    let html = '';

    if (state.playNextQueue.length > 0) {
      html += `<div style="font-size:12px;color:var(--primary);padding:6px 10px;font-weight:600">插播队列 (${state.playNextQueue.length})</div>`;
      html += state.playNextQueue.map((t, idx) => `
        <div class="track-item" data-action="play-queue" data-type="next" data-idx="${idx}">
          <div class="track-info">
            <div class="track-name">${escapeHtml(t.name)}</div>
            <div class="track-meta">${escapeHtml(t.artist)}</div>
          </div>
        </div>
      `).join('');
    }

    html += `<div style="font-size:12px;color:var(--text-muted);padding:6px 10px;font-weight:600">播放列表 (${state.queue.length})</div>`;
    html += state.queue.map((t, idx) => `
      <div class="track-item ${state.currentIndex === idx ? 'playing' : ''}" data-action="play-queue" data-type="main" data-idx="${idx}">
        <div class="track-info">
          <div class="track-name">${escapeHtml(t.name)}</div>
          <div class="track-meta">${escapeHtml(t.artist)}</div>
        </div>
      </div>
    `).join('');

    el.queueTrackList.innerHTML = html;

    el.queueTrackList.querySelectorAll('[data-action="play-queue"]').forEach((item) => {
      item.onclick = () => {
        const type = item.dataset.type;
        const idx = parseInt(item.dataset.idx, 10);
        if (type === 'next') {
          const t = state.playNextQueue.splice(idx, 1)[0];
          playTrack(t);
        } else {
          state.currentIndex = idx;
          playTrack(state.queue[idx]);
        }
        hideQueueSheet();
      };
    });

    el.queueSheetBackdrop.classList.add('active');
  }

  function hideQueueSheet() {
    el.queueSheetBackdrop.classList.remove('active');
  }

  function switchLoginTab(tabName) {
    state.activeLoginTab = tabName;
    if (el.loginTabs) {
      el.loginTabs.forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.loginTab === tabName);
      });
    }
    document.querySelectorAll('.login-tab-content').forEach((content) => {
      content.classList.toggle('active', content.id === `tab-login-${tabName}`);
    });

    if (tabName === 'qr') {
      startQrLogin();
    } else {
      if (state.qrPollTimer) {
        clearInterval(state.qrPollTimer);
        state.qrPollTimer = null;
      }
    }
  }

  async function showLoginModal(tabName = 'phone') {
    el.loginSheetBackdrop.classList.add('active');
    switchLoginTab(tabName);
  }

  function hideLoginModal() {
    if (state.qrPollTimer) {
      clearInterval(state.qrPollTimer);
      state.qrPollTimer = null;
    }
    el.loginSheetBackdrop.classList.remove('active');
  }

  async function startQrLogin() {
    el.loginQrStatus.textContent = '正在获取登录密钥…';
    el.btnRefreshQr.style.display = 'none';

    try {
      const unikey = await NeteaseAPI.qrKey();
      state.currentUnikey = unikey;
      const qrUrl = NeteaseAPI.qrLoginURL(unikey);
      const dataUrl = QRCode.toDataURL(qrUrl, { width: 200 });
      el.loginQrImg.src = dataUrl;
      el.loginQrStatus.textContent = '可直接点击上方按钮唤起网易云 App，或使用另一台手机扫码';

      if (state.qrPollTimer) clearInterval(state.qrPollTimer);
      state.qrPollTimer = setInterval(async () => {
        try {
          const res = await NeteaseAPI.qrCheck(unikey);
          if (res.code === 800) {
            el.loginQrStatus.textContent = '二维码/登录密钥已过期，点击刷新';
            el.btnRefreshQr.style.display = 'block';
            clearInterval(state.qrPollTimer);
          } else if (res.code === 802) {
            el.loginQrStatus.textContent = '已在手机端扫码/唤起，请在网易云 App 中点击确认登录';
          } else if (res.code === 803) {
            clearInterval(state.qrPollTimer);
            hideLoginModal();
            showToast('登录成功！');
            await checkAccountStatus();
            if (state.currentView === 'library') renderLibraryView();
            else if (state.currentView === 'home') renderHomeView();
          }
        } catch (_) {}
      }, 1500);
    } catch (e) {
      el.loginQrStatus.textContent = '获取二维码失败，请重试';
      el.btnRefreshQr.style.display = 'block';
    }
  }

  function handleJumpNeteaseApp() {
    if (!state.currentUnikey) {
      showToast('正在获取登录密钥，请稍候…');
      startQrLogin().then(() => {
        if (state.currentUnikey) doJumpNetease();
      });
      return;
    }
    doJumpNetease();
  }

  function doJumpNetease() {
    if (window.AndroidBridge && typeof window.AndroidBridge.openNeteaseApp === 'function') {
      const opened = window.AndroidBridge.openNeteaseApp(state.currentUnikey);
      if (opened) {
        el.loginQrStatus.textContent = '已尝试唤起网易云音乐，请在 App 中点击确认登录…';
        showToast('已唤起网易云音乐，请在 App 中点击确认');
      }
    } else {
      const url = NeteaseAPI.qrLoginURL(state.currentUnikey);
      window.open(url, '_blank');
      el.loginQrStatus.textContent = '已打开授权页面，请在网易云中确认登录…';
      showToast('已打开授权链接');
    }
  }

  async function handleSendCaptcha() {
    const phone = (el.inputLoginPhone.value || '').trim();
    if (!/^1\d{10}$/.test(phone)) {
      showToast('请输入有效的 11 位手机号码');
      el.inputLoginPhone.focus();
      return;
    }

    if (state.captchaCountdown > 0) return;

    el.btnSendCaptcha.disabled = true;
    el.btnSendCaptcha.textContent = '发送中…';

    try {
      await NeteaseAPI.sendCaptcha(phone);
      showToast('验证码已发送，请注意查收');
      state.captchaCountdown = 60;
      el.btnSendCaptcha.textContent = `${state.captchaCountdown}s 后重发`;

      if (state.captchaTimer) clearInterval(state.captchaTimer);
      state.captchaTimer = setInterval(() => {
        state.captchaCountdown--;
        if (state.captchaCountdown <= 0) {
          clearInterval(state.captchaTimer);
          el.btnSendCaptcha.disabled = false;
          el.btnSendCaptcha.textContent = '获取验证码';
        } else {
          el.btnSendCaptcha.textContent = `${state.captchaCountdown}s 后重发`;
        }
      }, 1000);
    } catch (e) {
      el.btnSendCaptcha.disabled = false;
      el.btnSendCaptcha.textContent = '获取验证码';
      showToast(e.message || '发送验证码失败');
    }
  }

  async function handleSubmitPhoneLogin() {
    const phone = (el.inputLoginPhone.value || '').trim();
    if (!/^1\d{10}$/.test(phone)) {
      showToast('请输入有效的 11 位手机号码');
      el.inputLoginPhone.focus();
      return;
    }

    const authTypeElem = document.querySelector('input[name="phone-auth-type"]:checked');
    const authType = authTypeElem ? authTypeElem.value : 'captcha';

    el.btnSubmitPhoneLogin.disabled = true;
    el.btnSubmitPhoneLogin.textContent = '正在登录…';

    try {
      if (authType === 'captcha') {
        const captcha = (el.inputLoginCaptcha.value || '').trim();
        if (!captcha) {
          showToast('请输入收到的短信验证码');
          el.inputLoginCaptcha.focus();
          el.btnSubmitPhoneLogin.disabled = false;
          el.btnSubmitPhoneLogin.textContent = '立即登录';
          return;
        }
        await NeteaseAPI.loginCaptcha(phone, captcha);
      } else {
        const password = el.inputLoginPassword.value || '';
        if (!password) {
          showToast('请输入账号密码');
          el.inputLoginPassword.focus();
          el.btnSubmitPhoneLogin.disabled = false;
          el.btnSubmitPhoneLogin.textContent = '立即登录';
          return;
        }
        await NeteaseAPI.loginCellphone(phone, password);
      }

      showToast('登录成功！');
      hideLoginModal();
      await checkAccountStatus();
      if (state.currentView === 'library') renderLibraryView();
      else if (state.currentView === 'home') renderHomeView();
    } catch (e) {
      showToast(e.message || '登录失败，请检查手机号或密码/验证码');
    } finally {
      el.btnSubmitPhoneLogin.disabled = false;
      el.btnSubmitPhoneLogin.textContent = '立即登录';
    }
  }

  async function handleSubmitCookieLogin() {
    const cookieVal = (el.inputLoginCookie.value || '').trim();
    if (!cookieVal) {
      showToast('请粘贴 MUSIC_U 或完整 Cookie 字符串');
      el.inputLoginCookie.focus();
      return;
    }

    el.btnSubmitCookieLogin.disabled = true;
    el.btnSubmitCookieLogin.textContent = '正在验证…';

    try {
      await NeteaseAPI.loginCookie(cookieVal);
      showToast('登录成功！');
      hideLoginModal();
      await checkAccountStatus();
      if (state.currentView === 'library') renderLibraryView();
      else if (state.currentView === 'home') renderHomeView();
    } catch (e) {
      showToast(e.message || 'Cookie 无效或已过期');
    } finally {
      el.btnSubmitCookieLogin.disabled = false;
      el.btnSubmitCookieLogin.textContent = '导入并登录';
    }
  }

  async function checkAccountStatus() {
    if (NeteaseAPI.getClient().isLoggedIn) {
      try {
        const profile = await NeteaseAPI.userAccount();
        if (profile) {
          state.user = profile;
          updateAccountUI();
          const ids = await NeteaseAPI.likedTrackIDs(profile.userId);
          state.likedIds = new Set(ids || []);
        }
      } catch (_) {}
    } else {
      updateAccountUI();
    }
  }

  function updateAccountUI() {
    if (state.user) {
      el.userAvatar.src = state.user.avatarUrl ? `${state.user.avatarUrl}?param=80y80` : '';
      el.userName.textContent = state.user.nickname || '用户';
    } else {
      el.userAvatar.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%2371717a'%3E%3Cpath d='M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z'/%3E%3C/svg%3E";
      el.userName.textContent = '未登录';
    }
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function handleBack() {
    if (el.actionSheetBackdrop.classList.contains('active')) {
      hideActionSheet();
      return 'handled';
    }
    if (el.queueSheetBackdrop.classList.contains('active')) {
      hideQueueSheet();
      return 'handled';
    }
    if (el.loginSheetBackdrop.classList.contains('active')) {
      hideLoginModal();
      return 'handled';
    }
    if (el.fullscreenPlayer.classList.contains('active')) {
      el.fullscreenPlayer.classList.remove('active');
      return 'handled';
    }
    if (state.viewHistory.length > 0) {
      const prev = state.viewHistory.pop();
      navigateTo(prev.view, prev.params, false);
      return 'handled';
    }
    return 'default';
  }

  function setupEventListeners() {
    el.bottomPlayerBar.onclick = (e) => {
      if (e.target.closest('.bp-btn')) return;
      el.fullscreenPlayer.classList.add('active');
    };

    el.fsBtnClose.onclick = () => {
      el.fullscreenPlayer.classList.remove('active');
    };

    el.bpBtnPlay.onclick = togglePlay;
    el.fsBtnPlay.onclick = togglePlay;
    el.bpBtnNext.onclick = () => playNextTrack(true);
    el.fsBtnNext.onclick = () => playNextTrack(true);
    el.fsBtnPrev.onclick = playPrevTrack;
    el.bpBtnLike.onclick = toggleLikeCurrent;
    el.fsBtnLike.onclick = toggleLikeCurrent;
    el.fsBtnMode.onclick = togglePlayMode;
    el.fsBtnLyricsToggle.onclick = toggleLyricsView;
    el.fsBtnQueue.onclick = showQueueSheet;

    el.fsSeekSlider.oninput = (e) => {
      const pct = e.target.value / 1000;
      const posMs = Math.floor(pct * (state.duration * 1000));
      el.fsTimeCur.textContent = formatTime(Math.floor(posMs / 1000));
    };

    el.fsSeekSlider.onchange = (e) => {
      const pct = e.target.value / 1000;
      const posMs = Math.floor(pct * (state.duration * 1000));
      seekAudio(posMs);
    };

    el.fsLyricsContent.onclick = (e) => {
      const line = e.target.closest('.lyric-line');
      if (line && line.dataset.time) {
        const timeMs = parseInt(line.dataset.time, 10);
        seekAudio(timeMs);
      }
    };

    el.bottomNav.querySelectorAll('.nav-tab').forEach((tab) => {
      tab.onclick = () => {
        const tabName = tab.dataset.tab;
        navigateTo(tabName);
      };
    });

    el.btnAccount.onclick = () => {
      if (!state.user) showLoginModal();
      else navigateTo('library');
    };

    el.btnBrandHome.onclick = () => navigateTo('home');

    el.actionSheetBackdrop.onclick = (e) => {
      if (e.target === el.actionSheetBackdrop) hideActionSheet();
    };
    el.actionPlayNext.onclick = () => {
      if (state.actionTrack) {
        state.playNextQueue.unshift(state.actionTrack);
        showToast('已添加到下一首播放');
      }
      hideActionSheet();
    };
    el.actionLike.onclick = () => {
      if (state.actionTrack) {
        const id = state.actionTrack.id;
        toggleLikeTrack(id, !state.likedIds.has(id));
      }
      hideActionSheet();
    };
    el.actionAlbum.onclick = () => {
      if (state.actionTrack && state.actionTrack.album && state.actionTrack.album.id) {
        navigateTo('album', { id: state.actionTrack.album.id });
      }
      hideActionSheet();
    };
    el.actionArtist.onclick = () => {
      if (state.actionTrack && state.actionTrack.artists && state.actionTrack.artists[0]) {
        navigateTo('artist', { id: state.actionTrack.artists[0].id });
      }
      hideActionSheet();
    };
    el.actionSimi.onclick = () => {
      if (state.actionTrack) {
        navigateTo('simi', { id: state.actionTrack.id });
      }
      hideActionSheet();
    };
    el.actionCopyLink.onclick = () => {
      if (state.actionTrack) {
        const url = `https://music.163.com/#/song?id=${state.actionTrack.id}`;
        if (window.AndroidBridge && typeof window.AndroidBridge.copyToClipboard === 'function') {
          window.AndroidBridge.copyToClipboard(url);
        } else {
          navigator.clipboard.writeText(url).then(() => showToast('已复制歌曲链接'));
        }
      }
      hideActionSheet();
    };

    el.queueSheetBackdrop.onclick = (e) => {
      if (e.target === el.queueSheetBackdrop) hideQueueSheet();
    };
    el.btnClearQueue.onclick = () => {
      state.queue = [];
      state.playNextQueue = [];
      showQueueSheet();
      showToast('已清空播放队列');
    };

    el.loginSheetBackdrop.onclick = (e) => {
      if (e.target === el.loginSheetBackdrop) hideLoginModal();
    };
    el.btnCloseLogin.onclick = hideLoginModal;
    el.btnRefreshQr.onclick = () => startQrLogin();

    if (el.loginTabs) {
      el.loginTabs.forEach((tab) => {
        tab.onclick = () => switchLoginTab(tab.dataset.loginTab);
      });
    }

    document.querySelectorAll('input[name="phone-auth-type"]').forEach((radio) => {
      radio.onchange = (e) => {
        const isCaptcha = e.target.value === 'captcha';
        if (el.rowLoginCaptcha) el.rowLoginCaptcha.style.display = isCaptcha ? 'flex' : 'none';
        if (el.rowLoginPassword) el.rowLoginPassword.style.display = isCaptcha ? 'none' : 'flex';
      };
    });

    if (el.btnSendCaptcha) el.btnSendCaptcha.onclick = handleSendCaptcha;
    if (el.btnSubmitPhoneLogin) el.btnSubmitPhoneLogin.onclick = handleSubmitPhoneLogin;
    if (el.btnSubmitCookieLogin) el.btnSubmitCookieLogin.onclick = handleSubmitCookieLogin;
    if (el.btnJumpNeteaseApp) el.btnJumpNeteaseApp.onclick = handleJumpNeteaseApp;
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
    handleBack,
  };

  document.addEventListener('DOMContentLoaded', init);
})();
