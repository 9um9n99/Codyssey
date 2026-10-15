// cutting.js
// 홈(조각내기) 화면 — 목표를 입력받아 Claude API(/api/chop)로 조각내고,
// 통합 계획 저장소(jogak-plans)에 저장한 뒤, 바로 이 페이지에서
// 만들어질 요리와 조각 구성을 미리 보여줍니다.
// "요리하러 가기" 버튼을 눌러야 캘린더로 넘어가서 실제로 체크하며 진행해요.
// 흐름: 조각내기 → 조리하기(캘린더) → 나의요리(요리판)

const formSection = document.getElementById('form-section');
const loadingSection = document.getElementById('loading-section');
const errorSection = document.getElementById('error-section');
const previewSection = document.getElementById('preview-section');

const goalForm = document.getElementById('goal-form');
const goalInput = document.getElementById('goal-input');
const goalError = document.getElementById('goal-error');
const daysInput = document.getElementById('days-input');
const startDateInput = document.getElementById('start-date-input');
const endDateInput = document.getElementById('end-date-input');
const errorMessage = document.getElementById('error-message');
const retryBtn = document.getElementById('retry-btn');
const newGoalBtn = document.getElementById('new-goal-btn');

const attachInput = document.getElementById('attach-input');
const attachBtn = document.getElementById('attach-btn');
const attachList = document.getElementById('attach-list');
const attachHint = document.getElementById('attach-hint');
const previewNotice = document.getElementById('preview-notice');

let pendingGoal = '';
let pendingAttachments = [];
let pendingDays = 0;
let pendingStartDate = '';
let currentPlan = null;

// ---------- 날짜 <-> 며칠(기한) 서로 계산해주는 헬퍼 ----------
function addDaysLocal(date, n) {
  const result = new Date(date);
  result.setDate(result.getDate() + n);
  return result;
}

function toDateInputValue(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// "YYYY-MM-DD" 문자열을 로컬 자정 기준 Date로 (new Date(str)는 UTC로 해석돼서 하루 밀릴 수 있어 직접 파싱)
function parseDateInputValue(str) {
  const [y, m, d] = str.split('-').map((n) => parseInt(n, 10));
  return new Date(y, m - 1, d);
}

// 기한(며칠)이 바뀌면 → 종료일을 시작일 기준으로 다시 계산
function syncDatesFromDays() {
  const days = Math.max(1, parseInt(daysInput.value, 10) || 1);
  const start = startDateInput.value ? parseDateInputValue(startDateInput.value) : new Date();
  start.setHours(0, 0, 0, 0);
  endDateInput.min = startDateInput.value;
  endDateInput.value = toDateInputValue(addDaysLocal(start, days - 1));
}

// 초기값: 오늘 시작 ~ 기한(기본 7일) 종료
(function initDateRange() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  startDateInput.value = toDateInputValue(today);
  syncDatesFromDays();
}());

