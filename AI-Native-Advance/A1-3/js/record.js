// record.js
// "오늘의 요리판" 페이지 — ① 완성한 기록을 최신순으로 보여주고, ② 그 아래에 요리 도감(16종)을 보여줍니다.

const emptyState = document.getElementById('empty-state');
const recordList = document.getElementById('record-list');
const dexTiersWrap = document.getElementById('dex-tiers');
const recordProgress = document.getElementById('record-progress');

const modalBackdrop = document.getElementById('modal-backdrop');
const modalClose = document.getElementById('modal-close');
const modalDishName = document.getElementById('modal-dish-name');
const modalCount = document.getElementById('modal-count');
const modalTags = document.getElementById('modal-tags');
const modalHistory = document.getElementById('modal-history');

function loadRecords() {
  return JSON.parse(localStorage.getItem('jogak-records') || '[]');
}

function formatDate(isoString) {
  const date = new Date(isoString);
  return `${date.getFullYear()}.${date.getMonth() + 1}.${date.getDate()}`;
}

// ---------- ① 완성 기록 리스트 ----------
function renderRecordList(records) {
  if (records.length === 0) {
    emptyState.hidden = false;
    recordList.hidden = true;
    return;
  }

  emptyState.hidden = true;
  recordList.hidden = false;
  recordList.innerHTML = '';

  const sorted = [...records].sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt));

  sorted.forEach((record) => {
    const card = document.createElement('article');
    card.className = 'record-card';
    card.tabIndex = 0;
    card.setAttribute('role', 'button');
    card.innerHTML = `
      <h3 class="record-card-dish">🍽 ${record.dish}</h3>
      <p class="record-card-goal">${record.goal}</p>
      <div class="record-card-meta">
        <span class="dish-tag">${record.pieceCount}조각</span>
        <span class="dish-tag">${record.days}일 목표</span>
        <span class="dish-tag">${formatDate(record.completedAt)} 완성</span>
      </div>
    `;
    card.addEventListener('click', () => openRecordModal(record));
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') openRecordModal(record);
    });
    recordList.appendChild(card);
  });
}

function openRecordModal(record) {
  modalDishName.textContent = `${record.dish} 🍽`;
  modalCount.textContent = record.goal;

  modalTags.hidden = false;
  modalTags.innerHTML = `
    <span class="dish-tag">${record.pieceCount}조각</span>
    <span class="dish-tag">${record.days}일 목표</span>
    <span class="dish-tag">${formatDate(record.completedAt)} 완성</span>
  `;

  modalHistory.innerHTML = '';
  (record.pieces || []).forEach((piece, i) => {
    const li = document.createElement('li');
    li.innerHTML = `<strong>${i + 1}조각 · ${piece.title}</strong><span class="modal-history-meta">${piece.days}일</span>`;
    modalHistory.appendChild(li);
  });

  modalBackdrop.hidden = false;
}

// ---------- ② 요리 도감 ----------
function renderDex(records) {
  const unlockedDishes = new Set(records.map((r) => r.dish));
  const totalDishes = getAllDishes().length;

  recordProgress.textContent = `${unlockedDishes.size} / ${totalDishes}종 발견`;

  dexTiersWrap.innerHTML = '';

  DISH_TIERS.forEach((tier) => {
    const tierBlock = document.createElement('section');
    tierBlock.className = 'dex-tier';
    tierBlock.innerHTML = `<h3 class="dex-tier-title">${tier.label}</h3>`;

    const grid = document.createElement('div');
    grid.className = 'dex-grid';

    tier.dishes.forEach((dishName) => {
      const isUnlocked = unlockedDishes.has(dishName);
      const timesMade = records.filter((r) => r.dish === dishName).length;

      const tile = document.createElement('button');
      tile.type = 'button';
      tile.className = `dex-tile ${isUnlocked ? 'dex-tile--unlocked' : 'dex-tile--locked'}`;

      if (isUnlocked) {
        tile.innerHTML = `
          <span class="dex-tile-emoji">🥒</span>
          <span class="dex-tile-name">${dishName}</span>
          <span class="dex-tile-count">${timesMade}번 완성</span>
        `;
        tile.addEventListener('click', () => openDishModal(dishName, records));
      } else {
        tile.innerHTML = `
          <span class="dex-tile-emoji dex-tile-emoji--locked">❓</span>
          <span class="dex-tile-name">？？？</span>
        `;
        tile.disabled = true;
      }

      grid.appendChild(tile);
    });

    tierBlock.appendChild(grid);
    dexTiersWrap.appendChild(tierBlock);
  });
}

function openDishModal(dishName, records) {
  const matches = records
    .filter((r) => r.dish === dishName)
    .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt));

  modalDishName.textContent = `${dishName} 🍽`;
  modalCount.textContent = `지금까지 ${matches.length}번 완성했어요`;
  modalTags.hidden = true;
  modalTags.innerHTML = '';

  modalHistory.innerHTML = '';
  matches.forEach((record) => {
    const li = document.createElement('li');
    li.innerHTML = `
      <strong>${record.goal}</strong>
      <span class="modal-history-meta">${record.pieceCount}조각 · ${record.days}일 목표 · ${formatDate(record.completedAt)} 완성</span>
    `;
    modalHistory.appendChild(li);
  });

  modalBackdrop.hidden = false;
}

// ---------- 모달 공통 ----------
function closeModal() {
  modalBackdrop.hidden = true;
}

modalClose.addEventListener('click', closeModal);
modalBackdrop.addEventListener('click', (e) => {
  if (e.target === modalBackdrop) closeModal();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeModal();
});

// ---------- 초기 렌더링 ----------
const allRecords = loadRecords();
renderRecordList(allRecords);
renderDex(allRecords);
