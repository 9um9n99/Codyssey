// record.js
// "나의 요리판" 페이지 — 통합 계획 저장소(jogak-plans)의 모든 계획을
// 완성/진행중 구분 없이 같이 보여주되, 색으로 상태를 구분합니다.
// 그 아래엔 요리 레시피북(24종)을 목차 ↔ 상세 페이지 넘김 형태로 보여줍니다.
//
// 완성 여부는 그때그때 isPlanComplete()로 판단하므로,
// 완성된 계획의 체크를 풀면 자연스럽게 "진행 중"으로 돌아가고,
// 다시 체크해도 같은 계획이라 완성 횟수가 중복으로 늘지 않습니다.

const emptyState = document.getElementById('empty-state');
const recordList = document.getElementById('record-list');
const recordTabEmpty = document.getElementById('record-tab-empty');
const recordProgressLink = document.getElementById('record-progress-link');
const bookTocWrap = document.getElementById('book-toc-wrap');
const bookTocPagination = document.getElementById('book-toc-pagination');
const bookTocPrevBtn = document.getElementById('book-toc-prev');
const bookTocNextBtn = document.getElementById('book-toc-next');
const bookTocPageDots = document.getElementById('book-toc-page-dots');
const recipeBook = document.getElementById('recipe-book');
const bookBack = document.getElementById('book-back');
const bookDetailPhotoImg = document.getElementById('book-detail-photo-img');
const bookDetailNumber = document.getElementById('book-detail-number');
const bookDetailName = document.getElementById('book-detail-name');
const bookDetailDesc = document.getElementById('book-detail-desc');
const bookDetailHistoryList = document.getElementById('book-detail-history-list');
const bookDetailPrevBtn = document.getElementById('book-detail-prev');
const bookDetailNextBtn = document.getElementById('book-detail-next');

const modalBackdrop = document.getElementById('modal-backdrop');
const modalClose = document.getElementById('modal-close');
const modalDishName = document.getElementById('modal-dish-name');
const modalCount = document.getElementById('modal-count');
const modalTags = document.getElementById('modal-tags');
const modalFlavor = document.getElementById('modal-flavor');
const modalHistory = document.getElementById('modal-history');

let allPlans = [];

// 글자를 화면에 넣을 때 HTML로 해석되지 않게
function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function formatDate(isoString) {
  const date = new Date(isoString);
  return `${date.getFullYear()}.${date.getMonth() + 1}.${date.getDate()}`;
}

// ---------- 전체 렌더링 ----------
function renderPage() {
  allPlans = loadPlans();
  renderSummary();
  renderPlanList();
  renderBookToc();
}

// ---------- 상단 요약: 수집 현황 · 진행 중 요리로 가는 길 ----------
function renderSummary() {
  const completePlans = allPlans.filter(isPlanComplete);
  const inProgressCount = allPlans.length - completePlans.length;
  if (inProgressCount > 0) {
    recordProgressLink.hidden = false;
    recordProgressLink.innerHTML = `<span>진행 중인 요리가 ${inProgressCount}개 있어요</span><span>조리하기에서 이어가기 →</span>`;
  } else {
    recordProgressLink.hidden = true;
  }
}

