// calendar.js
// "캘린더" 페이지 — 통합 계획 저장소(jogak-plans) 중 "진행 중"(완성 안 된) 계획만 보여줍니다.
// 위: 이번 달 달력 위에 계획별로 색이 다른 막대가 이어짐
// 아래: 계획별 체크리스트 카드 (여기서 조각 체크/기한 수정/그만두기 가능)
//
// 완성 처리는 훨씬 단순해졌습니다: 계획을 다른 곳으로 옮기지 않고,
// 그냥 이 계획의 조각이 전부 체크됐는지(isPlanComplete)로 판단만 합니다.
// 완성되는 순간 전역 축하 팝업을 띄우고, 이 페이지 목록에서는 자연스럽게 빠집니다
// (나의 요리판에서 계속 확인/체크 해제할 수 있어요).

const PLAN_COLORS = ['#2F7448', '#C93A20', '#9A6A0B', '#3F6E8F', '#7A4F96', '#1F7A6C', '#A5622E', '#B8465A', '#4F7F3F', '#4F5F99']; // 흰 글자와의 명암비 4.5:1 이상

const calendarLayout = document.getElementById('calendar-layout');
const calendarPanel = document.getElementById('calendar-panel');
const plansPanel = document.getElementById('plans-panel');
const calendarGrid = document.getElementById('calendar-grid');
const calendarLegend = document.getElementById('calendar-legend');
const calendarSubtitle = document.getElementById('calendar-subtitle');
const calendarMonthLabel = document.getElementById('calendar-month-label');
const calendarPrevBtn = document.getElementById('calendar-prev');
const calendarNextBtn = document.getElementById('calendar-next');
const plansSummary = document.getElementById('plans-summary');
const plansEmpty = document.getElementById('plans-empty');
const activePlansList = document.getElementById('active-plans-list');
const todayPanel = document.getElementById('today-panel');
const todayList = document.getElementById('today-list');
const todaySub = document.getElementById('today-sub');

function addDays(date, n) {
  const result = new Date(date);
  result.setDate(result.getDate() + n);
  return result;
}