function escapeHtmlText(text) {
  return String(text).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

// ---------- 예시 칩 클릭하면 목표 칸에 바로 채워줌 ----------
document.querySelectorAll('.example-chip').forEach((chip) => {
  chip.addEventListener('click', () => {
    goalInput.value = chip.dataset.example;
    goalError.hidden = true;
    goalInput.focus();
  });
});

// 기한은 항상 1~90일 사이의 정수로 (0·음수·소수·빈칸·너무 큰 값이 들어와도 보정)
function clampDays(value) {
  const n = parseInt(value, 10);
  if (!Number.isFinite(n)) return 7;
  return Math.min(90, Math.max(1, n));
}

// ---------- 기한 스테퍼 (클릭 + 꾹 누르기) ----------
function adjustDays(delta) {
  const current = parseInt(daysInput.value, 10) || 1;
  daysInput.value = Math.min(90, Math.max(1, current + delta));
  syncDatesFromDays();
}

function setupHoldableButton(button, delta) {
  let holdTimeout = null;
  let holdInterval = null;

  const start = () => {
    adjustDays(delta);
    holdTimeout = setTimeout(() => {
      holdInterval = setInterval(() => adjustDays(delta), 80);
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

// 며칠 입력칸에 직접 타이핑한 경우도 날짜에 반영
daysInput.addEventListener('input', () => {
  if (daysInput.value) syncDatesFromDays();
});
// 입력을 마치고 칸을 벗어나면 허용 범위(1~90일)로 보정
daysInput.addEventListener('change', () => {
  daysInput.value = clampDays(daysInput.value);
  syncDatesFromDays();
});

// 시작일을 바꾸면 → 기한(며칠)은 유지하고 종료일을 그만큼 옮김
startDateInput.addEventListener('change', () => {
  if (!startDateInput.value) return;
  syncDatesFromDays();
});

// 종료일을 바꾸면 → 시작일 기준으로 기한(며칠)을 다시 계산
endDateInput.addEventListener('change', () => {
  if (!startDateInput.value || !endDateInput.value) return;
  const start = parseDateInputValue(startDateInput.value);
  const end = parseDateInputValue(endDateInput.value);

  if (end < start) {
    syncDatesFromDays(); // 시작일보다 이전이면 원래대로 되돌림
    showDateNote('종료일이 시작일보다 빨라서, 기한(' + clampDays(daysInput.value) + '일)에 맞게 다시 맞췄어요.');
    return;
  }

  const newDays = Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1;
  daysInput.value = Math.max(1, Math.min(90, newDays));
});

// 날짜를 자동으로 고쳤을 때 잠깐 알려주는 안내
let dateNoteTimer = null;
function showDateNote(message) {
  let note = document.getElementById('date-note');
  if (!note) {
    note = document.createElement('p');
    note.id = 'date-note';
    note.className = 'date-note';
    note.setAttribute('role', 'status');
    endDateInput.closest('.date-range-picker').appendChild(note);
  }
  note.textContent = message;
  clearTimeout(dateNoteTimer);
  dateNoteTimer = setTimeout(() => note.remove(), 4000);
}

// ---------- 화면 전환 ----------
function showOnly(sectionToShow) {
  [formSection, loadingSection, errorSection, previewSection].forEach((section) => {
    section.hidden = section !== sectionToShow;
  });
  // 홈 한 페이지 안에서 화면이 바뀌므로, 바뀐 영역이 보이도록 입력 영역 위치로 부드럽게 이동
  const workbench = document.getElementById('workbench');
  if (workbench) workbench.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ---------- 폼 제출 ----------
goalForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const goal = goalInput.value.trim();
  const days = clampDays(daysInput.value);
  daysInput.value = days;
  syncDatesFromDays();

  if (!goal) {
    goalError.hidden = false;
    goalInput.focus();
    return;
  }
  goalError.hidden = true;

  pendingGoal = goal;
  pendingDays = days;
  pendingStartDate = startDateInput.value;

  await chopAndPreview(goal, days, pendingStartDate);
});

retryBtn.addEventListener('click', () => {
  chopAndPreview(pendingGoal, pendingDays, pendingStartDate);
});

newGoalBtn.addEventListener('click', () => {
  // 방금 썬 계획을 쓰지 않고 넘어가는 경우: 임시 보관분만 버리면 끝 (아직 계획 목록에는 안 들어갔음)
  clearDraft();
  goalForm.reset();
  daysInput.value = 7;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  startDateInput.value = toDateInputValue(today);
  syncDatesFromDays();
  currentPlan = null;
  showOnly(formSection);
});

async function chopAndPreview(goal, days, startDateValue) {
  showOnly(loadingSection);

  // 요청이 끝나기 전에 페이지를 벗어나면(새로고침/닫기/다른 페이지 이동) 요청이 끊겨버리므로,
  // 브라우저 기본 "정말 나가시겠어요?" 확인창을 띄워서 한 번 더 물어봄
  window.addEventListener('beforeunload', warnBeforeLeaving);

  try {
    const result = await requestChopping(goal, days, pendingAttachments);
    currentPlan = saveNewPlan(goal, days, result.pieces, startDateValue);
    saveDraft();
    renderPreview(currentPlan);
    if (previewNotice) {
      previewNotice.textContent = result.notice || '';
      previewNotice.hidden = !result.notice;
    }
    showOnly(previewSection);
  } catch (err) {
    console.error('[조각내기 실패]', err);
    showOnly(errorSection);
    errorMessage.textContent = describeChopError(err);
  } finally {
    window.removeEventListener('beforeunload', warnBeforeLeaving);
  }
}

function warnBeforeLeaving(event) {
  event.preventDefault();
  // 최신 브라우저는 커스텀 문구를 안 보여주고 자체 안내문을 띄우지만,
  // returnValue를 채워야 확인창 자체가 뜸
  event.returnValue = '';
}

// ---------- 실제 AI API 호출 (/api/chop) ----------
// 응답이 오래 걸리면 타임아웃으로 처리해서, 로딩이 무한정 돌지 않게 함 (첨부가 있으면 조금 더 기다림)
async function requestChopping(goal, days, attachments = []) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), attachments.length ? 40000 : 25000);

  const payloadAttachments = attachments.map((a) => (
    a.kind === 'image'
      ? { kind: 'image', name: a.name, mediaType: a.mediaType, data: a.data }
      : { kind: 'text', name: a.name, text: a.text }
  ));

  let response;
  try {
    response = await fetch('/api/chop', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ goal, days, attachments: payloadAttachments }),
      signal: controller.signal,
    });
  } catch (err) {
    if (err.name === 'AbortError') throw new Error('timeout');
    const networkError = new Error('network');
    networkError.cause = err;
    throw networkError;
  } finally {
    clearTimeout(timeoutId);
  }

  let data = null;
  try {
    data = await response.json();
  } catch (err) {
    data = null; // JSON이 아닌 응답(예: 404 페이지)
  }

  if (!response.ok) {
    const apiError = new Error('api-error');
    apiError.status = response.status;
    apiError.upstreamStatus = data && data.upstream_status;
    apiError.detail = (data && data.error) || '';
    throw apiError;
  }

  if (!data || !Array.isArray(data.pieces)) {
    const formatError = new Error('bad-format');
    throw formatError;
  }

  // 제목이 글자가 아니거나 빈 조각은 걸러내고, 너무 많으면 12개까지만
  const cleaned = data.pieces
    .map((p) => (p && typeof p.title === 'string' ? p.title.trim() : ''))
    .filter(Boolean)
    .slice(0, 12)
    .map((title) => ({ title: title.slice(0, 200) }));
  if (cleaned.length === 0) {
    throw new Error('bad-format');
  }

  return { pieces: cleaned, notice: data.notice || '' };
}