// ---------- ① 완성한 요리 목록 (누르면 레시피북의 그 요리 페이지로 열림) ----------
function renderPlanList() {
  if (allPlans.length === 0) {
    emptyState.hidden = false;
    recordList.hidden = true;
    recordTabEmpty.hidden = true;
    return;
  }

  emptyState.hidden = true;
  recordList.innerHTML = '';

  const done = allPlans
    .filter(isPlanComplete)
    .sort((a, b) => new Date(b.completedAt || 0) - new Date(a.completedAt || 0));

  if (done.length === 0) {
    recordList.hidden = true;
    recordTabEmpty.hidden = false;
    recordTabEmpty.innerHTML = '아직 완성한 요리가 없어요.<br>목표의 조각을 모두 체크하면 여기에 쌓이고, 레시피북이 하나씩 채워져요.<a class="record-tab-empty-link" href="calendar.html">조리하기에서 이어가기 →</a>';
    return;
  }

  recordList.hidden = false;
  recordTabEmpty.hidden = true;

  done.forEach((plan) => {
    const card = document.createElement('article');
    card.className = 'record-card record-card--done';
    card.tabIndex = 0;
    card.setAttribute('role', 'button');
    card.setAttribute('aria-label', `${plan.dish} 레시피북에서 보기`);

    card.innerHTML = `
      <img class="record-card-thumb" src="${getDishImagePath(plan.dish)}" alt="" loading="lazy">
      <div class="record-card-top">
        <h3 class="record-card-dish">${escapeHtml(plan.dish)}${isRareDish(plan.dish) ? ' ✨' : ''}</h3>
      </div>
      <p class="record-card-goal">${escapeHtml(plan.goal)}</p>
      <div class="record-card-meta">
        <span class="dish-tag">${plan.pieces.length}조각</span>
        <span class="dish-tag">${plan.totalDays}일 목표</span>
        <span class="dish-tag">${formatDate(plan.completedAt)} 완성</span>
      </div>
      <p class="record-open-hint">레시피북에서 보기 →</p>
    `;
    const open = () => openBookForDish(plan.dish);
    card.addEventListener('click', open);
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
    });
    recordList.appendChild(card);
  });
}