function isSameDate(a, b) {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

// 화면에 짧게 보여줄 "M/D" 형식
function toShortDateLabel(date) {
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function getMonthGrid(year, month) {
  const firstOfMonth = new Date(year, month, 1);
  const startOffset = firstOfMonth.getDay();
  const gridStart = addDays(firstOfMonth, -startOffset);
  const days = [];
  for (let i = 0; i < 42; i += 1) days.push(addDays(gridStart, i));
  return days;
}

let allPlans = [];      // 통합 저장소 전체 (완성 계획 포함) — 저장할 때 이걸 통째로 씀
let inProgressPlans = []; // allPlans 중 아직 완성 안 된 것만 (이 페이지에 보여줄 것)
let viewYear = null;     // 지금 달력에 보이는 연도 (좌우 이동으로 바뀜)
let viewMonth = null;    // 지금 달력에 보이는 월 (0~11)

// ---------- 글자를 화면에 넣을 때 HTML로 해석되지 않게 ----------
function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ---------- 목표 우선순위 (조각 순서는 그대로, 여러 목표 중 "무엇부터"만 정함) ----------
const PRIORITIES = {
  high: { label: '높음', rank: 0 },
  mid: { label: '보통', rank: 1 },
  low: { label: '낮음', rank: 2 },
};
const PRIORITY_CYCLE = ['high', 'mid', 'low'];

function getPriority(plan) {
  return PRIORITIES[plan.priority] ? plan.priority : 'mid'; // 예전에 저장된 계획은 값이 없으니 "보통"
}

function startOfToday() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

function planBaseDate(plan) {
  const base = new Date(plan.createdAt);
  base.setHours(0, 0, 0, 0);
  return base;
}

// 조각 하나를 체크/해제하고 저장 (조리하기 카드와 "오늘 할 조각"이 같이 씀)
function setPieceDone(planId, pieceIndex, done) {
  const plan = allPlans.find((p) => p.id === planId);
  if (!plan) return;
  plan.pieces[pieceIndex].done = done;

  if (isPlanComplete(plan)) {
    plan.completedAt = new Date().toISOString();
    savePlans(allPlans);
    showCompletionCelebration(plan.dish);
  } else {
    savePlans(allPlans);
  }
  renderAll();
}

function dueLabel(dueDate, today) {
  const diff = Math.round((dueDate - today) / 86400000);
  if (diff < 0) return { text: `${-diff}일 밀림`, cls: 'is-late' };
  if (diff === 0) return { text: '오늘', cls: 'is-today' };
  if (diff === 1) return { text: '내일', cls: '' };
  return { text: toShortDateLabel(dueDate), cls: '' };
}

// 목표마다 "아직 안 끝낸 가장 앞 조각" 하나만 후보 → 오늘/밀린 것 먼저, 같으면 우선순위 높은 순, 그다음 날짜 순
function buildTodayItems() {
  const today = startOfToday();
  const items = [];

  inProgressPlans.forEach((plan, planIndex) => {
    const pieceIndex = plan.pieces.findIndex((piece) => !piece.done);
    if (pieceIndex === -1) return;
    const dueDate = addDays(planBaseDate(plan), plan.pieces[pieceIndex].day);
    items.push({ plan, planIndex, pieceIndex, dueDate, isDue: dueDate <= today });
  });

  items.sort((a, b) => (
    (Number(b.isDue) - Number(a.isDue))
    || (PRIORITIES[getPriority(a.plan)].rank - PRIORITIES[getPriority(b.plan)].rank)
    || (a.dueDate - b.dueDate)
    || (a.planIndex - b.planIndex)
  ));

  return { items: items.slice(0, 3), dueCount: items.filter((item) => item.isDue).length, today };
}

function renderTodayPanel() {
  if (inProgressPlans.length === 0) {
    todayPanel.hidden = true;
    return;
  }

  const { items, dueCount, today } = buildTodayItems();
  const showPriority = inProgressPlans.length >= 2;
  todayPanel.hidden = false;
  todayList.innerHTML = '';

  todaySub.textContent = dueCount > 0
    ? `${dueCount}개 목표에서 지금 차례인 조각이에요`
    : '오늘 예정된 조각은 없어요. 다음 차례를 미리 볼 수 있어요';

  items.forEach((item) => {
    const { plan, pieceIndex, dueDate } = item;
    const piece = plan.pieces[pieceIndex];
    const due = dueLabel(dueDate, today);
    const colorIndex = inProgressPlans.indexOf(plan) % PLAN_COLORS.length;
    const priority = getPriority(plan);
    const doneCount = plan.pieces.filter((p) => p.done).length;
    const inputId = `today-${plan.id}-${pieceIndex}`;

    const li = document.createElement('li');
    li.className = 'today-item';
    li.innerHTML = `
      <input type="checkbox" class="today-checkbox" id="${inputId}" data-plan-id="${plan.id}" data-piece-index="${pieceIndex}" aria-label="${escapeHtml(piece.title)} 완료">
      <label class="today-body" for="${inputId}">
        <span class="today-goal-row">
          <span class="plan-color-dot" style="background:${PLAN_COLORS[colorIndex]}"></span>
          <span class="today-goal">${escapeHtml(plan.goal)}</span>
          <span class="today-step">${pieceIndex + 1}/${plan.pieces.length}조각</span>
          ${showPriority ? `<span class="priority-badge priority-badge--${priority}">우선순위 ${PRIORITIES[priority].label}</span>` : ''}
        </span>
        <span class="today-title">${escapeHtml(piece.title)}</span>
      </label>
      <span class="today-due ${due.cls}">${due.text}</span>
    `;
    todayList.appendChild(li);
  });

  todayList.querySelectorAll('.today-checkbox').forEach((checkbox) => {
    checkbox.addEventListener('change', (e) => {
      setPieceDone(e.target.dataset.planId, parseInt(e.target.dataset.pieceIndex, 10), e.target.checked);
    });
  });
}

// ---------- 전체 렌더링 ----------
function renderAll() {
  allPlans = loadPlans();
  inProgressPlans = allPlans.filter((p) => !isPlanComplete(p));

  // 아직 어떤 달을 볼지 정해진 적 없으면(첫 렌더), 진행 중인 계획이 있으면 그중 가장 이른 달로,
  // 없으면 오늘이 속한 달로 시작
  if (viewYear === null) {
    const now = new Date();
    viewYear = now.getFullYear();
    viewMonth = now.getMonth();

    // 이번 달에 걸쳐 있는 계획이 하나도 없으면, 곧 시작할 계획(없으면 가장 최근 계획)이 있는 달로
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    const range = (plan) => {
      const start = new Date(plan.createdAt);
      const end = new Date(start);
      end.setDate(end.getDate() + Math.max(1, plan.totalDays || 1) - 1);
      return { start, end };
    };
    const overlaps = inProgressPlans.some((plan) => {
      const { start, end } = range(plan);
      return start <= monthEnd && end >= monthStart;
    });
    if (!overlaps && inProgressPlans.length > 0) {
      const upcoming = inProgressPlans
        .map((plan) => range(plan).start)
        .filter((d) => d > monthEnd)
        .sort((a, b) => a - b)[0];
      const target = upcoming || inProgressPlans
        .map((plan) => range(plan).end)
        .sort((a, b) => b - a)[0];
      viewYear = target.getFullYear();
      viewMonth = target.getMonth();
    }
  }

  // 다시 그리는 동안 화면이 위아래로 튀지 않게 스크롤 위치·포커스를 붙잡아 둠
  const scrollY = window.scrollY;
  const focusedId = document.activeElement && document.activeElement.id;
  const root = document.documentElement;
  root.style.scrollBehavior = 'auto'; // 부드러운 스크롤이 켜져 있으면 복원 때 다시 미끄러짐

  renderTodayPanel();
  renderCalendar();
  renderPlansSummary();
  renderPlanCards();

  window.scrollTo(0, scrollY);
  if (focusedId) {
    const again = document.getElementById(focusedId);
    if (again) again.focus({ preventScroll: true });
  }
  requestAnimationFrame(() => { root.style.scrollBehavior = ''; });
}

// ---------- 달력 좌우 이동 ----------
calendarPrevBtn.addEventListener('click', () => {
  viewMonth -= 1;
  if (viewMonth < 0) { viewMonth = 11; viewYear -= 1; }
  renderCalendar();
});

calendarNextBtn.addEventListener('click', () => {
  viewMonth += 1;
  if (viewMonth > 11) { viewMonth = 0; viewYear += 1; }
  renderCalendar();
});

// ---------- 달력 ----------
function renderCalendar() {
  calendarMonthLabel.textContent = `${viewYear}년 ${viewMonth + 1}월`;
  calendarSubtitle.textContent = inProgressPlans.length > 0
    ? `${inProgressPlans.length}개의 목표가 진행 중이에요`
    : '이번 달 달력이에요. 진행 중인 목표를 추가해보세요.';

  const days = getMonthGrid(viewYear, viewMonth);
  calendarGrid.innerHTML = '';
  calendarLegend.innerHTML = '';

  days.forEach((date) => {
    const cell = document.createElement('div');
    cell.className = 'cal-day';
    if (date.getMonth() !== viewMonth) cell.classList.add('cal-day--outside');
    if (isSameDate(date, new Date())) cell.classList.add('cal-day--today');

    const dayNum = document.createElement('span');
    dayNum.className = 'cal-daynum';
    dayNum.textContent = date.getDate();
    cell.appendChild(dayNum);

    const barsWrap = document.createElement('div');
    barsWrap.className = 'cal-bars';

    inProgressPlans.forEach((plan, planIndex) => {
      const baseDate = new Date(plan.createdAt);
      baseDate.setHours(0, 0, 0, 0);
      const color = PLAN_COLORS[planIndex % PLAN_COLORS.length];

      const dayOffset = Math.round((date - baseDate) / (1000 * 60 * 60 * 24));
      if (dayOffset < 0 || dayOffset >= plan.totalDays) return; // 이 계획 기간 밖

      // 이 날짜에 배정된 조각(피스)들 — 사용자가 "며칠차"를 직접 정하므로,
      // 한 날짜에 여러 조각이 몰리거나 하나도 없을 수 있음.
      const piecesToday = plan.pieces.filter((p) => p.day === dayOffset);
      if (piecesToday.length === 0) return; // 이 날엔 배정된 조각이 없으면 막대 없음

      const bar = document.createElement('div');
      bar.className = 'cal-bar';
      bar.style.background = color;
      bar.title = `${plan.goal} · ${piecesToday.map((p) => p.title).join(', ')}`;

      // 조각이 있는 날들이 연속되면 하나로 이어진 오이처럼, 끊기면 양 끝이 둥글게.
      const prevDayHasPiece = plan.pieces.some((p) => p.day === dayOffset - 1);
      const nextDayHasPiece = plan.pieces.some((p) => p.day === dayOffset + 1);
      const isRowStart = date.getDay() === 0 || !prevDayHasPiece;
      const isRowEnd = date.getDay() === 6 || !nextDayHasPiece;
      if (isRowStart) bar.classList.add('cal-bar--start');
      if (isRowEnd) bar.classList.add('cal-bar--end');

      // 이 계획에서 조각이 배정된 가장 이른 날에만 목표 이름을 라벨로 보여줌
      const firstPieceDay = Math.min(...plan.pieces.map((p) => p.day));
      if (dayOffset === firstPieceDay) {
        bar.textContent = plan.goal.length > 6 ? `${plan.goal.slice(0, 6)}…` : plan.goal;
      }

      barsWrap.appendChild(bar);
    });

    cell.appendChild(barsWrap);
    calendarGrid.appendChild(cell);
  });

  inProgressPlans.forEach((plan, index) => {
    const doneCount = plan.pieces.filter((p) => p.done).length;
    const item = document.createElement('div');
    item.className = 'legend-item';
    item.innerHTML = `
      <span class="legend-swatch" style="background:${PLAN_COLORS[index % PLAN_COLORS.length]}"></span>
      <span>${escapeHtml(plan.goal)} (${doneCount}/${plan.pieces.length}조각)</span>
    `;
    calendarLegend.appendChild(item);
  });

  syncPanelHeights();
}

// ---------- 오른쪽 패널 높이를 캘린더 높이에 맞춤 (반대 방향으로는 절대 안 늘어남) ----------
function syncPanelHeights() {
  // 좁은 화면(모바일)에서는 세로로 쌓이는 레이아웃이라 높이를 맞출 필요가 없음
  if (window.innerWidth <= 880) {
    plansPanel.style.height = '';
    return;
  }
  plansPanel.style.height = `${calendarPanel.offsetHeight}px`;
}

let resizeTimer = null;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(syncPanelHeights, 150);
});