// 실패 원인에 맞는 안내 문구 (원인을 몰라서 막히는 일이 없도록 구체적으로)
function describeChopError(err) {
  if (err.message === 'timeout') {
    return '응답이 너무 오래 걸리고 있어요. 잠시 후 다시 시도해주세요.';
  }
  if (err.message === 'network') {
    return '서버에 연결하지 못했어요. 터미널에서 npx vercel dev가 켜져 있는지, 주소가 localhost:3000인지 확인해주세요.';
  }
  if (err.message === 'bad-format') {
    return 'AI가 단계를 정리하지 못했어요. 다시 시도해주세요.';
  }
  const upstream = err.upstreamStatus;
  if (err.status === 504 || err.status === 408) {
    return '조각이가 생각하는 시간이 서버 제한을 넘겼어요. 다시 한 번 시도해주세요.';
  }
  if (err.status === 404) {
    return '조각내기 서버(/api/chop)를 찾지 못했어요. npx vercel dev로 연 localhost:3000 주소에서 열었는지 확인해주세요.';
  }
  if (upstream === 401 || upstream === 403) {
    return 'AI 서비스가 API 키를 받아주지 않아요. .env(또는 Vercel 환경 변수)의 키와 주소를 확인해주세요.';
  }
  if (upstream === 429) {
    return 'AI 사용량 한도에 걸렸어요. 잠시 뒤에 다시 시도하거나 Codyssey 콘솔의 남은 사용량을 확인해주세요.';
  }
  if (err.detail) {
    return `조각이가 잠시 자리를 비웠어요. (${err.detail})`;
  }
  return '조각이가 잠시 자리를 비웠어요. 잠시 후 다시 시도해주세요.';
}