// 완성 카드를 누르면: 책을 펼치고 그 요리의 상세 페이지로 이동
function openBookForDish(dishName) {
  const completePlans = allPlans.filter(isPlanComplete);
  const dishNumber = getAllDishes().indexOf(dishName) + 1;
  setBookOpened();
  openBookDetail(dishName, dishNumber, completePlans);
  document.querySelector('.book-panel').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function openPlanModal(planId) {
  const plan = allPlans.find((p) => p.id === planId);
  const complete = isPlanComplete(plan);

  modalDishName.textContent = `${plan.dish} 🍽`;
  modalCount.textContent = plan.goal;

  modalTags.hidden = false;
  modalTags.innerHTML = `
    <span class="dish-tag">${plan.pieces.length}조각</span>
    <span class="dish-tag">${plan.totalDays}일 목표</span>
    ${complete ? `<span class="dish-tag">${formatDate(plan.completedAt)} 완성</span>` : ''}
  `;

  modalFlavor.hidden = false;
  modalFlavor.textContent = DISH_DESCRIPTIONS[plan.dish] || '';

  modalHistory.innerHTML = '';
  modalHistory.classList.add('modal-history--checklist');

  plan.pieces.forEach((piece, i) => {
    const li = document.createElement('li');
    li.className = `piece-item ${piece.done ? 'done' : ''}`;
    li.innerHTML = `
      <input type="checkbox" class="piece-checkbox" id="modal-piece-${i}" ${piece.done ? 'checked' : ''}>
      <label class="piece-content" for="modal-piece-${i}">
        <strong>${i + 1}조각 · ${piece.title}</strong>
        <span class="piece-time">${piece.day + 1}일차</span>
      </label>
    `;
    modalHistory.appendChild(li);
  });

  modalHistory.querySelectorAll('.piece-checkbox').forEach((checkbox, i) => {
    checkbox.addEventListener('change', (e) => {
      plan.pieces[i].done = e.target.checked;
      e.target.closest('.piece-item').classList.toggle('done', e.target.checked);

      const nowComplete = isPlanComplete(plan);
      plan.completedAt = nowComplete ? new Date().toISOString() : null;

      savePlans(allPlans);

      if (nowComplete) {
        showCompletionCelebration(plan.dish);
      }

      renderPlanList();
      renderBookToc();
    });
  });

  modalBackdrop.hidden = false;
}

// ---------- ② 요리 레시피북 (목차 ↔ 상세 페이지 넘김) ----------
const BOOK_TOC_PAGE_SIZE = 9;
let currentTocPage = 0; // 0부터 시작

function renderBookToc() {
  const completePlans = allPlans.filter(isPlanComplete);
  const unlockedDishes = new Set(completePlans.map((p) => p.dish));
  const allDishes = getAllDishes();
  const totalPages = Math.max(1, Math.ceil(allDishes.length / BOOK_TOC_PAGE_SIZE));

  // 요리 수가 바뀌어서 지금 페이지가 범위를 벗어나면 마지막 페이지로 보정
  if (currentTocPage > totalPages - 1) currentTocPage = totalPages - 1;

  bookTocWrap.innerHTML = '';

  const grid = document.createElement('ul');
  grid.className = 'book-toc-grid';

  const pageStart = currentTocPage * BOOK_TOC_PAGE_SIZE;
  const pageEnd = pageStart + BOOK_TOC_PAGE_SIZE;

  allDishes.forEach((dishName, index) => {
    if (index < pageStart || index >= pageEnd) return; // 이 페이지에 속하지 않으면 건너뜀

    const dishNumber = index + 1;
    const isUnlocked = unlockedDishes.has(dishName);

    const li = document.createElement('li');
    li.className = `book-toc-tile ${isUnlocked ? 'book-toc-tile--unlocked' : 'book-toc-tile--locked'}`;

    if (isUnlocked) {
      const timesMade = completePlans.filter((p) => p.dish === dishName).length;
      const rare = isRareDish(dishName);
      li.classList.toggle('book-toc-tile--rare', rare);
      const badge = rare ? ' ✨' : '';
      li.innerHTML = `
        <button type="button" class="book-toc-tile-btn">
          <span class="book-toc-tile-num">${dishNumber}</span>
          <span class="book-toc-tile-name">${dishName}${badge}</span>
          <span class="book-toc-tile-count">${timesMade}번</span>
        </button>
      `;
      li.querySelector('.book-toc-tile-btn').addEventListener('click', () => openBookDetail(dishName, dishNumber, completePlans));
    } else {
      li.innerHTML = `
        <div class="book-toc-tile-locked-content">
          <span class="book-toc-tile-num">${dishNumber}</span>
          <span class="book-toc-tile-name book-toc-tile-name--locked">？</span>
        </div>
      `;
    }

    grid.appendChild(li);
  });

  bookTocWrap.appendChild(grid);
  renderBookTocPagination(totalPages);
}

function renderBookTocPagination(totalPages) {
  if (totalPages <= 1) {
    bookTocPagination.hidden = true;
    return;
  }

  bookTocPagination.hidden = false;
  bookTocPrevBtn.disabled = currentTocPage === 0;
  bookTocNextBtn.disabled = currentTocPage === totalPages - 1;

  bookTocPageDots.innerHTML = '';
  for (let i = 0; i < totalPages; i += 1) {
    const dot = document.createElement('button');
    dot.type = 'button';
    dot.className = `book-toc-page-dot ${i === currentTocPage ? 'is-active' : ''}`;
    dot.textContent = String(i + 1);
    dot.setAttribute('aria-label', `${i + 1}페이지로 이동`);
    dot.addEventListener('click', () => {
      currentTocPage = i;
      renderBookToc();
    });
    bookTocPageDots.appendChild(dot);
  }
}

bookTocPrevBtn.addEventListener('click', () => {
  if (currentTocPage === 0) return;
  currentTocPage -= 1;
  renderBookToc();
});

bookTocNextBtn.addEventListener('click', () => {
  currentTocPage += 1;
  renderBookToc();
});

let currentDetailDish = null; // 지금 상세 페이지에서 보고 있는 요리 이름 (좌우 넘기기용)

// 도감에 있는 순서(1~25) 그대로, 지금까지 완성해서 잠금 해제된 요리 이름만 추림
function getUnlockedDishOrder(completePlans) {
  const unlockedSet = new Set(completePlans.map((p) => p.dish));
  return getAllDishes().filter((d) => unlockedSet.has(d));
}

function openBookDetail(dishName, dishNumber, completePlans) {
  currentDetailDish = dishName;

  const matches = completePlans
    .filter((p) => p.dish === dishName)
    .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt));

  const rare = isRareDish(dishName);

  bookDetailNumber.textContent = rare ? '✨ 레어 레시피' : `No. ${dishNumber}`;
  bookDetailNumber.classList.toggle('book-detail-number--rare', rare);
  bookDetailName.textContent = dishName;
  bookDetailName.classList.toggle('book-detail-name--rare', rare);
  bookDetailPhotoImg.parentElement.classList.toggle('book-detail-photo--rare', rare);
  bookDetailDesc.textContent = DISH_DESCRIPTIONS[dishName] || '';

  bookDetailPhotoImg.src = getDishImagePath(dishName);

  bookDetailHistoryList.innerHTML = '';
  matches.forEach((plan) => {
    const li = document.createElement('li');
    li.innerHTML = `
      <strong>${escapeHtml(plan.goal)}</strong>
      <span class="modal-history-meta">${plan.pieces.length}조각 · ${plan.totalDays}일 목표 · ${formatDate(plan.completedAt)} 완성</span>
    `;
    bookDetailHistoryList.appendChild(li);
  });

  // 잠금 해제된 요리가 하나뿐이면 좌우로 넘길 데가 없으니 화살표 비활성화
  const unlockedOrder = getUnlockedDishOrder(completePlans);
  const onlyOneUnlocked = unlockedOrder.length <= 1;
  bookDetailPrevBtn.disabled = onlyOneUnlocked;
  bookDetailNextBtn.disabled = onlyOneUnlocked;

  recipeBook.classList.add('showing-detail');
}