// ---------- 전체 요약 (진행 중인 게 없으면 오른쪽 패널 안에 안내로 대체) ----------
function renderPlansSummary() {
  if (inProgressPlans.length === 0) {
    plansSummary.hidden = true;
    plansEmpty.hidden = false;
    activePlansList.hidden = true;
    return;
  }

  plansSummary.hidden = false;
  plansEmpty.hidden = true;
  activePlansList.hidden = false;

  const totalPieces = inProgressPlans.reduce((sum, p) => sum + p.pieces.length, 0);
  const totalDone = inProgressPlans.reduce((sum, p) => sum + p.pieces.filter((piece) => piece.done).length, 0);
  plansSummary.textContent = `${inProgressPlans.length}개의 목표 진행 중 · 총 ${totalDone}/${totalPieces}조각 완료`;
}

// ---------- 삭제/수정 전 한 번 더 물어보는 공통 확인 팝업 ----------
const confirmBackdrop = document.getElementById('confirm-modal-backdrop');
const confirmMessage = document.getElementById('confirm-modal-message');
const confirmCancelBtn = document.getElementById('confirm-modal-cancel');
const confirmConfirmBtn = document.getElementById('confirm-modal-confirm');
let pendingConfirmAction = null;

function showConfirm(message, onConfirm) {
  confirmMessage.textContent = message;
  pendingConfirmAction = onConfirm;
  confirmBackdrop.hidden = false;
}

