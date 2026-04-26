/* ============================================
   VIBE — script.js
   ============================================ */

// ── Firebase ──────────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyDWhvfx-7CiVGxdHFgR_kE2xVBAmOm6yrc",
  authDomain: "device-streaming-36e0d1e5.firebaseapp.com",
  databaseURL: "https://device-streaming-36e0d1e5-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "device-streaming-36e0d1e5",
  storageBucket: "device-streaming-36e0d1e5.appspot.com",
  messagingSenderId: "565227952193",
  appId: "1:565227952193:web:6a36fdf14e5800c2864ec0"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// ── User ──────────────────────────────────────
let userId = localStorage.getItem('vibeUserId');
if (!userId) {
  userId = `user_${Date.now()}_${Math.random().toString(36).substr(2,9)}`;
  localStorage.setItem('vibeUserId', userId);
}

// ── State ─────────────────────────────────────
let allFiles = {};
let currentPage = 0;
let searchQuery = '';
let audioPlaylist = [];
let currentTrackIndex = -1;
let isPlaying = false;
let pendingDeleteId = null;
let shareFileId = null;

// ── DOM ───────────────────────────────────────
const slider          = document.getElementById('slider');
const pages           = document.querySelectorAll('.page');
const navBtns         = document.querySelectorAll('.nav-btn');
const form            = document.getElementById('file-form');
const titleInput      = document.getElementById('title');
const urlInput        = document.getElementById('url');
const urlPreview      = document.getElementById('urlPreview');
const searchInput     = document.getElementById('searchInput');
const globalAudio     = document.getElementById('globalAudio');
const nowPlayingBar   = document.getElementById('nowPlayingBar');
const npTitle         = document.getElementById('npTitle');
const npPlayPause     = document.getElementById('npPlayPause');
const npCover         = document.getElementById('npCover');
const mainPlayBtn     = document.getElementById('mainPlayBtn');
const prevBtn         = document.getElementById('prevBtn');
const nextBtn         = document.getElementById('nextBtn');
const playerProgress  = document.getElementById('playerProgress');
const progressFill    = document.getElementById('progressFill');
const progressThumb   = document.getElementById('progressThumb');
const playerTitle     = document.getElementById('playerTitle');
const playerSub       = document.getElementById('playerSub');
const curTime         = document.getElementById('curTime');
const durTime         = document.getElementById('durTime');
const volumeSlider    = document.getElementById('volumeSlider');
const playerCover     = document.getElementById('playerCover');
const coverLetter     = document.getElementById('coverLetter');
const playerSection   = document.getElementById('playerSection');
const shareModal      = document.getElementById('shareModal');
const deleteModal     = document.getElementById('deleteModal');
const modalClose      = document.getElementById('modalClose');
const modalLink       = document.getElementById('modalLink');
const modalTitle      = document.getElementById('modalTitle');
const copyBtn         = document.getElementById('copyBtn');
const shareWA         = document.getElementById('shareWA');
const shareTG         = document.getElementById('shareTG');
const deleteCancelBtn = document.getElementById('deleteCancelBtn');
const deleteConfirmBtn= document.getElementById('deleteConfirmBtn');
const loader          = document.getElementById('loader');

// ── Helpers ───────────────────────────────────
const isAudio = url => /\.(mp3|wav|ogg|aac|flac|m4a)$/i.test(url);
const isYT    = url => /youtu(be\.com|\.be)/i.test(url);