function goToAdjacentDish(direction) {
  const completePlans = allPlans.filter(isPlanComplete);
  const unlockedOrder = getUnlockedDishOrder(completePlans);
  if (unlockedOrder.length <= 1) return;

  const currentIndex = unlockedOrder.indexOf(currentDetailDish);
  const nextIndex = (currentIndex + direction + unlockedOrder.length) % unlockedOrder.length;
  const nextDishName = unlockedOrder[nextIndex];
  const nextDishNumber = getAllDishes().indexOf(nextDishName) + 1;

  openBookDetail(nextDishName, nextDishNumber, completePlans);
}

bookDetailPrevBtn.addEventListener('click', () => goToAdjacentDish(-1));
bookDetailNextBtn.addEventListener('click', () => goToAdjacentDish(1));

bookBack.addEventListener('click', () => {
  recipeBook.classList.remove('showing-detail');
});

// ---------- 표지 클릭 → 책 펼치기 ----------
const bookCoverView = document.getElementById('book-cover-view');
const BOOK_OPENED_KEY = 'jogak-book-opened';

// 한 번 펼쳐본 뒤에는 다음 방문부터 바로 목차가 보이게 기억 (저장소를 못 쓰는 환경이어도 동작에는 지장 없음)
function setBookOpened() {
  recipeBook.classList.add('book-opened');
  try { localStorage.setItem(BOOK_OPENED_KEY, '1'); } catch (err) { /* 저장 실패는 무시 */ }
}
bookCoverView.addEventListener('click', setBookOpened);
bookCoverView.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    setBookOpened();
  }
});

// ---------- 모달 공통 (완성/진행 중 계획 상세) ----------
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

renderPage();

// ---------- 처음 열 때: 책은 이미 펼쳐본 적 있으면 펼친 채로, 가장 최근에 완성한 요리가 있는 쪽으로 ----------
(function setInitialView() {
  let opened = false;
  try { opened = localStorage.getItem(BOOK_OPENED_KEY) === '1'; } catch (err) { opened = false; }
  if (opened) {
    recipeBook.classList.add('no-flip-anim'); // 열린 채로 시작할 때는 넘기는 애니메이션 없이
    recipeBook.classList.add('book-opened');
    requestAnimationFrame(() => requestAnimationFrame(() => recipeBook.classList.remove('no-flip-anim')));
  }

  const completePlans = allPlans.filter(isPlanComplete);
  if (completePlans.length === 0) return;
  const latest = [...completePlans].sort((a, b) => new Date(b.completedAt || 0) - new Date(a.completedAt || 0))[0];
  const dishIndex = getAllDishes().indexOf(latest.dish);
  if (dishIndex >= 0) {
    currentTocPage = Math.floor(dishIndex / BOOK_TOC_PAGE_SIZE);
    renderBookToc();
  }
}());