function hideConfirm() {
  confirmBackdrop.hidden = true;
  pendingConfirmAction = null;
}

confirmCancelBtn.addEventListener('click', hideConfirm);
confirmConfirmBtn.addEventListener('click', () => {
  const action = pendingConfirmAction;
  hideConfirm();
  if (action) action();
});
confirmBackdrop.addEventListener('click', (e) => {
  if (e.target === confirmBackdrop) hideConfirm();
});

// ---------- 계획별 체크리스트 카드 (드롭다운으로 열고 닫기 / 편집모드에서 선택·삭제·순서이동) ----------
const expandedPlanIds = new Set(); // 펼쳐진 계획의 id들 (렌더링 다시 해도 유지됨)
const selectedPlanIds = new Set(); // 편집 모드에서 체크된 계획의 id들
let editModeActive = false;

const editModeToggleBtn = document.getElementById('edit-mode-toggle');
const bulkActionsBar = document.getElementById('bulk-actions-bar');
const bulkSelectedCount = document.getElementById('bulk-selected-count');
const bulkDeleteBtn = document.getElementById('bulk-delete-btn');
const bulkSelectAllCheckbox = document.getElementById('bulk-select-all-checkbox');

function updateBulkBar() {
  bulkActionsBar.hidden = !editModeActive;
  bulkSelectedCount.textContent = `${selectedPlanIds.size}개 선택됨`;
  bulkDeleteBtn.disabled = selectedPlanIds.size === 0;

  if (inProgressPlans.length === 0) {
    bulkSelectAllCheckbox.checked = false;
    bulkSelectAllCheckbox.indeterminate = false;
    bulkSelectAllCheckbox.disabled = true;
  } else {
    bulkSelectAllCheckbox.disabled = false;
    const allSelected = inProgressPlans.every((p) => selectedPlanIds.has(p.id));
    bulkSelectAllCheckbox.checked = allSelected;
    bulkSelectAllCheckbox.indeterminate = !allSelected && selectedPlanIds.size > 0;
  }
}