function getYTEmbed(url) {
  const m = url.match(/(?:v=|youtu\.be\/|embed\/)([^&?#\s]{11})/);
  return m ? `https://www.youtube.com/embed/${m[1]}?rel=0` : null;
}

function fmtTime(s) {
  if (!s || isNaN(s)) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2,'0')}`;
}

function getInitial(title) {
  return title ? title[0].toUpperCase() : '♪';
}

function getLikes(fileId) {
  return parseInt(localStorage.getItem(`like_count_${fileId}`) || '0');
}
function getUserLiked(fileId) {
  return localStorage.getItem(`liked_${userId}_${fileId}`) === '1';
}
function setLike(fileId, liked) {
  localStorage.setItem(`liked_${userId}_${fileId}`, liked ? '1' : '0');
  let count = getLikes(fileId);
  count = liked ? count + 1 : Math.max(0, count - 1);
  localStorage.setItem(`like_count_${fileId}`, count);
  return count;
}

// ── Toast ──────────────────────────────────────
function showToast(msg, duration = 2500) {
  const old = document.querySelector('.toast');
  if (old) old.remove();
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => {
    t.classList.add('hide');
    setTimeout(() => t.remove(), 300);
  }, duration);
}

// ── Ripple ────────────────────────────────────
function addRipple(btn, e) {
  const rect = btn.getBoundingClientRect();
  const r = document.createElement('span');
  r.className = 'ripple';
  const size = Math.max(rect.width, rect.height);
  r.style.width = r.style.height = size + 'px';
  r.style.left = (e.clientX - rect.left - size/2) + 'px';
  r.style.top  = (e.clientY - rect.top - size/2) + 'px';
  btn.style.position = 'relative';
  btn.style.overflow = 'hidden';
  btn.appendChild(r);
  setTimeout(() => r.remove(), 600);
}

// ── Navigation ────────────────────────────────
function navigateTo(idx) {
  currentPage = idx;
  const pct = 100 / pages.length;
  slider.style.transform = `translateX(-${idx * pct}%)`;
  navBtns.forEach((b,i) => b.classList.toggle('active', i === idx));
}

// ── Render ────────────────────────────────────
function renderAll() {
  const files = allFiles;
  const q = searchQuery.toLowerCase();

  const videoListEl  = document.getElementById('video-list-all');
  const audioListEl  = document.getElementById('audio-list-all');
  const myListEl     = document.getElementById('my-files-list');

  videoListEl.innerHTML = '';
  audioListEl.innerHTML = '';
  myListEl.innerHTML = '';

  audioPlaylist = [];

  let videoCount = 0, audioCount = 0;

  const entries = Object.entries(files).reverse();

  entries.forEach(([id, data]) => {
    if (q && !data.title.toLowerCase().includes(q)) return;

    if (isAudio(data.url)) {
      audioPlaylist.push({ id, ...data });
      const row = createAudioRow(id, data, audioPlaylist.length - 1);
      audioListEl.appendChild(row);
      audioCount++;
    } else {
      const card = createVideoCard(id, data);
      videoListEl.appendChild(card);
      videoCount++;
    }

    if (data.ownerId === userId) {
      const card = isAudio(data.url)
        ? createAudioCard(id, data)
        : createVideoCard(id, data, true);
      myListEl.appendChild(card);
    }
  });

  // Counts
  document.getElementById('videoCount').textContent = videoCount;
  document.getElementById('audioCount').textContent = audioCount;
  document.getElementById('statTotal').textContent = entries.length;
  document.getElementById('statVideos').textContent = videoCount;
  document.getElementById('statAudios').textContent = audioCount;

  if (!videoCount) videoListEl.innerHTML = emptyHTML('fas fa-film', 'Hələ video əlavə edilməyib');
  if (!audioCount) {
    audioListEl.innerHTML = emptyHTML('fas fa-headphones', 'Hələ mahnı əlavə edilməyib');
    playerSection.style.display = 'none';
  } else {
    playerSection.style.display = 'block';
  }
  if (!myListEl.children.length) myListEl.innerHTML = emptyHTML('fas fa-user', 'Hələ heç nə paylaşmamısınız');

  // If current track still in list, update index
  if (currentTrackIndex >= audioPlaylist.length) {
    currentTrackIndex = audioPlaylist.length > 0 ? 0 : -1;
  }

  // Highlight active row
  highlightActiveRow();
}

function emptyHTML(icon, text) {
  return `<div class="empty-state"><i class="${icon}"></i><p>${text}</p></div>`;
}

// ── Video Card ────────────────────────────────
function createVideoCard(id, data, showDelete = false) {
  const card = document.createElement('div');
  card.className = 'media-card';
  card.dataset.id = id;
  card.style.animationDelay = Math.random() * 0.2 + 's';

  let mediaEl = '';
  if (isYT(data.url)) {
    const embed = getYTEmbed(data.url);
    mediaEl = `<iframe src="${embed}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; gyroscope; picture-in-picture" allowfullscreen loading="lazy"></iframe>`;
  } else {
    mediaEl = `<video controls src="${data.url}" preload="metadata"></video>`;
  }

  const isOwner = data.ownerId === userId;
  const liked = getUserLiked(id);
  const likeCount = getLikes(id);

  card.innerHTML = `
    ${mediaEl}
    <div class="media-card-body">
      <div class="media-title">${data.title}</div>
      <div class="card-actions">
        <span class="like-count">${likeCount || ''}</span>
        <button class="card-btn like-btn ${liked ? 'liked' : ''}" data-id="${id}" title="Bəyən">
          <i class="fa${liked ? 's' : 'r'} fa-heart"></i>
        </button>
        <button class="card-btn share-file-btn" data-id="${id}" data-url="${data.url}" data-title="${data.title}" title="Paylaş">
          <i class="fas fa-share-nodes"></i>
        </button>
        ${isOwner ? `<button class="card-btn delete-btn" data-id="${id}" title="Sil"><i class="fas fa-trash"></i></button>` : ''}
      </div>
    </div>`;
  return card;
}

// ── Audio Row ─────────────────────────────────
function createAudioRow(id, data, trackIdx) {
  const row = document.createElement('div');
  row.className = 'audio-row';
  row.dataset.id = id;
  row.dataset.track = trackIdx;
  row.style.animationDelay = trackIdx * 0.05 + 's';

  const liked = getUserLiked(id);
  const isOwner = data.ownerId === userId;
  const letter = getInitial(data.title);

  row.innerHTML = `
    <div class="audio-row-num track-num">${trackIdx + 1}</div>
    <div class="audio-row-bars" style="display:none">
      <span></span><span></span><span></span><span></span>
    </div>
    <div class="audio-mini-cover">${letter}</div>
    <div class="audio-row-info">
      <div class="audio-row-title">${data.title}</div>
    </div>
    <div class="audio-row-actions">
      <button class="card-btn like-btn ${liked ? 'liked' : ''}" data-id="${id}">
        <i class="fa${liked ? 's' : 'r'} fa-heart"></i>
      </button>
      <button class="card-btn share-file-btn" data-id="${id}" data-url="${data.url}" data-title="${data.title}">
        <i class="fas fa-share-nodes"></i>
      </button>
      ${isOwner ? `<button class="card-btn delete-btn" data-id="${id}"><i class="fas fa-trash"></i></button>` : ''}
    </div>`;

  row.addEventListener('click', (e) => {
    if (e.target.closest('.card-btn')) return;
    playTrack(trackIdx);
  });

  return row;
}

// ── Audio Card (for My Files) ─────────────────
function createAudioCard(id, data) {
  const card = document.createElement('div');
  card.className = 'media-card';
  card.dataset.id = id;

  const liked = getUserLiked(id);
  const likeCount = getLikes(id);
  const letter = getInitial(data.title);

  card.innerHTML = `
    <div style="background:linear-gradient(135deg,var(--accent),var(--accent2));height:120px;display:flex;align-items:center;justify-content:center;font-size:3rem;">
      ${letter}
    </div>
    <div class="media-card-body">
      <div class="media-title">${data.title}</div>
      <div class="card-actions">
        <span class="like-count">${likeCount || ''}</span>
        <button class="card-btn like-btn ${liked ? 'liked' : ''}" data-id="${id}">
          <i class="fa${liked ? 's' : 'r'} fa-heart"></i>
        </button>
        <button class="card-btn share-file-btn" data-id="${id}" data-url="${data.url}" data-title="${data.title}">
          <i class="fas fa-share-nodes"></i>
        </button>
        <button class="card-btn delete-btn" data-id="${id}"><i class="fas fa-trash"></i></button>
      </div>
    </div>`;
  return card;
}

// ── Audio Player ──────────────────────────────
function playTrack(idx) {
  if (idx < 0 || idx >= audioPlaylist.length) return;
  currentTrackIndex = idx;
  const track = audioPlaylist[idx];

  globalAudio.src = track.url;
  globalAudio.volume = parseFloat(volumeSlider.value);
  globalAudio.play().catch(() => {});
  isPlaying = true;

  updatePlayerUI(track);
  highlightActiveRow();
  showNowPlaying(track.title);
}

function updatePlayerUI(track) {
  playerTitle.textContent = track.title;
  playerSub.textContent = `${currentTrackIndex + 1} / ${audioPlaylist.length}`;
  coverLetter.textContent = getInitial(track.title);

  mainPlayBtn.innerHTML = '<i class="fas fa-pause"></i>';
  npPlayPause.innerHTML = '<i class="fas fa-pause"></i>';
  playerCover.classList.add('spinning');
  npCover.classList.add('playing');
}

function togglePlayPause() {
  if (currentTrackIndex === -1) {
    if (audioPlaylist.length > 0) playTrack(0);
    return;
  }
  if (globalAudio.paused) {
    globalAudio.play();
    isPlaying = true;
    mainPlayBtn.innerHTML = '<i class="fas fa-pause"></i>';
    npPlayPause.innerHTML = '<i class="fas fa-pause"></i>';
    playerCover.classList.add('spinning');
    npCover.classList.add('playing');
  } else {
    globalAudio.pause();
    isPlaying = false;
    mainPlayBtn.innerHTML = '<i class="fas fa-play"></i>';
    npPlayPause.innerHTML = '<i class="fas fa-play"></i>';
    playerCover.classList.remove('spinning');
    npCover.classList.remove('playing');
  }
}

function showNowPlaying(title) {
  nowPlayingBar.style.display = 'flex';
  npTitle.textContent = title;
  document.querySelector('.main-content').style.top =
    `calc(var(--header-h) + 52px)`;
}

function hideNowPlaying() {
  nowPlayingBar.style.display = 'none';
  document.querySelector('.main-content').style.top = 'var(--header-h)';
}

function highlightActiveRow() {
  document.querySelectorAll('.audio-row').forEach(row => {
    const ti = parseInt(row.dataset.track);
    const active = ti === currentTrackIndex && isPlaying;
    row.classList.toggle('active', active);
    const num = row.querySelector('.track-num');
    const bars = row.querySelector('.audio-row-bars');
    if (num && bars) {
      num.style.display = active ? 'none' : '';
      bars.style.display = active ? 'flex' : 'none';
    }
  });
}

// ── Audio Events ──────────────────────────────
globalAudio.addEventListener('timeupdate', () => {
  const pct = globalAudio.duration
    ? (globalAudio.currentTime / globalAudio.duration) * 100
    : 0;
  progressFill.style.width = pct + '%';
  progressThumb.style.left = pct + '%';
  curTime.textContent = fmtTime(globalAudio.currentTime);
  durTime.textContent = fmtTime(globalAudio.duration);
});

globalAudio.addEventListener('ended', () => {
  const next = currentTrackIndex + 1;
  if (next < audioPlaylist.length) playTrack(next);
  else {
    isPlaying = false;
    mainPlayBtn.innerHTML = '<i class="fas fa-play"></i>';
    playerCover.classList.remove('spinning');
    npCover.classList.remove('playing');
    highlightActiveRow();
  }
});

playerProgress.addEventListener('click', e => {
  if (!globalAudio.duration) return;
  const rect = playerProgress.getBoundingClientRect();
  const pct = (e.clientX - rect.left) / rect.width;
  globalAudio.currentTime = pct * globalAudio.duration;
});

mainPlayBtn.addEventListener('click', togglePlayPause);
npPlayPause.addEventListener('click', togglePlayPause);
prevBtn.addEventListener('click', () => {
  if (currentTrackIndex > 0) playTrack(currentTrackIndex - 1);
});
nextBtn.addEventListener('click', () => {
  if (currentTrackIndex < audioPlaylist.length - 1) playTrack(currentTrackIndex + 1);
});
volumeSlider.addEventListener('input', () => {
  globalAudio.volume = parseFloat(volumeSlider.value);
});

// ── Share Modal ───────────────────────────────
function openShare(id, url, title) {
  shareFileId = id;
  modalTitle.textContent = title;
  modalLink.value = url;
  shareModal.style.display = 'flex';
}

modalClose.addEventListener('click', () => shareModal.style.display = 'none');
shareModal.addEventListener('click', e => { if (e.target === shareModal) shareModal.style.display = 'none'; });

copyBtn.addEventListener('click', () => {
  navigator.clipboard.writeText(modalLink.value).then(() => {
    copyBtn.classList.add('copied');
    copyBtn.innerHTML = '<i class="fas fa-check"></i>';
    showToast('Link kopyalandı! 🔗');
    setTimeout(() => {
      copyBtn.classList.remove('copied');
      copyBtn.innerHTML = '<i class="fas fa-copy"></i>';
    }, 2000);
  });
});

shareWA.addEventListener('click', () => {
  window.open(`https://wa.me/?text=${encodeURIComponent(modalTitle.textContent + ' — ' + modalLink.value)}`);
});
shareTG.addEventListener('click', () => {
  window.open(`https://t.me/share/url?url=${encodeURIComponent(modalLink.value)}&text=${encodeURIComponent(modalTitle.textContent)}`);
});