// ---------- 임시 보관(draft) → 조리하러 가기를 누르면 정식 저장 ----------
const DRAFT_KEY = 'jogak-draft';

function saveDraft() {
  try { sessionStorage.setItem(DRAFT_KEY, JSON.stringify(currentPlan)); } catch (err) { /* 저장 못 해도 화면은 계속 동작 */ }
}
function clearDraft() {
  try { sessionStorage.removeItem(DRAFT_KEY); } catch (err) { /* 무시 */ }
}
function loadDraft() {
  try {
    const draft = JSON.parse(sessionStorage.getItem(DRAFT_KEY) || 'null');
    if (draft && typeof draft === 'object' && Array.isArray(draft.pieces) && draft.pieces.length > 0 && draft.id) return draft;
  } catch (err) { /* 무시 */ }
  return null;
}

// ---------- 새 계획 만들기 (아직 저장은 안 함) ----------
function saveNewPlan(goal, totalDays, pieces, startDateValue) {
  const dish = pickDish();

  // AI는 순서만 있는 단계 목록을 주고, 날짜 배정은 기본값으로 고르게 펼쳐서 채워둠
  // (사용자가 미리보기 화면에서 조각별로 "며칠차"를 직접 바꿀 수 있음)
  const piecesWithDays = pieces.map((piece, index) => ({
    title: piece.title,
    done: false,
    day: Math.min(totalDays - 1, Math.floor((index * totalDays) / pieces.length)),
  }));

  // 시작일을 직접 골랐으면 그 날짜로, 아니면 오늘로
  const createdAt = startDateValue ? parseDateInputValue(startDateValue) : new Date();
  createdAt.setHours(0, 0, 0, 0);

  const newPlan = {
    id: generateId(),
    goal,
    totalDays,
    dish,
    createdAt: createdAt.toISOString(),
    completedAt: null,
    pieces: piecesWithDays,
  };

  // 아직 "조리하러 가기"를 누르기 전이라 계획 목록에는 넣지 않고, 이 브라우저 탭에만 임시로 보관해둠
  // (새로고침해도 결과 화면이 그대로 돌아오고, 쓰지 않고 떠나도 조리하기에 유령 계획이 남지 않음)
  return newPlan;
}

// ---------- 미리보기 렌더링 ----------
function renderPreview(plan) {
  document.getElementById('preview-dish-name').textContent = plan.dish;
  document.getElementById('preview-eyebrow').textContent = `${plan.totalDays}일짜리 목표 · ${plan.pieces.length}조각`;
  document.getElementById('preview-goal').textContent = `"${plan.goal}" 손질 완료!`;

  const list = document.getElementById('pieces-list');
  list.innerHTML = '';

  const baseDate = parseDateInputValue(toDateInputValue(new Date(plan.createdAt)));

  const canDelete = plan.pieces.length > 1;

  plan.pieces.forEach((piece, index) => {
    const pieceDate = addDaysLocal(baseDate, piece.day);
    const li = document.createElement('li');
    li.className = 'piece-item';
    li.innerHTML = `
      <span class="piece-number">${index + 1}</span>
      <div class="piece-content"><strong>${escapeHtmlText(piece.title)}</strong></div>
      <div class="piece-actions">
        <button type="button" class="piece-act-btn" data-act="edit" data-piece-index="${index}" aria-label="${index + 1}조각 내용 수정" title="내용 수정">✎</button>
        <button type="button" class="piece-act-btn" data-act="delete" data-piece-index="${index}" aria-label="${index + 1}조각 삭제" title="삭제" ${canDelete ? '' : 'disabled'}>🗑</button>
      </div>
      <div class="piece-day-edit">
        <input type="number" class="piece-day-input" value="${piece.day + 1}" min="1" max="${plan.totalDays}" data-piece-index="${index}" aria-label="${index + 1}조각 며칠차">
        <span class="piece-day-unit">일차</span>
        <span class="piece-day-date">(${pieceDate.getMonth() + 1}/${pieceDate.getDate()})</span>
      </div>
    `;
    list.appendChild(li);
  });

  list.querySelectorAll('.piece-day-input').forEach((input) => {
    input.addEventListener('change', () => {
      const index = parseInt(input.dataset.pieceIndex, 10);
      const newDayNumber = Math.max(1, Math.min(currentPlan.totalDays, parseInt(input.value, 10) || 1));
      input.value = newDayNumber;

      currentPlan.pieces[index].day = newDayNumber - 1;

      saveDraft();

      renderPreview(currentPlan); // 날짜 라벨(M/D)도 같이 갱신
    });
  });

  list.querySelectorAll('.piece-act-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const index = parseInt(btn.dataset.pieceIndex, 10);
      if (btn.dataset.act === 'delete') deletePiece(index);
      else startEditPiece(index, btn.closest('.piece-item'));
    });
  });
}