bulkSelectAllCheckbox.addEventListener('change', (e) => {
  if (e.target.checked) {
    inProgressPlans.forEach((p) => selectedPlanIds.add(p.id));
  } else {
    selectedPlanIds.clear();
  }
  renderPlanCards();
  updateBulkBar();
});

editModeToggleBtn.addEventListener('click', () => {
  editModeActive = !editModeActive;
  selectedPlanIds.clear();
  editModeToggleBtn.textContent = editModeActive ? '완료' : '편집';
  editModeToggleBtn.classList.toggle('is-active', editModeActive);
  updateBulkBar();
  renderPlanCards();
});

bulkDeleteBtn.addEventListener('click', () => {
  if (selectedPlanIds.size === 0) return;
  showConfirm(`선택한 ${selectedPlanIds.size}개의 목표를 정말 삭제할까요?\n지금까지의 진행 상황은 되돌릴 수 없어요.`, () => {
    allPlans = allPlans.filter((p) => !selectedPlanIds.has(p.id));
    savePlans(allPlans);
    selectedPlanIds.clear();
    renderAll();
    updateBulkBar();
  });
});

function movePlanOrder(planId, direction) {
  const currentIndex = inProgressPlans.findIndex((p) => p.id === planId);
  const targetIndex = currentIndex + direction;
  if (currentIndex === -1 || targetIndex < 0 || targetIndex >= inProgressPlans.length) return;

  const idxA = allPlans.findIndex((p) => p.id === inProgressPlans[currentIndex].id);
  const idxB = allPlans.findIndex((p) => p.id === inProgressPlans[targetIndex].id);
  [allPlans[idxA], allPlans[idxB]] = [allPlans[idxB], allPlans[idxA]];

  savePlans(allPlans);
  renderAll();
}