// ── Delete Modal ──────────────────────────────
function openDelete(id) {
  pendingDeleteId = id;
  deleteModal.style.display = 'flex';
}

deleteCancelBtn.addEventListener('click', () => {
  deleteModal.style.display = 'none';
  pendingDeleteId = null;
});
deleteModal.addEventListener('click', e => {
  if (e.target === deleteModal) { deleteModal.style.display = 'none'; pendingDeleteId = null; }
});
deleteConfirmBtn.addEventListener('click', () => {
  if (!pendingDeleteId) return;
  db.ref('files/' + pendingDeleteId).remove();
  deleteModal.style.display = 'none';
  showToast('Fayl silindi');
  pendingDeleteId = null;
});

// ── Event Delegation ──────────────────────────
document.body.addEventListener('click', e => {
  // Nav buttons
  const navBtn = e.target.closest('.nav-btn');
  if (navBtn) {
    addRipple(navBtn, e);
    navigateTo(parseInt(navBtn.dataset.page));
    return;
  }

  // Like button
  const likeBtn = e.target.closest('.like-btn');
  if (likeBtn) {
    e.stopPropagation();
    const id = likeBtn.dataset.id;
    const liked = getUserLiked(id);
    const newCount = setLike(id, !liked);
    likeBtn.classList.toggle('liked', !liked);
    likeBtn.innerHTML = `<i class="fa${!liked ? 's' : 'r'} fa-heart"></i>`;
    // Update count display
    const countEl = likeBtn.closest('.card-actions')?.querySelector('.like-count');
    if (countEl) countEl.textContent = newCount || '';
    showToast(liked ? 'Bəyənmə ləğv edildi' : '❤️ Bəyənildi!');
    return;
  }

  // Share button
  const shareBtn = e.target.closest('.share-file-btn');
  if (shareBtn) {
    e.stopPropagation();
    openShare(shareBtn.dataset.id, shareBtn.dataset.url, shareBtn.dataset.title);
    return;
  }

  // Delete button
  const delBtn = e.target.closest('.delete-btn');
  if (delBtn) {
    e.stopPropagation();
    openDelete(delBtn.dataset.id);
    return;
  }

  // Filter tabs
  const ftab = e.target.closest('.ftab');
  if (ftab) {
    document.querySelectorAll('.ftab').forEach(t => t.classList.remove('active'));
    ftab.classList.add('active');
    const filter = ftab.dataset.filter;
    document.querySelectorAll('#video-list-all .media-card').forEach(card => {
      if (filter === 'all') { card.style.display = ''; return; }
      const hasYT = card.querySelector('iframe');
      card.style.display = (filter === 'youtube') === !!hasYT ? '' : 'none';
    });
    return;
  }

  // Type buttons in form
  const typeBtn = e.target.closest('.type-btn');
  if (typeBtn) {
    document.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active'));
    typeBtn.classList.add('active');
    return;
  }
});

