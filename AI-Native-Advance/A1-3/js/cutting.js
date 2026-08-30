// cutting.js
// "오이 썰기" 페이지의 동작을 담당합니다.
// 지금은 실제 AI API 대신 가짜 데이터(mock)로 동작합니다.
// 6단계(백엔드 연동)에서 requestChopping() 함수 내부만 실제 fetch('/api/chop')로 교체하면 됩니다.

const formSection = document.getElementById('form-section');
const loadingSection = document.getElementById('loading-section');
const errorSection = document.getElementById('error-section');
const resultSection = document.getElementById('result-section');

const goalForm = document.getElementById('goal-form');
const goalInput = document.getElementById('goal-input');
const goalError = document.getElementById('goal-error');
const daysInput = document.getElementById('days-input');

const errorMessage = document.getElementById('error-message');
const retryBtn = document.getElementById('retry-btn');
const newGoalBtn = document.getElementById('new-goal-btn');

let currentPieces = []; // 현재 화면에 그려진 조각들 (기한 수정에 사용)
let currentGoal = '';
let currentTotalDays = 0;

// ---------- 기한 스테퍼 (클릭 + 꾹 누르기) ----------
function adjustDays(delta) {
  const current = parseInt(daysInput.value, 10) || 1;
  daysInput.value = Math.min(90, Math.max(1, current + delta));
}

function setupHoldableButton(button, delta) {
  let holdTimeout = null;
  let holdInterval = null;

  const start = () => {
    adjustDays(delta); // 첫 클릭은 즉시 반영
    holdTimeout = setTimeout(() => {
      holdInterval = setInterval(() => adjustDays(delta), 80); // 꾹 누르면 빠르게 증가
    }, 400);
  };

  const stop = () => {
    clearTimeout(holdTimeout);
    clearInterval(holdInterval);
  };

  button.addEventListener('mousedown', start);
  button.addEventListener('touchstart', (e) => { e.preventDefault(); start(); });
  ['mouseup', 'mouseleave', 'touchend', 'touchcancel'].forEach((evt) => {
    button.addEventListener(evt, stop);
  });
}

setupHoldableButton(document.getElementById('days-minus'), -1);
setupHoldableButton(document.getElementById('days-plus'), 1);

// ---------- 화면 전환 헬퍼 ----------
function showOnly(sectionToShow) {
  [formSection, loadingSection, errorSection, resultSection].forEach((section) => {
    section.hidden = section !== sectionToShow;
  });
}

// ---------- 총 기한을 조각 개수만큼 균등 분배 ----------
function distributeDays(totalDays, pieceCount) {
  const base = Math.floor(totalDays / pieceCount);
  const remainder = totalDays % pieceCount;
  // 나머지는 앞쪽 조각들에 하루씩 더 배분
  return Array.from({ length: pieceCount }, (_, i) => base + (i < remainder ? 1 : 0) || 1);
}

// ---------- 폼 제출 ----------
goalForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const goal = goalInput.value.trim();
  const days = parseInt(daysInput.value, 10);

  // 실패 처리 1: 빈 입력
  if (!goal) {
    goalError.hidden = false;
    goalInput.focus();
    return;
  }
  goalError.hidden = true;

  showOnly(loadingSection);

  try {
    const pieces = await requestChopping(goal, days);
    currentGoal = goal;
    currentTotalDays = days;
    renderResult(goal, days, pieces);
  } catch (err) {
    // 실패 처리 2, 3: API 오류 / 타임아웃
    showOnly(errorSection);
    if (err.message === 'timeout') {
      errorMessage.textContent = '응답이 너무 오래 걸리고 있어요. 잠시 후 다시 시도해주세요.';
    } else {
      errorMessage.textContent = '오이 손질사가 잠시 자리를 비웠어요. 잠시 후 다시 시도해주세요.';
    }
  }
});

retryBtn.addEventListener('click', () => {
  goalForm.requestSubmit();
});

newGoalBtn.addEventListener('click', () => {
  goalForm.reset();
  daysInput.value = 7;
  showOnly(formSection);
});