function renderPlanCards() {
  activePlansList.innerHTML = '';

  inProgressPlans.forEach((plan, planIndex) => {
    const color = PLAN_COLORS[planIndex % PLAN_COLORS.length];
    const doneCount = plan.pieces.filter((p) => p.done).length;
    const percent = Math.round((doneCount / plan.pieces.length) * 100);
    const isOpen = expandedPlanIds.has(plan.id);
    const isSelected = selectedPlanIds.has(plan.id);

    const card = document.createElement('article');
    card.className = 'plan-card';

    const baseDateForPieces = new Date(plan.createdAt);
    baseDateForPieces.setHours(0, 0, 0, 0);

    const piecesHtml = plan.pieces.map((piece, i) => {
      const pieceDate = addDays(baseDateForPieces, piece.day);

      return `
      <li class="piece-item ${piece.done ? 'done' : ''}">
        <input type="checkbox" class="piece-checkbox" id="plan-${plan.id}-piece-${i}" ${piece.done ? 'checked' : ''} data-plan-id="${plan.id}" data-piece-index="${i}">
        <label class="piece-content" for="plan-${plan.id}-piece-${i}">
          <span class="piece-num" style="--piece-color:${color}" aria-hidden="true">${i + 1}</span>
          <span class="piece-title">${escapeHtml(piece.title)}</span>
        </label>
        <button type="button" class="edit-text-btn" data-edit="piece" data-plan-id="${plan.id}" data-piece-index="${i}" aria-label="${i + 1}조각 내용 수정" title="내용 수정">✎</button>
        <div class="piece-day-edit">
          <input type="number" class="piece-day-input" value="${piece.day + 1}" min="1" max="${plan.totalDays}" data-plan-id="${plan.id}" data-piece-index="${i}" aria-label="${i + 1}조각 며칠차">
          <span class="piece-day-unit">일차</span>
          <span class="piece-day-date">(${toShortDateLabel(pieceDate)})</span>
        </div>
      </li>
    `;
    }).join('');

    const moveControlsHtml = editModeActive ? `
      <div class="plan-move-controls">
        <button type="button" class="plan-icon-btn plan-move-up-btn" data-plan-id="${plan.id}" aria-label="위로 이동" ${planIndex === 0 ? 'disabled' : ''}>▲</button>
        <button type="button" class="plan-icon-btn plan-move-down-btn" data-plan-id="${plan.id}" aria-label="아래로 이동" ${planIndex === inProgressPlans.length - 1 ? 'disabled' : ''}>▼</button>
      </div>
    ` : '';

    card.innerHTML = `
      <div class="plan-card-top">
        ${editModeActive ? `<input type="checkbox" class="plan-select-checkbox" data-plan-id="${plan.id}" ${isSelected ? 'checked' : ''} aria-label="${escapeHtml(plan.goal)} 선택">` : ''}
        <span class="plan-color-dot" style="background:${color}"></span>
        <h3 class="plan-card-goal">${escapeHtml(plan.goal)}</h3>
        ${inProgressPlans.length >= 2 ? `<button type="button" class="priority-chip priority-chip--${getPriority(plan)}" data-plan-id="${plan.id}" aria-label="우선순위 ${PRIORITIES[getPriority(plan)].label}. 누르면 바뀌어요" title="누르면 우선순위가 바뀌어요">우선순위 ${PRIORITIES[getPriority(plan)].label}</button>` : ''}
        <button type="button" class="edit-text-btn" data-edit="goal" data-plan-id="${plan.id}" aria-label="목표 이름 수정" title="목표 이름 수정">✎</button>
      </div>

      ${moveControlsHtml}

      <button type="button" class="plan-card-chips-row ${isOpen ? 'is-open' : ''}" data-plan-id="${plan.id}" aria-expanded="${isOpen}" aria-controls="plan-body-${plan.id}">
        <span class="dish-tag">🍽 ${plan.dish}</span>
        <span class="dish-tag">${plan.totalDays}일 목표</span>
        <span class="plan-progress-badge">${doneCount}/${plan.pieces.length}조각</span>
        <span class="plan-card-caret" aria-hidden="true">▾</span>
      </button>

      <div class="plan-card-body" id="plan-body-${plan.id}">
        <div class="plan-card-body-inner">
          <ol class="pieces-list">${piecesHtml}</ol>

          <div class="progress-bar-wrap">
            <div class="progress-bar" style="width:${percent}%; background:${color}"></div>
          </div>
          <p class="progress-label">${plan.pieces.length}조각 중 ${doneCount}조각 완성</p>
        </div>
      </div>
    `;

    activePlansList.appendChild(card);

    if (isOpen) {
      const body = card.querySelector('.plan-card-body');
      // 새로 그린 카드가 0에서 슬금슬금 펼쳐지면 페이지 높이가 변해 스크롤이 튀므로, 애니메이션 없이 바로 펼침
      body.style.transition = 'none';
      body.style.maxHeight = `${body.scrollHeight}px`;
      void body.offsetHeight;
      body.style.transition = '';
    }
  });

  // 카드 클릭 → 펼치기/접기 (다른 카드는 그대로 둠)
  activePlansList.querySelectorAll('.plan-card-chips-row').forEach((toggleBtn) => {
    toggleBtn.addEventListener('click', () => {
      const planId = toggleBtn.dataset.planId;
      const body = document.getElementById(`plan-body-${planId}`);
      const willOpen = !expandedPlanIds.has(planId);

      if (willOpen) {
        expandedPlanIds.add(planId);
        body.style.maxHeight = `${body.scrollHeight}px`;
      } else {
        expandedPlanIds.delete(planId);
        body.style.maxHeight = '0px';
      }

      toggleBtn.classList.toggle('is-open', willOpen);
      toggleBtn.setAttribute('aria-expanded', String(willOpen));
    });
  });

  // 편집 모드: 선택 체크박스
  activePlansList.querySelectorAll('.plan-select-checkbox').forEach((checkbox) => {
    checkbox.addEventListener('change', (e) => {
      const planId = e.target.dataset.planId;
      if (e.target.checked) selectedPlanIds.add(planId);
      else selectedPlanIds.delete(planId);
      updateBulkBar();
    });
  });

  // 편집 모드: 순서 이동
  activePlansList.querySelectorAll('.plan-move-up-btn').forEach((btn) => {
    btn.addEventListener('click', () => movePlanOrder(btn.dataset.planId, -1));
  });
  activePlansList.querySelectorAll('.plan-move-down-btn').forEach((btn) => {
    btn.addEventListener('click', () => movePlanOrder(btn.dataset.planId, 1));
  });

  // 체크박스 이벤트
  activePlansList.querySelectorAll('.piece-checkbox').forEach((checkbox) => {
    checkbox.addEventListener('change', (e) => {
      setPieceDone(e.target.dataset.planId, parseInt(e.target.dataset.pieceIndex, 10), e.target.checked);
    });
  });

  // 우선순위 칩: 높음 → 보통 → 낮음 순으로 바뀜
  activePlansList.querySelectorAll('.priority-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      const plan = allPlans.find((p) => p.id === chip.dataset.planId);
      if (!plan) return;
      const next = PRIORITY_CYCLE[(PRIORITY_CYCLE.indexOf(getPriority(plan)) + 1) % PRIORITY_CYCLE.length];
      plan.priority = next;
      savePlans(allPlans);
      renderAll();
    });
  });

  // 조각별 며칠차 수정 이벤트
  activePlansList.querySelectorAll('.piece-day-input').forEach((input) => {
    input.addEventListener('change', () => {
      const planId = input.dataset.planId;
      const pieceIndex = parseInt(input.dataset.pieceIndex, 10);
      const plan = allPlans.find((p) => p.id === planId);
      const newDayNumber = Math.max(1, Math.min(plan.totalDays, parseInt(input.value, 10) || 1));
      input.value = newDayNumber;

      plan.pieces[pieceIndex].day = newDayNumber - 1;

      savePlans(allPlans);
      renderAll();
    });
  });

}