function deletePiece(index) {
  if (currentPlan.pieces.length <= 1) return; // 조각이 하나도 없는 계획은 만들 수 없음
  currentPlan.pieces.splice(index, 1);
  saveDraft();
  renderPreview(currentPlan);
}

// 조각 내용을 그 자리에서 고침 (Enter/바깥 클릭=저장, Esc=취소)
function startEditPiece(index, li, isNew = false) {
  const contentEl = li.querySelector('.piece-content');
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'edit-text-input';
  input.maxLength = 150;
  input.value = isNew ? '' : currentPlan.pieces[index].title;
  input.placeholder = '이 조각에서 할 일을 적어주세요';
  input.setAttribute('aria-label', `${index + 1}조각 내용`);
  contentEl.replaceWith(input);
  input.focus();
  input.select();

  let finished = false;
  const finish = (save) => {
    if (finished) return;
    finished = true;
    const next = input.value.trim();
    if (save && next) {
      if (isNew) {
        const lastDay = currentPlan.pieces.length ? currentPlan.pieces[currentPlan.pieces.length - 1].day : 0;
        currentPlan.pieces.push({ title: next, done: false, day: lastDay });
      } else {
        currentPlan.pieces[index].title = next;
      }
      saveDraft();
    }
    renderPreview(currentPlan);
  };
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); finish(true); }
    else if (e.key === 'Escape') { e.preventDefault(); finish(false); }
  });
  input.addEventListener('blur', () => finish(true));
}

// 조각 직접 추가: 끝에 빈 줄을 하나 보여주고 바로 입력받음 (비워두면 추가되지 않음)
const addPieceBtn = document.getElementById('add-piece-btn');
addPieceBtn.addEventListener('click', () => {
  if (!currentPlan || document.querySelector('#pieces-list .edit-text-input')) return;
  if (currentPlan.pieces.length >= 20) return;
  const list = document.getElementById('pieces-list');
  const li = document.createElement('li');
  li.className = 'piece-item';
  li.innerHTML = `<span class="piece-number">${currentPlan.pieces.length + 1}</span><div class="piece-content"></div>`;
  list.appendChild(li);
  startEditPiece(currentPlan.pieces.length, li, true);
});

// "요리하러 가기"를 누르는 순간 정식으로 계획 목록에 저장
document.querySelector('.preview-cta').addEventListener('click', (event) => {
  if (!currentPlan) return;
  const plans = loadPlans();
  if (!plans.some((p) => p.id === currentPlan.id)) plans.push(currentPlan);
  if (!savePlans(plans)) {
    event.preventDefault();
    showOnly(errorSection);
    errorMessage.textContent = '브라우저가 저장을 막고 있어요. 시크릿 모드이거나 저장 공간이 가득 찼는지 확인해주세요.';
    return;
  }
  clearDraft();
});