// ── Form Submit ───────────────────────────────
form.addEventListener('submit', async e => {
  e.preventDefault();
  const title = titleInput.value.trim();
  const url = urlInput.value.trim();
  if (!title || !url) return;

  const submitBtn = form.querySelector('.submit-btn');
  submitBtn.disabled = true;
  submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Yüklənir...';

  try {
    await db.ref('files').push({
      title,
      url,
      ownerId: userId,
      createdAt: firebase.database.ServerValue.TIMESTAMP
    });
    form.reset();
    urlPreview.textContent = '';
    showToast('✅ Uğurla paylaşıldı!');
    navigateTo(isAudio(url) ? 1 : 0);
  } catch (err) {
    showToast('❌ Xəta baş verdi');
    console.error(err);
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<i class="fas fa-share-nodes"></i> Paylaş';
  }
});

// URL preview
urlInput.addEventListener('input', () => {
  const url = urlInput.value.trim();
  if (!url) { urlPreview.textContent = ''; return; }
  if (isYT(url)) urlPreview.textContent = '🎬 YouTube videosu aşkar edildi';
  else if (isAudio(url)) urlPreview.textContent = '🎵 Audio fayl aşkar edildi';
  else if (url.includes('.mp4')) urlPreview.textContent = '🎬 Video fayl aşkar edildi';
  else urlPreview.textContent = '';
});

// ── Search ────────────────────────────────────
searchInput.addEventListener('input', () => {
  searchQuery = searchInput.value.trim();
  renderAll();
});

// ── Firebase Realtime ─────────────────────────
db.ref('files').on('value', snapshot => {
  allFiles = snapshot.val() || {};
  renderAll();
});

// ── Loader ────────────────────────────────────
window.addEventListener('load', () => {
  setTimeout(() => {
    loader.classList.add('hidden');
  }, 1800);
});

// ── Init ──────────────────────────────────────
navigateTo(0);
