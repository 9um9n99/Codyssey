// calendar.js
// "캘린더" 페이지 — cutting.html에서 저장한 진행 중인 계획(jogak-active-plan)을
// 달력 위에 오이 조각(색깔 막대)이 이어지는 형태로 보여줍니다.

const PIECE_COLORS = [
  '#3F6E44', '#E2673B', '#E8A93E', '#6FA25B', '#C9515F',
  '#4C7A9E', '#9B6B3C', '#7A5DA6', '#3E8E7E', '#B0552B',
];

const emptyState = document.getElementById('calendar-empty');
const calendarWrap = document.getElementById('calendar-wrap');
const calendarGrid = document.getElementById('calendar-grid');
const calendarLegend = document.getElementById('calendar-legend');
const calendarSubtitle = document.getElementById('calendar-subtitle');

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

// 특정 월의 달력을 꽉 채우는 날짜 배열 생성 (앞뒤 다른 달 날짜 포함)
function getMonthGrid(year, month) {
  const firstOfMonth = new Date(year, month, 1);
  const startOffset = firstOfMonth.getDay(); // 0(일) ~ 6(토)
  const gridStart = addDays(firstOfMonth, -startOffset);

  const days = [];
  for (let i = 0; i < 42; i += 1) { // 6주 x 7일
    days.push(addDays(gridStart, i));
  }
  return days;
}

function loadActivePlan() {
  const raw = localStorage.getItem('jogak-active-plan');
  return raw ? JSON.parse(raw) : null;
}

function renderCalendar() {
  const plan = loadActivePlan();

  if (!plan) {
    emptyState.hidden = false;
    calendarWrap.hidden = true;
    return;
  }

  emptyState.hidden = true;
  calendarWrap.hidden = false;

  const baseDate = new Date(plan.createdAt);
  baseDate.setHours(0, 0, 0, 0);

  calendarSubtitle.textContent = `"${plan.goal}" — ${plan.totalDays}일 목표 진행 중`;

  const days = getMonthGrid(baseDate.getFullYear(), baseDate.getMonth());

  calendarGrid.innerHTML = '';
  calendarLegend.innerHTML = '';

  days.forEach((date) => {
    const cell = document.createElement('div');
    cell.className = 'cal-day';
    if (date.getMonth() !== baseDate.getMonth()) {
      cell.classList.add('cal-day--outside');
    }
    if (isSameDate(date, new Date())) {
      cell.classList.add('cal-day--today');
    }

    const dayNum = document.createElement('span');
    dayNum.className = 'cal-daynum';
    dayNum.textContent = date.getDate();
    cell.appendChild(dayNum);

    const barsWrap = document.createElement('div');
    barsWrap.className = 'cal-bars';

    plan.pieces.forEach((piece, index) => {
      const pieceStart = addDays(baseDate, piece.startDay);
      const pieceEnd = addDays(baseDate, piece.endDay);

      if (date >= pieceStart && date <= pieceEnd) {
        const bar = document.createElement('div');
        bar.className = 'cal-bar';
        bar.style.background = PIECE_COLORS[index % PIECE_COLORS.length];
        bar.title = `${index + 1}조각 · ${piece.title}`;

        // 같은 조각이 이어지는 느낌을 주기 위해, 시작/끝/중간에 따라 모서리를 다르게
        const isRowStart = date.getDay() === 0 || isSameDate(date, pieceStart);
        const isRowEnd = date.getDay() === 6 || isSameDate(date, pieceEnd);
        if (isSameDate(date, pieceStart) || isRowStart) bar.classList.add('cal-bar--start');
        if (isSameDate(date, pieceEnd) || isRowEnd) bar.classList.add('cal-bar--end');

        if (isSameDate(date, pieceStart)) {
          bar.textContent = `${index + 1}조각`;
        }

        barsWrap.appendChild(bar);
      }
    });

    cell.appendChild(barsWrap);
    calendarGrid.appendChild(cell);
  });

  // 범례
  plan.pieces.forEach((piece, index) => {
    const item = document.createElement('div');
    item.className = 'legend-item';
    item.innerHTML = `
      <span class="legend-swatch" style="background:${PIECE_COLORS[index % PIECE_COLORS.length]}"></span>
      <span>${index + 1}조각 · ${piece.title} (${piece.days}일)</span>
    `;
    calendarLegend.appendChild(item);
  });
}

renderCalendar();