// 새로고침·다른 페이지에 다녀온 뒤에도 쓰던 결과 화면으로 돌아오게
(function restoreDraft() {
  const draft = loadDraft();
  if (!draft) return;
  currentPlan = draft;
  renderPreview(currentPlan);
  showOnly(previewSection);
}());

// ---------- 파일 · 이미지 첨부 ----------
// 이미지는 브라우저에서 작게 줄여서(가로세로 최대 1280px, JPEG) 보내고,
// 텍스트 파일(txt/md/csv/json)은 내용을 글자로 읽어서 보냅니다. 최대 3개.
const MAX_ATTACHMENTS = 3;
const MAX_TEXT_CHARS = 8000;
const MAX_PDF_CHARS = 12000;      // PDF는 글이 길 수 있어서 조금 더 넉넉히
const MAX_PDF_PAGES = 30;         // 앞쪽 30쪽까지만 읽음
const MAX_PDF_BYTES = 10 * 1024 * 1024;
const TEXT_EXTENSIONS = ['txt', 'md', 'csv', 'json'];
const PDFJS_URL = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
const PDFJS_WORKER_URL = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

function setAttachHint(message, isError = false) {
  if (!attachHint) return;
  attachHint.textContent = message;
  attachHint.classList.toggle('is-error', isError);
}

const DEFAULT_ATTACH_HINT = '지금 상황을 보여주는 스크린샷이나 메모를 올리면 더 알맞게 나눠드려요. (이미지·PDF·txt·md·csv, 최대 3개)';

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

async function compressImage(file) {
  const originalUrl = await readFileAsDataUrl(file);
  const img = await loadImage(originalUrl);
  const maxSide = 1280;
  const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff'; // 투명 PNG가 검게 나오지 않게
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
  return { previewUrl: dataUrl, data: dataUrl.split(',')[1], mediaType: 'image/jpeg' };
}

// ---------- PDF 글자 꺼내기 (pdf.js를 PDF를 처음 올릴 때만 불러옴) ----------
let pdfjsLoadingPromise = null;

function loadPdfJs() {
  if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
  if (pdfjsLoadingPromise) return pdfjsLoadingPromise;

  pdfjsLoadingPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = PDFJS_URL;
    script.onload = () => {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL;
      resolve(window.pdfjsLib);
    };
    script.onerror = () => {
      pdfjsLoadingPromise = null; // 다음에 다시 시도할 수 있게
      reject(new Error('pdfjs-load-failed'));
    };
    document.head.appendChild(script);
  });
  return pdfjsLoadingPromise;
}

async function extractPdfText(file) {
  if (file.size > MAX_PDF_BYTES) throw new Error('pdf-too-big');

  const pdfjsLib = await loadPdfJs();
  const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
  const pageCount = Math.min(pdf.numPages, MAX_PDF_PAGES);
  let text = '';

  for (let pageNumber = 1; pageNumber <= pageCount && text.length < MAX_PDF_CHARS; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    text += `${content.items.map((item) => item.str).join(' ')}\n`;
  }

  text = text.replace(/[ \t]+/g, ' ').trim();
  if (text.length < 20) throw new Error('pdf-no-text'); // 스캔본처럼 글자가 없는 PDF
  return text.slice(0, MAX_PDF_CHARS);
}

function fileExtension(name) {
  const parts = name.toLowerCase().split('.');
  return parts.length > 1 ? parts.pop() : '';
}