// ---------- 목표 이름 · 조각 내용 고치기 (연필 버튼 → 그 자리에서 입력, Enter/바깥 클릭=저장, Esc=취소) ----------
activePlansList.addEventListener('click', (e) => {
  const btn = e.target.closest('.edit-text-btn');
  if (!btn || btn.dataset.editing) return;

  const plan = allPlans.find((p) => p.id === btn.dataset.planId);
  if (!plan) return;

  const isGoal = btn.dataset.edit === 'goal';
  const pieceIndex = parseInt(btn.dataset.pieceIndex, 10);
  const target = isGoal
    ? btn.parentElement.querySelector('.plan-card-goal')
    : btn.parentElement.querySelector('.piece-content');
  const currentText = isGoal ? plan.goal : plan.pieces[pieceIndex].title;

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'edit-text-input';
  input.value = currentText;
  input.maxLength = isGoal ? 100 : 150;
  input.setAttribute('aria-label', isGoal ? '목표 이름' : `${pieceIndex + 1}조각 내용`);

  btn.dataset.editing = '1';
  btn.hidden = true;
  target.replaceWith(input);
  input.focus({ preventScroll: true });
  input.select();

  let finished = false;
  const finish = (save) => {
    if (finished) return;
    finished = true;
    const next = input.value.trim();
    if (save && next && next !== currentText) {
      if (isGoal) plan.goal = next;
      else plan.pieces[pieceIndex].title = next;
      savePlans(allPlans);
    }
    renderAll(); // 저장했든 취소했든 화면을 새로 그려서 원래 모양으로 되돌림
  };

  input.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter') { ev.preventDefault(); finish(true); }
    else if (ev.key === 'Escape') { ev.preventDefault(); finish(false); }
  });
  input.addEventListener('blur', () => finish(true));
});

renderAll();