// ---------- (임시) 목업 API 호출 ----------
// TODO: 6단계에서 아래 함수 내부를 실제 fetch('/api/chop', {...})로 교체할 것
function requestChopping(goal, days) {
  return new Promise((resolve) => {
    setTimeout(() => {
      // 기한에 비례해 조각 개수를 임시로 결정 (실제로는 AI가 판단)
      const pieceCount = Math.min(10, Math.max(2, Math.round(days / 2)));
      const dayAllocation = distributeDays(days, pieceCount);
      const pieces = Array.from({ length: pieceCount }, (_, i) => ({
        title: `${goal} — ${i + 1}단계 (예시 조각)`,
        days: dayAllocation[i],
      }));
      resolve(pieces);
    }, 1500);
  });
}

// ---------- 결과 렌더링 ----------
function renderResult(goal, days, pieces) {
  currentPieces = pieces;

  const dish = pickDish(pieces.length);

  document.getElementById('result-eyebrow').textContent = `${days}일짜리 목표 · ${pieces.length}조각`;
  document.getElementById('result-title').textContent = `"${goal}" 손질 완료!`;

  const list = document.getElementById('pieces-list');
  list.innerHTML = '';

  pieces.forEach((piece, index) => {
    const li = document.createElement('li');
    li.className = 'piece-item';
    li.innerHTML = `
      <input type="checkbox" class="piece-checkbox" id="piece-${index}">
      <label class="piece-content" for="piece-${index}">
        <strong>${index + 1}조각 · ${piece.title}</strong>
      </label>
      <div class="piece-days-edit">
        <input type="number" class="piece-days-input" id="piece-days-${index}" value="${piece.days}" min="1" max="30">
        <span class="piece-days-unit">일</span>
      </div>
    `;
    list.appendChild(li);
  });

  showOnly(resultSection);
  updateProgress(dish);
  saveActivePlan(goal, days, pieces);

  list.querySelectorAll('.piece-checkbox').forEach((checkbox) => {
    checkbox.addEventListener('change', (e) => {
      e.target.closest('.piece-item').classList.toggle('done', e.target.checked);
      updateProgress(dish);
    });
  });

  list.querySelectorAll('.piece-days-input').forEach((input, index) => {
    input.addEventListener('change', () => {
      const newValue = Math.max(1, parseInt(input.value, 10) || 1);
      input.value = newValue;
      currentPieces[index].days = newValue;
      saveActivePlan(goal, days, currentPieces);
    });
  });
}

// ---------- 진행률 & 완료 처리 ----------
function updateProgress(dish) {
  const total = currentPieces.length;
  const doneCount = document.querySelectorAll('.piece-checkbox:checked').length;
  const percent = Math.round((doneCount / total) * 100);

  document.getElementById('progress-bar').style.width = `${percent}%`;
  document.getElementById('progress-label').textContent = `${total}조각 중 ${doneCount}조각 완성`;

  const banner = document.getElementById('completion-banner');
  if (doneCount === total) {
    banner.hidden = false;
    document.getElementById('completion-text').textContent = `오늘의 요리 완성! ${dish} 🎉`;
    saveToRecord(currentGoal, currentTotalDays, total, dish, currentPieces);
    clearActivePlan();
  } else {
    banner.hidden = true;
  }
}

// ---------- 캘린더 연동: 진행 중인 계획을 localStorage에 저장 ----------
function saveActivePlan(goal, totalDays, pieces) {
  let startDay = 0;
  const piecesWithOffsets = pieces.map((piece) => {
    const entry = { title: piece.title, days: piece.days, startDay, endDay: startDay + piece.days - 1 };
    startDay += piece.days;
    return entry;
  });

  const plan = {
    goal,
    totalDays,
    createdAt: new Date().toISOString(),
    pieces: piecesWithOffsets,
  };

  localStorage.setItem('jogak-active-plan', JSON.stringify(plan));
}

function clearActivePlan() {
  localStorage.removeItem('jogak-active-plan');
}

// ---------- localStorage에 완성 기록 저장 ----------
function saveToRecord(goal, days, pieceCount, dish, pieces) {
  const records = JSON.parse(localStorage.getItem('jogak-records') || '[]');

  // 같은 목표+기한 조합이 이미 저장되어 있으면 중복 저장하지 않음
  const alreadySaved = records.some((r) => r.goal === goal && r.days === days);
  if (alreadySaved) return;

  records.push({
    goal,
    days,
    pieceCount,
    dish,
    pieces: pieces.map((p) => ({ title: p.title, days: p.days })),
    completedAt: new Date().toISOString(),
  });

  localStorage.setItem('jogak-records', JSON.stringify(records));
}