async function addFiles(fileList) {
  const files = Array.from(fileList || []);
  let rejected = '';

  for (const file of files) {
    if (pendingAttachments.length >= MAX_ATTACHMENTS) {
      rejected = `첨부는 최대 ${MAX_ATTACHMENTS}개까지예요.`;
      break;
    }

    try {
      if (file.type.startsWith('image/')) {
        const image = await compressImage(file);
        pendingAttachments.push({ kind: 'image', name: file.name || '붙여넣은 이미지', ...image });
      } else if (file.type === 'application/pdf' || fileExtension(file.name) === 'pdf') {
        setAttachHint(`"${file.name}" 글자를 읽는 중이에요...`);
        const text = await extractPdfText(file);
        pendingAttachments.push({ kind: 'text', name: file.name, text, label: 'PDF' });
      } else if (TEXT_EXTENSIONS.includes(fileExtension(file.name)) || file.type.startsWith('text/')) {
        const text = (await file.text()).slice(0, MAX_TEXT_CHARS);
        pendingAttachments.push({ kind: 'text', name: file.name, text, label: 'TXT' });
      } else {
        rejected = '이미지, PDF, txt·md·csv 파일만 첨부할 수 있어요. 워드나 한글 문서는 내용을 복사해서 입력창에 붙여넣어주세요.';
      }
    } catch (err) {
      console.error('[첨부 실패]', err);
      if (err.message === 'pdf-no-text') {
        rejected = `"${file.name}"에서 글자를 찾지 못했어요. 스캔한 PDF는 읽을 수 없어요. 캡처 이미지로 올리거나 내용을 입력창에 붙여넣어주세요.`;
      } else if (err.message === 'pdf-too-big') {
        rejected = `"${file.name}"이 너무 커요. 10MB 이하 PDF만 올릴 수 있어요.`;
      } else if (err.message === 'pdfjs-load-failed') {
        rejected = 'PDF를 읽는 도구를 불러오지 못했어요. 인터넷 연결을 확인하고 다시 시도해주세요.';
      } else {
        rejected = `"${file.name}" 파일을 읽지 못했어요.`;
      }
    }
  }

  renderAttachments();
  setAttachHint(rejected || DEFAULT_ATTACH_HINT, Boolean(rejected));
}

function renderAttachments() {
  if (!attachList) return;
  attachList.innerHTML = '';

  pendingAttachments.forEach((item, index) => {
    const li = document.createElement('li');
    li.className = 'attach-item';

    const thumb = item.kind === 'image'
      ? `<img src="${item.previewUrl}" alt="" class="attach-thumb">`
      : `<span class="attach-thumb attach-thumb--text" aria-hidden="true">${item.label || 'TXT'}</span>`;

    li.innerHTML = `
      ${thumb}
      <span class="attach-name"></span>
      <button type="button" class="attach-remove" aria-label="첨부 삭제">×</button>
    `;
    li.querySelector('.attach-name').textContent = item.name; // 파일 이름은 글자로만 넣음(HTML로 해석 방지)
    li.querySelector('.attach-remove').addEventListener('click', () => {
      pendingAttachments.splice(index, 1);
      renderAttachments();
      setAttachHint(DEFAULT_ATTACH_HINT);
    });
    attachList.appendChild(li);
  });

  if (attachBtn) attachBtn.disabled = pendingAttachments.length >= MAX_ATTACHMENTS;
}

if (attachBtn && attachInput) {
  attachBtn.addEventListener('click', () => attachInput.click());
  attachInput.addEventListener('change', async () => {
    await addFiles(attachInput.files);
    attachInput.value = ''; // 같은 파일을 다시 고를 수 있게 초기화
  });

  // 입력창에 이미지 붙여넣기(Cmd+V)
  goalInput.addEventListener('paste', (event) => {
    const images = Array.from(event.clipboardData ? event.clipboardData.files : []).filter((f) => f.type.startsWith('image/'));
    if (images.length) {
      event.preventDefault();
      addFiles(images);
    }
  });

  // 카드 위로 파일 끌어다 놓기
  ['dragover', 'drop'].forEach((type) => {
    formSection.addEventListener(type, (event) => {
      if (!event.dataTransfer || !Array.from(event.dataTransfer.types).includes('Files')) return;
      event.preventDefault();
      formSection.classList.toggle('is-dragging', type === 'dragover');
      if (type === 'drop') addFiles(event.dataTransfer.files);
    });
  });
  formSection.addEventListener('dragleave', () => formSection.classList.remove('is-dragging'));
}

// "다른 목표 썰기"를 누르면 첨부도 비움
newGoalBtn.addEventListener('click', () => {
  pendingAttachments = [];
  renderAttachments();
  setAttachHint(DEFAULT_ATTACH_HINT);
});
